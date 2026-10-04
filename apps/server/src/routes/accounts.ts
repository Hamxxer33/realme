import { hash as argonHash, verify as argonVerify } from '@node-rs/argon2';
import { zValidator } from '@hono/zod-validator';
import { and, eq, ilike, isNull, ne, not, or, sql } from 'drizzle-orm';
import { sign } from 'hono/jwt';
import { z } from 'zod';
import {
  type App, type Ctx, HOUR, blockRelation, fail, isUniqueViolation, publicUser, rateLimit, requireUser,
} from '../context';
import { blocks, conversations, members, posts, users } from '../db/schema';
import { b64, email, sealed } from '../validation';

const TOKEN_TTL_SECONDS = 60 * 60 * 24 * 30;
const RESERVED = new Set(['admin', 'administrator', 'support', 'help', 'realme', 'root', 'system', 'moderator', 'official', 'me']);

export const username = z.string().trim().toLowerCase().transform((u) => u.replace(/^@/, ''))
  .pipe(z.string().regex(/^[a-z0-9_]{3,20}$/, 'Usernames are 3–20 letters, numbers or underscores'));

export function registerAccounts(app: App, ctx: Ctx) {
  const { db } = ctx;
  const auth = requireUser(ctx);

  const issueToken = (userId: string) => {
    const iat = Math.floor(ctx.now().getTime() / 1000);
    return sign({ sub: userId, iat, exp: iat + TOKEN_TTL_SECONDS }, ctx.jwtSecret, 'HS256');
  };

  const me = (u: typeof users.$inferSelect) => ({ ...publicUser(u), email: u.email, readReceipts: u.readReceipts });

  app.get('/auth/username-available', zValidator('query', z.object({ username })), async (c) => {
    const { username: name } = c.req.valid('query');
    if (RESERVED.has(name)) return c.json({ available: false });
    const [taken] = await db.select({ id: users.id }).from(users).where(eq(users.username, name));
    return c.json({ available: !taken });
  });

  app.post(
    '/auth/signup',
    zValidator('json', z.object({
      email,
      username,
      displayName: z.string().trim().min(1).max(40),
      authSecret: b64(128),
      publicKey: b64(64),
      keyBackup: sealed(),
      // The sign-up screen asks people to confirm they're 18+ and agree to the Terms and Privacy Policy.
      acceptTerms: z.literal(true, { error: 'Please agree to the Terms and confirm you are 18 or older' }),
    })),
    async (c) => {
      const body = c.req.valid('json');
      if (RESERVED.has(body.username)) fail(409, 'That username is taken');
      const [clash] = await db.select({ email: users.email, username: users.username }).from(users)
        .where(or(sql`lower(${users.email}) = ${body.email}`, eq(users.username, body.username)));
      if (clash) fail(409, clash.username === body.username ? 'That username is taken' : 'An account with this email already exists');
      const [user] = await db.insert(users).values({
        email: body.email,
        username: body.username,
        displayName: body.displayName,
        authHash: await argonHash(body.authSecret),
        publicKey: body.publicKey,
        keyBackupNonce: body.keyBackup.nonce,
        keyBackupCiphertext: body.keyBackup.ciphertext,
        termsAcceptedAt: ctx.now(),
      }).returning().catch((err) => {
        // Lost a race with a concurrent signup.
        if (isUniqueViolation(err)) fail(409, 'That username or email is already taken');
        throw err;
      });
      return c.json({ token: await issueToken(user!.id), user: me(user!) }, 201);
    },
  );

  app.post('/auth/login', zValidator('json', z.object({ email, authSecret: b64(128) })), async (c) => {
    const { email: addr, authSecret } = c.req.valid('json');
    const ip = c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ?? 'local';
    rateLimit(ctx, `login:${addr}`, 10, HOUR / 4);
    rateLimit(ctx, `login-ip:${ip}`, 30, HOUR / 4);
    const [user] = await db.select().from(users).where(sql`lower(${users.email}) = ${addr}`);
    if (!user || !(await argonVerify(user.authHash, authSecret))) fail(401, 'Wrong email or password');
    if (user.bannedAt) fail(403, 'This account has been suspended for breaking the Terms. Contact support if you think this is a mistake.');
    return c.json({
      token: await issueToken(user.id),
      user: me(user),
      keyBackup: { nonce: user.keyBackupNonce, ciphertext: user.keyBackupCiphertext },
    });
  });

  app.get('/me', auth, (c) => c.json({ user: me(c.var.user) }));

  app.patch('/me', auth, zValidator('json', z.object({
    displayName: z.string().trim().min(1).max(40).optional(),
    bio: z.string().trim().max(160).optional(),
    readReceipts: z.boolean().optional(),
  })), async (c) => {
    const [user] = await db.update(users).set(c.req.valid('json')).where(eq(users.id, c.var.user.id)).returning();
    return c.json({ user: me(user!) });
  });

  app.put('/me/push-token', auth, zValidator('json', z.object({ token: z.string().max(200).nullable() })), async (c) => {
    await db.update(users).set({ pushToken: c.req.valid('json').token }).where(eq(users.id, c.var.user.id));
    return c.json({ ok: true });
  });

  app.delete('/me', auth, async (c) => {
    const user = c.var.user;
    const mine = await db.select({ conversationId: members.conversationId }).from(members).where(eq(members.userId, user.id));
    await ctx.storage.deletePrefix(`posts/${user.id}/`);
    await db.delete(users).where(eq(users.id, user.id)); // cascades memberships, messages, posts…
    // Drop conversations nobody is left in.
    for (const { conversationId } of mine) {
      const [left] = await db.select({ x: sql`1` }).from(members).where(eq(members.conversationId, conversationId)).limit(1);
      if (!left) {
        await ctx.storage.deletePrefix(`conversations/${conversationId}/`);
        await db.delete(conversations).where(eq(conversations.id, conversationId));
      } else {
        ctx.hub.send(await otherMembers(conversationId), { type: 'conversation_changed', conversationId });
      }
    }
    return c.json({ ok: true });
  });

  async function otherMembers(conversationId: string) {
    const rows = await db.select({ userId: members.userId }).from(members).where(eq(members.conversationId, conversationId));
    return rows.map((r) => r.userId);
  }

  // ---------- people ----------

  app.get('/users/search', auth, zValidator('query', z.object({ q: z.string().trim().min(1).max(40) })), async (c) => {
    const me = c.var.user;
    const q = c.req.valid('query').q.toLowerCase().replace(/^@/, '').replace(/[%_\\]/g, (ch) => `\\${ch}`);
    const rows = await db.select().from(users)
      .where(and(
        ne(users.id, me.id),
        isNull(users.bannedAt),
        or(ilike(users.username, `${q}%`), ilike(users.displayName, `%${q}%`)),
        not(blockRelation(users.id, me.id)),
      ))
      .orderBy(sql`${users.username} = ${q} desc`, sql`${users.username} ilike ${`${q}%`} desc`, users.username)
      .limit(20);
    return c.json({ users: rows.map(publicUser) });
  });

  /** Public key lookup for people who have since left a chat (to verify their old messages). */
  app.get('/users/id/:id', auth, zValidator('param', z.object({ id: z.string().uuid() })), async (c) => {
    const [user] = await db.select().from(users)
      .where(and(eq(users.id, c.req.valid('param').id), not(blockRelation(users.id, c.var.user.id))));
    if (!user) fail(404, 'User not found');
    return c.json({ user: publicUser(user) });
  });

  app.get('/users/:username', auth, zValidator('param', z.object({ username })), async (c) => {
    const me = c.var.user;
    const [user] = await db.select().from(users).where(and(eq(users.username, c.req.valid('param').username), isNull(users.bannedAt)));
    if (!user) fail(404, 'User not found');
    const [rel] = await db.select({
      blockedByMe: sql<boolean>`exists (select 1 from ${blocks} where ${blocks.blockerId} = ${me.id} and ${blocks.blockedId} = ${user.id})`,
      blocksMe: sql<boolean>`exists (select 1 from ${blocks} where ${blocks.blockerId} = ${user.id} and ${blocks.blockedId} = ${me.id})`,
      postCount: sql<number>`(select count(*)::int from ${posts} where ${posts.authorId} = ${user.id})`,
    }).from(users).where(eq(users.id, user.id));
    // Someone who blocked you simply doesn't exist from your point of view.
    if (rel!.blocksMe) fail(404, 'User not found');
    return c.json({ user: publicUser(user), blockedByMe: rel!.blockedByMe, postCount: rel!.postCount, isMe: user.id === me.id });
  });
}
