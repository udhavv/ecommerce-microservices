import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';

import env from './config/env.js';
import { pool } from './config/db.js';
import rabbitmq from './config/rabbitmq.js';
import outboxService from './services/outbox.service.js';
import { errorHandler } from './middleware/errorHandler.js';
import paymentRoutes from './routes/payment.routes.js';
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
  const rmqStatus = rabbitmq.isConnected ? 'connected' : 'disconnected';

  try {
    await pool.query('SELECT 1');
    dbStatus = 'connected';
  } catch (err) {
    dbStatus = 'disconnected';
  }

  const isHealthy = dbStatus === 'connected';

  res.status(isHealthy ? 200 : 503).json({
    status: isHealthy ? 'ok' : 'degraded',
    service: 'payment-service',
    port: env.port,
    database: dbStatus,
    rabbitmq: rmqStatus,
    timestamp: new Date().toISOString(),
  });
});

// Canonical & Versioned Routes
const apiPrefix = `/api/v${env.version.ver}`;

app.use(`${apiPrefix}/payments`, paymentRoutes);
app.use('/api/payments', paymentRoutes);

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
let stopOutboxWorker;

async function startServer() {
  try {
    // 1. Verify Database Connectivity
    const client = await pool.connect();
    client.release();
    logger.info({ database: env.database.database }, 'Connected to PostgreSQL database');

    // 2. Initialize RabbitMQ
    await rabbitmq.connect();

    // 3. Start Outbox Dispatcher Worker
    stopOutboxWorker = outboxService.startWorker(4000);
    logger.info('Transactional outbox dispatcher initialized');

    // 4. Start HTTP Server
    server = app.listen(env.port, () => {
      logger.info(
        {
          port: env.port,
          env: env.nodeEnv,
          version: env.version.ver,
        },
        `Mock payment microservice listening on port ${env.port}`
      );
    });
  } catch (err) {
    logger.error({ err: err.message }, 'Failed to start payment service');
    process.exit(1);
  }
}

// Graceful Shutdown
async function shutdown(signal) {
  logger.info({ signal }, 'Graceful shutdown initiated in payment service');

  if (stopOutboxWorker) {
    stopOutboxWorker();
  }

  if (server) {
    server.close(() => {
      logger.info('HTTP server closed');
    });
  }

  await rabbitmq.close();
  await pool.end();
  logger.info('Database connection pool drained in payment service');

  process.exit(0);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

startServer();

export default app;
