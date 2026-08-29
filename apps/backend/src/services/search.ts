import { esClient } from '../lib/elasticsearch';
import { prisma } from '../lib/prisma';
import { config } from '../config/env';

const INDEX_NAME = config.elasticsearch.index || 'emails';

export const searchService = {
  /**
   * Initialize the Elasticsearch index and mapping if it doesn't exist.
   */
  async initIndex() {
    try {
      const exists = await esClient.indices.exists({ index: INDEX_NAME });
      if (!exists) {
        console.log(`[SearchService] Index "${INDEX_NAME}" does not exist. Creating...`);
        await esClient.indices.create({
          index: INDEX_NAME,
          body: {
            mappings: {
              properties: {
                recipient_email: { type: 'text', fields: { keyword: { type: 'keyword' } } },
                sender_email: { type: 'text', fields: { keyword: { type: 'keyword' } } },
                subject: { type: 'text' },
                body: { type: 'text' },
                status: { type: 'keyword' },
                scheduled_at: { type: 'date' },
                sent_at: { type: 'date' },
              },
            },
          },
        });
        console.log(`[SearchService] Index "${INDEX_NAME}" created successfully.`);
      } else {
        console.log(`[SearchService] Index "${INDEX_NAME}" already exists.`);
      }
    } catch (err: any) {
      console.warn(`[SearchService] Failed to initialize Elasticsearch index:`, err.message);
    }
  },

  /**
   * Upload or update an email document in Elasticsearch.
   * Wraps ES calls in a try-catch to keep indexing non-blocking.
   */
  async indexEmailDoc(email: any) {
    try {
      // Resolve sender_email if not populated
      let senderEmail = email.sender?.email || '';
      if (!senderEmail && email.senderId) {
        const sender = await prisma.sender.findUnique({ where: { id: email.senderId } });
        senderEmail = sender?.email || '';
      }

      const doc = {
        recipient_email: email.recipientEmail,
        sender_email: senderEmail,
        subject: email.subject,
        body: email.body,
        status: email.status,
        scheduled_at: email.scheduledAt instanceof Date ? email.scheduledAt.toISOString() : email.scheduledAt,
        sent_at: email.sentAt ? (email.sentAt instanceof Date ? email.sentAt.toISOString() : email.sentAt) : null,
      };

      console.log(`[SearchService] Indexing email ${email.id} into "${INDEX_NAME}"`);
      await esClient.index({
        index: INDEX_NAME,
        id: email.id,
        document: doc, // Use document instead of body in v8
        refresh: true, // Forces immediate index refresh
      });
      console.log(`[SearchService] Successfully indexed email ${email.id}`);
    } catch (err: any) {
      // Graceful error handling: log and continue, do not block the email pipeline
      console.warn(`[SearchService] ⚠️ Elasticsearch indexing failed for email ${email.id}:`, err.message);
    }
  },

  /**
   * Full-text search subject, body, and emails.
   * Returns list of matching email IDs.
   */
  async searchEmails(q: string, status?: string): Promise<string[]> {
    try {
      const must: any[] = [
        {
          multi_match: {
            query: q,
            fields: ['subject', 'body', 'recipient_email', 'sender_email'],
            fuzziness: 'AUTO',
          },
        },
      ];

      if (status) {
        must.push({
          term: { status: status.toUpperCase() },
        });
      }

      const response = await esClient.search({
        index: INDEX_NAME,
        query: {
          bool: {
            must,
          },
        },
      });

      if (!response.hits) {
        throw new Error('Elasticsearch response did not contain hits structure');
      }

      const hits = response.hits.hits || [];
      return hits.map((h: any) => h._id);
    } catch (err: any) {
      console.error(`[SearchService] Elasticsearch search failed:`, err.message);
      throw err; // Propagate error to trigger DB fallback
    }
  },
};
