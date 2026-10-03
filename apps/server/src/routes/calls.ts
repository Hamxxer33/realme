import { createHmac } from 'node:crypto';
import { zValidator } from '@hono/zod-validator';
import { and, desc, eq, isNull, lt, or, sql } from 'drizzle-orm';
import { z } from 'zod';
import { type App, type Ctx, HOUR, blockedBetween, fail, publicUser, rateLimit, requireMembership, requireUser } from '../context';
import { calls, members, users } from '../db/schema';
import { uuid } from '../validation';

/** An unanswered call stops ringing after this long. */
export const RING_TIMEOUT_MS = 45_000;
/** A connected call nobody hung up (both phones died) is closed after this. */
const STALE_CALL_MS = 6 * HOUR;
const MAX_SIGNAL_CHARS = 64_000;

export interface IceConfig {
  stunUrls: string[];
  turnUrls: string[];
  /** coturn `static-auth-secret`: short-lived credentials per user (preferred). */
  turnSecret?: string;
  /** …or one fixed username/credential pair. */
  turnUsername?: string;
  turnCredential?: string;
}

type CallRow = typeof calls.$inferSelect;
type CallStatus = 'ringing' | 'active' | 'answered' | 'missed' | 'declined' | 'cancelled' | 'failed';

function statusOf(c: CallRow): CallStatus {
  if (!c.endedAt) return c.answeredAt ? 'active' : 'ringing';
  if (c.answeredAt) return c.endReason === 'failed' ? 'failed' : 'answered';
  return c.endReason === 'hangup' ? 'cancelled' : (c.endReason ?? 'missed');
}

