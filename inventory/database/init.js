import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';
import env from '../src/config/env.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const { Client } = pg;

async function initDb() {
  console.log('--- Initializing Inventory Database ---');

  // 1. Connect to postgres default DB to ensure 'inventory' database exists
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
    console.error('Note on root DB check:', err.message);
  } finally {
    await rootClient.end().catch(() => {});
  }

  // 2. Connect to the inventory database and run schema.sql
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
    const sql = fs.readFileSync(schemaPath, 'utf8');

    await targetClient.query(sql);
    console.log('Schema tables, triggers, constraints, and indexes created successfully!');
  } catch (err) {
    console.error('Error applying schema:', err.message);
    process.exit(1);
  } finally {
    await targetClient.end().catch(() => {});
  }
}

initDb();
