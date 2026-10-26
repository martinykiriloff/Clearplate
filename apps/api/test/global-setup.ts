import { Pool } from 'pg';
import { runMigrations } from '../src/db/migrate';

/** Fresh schema per e2e run on the test database. */
export default async function globalSetup() {
  const url = process.env.TEST_DATABASE_URL ?? 'postgresql://clearplate:clearplate@localhost:5432/clearplate_test';
  process.env.DATABASE_URL = url;
  const pool = new Pool({ connectionString: url });
  await pool.query('DROP SCHEMA IF EXISTS public CASCADE; DROP SCHEMA IF EXISTS drizzle CASCADE; CREATE SCHEMA public;');
  await pool.end();
  await runMigrations(url);
}
