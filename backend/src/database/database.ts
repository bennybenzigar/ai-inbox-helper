import { Pool } from 'pg';
import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { env } from '../config/env';

const isProduction = env.NODE_ENV === 'production';
const requiresSsl = Boolean(
  isProduction &&
  env.DATABASE_URL &&
  !env.DATABASE_URL.includes('localhost') &&
  !env.DATABASE_URL.includes('127.0.0.1')
);

export const pool = new Pool({
  connectionString: env.DATABASE_URL || undefined,
  host: env.PGHOST,
  port: env.PGPORT,
  user: env.PGUSER,
  password: env.PGPASSWORD,
  database: env.PGDATABASE,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
  ssl: requiresSsl ? { rejectUnauthorized: false } : undefined,
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle PostgreSQL client:', err);
});

export async function query<T = any>(text: string, params: any[] = []): Promise<T[]> {
  const client = await pool.connect();
  try {
    const res = await client.query(text, params);
    return res.rows as T[];
  } finally {
    client.release();
  }
}

export async function initDatabase(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        source TEXT NOT NULL,
        sender_name TEXT NOT NULL,
        sender_email TEXT NOT NULL,
        subject TEXT NOT NULL,
        body TEXT NOT NULL,
        received_at TEXT NOT NULL,
        intent TEXT NOT NULL,
        confidence DOUBLE PRECISION NOT NULL,
        status TEXT NOT NULL DEFAULT 'none',
        gmail_message_id TEXT UNIQUE,
        has_attachments INTEGER NOT NULL DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS drafts (
        id TEXT PRIMARY KEY,
        message_id TEXT NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
        body TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        is_mock INTEGER NOT NULL DEFAULT 0,
        version INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        reviewed_at TEXT
      );

      CREATE TABLE IF NOT EXISTS activity (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        message TEXT NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS sync_checkpoints (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS review_events (
        id TEXT PRIMARY KEY,
        draft_id TEXT NOT NULL,
        action TEXT NOT NULL,
        created_at TEXT NOT NULL,
        version INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS audit_events (
        id TEXT PRIMARY KEY,
        event_type TEXT NOT NULL,
        details TEXT NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS connection_metadata (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `);

    // Migrate any existing REAL messages from SQLite if PostgreSQL tables are empty
    await migrateRealDataFromSqlite(client);
  } finally {
    client.release();
  }
}

async function migrateRealDataFromSqlite(pgClient: import('pg').PoolClient): Promise<void> {
  try {
    const dbPath = path.resolve(process.cwd(), env.DATABASE_PATH);
    if (!fs.existsSync(dbPath)) return;

    const countRes = await pgClient.query('SELECT count(*) as c FROM messages');
    const existingCount = parseInt(countRes.rows[0]?.c ?? '0', 10);
    if (existingCount > 0) return; // already populated

    const sqlite = new Database(dbPath);
    // ONLY select real data (Gmail and CSV imports), explicitly excluding any demo data
    const realMessages = sqlite.prepare(
      "SELECT * FROM messages WHERE source != 'demo' AND sender_name NOT LIKE '%Test%'"
    ).all() as any[];

    if (!realMessages || realMessages.length === 0) {
      sqlite.close();
      return;
    }

    console.log(`Migrating ${realMessages.length} real candidate messages to PostgreSQL...`);

    for (const m of realMessages) {
      await pgClient.query(
        `INSERT INTO messages(id, source, sender_name, sender_email, subject, body, received_at, intent, confidence, status, gmail_message_id, has_attachments)
         VALUES($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
         ON CONFLICT (id) DO NOTHING`,
        [m.id, m.source, m.sender_name, m.sender_email, m.subject, m.body, m.received_at, m.intent, m.confidence, m.status, m.gmail_message_id ?? null, m.has_attachments ? 1 : 0]
      );

      const drafts = sqlite.prepare('SELECT * FROM drafts WHERE message_id = ?').all(m.id) as any[];
      for (const d of drafts) {
        await pgClient.query(
          `INSERT INTO drafts(id, message_id, body, status, is_mock, version, created_at, updated_at, reviewed_at)
           VALUES($1, $2, $3, $4, $5, $6, $7, $8, $9)
           ON CONFLICT (id) DO NOTHING`,
          [d.id, d.message_id, d.body, d.status, 0, d.version, d.created_at, d.updated_at, d.reviewed_at]
        );
      }
    }

    const realActivity = sqlite.prepare("SELECT * FROM activity WHERE type NOT LIKE 'demo-%' ORDER BY created_at DESC LIMIT 50").all() as any[];
    for (const a of realActivity) {
      await pgClient.query(
        `INSERT INTO activity(id, type, message, created_at) VALUES($1, $2, $3, $4) ON CONFLICT (id) DO NOTHING`,
        [a.id, a.type, a.message, a.created_at]
      );
    }

    const checkpoints = sqlite.prepare('SELECT * FROM sync_checkpoints').all() as any[];
    for (const cp of checkpoints) {
      await pgClient.query(
        `INSERT INTO sync_checkpoints(key, value, updated_at) VALUES($1, $2, $3) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = EXCLUDED.updated_at`,
        [cp.key, cp.value, cp.updated_at]
      );
    }

    const metadata = sqlite.prepare('SELECT * FROM connection_metadata').all() as any[];
    for (const m of metadata) {
      await pgClient.query(
        `INSERT INTO connection_metadata(key, value, updated_at) VALUES($1, $2, $3) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = EXCLUDED.updated_at`,
        [m.key, m.value, m.updated_at]
      );
    }

    sqlite.close();
    console.log('PostgreSQL migration completed successfully with 0 dummy records.');
  } catch (err) {
    console.warn('Note on SQLite-to-PostgreSQL initial migration:', err);
  }
}

export async function closeDatabase(): Promise<void> {
  await pool.end();
}
