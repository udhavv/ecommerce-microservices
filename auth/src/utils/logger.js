import pino from 'pino';
import env from '../config/env.js';
import { createLokiStream } from './lokiPusher.js';

const isProduction = env.nodeEnv === 'production';
const logLevel = process.env.LOG_LEVEL || (env.nodeEnv === 'test' ? 'silent' : isProduction ? 'info' : 'debug');

// Pretty printing is ONLY for interactive terminal development on local developer machines.
// In cloud/container environments (Render, Docker, CI) or production, always log structured JSON.
const isLocalTerminalDev =
  env.nodeEnv === 'development' &&
  !process.env.RENDER &&
  !process.env.DOCKER &&
  Boolean(process.stdout.isTTY) &&
  process.env.LOG_FORMAT !== 'json';

// Build streams (zero local disk volume storage)
const streams = [];

if (isLocalTerminalDev) {
  try {
    const pretty = (await import('pino-pretty')).default;
    streams.push({
      stream: pretty({
        colorize: true,
        translateTime: 'SYS:standard',
        ignore: 'pid,hostname',
      }),
    });
  } catch {
    streams.push({ stream: process.stdout });
  }
} else {
  streams.push({ stream: process.stdout });
}

// Add direct Grafana Cloud Loki pusher stream when configured
const lokiStream = createLokiStream();
if (lokiStream) {
  streams.push({ stream: lokiStream });
}

const logger = pino(
  {
    level: logLevel,
    base: {
      service: 'auth-service',
      env: env.nodeEnv,
    },
    // Formats level as a string ('info', 'warn', 'error') so Grafana Alloy & Loki can parse it without error
    formatters: {
      level: (label) => ({ level: label }),
    },
    timestamp: pino.stdTimeFunctions.epochTime,
    redact: {
      paths: [
        'req.headers.authorization',
        'req.body.password',
        'req.body.confirmPassword',
        'req.body.newPassword',
        'req.body.token',
        'password',
        'newPassword',
        'token',
      ],
      censor: '[REDACTED]',
    },
  },
  streams.length === 1 ? streams[0].stream : pino.multistream(streams),
);

export default logger;


