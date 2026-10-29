import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';

import env from './config/env.js';
import { pool } from './config/db.js';
import { errorHandler } from './middleware/errorHandler.js';
import productRoutes from './routes/product.routes.js';
import categoryRoutes from './routes/category.routes.js';
import variantRoutes from './routes/variant.routes.js';
import imageRoutes from './routes/image.routes.js';
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
  }),
);

// Body & Cookie Parsing
app.use(cookieParser());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

// HTTP Request Logging Middleware
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

// Health check endpoint
app.get('/health', async (_req, res) => {
  try {
    await pool.query('SELECT 1');
    res.status(200).json({
      status: 'ok',
      service: 'product-service',
      database: 'connected',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error({ err: error.message }, 'Health check failed');
    res.status(503).json({
      status: 'degraded',
      service: 'product-service',
      database: 'disconnected',
      error: error.message,
      timestamp: new Date().toISOString(),
    });
  }
});

// Canonical & Versioned Routes
const apiPrefix = `/api/v${env.version.ver}`;

app.use(`${apiPrefix}/products`, productRoutes);
app.use('/api/products', productRoutes);

app.use(`${apiPrefix}/categories`, categoryRoutes);
app.use('/api/categories', categoryRoutes);

app.use(`${apiPrefix}/variants`, variantRoutes);
app.use('/api/variants', variantRoutes);

app.use(`${apiPrefix}/images`, imageRoutes);
app.use('/api/images', imageRoutes);

// 404 Handler
app.use((req, res) => {
  logger.warn({ path: req.path, method: req.method }, 'Route not found');
  res.status(404).json({ success: false, error: 'Route not found' });
});

// Global Error Handler
app.use(errorHandler);

let server;

export function startServer() {
  server = app.listen(env.port, () => {
    logger.info(
      {
        port: env.port,
        env: env.nodeEnv,
        service: 'product-service',
      },
      `Product microservice listening on port ${env.port}`,
    );
  });

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
