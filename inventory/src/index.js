import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';

import env from './config/env.js';
import { pool } from './config/db.js';
import rabbitmq from './config/rabbitmq.js';
import initConsumers from './events/consumers/index.js';
import { errorHandler } from './middleware/errorHandler.js';
import inventoryRoutes from './routes/inventory.routes.js';
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
app.use(express.json({ limit: '5mb' }));
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
  let rmqStatus = rabbitmq.isConnected ? 'connected' : 'disconnected';

  try {
    await pool.query('SELECT 1');
    dbStatus = 'connected';
  } catch (err) {
    dbStatus = 'disconnected';
  }

  const isHealthy = dbStatus === 'connected';

  res.status(isHealthy ? 200 : 503).json({
    status: isHealthy ? 'ok' : 'degraded',
    service: 'inventory-service',
    port: env.port,
    database: dbStatus,
    rabbitmq: rmqStatus,
    timestamp: new Date().toISOString(),
  });
});

// Canonical & Versioned Routes
const apiPrefix = `/api/v${env.version.ver}`;

app.use(`${apiPrefix}/inventory`, inventoryRoutes);
app.use('/api/inventory', inventoryRoutes);

// 404 Handler
app.use((req, res) => {
  logger.warn({ path: req.path, method: req.method }, 'Route not found');
  res.status(404).json({ success: false, error: 'Route not found' });
});

// Global Error Handler
app.use(errorHandler);

let server;

export async function startServer() {
  // 1. Start HTTP Server
  server = app.listen(env.port, () => {
    logger.info(
      {
        port: env.port,
        env: env.nodeEnv,
        service: 'inventory-service',
      },
      `Inventory microservice listening on port ${env.port}`
    );
  });

  // 2. Connect to RabbitMQ asynchronously without blocking HTTP server
  try {
    await rabbitmq.connect();
    await initConsumers();
  } catch (err) {
    logger.error({ err: err.message }, 'Initial RabbitMQ connection failed; will retry in background');
  }

  return server;
}

// Graceful Shutdown Handler
const shutdown = async (signal) => {
  logger.info({ signal }, 'Graceful shutdown initiated');

  if (server) {
    server.close(() => {
      logger.info('HTTP server closed');
    });
  }

  try {
    await rabbitmq.close();
  } catch (err) {
    logger.error({ err: err.message }, 'Error closing RabbitMQ connection');
  }

  try {
    await pool.end();
    logger.info('Database connection pool drained');
    process.exit(0);
  } catch (err) {
    logger.error({ err: err.message }, 'Error closing database pool during shutdown');
    process.exit(1);
  }
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// Start server when run directly
startServer();

export default app;
