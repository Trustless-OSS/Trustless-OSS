import fs from 'fs';
import path from 'path';
import { Client } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const dbUrl = process.env.DATABASE_URL;

if (!dbUrl) {
  console.error('❌ Missing DATABASE_URL in .env');
  console.error('Please add your direct Postgres connection string to .env.');
  console.error('You can find it in your Supabase Dashboard: Project Settings -> Database -> Connection string -> URI');
  process.exit(1);
}

async function migrate() {
  const client = new Client({
    connectionString: dbUrl,
    ssl: { rejectUnauthorized: false } // Required for Supabase
  });

  try {
    await client.connect();
    console.log('✅ Connected to database');

    const schemaPath = path.join(__dirname, '../../docs/schema.sql');
    const schemaSql = fs.readFileSync(schemaPath, 'utf-8');

    console.log('Running schema.sql...');
    await client.query(schemaSql);
    
    console.log('🎉 Migration successful!');
  } catch (error) {
    console.error('❌ Migration failed:', error);
  } finally {
    await client.end();
  }
}

migrate();
