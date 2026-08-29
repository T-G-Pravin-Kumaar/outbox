import { Router, Request, Response } from 'express';
import { searchService } from '../services/search';
import { dbService } from '../lib/db';

export const searchRouter = Router();

/**
 * GET /api/emails/search
 * Query subject, body, sender_email, and recipient_email.
 * Query parameters:
 *  - q: The search query string (required)
 *  - status: Optional status filter (e.g. SENT, SCHEDULED)
 */
searchRouter.get('/emails/search', async (req: Request, res: Response) => {
  try {
    const q = req.query.q as string;
    const status = req.query.status as string;

    if (!q || q.trim() === '') {
      return res.status(400).json({
        error: 'Validation failed',
        message: 'Search query parameter "q" is required and cannot be empty.',
      });
    }

    let emailIds: string[] = [];
    let isEsFallback = false;

    try {
      // 1. Query Elasticsearch for matching document IDs
      emailIds = await searchService.searchEmails(q, status);
    } catch (err: any) {
      console.warn(`[SearchRouter] ⚠️ Elasticsearch query failed, falling back to Postgres/Redis:`, err.message);
      isEsFallback = true;
    }

    let results: any[] = [];

    if (isEsFallback) {
      // 2. Fallback Path: Query dbService which handles Postgres timeout and Redis fallback automatically
      results = await dbService.listEmails({
        search: q,
        status: status,
      });
    } else {
      // 3. Happy Path: Fetch the full details from dbService for matching ES IDs
      if (emailIds.length > 0) {
        const records = await Promise.all(
          emailIds.map((id) => dbService.findEmailById(id))
        );
        results = records.filter((r): r is NonNullable<typeof r> => r !== null);
      }
    }

    return res.json({
      data: results,
      count: results.length,
      fallback: isEsFallback,
    });
  } catch (err: any) {
    console.error('[Search API Error]:', err);
    return res.status(500).json({
      error: 'Failed to search emails',
      message: err.message || 'Internal server error',
    });
  }
});