export function registerCalls(app: App, ctx: Ctx, ice: IceConfig = { stunUrls: [], turnUrls: [] }) {
  const { db, hub } = ctx;
  const auth = requireUser(ctx);

  const view = (c: CallRow, meId: string, peer: typeof users.$inferSelect) => ({
    id: c.id,
    conversationId: c.conversationId,
    kind: c.kind,
    direction: c.callerId === meId ? 'outgoing' as const : 'incoming' as const,
    status: statusOf(c),
    createdAt: c.createdAt,
    answeredAt: c.answeredAt,
    endedAt: c.endedAt,
    durationSeconds: c.answeredAt && c.endedAt ? Math.round((c.endedAt.getTime() - c.answeredAt.getTime()) / 1000) : null,
    peer: publicUser(peer),
  });

  /** Close calls that rang out, or were left "connected" by phones that vanished. */
  async function sweep() {
    const now = ctx.now();
    const rangOut = await db.update(calls).set({ endedAt: now, endReason: 'missed' })
      .where(and(isNull(calls.endedAt), isNull(calls.answeredAt), lt(calls.createdAt, new Date(now.getTime() - RING_TIMEOUT_MS))))
      .returning();
    await db.update(calls).set({ endedAt: now, endReason: 'hangup' })
      .where(and(isNull(calls.endedAt), lt(calls.answeredAt, new Date(now.getTime() - STALE_CALL_MS))));
    for (const c of rangOut) notify(c);
  }

  async function load(id: string, meId: string) {
    const [c] = await db.select().from(calls).where(and(eq(calls.id, id), or(eq(calls.callerId, meId), eq(calls.calleeId, meId))));
    if (!c) fail(404, 'Call not found');
    return c;
  }

  async function viewFor(c: CallRow, meId: string) {
    const [peer] = await db.select().from(users).where(eq(users.id, c.callerId === meId ? c.calleeId : c.callerId));
    return view(c, meId, peer!);
  }

  function notify(c: CallRow) {
    // Each side gets the call from their own point of view; they re-fetch it.
    hub.send([c.callerId, c.calleeId], { type: 'call_update', callId: c.id });
  }

  const inCall = (userId: string) => db.select({ id: calls.id }).from(calls)
    .where(and(isNull(calls.endedAt), or(eq(calls.callerId, userId), eq(calls.calleeId, userId))));

  app.get('/calls/ice', auth, (c) => {
    const servers: Array<{ urls: string[]; username?: string; credential?: string }> = [];
    if (ice.stunUrls.length) servers.push({ urls: ice.stunUrls });
    if (ice.turnUrls.length) {
      if (ice.turnSecret) {
        // coturn REST API: valid for a day, tied to this user.
        const username = `${Math.floor(ctx.now().getTime() / 1000) + 24 * 3600}:${c.var.user.id}`;
        const credential = createHmac('sha1', ice.turnSecret).update(username).digest('base64');
        servers.push({ urls: ice.turnUrls, username, credential });
      } else if (ice.turnUsername && ice.turnCredential) {
        servers.push({ urls: ice.turnUrls, username: ice.turnUsername, credential: ice.turnCredential });
      }
    }
    return c.json({ iceServers: servers });
  });

  /** Call history, newest first. */
  app.get('/calls', auth, async (c) => {
    const me = c.var.user;
    await sweep();
    const rows = await db.select({ call: calls, peer: users }).from(calls)
      .innerJoin(users, sql`${users.id} = case when ${calls.callerId} = ${me.id} then ${calls.calleeId} else ${calls.callerId} end`)
      .where(or(eq(calls.callerId, me.id), eq(calls.calleeId, me.id)))
      .orderBy(desc(calls.createdAt))
      .limit(100);
    return c.json({ calls: rows.map((r) => view(r.call, me.id, r.peer)) });
  });

  app.get('/calls/:id', auth, zValidator('param', z.object({ id: uuid })), async (c) => {
    await sweep();
    const call = await load(c.req.valid('param').id, c.var.user.id);
    return c.json({ call: await viewFor(call, c.var.user.id) });
  });

  /** Ring the other person in a 1:1 chat. */
  app.post('/calls', auth, zValidator('json', z.object({ conversationId: uuid, kind: z.enum(['audio', 'video']) })), async (c) => {
    const me = c.var.user;
    const { conversationId, kind } = c.req.valid('json');
    rateLimit(ctx, `call:${me.id}`, 30, HOUR);
    await sweep();
    const { conversation, member } = await requireMembership(ctx, conversationId, me.id);
    if (conversation.kind !== 'direct') fail(400, 'Group calls are not supported yet');
    const [other] = await db.select().from(members)
      .where(and(eq(members.conversationId, conversationId), sql`${members.userId} <> ${me.id}`));
    if (!other || member.status !== 'accepted' || other.status !== 'accepted') fail(403, 'You can call someone once you both have accepted the chat');
    if (await blockedBetween(ctx, me.id, other.userId)) fail(403, "You can't call this person");
    if ((await inCall(me.id)).length) fail(409, "You're already on a call");
    const busy = (await inCall(other.userId)).length > 0;

    const [call] = await db.insert(calls).values({
      // All call times come from the app clock (ring timeouts and durations compare them).
      conversationId, callerId: me.id, calleeId: other.userId, kind, createdAt: ctx.now(),
      ...(busy ? { endedAt: ctx.now(), endReason: 'missed' as const } : {}),
    }).returning();
    if (busy) {
      notify(call!);
      fail(409, "They're on another call");
    }
    hub.send([other.userId], { type: 'call_ring', callId: call!.id });
    const [callee] = await db.select({ pushToken: users.pushToken }).from(users).where(eq(users.id, other.userId));
    if (callee?.pushToken && !hub.isOnline(other.userId)) {
      void ctx.push.send(callee.pushToken, me.displayName, kind === 'video' ? '📹 Incoming video call' : '📞 Incoming call');
    }
    return c.json({ call: await viewFor(call!, me.id) }, 201);
  });

  app.post('/calls/:id/answer', auth, zValidator('param', z.object({ id: uuid })), async (c) => {
    const me = c.var.user;
    await sweep();
    const call = await load(c.req.valid('param').id, me.id);
    if (call.calleeId !== me.id) fail(403, 'Only the person being called can answer');
    if (call.endedAt) fail(409, 'This call has ended');
    const [answered] = await db.update(calls).set({ answeredAt: ctx.now() })
      .where(and(eq(calls.id, call.id), isNull(calls.endedAt), isNull(calls.answeredAt))).returning();
    if (answered) notify(answered);
    return c.json({ call: await viewFor(answered ?? call, me.id) });
  });

  /**
   * Hang up, decline or cancel — the server works out which. `failed` is for
   * calls that couldn't connect; `missed` for a ring that timed out on the phone.
   */
  const endBody = z.object({ reason: z.enum(['failed', 'missed']).optional() });
  app.post('/calls/:id/end', auth, zValidator('param', z.object({ id: uuid })), async (c) => {
      const me = c.var.user;
      // The body is optional: a plain hang-up sends none.
      const parsed = endBody.safeParse(await c.req.json().catch(() => ({})));
      if (!parsed.success) fail(400, 'Invalid reason');
      const call = await load(c.req.valid('param').id, me.id);
      if (!call.endedAt) {
        const { reason } = parsed.data;
        const endReason = reason ?? (call.answeredAt ? 'hangup' : call.calleeId === me.id ? 'declined' : 'hangup');
        const [ended] = await db.update(calls).set({ endedAt: ctx.now(), endReason })
          .where(and(eq(calls.id, call.id), isNull(calls.endedAt))).returning();
        if (ended) notify(ended);
        return c.json({ call: await viewFor(ended ?? call, me.id) });
      }
      return c.json({ call: await viewFor(call, me.id) });
    });

  /**
   * Relay an end-to-end encrypted signaling payload (SDP offer/answer, ICE
   * candidates) to the other side of a live call. The server can't read or
   * alter it, so it can't swap in its own media keys.
   */
  async function relaySignal(fromUserId: string, msg: { callId?: unknown; payload?: unknown }) {
    if (typeof msg.callId !== 'string' || !uuid.safeParse(msg.callId).success) return;
    if (!msg.payload || typeof msg.payload !== 'object' || JSON.stringify(msg.payload).length > MAX_SIGNAL_CHARS) return;
    const [call] = await db.select().from(calls).where(eq(calls.id, msg.callId));
    if (!call || call.endedAt || (call.callerId !== fromUserId && call.calleeId !== fromUserId)) return;
    const to = call.callerId === fromUserId ? call.calleeId : call.callerId;
    hub.send([to], { type: 'call_signal', callId: call.id, from: fromUserId, payload: msg.payload });
  }

  return { relaySignal };
}
