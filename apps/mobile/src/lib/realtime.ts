import { AppState } from 'react-native';
import type { MessageRow } from './api';
import { WS_URL } from './config';

export type RealtimeEvent =
  | { type: 'message'; conversationId: string; message: MessageRow }
  | { type: 'read'; conversationId: string; userId: string; lastReadAt: string }
  | { type: 'typing'; conversationId: string; userId: string }
  | { type: 'conversation_changed'; conversationId: string }
  | { type: 'status_changed'; authorId: string }
  | { type: 'channel_post'; channelId: string }
  | { type: 'community_changed'; communityId: string }
  | { type: 'connected' };

type Listener = (event: RealtimeEvent) => void;

/**
 * One socket for the whole app. Reconnects with backoff, pauses in the
 * background (push notifications cover that), and emits `connected` after
 * every (re)connect so screens can refetch anything they missed.
 */
class Realtime {
  private ws: WebSocket | null = null;
  private token: string | null = null;
  private listeners = new Set<Listener>();
  private retry = 0;
  private retryTimer: ReturnType<typeof setTimeout> | undefined;
  private pingTimer: ReturnType<typeof setInterval> | undefined;

  constructor() {
    AppState.addEventListener('change', (state) => {
      if (!this.token) return;
      if (state === 'active') this.connect();
      else this.disconnect();
    });
  }

  start(token: string) {
    this.token = token;
    this.retry = 0;
    this.connect();
  }

  stop() {
    this.token = null;
    this.disconnect();
  }

  subscribe(fn: Listener) {
    this.listeners.add(fn);
    return () => void this.listeners.delete(fn);
  }

  send(payload: { type: 'typing'; conversationId: string }) {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(payload));
  }

  private emit(event: RealtimeEvent) {
    for (const fn of this.listeners) fn(event);
  }

  private connect() {
    if (!this.token || this.ws) return;
    clearTimeout(this.retryTimer);
    const ws = new WebSocket(WS_URL);
    this.ws = ws;
    ws.onopen = () => ws.send(JSON.stringify({ type: 'auth', token: this.token }));
    ws.onmessage = (e) => {
      let event: { type: string };
      try {
        event = JSON.parse(String(e.data));
      } catch {
        return;
      }
      if (event.type === 'ready') {
        this.retry = 0;
        this.pingTimer = setInterval(() => ws.send(JSON.stringify({ type: 'ping' })), 25_000);
        this.emit({ type: 'connected' });
      } else if (event.type !== 'pong') {
        this.emit(event as RealtimeEvent);
      }
    };
    ws.onclose = () => {
      clearInterval(this.pingTimer);
      if (this.ws === ws) this.ws = null;
      if (!this.token || AppState.currentState !== 'active') return;
      const delay = Math.min(30_000, 1000 * 2 ** this.retry++) * (0.75 + Math.random() * 0.5);
      this.retryTimer = setTimeout(() => this.connect(), delay);
    };
  }

  private disconnect() {
    clearTimeout(this.retryTimer);
    clearInterval(this.pingTimer);
    const ws = this.ws;
    this.ws = null;
    ws?.close();
  }
}

export const realtime = new Realtime();
