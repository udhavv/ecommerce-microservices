import { Writable } from 'stream';
import env from '../config/env.js';

let lastTimestampNano = BigInt(Date.now()) * 1000000n;

function getMonotonicNano(logTime) {
  let nano = logTime ? BigInt(logTime) * 1000000n : BigInt(Date.now()) * 1000000n;
  if (nano <= lastTimestampNano) {
    nano = lastTimestampNano + 1000n;
  }
  lastTimestampNano = nano;
  return nano.toString();
}

export function createLokiStream() {
  if (!env.loki.url || env.nodeEnv === 'test') {
    return null;
  }

  const rawHost = env.loki.url.replace(/\/loki\/api\/v1\/push\/?$/, '');
  const pushUrl = `${rawHost}/loki/api/v1/push`;
  const authHeader =
    env.loki.user && env.loki.token
      ? `Basic ${Buffer.from(`${env.loki.user}:${env.loki.token}`).toString('base64')}`
      : undefined;

  let buffer = [];
  let isSending = false;

  async function flush() {
    if (buffer.length === 0 || isSending) return;
    const batch = buffer;
    buffer = [];
    isSending = true;

    try {
      const streamsMap = new Map();

      for (const item of batch) {
        const levelStr = String(item.level || 'info').toLowerCase();
        const envStr = String(env.nodeEnv || 'production');
        const key = `${envStr}:${levelStr}`;

        if (!streamsMap.has(key)) {
          streamsMap.set(key, {
            stream: {
              app: 'ecommerce-inventory',
              service: 'inventory-service',
              env: envStr,
              level: levelStr,
            },
            values: [],
          });
        }

        const nanoStr = getMonotonicNano(item.time);
        streamsMap.get(key).values.push([nanoStr, JSON.stringify(item)]);
      }

      const payload = {
        streams: Array.from(streamsMap.values()),
      };

      const headers = { 'Content-Type': 'application/json' };
      if (authHeader) headers.Authorization = authHeader;

      const res = await fetch(pushUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const text = await res.text();
        process.stderr.write(`[Loki inventory error ${res.status}]: ${text}\n`);
      }
    } catch {
      // Avoid recursive logging or crashing on log push failure
    } finally {
      isSending = false;
      if (buffer.length > 0) {
        setImmediate(flush);
      }
    }
  }

  const interval = setInterval(flush, 1500);
  interval.unref();

  return new Writable({
    objectMode: true,
    write(chunk, _encoding, callback) {
      try {
        const parsed = typeof chunk === 'string' ? JSON.parse(chunk) : chunk;
        buffer.push(parsed);
        if (buffer.length >= 25) {
          setImmediate(flush);
        }
      } catch {
        // Fallback silently
      }
      callback();
    },
  });
}
