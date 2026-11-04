import pino from 'pino';
import pretty from 'pino-pretty';
import env from '../config/env.js';
import { createLokiStream } from './lokiPusher.js';

const isDev = env.nodeEnv === 'development';
const logLevel = env.logLevel || (env.nodeEnv === 'test' ? 'silent' : 'info');

const stdoutStream = isDev
  ? pretty({
      colorize: true,
      translateTime: 'SYS:yyyy-mm-dd HH:MM:ss',
      ignore: 'pid,hostname',
    })
  : process.stdout;

const streams = [{ stream: stdoutStream }];

if (env.loki?.url && env.nodeEnv !== 'test') {
  const lokiStream = createLokiStream();
  if (lokiStream) {
    streams.push({ stream: lokiStream });
  }
}

export const logger = pino(
  {
    level: logLevel,
    base: {
      service: 'inventory-service',
      env: env.nodeEnv,
    },
    formatters: {
      level: (label) => ({ level: label }),
    },
    timestamp: pino.stdTimeFunctions.epochTime,
  },
  streams.length === 1 ? streams[0].stream : pino.multistream(streams)
);

export default logger;
