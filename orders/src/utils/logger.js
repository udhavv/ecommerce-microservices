import pino from 'pino';
import env from '../config/env.js';

const isDev = env.nodeEnv === 'development';

const transport = isDev
  ? {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'SYS:yyyy-mm-dd HH:MM:ss',
        ignore: 'pid,hostname',
      },
    }
  : undefined;

export const logger = pino({
  level: env.logLevel,
  transport,
  base: {
    service: 'order-service',
    env: env.nodeEnv,
  },
  timestamp: pino.stdTimeFunctions.isoTime,
});

export default logger;
