import { zValidator } from '@hono/zod-validator';
import { type SQL, and, desc, eq, ilike, not, or, sql } from 'drizzle-orm';
import { z } from 'zod';
import { type App, type Ctx, HOUR, blockRelation, fail, publicUser, rateLimit, requireUser } from '../context';
import { channelFollowers, channelPosts, channelReactions, channels, users } from '../db/schema';
import { uuid } from '../validation';

const MEDIA_KEY = (userId: string) => new RegExp(`^posts/${userId}/[0-9a-f-]{36}$`);
export const CHANNEL_REACTIONS = ['❤️', '👍', '😂', '😮', '😢', '🙏'] as const;

/**
 * Channels: public one-way broadcasts. The owner posts; anyone can follow,
 * read and react. Like the timeline, channels are not end-to-end encrypted.
 */
export function registerChannels(app: App, ctx: Ctx) {
  const { db, hub } = ctx;
  const auth = requireUser(ctx);

  const channelSelect = (meId: string) => ({
    channel: channels,
    owner: users,
    followerCount: sql<number>`(select count(*)::int from ${channelFollowers} f where f.channel_id = ${channels.id})`,
    following: sql<boolean>`exists (select 1 from ${channelFollowers} f where f.channel_id = ${channels.id} and f.user_id = ${meId})`,
    muted: sql<boolean>`coalesce((select f.muted from ${channelFollowers} f where f.channel_id = ${channels.id} and f.user_id = ${meId}), false)`,
    unreadCount: sql<number>`(select count(*)::int from ${channelPosts} p
      join ${channelFollowers} f on f.channel_id = p.channel_id and f.user_id = ${meId}
      where p.channel_id = ${channels.id} and p.created_at > coalesce(f.last_seen_at, f.created_at))`,
    lastPostText: sql<string | null>`(select p.text from ${channelPosts} p where p.channel_id = ${channels.id} order by p.created_at desc, p.id desc limit 1)`,
    lastPostHasMedia: sql<boolean>`coalesce((select p.media_key is not null from ${channelPosts} p where p.channel_id = ${channels.id} order by p.created_at desc, p.id desc limit 1), false)`,
  });
  type ChannelRow = {
    channel: typeof channels.$inferSelect; owner: typeof users.$inferSelect; followerCount: number; following: boolean;
    muted: boolean; unreadCount: number; lastPostText: string | null; lastPostHasMedia: boolean;
  };
  const channelView = (r: ChannelRow, meId: string) => ({
    id: r.channel.id,
    name: r.channel.name,
    description: r.channel.description,
    owner: publicUser(r.owner),
    isOwner: r.owner.id === meId,
    followerCount: r.followerCount,
    following: r.following,
    muted: r.muted,
    unreadCount: r.following ? r.unreadCount : 0,
    createdAt: r.channel.createdAt,
    lastPostAt: r.channel.lastPostAt,
    lastPost: r.channel.lastPostAt ? { text: r.lastPostText ?? '', hasMedia: r.lastPostHasMedia } : null,
  });

  async function listChannels(meId: string, where: SQL | undefined, orderBy: SQL[], limit = 50) {
    const rows = await db.select(channelSelect(meId)).from(channels)
      .innerJoin(users, eq(users.id, channels.ownerId))
      .where(and(not(blockRelation(channels.ownerId, meId)), where))
      .orderBy(...orderBy)
      .limit(limit);
    return rows.map((r) => channelView(r, meId));
  }

  /** "Seen up to the newest post", in database time and full precision (see chats' read markers). */
  const newestPostAt = (channelId: string) =>
    sql`greatest(now(), coalesce((select max(created_at) from ${channelPosts} where channel_id = ${channelId}), now()))`;

  async function requireChannel(id: string, meId: string) {
    const [channel] = await listChannels(meId, eq(channels.id, id), [], 1);
    if (!channel) fail(404, 'Channel not found');
    return channel;
  }

  async function requireOwned(id: string, meId: string) {
    const [channel] = await db.select().from(channels).where(and(eq(channels.id, id), eq(channels.ownerId, meId)));
    if (!channel) fail(404, 'Channel not found');
    return channel;
  }

  /** Channels I follow or own, most recently active first. */
  app.get('/channels/following', auth, async (c) => {
    const me = c.var.user;
    const mine = sql`(${channels.ownerId} = ${me.id} or exists (select 1 from ${channelFollowers} f where f.channel_id = ${channels.id} and f.user_id = ${me.id}))`;
    return c.json({ channels: await listChannels(me.id, mine, [desc(sql`coalesce(${channels.lastPostAt}, ${channels.createdAt})`)], 200) });
  });

  /** Explore: search by name, or the most-followed channels. */
  app.get('/channels', auth, zValidator('query', z.object({ q: z.string().trim().max(60).default('') })), async (c) => {
    const me = c.var.user;
    const { q } = c.req.valid('query');
    const match = q ? or(ilike(channels.name, `%${q.replace(/[\\%_]/g, '\\$&')}%`), ilike(channels.description, `%${q.replace(/[\\%_]/g, '\\$&')}%`)) : undefined;
    const followers = sql`(select count(*) from ${channelFollowers} f where f.channel_id = ${channels.id})`;
    return c.json({ channels: await listChannels(me.id, match, [desc(followers), desc(channels.createdAt)], 30) });
  });

  app.post('/channels', auth, zValidator('json', z.object({
    name: z.string().trim().min(1).max(60),
    description: z.string().trim().max(512).default(''),
  })), async (c) => {
    const me = c.var.user;
    rateLimit(ctx, `channel:${me.id}`, 5, 24 * HOUR);
    const [channel] = await db.insert(channels).values({ ownerId: me.id, ...c.req.valid('json') }).returning();
    return c.json({ channel: await requireChannel(channel!.id, me.id) }, 201);
  });

  app.get('/channels/:id', auth, zValidator('param', z.object({ id: uuid })), async (c) =>
    c.json({ channel: await requireChannel(c.req.valid('param').id, c.var.user.id) }));

  app.patch('/channels/:id', auth, zValidator('param', z.object({ id: uuid })), zValidator('json', z.object({
    name: z.string().trim().min(1).max(60).optional(),
    description: z.string().trim().max(512).optional(),
  })), async (c) => {
    const me = c.var.user;
    const channel = await requireOwned(c.req.valid('param').id, me.id);
    await db.update(channels).set(c.req.valid('json')).where(eq(channels.id, channel.id));
    return c.json({ channel: await requireChannel(channel.id, me.id) });
  });

  app.delete('/channels/:id', auth, zValidator('param', z.object({ id: uuid })), async (c) => {
    const me = c.var.user;
    const channel = await requireOwned(c.req.valid('param').id, me.id);
    const media = await db.select({ key: channelPosts.mediaKey }).from(channelPosts).where(eq(channelPosts.channelId, channel.id));
    await db.delete(channels).where(eq(channels.id, channel.id));
    for (const m of media) if (m.key) await ctx.storage.deletePrefix(m.key);
    return c.json({ ok: true });
  });

  app.post('/channels/:id/follow', auth, zValidator('param', z.object({ id: uuid })), async (c) => {
    const me = c.var.user;
    const channel = await requireChannel(c.req.valid('param').id, me.id);
    if (channel.isOwner) fail(400, "You can't follow your own channel");
    // Start "seen" now, so following doesn't flood you with unread posts.
    await db.insert(channelFollowers).values({ channelId: channel.id, userId: me.id, lastSeenAt: newestPostAt(channel.id) }).onConflictDoNothing();
    return c.json({ channel: await requireChannel(channel.id, me.id) });
  });

  app.delete('/channels/:id/follow', auth, zValidator('param', z.object({ id: uuid })), async (c) => {
    const me = c.var.user;
    await db.delete(channelFollowers).where(and(eq(channelFollowers.channelId, c.req.valid('param').id), eq(channelFollowers.userId, me.id)));
    return c.json({ ok: true });
  });

  /** My settings for a channel I follow: mute, and "seen up to now". */
  app.patch('/channels/:id/me', auth, zValidator('param', z.object({ id: uuid })),
    zValidator('json', z.object({ muted: z.boolean().optional(), seen: z.literal(true).optional() })), async (c) => {
      const me = c.var.user;
      const { muted, seen } = c.req.valid('json');
      const id = c.req.valid('param').id;
      const set: { muted?: boolean; lastSeenAt?: SQL } = {};
      if (muted !== undefined) set.muted = muted;
      if (seen) set.lastSeenAt = newestPostAt(id);
      if (Object.keys(set).length) {
        await db.update(channelFollowers).set(set).where(and(eq(channelFollowers.channelId, id), eq(channelFollowers.userId, me.id)));
      }
      return c.json({ channel: await requireChannel(id, me.id) });
    });

  // ---------- posts ----------

  const postView = (p: typeof channelPosts.$inferSelect, reactions: Map<string, Record<string, number>>, mine: Map<string, string>) => ({
    id: p.id,
    channelId: p.channelId,
    text: p.text,
    media: p.mediaKey ? { objectKey: p.mediaKey, width: p.mediaWidth, height: p.mediaHeight } : null,
    createdAt: p.createdAt,
    reactions: reactions.get(p.id) ?? {},
    myReaction: mine.get(p.id) ?? null,
  });

  async function reactionsFor(postIds: string[], meId: string) {
    const counts = new Map<string, Record<string, number>>();
    const mine = new Map<string, string>();
    if (!postIds.length) return { counts, mine };
    const rows = await db.select().from(channelReactions)
      .where(sql`${channelReactions.postId} in (${sql.join(postIds.map((id) => sql`${id}`), sql`, `)})`);
    for (const r of rows) {
      const forPost = counts.get(r.postId) ?? {};
      forPost[r.emoji] = (forPost[r.emoji] ?? 0) + 1;
      counts.set(r.postId, forPost);
      if (r.userId === meId) mine.set(r.postId, r.emoji);
    }
    return { counts, mine };
  }

  app.get('/channels/:id/posts', auth, zValidator('param', z.object({ id: uuid })),
    zValidator('query', z.object({ before: uuid.optional(), limit: z.coerce.number().int().min(1).max(50).default(30) })), async (c) => {
      const me = c.var.user;
      const channel = await requireChannel(c.req.valid('param').id, me.id);
      const { before, limit } = c.req.valid('query');
      const cursor = before
        ? sql`(${channelPosts.createdAt}, ${channelPosts.id}) < (select created_at, id from ${channelPosts} where id = ${before} and channel_id = ${channel.id})`
        : undefined;
      const rows = await db.select().from(channelPosts)
        .where(and(eq(channelPosts.channelId, channel.id), cursor))
        .orderBy(desc(channelPosts.createdAt), desc(channelPosts.id))
        .limit(limit + 1);
      const page = rows.slice(0, limit);
      const { counts, mine } = await reactionsFor(page.map((p) => p.id), me.id);
      return c.json({ posts: page.map((p) => postView(p, counts, mine)), hasMore: rows.length > limit });
    });

  app.post('/channels/:id/posts', auth, zValidator('param', z.object({ id: uuid })), zValidator('json', z.object({
    text: z.string().trim().max(2000),
    media: z.object({ objectKey: z.string().max(200), width: z.number().int().positive().max(20000), height: z.number().int().positive().max(20000) }).optional(),
  }).refine((p) => p.text.length > 0 || p.media, 'Write something or add a photo')), async (c) => {
    const me = c.var.user;
    const channel = await requireOwned(c.req.valid('param').id, me.id);
    const { text, media } = c.req.valid('json');
    rateLimit(ctx, `channel-post:${me.id}`, 60, HOUR);
    if (media && !MEDIA_KEY(me.id).test(media.objectKey)) fail(400, 'Invalid photo');
    const [post] = await db.insert(channelPosts).values({
      channelId: channel.id, text, mediaKey: media?.objectKey, mediaWidth: media?.width, mediaHeight: media?.height,
    }).returning();
    await db.update(channels).set({ lastPostAt: post!.createdAt }).where(eq(channels.id, channel.id));

    const followers = await db.select({ userId: channelFollowers.userId, muted: channelFollowers.muted, pushToken: users.pushToken })
      .from(channelFollowers).innerJoin(users, eq(users.id, channelFollowers.userId))
      .where(and(eq(channelFollowers.channelId, channel.id), not(blockRelation(channelFollowers.userId, me.id))));
    hub.send([me.id, ...followers.map((f) => f.userId)], { type: 'channel_post', channelId: channel.id });
    for (const f of followers) {
      if (f.pushToken && !f.muted && !hub.isOnline(f.userId)) void ctx.push.send(f.pushToken, channel.name, text ? text.slice(0, 120) : '📷 Photo');
    }
    return c.json({ post: postView(post!, new Map(), new Map()) }, 201);
  });

  app.delete('/channels/:id/posts/:postId', auth, zValidator('param', z.object({ id: uuid, postId: uuid })), async (c) => {
    const me = c.var.user;
    const channel = await requireOwned(c.req.valid('param').id, me.id);
    const [deleted] = await db.delete(channelPosts)
      .where(and(eq(channelPosts.id, c.req.valid('param').postId), eq(channelPosts.channelId, channel.id))).returning();
    if (!deleted) fail(404, 'Post not found');
    if (deleted.mediaKey) await ctx.storage.deletePrefix(deleted.mediaKey);
    return c.json({ ok: true });
  });

  /** One reaction per person per post; `null` removes it. */
  app.put('/channels/:id/posts/:postId/reaction', auth, zValidator('param', z.object({ id: uuid, postId: uuid })),
    zValidator('json', z.object({ emoji: z.enum(CHANNEL_REACTIONS).nullable() })), async (c) => {
      const me = c.var.user;
      const channel = await requireChannel(c.req.valid('param').id, me.id);
      const [post] = await db.select().from(channelPosts)
        .where(and(eq(channelPosts.id, c.req.valid('param').postId), eq(channelPosts.channelId, channel.id)));
      if (!post) fail(404, 'Post not found');
      const { emoji } = c.req.valid('json');
      if (emoji) {
        await db.insert(channelReactions).values({ postId: post.id, userId: me.id, emoji })
          .onConflictDoUpdate({ target: [channelReactions.postId, channelReactions.userId], set: { emoji } });
      } else {
        await db.delete(channelReactions).where(and(eq(channelReactions.postId, post.id), eq(channelReactions.userId, me.id)));
      }
      const { counts, mine } = await reactionsFor([post.id], me.id);
      return c.json({ post: postView(post, counts, mine) });
    });

  return { requireChannel };
}
