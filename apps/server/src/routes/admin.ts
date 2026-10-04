import { timingSafeEqual } from 'node:crypto';
import { zValidator } from '@hono/zod-validator';
import { and, desc, eq, isNotNull, isNull } from 'drizzle-orm';
import type { MiddlewareHandler } from 'hono';
import { z } from 'zod';
import { type App, type AppEnv, type Ctx, fail, publicUser } from '../context';
import { channelPosts, channels, comments, conversations, posts, reports, users } from '../db/schema';
import { uuid } from '../validation';

/**
 * Moderation API for whoever runs the service. Disabled unless ADMIN_TOKEN is
 * set; every call needs `Authorization: Bearer <ADMIN_TOKEN>`. Chats are
 * end-to-end encrypted, so moderators act on what reporters share, on public
 * content (timeline, channels, profiles), and on accounts.
 */
export function registerAdmin(app: App, ctx: Ctx, adminToken: string | undefined) {
  const { db, hub } = ctx;

  const admin: MiddlewareHandler<AppEnv> = async (c, next) => {
    const given = Buffer.from(c.req.header('authorization')?.replace(/^Bearer /, '') ?? '');
    const want = Buffer.from(adminToken ?? '');
    // Without a token configured the API doesn't exist.
    if (!adminToken || given.length !== want.length || !timingSafeEqual(given, want)) fail(404, 'Not found');
    await next();
  };

  /** Open reports (or all, with ?all=1), newest first, with what was reported. */
  app.get('/admin/reports', admin, zValidator('query', z.object({ all: z.enum(['0', '1']).default('0') })), async (c) => {
    const rows = await db.select().from(reports)
      .where(c.req.valid('query').all === '1' ? undefined : isNull(reports.resolvedAt))
      .orderBy(desc(reports.createdAt)).limit(200);
    const out = [];
    for (const r of rows) {
      const [reporter] = r.reporterId ? await db.select().from(users).where(eq(users.id, r.reporterId)) : [];
      const [target] = r.targetUserId ? await db.select().from(users).where(eq(users.id, r.targetUserId)) : [];
      const [post] = r.postId ? await db.select().from(posts).where(eq(posts.id, r.postId)) : [];
      const [comment] = r.commentId ? await db.select().from(comments).where(eq(comments.id, r.commentId)) : [];
      const [channel] = r.channelId ? await db.select().from(channels).where(eq(channels.id, r.channelId)) : [];
      const [channelPost] = r.channelPostId ? await db.select().from(channelPosts).where(eq(channelPosts.id, r.channelPostId)) : [];
      const [conversation] = r.conversationId ? await db.select().from(conversations).where(eq(conversations.id, r.conversationId)) : [];
      out.push({
        id: r.id,
        reason: r.reason,
        details: r.details,
        createdAt: r.createdAt,
        resolvedAt: r.resolvedAt,
        resolution: r.resolution,
        reporter: reporter ? publicUser(reporter) : null,
        targetUser: target ? { ...publicUser(target), bannedAt: target.bannedAt } : null,
        post: post ? { id: post.id, authorId: post.authorId, text: post.text, mediaKey: post.mediaKey } : null,
        comment: comment ? { id: comment.id, authorId: comment.authorId, text: comment.text } : null,
        channel: channel ? { id: channel.id, ownerId: channel.ownerId, name: channel.name, description: channel.description } : null,
        channelPost: channelPost ? { id: channelPost.id, channelId: channelPost.channelId, text: channelPost.text, mediaKey: channelPost.mediaKey } : null,
        conversation: conversation ? { id: conversation.id, kind: conversation.kind, title: conversation.title } : null,
      });
    }
    return c.json({ reports: out });
  });

  app.post('/admin/reports/:id/resolve', admin, zValidator('param', z.object({ id: uuid })),
    zValidator('json', z.object({ resolution: z.enum(['dismissed', 'content_removed', 'user_banned', 'warned', 'escalated']) })), async (c) => {
      const [r] = await db.update(reports).set({ resolvedAt: ctx.now(), resolution: c.req.valid('json').resolution })
        .where(eq(reports.id, c.req.valid('param').id)).returning();
      if (!r) fail(404, 'Report not found');
      return c.json({ ok: true });
    });

  /** Suspend an account: signed out everywhere, can't sign in, hidden from search and profiles. */
  app.post('/admin/users/:id/ban', admin, zValidator('param', z.object({ id: uuid })), async (c) => {
    const [user] = await db.update(users).set({ bannedAt: ctx.now(), pushToken: null })
      .where(and(eq(users.id, c.req.valid('param').id), isNull(users.bannedAt))).returning();
    if (!user) fail(404, 'User not found or already suspended');
    hub.disconnect(user.id);
    return c.json({ ok: true });
  });

  app.delete('/admin/users/:id/ban', admin, zValidator('param', z.object({ id: uuid })), async (c) => {
    const [user] = await db.update(users).set({ bannedAt: null })
      .where(and(eq(users.id, c.req.valid('param').id), isNotNull(users.bannedAt))).returning();
    if (!user) fail(404, 'User not found or not suspended');
    return c.json({ ok: true });
  });

  // Remove public content (and its photo).
  app.delete('/admin/posts/:id', admin, zValidator('param', z.object({ id: uuid })), async (c) => {
    const [gone] = await db.delete(posts).where(eq(posts.id, c.req.valid('param').id)).returning();
    if (!gone) fail(404, 'Post not found');
    if (gone.mediaKey) await ctx.storage.deletePrefix(gone.mediaKey);
    return c.json({ ok: true });
  });

  app.delete('/admin/comments/:id', admin, zValidator('param', z.object({ id: uuid })), async (c) => {
    const [gone] = await db.delete(comments).where(eq(comments.id, c.req.valid('param').id)).returning();
    if (!gone) fail(404, 'Comment not found');
    return c.json({ ok: true });
  });

  app.delete('/admin/channel-posts/:id', admin, zValidator('param', z.object({ id: uuid })), async (c) => {
    const [gone] = await db.delete(channelPosts).where(eq(channelPosts.id, c.req.valid('param').id)).returning();
    if (!gone) fail(404, 'Post not found');
    if (gone.mediaKey) await ctx.storage.deletePrefix(gone.mediaKey);
    return c.json({ ok: true });
  });

  app.delete('/admin/channels/:id', admin, zValidator('param', z.object({ id: uuid })), async (c) => {
    const id = c.req.valid('param').id;
    const media = await db.select({ key: channelPosts.mediaKey }).from(channelPosts).where(eq(channelPosts.channelId, id));
    const [gone] = await db.delete(channels).where(eq(channels.id, id)).returning();
    if (!gone) fail(404, 'Channel not found');
    for (const m of media) if (m.key) await ctx.storage.deletePrefix(m.key);
    return c.json({ ok: true });
  });
}
