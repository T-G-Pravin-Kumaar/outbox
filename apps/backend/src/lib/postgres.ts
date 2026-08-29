import { Pool } from 'pg';
import { config } from '../config/env';

export const pgPool = new Pool({
  connectionString: config.db.connectionString,
  ssl: config.db.connectionString.includes('sslmode=require') || config.db.connectionString.includes('neon.tech')
    ? { rejectUnauthorized: false }
    : undefined,
  connectionTimeoutMillis: 3000,
  max: 10,
  idleTimeoutMillis: 10000,
});

pgPool.on('error', (err) => {
  // Prevent unhandled error event from crashing the process
  console.warn('[Postgres Pool Warning]:', err.message);
});

export async function checkPostgresConnection(): Promise<{
  status: 'connected' | 'disconnected';
  latencyMs?: number;
  error?: string;
}> {
  const start = Date.now();
  try {
    const client = await pgPool.connect();
    try {
      await client.query('SELECT 1');
      return {
        status: 'connected',
        latencyMs: Date.now() - start,
      };
    } finally {
      client.release();
    }
  } catch (err: any) {
    return {
      status: 'disconnected',
      error: err?.message || 'Failed to connect to PostgreSQL',
    };
  }
}
