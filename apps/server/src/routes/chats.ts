import { zValidator } from '@hono/zod-validator';
import { type SQL, and, asc, desc, eq, inArray, sql } from 'drizzle-orm';
import { z } from 'zod';
import {
  type App, type Ctx, type User, HOUR, blockedBetween, fail, memberIds, publicUser, rateLimit, requireMembership, requireUser,
} from '../context';
import { blocks, communities, conversationEvents, conversations, members, messages, users } from '../db/schema';
import { MAX_CIPHERTEXT_CHARS, b64, uuid } from '../validation';

export const MAX_GROUP_MEMBERS = 64;

type MessageRow = typeof messages.$inferSelect;
type EventKind = typeof conversationEvents.$inferInsert['kind'];

/** A message as one member sees it: only their own copy of the key. */
export const messageFor = (m: MessageRow, userId: string) => ({
  id: m.id,
  conversationId: m.conversationId,
  senderId: m.senderId,
  clientId: m.clientId,
  nonce: m.nonce,
  ciphertext: m.ciphertext,
  key: m.keys[userId] ?? null,
  createdAt: m.createdAt,
});

export function registerChats(app: App, ctx: Ctx) {
  const { db, hub } = ctx;
  const auth = requireUser(ctx);
  // Both drivers (node-postgres, PGlite) return `{ rows }` from raw queries.
  const rows = async <T,>(query: SQL) => ((await db.execute(query)) as unknown as { rows: T[] }).rows;

  // ---------- views ----------

  async function conversationViews(me: User, conversationIds: string[]) {
    if (!conversationIds.length) return [];
    const convs = await db.select().from(conversations).where(inArray(conversations.id, conversationIds));
    const people = await db.select({ member: members, user: users }).from(members)
      .innerJoin(users, eq(users.id, members.userId))
      .where(inArray(members.conversationId, conversationIds))
      .orderBy(asc(members.joinedAt));
    const last = await rows<Record<string, unknown> & { conversation_id: string }>(sql`
      select distinct on (m.conversation_id) m.*
      from ${messages} m
      join ${members} cm on cm.conversation_id = m.conversation_id and cm.user_id = ${me.id}
      where m.conversation_id in (${sql.join(conversationIds.map((id) => sql`${id}`), sql`, `)})
        and m.created_at > coalesce(cm.cleared_at, '-infinity'::timestamptz)
      order by m.conversation_id, m.created_at desc, m.id desc`);
    const unread = await rows<{ conversation_id: string; n: number }>(sql`
      select m.conversation_id, count(*)::int as n
      from ${messages} m
      join ${members} cm on cm.conversation_id = m.conversation_id and cm.user_id = ${me.id}
      where m.conversation_id in (${sql.join(conversationIds.map((id) => sql`${id}`), sql`, `)})
        and m.sender_id <> ${me.id}
        and m.created_at > greatest(coalesce(cm.last_read_at, '-infinity'::timestamptz), coalesce(cm.cleared_at, '-infinity'::timestamptz))
      group by m.conversation_id`);
    const creatorIds = [...new Set(convs.map((c) => c.createdBy).filter((id): id is string => !!id))];
    const creators = new Map((creatorIds.length ? await db.select().from(users).where(inArray(users.id, creatorIds)) : [])
      .map((u) => [u.id, { id: u.id, displayName: u.displayName, username: u.username }]));
    const communityIds = [...new Set(convs.map((c) => c.communityId).filter((id): id is string => !!id))];
    const communityNames = new Map((communityIds.length ? await db.select().from(communities).where(inArray(communities.id, communityIds)) : [])
      .map((c) => [c.id, c.name]));
    const lastBy = new Map(last.map((r) => [r.conversation_id, r]));
    const unreadBy = new Map(unread.map((r) => [r.conversation_id, r.n]));

    return convs.map((conv) => {
      const mine = people.find((p) => p.member.conversationId === conv.id && p.user.id === me.id)!.member;
      const lastRow = lastBy.get(conv.id);
      return {
        id: conv.id,
        kind: conv.kind,
        title: conv.title,
        description: conv.description,
        adminsOnlyMessages: conv.adminsOnlyMessages,
        adminsOnlyEdit: conv.adminsOnlyEdit,
        createdBy: conv.createdBy ? creators.get(conv.createdBy) ?? null : null,
        community: conv.communityId ? { id: conv.communityId, name: communityNames.get(conv.communityId) ?? 'Community' } : null,
        announcements: conv.announcements,
        createdAt: conv.createdAt,
        lastMessageAt: conv.lastMessageAt,
        myStatus: mine.status,
        myRole: mine.role,
        myMuted: mine.muted,
        members: people.filter((p) => p.member.conversationId === conv.id).map((p) => ({
          ...publicUser(p.user),
          role: p.member.role,
          status: p.member.status,
          // Read receipts are mutual: hidden unless both of us share them.
          lastReadAt: p.user.id === me.id || (me.readReceipts && p.user.readReceipts) ? p.member.lastReadAt : null,
        })),
        lastMessage: lastRow ? messageFor(rowFromRaw(lastRow), me.id) : null,
        unreadCount: unreadBy.get(conv.id) ?? 0,
      };
    }).sort((a, b) => sortKey(b).localeCompare(sortKey(a)));
  }

  const sortKey = (c: { lastMessageAt: Date | null; createdAt: Date }) => (c.lastMessageAt ?? c.createdAt).toISOString();

  async function oneView(me: User, conversationId: string) {
    const [view] = await conversationViews(me, [conversationId]);
    return view!;
  }

  /** Someone added by `adder` sees it as a request unless they already chat with them. */
  async function initialStatus(userId: string, adderId: string): Promise<'accepted' | 'pending'> {
    const [row] = await rows<{ ok: number }>(sql`
      select 1 as ok from ${conversations} c
      join ${members} a on a.conversation_id = c.id and a.user_id = ${userId} and a.status = 'accepted'
      join ${members} b on b.conversation_id = c.id and b.user_id = ${adderId}
      where c.kind = 'direct' limit 1`);
    return row ? 'accepted' : 'pending';
  }

  /** Record a line of group history ("Ana added Ben"). */
  async function logEvent(conversationId: string, actorId: string | null, kind: EventKind, targetId?: string | null, detail?: string) {
    await db.insert(conversationEvents).values({ conversationId, actorId, kind, targetId: targetId ?? null, detail: detail ?? null });
  }

  // ---------- conversations ----------

  app.get('/conversations', auth, zValidator('query', z.object({ requests: z.enum(['0', '1']).default('0') })), async (c) => {
    const me = c.var.user;
    const status = c.req.valid('query').requests === '1' ? 'pending' : 'accepted';
    const rows = await db.select({ id: members.conversationId }).from(members)
      .innerJoin(conversations, eq(conversations.id, members.conversationId))
      .where(and(
        eq(members.userId, me.id),
        eq(members.status, status),
        // Hide direct chats with people I've blocked.
        sql`not (${conversations.kind} = 'direct' and exists (
          select 1 from ${members} o join ${blocks} b on b.blocker_id = ${me.id} and b.blocked_id = o.user_id
          where o.conversation_id = ${conversations.id} and o.user_id <> ${me.id}))`,
      ));
    const views = await conversationViews(me, rows.map((r) => r.id));
    // A request only shows once there's something in it.
    return c.json({ conversations: status === 'pending' ? views.filter((v) => v.lastMessage) : views });
  });

  app.get('/conversations/:id', auth, zValidator('param', z.object({ id: uuid })), async (c) => {
    const me = c.var.user;
    await requireMembership(ctx, c.req.valid('param').id, me.id);
    return c.json({ conversation: await oneView(me, c.req.valid('param').id) });
  });

  app.post('/conversations/direct', auth, zValidator('json', z.object({ userId: uuid })), async (c) => {
    const me = c.var.user;
    const { userId } = c.req.valid('json');
    if (userId === me.id) fail(400, "You can't start a chat with yourself");
    const [other] = await db.select({ id: users.id }).from(users).where(eq(users.id, userId));
    if (!other || (await blockedBetween(ctx, me.id, userId))) fail(404, 'User not found');

    const directKey = [me.id, userId].sort().join(':');
    let [conv] = await db.select().from(conversations).where(eq(conversations.directKey, directKey));
    if (!conv) {
      rateLimit(ctx, `new-chat:${me.id}`, 30, HOUR);
      [conv] = await db.insert(conversations).values({ kind: 'direct', directKey, createdBy: me.id })
        .onConflictDoNothing({ target: conversations.directKey }).returning();
      conv ??= (await db.select().from(conversations).where(eq(conversations.directKey, directKey)))[0]!;
    }
    // Starting (or reopening) a chat accepts it for me; the other person gets a request
    // unless they already accepted this chat earlier.
    await db.insert(members).values({ conversationId: conv.id, userId: me.id, status: 'accepted' })
      .onConflictDoUpdate({ target: [members.conversationId, members.userId], set: { status: 'accepted' } });
    await db.insert(members).values({ conversationId: conv.id, userId, status: 'pending' })
      .onConflictDoNothing();
    return c.json({ conversation: await oneView(me, conv.id) });
  });

  app.post('/conversations/group', auth, zValidator('json', z.object({
    title: z.string().trim().min(1).max(60),
    memberIds: z.array(uuid).min(1).max(MAX_GROUP_MEMBERS - 1),
  })), async (c) => {
    const me = c.var.user;
    const { title } = c.req.valid('json');
    const ids = [...new Set(c.req.valid('json').memberIds)].filter((id) => id !== me.id);
    rateLimit(ctx, `new-chat:${me.id}`, 30, HOUR);
    const invitees = await addableUsers(me.id, ids);
    // Work out who gets a request before opening the transaction (queries inside it must use `tx`).
    const statuses = await Promise.all(invitees.map((id) => initialStatus(id, me.id)));
    const conv = await db.transaction(async (tx) => {
      const [created] = await tx.insert(conversations).values({ kind: 'group', title, createdBy: me.id }).returning();
      await tx.insert(members).values([
        { conversationId: created!.id, userId: me.id, role: 'admin', status: 'accepted' },
        ...invitees.map((id, i) => ({ conversationId: created!.id, userId: id, status: statuses[i]! })),
      ]);
      await tx.insert(conversationEvents).values({ conversationId: created!.id, actorId: me.id, kind: 'created', detail: title });
      return created!;
    });
    hub.send(invitees, { type: 'conversation_changed', conversationId: conv.id });
    return c.json({ conversation: await oneView(me, conv.id) }, 201);
  });

  /** Everyone in `ids` must exist and have no block relation with `adderId`. */
  async function addableUsers(adderId: string, ids: string[]) {
    if (!ids.length) fail(400, 'Pick at least one person');
    const found = await db.select({ id: users.id }).from(users).where(and(
      inArray(users.id, ids),
      sql`not exists (select 1 from ${blocks} where (blocker_id = ${adderId} and blocked_id = ${users.id})
                                               or (blocked_id = ${adderId} and blocker_id = ${users.id}))`,
    ));
    if (found.length !== ids.length) fail(404, "Some of those people can't be added");
    return ids;
  }

  /**
   * Group info and settings. Name and description: admins, or everyone unless
   * "only admins can edit" is on. The settings themselves: admins only.
   */
  app.patch('/conversations/:id', auth, zValidator('param', z.object({ id: uuid })),
    zValidator('json', z.object({
      title: z.string().trim().min(1).max(60).optional(),
      description: z.string().trim().max(512).optional(),
      adminsOnlyMessages: z.boolean().optional(),
      adminsOnlyEdit: z.boolean().optional(),
    })), async (c) => {
      const me = c.var.user;
      const { conversation, member } = await requireMembership(ctx, c.req.valid('param').id, me.id);
      const patch = c.req.valid('json');
      const admin = member.role === 'admin';
      if (conversation.kind !== 'group') fail(400, 'Only groups have settings');
      if (member.status !== 'accepted') fail(403, 'Accept the invite first');
      const editsInfo = patch.title !== undefined || patch.description !== undefined;
      const editsSettings = patch.adminsOnlyMessages !== undefined || patch.adminsOnlyEdit !== undefined;
      if (conversation.announcements && (editsSettings || editsInfo)) fail(400, 'Edit the community instead');
      if (editsSettings && !admin) fail(403, 'Only group admins can change group settings');
      if (editsInfo && !admin && conversation.adminsOnlyEdit) fail(403, 'Only group admins can edit group info');

      const changes: Partial<typeof conversations.$inferInsert> = {};
      const events: Array<[EventKind, string]> = [];
      if (patch.title !== undefined && patch.title !== conversation.title) {
        changes.title = patch.title;
        events.push(['renamed', patch.title]);
      }
      if (patch.description !== undefined && patch.description !== conversation.description) {
        changes.description = patch.description;
        events.push(['described', '']);
      }
      if (patch.adminsOnlyMessages !== undefined && patch.adminsOnlyMessages !== conversation.adminsOnlyMessages) {
        changes.adminsOnlyMessages = patch.adminsOnlyMessages;
        events.push(['settings', `messages:${patch.adminsOnlyMessages ? 'admins' : 'all'}`]);
      }
      if (patch.adminsOnlyEdit !== undefined && patch.adminsOnlyEdit !== conversation.adminsOnlyEdit) {
        changes.adminsOnlyEdit = patch.adminsOnlyEdit;
        events.push(['settings', `edit:${patch.adminsOnlyEdit ? 'admins' : 'all'}`]);
      }
      if (events.length) {
        await db.update(conversations).set(changes).where(eq(conversations.id, conversation.id));
        for (const [kind, detail] of events) await logEvent(conversation.id, me.id, kind, null, detail);
        hub.send(await memberIds(ctx, conversation.id), { type: 'conversation_changed', conversationId: conversation.id });
      }
      return c.json({ conversation: await oneView(me, conversation.id) });
    });

  /** Make someone an admin, or dismiss them as admin. */
  app.patch('/conversations/:id/members/:userId', auth, zValidator('param', z.object({ id: uuid, userId: uuid })),
    zValidator('json', z.object({ role: z.enum(['admin', 'member']) })), async (c) => {
      const me = c.var.user;
      const { id, userId } = c.req.valid('param');
      const { role } = c.req.valid('json');
      const { conversation, member } = await requireMembership(ctx, id, me.id);
      if (conversation.kind !== 'group' || member.role !== 'admin') fail(403, 'Only group admins can do that');
      const roster = await db.select().from(members).where(eq(members.conversationId, conversation.id));
      const target = roster.find((m) => m.userId === userId);
      if (!target) fail(404, "They're not in this group");
      if (target.role !== role) {
        if (role === 'member' && roster.filter((m) => m.role === 'admin').length === 1) fail(400, 'A group needs at least one admin');
        await db.update(members).set({ role })
          .where(and(eq(members.conversationId, conversation.id), eq(members.userId, userId)));
        await logEvent(conversation.id, me.id, role === 'admin' ? 'promoted' : 'demoted', userId);
        hub.send(roster.map((m) => m.userId), { type: 'conversation_changed', conversationId: conversation.id });
      }
      return c.json({ conversation: await oneView(me, conversation.id) });
    });

  /** Group history since I joined (or cleared the chat): who added whom, renames, settings. */
  app.get('/conversations/:id/events', auth, zValidator('param', z.object({ id: uuid })), async (c) => {
    const me = c.var.user;
    const { conversation } = await requireMembership(ctx, c.req.valid('param').id, me.id);
    const since = sql`greatest(
      (select joined_at from ${members} where conversation_id = ${conversation.id} and user_id = ${me.id}),
      coalesce((select cleared_at from ${members} where conversation_id = ${conversation.id} and user_id = ${me.id}), '-infinity'::timestamptz))`;
    const events = await db.select().from(conversationEvents)
      .where(and(eq(conversationEvents.conversationId, conversation.id),
        sql`${conversationEvents.createdAt} >= ${since}`))
      .orderBy(desc(conversationEvents.createdAt), desc(conversationEvents.id))
      .limit(200);
    const ids = [...new Set(events.flatMap((e) => [e.actorId, e.targetId]).filter((x): x is string => !!x))];
    const names = new Map((ids.length ? await db.select().from(users).where(inArray(users.id, ids)) : []).map((u) => [u.id, u.displayName]));
    return c.json({
      events: events.reverse().map((e) => ({
        id: e.id,
        kind: e.kind,
        actor: e.actorId ? { id: e.actorId, displayName: names.get(e.actorId) ?? 'Someone' } : null,
        target: e.targetId ? { id: e.targetId, displayName: names.get(e.targetId) ?? 'Someone' } : null,
        detail: e.detail,
        createdAt: e.createdAt,
      })),
    });
  });

  /** My own settings for a chat (currently: mute notifications). */
  app.patch('/conversations/:id/me', auth, zValidator('param', z.object({ id: uuid })),
    zValidator('json', z.object({ muted: z.boolean() })), async (c) => {
      const me = c.var.user;
      const { conversation } = await requireMembership(ctx, c.req.valid('param').id, me.id);
      await db.update(members).set({ muted: c.req.valid('json').muted })
        .where(and(eq(members.conversationId, conversation.id), eq(members.userId, me.id)));
      return c.json({ conversation: await oneView(me, conversation.id) });
    });

  /** Clear chat: hide all current messages from my view. Others keep theirs. */
  app.post('/conversations/:id/clear', auth, zValidator('param', z.object({ id: uuid })), async (c) => {
    const me = c.var.user;
    const { conversation } = await requireMembership(ctx, c.req.valid('param').id, me.id);
    // Use the newest message's own timestamp (full precision) so nothing sent at the same instant survives.
    await db.update(members)
      .set({ clearedAt: sql`greatest(now(), coalesce((select max(created_at) from ${messages} where conversation_id = ${conversation.id}), now()))` })
      .where(and(eq(members.conversationId, conversation.id), eq(members.userId, me.id)));
    return c.json({ conversation: await oneView(me, conversation.id) });
  });

  app.post('/conversations/:id/accept', auth, zValidator('param', z.object({ id: uuid })), async (c) => {
    const me = c.var.user;
    const { conversation } = await requireMembership(ctx, c.req.valid('param').id, me.id);
    await db.update(members).set({ status: 'accepted' })
      .where(and(eq(members.conversationId, conversation.id), eq(members.userId, me.id)));
    hub.send(await memberIds(ctx, conversation.id), { type: 'conversation_changed', conversationId: conversation.id });
    return c.json({ conversation: await oneView(me, conversation.id) });
  });

  /** Leave a group, or decline/delete a chat for yourself. */
  app.delete('/conversations/:id/membership', auth, zValidator('param', z.object({ id: uuid })), async (c) => {
    const me = c.var.user;
    const { conversation } = await requireMembership(ctx, c.req.valid('param').id, me.id);
    await removeMember(conversation.id, me.id, me.id);
    return c.json({ ok: true });
  });

  async function removeMember(conversationId: string, userId: string, actorId: string) {
    const [conv] = await db.select({ kind: conversations.kind }).from(conversations).where(eq(conversations.id, conversationId));
    await db.delete(members).where(and(eq(members.conversationId, conversationId), eq(members.userId, userId)));
    const remaining = await db.select().from(members).where(eq(members.conversationId, conversationId)).orderBy(asc(members.joinedAt));
    if (conv?.kind === 'group' && remaining.length) {
      await logEvent(conversationId, actorId, actorId === userId ? 'left' : 'removed', actorId === userId ? null : userId);
    }
    if (!remaining.length) {
      await ctx.storage.deletePrefix(`conversations/${conversationId}/`);
      const [gone] = await db.delete(conversations).where(eq(conversations.id, conversationId)).returning();
      // The last person out of a community's announcements closes the community (its groups live on).
      if (gone?.announcements && gone.communityId) await db.delete(communities).where(eq(communities.id, gone.communityId));
      return;
    }
    // A group always keeps an admin.
    if (!remaining.some((m) => m.role === 'admin')) {
      const heir = remaining.find((m) => m.status === 'accepted') ?? remaining[0]!;
      await db.update(members).set({ role: 'admin' })
        .where(and(eq(members.conversationId, conversationId), eq(members.userId, heir.userId)));
      if (conv?.kind === 'group') await logEvent(conversationId, null, 'promoted', heir.userId);
    }
    hub.send([userId, ...remaining.map((m) => m.userId)], { type: 'conversation_changed', conversationId });
  }

  app.post('/conversations/:id/members', auth, zValidator('param', z.object({ id: uuid })),
    zValidator('json', z.object({ userIds: z.array(uuid).min(1).max(MAX_GROUP_MEMBERS) })), async (c) => {
      const me = c.var.user;
      const { conversation, member } = await requireMembership(ctx, c.req.valid('param').id, me.id);
      if (conversation.kind !== 'group' || member.role !== 'admin') fail(403, 'Only group admins can add people');
      const current = new Set(await memberIds(ctx, conversation.id));
      const ids = [...new Set(c.req.valid('json').userIds)].filter((id) => !current.has(id));
      if (current.size + ids.length > MAX_GROUP_MEMBERS) fail(400, `Groups can have up to ${MAX_GROUP_MEMBERS} people`);
      for (const id of await addableUsers(me.id, ids)) {
        const [added] = await db.insert(members).values({ conversationId: conversation.id, userId: id, status: await initialStatus(id, me.id) })
          .onConflictDoNothing().returning();
        if (added) await logEvent(conversation.id, me.id, 'added', id);
      }
      hub.send([...current, ...ids], { type: 'conversation_changed', conversationId: conversation.id });
      return c.json({ conversation: await oneView(me, conversation.id) });
    });

  app.delete('/conversations/:id/members/:userId', auth, zValidator('param', z.object({ id: uuid, userId: uuid })), async (c) => {
    const me = c.var.user;
    const { id, userId } = c.req.valid('param');
    const { conversation, member } = await requireMembership(ctx, id, me.id);
    if (conversation.kind !== 'group' || member.role !== 'admin') fail(403, 'Only group admins can remove people');
    if (!(await memberIds(ctx, conversation.id)).includes(userId)) fail(404, "They're not in this group");
    await removeMember(conversation.id, userId, me.id);
    return c.json({ ok: true });
  });

  // ---------- messages ----------

  app.get('/conversations/:id/messages', auth, zValidator('param', z.object({ id: uuid })),
    zValidator('query', z.object({ before: uuid.optional(), limit: z.coerce.number().int().min(1).max(100).default(50) })),
    async (c) => {
      const me = c.var.user;
      const { conversation, member } = await requireMembership(ctx, c.req.valid('param').id, me.id);
      const { before, limit } = c.req.valid('query');
      // "Clear chat" hides everything up to that moment, for me only.
      const sinceCleared = member.clearedAt ? sql`${messages.createdAt} > (select cleared_at from ${members}
        where conversation_id = ${conversation.id} and user_id = ${me.id})` : undefined;
      let cursor = undefined;
      if (before) {
        const [anchor] = await db.select({ id: messages.id }).from(messages)
          .where(and(eq(messages.id, before), eq(messages.conversationId, conversation.id)));
        if (!anchor) fail(404, 'Unknown cursor');
        // Compare inside Postgres: a JS Date would truncate microseconds and skip
        // messages created within the same millisecond.
        cursor = sql`(${messages.createdAt}, ${messages.id}) < (select created_at, id from messages where id = ${anchor.id})`;
      }
      const rows = await db.select().from(messages)
        .where(and(eq(messages.conversationId, conversation.id), cursor, sinceCleared))
        .orderBy(desc(messages.createdAt), desc(messages.id))
        .limit(limit + 1);
      return c.json({ messages: rows.slice(0, limit).map((m) => messageFor(m, me.id)), hasMore: rows.length > limit });
    });

  app.post('/conversations/:id/messages', auth, zValidator('param', z.object({ id: uuid })), zValidator('json', z.object({
    clientId: z.string().min(1).max(64),
    nonce: b64(64),
    ciphertext: b64(MAX_CIPHERTEXT_CHARS),
    keys: z.record(uuid, z.object({ nonce: b64(64), key: b64(200) })),
  })), async (c) => {
    const me = c.var.user;
    const { conversation, member } = await requireMembership(ctx, c.req.valid('param').id, me.id);
    const body = c.req.valid('json');
    const roster = await db.select({ userId: members.userId, status: members.status, muted: members.muted, pushToken: users.pushToken })
      .from(members).innerJoin(users, eq(users.id, members.userId))
      .where(eq(members.conversationId, conversation.id));
    const others = roster.filter((m) => m.userId !== me.id);

    if (conversation.kind === 'group' && conversation.adminsOnlyMessages && member.role !== 'admin') {
      fail(403, 'Only admins can send messages to this group');
    }
    if (conversation.kind === 'direct' && others[0] && (await blockedBetween(ctx, me.id, others[0].userId))) {
      fail(403, "You can't message this person");
    }
    // Every current member — and nobody else — must get a copy of the key.
    const want = roster.map((m) => m.userId).sort().join(',');
    if (Object.keys(body.keys).sort().join(',') !== want) {
      fail(409, 'The members of this chat changed. Refresh and try again.');
    }
    // Replying to a request accepts it.
    if (member.status === 'pending') {
      await db.update(members).set({ status: 'accepted' })
        .where(and(eq(members.conversationId, conversation.id), eq(members.userId, me.id)));
    }

    const [inserted] = await db.insert(messages)
      .values({ conversationId: conversation.id, senderId: me.id, ...body })
      .onConflictDoNothing({ target: [messages.senderId, messages.clientId] })
      .returning();
    if (!inserted) {
      const [existing] = await db.select().from(messages)
        .where(and(eq(messages.senderId, me.id), eq(messages.clientId, body.clientId)));
      return c.json({ message: messageFor(existing!, me.id) });
    }
    await db.update(conversations).set({ lastMessageAt: inserted.createdAt }).where(eq(conversations.id, conversation.id));

    hub.sendEach(roster.map((m) => m.userId), (userId) => ({
      type: 'message', conversationId: conversation.id, message: messageFor(inserted, userId),
    }));
    if (member.status === 'pending') hub.send(roster.map((m) => m.userId), { type: 'conversation_changed', conversationId: conversation.id });

    // Content-free pushes to members who are offline and haven't blocked me.
    const blockers = new Set((await db.select({ id: blocks.blockerId }).from(blocks)
      .where(and(eq(blocks.blockedId, me.id), inArray(blocks.blockerId, others.map((o) => o.userId).concat(me.id))))).map((b) => b.id));
    for (const m of others) {
      if (!m.pushToken || m.muted || hub.isOnline(m.userId) || blockers.has(m.userId)) continue;
      const title = conversation.kind === 'group' ? conversation.title ?? 'Group' : me.displayName;
      const text = m.status === 'pending' ? 'New message request' : conversation.kind === 'group' ? `${me.displayName} sent a message` : 'Sent you a message 💌';
      void ctx.push.send(m.pushToken, title, text);
    }
    return c.json({ message: messageFor(inserted, me.id) }, 201);
  });

  app.post('/conversations/:id/read', auth, zValidator('param', z.object({ id: uuid })),
    zValidator('json', z.object({ upTo: uuid })), async (c) => {
      const me = c.var.user;
      const { conversation } = await requireMembership(ctx, c.req.valid('param').id, me.id);
      const { upTo } = c.req.valid('json');
      const [anchor] = await db.select({ id: messages.id }).from(messages)
        .where(and(eq(messages.id, upTo), eq(messages.conversationId, conversation.id)));
      if (!anchor) fail(404, 'Unknown message');
      // Keep the anchor's full-precision timestamp in SQL; never move the marker backwards.
      const [updated] = await db.update(members)
        .set({ lastReadAt: sql`greatest(coalesce(${members.lastReadAt}, '-infinity'::timestamptz), (select created_at from messages where id = ${anchor.id}))` })
        .where(and(eq(members.conversationId, conversation.id), eq(members.userId, me.id)))
        .returning({ lastReadAt: members.lastReadAt });
      // Only people who also share read receipts learn that I've read (and only if I share mine).
      const audience = me.readReceipts
        ? (await db.select({ id: users.id }).from(members).innerJoin(users, eq(users.id, members.userId))
          .where(and(eq(members.conversationId, conversation.id), eq(users.readReceipts, true)))).map((r) => r.id)
        : [];
      hub.send(new Set([me.id, ...audience]), {
        type: 'read', conversationId: conversation.id, userId: me.id, lastReadAt: updated!.lastReadAt!.toISOString(),
      });
      return c.json({ ok: true });
    });

  return { removeMember, oneView, initialStatus, addableUsers, logEvent };
}

/** `db.execute` returns snake_case columns; map back to the Drizzle row shape. */
function rowFromRaw(r: Record<string, unknown>): MessageRow {
  return {
    id: r.id as string,
    conversationId: r.conversation_id as string,
    senderId: r.sender_id as string,
    clientId: r.client_id as string,
    nonce: r.nonce as string,
    ciphertext: r.ciphertext as string,
    keys: (typeof r.keys === 'string' ? JSON.parse(r.keys) : r.keys) as MessageRow['keys'],
    createdAt: new Date(r.created_at as string),
  };
}
