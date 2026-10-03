import { z } from 'zod';

export const MAX_CIPHERTEXT_CHARS = 64 * 1024;

export const b64 = (max: number) => z.string().min(1).max(max).regex(/^[A-Za-z0-9_-]+$/, 'must be base64url');
export const sealed = () => z.object({ nonce: b64(64), ciphertext: b64(MAX_CIPHERTEXT_CHARS) });
export const email = z.string().trim().toLowerCase().email().max(254);
export const uuid = z.string().uuid();
