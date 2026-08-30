import express from 'express';
import cors from 'cors';
import { config } from './config/env';
import { healthRouter } from './routes/health';
import { emailRouter } from './routes/emailRoutes';
import { slackRouter } from './routes/slackRoutes';
import { searchRouter } from './routes/searchRoutes';
import { searchService } from './services/search';
import { adminRouter } from './routes/adminRoutes';
import { authRouter } from './routes/authRoutes';
import { createEmailWorker } from './workers/emailWorker';

const app = express();

app.use(
  cors({
    origin: config.frontendUrl || true,
    credentials: true,
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health Check route
app.use('/', healthRouter);

// Queue Dashboard Router (Basic Auth protected)
app.use('/', adminRouter);

// Email Scheduler API & Slack routes
app.use('/api', authRouter);
app.use('/api', slackRouter);
app.use('/api', searchRouter);
app.use('/api', emailRouter);

// Root greeting
app.get('/', (_req, res) => {
  res.json({
    message: 'ReachInbox Outbox Email Scheduler API',
    version: '1.0.0',
    endpoints: {
      health: '/health',
      schedule: 'POST /api/emails/schedule',
      listEmails: 'GET /api/emails',
      listSenders: 'GET /api/senders',
      search: 'GET /api/emails/search?q=<query>',
    },
  });
});

const server = app.listen(config.port, '0.0.0.0', async () => {
  console.log(`[Backend] Outbox Email Scheduler API server running on http://localhost:${config.port}`);
  console.log(`[Backend] Health check available at http://localhost:${config.port}/health`);
  
  // Start BullMQ Worker in-process
  if (process.env.START_WORKER !== 'false') {
    console.log('[Backend] Starting unified BullMQ worker...');
    try {
      createEmailWorker();
    } catch (workerErr) {
      console.warn('[Backend] Worker initialization notice:', (workerErr as Error).message);
    }
  }

  // Initialize Elasticsearch index & mappings
  try {
    await searchService.initIndex();
  } catch (esErr) {
    console.warn('[Backend] Search service init notice:', (esErr as Error).message);
  }
});

export default app;
export { server };

