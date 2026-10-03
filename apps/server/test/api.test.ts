import { PGlite } from '@electric-sql/pglite';
import { serve, type ServerType } from '@hono/node-server';
import { createCrypto, type KeyPair, type MessageBody } from '@realme/crypto';
import { sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import sodiumLib from 'libsodium-wrappers-sumo';
import type { AddressInfo } from 'node:net';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import WebSocket from 'ws';
import { createApp } from '../src/app';
import type { DB } from '../src/db/client';
import * as schema from '../src/db/schema';
import type { Storage } from '../src/storage';

const FAST = { opsLimit: 1, memLimit: 8192 * 4 };
let crypto: ReturnType<typeof createCrypto>;

beforeAll(async () => {
  await sodiumLib.ready;
  crypto = createCrypto(sodiumLib);
});

let ctx: Awaited<ReturnType<typeof setup>>;
beforeEach(async () => {
  ctx = await setup();
});
afterEach(async () => {
  await ctx.close();
});

interface Person {
  token: string;
  id: string;
  username: string;
  keys: KeyPair;
}

async function setup() {
  const pg = new PGlite();
  const db = drizzle(pg, { schema });
  await migrate(db, { migrationsFolder: new URL('../drizzle', import.meta.url).pathname });
  const deletedPrefixes: string[] = [];
  const pushes: Array<{ to: string; title: string; body: string }> = [];
  const storage: Storage = {
    presignUpload: async (key) => `https://storage.test/put/${key}`,
    presignDownload: async (key) => `https://storage.test/get/${key}`,
    deletePrefix: async (prefix) => void deletedPrefixes.push(prefix),
  };
  let clock = new Date('2026-02-14T12:00:00Z');
  const { app, injectWebSocket } = createApp({
    db: db as unknown as DB,
    storage,
    push: { send: async (to, title, body) => void pushes.push({ to, title, body }) },
    jwtSecret: 'x'.repeat(48),
    now: () => clock,
  });

  async function call(method: string, path: string, opts: { as?: Person | string; body?: unknown } = {}) {
    const token = typeof opts.as === 'string' ? opts.as : opts.as?.token;
    const res = await app.request(path, {
      method,
      headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
      body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
    });
    return { status: res.status, body: (await res.json()) as any };
  }

  async function signup(username: string, password = 'a long password'): Promise<Person> {
    const email = `${username}@example.com`;
    const keys = crypto.generateKeyPair();
    const { authSecret, backupKey } = crypto.derivePasswordSecrets(email, password, FAST);
    const res = await call('POST', '/auth/signup', {
      body: { email, username, displayName: username[0]!.toUpperCase() + username.slice(1), authSecret, publicKey: keys.publicKey, keyBackup: crypto.wrapSecretKey(keys.secretKey, backupKey) },
    });
    expect(res.status).toBe(201);
    return { token: res.body.token, id: res.body.user.id, username, keys };
  }

  /** Encrypt for the conversation's current members, as the server reports them. */
  async function send(from: Person, conversationId: string, body: MessageBody, clientId = Math.random().toString(36).slice(2)) {
    const conv = (await call('GET', `/conversations/${conversationId}`, { as: from })).body.conversation;
    const recipients = Object.fromEntries(conv.members.map((m: { id: string; publicKey: string }) => [m.id, m.publicKey]));
    const enc = crypto.encryptMessage(body, { conversationId, senderId: from.id, mySecretKey: from.keys.secretKey, recipients });
    return call('POST', `/conversations/${conversationId}/messages`, { as: from, body: { ...enc, clientId } });
  }

  function open(as: Person, sender: Person, message: any) {
    return crypto.decryptMessage<MessageBody>(message, {
      conversationId: message.conversationId, senderId: sender.id, senderPublicKey: sender.keys.publicKey, mySecretKey: as.keys.secretKey,
    });
  }

  async function direct(from: Person, to: Person) {
    const res = await call('POST', '/conversations/direct', { as: from, body: { userId: to.id } });
    expect(res.status).toBe(200);
    return res.body.conversation.id as string;
  }

  let server: ServerType | undefined;
  async function listen() {
    server = serve({ fetch: app.fetch, port: 0 });
    injectWebSocket(server);
    await new Promise((r) => server!.once('listening', r));
    return `ws://127.0.0.1:${(server.address() as AddressInfo).port}/ws`;
  }

  return {
    db, call, signup, send, open, direct, listen, deletedPrefixes, pushes,
    advance: (ms: number) => (clock = new Date(clock.getTime() + ms)),
    close: async () => {
      await new Promise((r) => (server ? server.close(r) : r(null)));
      await pg.close();
    },
  };
}

describe('accounts', () => {
  it('signs up with a unique username and restores the key on a new phone', async () => {
    const ana = await ctx.signup('ana');
    expect((await ctx.call('GET', '/auth/username-available?username=ANA')).body.available).toBe(false);
    expect((await ctx.call('GET', '/auth/username-available?username=@ana_2')).body.available).toBe(true);
    expect((await ctx.call('GET', '/auth/username-available?username=admin')).body.available).toBe(false);

    const { authSecret, backupKey } = crypto.derivePasswordSecrets('ana@example.com', 'a long password', FAST);
    const res = await ctx.call('POST', '/auth/login', { body: { email: 'ANA@example.com', authSecret } });
    expect(res.status).toBe(200);
    expect(res.body.user.username).toBe('ana');
    expect(crypto.unwrapSecretKey(res.body.keyBackup, backupKey)).toBe(ana.keys.secretKey);
  });

  it('rejects taken usernames/emails and invalid usernames', async () => {
    await ctx.signup('ana');
    const base = { displayName: 'X', authSecret: 'abc', publicKey: 'abc', keyBackup: { nonce: 'a', ciphertext: 'b' } };
    expect((await ctx.call('POST', '/auth/signup', { body: { ...base, email: 'other@example.com', username: 'Ana' } })).body.error).toMatch(/username/);
    expect((await ctx.call('POST', '/auth/signup', { body: { ...base, email: 'ana@example.com', username: 'ana2' } })).body.error).toMatch(/email/);
    expect((await ctx.call('POST', '/auth/signup', { body: { ...base, email: 'x@example.com', username: 'no spaces' } })).status).toBe(400);
    expect((await ctx.call('POST', '/auth/signup', { body: { ...base, email: 'y@example.com', username: 'support' } })).status).toBe(409);
  });

  it('never stores the password, and rate-limits guessing', async () => {
    await ctx.signup('ana');
    const [row] = await ctx.db.select().from(schema.users);
    expect(JSON.stringify(row)).not.toContain('a long password');
    expect(row!.authHash.startsWith('$argon2')).toBe(true);
    const wrong = crypto.derivePasswordSecrets('ana@example.com', 'nope', FAST).authSecret;
    const statuses = [];
    for (let i = 0; i < 11; i++) statuses.push((await ctx.call('POST', '/auth/login', { body: { email: 'ana@example.com', authSecret: wrong } })).status);
    expect(statuses.slice(0, 10).every((s) => s === 401)).toBe(true);
    expect(statuses[10]).toBe(429);
  });

  it('expires tokens after 30 days', async () => {
    const ana = await ctx.signup('ana');
    ctx.advance(29 * 24 * 3600 * 1000);
    expect((await ctx.call('GET', '/me', { as: ana })).status).toBe(200);
    ctx.advance(2 * 24 * 3600 * 1000);
    expect((await ctx.call('GET', '/me', { as: ana })).status).toBe(401);
  });

  it('finds people by username or name', async () => {
    const ana = await ctx.signup('ana');
    await ctx.signup('anabelle');
    await ctx.signup('ben');
    const found = (await ctx.call('GET', '/users/search?q=@ana', { as: ana })).body.users.map((u: { username: string }) => u.username);
    expect(found).toEqual(['anabelle']); // not yourself
    const byName = (await ctx.call('GET', '/users/search?q=Belle', { as: ana })).body.users.map((u: { username: string }) => u.username);
    expect(byName).toEqual(['anabelle']); // display-name match
    const ben = (await ctx.call('GET', '/users/ben', { as: ana })).body.user;
    expect(ben.username).toBe('ben');
    expect((await ctx.call('GET', `/users/id/${ben.id}`, { as: ana })).body.user.publicKey).toBe(ben.publicKey);
  });
});

describe('direct chats and message requests', () => {
  it('a first message from a stranger lands in Requests until accepted', async () => {
    const [ana, ben] = [await ctx.signup('ana'), await ctx.signup('ben')];
    const conv = await ctx.direct(ana, ben);
    // Nothing shows until there is a message.
    expect((await ctx.call('GET', '/conversations?requests=1', { as: ben })).body.conversations).toEqual([]);
    await ctx.send(ana, conv, { kind: 'text', text: 'hi! loved your post' });

    expect((await ctx.call('GET', '/conversations', { as: ben })).body.conversations).toEqual([]);
    const requests = (await ctx.call('GET', '/conversations?requests=1', { as: ben })).body.conversations;
    expect(requests.map((c: { id: string }) => c.id)).toEqual([conv]);
    expect(requests[0].unreadCount).toBe(1);
    expect(ctx.open(ben, ana, requests[0].lastMessage)).toEqual({ kind: 'text', text: 'hi! loved your post' });

    await ctx.call('POST', `/conversations/${conv}/accept`, { as: ben });
    expect((await ctx.call('GET', '/conversations', { as: ben })).body.conversations.map((c: { id: string }) => c.id)).toEqual([conv]);
    expect((await ctx.call('GET', '/conversations?requests=1', { as: ben })).body.conversations).toEqual([]);
  });

  it('replying accepts a request, and the same two people share one chat', async () => {
    const [ana, ben] = [await ctx.signup('ana'), await ctx.signup('ben')];
    const conv = await ctx.direct(ana, ben);
    await ctx.send(ana, conv, { kind: 'text', text: 'hey' });
    expect(await ctx.direct(ben, ana)).toBe(conv);
    await ctx.send(ben, conv, { kind: 'text', text: 'hey yourself' });
    const view = (await ctx.call('GET', `/conversations/${conv}`, { as: ben })).body.conversation;
    expect(view.myStatus).toBe('accepted');
    expect((await ctx.call('POST', '/conversations/direct', { as: ana, body: { userId: ana.id } })).status).toBe(400);
  });

  it('declining removes it for you only', async () => {
    const [ana, ben] = [await ctx.signup('ana'), await ctx.signup('ben')];
    const conv = await ctx.direct(ana, ben);
    await ctx.send(ana, conv, { kind: 'text', text: 'hi' });
    await ctx.call('DELETE', `/conversations/${conv}/membership`, { as: ben });
    expect((await ctx.call('GET', '/conversations?requests=1', { as: ben })).body.conversations).toEqual([]);
    expect((await ctx.call('GET', `/conversations/${conv}`, { as: ben })).status).toBe(404);
    expect((await ctx.call('GET', `/conversations/${conv}`, { as: ana })).status).toBe(200);
  });

  it('pushes "message request" for strangers and never includes content', async () => {
    const [ana, ben] = [await ctx.signup('ana'), await ctx.signup('ben')];
    await ctx.call('PUT', '/me/push-token', { as: ben, body: { token: 'ExponentPushToken[ben]' } });
    const conv = await ctx.direct(ana, ben);
    await ctx.send(ana, conv, { kind: 'text', text: 'secret words' });
    await ctx.call('POST', `/conversations/${conv}/accept`, { as: ben });
    await ctx.send(ana, conv, { kind: 'text', text: 'more secret words' });
    await new Promise((r) => setTimeout(r, 10));
    expect(ctx.pushes.map((p) => p.body)).toEqual(['New message request', 'Sent you a message 💌']);
    expect(JSON.stringify(ctx.pushes)).not.toContain('secret');
  });
});

describe('group chats', () => {
  async function group(admin: Person, others: Person[], title = 'Trip planning') {
    const res = await ctx.call('POST', '/conversations/group', { as: admin, body: { title, memberIds: others.map((o) => o.id) } });
    expect(res.status).toBe(201);
    return res.body.conversation;
  }

  it('every member can read; the server stores only ciphertext and hands out each member only their own key', async () => {
    const [ana, ben, cat] = [await ctx.signup('ana'), await ctx.signup('ben'), await ctx.signup('cat')];
    const conv = await group(ana, [ben, cat]);
    expect(conv.members.map((m: { username: string }) => m.username)).toEqual(['ana', 'ben', 'cat']);
    await ctx.send(ana, conv.id, { kind: 'text', text: 'flights are booked ✈️' });

    const [row] = await ctx.db.select().from(schema.messages);
    expect(JSON.stringify(row)).not.toContain('flights');
    for (const p of [ana, ben, cat]) {
      const [msg] = (await ctx.call('GET', `/conversations/${conv.id}/messages`, { as: p })).body.messages;
      expect(msg.key).toEqual(row!.keys[p.id]);
      expect(ctx.open(p, ana, msg)).toEqual({ kind: 'text', text: 'flights are booked ✈️' });
    }
  });

  it('refuses a message whose keys don\'t match the members', async () => {
    const [ana, ben, cat] = [await ctx.signup('ana'), await ctx.signup('ben'), await ctx.signup('cat')];
    const conv = await group(ana, [ben, cat]);
    const enc = crypto.encryptMessage({ kind: 'text', text: 'leaving cat out' }, {
      conversationId: conv.id, senderId: ana.id, mySecretKey: ana.keys.secretKey,
      recipients: { [ana.id]: ana.keys.publicKey, [ben.id]: ben.keys.publicKey },
    });
    const res = await ctx.call('POST', `/conversations/${conv.id}/messages`, { as: ana, body: { ...enc, clientId: 'x' } });
    expect(res.status).toBe(409);
  });

  it('invites are requests unless you already chat with the person', async () => {
    const [ana, ben, cat] = [await ctx.signup('ana'), await ctx.signup('ben'), await ctx.signup('cat')];
    const dm = await ctx.direct(ana, ben);
    await ctx.send(ana, dm, { kind: 'text', text: 'hi' });
    await ctx.call('POST', `/conversations/${dm}/accept`, { as: ben });
    const conv = await group(ana, [ben, cat]);
    const status = Object.fromEntries(conv.members.map((m: { username: string; status: string }) => [m.username, m.status]));
    expect(status).toEqual({ ana: 'accepted', ben: 'accepted', cat: 'pending' });
  });

  it('only admins manage members; leaving hands admin on; the last one out deletes it', async () => {
    const [ana, ben, cat, dan] = [await ctx.signup('ana'), await ctx.signup('ben'), await ctx.signup('cat'), await ctx.signup('dan')];
    const conv = await group(ana, [ben, cat]);
    expect((await ctx.call('POST', `/conversations/${conv.id}/members`, { as: ben, body: { userIds: [dan.id] } })).status).toBe(403);
    expect((await ctx.call('POST', `/conversations/${conv.id}/members`, { as: ana, body: { userIds: [dan.id] } })).body.conversation.members).toHaveLength(4);
    expect((await ctx.call('DELETE', `/conversations/${conv.id}/members/${dan.id}`, { as: ana })).status).toBe(200);
    expect((await ctx.call('GET', `/conversations/${conv.id}`, { as: dan })).status).toBe(404);

    await ctx.call('POST', `/conversations/${conv.id}/accept`, { as: cat });
    await ctx.call('DELETE', `/conversations/${conv.id}/membership`, { as: ana });
    const after = (await ctx.call('GET', `/conversations/${conv.id}`, { as: cat })).body.conversation;
    expect(after.members.find((m: { username: string }) => m.username === 'cat').role).toBe('admin');

    await ctx.call('DELETE', `/conversations/${conv.id}/membership`, { as: ben });
    await ctx.call('DELETE', `/conversations/${conv.id}/membership`, { as: cat });
    expect(await ctx.db.select().from(schema.conversations)).toEqual([]);
    expect(ctx.deletedPrefixes).toContain(`conversations/${conv.id}/`);
  });

  it('a new member cannot read messages from before they joined', async () => {
    const [ana, ben, cat] = [await ctx.signup('ana'), await ctx.signup('ben'), await ctx.signup('cat')];
    const conv = await group(ana, [ben]);
    await ctx.send(ana, conv.id, { kind: 'text', text: 'before cat' });
    await ctx.call('POST', `/conversations/${conv.id}/members`, { as: ana, body: { userIds: [cat.id] } });
    const [msg] = (await ctx.call('GET', `/conversations/${conv.id}/messages`, { as: cat })).body.messages;
    expect(msg.key).toBeNull();
  });
});

describe('reading and history', () => {
  it('tracks read position per member with full timestamp precision', async () => {
    const [ana, ben] = [await ctx.signup('ana'), await ctx.signup('ben')];
    const conv = await ctx.direct(ana, ben);
    const msg = (await ctx.send(ana, conv, { kind: 'text', text: 'a' })).body.message;
    await ctx.db.execute(sql`update messages set created_at = '2026-02-14T12:00:00.123456Z' where id = ${msg.id}`);
    expect((await ctx.call('GET', '/conversations?requests=1', { as: ben })).body.conversations[0].unreadCount).toBe(1);
    await ctx.call('POST', `/conversations/${conv}/read`, { as: ben, body: { upTo: msg.id } });
    expect((await ctx.call('GET', '/conversations?requests=1', { as: ben })).body.conversations[0].unreadCount).toBe(0);
  });

  it('pages without skipping messages created in the same millisecond', async () => {
    const [ana, ben] = [await ctx.signup('ana'), await ctx.signup('ben')];
    const conv = await ctx.direct(ana, ben);
    const ids: string[] = [];
    for (let i = 0; i < 4; i++) ids.push((await ctx.send(ana, conv, { kind: 'text', text: `m${i}` })).body.message.id);
    for (let i = 0; i < 4; i++) {
      await ctx.db.execute(sql`update messages set created_at = ${`2026-02-14T12:00:00.123${400 + i * 100}Z`}::timestamptz where id = ${ids[i]}`);
    }
    const seen: string[] = [];
    let before: string | undefined;
    for (let page = 0; page < 5; page++) {
      const res = (await ctx.call('GET', `/conversations/${conv}/messages?limit=1${before ? `&before=${before}` : ''}`, { as: ben })).body;
      seen.push(...res.messages.map((m: { id: string }) => m.id));
      if (!res.hasMore) break;
      before = res.messages[0].id;
    }
    expect(seen).toEqual([...ids].reverse());
  });

  it('dedupes retried sends', async () => {
    const [ana, ben] = [await ctx.signup('ana'), await ctx.signup('ben')];
    const conv = await ctx.direct(ana, ben);
    const a = await ctx.send(ana, conv, { kind: 'text', text: 'hi' }, 'same');
    const b = await ctx.send(ana, conv, { kind: 'text', text: 'hi' }, 'same');
    expect(b.body.message.id).toBe(a.body.message.id);
    expect(await ctx.db.select().from(schema.messages)).toHaveLength(1);
  });

  it('outsiders cannot see a conversation or its media', async () => {
    const [ana, ben, eve] = [await ctx.signup('ana'), await ctx.signup('ben'), await ctx.signup('eve')];
    const conv = await ctx.direct(ana, ben);
    expect((await ctx.call('GET', `/conversations/${conv}/messages`, { as: eve })).status).toBe(404);
    const up = (await ctx.call('POST', '/media/upload-url', { as: ana, body: { size: 10, conversationId: conv } })).body;
    expect(up.objectKey).toMatch(new RegExp(`^conversations/${conv}/`));
    expect((await ctx.call('POST', '/media/download-url', { as: ben, body: { objectKey: up.objectKey } })).status).toBe(200);
    expect((await ctx.call('POST', '/media/download-url', { as: eve, body: { objectKey: up.objectKey } })).status).toBe(404);
    expect((await ctx.call('POST', '/media/upload-url', { as: eve, body: { size: 10, conversationId: conv } })).status).toBe(404);
  });
});

describe('per-chat settings', () => {
  it('muting stops push notifications for that chat only', async () => {
    const [ana, ben] = [await ctx.signup('ana'), await ctx.signup('ben')];
    await ctx.call('PUT', '/me/push-token', { as: ben, body: { token: 'ExponentPushToken[ben]' } });
    const conv = await ctx.direct(ana, ben);
    await ctx.call('POST', `/conversations/${conv}/accept`, { as: ben });
    const res = await ctx.call('PATCH', `/conversations/${conv}/me`, { as: ben, body: { muted: true } });
    expect(res.body.conversation.myMuted).toBe(true);
    await ctx.send(ana, conv, { kind: 'text', text: 'shh' });
    await new Promise((r) => setTimeout(r, 10));
    expect(ctx.pushes).toEqual([]);
    await ctx.call('PATCH', `/conversations/${conv}/me`, { as: ben, body: { muted: false } });
    await ctx.send(ana, conv, { kind: 'text', text: 'hello again' });
    await new Promise((r) => setTimeout(r, 10));
    expect(ctx.pushes).toHaveLength(1);
  });

  it('clearing a chat hides its history for me only; new messages still arrive', async () => {
    const [ana, ben] = [await ctx.signup('ana'), await ctx.signup('ben')];
    const conv = await ctx.direct(ana, ben);
    await ctx.send(ana, conv, { kind: 'text', text: 'old 1' });
    await ctx.send(ben, conv, { kind: 'text', text: 'old 2' });
    const cleared = (await ctx.call('POST', `/conversations/${conv}/clear`, { as: ben })).body.conversation;
    expect(cleared.lastMessage).toBeNull();
    expect(cleared.unreadCount).toBe(0);
    expect((await ctx.call('GET', `/conversations/${conv}/messages`, { as: ben })).body.messages).toEqual([]);
    expect((await ctx.call('GET', `/conversations/${conv}/messages`, { as: ana })).body.messages).toHaveLength(2);

    await new Promise((r) => setTimeout(r, 5));
    await ctx.send(ana, conv, { kind: 'text', text: 'new' });
    const after = (await ctx.call('GET', `/conversations/${conv}/messages`, { as: ben })).body.messages;
    expect(after.map((m: any) => ctx.open(ben, ana, m))).toEqual([{ kind: 'text', text: 'new' }]);
    expect((await ctx.call('GET', '/conversations', { as: ben })).body.conversations[0].unreadCount).toBe(1);
  });
});

describe('privacy', () => {
  it('read receipts are mutual: turning them off hides both directions', async () => {
    const [ana, ben] = [await ctx.signup('ana'), await ctx.signup('ben')];
    const conv = await ctx.direct(ana, ben);
    const msg = (await ctx.send(ana, conv, { kind: 'text', text: 'hi' })).body.message;
    await ctx.call('POST', `/conversations/${conv}/read`, { as: ben, body: { upTo: msg.id } });
    const benAsSeenByAna = () => ctx.call('GET', `/conversations/${conv}`, { as: ana })
      .then((r) => r.body.conversation.members.find((m: { id: string }) => m.id === ben.id).lastReadAt);
    expect(await benAsSeenByAna()).not.toBeNull();

    expect((await ctx.call('PATCH', '/me', { as: ben, body: { readReceipts: false } })).body.user.readReceipts).toBe(false);
    expect(await benAsSeenByAna()).toBeNull();
    // …and Ben no longer sees Ana's either.
    await ctx.call('POST', `/conversations/${conv}/read`, { as: ana, body: { upTo: msg.id } });
    const anaAsSeenByBen = (await ctx.call('GET', `/conversations/${conv}`, { as: ben })).body.conversation.members
      .find((m: { id: string }) => m.id === ana.id).lastReadAt;
    expect(anaAsSeenByBen).toBeNull();
    // Ben still sees his own read position (for unread counts).
    const own = (await ctx.call('GET', `/conversations/${conv}`, { as: ben })).body.conversation.members
      .find((m: { id: string }) => m.id === ben.id).lastReadAt;
    expect(own).not.toBeNull();
  });
});

describe('blocking and reporting', () => {
  it('blocking stops chats, search, profiles, group adds and posts — both ways', async () => {
    const [ana, ben, cat] = [await ctx.signup('ana'), await ctx.signup('ben'), await ctx.signup('cat')];
    const conv = await ctx.direct(ben, ana);
    await ctx.send(ben, conv, { kind: 'text', text: 'hi' });
    await ctx.call('POST', '/posts', { as: ben, body: { text: 'ben post' } });

    expect((await ctx.call('POST', '/blocks', { as: ana, body: { userId: ben.id } })).status).toBe(200);

    expect((await ctx.call('GET', '/conversations?requests=1', { as: ana })).body.conversations).toEqual([]);
    expect((await ctx.send(ben, conv, { kind: 'text', text: 'are you there' })).status).toBe(403);
    expect((await ctx.call('POST', '/conversations/direct', { as: ben, body: { userId: ana.id } })).status).toBe(404);
    expect((await ctx.call('GET', '/users/search?q=ana', { as: ben })).body.users).toEqual([]);
    expect((await ctx.call('GET', '/users/ana', { as: ben })).status).toBe(404);
    expect((await ctx.call('GET', '/users/ben', { as: ana })).body.blockedByMe).toBe(true);
    expect((await ctx.call('GET', '/posts', { as: ana })).body.posts).toEqual([]);
    expect((await ctx.call('POST', '/conversations/group', { as: ben, body: { title: 'g', memberIds: [ana.id, cat.id] } })).status).toBe(404);
    expect((await ctx.call('GET', '/blocks', { as: ana })).body.users.map((u: { username: string }) => u.username)).toEqual(['ben']);

    await ctx.call('DELETE', `/blocks/${ben.id}`, { as: ana });
    expect((await ctx.call('GET', '/posts', { as: ana })).body.posts).toHaveLength(1);
  });

  it('records reports, only for things you can see', async () => {
    const [ana, ben, eve] = [await ctx.signup('ana'), await ctx.signup('ben'), await ctx.signup('eve')];
    const conv = await ctx.direct(ben, ana);
    const ok = await ctx.call('POST', '/reports', { as: ana, body: { reason: 'harassment', userId: ben.id, conversationId: conv, details: 'he said: "…"' } });
    expect(ok.status).toBe(201);
    expect((await ctx.call('POST', '/reports', { as: eve, body: { reason: 'spam', conversationId: conv } })).status).toBe(404);
    expect((await ctx.call('POST', '/reports', { as: ana, body: { reason: 'spam' } })).status).toBe(400);
    const rows = await ctx.db.select().from(schema.reports);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ reporterId: ana.id, targetUserId: ben.id, reason: 'harassment' });
  });
});

