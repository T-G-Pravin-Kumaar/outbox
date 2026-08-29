import { Queue } from 'bullmq';
import { config } from '../config/env';

export interface EmailJobData {
  emailId: string;
  senderId: string;
  recipientEmail: string;
  subject: string;
  body: string;
  scheduledAt: string;
  idempotencyKey: string;
  metadata?: Record<string, any>;
}

import { getRedisOptions } from '../lib/redis';

export const EMAIL_QUEUE_NAME = 'email-send';

const parsedRedis = getRedisOptions();

export const redisConnectionOptions = parsedRedis.url.startsWith('redis://') || parsedRedis.url.startsWith('rediss://')
  ? {
      // Connect using parsed connection string or object configuration
      port: undefined as any,
      host: undefined as any,
      password: undefined as any,
      tls: parsedRedis.tls,
      maxRetriesPerRequest: null,
      path: undefined as any,
      // Pass the connection string in config to BullMQ
    }
  : {
      host: config.redis.host,
      port: config.redis.port,
      password: config.redis.password,
      maxRetriesPerRequest: null,
    };

// Since BullMQ Queue constructor supports connection as ConnectionOptions OR a Redis instance
// Let's create an ioredis instance for Queue and Worker connection to be fully robust under SSL!
import Redis from 'ioredis';
export const sharedRedisConnection = new Redis(parsedRedis.url, {
  maxRetriesPerRequest: null,
  tls: parsedRedis.tls,
});

export const emailQueue = new Queue<EmailJobData>(EMAIL_QUEUE_NAME, {
  connection: sharedRedisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000, // 5s, 10s, 20s exponential backoff on transient failure
    },
    removeOnComplete: false,
    removeOnFail: false,
  },
});

export async function addEmailSendJob(
  jobData: EmailJobData,
  delayMs: number
) {
  const safeDelay = Math.max(0, delayMs);
  const jobId = jobData.idempotencyKey || jobData.emailId;

  console.log(
    `[BullMQ] Enqueueing delayed job for email ${jobData.emailId} to <${jobData.recipientEmail}> with delay ${safeDelay}ms (${Math.round(
      safeDelay / 1000
    )}s)`
  );

  const job = await emailQueue.add(EMAIL_QUEUE_NAME, jobData, {
    delay: safeDelay,
    jobId,
  });

  return job;
}
