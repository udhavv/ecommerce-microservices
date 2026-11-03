import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';
import env from '../src/config/env.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const { Client } = pg;

async function initDb() {
  console.log('--- Initializing Order Database ---');

  // 1. Connect to postgres root DB to ensure the target database exists
  const rootClient = new Client({
    host: env.database.host,
    port: env.database.port,
    user: env.database.user,
    password: env.database.password,
    database: 'postgres',
  });

  try {
    await rootClient.connect();
    const checkDb = await rootClient.query(
      `SELECT 1 FROM pg_database WHERE datname = $1`,
      [env.database.database]
    );

    if (checkDb.rows.length === 0) {
      console.log(`Database '${env.database.database}' does not exist. Creating...`);
      await rootClient.query(`CREATE DATABASE "${env.database.database}"`);
      console.log(`Database '${env.database.database}' created.`);
    } else {
      console.log(`Database '${env.database.database}' already exists.`);
    }
  } catch (err) {
    console.warn('Note on root DB check:', err.message);
  } finally {
    await rootClient.end().catch(() => {});
  }

  // 2. Connect to the order database and run schema.sql
  const targetClient = new Client(
    env.database.url
      ? { connectionString: env.database.url }
      : {
          host: env.database.host,
          port: env.database.port,
          user: env.database.user,
          password: env.database.password,
          database: env.database.database,
        }
  );

  try {
    await targetClient.connect();
    console.log(`Connected to database '${env.database.database}'. Executing schema.sql...`);

    const schemaPath = path.join(__dirname, 'schema.sql');
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');

    await targetClient.query(schemaSql);
    console.log('Order database schema initialized successfully!');
  } catch (err) {
    console.error('Error executing schema.sql:', err.message);
    process.exit(1);
  } finally {
    await targetClient.end().catch(() => {});
  }
}

initDb();
