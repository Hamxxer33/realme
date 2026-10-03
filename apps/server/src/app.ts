import { randomInt, randomUUID } from 'node:crypto';
import { hash as argonHash, verify as argonVerify } from '@node-rs/argon2';
import { createNodeWebSocket } from '@hono/node-ws';
import { zValidator } from '@hono/zod-validator';
import { and, desc, eq, gt, isNull, lte, ne, sql } from 'drizzle-orm';
import { Hono, type Context } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { sign, verify } from 'hono/jwt';
import type { WSContext } from 'hono/ws';
import { z } from 'zod';
import type { DB } from './db/client';
import { couples, memories, messages, users } from './db/schema';
import type { Push } from './push';
import { Hub } from './realtime';
import type { Storage } from './storage';

export interface Deps {
  db: DB;
  storage: Storage;
  push: Push;
  jwtSecret: string;
  now?: () => Date;
  /** Middleware to install ahead of every route (e.g. CORS). */
  beforeRoutes?: (app: Hono<AppEnv>) => void;
}

type User = typeof users.$inferSelect;
type Couple = typeof couples.$inferSelect;
type AppEnv = { Variables: { user: User } };

const TOKEN_TTL_SECONDS = 60 * 60 * 24 * 30;
const INVITE_TTL_MS = 24 * 60 * 60 * 1000;
const INVITE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/1/I
const MAX_MEDIA_BYTES = 25 * 1024 * 1024;
const MAX_CIPHERTEXT_CHARS = 64 * 1024;
const WS_AUTH_TIMEOUT_MS = 10_000;

const b64 = (max: number) => z.string().min(1).max(max).regex(/^[A-Za-z0-9_-]+$/, 'must be base64url');
const sealed = z.object({ nonce: b64(64), ciphertext: b64(MAX_CIPHERTEXT_CHARS) });
const email = z.string().trim().toLowerCase().email().max(254);

