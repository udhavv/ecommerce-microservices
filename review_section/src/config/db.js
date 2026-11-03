import pg from 'pg';
import env from './env.js';
import logger from '../utils/logger.js';

const { Pool } = pg;

export const pool = new Pool(
  env.database.url
    ? { connectionString: env.database.url }
    : {
        host: env.database.host,
        port: env.database.port,
        user: env.database.user,
        password: env.database.password,
        database: env.database.database,
        max: 20,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 5000,
      }
);

pool.on('error', (err) => {
  logger.error({ err: err.message }, 'Unexpected error on idle PostgreSQL client in review service');
});

export const query = (text, params) => pool.query(text, params);

/**
 * Execute a callback within an atomic PostgreSQL transaction.
 * Automatically manages BEGIN, COMMIT, and ROLLBACK.
 * @param {Function} callback (client) => Promise<any>
 * @returns {Promise<any>}
 */
export async function withTransaction(callback) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export default {
  pool,
  query,
  withTransaction,
};
