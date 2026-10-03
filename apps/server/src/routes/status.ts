import { zValidator } from '@hono/zod-validator';
import { type SQL, and, asc, desc, eq, gt, inArray, lte, sql } from 'drizzle-orm';
import { z } from 'zod';
import { type App, type Ctx, HOUR, fail, publicUser, rateLimit, requireUser } from '../context';
import { blocks, conversations, members, statusViews, statuses, users } from '../db/schema';
import { MAX_CIPHERTEXT_CHARS, b64, uuid } from '../validation';

export const STATUS_TTL_MS = 24 * HOUR;
const MAX_AUDIENCE = 512;

/**
 * "Contacts" = people I have an accepted 1:1 chat with (both sides accepted),
 * minus anyone with a block either way. Status goes to — and comes from — them.
 */
export function contactsOf(userId: string): SQL {
  return sql`(
    select o.user_id from ${conversations} c
    join ${members} mine on mine.conversation_id = c.id and mine.user_id = ${userId} and mine.status = 'accepted'
    join ${members} o on o.conversation_id = c.id and o.user_id <> ${userId} and o.status = 'accepted'
    where c.kind = 'direct'
      and not exists (select 1 from ${blocks} b
        where (b.blocker_id = ${userId} and b.blocked_id = o.user_id) or (b.blocker_id = o.user_id and b.blocked_id = ${userId}))
  )`;
}

type StatusRow = typeof statuses.$inferSelect;

export const statusMediaPrefix = (authorId: string, clientId: string) => `status/${authorId}/${clientId}/`;

const statusFor = (s: StatusRow, userId: string) => ({
  id: s.id,
  authorId: s.authorId,
  clientId: s.clientId,
  nonce: s.nonce,
  ciphertext: s.ciphertext,
  key: s.keys[userId] ?? null,
  createdAt: s.createdAt,
  expiresAt: s.expiresAt,
});

