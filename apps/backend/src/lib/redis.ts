import Redis from 'ioredis';
import { config } from '../config/env';

export function getRedisOptions() {
  let redisUrl = config.redis.url;
  const match = redisUrl.match(/(rediss?:\/\/[^\s]+)/);
  if (match) {
    redisUrl = match[1];
  }
  const isTls = redisUrl.includes('rediss://') || redisUrl.includes('upstash.io') || config.redis.url.includes('--tls');
  return {
    url: redisUrl,
    tls: isTls ? { rejectUnauthorized: false } : undefined,
  };
}

const parsedOptions = getRedisOptions();

export const redisClient = new Redis(parsedOptions.url, {
  lazyConnect: true,
  maxRetriesPerRequest: 1,
  connectTimeout: 3000,
  enableReadyCheck: false,
  tls: parsedOptions.tls,
});

redisClient.on('error', (err) => {
  // Prevent unhandled error event from crashing the process
  console.warn('[Redis Client Warning]:', err.message);
});

export async function checkRedisConnection(): Promise<{
  status: 'connected' | 'disconnected';
  latencyMs?: number;
  error?: string;
}> {
  const start = Date.now();
  try {
    if (
      redisClient.status === 'wait' ||
      redisClient.status === 'close' ||
      redisClient.status === 'end'
    ) {
      await redisClient.connect();
    }
    const pong = await redisClient.ping();
    if (pong === 'PONG') {
      return {
        status: 'connected',
        latencyMs: Date.now() - start,
      };
    }
    return {
      status: 'disconnected',
      error: `Unexpected ping response: ${pong}`,
    };
  } catch (err: any) {
    return {
      status: 'disconnected',
      error: err?.message || 'Failed to connect to Redis',
    };
  }
}