describe('timeline', () => {
  it('posts, likes and comments', async () => {
    const [ana, ben] = [await ctx.signup('ana'), await ctx.signup('ben')];
    const { post } = (await ctx.call('POST', '/posts', { as: ana, body: { text: 'sunset walk 🌅' } })).body;
    ctx.advance(1000);
    await ctx.call('POST', '/posts', { as: ben, body: { text: 'coffee first' } });

    const feed = (await ctx.call('GET', '/posts', { as: ben })).body.posts;
    expect(feed.map((p: { text: string }) => p.text)).toEqual(['coffee first', 'sunset walk 🌅']);

    await ctx.call('PUT', `/posts/${post.id}/like`, { as: ben });
    await ctx.call('PUT', `/posts/${post.id}/like`, { as: ben }); // idempotent
    await ctx.call('POST', `/posts/${post.id}/comments`, { as: ben, body: { text: 'gorgeous' } });
    const seen = (await ctx.call('GET', `/posts/${post.id}`, { as: ben })).body.post;
    expect(seen).toMatchObject({ likeCount: 1, likedByMe: true, commentCount: 1 });
    expect((await ctx.call('GET', `/posts/${post.id}/comments`, { as: ana })).body.comments[0].text).toBe('gorgeous');

    await ctx.call('DELETE', `/posts/${post.id}/like`, { as: ben });
    expect((await ctx.call('GET', `/posts/${post.id}`, { as: ana })).body.post.likeCount).toBe(0);
    expect((await ctx.call('GET', '/users/ana/posts', { as: ben })).body.posts).toHaveLength(1);
  });

  it('only the author deletes a post; post photos must be your own uploads', async () => {
    const [ana, ben] = [await ctx.signup('ana'), await ctx.signup('ben')];
    const { post } = (await ctx.call('POST', '/posts', { as: ana, body: { text: 'mine' } })).body;
    expect((await ctx.call('DELETE', `/posts/${post.id}`, { as: ben })).status).toBe(404);
    expect((await ctx.call('DELETE', `/posts/${post.id}`, { as: ana })).status).toBe(200);

    const up = (await ctx.call('POST', '/media/upload-url', { as: ben, body: { size: 10 } })).body;
    expect(up.objectKey).toMatch(new RegExp(`^posts/${ben.id}/`));
    expect((await ctx.call('POST', '/posts', { as: ana, body: { text: '', media: { objectKey: up.objectKey, width: 1, height: 1 } } })).status).toBe(400);
    expect((await ctx.call('POST', '/posts', { as: ben, body: { text: '', media: { objectKey: up.objectKey, width: 1, height: 1 } } })).status).toBe(201);
    expect((await ctx.call('POST', '/posts', { as: ben, body: { text: '' } })).status).toBe(400);
  });

  it('comment author or post author can delete a comment', async () => {
    const [ana, ben, cat] = [await ctx.signup('ana'), await ctx.signup('ben'), await ctx.signup('cat')];
    const { post } = (await ctx.call('POST', '/posts', { as: ana, body: { text: 'hello' } })).body;
    const { comment } = (await ctx.call('POST', `/posts/${post.id}/comments`, { as: ben, body: { text: 'hi' } })).body;
    expect((await ctx.call('DELETE', `/comments/${comment.id}`, { as: cat })).status).toBe(404);
    expect((await ctx.call('DELETE', `/comments/${comment.id}`, { as: ana })).status).toBe(200);
  });
});

