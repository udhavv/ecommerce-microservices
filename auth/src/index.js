import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';

import env from './config/env.js';
import { pool } from './config/db.js';
import { errorHandler } from './middleware/errorHandler.js';
import authRoutes from './routes/auth.routes.js';
import logger from './utils/logger.js';

const app = express();

// Trust reverse proxies (e.g. Kong, Nginx, cloud load balancers)
app.set('trust proxy', 1);

// Security headers
app.use(helmet());

// CORS configuration (supports comma-separated origins)
const corsOrigins = env.cors.origin
  ? env.cors.origin.split(',').map((o) => o.trim())
  : ['http://localhost:3000'];



app.use(
  cors({
    origin: corsOrigins.length === 1 ? corsOrigins[0] : corsOrigins,
    credentials: true,
  }),
);

// Request parsing
app.use(cookieParser());
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

// HTTP request logging
app.use((req, res, next) => {
  const start = Date.now();

  res.on('finish', () => {
    logger.info(
      {
        method: req.method,
        url: req.originalUrl,
        status: res.statusCode,
        duration: `${Date.now() - start}ms`,
        ip: req.ip,
        userAgent: req.headers['user-agent'] || 'unknown',
      },
      'HTTP request completed',
    );
  });

  next();
});

// Health check endpoint for Docker, Kubernetes, and load balancers
app.get('/health', async (_req, res) => {
  try {
    await pool.query('SELECT 1');
    logger.info({ service: 'auth-microservice', database: 'connected' }, 'Health check passed');
    res.status(200).json({
      status: 'ok',
      service: 'auth-microservice',
      database: 'connected',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error({ service: 'auth-microservice', database: 'disconnected', err: error.message }, 'Health check failed');
    res.status(503).json({
      status: 'degraded',
      service: 'auth-microservice',
      database: 'disconnected',
      error: error.message,
      timestamp: new Date().toISOString(),
    });
  }
});

// Authentication routes (both versioned and canonical)
app.use(`/api/${env.version.ver}/auth`, authRoutes);
app.use('/api/auth', authRoutes);

// 404 handler
app.use((req, res) => {
  logger.warn({ path: req.path, method: req.method, ip: req.ip }, 'Route not found');
  res.status(404).json({ error: 'Route not found' });
});

// Global error handler — keep this last
app.use(errorHandler);

// HTTP server reference
let server;
let isShuttingDown = false;

// Graceful shutdown
async function shutdown(signal) {
  if (isShuttingDown) return;
  isShuttingDown = true;

  logger.info({ signal }, 'Shutdown signal received');

  if (server) {
    await new Promise((resolve) => {
      server.close((error) => {
        if (error) {
          logger.error({ err: error }, 'Error closing HTTP server');
        }
        resolve();
      });
    });
  }

  try {
    await pool.end();
    logger.info('PostgreSQL connection pool closed');
  } catch (error) {
    logger.error({ err: error }, 'Failed to close PostgreSQL pool');
    process.exitCode = 1;
  }

  logger.info('Auth microservice shutdown complete');
}

// Start server
async function start() {
  try {
    await pool.query('SELECT 1');

    logger.info('Connected to PostgreSQL database');

    server = app.listen(env.port, () => {
      logger.info(
        { port: env.port, environment: env.nodeEnv },
        'Auth microservice started',
      );
    });

    server.on('error', (error) => {
      logger.fatal({ err: error }, 'HTTP server failed');
      process.exitCode = 1;
    });
  } catch (error) {
    logger.fatal({ err: error }, 'Failed to start auth microservice');

    try {
      await pool.end();
    } catch (closeError) {
      logger.error({ err: closeError }, 'Failed to close PostgreSQL pool');
    }

    process.exitCode = 1;
  }
}

// Global process error handlers
process.on('unhandledRejection', (reason) => {
  logger.error({ err: reason }, 'Unhandled Promise Rejection');
});

process.on('uncaughtException', (error) => {
  logger.fatal({ err: error }, 'Uncaught Exception');
  process.exit(1);
});

process.once('SIGTERM', () => {
  void shutdown('SIGTERM');
});

process.once('SIGINT', () => {
  void shutdown('SIGINT');
});

if (process.env.NODE_ENV !== 'test') {
  void start();
}

export { app, start, shutdown };
export default app;
