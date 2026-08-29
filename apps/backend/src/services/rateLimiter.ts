import { redisClient } from '../lib/redis';
import { config } from '../config/env';
import { emailQueue } from '../queues/emailQueue';
import { dbService } from '../lib/db';
import { EmailJobData } from '../queues/emailQueue';
import { EmailStatus } from '@prisma/client';

const HOUR_MS = 3_600_000;

/**
 * Per-sender hourly rate limiter backed by Redis atomic counters.
 *
 * Key scheme:  outbox:ratelimit:{senderId}:{hourWindow}
 *   - hourWindow = Math.floor(now / 3_600_000) — integer epoch-hour
 *   - TTL = 7200s (2 hours) — self-cleaning, no manual garbage collection
 *
 * Algorithm:
 *   1. INCR the counter atomically.
 *   2. If the returned count is the first increment (== 1), set EXPIRE 7200.
 *   3. If count <= limit → allowed, proceed to send.
 *   4. If count > limit  → over budget. DECR to undo, then requeue the job
 *      into the next available hour window.
 */

/**
 * Returns the Redis key for a sender's hourly counter.
 */
function rateLimitKey(senderId: string, hourWindow: number): string {
  return `outbox:ratelimit:${senderId}:${hourWindow}`;
}

/**
 * Get current hour window number (integer epoch-hour).
 */
function currentHourWindow(now?: number): number {
  return Math.floor((now || Date.now()) / HOUR_MS);
}

export interface RateLimitCheckResult {
  allowed: boolean;
  currentCount: number;
  limit: number;
  hourWindow: number;
  /** If not allowed, the ms delay until the next available window */
  retryDelayMs?: number;
  /** If not allowed, the target timestamp for the next window */
  nextWindowStart?: Date;
}

/**
 * Atomically check and consume one rate limit slot for a sender.
 * Returns whether the send is allowed, or details for requeueing.
 */
export async function checkAndConsumeRateLimit(
  senderId: string,
  limit?: number
): Promise<RateLimitCheckResult> {
  const maxPerHour = limit || config.rateLimit.maxEmailsPerHourPerSender;
  const now = Date.now();
  const window = currentHourWindow(now);
  const key = rateLimitKey(senderId, window);

  // Atomic increment
  const newCount = await redisClient.incr(key);

  // Set TTL on first increment (idempotent — only sets if not already set)
  if (newCount === 1) {
    await redisClient.expire(key, 7200); // 2 hours
  }

  if (newCount <= maxPerHour) {
    // Allowed
    return {
      allowed: true,
      currentCount: newCount,
      limit: maxPerHour,
      hourWindow: window,
    };
  }

  // Over limit — undo the increment
  await redisClient.decr(key);

  // Calculate next available window
  const nextWindow = window + 1;
  const nextWindowStartMs = nextWindow * HOUR_MS;
  const retryDelayMs = nextWindowStartMs - now;

  return {
    allowed: false,
    currentCount: newCount - 1, // actual count after DECR
    limit: maxPerHour,
    hourWindow: window,
    retryDelayMs,
    nextWindowStart: new Date(nextWindowStartMs),
  };
}

/**
 * Requeue a rate-limited job into the next available hour window.
 *
 * - Removes the current BullMQ job
 * - Adds a new delayed job targeting the next window start
 * - Updates the DB row's scheduledAt and status back to SCHEDULED
 * - Preserves original order by using the same idempotencyKey-based job ID
 *   with a window suffix to avoid BullMQ duplicate-ID rejection
 */
export async function requeueToNextWindow(
  job: { id?: string; data: EmailJobData },
  rateLimitResult: RateLimitCheckResult
): Promise<{ newJobId: string; nextWindowStart: Date; delayMs: number }> {
  const { emailId, idempotencyKey } = job.data;
  const nextWindowStart = rateLimitResult.nextWindowStart!;
  const delayMs = Math.max(0, rateLimitResult.retryDelayMs || 0);

  // Generate a new unique job ID incorporating the target window
  // so the same idempotencyKey can be requeued to different windows
  const nextWindow = rateLimitResult.hourWindow + 1;
  const newJobId = `${idempotencyKey}_ratelimit_w${nextWindow}`;

  console.log(
    `[RateLimit] Requeueing email ${emailId} to window ${nextWindow} ` +
    `(${nextWindowStart.toISOString()}) with delay ${Math.round(delayMs / 1000)}s`
  );

  // Remove the old job from BullMQ (if it still exists)
  try {
    const oldJob = await emailQueue.getJob(String(job.id));
    if (oldJob) {
      await oldJob.remove();
    }
  } catch (err: any) {
    // Non-fatal — job may already be removed
    console.warn(`[RateLimit] Could not remove old job ${job.id}: ${err.message}`);
  }

  // Add new delayed job
  const newJob = await emailQueue.add(
    'email-send',
    {
      ...job.data,
      scheduledAt: nextWindowStart.toISOString(),
    },
    {
      delay: delayMs,
      jobId: newJobId,
      attempts: 3,
      backoff: { type: 'exponential', delay: 5000 },
      removeOnComplete: false,
      removeOnFail: false,
    }
  );

  // Update DB row: push scheduledAt forward, revert status to SCHEDULED
  await dbService.updateEmailStatus(emailId, {
    status: EmailStatus.SCHEDULED,
    bullmqJobId: String(newJob.id),
  });

  // Also update scheduledAt in DB directly
  try {
    const { prisma } = await import('../lib/prisma');
    await prisma.email.update({
      where: { id: emailId },
      data: {
        scheduledAt: nextWindowStart,
        bullmqJobId: String(newJob.id),
        updatedAt: new Date(),
      },
    });
  } catch (err: any) {
    console.warn(`[RateLimit] DB scheduledAt update failed for ${emailId}: ${err.message}`);
  }

  return {
    newJobId: String(newJob.id),
    nextWindowStart,
    delayMs,
  };
}

/**
 * Get the current count for a sender in the current hour window (read-only).
 */
export async function getSenderHourlyCount(senderId: string): Promise<number> {
  const window = currentHourWindow();
  const key = rateLimitKey(senderId, window);
  const count = await redisClient.get(key);
  return count ? parseInt(count, 10) : 0;
}
