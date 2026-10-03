import type { WSContext } from 'hono/ws';

export type ServerEvent =
  | { type: 'message'; message: unknown }
  | { type: 'read'; readerId: string; readAt: string; upTo: string }
  | { type: 'typing'; userId: string }
  | { type: 'memory'; memory: unknown }
  | { type: 'memory_deleted'; id: string }
  | { type: 'couple_changed' };

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

  isOnline(userId: string) {
    return (this.sockets.get(userId)?.size ?? 0) > 0;
  }

  send(userIds: Array<string | null | undefined>, event: ServerEvent) {
    const payload = JSON.stringify(event);
    for (const id of userIds) {
      if (!id) continue;
      for (const ws of this.sockets.get(id) ?? []) {
        try {
          ws.send(payload);
        } catch {
          // Socket is closing; its close handler will clean up.
        }
      }
    }
  }
}
