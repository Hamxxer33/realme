import { zValidator } from '@hono/zod-validator';
import { and, desc, eq } from 'drizzle-orm';
import { z } from 'zod';
import { type App, type Ctx, HOUR, fail, publicUser, rateLimit, requireMembership, requireUser } from '../context';
import { blocks, channelPosts, channels, comments, conversations, posts, reports, users } from '../db/schema';
import { uuid } from '../validation';

export function registerSafety(app: App, ctx: Ctx) {
  const { db } = ctx;
  const auth = requireUser(ctx);

  app.get('/blocks', auth, async (c) => {
    const rows = await db.select({ user: users }).from(blocks).innerJoin(users, eq(users.id, blocks.blockedId))
      .where(eq(blocks.blockerId, c.var.user.id)).orderBy(desc(blocks.createdAt));
    return c.json({ users: rows.map((r) => publicUser(r.user)) });
  });

  /**
   * Blocking hides each person from the other: no new chats or group adds, no
   * messages in your direct chat, and neither sees the other's posts or comments.
   */
  app.post('/blocks', auth, zValidator('json', z.object({ userId: uuid })), async (c) => {
    const me = c.var.user;
    const { userId } = c.req.valid('json');
    if (userId === me.id) fail(400, "You can't block yourself");
    const [target] = await db.select({ id: users.id }).from(users).where(eq(users.id, userId));
    if (!target) fail(404, 'User not found');
    await db.insert(blocks).values({ blockerId: me.id, blockedId: userId }).onConflictDoNothing();
    // Let my phone drop the direct chat from its list.
    const [direct] = await db.select({ id: conversations.id }).from(conversations)
      .where(eq(conversations.directKey, [me.id, userId].sort().join(':')));
    if (direct) ctx.hub.send([me.id], { type: 'conversation_changed', conversationId: direct.id });
    return c.json({ ok: true });
  });

  app.delete('/blocks/:userId', auth, zValidator('param', z.object({ userId: uuid })), async (c) => {
    await db.delete(blocks).where(and(eq(blocks.blockerId, c.var.user.id), eq(blocks.blockedId, c.req.valid('param').userId)));
    return c.json({ ok: true });
  });

  app.post('/reports', auth, zValidator('json', z.object({
    reason: z.enum(['spam', 'harassment', 'inappropriate', 'impersonation', 'underage', 'other']),
    details: z.string().trim().max(2000).default(''),
    userId: uuid.optional(),
    postId: uuid.optional(),
    commentId: uuid.optional(),
    conversationId: uuid.optional(),
    channelId: uuid.optional(),
    channelPostId: uuid.optional(),
  }).refine((r) => r.userId || r.postId || r.commentId || r.conversationId || r.channelId || r.channelPostId, 'Say what you are reporting')), async (c) => {
    const me = c.var.user;
    const body = c.req.valid('json');
    rateLimit(ctx, `report:${me.id}`, 20, HOUR);
    // You can only report a conversation you're in.
    if (body.conversationId) await requireMembership(ctx, body.conversationId, me.id);
    if (body.postId && !(await db.select({ id: posts.id }).from(posts).where(eq(posts.id, body.postId)))[0]) fail(404, 'Post not found');
    if (body.commentId && !(await db.select({ id: comments.id }).from(comments).where(eq(comments.id, body.commentId)))[0]) fail(404, 'Comment not found');
    if (body.channelId && !(await db.select({ id: channels.id }).from(channels).where(eq(channels.id, body.channelId)))[0]) fail(404, 'Channel not found');
    if (body.channelPostId && !(await db.select({ id: channelPosts.id }).from(channelPosts).where(eq(channelPosts.id, body.channelPostId)))[0]) fail(404, 'Post not found');
    if (body.userId && !(await db.select({ id: users.id }).from(users).where(eq(users.id, body.userId)))[0]) fail(404, 'User not found');
    await db.insert(reports).values({
      reporterId: me.id,
      reason: body.reason,
      details: body.details,
      targetUserId: body.userId,
      postId: body.postId,
      commentId: body.commentId,
      conversationId: body.conversationId,
      channelId: body.channelId,
      channelPostId: body.channelPostId,
    });
    return c.json({ ok: true }, 201);
  });

}