describe('account deletion', () => {
  it('removes the user, their posts and empty chats', async () => {
    const [ana, ben] = [await ctx.signup('ana'), await ctx.signup('ben')];
    const conv = await ctx.direct(ana, ben);
    await ctx.send(ana, conv, { kind: 'text', text: 'hi' });
    await ctx.call('POST', '/posts', { as: ana, body: { text: 'bye' } });
    expect((await ctx.call('DELETE', '/me', { as: ana })).status).toBe(200);
    expect((await ctx.call('GET', '/me', { as: ana })).status).toBe(401);
    expect(await ctx.db.select().from(schema.posts)).toEqual([]);
    expect(ctx.deletedPrefixes).toContain(`posts/${ana.id}/`);
    // Ben is still in the chat, so it stays for him (minus Ana's messages).
    expect((await ctx.call('GET', `/conversations/${conv}`, { as: ben })).status).toBe(200);
  });
});

describe('realtime', () => {
  function connect(url: string, token: string) {
    const ws = new WebSocket(url);
    const events: any[] = [];
    const ready = new Promise<void>((resolve, reject) => {
      ws.on('open', () => ws.send(JSON.stringify({ type: 'auth', token })));
      ws.on('message', (data) => {
        const evt = JSON.parse(String(data));
        if (evt.type === 'ready') resolve();
        else events.push(evt);
      });
      ws.on('close', (code) => reject(new Error(`closed ${code}`)));
    });
    return { ws, events, ready };
  }
  const waitFor = async (check: () => boolean) => {
    for (let i = 0; i < 100 && !check(); i++) await new Promise((r) => setTimeout(r, 10));
    expect(check()).toBe(true);
  };

  it('delivers messages (with only your own key), typing and read receipts live', async () => {
    const [ana, ben, cat] = [await ctx.signup('ana'), await ctx.signup('ben'), await ctx.signup('cat')];
    const conv = (await ctx.call('POST', '/conversations/group', { as: ana, body: { title: 'g', memberIds: [ben.id, cat.id] } })).body.conversation.id;
    await ctx.call('POST', `/conversations/${conv}/accept`, { as: ben });
    const url = await ctx.listen();
    const [a, b, c] = [connect(url, ana.token), connect(url, ben.token), connect(url, cat.token)];
    await Promise.all([a.ready, b.ready, c.ready]);

    a.ws.send(JSON.stringify({ type: 'typing', conversationId: conv }));
    await waitFor(() => b.events.some((e) => e.type === 'typing' && e.userId === ana.id));

    const msg = (await ctx.send(ana, conv, { kind: 'text', text: 'live!' })).body.message;
    await waitFor(() => b.events.some((e) => e.type === 'message') && c.events.some((e) => e.type === 'message'));
    const toBen = b.events.find((e) => e.type === 'message').message;
    expect(ctx.open(ben, ana, toBen)).toEqual({ kind: 'text', text: 'live!' });
    expect(toBen.key).not.toEqual(c.events.find((e) => e.type === 'message').message.key);
    // Cat hasn't accepted the invite, so she doesn't see typing.
    expect(c.events.some((e) => e.type === 'typing')).toBe(false);

    await ctx.call('POST', `/conversations/${conv}/read`, { as: ben, body: { upTo: msg.id } });
    await waitFor(() => a.events.some((e) => e.type === 'read' && e.userId === ben.id));
    expect(ctx.pushes).toEqual([]); // everyone is online
    for (const s of [a, b, c]) s.ws.close();
  });

  it('closes sockets that fail to authenticate', async () => {
    const url = await ctx.listen();
    await expect(connect(url, 'not-a-token').ready).rejects.toThrow('closed 4001');
  });
});
