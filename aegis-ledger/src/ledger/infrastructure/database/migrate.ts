import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runMigrations(): Promise<void> {
  const connectionString =
    process.env['DATABASE_URL'] || 'postgresql://postgres:postgres@localhost:5432/aegis_ledger';

  console.log(`[Migration] Connecting to PostgreSQL at ${connectionString.replace(/:[^:@]+@/, ':***@')}...`);

  const pool = new Pool({ connectionString });
  const client = await pool.connect();

  try {
    const migrationFilePath = path.join(__dirname, 'migrations', '001_init_ledger_schema.sql');
    console.log(`[Migration] Reading migration file: ${migrationFilePath}`);
    const sql = fs.readFileSync(migrationFilePath, 'utf8');

    console.log('[Migration] Executing migration schema...');
    await client.query('BEGIN');
    await client.query(sql);
    await client.query('COMMIT');
    console.log('[Migration] Migration executed successfully!');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[Migration] Migration failed with error:', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runMigrations().catch((err) => {
    console.error('[Migration] Unexpected fatal error:', err);
    process.exit(1);
  });
}

export { runMigrations };
