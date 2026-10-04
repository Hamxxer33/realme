import { and, eq, or, sql } from 'drizzle-orm';
import type { Context, Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { verify } from 'hono/jwt';
import type { DB } from './db/client';
import { blocks, conversations, members, users } from './db/schema';
import type { Push } from './push';
import type { Hub } from './realtime';
import type { Storage } from './storage';

export type User = typeof users.$inferSelect;
export type Conversation = typeof conversations.$inferSelect;
export type Member = typeof members.$inferSelect;
export type AppEnv = { Variables: { user: User } };
export type App = Hono<AppEnv>;

export interface Ctx {
  db: DB;
  storage: Storage;
  push: Push;
  hub: Hub;
  jwtSecret: string;
  now: () => Date;
  limit: (key: string, max: number, windowMs: number) => boolean;
}

export const HOUR = 60 * 60 * 1000;

export function fail(status: 400 | 401 | 403 | 404 | 409 | 429, message: string): never {
  throw new HTTPException(status, { message });
}

export function rateLimit(ctx: Ctx, key: string, max: number, windowMs: number) {
  if (!ctx.limit(key, max, windowMs)) fail(429, 'Slow down a little — try again later.');
}

export async function userFromToken(ctx: Ctx, token: string): Promise<User | null> {
  try {
    // Expiry is checked against the injected clock rather than Date.now().
    const payload = await verify(token, ctx.jwtSecret, { alg: 'HS256', exp: false, iat: false, nbf: false });
    if (typeof payload.sub !== 'string' || typeof payload.exp !== 'number') return null;
    if (payload.exp * 1000 <= ctx.now().getTime()) return null;
    const [user] = await ctx.db.select().from(users).where(eq(users.id, payload.sub));
    // Suspended accounts are signed out everywhere.
    return user && !user.bannedAt ? user : null;
  } catch {
    return null;
  }
}

export function requireUser(ctx: Ctx) {
  return async (c: Context<AppEnv>, next: () => Promise<void>) => {
    const header = c.req.header('authorization');
    const user = header?.startsWith('Bearer ') ? await userFromToken(ctx, header.slice(7)) : null;
    if (!user) fail(401, 'Not signed in');
    c.set('user', user);
    await next();
  };
}

export const publicUser = (u: Pick<User, 'id' | 'username' | 'displayName' | 'bio' | 'publicKey'>) => ({
  id: u.id,
  username: u.username,
  displayName: u.displayName,
  bio: u.bio,
  publicKey: u.publicKey,
});

/** True if either user has blocked the other. */
export async function blockedBetween(ctx: Ctx, a: string, b: string): Promise<boolean> {
  const [row] = await ctx.db.select({ x: sql`1` }).from(blocks).where(or(
    and(eq(blocks.blockerId, a), eq(blocks.blockedId, b)),
    and(eq(blocks.blockerId, b), eq(blocks.blockedId, a)),
  )).limit(1);
  return Boolean(row);
}

/** SQL fragment: `column` is a user who has a block relation (either way) with `userId`. */
export const blockRelation = (column: unknown, userId: string) => sql`exists (
  select 1 from ${blocks}
  where (${blocks.blockerId} = ${userId} and ${blocks.blockedId} = ${column})
     or (${blocks.blockedId} = ${userId} and ${blocks.blockerId} = ${column})
)`;

/** Loads a conversation and the caller's membership, or 404s (no leaking whether it exists). */
export async function requireMembership(ctx: Ctx, conversationId: string, userId: string) {
  const [row] = await ctx.db.select({ conversation: conversations, member: members })
    .from(members)
    .innerJoin(conversations, eq(conversations.id, members.conversationId))
    .where(and(eq(members.conversationId, conversationId), eq(members.userId, userId)));
  if (!row) fail(404, 'Conversation not found');
  return row;
}

export async function memberIds(ctx: Ctx, conversationId: string): Promise<string[]> {
  const rows = await ctx.db.select({ userId: members.userId }).from(members).where(eq(members.conversationId, conversationId));
  return rows.map((r) => r.userId);
}

export function isUniqueViolation(err: unknown): boolean {
  for (let e: unknown = err; e && typeof e === 'object'; e = (e as { cause?: unknown }).cause) {
    if ((e as { code?: string }).code === '23505') return true;
  }
  return false;
}
