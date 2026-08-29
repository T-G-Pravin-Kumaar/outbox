import { Router, Request, Response } from 'express';
import { checkPostgresConnection } from '../lib/postgres';
import { checkRedisConnection } from '../lib/redis';
import { checkElasticsearchConnection } from '../lib/elasticsearch';

export const healthRouter = Router();

healthRouter.get('/health', async (_req: Request, res: Response) => {
  const [postgres, redis, elasticsearch] = await Promise.all([
    checkPostgresConnection(),
    checkRedisConnection(),
    checkElasticsearchConnection(),
  ]);

  const allConnected =
    postgres.status === 'connected' &&
    redis.status === 'connected' &&
    elasticsearch.status === 'connected';

  const anyConnected =
    postgres.status === 'connected' ||
    redis.status === 'connected' ||
    elasticsearch.status === 'connected';

  const overallStatus = allConnected
    ? 'ok'
    : anyConnected
    ? 'degraded'
    : 'error';

  return res.status(allConnected ? 200 : 200).json({
    status: overallStatus,
    timestamp: new Date().toISOString(),
    services: {
      postgres: postgres.status,
      redis: redis.status,
      elasticsearch: elasticsearch.status,
    },
    details: {
      postgres,
      redis,
      elasticsearch,
    },
  });
});
