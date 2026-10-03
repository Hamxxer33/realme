// Applies database migrations with the runtime driver, so production needs no dev tools.
// Railway runs this before each deploy (see railway.json).
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import pg from 'pg';

try {
  process.loadEnvFile();
} catch {
  // no .env file — rely on the environment
}
const url = process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL is not set');

const pool = new pg.Pool({ connectionString: url, max: 1 });
await migrate(drizzle(pool), { migrationsFolder: new URL('../drizzle', import.meta.url).pathname });
await pool.end();
console.log('Migrations applied');
