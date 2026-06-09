// Applies pending Prisma migrations at runtime using the `pg` driver only.
//
// The runner image ships the Next.js standalone bundle (which already traces
// `pg`) but NOT the Prisma CLI, so `prisma migrate deploy` isn't available in
// production. This script reproduces its essential behaviour: it tracks applied
// migrations in the standard `_prisma_migrations` table (same shape and
// checksum algorithm Prisma uses) and applies any pending `migration.sql`
// files from `prisma/migrations/` in order, each inside a transaction.
//
// It is intentionally tolerant of a missing/placeholder DATABASE_URL so that
// Docker builds and local runs without a database don't fail.

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import pg from 'pg';

const { Client } = pg;

const __dirname = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = join(__dirname, '..', 'prisma', 'migrations');

const connectionString =
  process.env.DATABASE_POSTGRES_PRISMA_URL || process.env.DATABASE_URL;

function isUsableConnection(url) {
  return Boolean(url) && !url.includes('placeholder');
}

function checksum(sql) {
  return createHash('sha256').update(sql, 'utf8').digest('hex');
}

function pendingMigrations() {
  if (!existsSync(MIGRATIONS_DIR)) return [];
  return readdirSync(MIGRATIONS_DIR, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    // Prisma applies migrations in lexicographic order of their directory name.
    .sort()
    .map((name) => {
      const file = join(MIGRATIONS_DIR, name, 'migration.sql');
      return existsSync(file)
        ? { name, sql: readFileSync(file, 'utf8') }
        : null;
    })
    .filter(Boolean);
}

async function ensureMigrationsTable(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS "_prisma_migrations" (
      "id" VARCHAR(36) PRIMARY KEY NOT NULL,
      "checksum" VARCHAR(64) NOT NULL,
      "finished_at" TIMESTAMPTZ,
      "migration_name" VARCHAR(255) NOT NULL,
      "logs" TEXT,
      "rolled_back_at" TIMESTAMPTZ,
      "started_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
      "applied_steps_count" INTEGER NOT NULL DEFAULT 0
    );
  `);
}

async function appliedNames(client) {
  const { rows } = await client.query(
    'SELECT migration_name FROM "_prisma_migrations" WHERE finished_at IS NOT NULL'
  );
  return new Set(rows.map((r) => r.migration_name));
}

async function applyMigration(client, migration) {
  await client.query('BEGIN');
  try {
    await client.query(migration.sql);
    await client.query(
      `INSERT INTO "_prisma_migrations"
         (id, checksum, migration_name, started_at, finished_at, applied_steps_count)
       VALUES ($1, $2, $3, now(), now(), 1)`,
      [randomUUID(), checksum(migration.sql), migration.name]
    );
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  }
}

async function connectWithRetry(maxAttempts = 5) {
  let lastErr;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const client = new Client({ connectionString });
    try {
      await client.connect();
      return client;
    } catch (err) {
      lastErr = err;
      await client.end().catch(() => {});
      const waitMs = Math.min(2000 * attempt, 10000);
      console.warn(
        `[migrate] database not ready (attempt ${attempt}/${maxAttempts}): ${err.message}. retrying in ${waitMs}ms`
      );
      await new Promise((r) => setTimeout(r, waitMs));
    }
  }
  throw lastErr;
}

async function main() {
  if (!isUsableConnection(connectionString)) {
    console.log('[migrate] no usable DATABASE_URL configured, skipping migrations.');
    return;
  }

  const migrations = pendingMigrations();
  if (migrations.length === 0) {
    console.log('[migrate] no migration files found, nothing to do.');
    return;
  }

  const client = await connectWithRetry();
  try {
    await ensureMigrationsTable(client);
    const done = await appliedNames(client);
    let applied = 0;
    for (const migration of migrations) {
      if (done.has(migration.name)) continue;
      console.log(`[migrate] applying ${migration.name}...`);
      await applyMigration(client, migration);
      applied++;
    }
    console.log(
      applied > 0
        ? `[migrate] applied ${applied} migration(s).`
        : '[migrate] database already up to date.'
    );
  } finally {
    await client.end().catch(() => {});
  }
}

main().catch((err) => {
  console.error('[migrate] migration failed:', err);
  process.exit(1);
});
