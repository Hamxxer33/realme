import { zValidator } from '@hono/zod-validator';
import { and, asc, eq, inArray, sql } from 'drizzle-orm';
import { z } from 'zod';
import { type App, type Ctx, HOUR, fail, memberIds, rateLimit, requireUser } from '../context';
import { communities, conversationEvents, conversations, members } from '../db/schema';
import { uuid } from '../validation';
import { MAX_GROUP_MEMBERS, type registerChats } from './chats';

type Chats = ReturnType<typeof registerChats>;

/**
 * Communities: several groups under one roof, plus an announcements group
 * that every community member is in and only admins post to. Messages in all
 * of them are end-to-end encrypted like any group.
 */
export function registerCommunities(app: App, ctx: Ctx, chats: Chats) {
  const { db, hub } = ctx;
  const auth = requireUser(ctx);

  /** The community, its announcements group, and my membership in it — or 404. */
  async function requireCommunity(id: string, meId: string) {
    const [row] = await db.select({ community: communities, announcements: conversations, member: members })
      .from(communities)
      .innerJoin(conversations, and(eq(conversations.communityId, communities.id), eq(conversations.announcements, true)))
      .innerJoin(members, and(eq(members.conversationId, conversations.id), eq(members.userId, meId)))
      .where(eq(communities.id, id));
    if (!row) fail(404, 'Community not found');
    return row;
  }

  async function requireAdmin(id: string, meId: string) {
    const row = await requireCommunity(id, meId);
    if (row.member.role !== 'admin') fail(403, 'Only community admins can do that');
    return row;
  }

  async function views(meId: string, communityIds: string[]) {
    if (!communityIds.length) return [];
    const rows = await db.select({ community: communities, announcements: conversations, member: members })
      .from(communities)
      .innerJoin(conversations, and(eq(conversations.communityId, communities.id), eq(conversations.announcements, true)))
      .innerJoin(members, and(eq(members.conversationId, conversations.id), eq(members.userId, meId)))
      .where(inArray(communities.id, communityIds))
      .orderBy(asc(communities.name));
    const groups = await db.select({
      conversation: conversations,
      memberCount: sql<number>`(select count(*)::int from ${members} m where m.conversation_id = ${conversations.id})`,
      joined: sql<boolean>`exists (select 1 from ${members} m where m.conversation_id = ${conversations.id} and m.user_id = ${meId})`,
    }).from(conversations)
      .where(and(inArray(conversations.communityId, communityIds), eq(conversations.announcements, false)))
      .orderBy(asc(conversations.title));
    const counts = new Map((await db.select({
      id: members.conversationId, n: sql<number>`count(*)::int`,
    }).from(members).where(inArray(members.conversationId, rows.map((r) => r.announcements.id))).groupBy(members.conversationId))
      .map((r) => [r.id, r.n]));
    return rows.map((r) => ({
      id: r.community.id,
      name: r.community.name,
      description: r.community.description,
      createdAt: r.community.createdAt,
      announcementsId: r.announcements.id,
      myRole: r.member.role,
      myStatus: r.member.status,
      memberCount: counts.get(r.announcements.id) ?? 0,
      groups: groups.filter((g) => g.conversation.communityId === r.community.id).map((g) => ({
        id: g.conversation.id,
        title: g.conversation.title ?? 'Group',
        description: g.conversation.description,
        memberCount: g.memberCount,
        joined: g.joined,
      })),
    }));
  }

  const oneView = async (meId: string, id: string) => (await views(meId, [id]))[0]!;

  async function notifyCommunity(communityId: string, announcementsId: string, extra: string[] = []) {
    hub.send(new Set([...(await memberIds(ctx, announcementsId)), ...extra]), { type: 'community_changed', communityId });
  }

  app.get('/communities', auth, async (c) => {
    const me = c.var.user;
    const mine = await db.select({ id: conversations.communityId }).from(conversations)
      .innerJoin(members, and(eq(members.conversationId, conversations.id), eq(members.userId, me.id)))
      .where(eq(conversations.announcements, true));
    return c.json({ communities: await views(me.id, mine.map((r) => r.id!).filter(Boolean)) });
  });

  app.get('/communities/:id', auth, zValidator('param', z.object({ id: uuid })), async (c) => {
    const me = c.var.user;
    await requireCommunity(c.req.valid('param').id, me.id);
    return c.json({ community: await oneView(me.id, c.req.valid('param').id) });
  });

  app.post('/communities', auth, zValidator('json', z.object({
    name: z.string().trim().min(1).max(60),
    description: z.string().trim().max(512).default(''),
    memberIds: z.array(uuid).max(MAX_GROUP_MEMBERS - 1).default([]),
  })), async (c) => {
    const me = c.var.user;
    const { name, description } = c.req.valid('json');
    rateLimit(ctx, `community:${me.id}`, 10, 24 * HOUR);
    const ids = [...new Set(c.req.valid('json').memberIds)].filter((id) => id !== me.id);
    const invitees = ids.length ? await chats.addableUsers(me.id, ids) : [];
    const statuses = await Promise.all(invitees.map((id) => chats.initialStatus(id, me.id)));
    const community = await db.transaction(async (tx) => {
      const [created] = await tx.insert(communities).values({ name, description, createdBy: me.id }).returning();
      const [announcements] = await tx.insert(conversations).values({
        kind: 'group', title: name, description, createdBy: me.id, communityId: created!.id,
        announcements: true, adminsOnlyMessages: true, adminsOnlyEdit: true,
      }).returning();
      await tx.insert(members).values([
        { conversationId: announcements!.id, userId: me.id, role: 'admin', status: 'accepted' },
        ...invitees.map((id, i) => ({ conversationId: announcements!.id, userId: id, status: statuses[i]! })),
      ]);
      await tx.insert(conversationEvents).values({ conversationId: announcements!.id, actorId: me.id, kind: 'created', detail: name });
      return created!;
    });
    hub.send(invitees, { type: 'community_changed', communityId: community.id });
    return c.json({ community: await oneView(me.id, community.id) }, 201);
  });

  app.patch('/communities/:id', auth, zValidator('param', z.object({ id: uuid })), zValidator('json', z.object({
    name: z.string().trim().min(1).max(60).optional(),
    description: z.string().trim().max(512).optional(),
  })), async (c) => {
    const me = c.var.user;
    const { community, announcements } = await requireAdmin(c.req.valid('param').id, me.id);
    const patch = c.req.valid('json');
    await db.update(communities).set(patch).where(eq(communities.id, community.id));
    await db.update(conversations).set({
      ...(patch.name !== undefined ? { title: patch.name } : {}),
      ...(patch.description !== undefined ? { description: patch.description } : {}),
    }).where(eq(conversations.id, announcements.id));
    if (patch.name !== undefined && patch.name !== community.name) await chats.logEvent(announcements.id, me.id, 'renamed', null, patch.name);
    await notifyCommunity(community.id, announcements.id);
    hub.send(await memberIds(ctx, announcements.id), { type: 'conversation_changed', conversationId: announcements.id });
    return c.json({ community: await oneView(me.id, community.id) });
  });

  /** Start a new group inside the community. Invitees must already be in the community. */
  app.post('/communities/:id/groups', auth, zValidator('param', z.object({ id: uuid })), zValidator('json', z.object({
    title: z.string().trim().min(1).max(60),
    description: z.string().trim().max(512).default(''),
    memberIds: z.array(uuid).max(MAX_GROUP_MEMBERS - 1).default([]),
  })), async (c) => {
    const me = c.var.user;
    const { community, announcements } = await requireAdmin(c.req.valid('param').id, me.id);
    const { title, description } = c.req.valid('json');
    rateLimit(ctx, `new-chat:${me.id}`, 30, HOUR);
    const inCommunity = new Set(await memberIds(ctx, announcements.id));
    const ids = [...new Set(c.req.valid('json').memberIds)].filter((id) => id !== me.id);
    if (ids.some((id) => !inCommunity.has(id))) fail(400, 'Add people to the community first');
    const statuses = await Promise.all(ids.map((id) => chats.initialStatus(id, me.id)));
    const group = await db.transaction(async (tx) => {
      const [created] = await tx.insert(conversations).values({ kind: 'group', title, description, createdBy: me.id, communityId: community.id }).returning();
      await tx.insert(members).values([
        { conversationId: created!.id, userId: me.id, role: 'admin', status: 'accepted' },
        ...ids.map((id, i) => ({ conversationId: created!.id, userId: id, status: statuses[i]! })),
      ]);
      await tx.insert(conversationEvents).values({ conversationId: created!.id, actorId: me.id, kind: 'created', detail: title });
      return created!;
    });
    hub.send(ids, { type: 'conversation_changed', conversationId: group.id });
    await notifyCommunity(community.id, announcements.id);
    return c.json({ community: await oneView(me.id, community.id), conversation: await chats.oneView(me, group.id) }, 201);
  });

  /** Bring an existing group (that I admin) into the community. */
  app.post('/communities/:id/groups/link', auth, zValidator('param', z.object({ id: uuid })),
    zValidator('json', z.object({ conversationId: uuid })), async (c) => {
      const me = c.var.user;
      const { community, announcements } = await requireAdmin(c.req.valid('param').id, me.id);
      const [row] = await db.select({ conversation: conversations, member: members }).from(conversations)
        .innerJoin(members, and(eq(members.conversationId, conversations.id), eq(members.userId, me.id)))
        .where(eq(conversations.id, c.req.valid('json').conversationId));
      if (!row || row.conversation.kind !== 'group' || row.member.role !== 'admin') fail(403, 'You can only add groups you admin');
      if (row.conversation.communityId) fail(409, 'That group is already in a community');
      await db.update(conversations).set({ communityId: community.id }).where(eq(conversations.id, row.conversation.id));
      hub.send(await memberIds(ctx, row.conversation.id), { type: 'conversation_changed', conversationId: row.conversation.id });
      await notifyCommunity(community.id, announcements.id);
      return c.json({ community: await oneView(me.id, community.id) });
    });

  app.delete('/communities/:id/groups/:groupId', auth, zValidator('param', z.object({ id: uuid, groupId: uuid })), async (c) => {
    const me = c.var.user;
    const { community, announcements } = await requireAdmin(c.req.valid('param').id, me.id);
    const [unlinked] = await db.update(conversations).set({ communityId: null })
      .where(and(eq(conversations.id, c.req.valid('param').groupId), eq(conversations.communityId, community.id), eq(conversations.announcements, false)))
      .returning();
    if (!unlinked) fail(404, 'Group not found');
    hub.send(await memberIds(ctx, unlinked.id), { type: 'conversation_changed', conversationId: unlinked.id });
    await notifyCommunity(community.id, announcements.id);
    return c.json({ community: await oneView(me.id, community.id) });
  });

  /** Community members can join any of its groups themselves. */
  app.post('/communities/:id/groups/:groupId/join', auth, zValidator('param', z.object({ id: uuid, groupId: uuid })), async (c) => {
    const me = c.var.user;
    const { community, member } = await requireCommunity(c.req.valid('param').id, me.id);
    if (member.status !== 'accepted') fail(403, 'Join the community first');
    const [group] = await db.select().from(conversations)
      .where(and(eq(conversations.id, c.req.valid('param').groupId), eq(conversations.communityId, community.id), eq(conversations.announcements, false)));
    if (!group) fail(404, 'Group not found');
    const current = await memberIds(ctx, group.id);
    if (!current.includes(me.id)) {
      if (current.length >= MAX_GROUP_MEMBERS) fail(400, `Groups can have up to ${MAX_GROUP_MEMBERS} people`);
      await db.insert(members).values({ conversationId: group.id, userId: me.id, status: 'accepted' }).onConflictDoNothing();
      await chats.logEvent(group.id, me.id, 'joined');
      hub.send([...current, me.id], { type: 'conversation_changed', conversationId: group.id });
    }
    return c.json({ conversation: await chats.oneView(me, group.id) });
  });

  /** Leave the community: its announcements and every one of its groups I'm in. */
  app.delete('/communities/:id/membership', auth, zValidator('param', z.object({ id: uuid })), async (c) => {
    const me = c.var.user;
    const { community, announcements } = await requireCommunity(c.req.valid('param').id, me.id);
    await leaveAll(community.id, announcements.id, me.id, me.id);
    return c.json({ ok: true });
  });

  /** Admins remove someone from the whole community. */
  app.delete('/communities/:id/members/:userId', auth, zValidator('param', z.object({ id: uuid, userId: uuid })), async (c) => {
    const me = c.var.user;
    const { community, announcements } = await requireAdmin(c.req.valid('param').id, me.id);
    const userId = c.req.valid('param').userId;
    if (!(await memberIds(ctx, announcements.id)).includes(userId)) fail(404, "They're not in this community");
    await leaveAll(community.id, announcements.id, userId, me.id);
    return c.json({ community: await oneView(me.id, community.id) });
  });

  async function leaveAll(communityId: string, announcementsId: string, userId: string, actorId: string) {
    const groups = await db.select({ id: conversations.id }).from(conversations)
      .innerJoin(members, and(eq(members.conversationId, conversations.id), eq(members.userId, userId)))
      .where(and(eq(conversations.communityId, communityId), eq(conversations.announcements, false)));
    for (const g of groups) await chats.removeMember(g.id, userId, actorId);
    await notifyCommunity(communityId, announcementsId, [userId]);
    await chats.removeMember(announcementsId, userId, actorId);
  }
}
