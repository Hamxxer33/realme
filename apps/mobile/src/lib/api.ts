import type { Sealed } from '@realme/crypto';
import { API_URL } from './config';

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

let authToken: string | null = null;
let onUnauthorized: (() => void) | null = null;

export function setAuthToken(token: string | null) {
  authToken = token;
}

export function setUnauthorizedHandler(fn: (() => void) | null) {
  onUnauthorized = fn;
}

export async function api<T>(method: string, path: string, body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(API_URL + path, {
      method,
      headers: {
        'content-type': 'application/json',
        ...(authToken ? { authorization: `Bearer ${authToken}` } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, "Can't reach the server. Check your connection.");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401 && authToken) onUnauthorized?.();
    throw new ApiError(res.status, (data as { error?: string }).error ?? 'Something went wrong');
  }
  return data as T;
}

// ---- response shapes (mirror apps/server/src/app.ts) ----

export interface PublicUser {
  id: string;
  email: string;
  displayName: string;
  publicKey: string;
}

export interface Partner {
  id: string;
  displayName: string;
  publicKey: string;
  online: boolean;
}

export interface CoupleView {
  id: string;
  paired: boolean;
  pairedAt: string | null;
  inviteCode: string | null;
  inviteExpiresAt: string | null;
  settings: (Sealed & { updatedBy: string }) | null;
  partner: Partner | null;
}

export interface MeResponse {
  user: PublicUser;
  couple: CoupleView | null;
}

export interface MessageRow extends Sealed {
  id: string;
  coupleId: string;
  senderId: string;
  clientId: string;
  createdAt: string;
  readAt: string | null;
}

export interface MemoryRow extends Sealed {
  id: string;
  coupleId: string;
  authorId: string;
  createdAt: string;
}
