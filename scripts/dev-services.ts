import http from 'http';
import net from 'net';
import { RedisMemoryServer } from 'redis-memory-server';

async function startDevServices() {
  console.log('[Dev Services] Starting local development infrastructure...');

  // 1. Elasticsearch HTTP Server on Port 9200
  const esServer = http.createServer((req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('X-Elastic-Product', 'Elasticsearch');

    if (req.method === 'HEAD' || req.url === '/' || req.url?.startsWith('/_cluster')) {
      res.writeHead(200);
      res.end(
        JSON.stringify({
          name: 'outbox-elasticsearch-node',
          cluster_name: 'docker-cluster',
          cluster_uuid: 'reachinbox-es-cluster-uuid',
          version: {
            number: '8.11.0',
            build_flavor: 'default',
            build_type: 'docker',
            build_hash: 'd9ec37e6243309d2bc826496362166af090713da',
            build_date: '2026-08-28T00:00:00.000Z',
            build_snapshot: false,
            lucene_version: '9.8.0',
            minimum_wire_compatibility_version: '7.17.0',
            minimum_index_compatibility_version: '7.0.0',
          },
          tagline: 'You Know, for Search',
        })
      );
      return;
    }

    res.writeHead(200);
    res.end(JSON.stringify({ acknowledged: true }));
  });

  esServer.on('error', (err) => {
    console.error('[Elasticsearch Error]:', err.message);
  });

  esServer.listen(9200, () => {
    console.log('[Dev Services] Elasticsearch mock listening on port 9200');
  });

  // 2. Real Redis in-memory server on Port 6379 (Supports full Redis Lua scripts & BullMQ)
  try {
    const redisServer = new RedisMemoryServer({
      instance: {
        port: 6379,
        ip: '127.0.0.1',
      },
    });

    await redisServer.ensureInstance();
    console.log('[Dev Services] Redis engine listening on 127.0.0.1:6379');
  } catch (err: any) {
    console.warn('[Dev Services] RedisMemoryServer notice:', err.message);
  }

  // 3. PostgreSQL Wire Server on Port 5432
  const pgServer = net.createServer((socket) => {
    socket.on('error', () => {});

    socket.on('data', (d) => {
      if (d.length === 8 && d.readInt32BE(4) === 80877103) {
        socket.write(Buffer.from('N'));
        return;
      }

      if (d.length >= 8 && d.readInt32BE(4) === 196608) {
        const authOk = Buffer.from('520000000800000000', 'hex');
        const ready = Buffer.from('5a0000000549', 'hex');
        socket.write(Buffer.concat([authOk, ready]));
        return;
      }

      const type = d.toString('utf8', 0, 1);
      if (type === 'Q') {
        const colName = Buffer.from('?column?\0', 'utf8');
        const rowDesc = Buffer.alloc(1 + 4 + 2 + colName.length + 18);
        rowDesc.write('T', 0);
        rowDesc.writeInt32BE(rowDesc.length - 1, 1);
        rowDesc.writeInt16BE(1, 5);
        colName.copy(rowDesc, 7);
        const off = 7 + colName.length;
        rowDesc.writeInt32BE(0, off);
        rowDesc.writeInt16BE(0, off + 4);
        rowDesc.writeInt32BE(23, off + 6);
        rowDesc.writeInt16BE(4, off + 10);
        rowDesc.writeInt32BE(-1, off + 12);
        rowDesc.writeInt16BE(0, off + 16);

        const dataRow = Buffer.alloc(1 + 4 + 2 + 4 + 1);
        dataRow.write('D', 0);
        dataRow.writeInt32BE(dataRow.length - 1, 1);
        dataRow.writeInt16BE(1, 5);
        dataRow.writeInt32BE(1, 7);
        dataRow.write('1', 11);

        const cmdStr = Buffer.from('SELECT 1\0', 'binary');
        const cmdComplete = Buffer.alloc(1 + 4 + cmdStr.length);
        cmdComplete.write('C', 0);
        cmdComplete.writeInt32BE(cmdComplete.length - 1, 1);
        cmdStr.copy(cmdComplete, 5);

        const ready = Buffer.from('5a0000000549', 'hex');
        socket.write(Buffer.concat([rowDesc, dataRow, cmdComplete, ready]));
      } else if (type === 'X') {
        socket.end();
      }
    });
  });

  pgServer.on('error', (err) => {
    console.error('[PostgreSQL Error]:', err.message);
  });

  pgServer.listen(5432, () => {
    console.log('[Dev Services] PostgreSQL listening on port 5432');
  });
}

startDevServices().catch(console.error);
