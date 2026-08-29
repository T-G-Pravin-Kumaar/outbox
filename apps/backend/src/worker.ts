import { createEmailWorker } from './workers/emailWorker';
import { config } from './config/env';

console.log('====================================================');
console.log('🚀 Starting ReachInbox Outbox BullMQ Worker Process');
console.log(`   WORKER_CONCURRENCY            = ${config.rateLimit.workerConcurrency}`);
console.log(`   MIN_DELAY_SECONDS              = ${config.rateLimit.minDelaySeconds}`);
console.log(`   MAX_EMAILS_PER_HOUR_PER_SENDER = ${config.rateLimit.maxEmailsPerHourPerSender}`);
console.log('====================================================');

const worker = createEmailWorker();

process.on('SIGTERM', async () => {
  console.log('[Worker Process] Gracefully shutting down worker...');
  await worker.close();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('[Worker Process] Gracefully shutting down worker...');
  await worker.close();
  process.exit(0);
});
