import { Router, Request, Response, NextFunction } from 'express';
import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter } from '@bull-board/express';
import { emailQueue } from '../queues/emailQueue';

// 1. Setup Custom Basic Auth Middleware (no extra NPM dependencies needed)
export function adminBasicAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader) {
    res.setHeader('WWW-Authenticate', 'Basic realm="ReachInbox Outbox Admin Dashboard"');
    return res.status(401).send('Authentication required to access BullMQ Dashboard.');
  }

  // Parse Header: "Basic <base64>"
  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0].toLowerCase() !== 'basic') {
    res.setHeader('WWW-Authenticate', 'Basic realm="ReachInbox Outbox Admin Dashboard"');
    return res.status(401).send('Invalid authorization header format.');
  }

  const credentials = Buffer.from(parts[1], 'base64').toString('ascii').split(':');
  if (credentials.length !== 2) {
    res.setHeader('WWW-Authenticate', 'Basic realm="ReachInbox Outbox Admin Dashboard"');
    return res.status(401).send('Invalid credentials format.');
  }

  const username = credentials[0];
  const password = credentials[1];

  const expectedUsername = 'admin';
  // Use env variable if provided, fallback to standard "admin" in local dev
  const expectedPassword = process.env.ADMIN_PASSWORD || 'admin';

  if (username === expectedUsername && password === expectedPassword) {
    return next();
  }

  res.setHeader('WWW-Authenticate', 'Basic realm="ReachInbox Outbox Admin Dashboard"');
  return res.status(401).send('Unauthorized: Invalid credentials.');
}

// 2. Setup Bull Board Express Adapter
const serverAdapter = new ExpressAdapter();
serverAdapter.setBasePath('/admin/queues');

// 3. Create the Dashboard and Register the Queue
createBullBoard({
  queues: [new BullMQAdapter(emailQueue as any)],
  serverAdapter: serverAdapter,
});

// Export the router mounted with Basic Auth
export const adminRouter = Router();

// Hook the adapter router into our adminRouter, protected by the Basic Auth middleware
adminRouter.use('/admin/queues', adminBasicAuth, serverAdapter.getRouter());
