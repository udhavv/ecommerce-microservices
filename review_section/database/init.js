import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../.env') });

const { Pool } = pg;

const dbUrl = process.env.DATABASE_URL || 'postgresql://postgres:hellowpin1@localhost:5432/test1';

const pool = new Pool(
  dbUrl
    ? { connectionString: dbUrl }
    : {
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT || '5432', 10),
        user: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD || 'hellowpin1',
        database: process.env.DB_NAME || 'test1',
      }
);

export async function initDatabase() {
  const client = await pool.connect();
  try {
    console.log('Connecting to PostgreSQL database:', process.env.DB_NAME || 'test1');
    const schemaSql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf-8');

    // Strip single-line comments first
    const cleanSql = schemaSql
      .split('\n')
      .filter((line) => !line.trim().startsWith('--'))
      .join('\n');

    // Split SQL by semicolons
    const statements = cleanSql
      .split(';')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    console.log(`Executing ${statements.length} schema statements...`);
    for (let i = 0; i < statements.length; i++) {
      const stmt = statements[i];
      if (stmt.trim()) {
        try {
          await client.query(stmt);
        } catch (e) {
          console.error(`Failed at statement ${i}: ${stmt.substring(0, 100)}...`);
          throw e;
        }
      }
    }
    console.log('Review section database schema initialized successfully.');
  } catch (err) {
    console.error('Error initializing database:', err);
    throw err;
  } finally {
    client.release();
  }
}

if (process.argv[1] === __filename) {
  initDatabase()
    .then(() => {
      console.log('Database init complete.');
      pool.end();
      process.exit(0);
    })
    .catch((err) => {
      console.error('Database init failed:', err);
      pool.end();
      process.exit(1);
    });
}

export default initDatabase;
