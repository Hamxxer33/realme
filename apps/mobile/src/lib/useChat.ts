import type { MessageBody } from '@realme/crypto';
import * as Crypto from 'expo-crypto';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ApiError, api, type ConversationView, type MessageRow } from './api';
import { markReadLocally, refreshConversation } from './conversations';
import { uploadEncrypted } from './media';
import { realtime } from './realtime';
import { useSession } from './session';

export interface ChatItem {
  id: string; // server id, or clientId while pending
  clientId: string;
  senderId: string;
  createdAt: string;
  body: MessageBody | null | undefined; // undefined = still decrypting, null = can't decrypt
  status: 'sent' | 'pending' | 'failed';
}

const PAGE = 40;
const TYPING_SEND_MS = 3000;
const TYPING_SHOW_MS = 5000;

export function useChat(conversation: ConversationView) {
  const { me, encrypt, decrypt, publicKeyOf } = useSession();
  const myId = me?.id ?? '';
  const conversationId = conversation.id;
  const convRef = useRef(conversation);
  convRef.current = conversation;

  const [rows, setRows] = useState<Map<string, MessageRow>>(new Map());
  const [pending, setPending] = useState<Map<string, ChatItem>>(new Map());
  const [bodies, setBodies] = useState<Map<string, MessageBody | null>>(new Map());
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [typing, setTyping] = useState<Map<string, number>>(new Map());
  const lastTypingSent = useRef(0);
  const rowsRef = useRef(rows);
  rowsRef.current = rows;

  const merge = useCallback((incoming: MessageRow[]) => {
    if (!incoming.length) return;
    setRows((prev) => {
      const next = new Map(prev);
      for (const row of incoming) next.set(row.id, row);
      return next;
    });
    setPending((prev) => {
      if (!incoming.some((r) => prev.has(r.clientId))) return prev;
      const next = new Map(prev);
      for (const row of incoming) next.delete(row.clientId);
      return next;
    });
  }, []);

  // Decrypt anything new. Senders who left the chat need a key lookup first.
  useEffect(() => {
    const todo = [...rows.values()].filter((r) => !bodies.has(r.id));
    if (!todo.length) return;
    let alive = true;
    (async () => {
      const done = new Map<string, MessageBody | null>();
      for (const row of todo) {
        const senderKey = await publicKeyOf(row.senderId, convRef.current);
        try {
          done.set(row.id, senderKey ? decrypt<MessageBody>(row, senderKey) : null);
        } catch {
          done.set(row.id, null);
        }
      }
      if (alive) setBodies((prev) => new Map([...prev, ...done]));
    })();
    return () => {
      alive = false;
    };
  }, [rows, bodies, decrypt, publicKeyOf]);

  const initialLoaded = useRef(false);
  /** First load, or catch up after a reconnect — paging back until we reach messages we already have. */
  const loadLatest = useCallback(async () => {
    let before: string | undefined;
    for (let page = 0; page < 10; page++) {
      const res = await api<{ messages: MessageRow[]; hasMore: boolean }>(
        'GET', `/conversations/${conversationId}/messages?limit=${PAGE}${before ? `&before=${before}` : ''}`,
      );
      const caughtUp = res.messages.some((m) => rowsRef.current.has(m.id));
      merge(res.messages);
      if (!initialLoaded.current) {
        initialLoaded.current = true;
        setHasMore(res.hasMore);
        return;
      }
      if (caughtUp || !res.hasMore) return;
      before = res.messages[res.messages.length - 1]?.id;
    }
  }, [conversationId, merge]);

  const loadOlder = useCallback(async () => {
    if (loading || !hasMore) return;
    const oldest = [...rowsRef.current.values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt))[0];
    if (!oldest) return;
    setLoading(true);
    try {
      const res = await api<{ messages: MessageRow[]; hasMore: boolean }>(
        'GET', `/conversations/${conversationId}/messages?limit=${PAGE}&before=${oldest.id}`,
      );
      merge(res.messages);
      setHasMore(res.hasMore);
    } finally {
      setLoading(false);
    }
  }, [conversationId, loading, hasMore, merge]);

  useEffect(() => {
    void loadLatest().catch(() => {});
    return realtime.subscribe((evt) => {
      if (evt.type === 'message' && evt.conversationId === conversationId) {
        merge([evt.message]);
        setTyping((prev) => {
          if (!prev.has(evt.message.senderId)) return prev;
          const next = new Map(prev);
          next.delete(evt.message.senderId);
          return next;
        });
      } else if (evt.type === 'typing' && evt.conversationId === conversationId) {
        setTyping((prev) => new Map(prev).set(evt.userId, Date.now() + TYPING_SHOW_MS));
      } else if (evt.type === 'connected') {
        void loadLatest().catch(() => {});
      }
    });
  }, [conversationId, merge, loadLatest]);

  // Expire typing indicators.
  useEffect(() => {
    if (!typing.size) return;
    const t = setInterval(() => {
      setTyping((prev) => {
        const now = Date.now();
        const next = new Map([...prev].filter(([, until]) => until > now));
        return next.size === prev.size ? prev : next;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [typing.size]);

  const post = useCallback(async (clientId: string, body: MessageBody, retried = false): Promise<void> => {
    try {
      const enc = encrypt(convRef.current, body);
      const { message } = await api<{ message: MessageRow }>('POST', `/conversations/${conversationId}/messages`, { ...enc, clientId });
      merge([message]);
      setBodies((prev) => new Map(prev).set(message.id, body));
    } catch (err) {
      // Someone joined or left since we last looked: refresh members and re-encrypt once.
      if (err instanceof ApiError && err.status === 409 && !retried) {
        const fresh = await refreshConversation(conversationId);
        if (fresh) {
          convRef.current = fresh;
          return post(clientId, body, true);
        }
      }
      setPending((prev) => {
        const item = prev.get(clientId);
        return item ? new Map(prev).set(clientId, { ...item, status: 'failed' }) : prev;
      });
    }
  }, [conversationId, encrypt, merge]);

  const send = useCallback((body: MessageBody) => {
    const clientId = Crypto.randomUUID();
    // Sending clears my typing indicator on the other phones, so the next keystroke should announce it again.
    lastTypingSent.current = 0;
    setPending((prev) => new Map(prev).set(clientId, {
      id: clientId, clientId, senderId: myId, createdAt: new Date().toISOString(), body, status: 'pending',
    }));
    void post(clientId, body);
  }, [myId, post]);

  const retry = useCallback((clientId: string) => {
    const item = pending.get(clientId);
    if (!item?.body) return;
    setPending((prev) => new Map(prev).set(clientId, { ...item, status: 'pending' }));
    void post(clientId, item.body); // same clientId, so the server dedupes
  }, [pending, post]);

  const sendMedia = useCallback(async (
    kind: 'image' | 'voice',
    localUri: string,
    meta: { mime: string; width?: number; height?: number; durationMs?: number },
  ) => {
    const media = await uploadEncrypted(localUri, meta, conversationId);
    send(kind === 'image' ? { kind: 'image', media } : { kind: 'voice', media, durationMs: meta.durationMs ?? 0 });
  }, [send, conversationId]);

  const notifyTyping = useCallback(() => {
    const now = Date.now();
    if (now - lastTypingSent.current > TYPING_SEND_MS) {
      lastTypingSent.current = now;
      realtime.send({ type: 'typing', conversationId });
    }
  }, [conversationId]);

  // Newest first, for an inverted list. Reactions fold onto their targets.
  const { messages, reactions } = useMemo(() => {
    const all: ChatItem[] = [
      ...[...rows.values()].map((r): ChatItem => ({
        id: r.id, clientId: r.clientId, senderId: r.senderId, createdAt: r.createdAt, body: bodies.get(r.id), status: 'sent',
      })),
      ...pending.values(),
    ].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    const reactions = new Map<string, Map<string, string>>();
    const messages: ChatItem[] = [];
    for (const item of all) {
      if (item.body?.kind === 'reaction') {
        const forTarget = reactions.get(item.body.targetId) ?? new Map<string, string>();
        forTarget.set(item.senderId, item.body.emoji);
        reactions.set(item.body.targetId, forTarget);
      } else {
        messages.push(item);
      }
    }
    return { messages: messages.reverse(), reactions };
  }, [rows, pending, bodies]);

  const newestFromOthers = messages.find((m) => m.senderId !== myId && m.status === 'sent');
  const markRead = useCallback(() => {
    if (!newestFromOthers) return;
    markReadLocally(conversationId);
    void api('POST', `/conversations/${conversationId}/read`, { upTo: newestFromOthers.id }).catch(() => {});
  }, [conversationId, newestFromOthers?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    messages,
    reactions,
    hasMore,
    loading,
    typingUserIds: [...typing.keys()],
    myId,
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
