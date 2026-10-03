import { z } from 'zod';

const schema = z.object({
  PORT: z.coerce.number().default(8787),
  DATABASE_URL: z.string().min(1),
  // At least 32 random bytes, e.g. `openssl rand -base64 48`.
  JWT_SECRET: z.string().min(32),
  // Either S3-compatible storage…
  S3_ENDPOINT: z.string().url().optional(),
  S3_REGION: z.string().default('auto'),
  S3_BUCKET: z.string().optional(),
  S3_ACCESS_KEY_ID: z.string().optional(),
  S3_SECRET_ACCESS_KEY: z.string().optional(),
  // …or, for local development only, a directory on disk served by this server.
  STORAGE_DIR: z.string().optional(),
  PUBLIC_URL: z.string().url().optional(),
  EXPO_ACCESS_TOKEN: z.string().optional(),
  // Only needed for the web build (phones don't send CORS requests). Comma-separated origins.
  CORS_ORIGIN: z.string().optional(),
});

export type Env = z.infer<typeof schema>;

const withStorage = schema.refine(
  (e) => (e.S3_BUCKET && e.S3_ACCESS_KEY_ID && e.S3_SECRET_ACCESS_KEY) || (e.STORAGE_DIR && e.PUBLIC_URL),
  { message: 'Set S3_BUCKET/S3_ACCESS_KEY_ID/S3_SECRET_ACCESS_KEY, or STORAGE_DIR + PUBLIC_URL for local development' },
);

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const parsed = withStorage.safeParse(source);
  if (!parsed.success) {
    const missing = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('\n  ');
    throw new Error(`Invalid environment:\n  ${missing}`);
  }
  return parsed.data;
}
