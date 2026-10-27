import pino from 'pino';
import env from '../config/env.js';

const logLevel = process.env.LOG_LEVEL || (env.nodeEnv === 'test' ? 'silent' : env.nodeEnv === 'production' ? 'info' : 'debug');
const usePretty = env.nodeEnv !== 'production' && env.nodeEnv !== 'test' && process.env.LOG_FORMAT !== 'json';

// Build transports conditionally
const targets = [];

// Local pretty printing for development
if (usePretty) {
  targets.push({
    target: 'pino-pretty',
    level: logLevel,
    options: {
      colorize: true,
      translateTime: 'SYS:standard',
      ignore: 'pid,hostname',
    },
  });
}

// Direct Grafana Cloud Loki transport (for Render / cloud deployments without local Alloy agent)
if (env.loki.url && env.nodeEnv !== 'test') {
  // Normalize loki host (pino-loki expects the base host URL, e.g. https://logs-prod-xxx.grafana.net)
  const lokiHost = env.loki.url.replace(/\/loki\/api\/v1\/push\/?$/, '');

  targets.push({
    target: 'pino-loki',
    level: logLevel,
    options: {
      batching: true,
      interval: 5,
      host: lokiHost,
      basicAuth: env.loki.user && env.loki.token ? {
        username: env.loki.user,
        password: env.loki.token,
      } : undefined,
      labels: {
        service: 'auth-service',
        env: env.nodeEnv,
      },
    },
  });
}

const transport = targets.length > 0
  ? (targets.length === 1 ? pino.transport(targets[0]) : pino.transport({ targets }))
  : undefined;

const logger = pino(
  {
    level: logLevel,
    base: {
      service: 'auth-service',
      env: env.nodeEnv,
    },
    timestamp: pino.stdTimeFunctions.isoTime,
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
  transport,
);

export default logger;
