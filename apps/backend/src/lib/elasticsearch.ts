import { Client } from '@elastic/elasticsearch';
import { config } from '../config/env';

export const esClient = new Client({
  node: config.elasticsearch.url,
  requestTimeout: 3000,
  maxRetries: 1,
});

export async function checkElasticsearchConnection(): Promise<{ status: 'connected' | 'disconnected'; latencyMs?: number; error?: string }> {
  const start = Date.now();
  try {
    const isAlive = await esClient.ping();
    if (isAlive) {
      return {
        status: 'connected',
        latencyMs: Date.now() - start,
      };
    }
    return {
      status: 'disconnected',
      error: 'Elasticsearch ping returned false',
    };
  } catch (err: any) {
    return {
      status: 'disconnected',
      error: err?.message || 'Failed to connect to Elasticsearch',
    };
  }
}
