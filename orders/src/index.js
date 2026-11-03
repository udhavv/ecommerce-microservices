import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';

import env from './config/env.js';
import { pool } from './config/db.js';
import rabbitmq from './config/rabbitmq.js';
import initConsumers from './events/consumers/index.js';
import outboxService from './services/outbox.service.js';
import { errorHandler } from './middleware/errorHandler.js';
import orderRoutes from './routes/order.routes.js';
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
    service: 'order-service',
    port: env.port,
    database: dbStatus,
    rabbitmq: rmqStatus,
    timestamp: new Date().toISOString(),
  });
});

// Canonical & Versioned Routes
const apiPrefix = `/api/v${env.version.ver}`;

app.use(`${apiPrefix}/orders`, orderRoutes);
app.use('/api/orders', orderRoutes);

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
    // 1. Verify Database Connectivity & Auto-migrate schema additions
    const client = await pool.connect();
    await client.query(`
      ALTER TABLE order_items ADD COLUMN IF NOT EXISTS seller_id UUID;
      CREATE INDEX IF NOT EXISTS idx_order_items_seller_id ON order_items (seller_id);
      ALTER TABLE order_status_history DROP CONSTRAINT IF EXISTS order_status_history_changed_by_check;
      ALTER TABLE order_status_history ADD CONSTRAINT order_status_history_changed_by_check 
        CHECK (changed_by IN ('CUSTOMER', 'ADMIN', 'SELLER', 'SYSTEM', 'PAYMENT_SERVICE', 'INVENTORY_SERVICE'));
    `);
    client.release();
    logger.info({ database: env.database.database }, 'Connected to PostgreSQL database and verified schema');

    // 2. Initialize RabbitMQ & Register Consumers
    await rabbitmq.connect();
    await initConsumers();

    // 3. Start Outbox Background Worker
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
        `Order microservice listening on port ${env.port}`
      );
    });
  } catch (err) {
    logger.error({ err: err.message }, 'Failed to start order service');
    process.exit(1);
  }
}

// Graceful Shutdown
async function shutdown(signal) {
  logger.info({ signal }, 'Graceful shutdown initiated');

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
  logger.info('Database connection pool drained');

  process.exit(0);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

startServer();

export default app;
