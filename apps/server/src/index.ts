import { serve } from '@hono/node-server';
import { createApp } from './app';
import { connect } from './db/client';
import { loadEnv } from './env';
import { expoPush } from './push';
import { s3Storage } from './storage';

const env = loadEnv();
const { db, close } = connect(env.DATABASE_URL);
const { app, injectWebSocket } = createApp({
  db,
  jwtSecret: env.JWT_SECRET,
  push: expoPush(env.EXPO_ACCESS_TOKEN),
  storage: s3Storage({
    endpoint: env.S3_ENDPOINT,
    region: env.S3_REGION,
    bucket: env.S3_BUCKET,
    accessKeyId: env.S3_ACCESS_KEY_ID,
    secretAccessKey: env.S3_SECRET_ACCESS_KEY,
  }),
});

const server = serve({ fetch: app.fetch, port: env.PORT }, (info) => {
  console.log(`realme server listening on :${info.port}`);
});
injectWebSocket(server);

const shutdown = () => server.close(() => void close().then(() => process.exit(0)));
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
