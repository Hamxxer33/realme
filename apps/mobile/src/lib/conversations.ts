import { useSyncExternalStore } from 'react';
import { api, type ConversationView } from './api';
import { realtime } from './realtime';

/**
 * One shared cache of the chat list and message requests, kept fresh by
 * realtime events, so every screen shows the same state.
 */
interface State {
  chats: ConversationView[] | null;
  requests: ConversationView[] | null;
  byId: Map<string, ConversationView>;
}

let state: State = { chats: null, requests: null, byId: new Map() };
const listeners = new Set<() => void>();
let started = false;
let myId = '';

function set(next: Partial<State>) {
  state = { ...state, ...next };
  for (const fn of listeners) fn();
}

const byTime = (a: ConversationView, b: ConversationView) =>
  (b.lastMessageAt ?? b.createdAt).localeCompare(a.lastMessageAt ?? a.createdAt);

function index(chats: ConversationView[], requests: ConversationView[]) {
  const byId = new Map(state.byId);
  for (const c of [...chats, ...requests]) byId.set(c.id, c);
  return byId;
}

export async function refreshConversations() {
  const [chats, requests] = await Promise.all([
    api<{ conversations: ConversationView[] }>('GET', '/conversations'),
    api<{ conversations: ConversationView[] }>('GET', '/conversations?requests=1'),
  ]);
  set({ chats: chats.conversations, requests: requests.conversations, byId: index(chats.conversations, requests.conversations) });
}

export async function refreshConversation(id: string): Promise<ConversationView | null> {
  try {
    const { conversation } = await api<{ conversation: ConversationView }>('GET', `/conversations/${id}`);
    upsert(conversation);
    return conversation;
  } catch {
    forget(id);
    return null;
  }
}

export function upsert(conv: ConversationView) {
  const byId = new Map(state.byId).set(conv.id, conv);
  const without = (list: ConversationView[] | null) => (list ?? []).filter((c) => c.id !== conv.id);
  const showInRequests = conv.myStatus === 'pending' && Boolean(conv.lastMessage);
  set({
    byId,
    chats: conv.myStatus === 'accepted' ? [...without(state.chats), conv].sort(byTime) : without(state.chats),
    requests: showInRequests ? [...without(state.requests), conv].sort(byTime) : without(state.requests),
  });
}

export function forget(id: string) {
  const byId = new Map(state.byId);
  byId.delete(id);
  set({ byId, chats: (state.chats ?? []).filter((c) => c.id !== id), requests: (state.requests ?? []).filter((c) => c.id !== id) });
}

/** Locally mark a conversation read (the server is told separately). */
export function markReadLocally(id: string) {
  const conv = state.byId.get(id);
  if (conv && conv.unreadCount) upsert({ ...conv, unreadCount: 0 });
}

export function startConversationSync(userId: string) {
  myId = userId;
  if (started) return;
  started = true;
  realtime.subscribe((evt) => {
    if (evt.type === 'connected') void refreshConversations().catch(() => {});
    if (evt.type === 'conversation_changed') void refreshConversation(evt.conversationId);
    if (evt.type === 'message') {
      const conv = state.byId.get(evt.conversationId);
      if (!conv) return void refreshConversation(evt.conversationId);
      upsert({
        ...conv,
        lastMessage: evt.message,
        lastMessageAt: evt.message.createdAt,
        unreadCount: conv.unreadCount + (evt.message.senderId === myId ? 0 : 1),
      });
    }
    if (evt.type === 'read') {
      const conv = state.byId.get(evt.conversationId);
      if (conv) {
        upsert({ ...conv, members: conv.members.map((m) => (m.id === evt.userId ? { ...m, lastReadAt: evt.lastReadAt } : m)) });
      }
    }
  });
  void refreshConversations().catch(() => {});
}

export function resetConversations() {
  set({ chats: null, requests: null, byId: new Map() });
}

const subscribe = (fn: () => void) => {
  listeners.add(fn);
  return () => void listeners.delete(fn);
};

export function useConversations() {
  return useSyncExternalStore(subscribe, () => state);
}

export function useConversation(id: string | undefined) {
  return useSyncExternalStore(subscribe, () => (id ? state.byId.get(id) ?? null : null));
}
