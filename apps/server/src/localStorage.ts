import { createHmac, timingSafeEqual } from 'node:crypto';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { Hono } from 'hono';
import type { Storage } from './storage';

const URL_TTL_SECONDS = 15 * 60;
const KEY_PATTERN = /^((conversations|posts)\/[0-9a-f-]{36}|status\/[0-9a-f-]{36}\/[A-Za-z0-9_-]{1,64})\/[0-9a-f-]{36}$/;

/**
 * Development-only storage on local disk, so the stack runs without an S3
 * bucket. Mimics presigned URLs with an HMAC over method, key, size and expiry.
 */
export function localStorage(opts: { dir: string; publicUrl: string; secret: string }) {
  const sign = (method: string, key: string, exp: number, size = 0) =>
    createHmac('sha256', opts.secret).update(`${method}\n${key}\n${exp}\n${size}`).digest('base64url');

  const url = (method: 'PUT' | 'GET', key: string, size?: number) => {
    const exp = Math.floor(Date.now() / 1000) + URL_TTL_SECONDS;
    const query = new URLSearchParams({ exp: String(exp), sig: sign(method, key, exp, size), ...(size ? { size: String(size) } : {}) });
    return `${opts.publicUrl}/dev-media/${key}?${query}`;
  };

  const fileFor = (key: string) => path.join(opts.dir, ...key.split('/'));

  const verify = (method: string, key: string, q: URLSearchParams) => {
    const exp = Number(q.get('exp'));
    const size = Number(q.get('size') ?? 0);
    const given = Buffer.from(q.get('sig') ?? '');
    const expected = Buffer.from(sign(method, key, exp, size));
    return KEY_PATTERN.test(key) && exp > Date.now() / 1000 && given.length === expected.length && timingSafeEqual(given, expected)
      ? { size }
      : null;
  };

  const storage: Storage = {
    presignUpload: async (key, size) => url('PUT', key, size),
    presignDownload: async (key) => url('GET', key),
    deletePrefix: (prefix) => rm(fileFor(prefix.replace(/\/$/, '')), { recursive: true, force: true }),
  };

  function mount(app: Hono<any>) {
    app.put('/dev-media/*', async (c) => {
      const key = c.req.path.slice('/dev-media/'.length);
      const ok = verify('PUT', key, new URL(c.req.url).searchParams);
      if (!ok) return c.text('Forbidden', 403);
      const body = Buffer.from(await c.req.arrayBuffer());
      if (body.length !== ok.size) return c.text('Size mismatch', 400);
      await mkdir(path.dirname(fileFor(key)), { recursive: true });
      await writeFile(fileFor(key), body);
      return c.body(null, 200);
    });
    app.get('/dev-media/*', async (c) => {
      const key = c.req.path.slice('/dev-media/'.length);
      if (!verify('GET', key, new URL(c.req.url).searchParams)) return c.text('Forbidden', 403);
      try {
        return c.body(await readFile(fileFor(key)), 200, { 'content-type': 'application/octet-stream' });
      } catch {
        return c.text('Not found', 404);
      }
    });
  }

  return { storage, mount };
}
