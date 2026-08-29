import { Router, Request, Response } from 'express';
import { dbService } from '../lib/db';
import { addEmailSendJob } from '../queues/emailQueue';

export const emailRouter = Router();

// ============================================================================
// 1. POST /api/emails/schedule - Schedule an email via BullMQ delayed jobs
// ============================================================================
emailRouter.post('/emails/schedule', async (req: Request, res: Response) => {
  try {
    const {
      sender_id,
      senderId,
      recipient_email,
      recipientEmail,
      subject,
      body,
      scheduled_at,
      scheduledAt,
      idempotency_key,
      idempotencyKey,
      metadata,
    } = req.body;

    const targetRecipient = recipient_email || recipientEmail;
    const targetSubject = subject;
    const targetBody = body;
    const targetScheduledAtStr = scheduled_at || scheduledAt;
    const clientSenderId = sender_id || senderId;

    // Validation
    if (!targetRecipient || !targetSubject || !targetBody || !targetScheduledAtStr) {
      return res.status(400).json({
        error: 'Validation failed',
        message: 'Missing required fields: recipient_email, subject, body, and scheduled_at are required.',
      });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(targetRecipient.trim())) {
      return res.status(400).json({
        error: 'Validation failed',
        message: `Invalid recipient email address format: "${targetRecipient}".`,
      });
    }

    const scheduledDate = new Date(targetScheduledAtStr);
    if (isNaN(scheduledDate.getTime())) {
      return res.status(400).json({
        error: 'Invalid date format',
        message: 'scheduled_at must be a valid ISO-8601 date string or timestamp.',
      });
    }

    // Resolve sender
    let resolvedSenderId = clientSenderId;
    if (!resolvedSenderId) {
      const defaultSender = await dbService.findDefaultSender();
      if (!defaultSender) {
        return res.status(400).json({
          error: 'No sender configured',
          message: 'Please provide a valid sender_id or configure a default sender.',
        });
      }
      resolvedSenderId = defaultSender.id;
    }

    // Generate unique idempotency key if not explicitly supplied
    const finalIdempotencyKey =
      idempotency_key ||
      idempotencyKey ||
      `idemp_${resolvedSenderId}_${targetRecipient}_${scheduledDate.getTime()}_${Math.random().toString(36).substring(2, 7)}`;

    // Check for duplicate idempotent request
    const existing = await dbService.findEmailByIdempotencyKey(finalIdempotencyKey);
    if (existing) {
      return res.status(200).json({
        message: 'Email already scheduled (idempotent request detected)',
        email: existing,
        duplicate: true,
      });
    }

    // Calculate delay in milliseconds
    const now = Date.now();
    const delayMs = Math.max(0, scheduledDate.getTime() - now);

    // 1. Create DB record with status=SCHEDULED
    const emailRecord = await dbService.createEmail({
      senderId: resolvedSenderId,
      recipientEmail: targetRecipient,
      subject: targetSubject,
      body: targetBody,
      scheduledAt: scheduledDate,
      idempotencyKey: finalIdempotencyKey,
      metadata,
    });

    // 2. Schedule BullMQ delayed job (No cron used)
    const job = await addEmailSendJob(
      {
        emailId: emailRecord.id,
        senderId: resolvedSenderId,
        recipientEmail: targetRecipient,
        subject: targetSubject,
        body: targetBody,
        scheduledAt: scheduledDate.toISOString(),
        idempotencyKey: finalIdempotencyKey,
        metadata,
      },
      delayMs
    );

    // 3. Store BullMQ job ID back on the DB row
    await dbService.updateEmailStatus(emailRecord.id, {
      status: emailRecord.status,
      bullmqJobId: String(job.id),
    });

    return res.status(201).json({
      message: 'Email scheduled successfully',
      email: {
        ...emailRecord,
        bullmqJobId: String(job.id),
      },
      scheduling: {
        scheduledAt: scheduledDate.toISOString(),
        delaySeconds: Math.round(delayMs / 1000),
        delayMs,
        bullmqJobId: String(job.id),
      },
    });
  } catch (err: any) {
    console.error('[Schedule API Error]:', err);
    return res.status(500).json({
      error: 'Failed to schedule email',
      message: err.message || 'Internal server error',
    });
  }
});

// ============================================================================
// 2. GET /api/emails - List scheduled, sent, or failed emails from DB
// ============================================================================
emailRouter.get('/emails', async (req: Request, res: Response) => {
  try {
    const { status, sender_id, senderId, search, limit, offset } = req.query;

    const emails = await dbService.listEmails({
      status: status ? String(status) : undefined,
      senderId: (sender_id || senderId) ? String(sender_id || senderId) : undefined,
      search: search ? String(search) : undefined,
      limit: limit ? parseInt(String(limit), 10) : 100,
      offset: offset ? parseInt(String(offset), 10) : 0,
    });

    return res.json({
      data: emails,
      count: emails.length,
    });
  } catch (err: any) {
    console.error('[List Emails API Error]:', err);
    return res.status(500).json({
      error: 'Failed to fetch emails',
      message: err.message || 'Internal server error',
    });
  }
});

// ============================================================================
// 3. GET /api/emails/:id - Get specific email details
// ============================================================================
emailRouter.get('/emails/:id', async (req: Request, res: Response) => {
  try {
    const email = await dbService.findEmailById(req.params.id);
    if (!email) {
      return res.status(404).json({
        error: 'Not found',
        message: `Email with ID ${req.params.id} was not found.`,
      });
    }
    return res.json({ data: email });
  } catch (err: any) {
    return res.status(500).json({
      error: 'Failed to fetch email',
      message: err.message,
    });
  }
});

// ============================================================================
// 4. GET /api/senders - List all available sender mailboxes
// ============================================================================
emailRouter.get('/senders', async (_req: Request, res: Response) => {
  try {
    const senders = await dbService.listSenders();
    return res.json({
      data: senders,
      count: senders.length,
    });
  } catch (err: any) {
    return res.status(500).json({
      error: 'Failed to fetch senders',
      message: err.message,
    });
  }
});