export function createApp(deps: Deps) {
  const { db, storage, push, jwtSecret } = deps;
  const now = deps.now ?? (() => new Date());
  const hub = new Hub();
  const app = new Hono<AppEnv>();
  const { upgradeWebSocket, injectWebSocket } = createNodeWebSocket({ app });
  const limiter = rateLimiter(10, 15 * 60 * 1000, now);
  deps.beforeRoutes?.(app);

  app.onError((err, c) => {
    if (err instanceof HTTPException) return c.json({ error: err.message }, err.status);
    console.error(err);
    return c.json({ error: 'Internal error' }, 500);
  });

  // ---------- helpers ----------

  const issueToken = (userId: string) => {
    const iat = Math.floor(now().getTime() / 1000);
    return sign({ sub: userId, iat, exp: iat + TOKEN_TTL_SECONDS }, jwtSecret, 'HS256');
  };

  async function userFromToken(token: string): Promise<User | null> {
    try {
      // Expiry is checked against the injected clock rather than Date.now().
      const payload = await verify(token, jwtSecret, { alg: 'HS256', exp: false, iat: false, nbf: false });
      if (typeof payload.sub !== 'string' || typeof payload.exp !== 'number') return null;
      if (payload.exp * 1000 <= now().getTime()) return null;
      const [user] = await db.select().from(users).where(eq(users.id, payload.sub));
      return user ?? null;
    } catch {
      return null;
    }
  }

  const requireUser = async (c: Context<AppEnv>, next: () => Promise<void>) => {
    const header = c.req.header('authorization');
    const user = header?.startsWith('Bearer ') ? await userFromToken(header.slice(7)) : null;
    if (!user) throw new HTTPException(401, { message: 'Not signed in' });
    c.set('user', user);
    await next();
  };

  const partnerOf = (couple: Couple, userId: string) =>
    couple.inviterId === userId ? couple.partnerId : couple.inviterId;

  async function loadCouple(user: User): Promise<Couple | null> {
    if (!user.coupleId) return null;
    const [couple] = await db.select().from(couples).where(eq(couples.id, user.coupleId));
    return couple ?? null;
  }

  async function requirePaired(user: User) {
    const couple = await loadCouple(user);
    const partnerId = couple && partnerOf(couple, user.id);
    if (!couple || !partnerId) throw new HTTPException(409, { message: 'Pair with your partner first' });
    return { couple, partnerId };
  }

  const publicUser = (u: User) => ({ id: u.id, email: u.email, displayName: u.displayName, publicKey: u.publicKey });

  // ---------- auth ----------

  app.post(
    '/auth/signup',
    zValidator('json', z.object({
      email,
      displayName: z.string().trim().min(1).max(40),
      authSecret: b64(128),
      publicKey: b64(64),
      keyBackup: sealed,
    })),
    async (c) => {
      const body = c.req.valid('json');
      const [existing] = await db.select({ id: users.id }).from(users).where(sql`lower(${users.email}) = ${body.email}`);
      if (existing) throw new HTTPException(409, { message: 'An account with this email already exists' });
      const [user] = await db.insert(users).values({
        email: body.email,
        displayName: body.displayName,
        authHash: await argonHash(body.authSecret),
        publicKey: body.publicKey,
        keyBackupNonce: body.keyBackup.nonce,
        keyBackupCiphertext: body.keyBackup.ciphertext,
      }).returning().catch((err) => {
        // Lost a race with a concurrent signup for the same email.
        if (isUniqueViolation(err)) throw new HTTPException(409, { message: 'An account with this email already exists' });
        throw err;
      });
      return c.json({ token: await issueToken(user!.id), user: publicUser(user!) }, 201);
    },
  );

  app.post(
    '/auth/login',
    zValidator('json', z.object({ email, authSecret: b64(128) })),
    async (c) => {
      const { email: addr, authSecret } = c.req.valid('json');
      const ip = c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ?? 'local';
      if (!limiter.allow(`login:${addr}`) || !limiter.allow(`login-ip:${ip}`)) {
        throw new HTTPException(429, { message: 'Too many attempts. Try again in a few minutes.' });
      }
      const [user] = await db.select().from(users).where(sql`lower(${users.email}) = ${addr}`);
      if (!user || !(await argonVerify(user.authHash, authSecret))) {
        throw new HTTPException(401, { message: 'Wrong email or password' });
      }
      return c.json({
        token: await issueToken(user.id),
        user: publicUser(user),
        keyBackup: { nonce: user.keyBackupNonce, ciphertext: user.keyBackupCiphertext },
      });
    },
  );

  // ---------- me ----------

  app.get('/me', requireUser, async (c) => {
    const user = c.var.user;
    const couple = await loadCouple(user);
    let coupleView = null;
    if (couple) {
      const partnerId = partnerOf(couple, user.id);
      const [partner] = partnerId ? await db.select().from(users).where(eq(users.id, partnerId)) : [];
      coupleView = {
        id: couple.id,
        paired: Boolean(partner),
        pairedAt: couple.pairedAt,
        inviteCode: partner ? null : couple.inviteCode,
        inviteExpiresAt: partner ? null : couple.inviteExpiresAt,
        settings: couple.settingsCiphertext
          ? { nonce: couple.settingsNonce, ciphertext: couple.settingsCiphertext, updatedBy: couple.settingsUpdatedBy }
          : null,
        partner: partner
          ? { id: partner.id, displayName: partner.displayName, publicKey: partner.publicKey, online: hub.isOnline(partner.id) }
          : null,
      };
    }
    return c.json({ user: publicUser(user), couple: coupleView });
  });

  app.put('/me/push-token', requireUser, zValidator('json', z.object({ token: z.string().max(200).nullable() })), async (c) => {
    await db.update(users).set({ pushToken: c.req.valid('json').token }).where(eq(users.id, c.var.user.id));
    return c.json({ ok: true });
  });

  app.delete('/me', requireUser, async (c) => {
    const user = c.var.user;
    const couple = await loadCouple(user);
    if (couple) {
      await storage.deletePrefix(`couples/${couple.id}/`);
      hub.send([partnerOf(couple, user.id)], { type: 'couple_changed' });
    }
    await db.delete(users).where(eq(users.id, user.id)); // cascades to the couple and everything in it
    return c.json({ ok: true });
  });

  // ---------- pairing ----------

  const newInviteCode = () => Array.from({ length: 6 }, () => INVITE_ALPHABET[randomInt(INVITE_ALPHABET.length)]).join('');

  app.post('/couple/invite', requireUser, async (c) => {
    const user = c.var.user;
    const inviteExpiresAt = new Date(now().getTime() + INVITE_TTL_MS);
    const existing = await loadCouple(user);
    if (existing) {
      if (existing.partnerId || existing.inviterId !== user.id) {
        throw new HTTPException(409, { message: 'You are already paired' });
      }
      const [updated] = await db.update(couples)
        .set({ inviteCode: newInviteCode(), inviteExpiresAt })
        .where(eq(couples.id, existing.id)).returning();
      return c.json({ inviteCode: updated!.inviteCode, inviteExpiresAt: updated!.inviteExpiresAt });
    }
    const created = await db.transaction(async (tx) => {
      const [couple] = await tx.insert(couples)
        .values({ inviterId: user.id, inviteCode: newInviteCode(), inviteExpiresAt }).returning();
      const claimed = await tx.update(users).set({ coupleId: couple!.id })
        .where(and(eq(users.id, user.id), isNull(users.coupleId))).returning({ id: users.id });
      if (!claimed.length) throw new HTTPException(409, { message: 'You are already paired' });
      return couple!;
    });
    return c.json({ inviteCode: created.inviteCode, inviteExpiresAt: created.inviteExpiresAt }, 201);
  });

  app.post('/couple/join', requireUser, zValidator('json', z.object({ code: z.string().trim().toUpperCase().length(6) })), async (c) => {
    const user = c.var.user;
    const { code } = c.req.valid('json');
    if (user.coupleId) throw new HTTPException(409, { message: 'Leave your current pairing first' });
    const couple = await db.transaction(async (tx) => {
      const [joined] = await tx.update(couples)
        .set({ partnerId: user.id, inviteCode: null, inviteExpiresAt: null, pairedAt: now() })
        .where(and(
          eq(couples.inviteCode, code),
          isNull(couples.partnerId),
          ne(couples.inviterId, user.id),
          gt(couples.inviteExpiresAt, now()),
        )).returning();
      if (!joined) throw new HTTPException(404, { message: 'That code is invalid or has expired' });
      const claimed = await tx.update(users).set({ coupleId: joined.id })
        .where(and(eq(users.id, user.id), isNull(users.coupleId))).returning({ id: users.id });
      if (!claimed.length) throw new HTTPException(409, { message: 'Leave your current pairing first' });
      return joined;
    });
    hub.send([couple.inviterId], { type: 'couple_changed' });
    return c.json({ coupleId: couple.id });
  });

  app.put('/couple/settings', requireUser, zValidator('json', sealed), async (c) => {
    const user = c.var.user;
    const { couple, partnerId } = await requirePaired(user);
    const { nonce, ciphertext } = c.req.valid('json');
    await db.update(couples)
      .set({ settingsNonce: nonce, settingsCiphertext: ciphertext, settingsUpdatedBy: user.id })
      .where(eq(couples.id, couple.id));
    hub.send([user.id, partnerId], { type: 'couple_changed' });
    return c.json({ ok: true });
  });

  /** Unpair. Deletes the shared history for both partners, including media. */
  app.delete('/couple', requireUser, async (c) => {
    const user = c.var.user;
    const couple = await loadCouple(user);
    if (!couple) return c.json({ ok: true });
    await storage.deletePrefix(`couples/${couple.id}/`);
    await db.delete(couples).where(eq(couples.id, couple.id));
    hub.send([user.id, partnerOf(couple, user.id)], { type: 'couple_changed' });
    return c.json({ ok: true });
  });

  // ---------- messages ----------

  app.get(
    '/messages',
    requireUser,
    zValidator('query', z.object({ before: z.string().uuid().optional(), limit: z.coerce.number().int().min(1).max(100).default(50) })),
    async (c) => {
      const { couple } = await requirePaired(c.var.user);
      const { before, limit } = c.req.valid('query');
      let cursor = undefined;
      if (before) {
        const [anchor] = await db.select({ id: messages.id }).from(messages)
          .where(and(eq(messages.id, before), eq(messages.coupleId, couple.id)));
        if (!anchor) throw new HTTPException(404, { message: 'Unknown cursor' });
        // Compare inside Postgres: a JS Date would truncate microseconds and skip
        // messages created within the same millisecond.
        cursor = sql`(${messages.createdAt}, ${messages.id}) < (select created_at, id from messages where id = ${anchor.id})`;
      }
      const rows = await db.select().from(messages)
        .where(and(eq(messages.coupleId, couple.id), cursor))
        .orderBy(desc(messages.createdAt), desc(messages.id))
        .limit(limit + 1);
      return c.json({ messages: rows.slice(0, limit), hasMore: rows.length > limit });
    },
  );

  app.post('/messages', requireUser, zValidator('json', sealed.extend({ clientId: z.string().min(1).max(64) })), async (c) => {
    const user = c.var.user;
    const { couple, partnerId } = await requirePaired(user);
    const body = c.req.valid('json');
    const [inserted] = await db.insert(messages)
      .values({ coupleId: couple.id, senderId: user.id, ...body })
      .onConflictDoNothing({ target: [messages.senderId, messages.clientId] })
      .returning();
    if (!inserted) {
      // A retry of a message we already have.
      const [existing] = await db.select().from(messages)
        .where(and(eq(messages.senderId, user.id), eq(messages.clientId, body.clientId)));
      return c.json({ message: existing });
    }
    hub.send([user.id, partnerId], { type: 'message', message: inserted });
    if (!hub.isOnline(partnerId)) {
      const [partner] = await db.select({ pushToken: users.pushToken }).from(users).where(eq(users.id, partnerId));
      if (partner?.pushToken) void push.send(partner.pushToken, user.displayName, 'sent you something 💌');
    }
    return c.json({ message: inserted }, 201);
  });

  app.post('/messages/read', requireUser, zValidator('json', z.object({ upTo: z.string().uuid() })), async (c) => {
    const user = c.var.user;
    const { couple, partnerId } = await requirePaired(user);
    const { upTo } = c.req.valid('json');
    const [anchor] = await db.select({ id: messages.id }).from(messages)
      .where(and(eq(messages.id, upTo), eq(messages.coupleId, couple.id)));
    if (!anchor) throw new HTTPException(404, { message: 'Unknown message' });
    const readAt = now();
    await db.update(messages).set({ readAt })
      .where(and(
        eq(messages.coupleId, couple.id),
        ne(messages.senderId, user.id),
        isNull(messages.readAt),
        // Same reason as paging: keep the anchor's full-precision timestamp in SQL.
        lte(messages.createdAt, sql`(select created_at from messages where id = ${anchor.id})`),
      ));
    hub.send([user.id, partnerId], { type: 'read', readerId: user.id, readAt: readAt.toISOString(), upTo });
    return c.json({ ok: true });
  });

  // ---------- memories ----------

  app.get('/memories', requireUser, async (c) => {
    const { couple } = await requirePaired(c.var.user);
    const rows = await db.select().from(memories).where(eq(memories.coupleId, couple.id)).orderBy(desc(memories.createdAt));
    return c.json({ memories: rows });
  });

  app.post('/memories', requireUser, zValidator('json', sealed), async (c) => {
    const user = c.var.user;
    const { couple, partnerId } = await requirePaired(user);
    const [memory] = await db.insert(memories)
      .values({ coupleId: couple.id, authorId: user.id, ...c.req.valid('json') }).returning();
    hub.send([user.id, partnerId], { type: 'memory', memory });
    return c.json({ memory }, 201);
  });

  app.delete('/memories/:id', requireUser, zValidator('param', z.object({ id: z.string().uuid() })), async (c) => {
    const user = c.var.user;
    const { couple, partnerId } = await requirePaired(user);
    const { id } = c.req.valid('param');
    const deleted = await db.delete(memories)
      .where(and(eq(memories.id, id), eq(memories.coupleId, couple.id))).returning({ id: memories.id });
    if (!deleted.length) throw new HTTPException(404, { message: 'Memory not found' });
    hub.send([user.id, partnerId], { type: 'memory_deleted', id });
    return c.json({ ok: true });
  });

  // ---------- media ----------

  app.post('/media/upload-url', requireUser, zValidator('json', z.object({ size: z.number().int().min(1).max(MAX_MEDIA_BYTES) })), async (c) => {
    const { couple } = await requirePaired(c.var.user);
    const objectKey = `couples/${couple.id}/${randomUUID()}`;
    return c.json({ objectKey, url: await storage.presignUpload(objectKey, c.req.valid('json').size) });
  });

  app.post('/media/download-url', requireUser, zValidator('json', z.object({ objectKey: z.string().max(200) })), async (c) => {
    const { couple } = await requirePaired(c.var.user);
    const { objectKey } = c.req.valid('json');
    const own = new RegExp(`^couples/${couple.id}/[0-9a-f-]{36}$`);
    if (!own.test(objectKey)) throw new HTTPException(404, { message: 'Not found' });
    return c.json({ url: await storage.presignDownload(objectKey) });
  });

  // ---------- realtime ----------

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
        let msg: { type?: string; token?: string };
        try {
          msg = JSON.parse(String(evt.data));
        } catch {
          return;
        }
        if (!userId) {
          const user = msg.type === 'auth' && msg.token ? await userFromToken(msg.token) : null;
          if (!user) return ws.close(4001, 'unauthorized');
          clearTimeout(timer);
          userId = user.id;
          hub.add(userId, ws);
          ws.send(JSON.stringify({ type: 'ready' }));
          return;
        }
        if (msg.type === 'typing') {
          const [user] = await db.select().from(users).where(eq(users.id, userId));
          const couple = user && (await loadCouple(user));
          if (couple) hub.send([partnerOf(couple, userId)], { type: 'typing', userId });
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

function isUniqueViolation(err: unknown): boolean {
  for (let e: unknown = err; e && typeof e === 'object'; e = (e as { cause?: unknown }).cause) {
    if ((e as { code?: string }).code === '23505') return true;
  }
  return false;
}

/** Fixed-window in-memory limiter; enough for a single instance. */
function rateLimiter(max: number, windowMs: number, now: () => Date) {
  const hits = new Map<string, { count: number; resetAt: number }>();
  return {
    allow(key: string) {
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
    },
  };
}
