import pino from 'pino';
import env from '../config/env.js';

const isProduction = env.nodeEnv === 'production';
const logLevel = process.env.LOG_LEVEL || (env.nodeEnv === 'test' ? 'silent' : isProduction ? 'info' : 'debug');

// Pretty printing is ONLY for interactive terminal development on local developer machines.
// In cloud/container environments (Render, Docker, CI) or production, always log raw structured JSON to stdout.
const isLocalTerminalDev =
  env.nodeEnv === 'development' &&
  !process.env.RENDER &&
  !process.env.DOCKER &&
  Boolean(process.stdout.isTTY) &&
  process.env.LOG_FORMAT !== 'json';

// Build transports conditionally
const targets = [];

if (isLocalTerminalDev) {
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

// Direct Grafana Cloud Loki transport (for Render / cloud deployments)
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
      replaceTimestamp: true,
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

let transport;
if (targets.length > 0) {
  try {
    transport = targets.length === 1 ? pino.transport(targets[0]) : pino.transport({ targets });
  } catch (err) {
    // If transport fails to load (e.g. worker thread or target resolution issue), fallback safely to stdout
    console.error('Failed to initialize pino transport, falling back to standard stdout:', err.message);
    transport = undefined;
  }
}

const logger = pino(
  {
    level: logLevel,
    base: {
      service: 'auth-service',
      env: env.nodeEnv,
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
  transport,
);

export default logger;

