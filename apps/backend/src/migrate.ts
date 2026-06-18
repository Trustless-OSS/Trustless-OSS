import fs from 'fs';
import path from 'path';
import { Client } from 'pg';
import dotenv from 'dotenv';
import { logger } from './lib/logger.js';

dotenv.config();

const log = logger.child({ module: 'migrate' });

const dbUrl = process.env.DATABASE_URL;

if (!dbUrl) {
  log.error('Missing DATABASE_URL in .env — add your Supabase direct Postgres connection string');
  process.exit(1);
}

async function migrate() {
  const client = new Client({
    connectionString: dbUrl,
    ssl: { rejectUnauthorized: false }, // Required for Supabase
  });

  try {
    await client.connect();
    log.info('connected to database');

    const schemaPath = path.join(__dirname, '../migrations/001_initial_schema.sql');
    const schemaSql = fs.readFileSync(schemaPath, 'utf-8');

    log.info('running schema.sql');
    await client.query(schemaSql);

    log.info('migration successful');
  } catch (error) {
    log.error({ err: error }, 'migration failed');
  } finally {
    await client.end();
  }
}

void migrate();
