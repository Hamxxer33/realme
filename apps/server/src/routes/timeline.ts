import { zValidator } from '@hono/zod-validator';
import { and, asc, desc, eq, not, sql } from 'drizzle-orm';
import { z } from 'zod';
import { type App, type Ctx, HOUR, blockRelation, fail, publicUser, rateLimit, requireUser } from '../context';
import { comments, likes, posts, users } from '../db/schema';
import { uuid } from '../validation';
import { username } from './accounts';

const POST_MEDIA_KEY = (userId: string) => new RegExp(`^posts/${userId}/[0-9a-f-]{36}$`);

export function registerTimeline(app: App, ctx: Ctx) {
  const { db } = ctx;
  const auth = requireUser(ctx);

  const postSelect = (meId: string) => ({
    post: posts,
    author: users,
    likeCount: sql<number>`(select count(*)::int from ${likes} where ${likes.postId} = ${posts.id})`,
    commentCount: sql<number>`(select count(*)::int from ${comments} where ${comments.postId} = ${posts.id}
      and not ${blockRelation(comments.authorId, meId)})`,
    likedByMe: sql<boolean>`exists (select 1 from ${likes} where ${likes.postId} = ${posts.id} and ${likes.userId} = ${meId})`,
  });

  type Row = { post: typeof posts.$inferSelect; author: typeof users.$inferSelect; likeCount: number; commentCount: number; likedByMe: boolean };
  const view = (r: Row) => ({
    id: r.post.id,
    text: r.post.text,
    media: r.post.mediaKey ? { objectKey: r.post.mediaKey, width: r.post.mediaWidth, height: r.post.mediaHeight } : null,
    createdAt: r.post.createdAt,
    author: publicUser(r.author),
    likeCount: r.likeCount,
    commentCount: r.commentCount,
    likedByMe: r.likedByMe,
  });

  const page = z.object({ before: uuid.optional(), limit: z.coerce.number().int().min(1).max(50).default(20) });

  async function feed(meId: string, opts: { before?: string; limit: number; authorId?: string }) {
    const cursor = opts.before
      ? sql`(${posts.createdAt}, ${posts.id}) < (select created_at, id from ${posts} where id = ${opts.before})`
      : undefined;
    const rows = await db.select(postSelect(meId)).from(posts)
      .innerJoin(users, eq(users.id, posts.authorId))
      .where(and(
        not(blockRelation(posts.authorId, meId)),
        opts.authorId ? eq(posts.authorId, opts.authorId) : undefined,
        cursor,
      ))
      .orderBy(desc(posts.createdAt), desc(posts.id))
      .limit(opts.limit + 1);
    return { posts: rows.slice(0, opts.limit).map(view), hasMore: rows.length > opts.limit };
  }

  app.get('/posts', auth, zValidator('query', page), async (c) => c.json(await feed(c.var.user.id, c.req.valid('query'))));

  app.get('/users/:username/posts', auth, zValidator('param', z.object({ username })), zValidator('query', page), async (c) => {
    const [author] = await db.select({ id: users.id }).from(users).where(eq(users.username, c.req.valid('param').username));
    if (!author) fail(404, 'User not found');
    return c.json(await feed(c.var.user.id, { ...c.req.valid('query'), authorId: author.id }));
  });

  app.get('/posts/:id', auth, zValidator('param', z.object({ id: uuid })), async (c) => {
    const me = c.var.user;
    const [row] = await db.select(postSelect(me.id)).from(posts).innerJoin(users, eq(users.id, posts.authorId))
      .where(and(eq(posts.id, c.req.valid('param').id), not(blockRelation(posts.authorId, me.id))));
    if (!row) fail(404, 'Post not found');
    return c.json({ post: view(row) });
  });

  app.post('/posts', auth, zValidator('json', z.object({
    text: z.string().trim().max(1000),
    media: z.object({ objectKey: z.string().max(200), width: z.number().int().positive().max(20000), height: z.number().int().positive().max(20000) }).optional(),
  }).refine((p) => p.text.length > 0 || p.media, 'Write something or add a photo')), async (c) => {
    const me = c.var.user;
    const { text, media } = c.req.valid('json');
    rateLimit(ctx, `post:${me.id}`, 30, HOUR);
    if (media && !POST_MEDIA_KEY(me.id).test(media.objectKey)) fail(400, 'Invalid photo');
    const [post] = await db.insert(posts).values({
      authorId: me.id, text, mediaKey: media?.objectKey, mediaWidth: media?.width, mediaHeight: media?.height,
    }).returning();
    return c.json({ post: view({ post: post!, author: me, likeCount: 0, commentCount: 0, likedByMe: false }) }, 201);
  });

  app.delete('/posts/:id', auth, zValidator('param', z.object({ id: uuid })), async (c) => {
    const [post] = await db.delete(posts)
      .where(and(eq(posts.id, c.req.valid('param').id), eq(posts.authorId, c.var.user.id))).returning();
    if (!post) fail(404, 'Post not found');
    if (post.mediaKey) await ctx.storage.deletePrefix(post.mediaKey);
    return c.json({ ok: true });
  });

  async function visiblePost(postId: string, meId: string) {
    const [post] = await db.select().from(posts).where(and(eq(posts.id, postId), not(blockRelation(posts.authorId, meId))));
    if (!post) fail(404, 'Post not found');
    return post;
  }

  app.put('/posts/:id/like', auth, zValidator('param', z.object({ id: uuid })), async (c) => {
    const post = await visiblePost(c.req.valid('param').id, c.var.user.id);
    await db.insert(likes).values({ postId: post.id, userId: c.var.user.id }).onConflictDoNothing();
    return c.json({ ok: true });
  });

  app.delete('/posts/:id/like', auth, zValidator('param', z.object({ id: uuid })), async (c) => {
    await db.delete(likes).where(and(eq(likes.postId, c.req.valid('param').id), eq(likes.userId, c.var.user.id)));
    return c.json({ ok: true });
  });

  app.get('/posts/:id/comments', auth, zValidator('param', z.object({ id: uuid })), async (c) => {
    const me = c.var.user;
    const post = await visiblePost(c.req.valid('param').id, me.id);
    const rows = await db.select({ comment: comments, author: users }).from(comments)
      .innerJoin(users, eq(users.id, comments.authorId))
      .where(and(eq(comments.postId, post.id), not(blockRelation(comments.authorId, me.id))))
      .orderBy(asc(comments.createdAt))
      .limit(500);
    return c.json({
      comments: rows.map((r) => ({ id: r.comment.id, text: r.comment.text, createdAt: r.comment.createdAt, author: publicUser(r.author) })),
    });
  });

  app.post('/posts/:id/comments', auth, zValidator('param', z.object({ id: uuid })),
    zValidator('json', z.object({ text: z.string().trim().min(1).max(500) })), async (c) => {
      const me = c.var.user;
      const post = await visiblePost(c.req.valid('param').id, me.id);
      rateLimit(ctx, `comment:${me.id}`, 120, HOUR);
      const [comment] = await db.insert(comments).values({ postId: post.id, authorId: me.id, text: c.req.valid('json').text }).returning();
      return c.json({ comment: { id: comment!.id, text: comment!.text, createdAt: comment!.createdAt, author: publicUser(me) } }, 201);
    });

  /** The comment's author or the post's author can delete a comment. */
  app.delete('/comments/:id', auth, zValidator('param', z.object({ id: uuid })), async (c) => {
    const me = c.var.user;
    const [row] = await db.select({ comment: comments, postAuthor: posts.authorId }).from(comments)
      .innerJoin(posts, eq(posts.id, comments.postId)).where(eq(comments.id, c.req.valid('param').id));
    if (!row || (row.comment.authorId !== me.id && row.postAuthor !== me.id)) fail(404, 'Comment not found');
    await db.delete(comments).where(eq(comments.id, row.comment.id));
    return c.json({ ok: true });
  });
}
