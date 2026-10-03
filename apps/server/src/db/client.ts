import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import * as schema from './schema';

export type DB = PgDatabase<PgQueryResultHKT, typeof schema>;

/** Neon is plain Postgres, so the standard driver works (use the pooled connection string). */
export function connect(databaseUrl: string): { db: DB; close: () => Promise<void> } {
  const pool = new pg.Pool({ connectionString: databaseUrl, max: 10 });
  return { db: drizzle(pool, { schema }), close: () => pool.end() };
}