export function registerStatus(app: App, ctx: Ctx) {
  const { db, hub } = ctx;
  const auth = requireUser(ctx);
  const rows = async <T,>(query: SQL) => ((await db.execute(query)) as unknown as { rows: T[] }).rows;

  /** Expired statuses are removed lazily, with their media (stored under status/<author>/<clientId>/). */
  async function sweep() {
    const expired = await db.delete(statuses).where(lte(statuses.expiresAt, ctx.now()))
      .returning({ authorId: statuses.authorId, clientId: statuses.clientId });
    for (const s of expired) await ctx.storage.deletePrefix(statusMediaPrefix(s.authorId, s.clientId));
  }

  async function audienceIds(userId: string) {
    return (await rows<{ user_id: string }>(contactsOf(userId))).map((r) => r.user_id);
  }

  /** Who my status will be encrypted for. */
  app.get('/status/audience', auth, async (c) => {
    const ids = await audienceIds(c.var.user.id);
    const people = ids.length ? await db.select().from(users).where(inArray(users.id, ids)) : [];
    return c.json({ users: people.map(publicUser) });
  });

  app.post('/status', auth, zValidator('json', z.object({
    clientId: z.string().min(1).max(64),
    nonce: b64(64),
    ciphertext: b64(MAX_CIPHERTEXT_CHARS),
    keys: z.record(uuid, z.object({ nonce: b64(64), key: b64(200) })),
  })), async (c) => {
    const me = c.var.user;
    const body = c.req.valid('json');
    rateLimit(ctx, `status:${me.id}`, 30, HOUR);
    const allowed = new Set([me.id, ...(await audienceIds(me.id))]);
    const recipients = Object.keys(body.keys);
    if (!recipients.includes(me.id)) fail(400, 'Include yourself so you can see your own status');
    if (recipients.length > MAX_AUDIENCE) fail(400, 'Too many recipients');
    if (recipients.some((id) => !allowed.has(id))) fail(409, 'Your contacts changed. Refresh and try again.');
    const [status] = await db.insert(statuses).values({
      authorId: me.id, ...body, expiresAt: new Date(ctx.now().getTime() + STATUS_TTL_MS),
    }).onConflictDoNothing({ target: [statuses.authorId, statuses.clientId] }).returning();
    if (!status) fail(409, 'Already posted');
    hub.send(recipients.filter((id) => id !== me.id), { type: 'status_changed', authorId: me.id });
    return c.json({ status: statusFor(status, me.id) }, 201);
  });

  /** My statuses plus every unexpired status that was encrypted for me, grouped by author. */
  app.get('/status', auth, async (c) => {
    const me = c.var.user;
    await sweep();
    const visible = await db.select({ status: statuses, author: users }).from(statuses)
      .innerJoin(users, eq(users.id, statuses.authorId))
      .where(and(
        gt(statuses.expiresAt, ctx.now()),
        sql`(${statuses.authorId} = ${me.id} or (${statuses.keys} ? ${me.id} and ${statuses.authorId} in ${contactsOf(me.id)}))`,
      ))
      .orderBy(asc(statuses.createdAt));
    const viewed = new Set((await db.select({ id: statusViews.statusId }).from(statusViews)
      .where(eq(statusViews.viewerId, me.id))).map((r) => r.id));
    const viewCounts = new Map((await rows<{ status_id: string; n: number }>(sql`
      select v.status_id, count(*)::int as n from ${statusViews} v
      join ${statuses} s on s.id = v.status_id
      where s.author_id = ${me.id} group by v.status_id`)).map((r) => [r.status_id, r.n]));

    const byAuthor = new Map<string, { author: ReturnType<typeof publicUser>; items: unknown[]; allViewed: boolean; latest: Date }>();
    for (const { status, author } of visible) {
      const group = byAuthor.get(author.id) ?? { author: publicUser(author), items: [], allViewed: true, latest: status.createdAt };
      group.items.push({ ...statusFor(status, me.id), viewed: viewed.has(status.id), viewCount: author.id === me.id ? viewCounts.get(status.id) ?? 0 : undefined });
      if (author.id !== me.id && !viewed.has(status.id)) group.allViewed = false;
      if (status.createdAt > group.latest) group.latest = status.createdAt;
      byAuthor.set(author.id, group);
    }
    const mine = byAuthor.get(me.id) ?? null;
    byAuthor.delete(me.id);
    const others = [...byAuthor.values()].sort((a, b) =>
      Number(a.allViewed) - Number(b.allViewed) || b.latest.getTime() - a.latest.getTime());
    return c.json({ mine, recent: others.filter((g) => !g.allViewed), viewed: others.filter((g) => g.allViewed) });
  });

  async function visibleStatus(id: string, meId: string) {
    const [status] = await db.select().from(statuses).where(and(eq(statuses.id, id), gt(statuses.expiresAt, ctx.now())));
    if (!status) fail(404, 'Status not found');
    if (status.authorId !== meId) {
      const contact = await rows<{ user_id: string }>(sql`select user_id from ${contactsOf(meId)} as x(user_id) where user_id = ${status.authorId}`);
      if (!status.keys[meId] || !contact.length) fail(404, 'Status not found');
    }
    return status;
  }

  app.post('/status/:id/view', auth, zValidator('param', z.object({ id: uuid })), async (c) => {
    const me = c.var.user;
    const status = await visibleStatus(c.req.valid('param').id, me.id);
    if (status.authorId !== me.id) {
      const inserted = await db.insert(statusViews).values({ statusId: status.id, viewerId: me.id }).onConflictDoNothing().returning();
      if (inserted.length) hub.send([status.authorId], { type: 'status_changed', authorId: status.authorId });
    }
    return c.json({ ok: true });
  });

  /** Seen-by list — author only. */
  app.get('/status/:id/views', auth, zValidator('param', z.object({ id: uuid })), async (c) => {
    const me = c.var.user;
    const status = await visibleStatus(c.req.valid('param').id, me.id);
    if (status.authorId !== me.id) fail(404, 'Status not found');
    const viewers = await db.select({ user: users, viewedAt: statusViews.viewedAt }).from(statusViews)
      .innerJoin(users, eq(users.id, statusViews.viewerId))
      .where(eq(statusViews.statusId, status.id))
      .orderBy(desc(statusViews.viewedAt));
    return c.json({ viewers: viewers.map((v) => ({ ...publicUser(v.user), viewedAt: v.viewedAt })) });
  });

  app.delete('/status/:id', auth, zValidator('param', z.object({ id: uuid })), async (c) => {
    const me = c.var.user;
    const [deleted] = await db.delete(statuses)
      .where(and(eq(statuses.id, c.req.valid('param').id), eq(statuses.authorId, me.id))).returning();
    if (!deleted) fail(404, 'Status not found');
    await ctx.storage.deletePrefix(statusMediaPrefix(me.id, deleted.clientId));
    hub.send(Object.keys(deleted.keys).filter((id) => id !== me.id), { type: 'status_changed', authorId: me.id });
    return c.json({ ok: true });
  });

  /** True if `viewerId` may fetch media from `authorId`'s statuses. */
  async function canSeeStatusesOf(viewerId: string, authorId: string) {
    if (viewerId === authorId) return true;
    return (await audienceIds(authorId)).includes(viewerId);
  }

  return { audienceIds, canSeeStatusesOf };
}
