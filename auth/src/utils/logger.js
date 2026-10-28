import pino from 'pino';
import env from '../config/env.js';
import { createLokiStream } from './lokiPusher.js';

const isProduction = env.nodeEnv === 'production';

const logLevel =
  process.env.LOG_LEVEL ||
  (env.nodeEnv === 'test' ? 'silent' : isProduction ? 'info' : 'debug');

const streams = [{ stream: process.stdout }];

// Direct Loki stream for cloud environments like Render
if (env.loki.url && env.nodeEnv !== 'test') {
  const lokiStream = createLokiStream();
  if (lokiStream) {
    streams.push({ stream: lokiStream });
  }
}

const logger = pino(
  {
    level: logLevel,
    base: {
      service: 'auth-service',
      env: env.nodeEnv,
    },
    // Standard string labels for levels so parser compatibility is preserved
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
