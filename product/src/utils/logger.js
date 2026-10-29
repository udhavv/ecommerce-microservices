import pino from 'pino';
import env from '../config/env.js';
import { createLokiStream } from './lokiPusher.js';

const logLevel = env.logLevel || (env.nodeEnv === 'test' ? 'silent' : 'info');

const streams = [{ stream: process.stdout }];

if (env.loki.url && env.nodeEnv !== 'test') {
  const lokiStream = createLokiStream();
  if (lokiStream) {
    streams.push({ stream: lokiStream });
  }
}

export const logger = pino(
  {
    level: logLevel,
    base: {
      service: 'product-service',
      env: env.nodeEnv,
    },
    formatters: {
      level: (label) => ({ level: label }),
    },
    timestamp: pino.stdTimeFunctions.epochTime,
  },
  streams.length === 1 ? streams[0].stream : pino.multistream(streams),
);

export default logger;
