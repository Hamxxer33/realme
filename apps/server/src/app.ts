import { createNodeWebSocket } from '@hono/node-ws';
import { eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import type { WSContext } from 'hono/ws';
import { type AppEnv, type Ctx, userFromToken } from './context';
import type { DB } from './db/client';
import { members } from './db/schema';
import type { Push } from './push';
import { Hub } from './realtime';
import { registerAccounts } from './routes/accounts';
import { type IceConfig, registerCalls } from './routes/calls';
import { registerChannels } from './routes/channels';
import { registerChats } from './routes/chats';
import { registerCommunities } from './routes/communities';
import { registerMedia } from './routes/media';
import { registerSafety } from './routes/safety';
import { registerStatus } from './routes/status';
import { registerTimeline } from './routes/timeline';
import type { Storage } from './storage';

export interface Deps {
  db: DB;
  storage: Storage;
  push: Push;
  jwtSecret: string;
  now?: () => Date;
  /** STUN/TURN servers handed to phones for calls. */
  ice?: IceConfig;
  /** Middleware to install ahead of every route (e.g. CORS). */
  beforeRoutes?: (app: Hono<AppEnv>) => void;
}

const WS_AUTH_TIMEOUT_MS = 10_000;

export function createApp(deps: Deps) {
  const now = deps.now ?? (() => new Date());
  const hub = new Hub();
  const app = new Hono<AppEnv>();
  const { upgradeWebSocket, injectWebSocket } = createNodeWebSocket({ app });
  const ctx: Ctx = { db: deps.db, storage: deps.storage, push: deps.push, jwtSecret: deps.jwtSecret, hub, now, limit: rateLimiter(now) };

  app.onError((err, c) => {
    if (err instanceof HTTPException) return c.json({ error: err.message }, err.status);
    console.error(err);
    return c.json({ error: 'Internal error' }, 500);
  });
  deps.beforeRoutes?.(app);

  registerAccounts(app, ctx);
  const chats = registerChats(app, ctx);
  registerCommunities(app, ctx, chats);
  registerChannels(app, ctx);
  registerTimeline(app, ctx);
  registerSafety(app, ctx);
  const status = registerStatus(app, ctx);
  registerMedia(app, ctx, status);
  const callSignals = registerCalls(app, ctx, deps.ice);

  // The token is sent as the first frame rather than in the URL so it never lands in access logs.
  app.get('/ws', upgradeWebSocket(() => {
    let userId: string | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;
    return {
      onOpen(_evt, ws) {
        timer = setTimeout(() => {
          if (!userId) ws.close(4001, 'auth timeout');
        }, WS_AUTH_TIMEOUT_MS);
      },
      async onMessage(evt, ws: WSContext) {
        let msg: { type?: string; token?: string; conversationId?: string; callId?: unknown; payload?: unknown };
        try {
          msg = JSON.parse(String(evt.data));
        } catch {
          return;
        }
        if (!userId) {
          const user = msg.type === 'auth' && msg.token ? await userFromToken(ctx, msg.token) : null;
          if (!user) return ws.close(4001, 'unauthorized');
          clearTimeout(timer);
          userId = user.id;
          hub.add(userId, ws);
          ws.send(JSON.stringify({ type: 'ready' }));
          return;
        }
        if (msg.type === 'typing' && typeof msg.conversationId === 'string') {
          const rows = await deps.db.select({ userId: members.userId, status: members.status }).from(members)
            .where(eq(members.conversationId, msg.conversationId));
          if (!rows.some((r) => r.userId === userId)) return;
          // Only people who accepted the chat see typing.
          hub.send(rows.filter((r) => r.userId !== userId && r.status === 'accepted').map((r) => r.userId), {
            type: 'typing', conversationId: msg.conversationId, userId,
          });
        } else if (msg.type === 'call_signal') {
          await callSignals.relaySignal(userId, msg);
        } else if (msg.type === 'ping') {
          ws.send(JSON.stringify({ type: 'pong' }));
        }
      },
      onClose(_evt, ws) {
        clearTimeout(timer);
        if (userId) hub.remove(userId, ws);
      },
    };
  }));

  app.get('/health', (c) => c.json({ ok: true }));

  return { app, hub, injectWebSocket };
}

/** Fixed-window in-memory limiter; enough for a single instance. */
function rateLimiter(now: () => Date) {
  const hits = new Map<string, { count: number; resetAt: number }>();
  return (key: string, max: number, windowMs: number) => {
    const t = now().getTime();
    const entry = hits.get(key);
    if (!entry || entry.resetAt <= t) {
      hits.set(key, { count: 1, resetAt: t + windowMs });
      if (hits.size > 10_000) {
        for (const [k, v] of hits) if (v.resetAt <= t) hits.delete(k);
      }
      return true;
    }
    entry.count += 1;
    return entry.count <= max;
  };
}

