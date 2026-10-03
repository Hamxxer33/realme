import type { MessageBody } from '@realme/crypto';
import * as Crypto from 'expo-crypto';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api, type MessageRow } from './api';
import { uploadEncrypted } from './media';
import { realtime } from './realtime';
import { useSession } from './session';

export interface ChatItem {
  id: string; // server id, or clientId while pending
  clientId: string;
  senderId: string;
  createdAt: string;
  readAt: string | null;
  body: MessageBody | null; // null = couldn't decrypt
  status: 'sent' | 'pending' | 'failed';
}

const PAGE = 40;
const TYPING_SEND_MS = 3000;
const TYPING_SHOW_MS = 5000;

export function useChat() {
  const { me, seal, open } = useSession();
  const myId = me?.user.id ?? '';
  const partnerId = me?.couple?.partner?.id ?? '';

  const [items, setItems] = useState<Map<string, ChatItem>>(new Map());
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [partnerTyping, setPartnerTyping] = useState(false);
  const retryBodies = useRef(new Map<string, MessageBody>());
  const lastTypingSent = useRef(0);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const decrypt = useCallback((row: MessageRow): ChatItem => {
    let body: MessageBody | null = null;
    try {
      body = open<MessageBody>(row, row.senderId);
    } catch {
      body = null;
    }
    return { id: row.id, clientId: row.clientId, senderId: row.senderId, createdAt: row.createdAt, readAt: row.readAt, body, status: 'sent' };
  }, [open]);

  const merge = useCallback((rows: MessageRow[]) => {
    setItems((prev) => {
      const next = new Map(prev);
      for (const row of rows) {
        next.delete(row.clientId); // replace the optimistic copy
        next.set(row.id, decrypt(row));
        retryBodies.current.delete(row.clientId);
      }
      return next;
    });
  }, [decrypt]);

  const itemsRef = useRef(items);
  itemsRef.current = items;
  const initialLoaded = useRef(false);

  /** First load, or catch up after a reconnect — paging back until we reach messages we already have. */
  const loadLatest = useCallback(async () => {
    let before: string | undefined;
    for (let page = 0; page < 10; page++) {
      const query = `/messages?limit=${PAGE}${before ? `&before=${before}` : ''}`;
      const res = await api<{ messages: MessageRow[]; hasMore: boolean }>('GET', query);
      const caughtUp = res.messages.some((m) => itemsRef.current.has(m.id));
      merge(res.messages);
      if (!initialLoaded.current) {
        initialLoaded.current = true;
        setHasMore(res.hasMore);
        return;
      }
      if (caughtUp || !res.hasMore) return;
      before = res.messages[res.messages.length - 1]?.id;
    }
  }, [merge]);

  const sorted = useMemo(
    () => [...items.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [items],
  );

  const loadOlder = useCallback(async () => {
    if (loading || !hasMore) return;
    const oldest = [...sorted].reverse().find((i) => i.status === 'sent');
    if (!oldest) return;
    setLoading(true);
    try {
      const res = await api<{ messages: MessageRow[]; hasMore: boolean }>('GET', `/messages?limit=${PAGE}&before=${oldest.id}`);
      merge(res.messages);
      setHasMore(res.hasMore);
    } finally {
      setLoading(false);
    }
  }, [loading, hasMore, sorted, merge]);

  useEffect(() => {
    if (!partnerId) return;
    void loadLatest().catch(() => {});
    return realtime.subscribe((evt) => {
      if (evt.type === 'message') {
        merge([evt.message]);
        if (evt.message.senderId === partnerId) setPartnerTyping(false);
      } else if (evt.type === 'read' && evt.readerId === partnerId) {
        setItems((prev) => {
          const anchor = [...prev.values()].find((i) => i.id === evt.upTo);
          if (!anchor) return prev;
          const next = new Map(prev);
          for (const [k, item] of next) {
            if (item.senderId === myId && !item.readAt && item.createdAt <= anchor.createdAt) {
              next.set(k, { ...item, readAt: evt.readAt });
            }
          }
          return next;
        });
      } else if (evt.type === 'typing' && evt.userId === partnerId) {
        setPartnerTyping(true);
        clearTimeout(typingTimer.current);
        typingTimer.current = setTimeout(() => setPartnerTyping(false), TYPING_SHOW_MS);
      } else if (evt.type === 'connected') {
        void loadLatest().catch(() => {});
      }
    });
  }, [partnerId, myId, merge, loadLatest]);

  useEffect(() => () => clearTimeout(typingTimer.current), []);

  const post = useCallback(async (clientId: string, body: MessageBody) => {
    try {
      const { message } = await api<{ message: MessageRow }>('POST', '/messages', { ...seal(body), clientId });
      merge([message]);
    } catch {
      setItems((prev) => {
        const item = prev.get(clientId);
        if (!item) return prev;
        return new Map(prev).set(clientId, { ...item, status: 'failed' });
      });
    }
  }, [seal, merge]);

  const send = useCallback((body: MessageBody) => {
    const clientId = Crypto.randomUUID();
    retryBodies.current.set(clientId, body);
    setItems((prev) => new Map(prev).set(clientId, {
      id: clientId,
      clientId,
      senderId: myId,
      createdAt: new Date().toISOString(),
      readAt: null,
      body,
      status: 'pending',
    }));
    void post(clientId, body);
  }, [myId, post]);

  const retry = useCallback((clientId: string) => {
    const body = retryBodies.current.get(clientId);
    if (!body) return;
    setItems((prev) => {
      const item = prev.get(clientId);
      return item ? new Map(prev).set(clientId, { ...item, status: 'pending' }) : prev;
    });
    void post(clientId, body); // same clientId, so the server dedupes
  }, [post]);

  const sendMedia = useCallback(async (
    kind: 'image' | 'voice',
    localUri: string,
    meta: { mime: string; width?: number; height?: number; durationMs?: number },
  ) => {
    const media = await uploadEncrypted(localUri, meta);
    send(kind === 'image' ? { kind: 'image', media } : { kind: 'voice', media, durationMs: meta.durationMs ?? 0 });
  }, [send]);

  const notifyTyping = useCallback(() => {
    const now = Date.now();
    if (now - lastTypingSent.current > TYPING_SEND_MS) {
      lastTypingSent.current = now;
      realtime.send({ type: 'typing' });
    }
  }, []);

  const markRead = useCallback(() => {
    const newestUnread = sorted.find((i) => i.senderId === partnerId && !i.readAt && i.status === 'sent');
    if (!newestUnread) return;
    void api('POST', '/messages/read', { upTo: newestUnread.id }).catch(() => {});
    setItems((prev) => {
      const next = new Map(prev);
      const readAt = new Date().toISOString();
      for (const [k, item] of next) {
        if (item.senderId === partnerId && !item.readAt && item.createdAt <= newestUnread.createdAt) {
          next.set(k, { ...item, readAt });
        }
      }
      return next;
    });
  }, [sorted, partnerId]);

  // Reactions are messages too; fold them onto their targets instead of listing them.
  const { messages, reactions } = useMemo(() => {
    const reactions = new Map<string, Map<string, string>>(); // targetId -> senderId -> emoji
    const messages: ChatItem[] = [];
    for (const item of [...sorted].reverse()) {
      if (item.body?.kind === 'reaction') {
        const forTarget = reactions.get(item.body.targetId) ?? new Map<string, string>();
        if (item.body.emoji) forTarget.set(item.senderId, item.body.emoji);
        else forTarget.delete(item.senderId);
        reactions.set(item.body.targetId, forTarget);
      } else {
        messages.push(item);
      }
    }
    return { messages: messages.reverse(), reactions };
  }, [sorted]);

  return {
    messages, // newest first, for an inverted list
    reactions,
    hasMore,
    loading,
    partnerTyping,
    myId,
    partnerId,
    loadOlder,
    sendText: (text: string) => send({ kind: 'text', text }),
    sendNudge: () => send({ kind: 'nudge' }),
    react: (targetId: string, emoji: string) => send({ kind: 'reaction', targetId, emoji }),
    sendMedia,
    retry,
    notifyTyping,
    markRead,
  };
}
