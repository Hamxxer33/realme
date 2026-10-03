import type { StatusBody } from '@realme/crypto';
import * as Crypto from 'expo-crypto';
import { useCallback, useEffect, useState } from 'react';
import { api, type PublicUser } from './api';
import { uploadEncrypted } from './media';
import { realtime } from './realtime';
import { useSession } from './session';

export interface StatusItem {
  id: string;
  authorId: string;
  clientId: string;
  nonce: string;
  ciphertext: string;
  key: { nonce: string; key: string } | null;
  createdAt: string;
  expiresAt: string;
  viewed: boolean;
  viewCount?: number;
}

export interface StatusGroup {
  author: PublicUser;
  items: StatusItem[];
  allViewed: boolean;
}

export interface StatusFeed {
  mine: StatusGroup | null;
  recent: StatusGroup[];
  viewed: StatusGroup[];
}

/** Text status backgrounds; white text passes AA on each. */
export const STATUS_BACKGROUNDS = ['#C2385E', '#7A2D45', '#5B3F8C', '#3D5A80', '#2A6F5B', '#8A6238', '#2E1E24'];

let cache: StatusFeed | null = null;

export function useStatusFeed() {
  const [feed, setFeed] = useState<StatusFeed | null>(cache);
  const refresh = useCallback(async () => {
    cache = await api<StatusFeed>('GET', '/status');
    setFeed(cache);
  }, []);
  useEffect(() => {
    void refresh().catch(() => setFeed((f) => f ?? { mine: null, recent: [], viewed: [] }));
    return realtime.subscribe((evt) => {
      if (evt.type === 'status_changed' || evt.type === 'connected') void refresh().catch(() => {});
    });
  }, [refresh]);
  return { feed, refresh };
}

export function useStatusCrypto() {
  const { decrypt, encryptFor } = useSession();

  const open = useCallback((item: StatusItem, author: PublicUser): StatusBody | null => {
    try {
      return decrypt<StatusBody>(
        { ...item, conversationId: `status:${item.clientId}`, senderId: item.authorId },
        author.publicKey,
      );
    } catch {
      return null;
    }
  }, [decrypt]);

  const post = useCallback(async (make: (clientId: string) => Promise<StatusBody>) => {
    const clientId = Crypto.randomUUID().replace(/-/g, '');
    const { users } = await api<{ users: PublicUser[] }>('GET', '/status/audience');
    const body = await make(clientId);
    const enc = encryptFor(`status:${clientId}`, users, body);
    await api('POST', '/status', { ...enc, clientId });
    cache = await api<StatusFeed>('GET', '/status');
    return users.length;
  }, [encryptFor]);

  return {
    open,
    postText: (text: string, background: string) => post(async () => ({ kind: 'text', text, background })),
    postPhoto: (uri: string, meta: { mime: string; width: number; height: number }, caption?: string) =>
      post(async (clientId) => ({ kind: 'image', media: await uploadEncrypted(uri, meta, '', clientId), caption })),
  };
}

export function markStatusViewed(id: string) {
  void api('POST', `/status/${id}/view`).catch(() => {});
}
