import { z } from 'zod';

const schema = z.object({
  PORT: z.coerce.number().default(8787),
  DATABASE_URL: z.string().min(1),
  // At least 32 random bytes, e.g. `openssl rand -base64 48`.
  JWT_SECRET: z.string().min(32),
  S3_ENDPOINT: z.string().url().optional(),
  S3_REGION: z.string().default('auto'),
  S3_BUCKET: z.string().min(1),
  S3_ACCESS_KEY_ID: z.string().min(1),
  S3_SECRET_ACCESS_KEY: z.string().min(1),
  EXPO_ACCESS_TOKEN: z.string().optional(),
});

export type Env = z.infer<typeof schema>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const parsed = schema.safeParse(source);
  if (!parsed.success) {
    const missing = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('\n  ');
    throw new Error(`Invalid environment:\n  ${missing}`);
  }
  return parsed.data;
}
