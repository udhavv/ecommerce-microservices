import pino from 'pino';
import env from '../config/env.js';

const logLevel = process.env.LOG_LEVEL || (env.nodeEnv === 'test' ? 'silent' : env.nodeEnv === 'production' ? 'info' : 'debug');
const usePretty = env.nodeEnv !== 'production' && env.nodeEnv !== 'test' && process.env.LOG_FORMAT !== 'json';

const logger = pino({
  level: logLevel,
  base: {
    service: 'auth-service',
    env: env.nodeEnv,
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  ...(usePretty && {
    transport: {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'SYS:standard',
        ignore: 'pid,hostname',
      },
    },
  }),
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
});

export default logger;
