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
 * Creates a stream that batches and pushes non-security logs to Grafana Cloud Loki.
 * Sensitive / security audit events are filtered out so they are never sent outside.
 * Zero logs are stored in local volumes.
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
  let flushTimer = null;
  let isSending = false;

  async function flush() {
    if (buffer.length === 0 || isSending) return;
    const batch = buffer;
    buffer = [];
    isSending = true;

    try {
      // Group non-security logs by unique label set
      const streamsMap = new Map();

      for (const item of batch) {
        // Exclude any security audit events or sensitive logs from Loki
        if (item.isSecurity || item.isAudit || item.eventType) {
          continue;
        }

        const levelStr = String(item.level || 'info').toLowerCase();
        const key = `${env.nodeEnv}:${levelStr}`;

        if (!streamsMap.has(key)) {
          streamsMap.set(key, {
            stream: {
              service: 'auth-service',
              env: String(env.nodeEnv),
              level: levelStr,
            },
            values: [],
          });
        }

        const streamEntry = streamsMap.get(key);
        const nano = getMonotonicNano(item.time);

        const { isSecurity, isAudit, ...safeLog } = item;
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
        console.warn(`[Loki] Push returned status ${response.status}: ${errorText.slice(0, 150)}`);
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
        // Do not store in local; filter out security logs before shipping to Loki
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

  flushTimer = setInterval(() => {
    void flush();
  }, 3000);

  if (flushTimer.unref) {
    flushTimer.unref();
  }

  return stream;
}
