import type { WSContext } from 'hono/ws';

export type ServerEvent =
  | { type: 'message'; conversationId: string; message: unknown }
  | { type: 'read'; conversationId: string; userId: string; lastReadAt: string }
  | { type: 'typing'; conversationId: string; userId: string }
  | { type: 'conversation_changed'; conversationId: string }
  | { type: 'status_changed'; authorId: string }
  | { type: 'channel_post'; channelId: string }
  | { type: 'community_changed'; communityId: string }
  | { type: 'call_ring'; callId: string }
  | { type: 'call_update'; callId: string }
  | { type: 'call_signal'; callId: string; from: string; payload: unknown };

/** Tracks open sockets per user. Single-process; see README for scaling past one instance. */
export class Hub {
  private sockets = new Map<string, Set<WSContext>>();

  add(userId: string, ws: WSContext) {
    let set = this.sockets.get(userId);
    if (!set) this.sockets.set(userId, (set = new Set()));
    set.add(ws);
  }

  remove(userId: string, ws: WSContext) {
    const set = this.sockets.get(userId);
    set?.delete(ws);
    if (set?.size === 0) this.sockets.delete(userId);
  }

  /** Close every socket a user has open (e.g. when their account is suspended). */
  disconnect(userId: string) {
    for (const ws of this.sockets.get(userId) ?? []) {
      try {
        ws.close(4003, 'account suspended');
      } catch {
        // already closing
      }
    }
    this.sockets.delete(userId);
  }

  isOnline(userId: string) {
    return (this.sockets.get(userId)?.size ?? 0) > 0;
  }

  send(userIds: Iterable<string | null | undefined>, event: ServerEvent) {
    const payload = JSON.stringify(event);
    for (const id of userIds) if (id) this.write(id, payload);
  }

  /** Per-recipient payloads, e.g. a message carrying only that member's key. */
  sendEach(userIds: Iterable<string>, build: (userId: string) => ServerEvent) {
    for (const id of userIds) if (this.isOnline(id)) this.write(id, JSON.stringify(build(id)));
  }

  private write(userId: string, payload: string) {
    for (const ws of this.sockets.get(userId) ?? []) {
      try {
        ws.send(payload);
      } catch {
        // Socket is closing; its close handler will clean up.
      }
    }
  }
}
