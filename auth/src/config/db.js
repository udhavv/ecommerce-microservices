import pg from 'pg';
import env from './env.js';
import logger from '../utils/logger.js';

const { Pool } = pg;

export const pool = new Pool({
  connectionString: env.database.url,
  max: Number(process.env.DB_POOL_MAX || 10),
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
  ...(env.nodeEnv === 'production' && {
    ssl:
      process.env.DB_SSL === 'true'
        ? { rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false' }
        : undefined,
  }),
});

pool.on('error', (error) => {
  logger.error({ err: error }, 'Unexpected idle PostgreSQL client error');
});
