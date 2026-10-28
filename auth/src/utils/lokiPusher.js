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

/**
 * Creates a stream that batches and pushes logs directly to Grafana Cloud Loki over HTTP.
 * Formats every payload strictly adhering to Loki's loghttp v1 schema:
 * - Labels inside `stream` are guaranteed to be string key-value pairs.
 * - `values` tuples are strictly [nanosecond_string, stringified_log_line].
 */
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
        // Exclude audit or security events from external shipping if desired
        if (item.isSecurity || item.isAudit || item.eventType) {
          continue;
        }

        const levelStr = String(item.level || 'info').toLowerCase();
        const envStr = String(env.nodeEnv || 'production');
        const key = `${envStr}:${levelStr}`;

        if (!streamsMap.has(key)) {
          streamsMap.set(key, {
            stream: {
              service: 'auth-service',
              env: envStr,
              level: levelStr,
            },
            values: [],
          });
        }

        const streamEntry = streamsMap.get(key);
        const nano = getMonotonicNano(item.time);

        const { isSecurity, isAudit, ...safeLog } = item;
        // The log line must be a JSON string
        streamEntry.values.push([nano, JSON.stringify(safeLog)]);
      }

      const streams = Array.from(streamsMap.values()).filter((s) => s.values.length > 0);
      if (streams.length === 0) {
        isSending = false;
        return;
      }

      const response = await fetch(pushUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(authHeader ? { Authorization: authHeader } : {}),
        },
        body: JSON.stringify({ streams }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.warn(`[Loki] Push returned status ${response.status}: ${errorText.slice(0, 200)}`);
      }
    } catch (err) {
      console.warn(`[Loki] Push network error: ${err.message}`);
    } finally {
      isSending = false;
      if (buffer.length >= 20) {
        void flush();
      }
    }
  }

  const stream = new Writable({
    write(chunk, _encoding, callback) {
      try {
        const logObj = JSON.parse(chunk.toString());
        if (!logObj.isSecurity && !logObj.isAudit && !logObj.eventType) {
          buffer.push(logObj);
          if (buffer.length >= 20) {
            void flush();
          }
        }
      } catch {
        // Ignore non-json chunks
      }
      callback();
    },
  });

  const flushTimer = setInterval(() => {
    void flush();
  }, 3000);

  if (flushTimer.unref) {
    flushTimer.unref();
  }

  return stream;
}
