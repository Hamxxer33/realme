import type { MediaRef } from '@realme/crypto';
import { File, Paths } from 'expo-file-system';
import { api } from './api';
import { getCrypto } from './sodium';

/**
 * Encrypt a local file and upload the ciphertext. Returns the reference that
 * goes inside the (also encrypted) message — the file key never reaches the server.
 */
export async function uploadEncrypted(
  localUri: string,
  meta: { mime: string; width?: number; height?: number },
  conversationId: string,
): Promise<MediaRef> {
  const c = await getCrypto();
  const plain = await new File(localUri).bytes();
  const { ciphertext, fileKey, nonce } = c.encryptFile(plain);

  const { objectKey, url } = await api<{ objectKey: string; url: string }>('POST', '/media/upload-url', {
    size: ciphertext.length,
    conversationId,
  });
  const tmp = new File(Paths.cache, `upload-${Date.now()}.bin`);
  tmp.write(ciphertext);
  try {
    const res = await tmp.upload(url, {
      httpMethod: 'PUT',
      headers: { 'content-type': 'application/octet-stream' },
    });
    if (res.status < 200 || res.status >= 300) throw new Error(`Upload failed (${res.status})`);
  } finally {
    tmp.delete();
  }

  // Keep the plaintext we already have so our own media shows instantly.
  const cached = cacheFile({ objectKey, mime: meta.mime });
  if (!cached.exists) cached.write(plain);

  return { objectKey, fileKey, nonce, mime: meta.mime, size: plain.length, width: meta.width, height: meta.height };
}

const inflight = new Map<string, Promise<string>>();

/** Download + decrypt to the app cache (once), returning a local file URI to render or play. */
export function localUriFor(media: MediaRef): Promise<string> {
  const cached = cacheFile(media);
  if (cached.exists) return Promise.resolve(cached.uri);
  let job = inflight.get(media.objectKey);
  if (!job) {
    job = (async () => {
      const c = await getCrypto();
      const { url } = await api<{ url: string }>('POST', '/media/download-url', { objectKey: media.objectKey });
      const tmp = new File(Paths.cache, `download-${Date.now()}.bin`);
      await File.downloadFileAsync(url, tmp, { idempotent: true });
      try {
        cached.write(c.decryptFile(await tmp.bytes(), media.fileKey, media.nonce));
      } finally {
        tmp.delete();
      }
      return cached.uri;
    })().finally(() => inflight.delete(media.objectKey));
    inflight.set(media.objectKey, job);
  }
  return job;
}

function cacheFile(media: { objectKey: string; mime: string }) {
  const id = media.objectKey.split('/').pop();
  const ext = media.mime.startsWith('audio/') ? 'm4a' : media.mime === 'image/png' ? 'png' : 'jpg';
  return new File(Paths.cache, `media-${id}.${ext}`);
}

/** Timeline photos are public, so they're uploaded as-is (no encryption). */
export async function uploadPublic(localUri: string): Promise<string> {
  const file = new File(localUri);
  const size = file.size;
  const { objectKey, url } = await api<{ objectKey: string; url: string }>('POST', '/media/upload-url', { size });
  const res = await file.upload(url, { httpMethod: 'PUT', headers: { 'content-type': 'application/octet-stream' } });
  if (res.status < 200 || res.status >= 300) throw new Error(`Upload failed (${res.status})`);
  return objectKey;
}

const publicUrls = new Map<string, { url: Promise<string>; until: number }>();

/** A short-lived URL for a public post photo, cached until shortly before it expires. */
export function publicUrlFor(objectKey: string): Promise<string> {
  const hit = publicUrls.get(objectKey);
  if (hit && hit.until > Date.now()) return hit.url;
  const url = api<{ url: string }>('POST', '/media/download-url', { objectKey }).then((r) => r.url);
  url.catch(() => publicUrls.delete(objectKey));
  publicUrls.set(objectKey, { url, until: Date.now() + 10 * 60 * 1000 });
  return url;
}
