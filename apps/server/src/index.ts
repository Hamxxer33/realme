import { serve } from '@hono/node-server';
import { cors } from 'hono/cors';
import { createApp } from './app';
import { connect } from './db/client';
import { loadEnv } from './env';
import { localStorage } from './localStorage';
import { expoPush } from './push';
import { s3Storage } from './storage';

// Load apps/server/.env if present (real environment variables take precedence).
try {
  process.loadEnvFile();
} catch {
  // no .env file — rely on the environment
}
const env = loadEnv();
const { db, close } = connect(env.DATABASE_URL);
const local = env.S3_BUCKET
  ? null
  : localStorage({ dir: env.STORAGE_DIR!, publicUrl: env.PUBLIC_URL!, secret: env.JWT_SECRET });
const { app, injectWebSocket } = createApp({
  beforeRoutes: env.CORS_ORIGIN
    ? (a) => a.use('*', cors({ origin: env.CORS_ORIGIN!.split(',').map((o) => o.trim()) }))
    : undefined,
  db,
  jwtSecret: env.JWT_SECRET,
  push: expoPush(env.EXPO_ACCESS_TOKEN),
  storage: local?.storage ?? s3Storage({
    endpoint: env.S3_ENDPOINT,
    region: env.S3_REGION,
    bucket: env.S3_BUCKET!,
    accessKeyId: env.S3_ACCESS_KEY_ID!,
    secretAccessKey: env.S3_SECRET_ACCESS_KEY!,
  }),
});
if (local) {
  local.mount(app);
  console.warn(`Storing media on local disk at ${env.STORAGE_DIR} (development only)`);
}

const server = serve({ fetch: app.fetch, port: env.PORT }, (info) => {
  console.log(`realme server listening on :${info.port}`);
});
injectWebSocket(server);

const shutdown = () => server.close(() => void close().then(() => process.exit(0)));
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
