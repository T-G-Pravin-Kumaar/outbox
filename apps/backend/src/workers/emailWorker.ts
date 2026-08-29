import { Worker, Job } from 'bullmq';
import { EMAIL_QUEUE_NAME, redisConnectionOptions, EmailJobData, sharedRedisConnection } from '../queues/emailQueue';
import { sendEmailViaEthereal } from '../services/mailer';
import { checkAndConsumeRateLimit, requeueToNextWindow } from '../services/rateLimiter';
import { dbService } from '../lib/db';
import { redisClient } from '../lib/redis';
import { EmailStatus } from '@prisma/client';
import { config } from '../config/env';

export function createEmailWorker() {
  const concurrency = config.rateLimit.workerConcurrency;
  const minDelayMs = config.rateLimit.minDelaySeconds * 1000;
  const maxPerSender = config.rateLimit.maxEmailsPerHourPerSender;

  console.log(`[Worker] Initializing BullMQ email worker`);
  console.log(`[Worker]   Concurrency:        ${concurrency} (env WORKER_CONCURRENCY)`);
  console.log(`[Worker]   Min delay between:   ${config.rateLimit.minDelaySeconds}s / ${minDelayMs}ms (env MIN_DELAY_SECONDS)`);
  console.log(`[Worker]   Max per sender/hr:   ${maxPerSender} (env MAX_EMAILS_PER_HOUR_PER_SENDER)`);
  console.log(`[Worker]   BullMQ limiter:      { max: 1, duration: ${minDelayMs} }`);

  const worker = new Worker<EmailJobData>(
    EMAIL_QUEUE_NAME,
    async (job: Job<EmailJobData>) => {
      const { emailId, senderId, recipientEmail, subject, body, idempotencyKey } = job.data;
      const targetIdempotencyKey = idempotencyKey || job.id || emailId;
      const wallTime = new Date().toISOString();

      console.log(`\n------------------------------------------------------------`);
      console.log(`[Worker] [Job #${job.id}] Processing at ${wallTime}`);
      console.log(`[Worker] Email ID: ${emailId} | Idempotency Key: ${targetIdempotencyKey}`);
      console.log(`[Worker] Recipient: <${recipientEmail}> | Subject: "${subject}"`);

      // ========================================================================
      // 1. Idempotency Pre-Check: Prevent duplicate sends
      // ========================================================================
      const existingEmail = await dbService.findEmailById(emailId);
      if (existingEmail && existingEmail.status === EmailStatus.SENT) {
        console.log(
          `[Worker] ⚡ IDEMPOTENCY GUARD: Email ${emailId} was ALREADY SENT at ${existingEmail.sentAt}. Skipping duplicate dispatch.`
        );
        return {
          success: true,
          emailId,
          recipientEmail,
          previewUrl: existingEmail.previewUrl,
          sentAt: existingEmail.sentAt,
          idempotentSkip: true,
        };
      }

      // Check Redis idempotency dispatched receipt
      const alreadyDispatched = await redisClient.get(`outbox:dispatched:${targetIdempotencyKey}`);
      if (alreadyDispatched) {
        console.log(
          `[Worker] ⚡ IDEMPOTENCY GUARD: Receipt found in Redis for key ${targetIdempotencyKey}. Skipping duplicate dispatch.`
        );
        return {
          success: true,
          emailId,
          recipientEmail,
          previewUrl: existingEmail?.previewUrl,
          sentAt: existingEmail?.sentAt,
          idempotentSkip: true,
        };
      }

      // ========================================================================
      // 2. Per-Sender Hourly Rate Limit Check
      // ========================================================================
      const rateLimitResult = await checkAndConsumeRateLimit(senderId);

      if (!rateLimitResult.allowed) {
        console.log(
          `[Worker] 🚦 RATE LIMIT: Sender ${senderId} has hit ${rateLimitResult.currentCount}/${rateLimitResult.limit} ` +
          `emails this hour (window ${rateLimitResult.hourWindow}). Requeueing to next window...`
        );

        const requeue = await requeueToNextWindow(job, rateLimitResult);

        // Slack notification trigger (with 1-hour cooldown per sender window)
        try {
          const sender = await dbService.findSenderById(senderId);
          if (sender && sender.userId) {
            const cooldownKey = `outbox:slack_cooldown:${senderId}:${rateLimitResult.hourWindow}`;
            const cooldownActive = await redisClient.get(cooldownKey);
            if (!cooldownActive) {
              await redisClient.set(cooldownKey, 'active', 'EX', 3600); // 1-hour cooldown
              
              const { prisma } = await import('../lib/prisma');
              const remainingCount = await prisma.email.count({
                where: {
                  senderId,
                  status: {
                    in: [EmailStatus.SCHEDULED, EmailStatus.QUEUED, EmailStatus.SENDING],
                  },
                },
              });

              const { slackService } = await import('../services/slack');
              const nextWindowStr = rateLimitResult.nextWindowStart?.toISOString() || requeue.nextWindowStart.toISOString();
              const slackMessage = `🚦 *Rate Limit Hit* for Sender <${sender.email}>:\n• Limit: *${rateLimitResult.limit}/hr* (current count: ${rateLimitResult.currentCount})\n• Action: Rescheduled *${remainingCount}* email(s) to the next hour window starting at \`${nextWindowStr}\`.`;

              console.log(`[Worker] [Slack] Sending rate limit alert for user ${sender.userId}`);
              await slackService.sendSlackNotification(sender.userId, slackMessage);
            } else {
              console.log(`[Worker] [Slack] Cooldown active for sender ${senderId} in window ${rateLimitResult.hourWindow}. Skipping notification.`);
            }
          }
        } catch (err: any) {
          console.warn(`[Worker] [Slack] Failed to send rate limit notification:`, err.message);
        }

        console.log(
          `[Worker] 🚦 REQUEUED: Email ${emailId} → new job ${requeue.newJobId}, ` +
          `fires at ${requeue.nextWindowStart.toISOString()} (delay ${Math.round(requeue.delayMs / 1000)}s)`
        );
        console.log(`------------------------------------------------------------\n`);

        return {
          success: true,
          emailId,
          recipientEmail,
          rateLimited: true,
          requeuedTo: requeue.nextWindowStart.toISOString(),
          newJobId: requeue.newJobId,
        };
      }

      console.log(
        `[Worker] ✅ Rate limit OK: ${rateLimitResult.currentCount}/${rateLimitResult.limit} for sender ${senderId} (window ${rateLimitResult.hourWindow})`
      );

      // ========================================================================
      // 3. Distributed Atomic Lock (SETNX with 120s TTL)
      // ========================================================================
      const lockKey = `outbox:lock:send:${targetIdempotencyKey}`;
      const lockAcquired = await redisClient.set(lockKey, 'in_progress', 'EX', 120, 'NX');

      if (!lockAcquired) {
        console.warn(
          `[Worker] ⚠️ Lock contention: Job ${job.id} is already being dispatched by another worker instance. Checking status...`
        );
        const check = await dbService.findEmailById(emailId);
        if (check && check.status === EmailStatus.SENT) {
          return { success: true, emailId, idempotentSkip: true };
        }
        throw new Error(`Concurrent dispatch lock active for idempotency key ${targetIdempotencyKey}`);
      }

      try {
        // Fetch sender details
        const sender =
          (await dbService.findSenderById(senderId)) ||
          (await dbService.findDefaultSender());
        const fromEmail = sender?.email || 'no-reply@outbox.reachinbox.ai';
        const fromName = sender?.displayName || 'ReachInbox Outbox';

        // 4. Mark status as SENDING
        await dbService.updateEmailStatus(emailId, {
          status: EmailStatus.SENDING,
          bullmqJobId: String(job.id),
        });

        const smtpConfig = sender && sender.smtpHost && sender.smtpUser && sender.smtpPass && sender.smtpUser.endsWith('@ethereal.email')
          ? {
              host: sender.smtpHost,
              port: sender.smtpPort,
              user: sender.smtpUser,
              pass: sender.smtpPass,
              secure: sender.smtpSecure,
            }
          : undefined;

        // 5. Send email via fake SMTP (Ethereal)
        const sendResult = await sendEmailViaEthereal({
          fromEmail,
          fromName,
          toEmail: recipientEmail,
          subject,
          body,
          smtpConfig,
        });

        const previewUrl = sendResult.previewUrl || '';

        // 6. Update status as SENT in database
        const updated = await dbService.updateEmailStatus(emailId, {
          status: EmailStatus.SENT,
          sentAt: new Date(),
          previewUrl,
          bullmqJobId: String(job.id),
        });

        // Store permanent idempotency receipt in Redis (7 days TTL)
        await redisClient.set(`outbox:dispatched:${targetIdempotencyKey}`, '1', 'EX', 86400 * 7);

        const sentAtStr =
          updated?.sentAt instanceof Date
            ? updated.sentAt.toISOString()
            : updated?.sentAt;

        console.log(`[Worker] ✅ Email delivered to <${recipientEmail}> at ${new Date().toISOString()}`);
        console.log(`[Worker] Ethereal Preview URL: ${previewUrl || 'N/A'}`);
        console.log(`[Worker] DB Status Updated: ${updated?.status} at ${sentAtStr || new Date().toISOString()}`);
        console.log(`------------------------------------------------------------\n`);

        return {
          success: true,
          emailId,
          recipientEmail,
          previewUrl,
          sentAt: updated?.sentAt,
        };
      } catch (error: any) {
        console.error(`[Worker] ❌ Failed to deliver email ${emailId}:`, error.message);

        // Mark as FAILED in DB and re-throw for BullMQ retry
        await dbService.updateEmailStatus(emailId, {
          status: EmailStatus.FAILED,
          errorMessage: error.message,
          bullmqJobId: String(job.id),
        });

        throw error;
      } finally {
        // Release the in-progress lock
        await redisClient.del(lockKey).catch(() => {});
      }
    },
    {
      connection: sharedRedisConnection,
      concurrency,
      limiter: {
        max: 1,
        duration: minDelayMs,
      },
    }
  );

  worker.on('ready', () => {
    console.log(
      `[Worker] BullMQ Worker is READY and listening for delayed/queued jobs on queue: ${EMAIL_QUEUE_NAME}`
    );
  });

  worker.on('completed', (job: Job<EmailJobData>) => {
    console.log(`[Worker Event] Job ${job.id} completed successfully.`);
  });

  worker.on('failed', (job: Job<EmailJobData> | undefined, err: Error) => {
    console.warn(
      `[Worker Event] Job ${job?.id} failed on attempt ${job?.attemptsMade}/${job?.opts?.attempts}: ${err.message}`
    );
  });

  worker.on('error', (err: Error) => {
    console.error('[Worker Error]:', err.message);
  });

  return worker;
}
