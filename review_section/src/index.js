import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';

import env from './config/env.js';
import { pool } from './config/db.js';
import { initDatabase } from '../database/init.js';
import { errorHandler } from './middleware/errorHandler.js';
import reviewRoutes from './routes/review.routes.js';
import qaRoutes from './routes/qa.routes.js';
import logger from './utils/logger.js';

const app = express();

app.set('trust proxy', 1);

// Security Headers
app.use(helmet());

// CORS Configuration
const corsOrigins = env.cors.origin
  ? env.cors.origin.split(',').map((o) => o.trim())
  : ['http://localhost:3000'];

app.use(
  cors({
    origin: corsOrigins.length === 1 ? corsOrigins[0] : corsOrigins,
    credentials: true,
  })
);

// Body & Cookie Parsing
app.use(cookieParser());
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

// HTTP Request Logging
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
      'HTTP request completed'
    );
  });

  next();
});

// Health check endpoint
app.get('/health', async (_req, res) => {
  let dbStatus = 'disconnected';

  try {
    await pool.query('SELECT 1');
    dbStatus = 'connected';
  } catch (err) {
    dbStatus = 'disconnected';
  }

  const isHealthy = dbStatus === 'connected';

  res.status(isHealthy ? 200 : 503).json({
    status: isHealthy ? 'ok' : 'degraded',
    service: 'review-section-service',
    port: env.port,
    database: dbStatus,
    timestamp: new Date().toISOString(),
  });
});

// Canonical & Versioned Routes
const apiPrefix = `/api/v${env.version.ver}`;

app.use(`${apiPrefix}/reviews`, reviewRoutes);
app.use('/api/reviews', reviewRoutes);

app.use(`${apiPrefix}/questions`, qaRoutes);
app.use('/api/questions', qaRoutes);

// 404 Handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: `Cannot ${req.method} ${req.originalUrl}`,
  });
});

// Global Error Handler
app.use(errorHandler);

// Server Lifecycle Management
let server;

async function startServer() {
  try {
    // 1. Verify Database Connectivity & Apply Schema
    await initDatabase();
    logger.info('Database connectivity and schema verified for review service');

    // 2. Start Express HTTP Server
    server = app.listen(env.port, () => {
      logger.info(
        {
          service: 'review-section-service',
          env: env.nodeEnv,
          port: env.port,
          version: env.version.ver,
        },
        `Review microservice listening on port ${env.port}`
      );
    });
  } catch (err) {
    logger.fatal({ err: err.message, stack: err.stack }, 'Fatal failure during review service startup');
    process.exit(1);
  }
}

// Graceful Shutdown
async function shutdown(signal) {
  logger.info({ signal }, 'Graceful shutdown initiated for review service');

  if (server) {
    server.close(async () => {
      logger.info('HTTP server closed');
      try {
        await pool.end();
        logger.info('PostgreSQL pool connection closed');
      } catch (err) {
        logger.error({ err: err.message }, 'Error closing PostgreSQL pool');
      }
      process.exit(0);
    });
  } else {
    process.exit(0);
  }

  // Force exit after 10 seconds
  setTimeout(() => {
    logger.error('Forcefully terminating review service after shutdown timeout');
    process.exit(1);
  }, 10000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

process.on('unhandledRejection', (reason) => {
  logger.error({ reason }, 'Unhandled Promise rejection in review service');
});

process.on('uncaughtException', (err) => {
  logger.fatal({ err: err.message, stack: err.stack }, 'Uncaught exception in review service');
  process.exit(1);
});

startServer();

export default app;
