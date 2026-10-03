import type { MediaRef } from '@realme/crypto';
import { api } from './api';
import { getCrypto } from './sodium';

// Web-preview version of media.ts: same encryption, but browser fetch/Blob
// instead of expo-file-system (which has no web implementation).

async function bytesOf(uri: string) {
  return new Uint8Array(await (await fetch(uri)).arrayBuffer());
}

async function put(url: string, body: Uint8Array | Blob) {
  const res = await fetch(url, { method: 'PUT', headers: { 'content-type': 'application/octet-stream' }, body: body as BodyInit });
  if (!res.ok) throw new Error(`Upload failed (${res.status})`);
}

const decrypted = new Map<string, Promise<string>>();

export async function uploadEncrypted(
  localUri: string,
  meta: { mime: string; width?: number; height?: number },
  conversationId: string,
  statusClientId?: string,
): Promise<MediaRef> {
  const c = await getCrypto();
  const plain = await bytesOf(localUri);
  const { ciphertext, fileKey, nonce } = c.encryptFile(plain);
  const { objectKey, url } = await api<{ objectKey: string; url: string }>('POST', '/media/upload-url', {
    size: ciphertext.length,
    ...(statusClientId ? { statusClientId } : { conversationId }),
  });
  await put(url, ciphertext);
  decrypted.set(objectKey, Promise.resolve(URL.createObjectURL(new Blob([plain as BlobPart], { type: meta.mime }))));
  return { objectKey, fileKey, nonce, mime: meta.mime, size: plain.length, width: meta.width, height: meta.height };
}

export function localUriFor(media: MediaRef): Promise<string> {
  let job = decrypted.get(media.objectKey);
  if (!job) {
    job = (async () => {
      const c = await getCrypto();
      const { url } = await api<{ url: string }>('POST', '/media/download-url', { objectKey: media.objectKey });
      const plain = c.decryptFile(await bytesOf(url), media.fileKey, media.nonce);
      return URL.createObjectURL(new Blob([plain as BlobPart], { type: media.mime }));
    })();
    job.catch(() => decrypted.delete(media.objectKey));
    decrypted.set(media.objectKey, job);
  }
  return job;
}

export async function uploadPublic(localUri: string): Promise<string> {
  const blob = await (await fetch(localUri)).blob();
  const { objectKey, url } = await api<{ objectKey: string; url: string }>('POST', '/media/upload-url', { size: blob.size });
  await put(url, blob);
  return objectKey;
}

const publicUrls = new Map<string, { url: Promise<string>; until: number }>();

export function publicUrlFor(objectKey: string): Promise<string> {
  const hit = publicUrls.get(objectKey);
  if (hit && hit.until > Date.now()) return hit.url;
  const url = api<{ url: string }>('POST', '/media/download-url', { objectKey }).then((r) => r.url);
  url.catch(() => publicUrls.delete(objectKey));
  publicUrls.set(objectKey, { url, until: Date.now() + 10 * 60 * 1000 });
  return url;
}
