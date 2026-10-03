import { PGlite } from '@electric-sql/pglite';
import { serve, type ServerType } from '@hono/node-server';
import { createCrypto, type KeyPair, type MessageBody, type Sodium } from '@realme/crypto';
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

async function setup() {
  const pg = new PGlite();
  const db = drizzle(pg, { schema });
  await migrate(db, { migrationsFolder: new URL('../drizzle', import.meta.url).pathname });
  const deletedPrefixes: string[] = [];
  const pushes: Array<{ to: string; body: string }> = [];
  const storage: Storage = {
    presignUpload: async (key) => `https://storage.test/put/${key}`,
    presignDownload: async (key) => `https://storage.test/get/${key}`,
    deletePrefix: async (prefix) => void deletedPrefixes.push(prefix),
  };
  let clock = new Date('2026-02-14T12:00:00Z');
  const { app, hub, injectWebSocket } = createApp({
    db: db as unknown as DB,
    storage,
    push: { send: async (to, _title, body) => void pushes.push({ to, body }) },
    jwtSecret: 'x'.repeat(48),
    now: () => clock,
  });

  async function call(method: string, path: string, opts: { token?: string; body?: unknown } = {}) {
    const res = await app.request(path, {
      method,
      headers: {
        'content-type': 'application/json',
        ...(opts.token ? { authorization: `Bearer ${opts.token}` } : {}),
      },
      body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
    });
    return { status: res.status, body: (await res.json()) as any };
  }

  async function signup(email: string, password: string, displayName: string) {
    const keys = crypto.generateKeyPair();
    const { authSecret, backupKey } = crypto.derivePasswordSecrets(email, password, FAST);
    const res = await call('POST', '/auth/signup', {
      body: { email, displayName, authSecret, publicKey: keys.publicKey, keyBackup: crypto.wrapSecretKey(keys.secretKey, backupKey) },
    });
    expect(res.status).toBe(201);
    return { token: res.body.token as string, id: res.body.user.id as string, keys };
  }

  async function pair() {
    const alice = await signup('alice@example.com', 'correct horse', 'Alice');
    const bob = await signup('bob@example.com', 'battery staple', 'Bob');
    const invite = await call('POST', '/couple/invite', { token: alice.token });
    const join = await call('POST', '/couple/join', { token: bob.token, body: { code: invite.body.inviteCode.toLowerCase() } });
    expect(join.status).toBe(200);
    return { alice, bob, coupleId: join.body.coupleId as string };
  }

  let server: ServerType | undefined;
  async function listen() {
    server = serve({ fetch: app.fetch, port: 0 });
    injectWebSocket(server);
    await new Promise((r) => server!.once('listening', r));
    return `ws://127.0.0.1:${(server.address() as AddressInfo).port}/ws`;
  }

  return {
    db, hub, call, signup, pair, listen, deletedPrefixes, pushes,
    advance: (ms: number) => (clock = new Date(clock.getTime() + ms)),
    close: async () => {
      await new Promise((r) => (server ? server.close(r) : r(null)));
      await pg.close();
    },
  };
}

function sendText(
  call: typeof ctx.call,
  from: { token: string; id: string; keys: KeyPair },
  to: { keys: KeyPair },
  coupleId: string,
  text: string,
  clientId = Math.random().toString(36).slice(2),
) {
  const sealed = crypto.encryptForCouple<MessageBody>({ kind: 'text', text }, {
    coupleId,
    senderId: from.id,
    mySecretKey: from.keys.secretKey,
    partnerPublicKey: to.keys.publicKey,
  });
  return call('POST', '/messages', { token: from.token, body: { ...sealed, clientId } });
}

describe('accounts', () => {
  it('logs in on a new phone and restores the secret key from the backup', async () => {
    const alice = await ctx.signup('Alice@Example.com', 'correct horse', 'Alice');
    const { authSecret, backupKey } = crypto.derivePasswordSecrets('alice@example.com', 'correct horse', FAST);
    const res = await ctx.call('POST', '/auth/login', { body: { email: 'ALICE@example.com', authSecret } });
    expect(res.status).toBe(200);
    expect(crypto.unwrapSecretKey(res.body.keyBackup, backupKey)).toBe(alice.keys.secretKey);
  });

  it('never stores the password or auth secret in plain text', async () => {
    await ctx.signup('alice@example.com', 'correct horse', 'Alice');
    const { authSecret } = crypto.derivePasswordSecrets('alice@example.com', 'correct horse', FAST);
    const [row] = await ctx.db.select().from(schema.users);
    expect(JSON.stringify(row)).not.toContain('correct horse');
    expect(row!.authHash).not.toContain(authSecret);
    expect(row!.authHash.startsWith('$argon2')).toBe(true);
  });

  it('rejects wrong passwords, duplicate emails, and rate-limits guessing', async () => {
    await ctx.signup('alice@example.com', 'correct horse', 'Alice');
    expect((await ctx.call('POST', '/auth/signup', {
      body: { email: 'alice@example.com', displayName: 'A', authSecret: 'abc', publicKey: 'abc', keyBackup: { nonce: 'a', ciphertext: 'b' } },
    })).status).toBe(409);
    const wrong = crypto.derivePasswordSecrets('alice@example.com', 'nope', FAST).authSecret;
    const statuses = [];
    for (let i = 0; i < 11; i++) {
      statuses.push((await ctx.call('POST', '/auth/login', { body: { email: 'alice@example.com', authSecret: wrong } })).status);
    }
    expect(statuses.slice(0, 10).every((s) => s === 401)).toBe(true);
    expect(statuses[10]).toBe(429);
  });

  it('requires a valid, unexpired token', async () => {
    expect((await ctx.call('GET', '/me')).status).toBe(401);
    expect((await ctx.call('GET', '/me', { token: 'garbage' })).status).toBe(401);
    const alice = await ctx.signup('alice@example.com', 'pw', 'Alice');
    ctx.advance(29 * 24 * 60 * 60 * 1000);
    expect((await ctx.call('GET', '/me', { token: alice.token })).status).toBe(200);
    ctx.advance(2 * 24 * 60 * 60 * 1000);
    expect((await ctx.call('GET', '/me', { token: alice.token })).status).toBe(401);
  });
});

describe('pairing', () => {
  it('pairs two people with an invite code and shows each the other', async () => {
    const { alice, bob } = await ctx.pair();
    const me = await ctx.call('GET', '/me', { token: alice.token });
    expect(me.body.couple.paired).toBe(true);
    expect(me.body.couple.inviteCode).toBeNull();
    expect(me.body.couple.partner).toMatchObject({ id: bob.id, displayName: 'Bob', publicKey: bob.keys.publicKey });
    const them = await ctx.call('GET', '/me', { token: bob.token });
    expect(them.body.couple.partner.id).toBe(alice.id);
  });

  it('rejects expired, reused, and self-join codes and a third person', async () => {
    const alice = await ctx.signup('alice@example.com', 'pw-alice', 'Alice');
    const bob = await ctx.signup('bob@example.com', 'pw-bob', 'Bob');
    const carol = await ctx.signup('carol@example.com', 'pw-carol', 'Carol');
    const { inviteCode } = (await ctx.call('POST', '/couple/invite', { token: alice.token })).body;

    expect((await ctx.call('POST', '/couple/join', { token: alice.token, body: { code: inviteCode } })).status).toBe(409);
    ctx.advance(25 * 60 * 60 * 1000);
    expect((await ctx.call('POST', '/couple/join', { token: bob.token, body: { code: inviteCode } })).status).toBe(404);

    const fresh = (await ctx.call('POST', '/couple/invite', { token: alice.token })).body.inviteCode;
    expect((await ctx.call('POST', '/couple/join', { token: bob.token, body: { code: fresh } })).status).toBe(200);
    expect((await ctx.call('POST', '/couple/join', { token: carol.token, body: { code: fresh } })).status).toBe(404);
    expect((await ctx.call('POST', '/couple/invite', { token: bob.token })).status).toBe(409);
  });

  it('stores couple settings encrypted', async () => {
    const { alice, bob, coupleId } = await ctx.pair();
    const sealed = crypto.encryptForCouple({ anniversary: '2023-06-01' }, {
      coupleId, senderId: alice.id, mySecretKey: alice.keys.secretKey, partnerPublicKey: bob.keys.publicKey,
    });
    expect((await ctx.call('PUT', '/couple/settings', { token: alice.token, body: sealed })).status).toBe(200);
    const { settings } = (await ctx.call('GET', '/me', { token: bob.token })).body.couple;
    expect(settings.updatedBy).toBe(alice.id);
    expect(crypto.decryptForCouple(settings, {
      coupleId, senderId: settings.updatedBy, mySecretKey: bob.keys.secretKey, partnerPublicKey: alice.keys.publicKey,
    })).toEqual({ anniversary: '2023-06-01' });
  });
});

describe('messages', () => {
  it('relays encrypted messages the server cannot read', async () => {
    const { alice, bob, coupleId } = await ctx.pair();
    const sent = await sendText(ctx.call, alice, bob, coupleId, 'meet me at our spot ❤️');
    expect(sent.status).toBe(201);

    const [row] = await ctx.db.select().from(schema.messages);
    expect(JSON.stringify(row)).not.toContain('our spot');

    const { messages } = (await ctx.call('GET', '/messages', { token: bob.token })).body;
    const body = crypto.decryptForCouple<MessageBody>(messages[0], {
      coupleId, senderId: messages[0].senderId, mySecretKey: bob.keys.secretKey, partnerPublicKey: alice.keys.publicKey,
    });
    expect(body).toEqual({ kind: 'text', text: 'meet me at our spot ❤️' });
  });

  it('dedupes retries by client id', async () => {
    const { alice, bob, coupleId } = await ctx.pair();
    const first = await sendText(ctx.call, alice, bob, coupleId, 'hi', 'same-id');
    const retry = await sendText(ctx.call, alice, bob, coupleId, 'hi', 'same-id');
    expect(retry.status).toBe(200);
    expect(retry.body.message.id).toBe(first.body.message.id);
    expect((await ctx.db.select().from(schema.messages)).length).toBe(1);
  });

  it('pages backwards through history', async () => {
    const { alice, bob, coupleId } = await ctx.pair();
    for (let i = 0; i < 5; i++) {
      await sendText(ctx.call, alice, bob, coupleId, `m${i}`);
      ctx.advance(1000);
    }
    const page1 = (await ctx.call('GET', '/messages?limit=3', { token: bob.token })).body;
    expect(page1.messages.length).toBe(3);
    expect(page1.hasMore).toBe(true);
    const page2 = (await ctx.call('GET', `/messages?limit=3&before=${page1.messages[2].id}`, { token: bob.token })).body;
    expect(page2.messages.length).toBe(2);
    expect(page2.hasMore).toBe(false);
    const ids = [...page1.messages, ...page2.messages].map((m: { id: string }) => m.id);
    expect(new Set(ids).size).toBe(5);
  });

  it('marks the partner\'s messages read, not your own', async () => {
    const { alice, bob, coupleId } = await ctx.pair();
    const fromAlice = (await sendText(ctx.call, alice, bob, coupleId, 'a')).body.message;
    ctx.advance(1000);
    const fromBob = (await sendText(ctx.call, bob, alice, coupleId, 'b')).body.message;
    await ctx.call('POST', '/messages/read', { token: bob.token, body: { upTo: fromBob.id } });
    const rows = await ctx.db.select().from(schema.messages);
    expect(rows.find((r) => r.id === fromAlice.id)!.readAt).not.toBeNull();
    expect(rows.find((r) => r.id === fromBob.id)!.readAt).toBeNull();
  });

  it('pushes a content-free notification when the partner is offline', async () => {
    const { alice, bob, coupleId } = await ctx.pair();
    await ctx.call('PUT', '/me/push-token', { token: bob.token, body: { token: 'ExponentPushToken[bob]' } });
    await sendText(ctx.call, alice, bob, coupleId, 'secret words');
    await new Promise((r) => setTimeout(r, 10));
    expect(ctx.pushes).toEqual([{ to: 'ExponentPushToken[bob]', body: 'sent you something 💌' }]);
  });

  it('blocks unpaired users and other couples', async () => {
    const solo = await ctx.signup('solo@example.com', 'pw', 'Solo');
    expect((await ctx.call('GET', '/messages', { token: solo.token })).status).toBe(409);

    const { alice, bob, coupleId } = await ctx.pair();
    const msg = (await sendText(ctx.call, alice, bob, coupleId, 'private')).body.message;

    const carol = await ctx.signup('carol@example.com', 'pw', 'Carol');
    const dave = await ctx.signup('dave@example.com', 'pw', 'Dave');
    const code = (await ctx.call('POST', '/couple/invite', { token: carol.token })).body.inviteCode;
    await ctx.call('POST', '/couple/join', { token: dave.token, body: { code } });

    expect((await ctx.call('GET', '/messages', { token: carol.token })).body.messages).toEqual([]);
    expect((await ctx.call('GET', `/messages?before=${msg.id}`, { token: carol.token })).status).toBe(404);
    expect((await ctx.call('POST', '/messages/read', { token: carol.token, body: { upTo: msg.id } })).status).toBe(404);
  });
});

describe('media', () => {
  it('scopes object keys to the couple', async () => {
    const { alice, coupleId } = await ctx.pair();
    const up = await ctx.call('POST', '/media/upload-url', { token: alice.token, body: { size: 1234 } });
    expect(up.body.objectKey).toMatch(new RegExp(`^couples/${coupleId}/`));

    const down = await ctx.call('POST', '/media/download-url', { token: alice.token, body: { objectKey: up.body.objectKey } });
    expect(down.status).toBe(200);
    for (const objectKey of [`couples/${coupleId}/../other`, 'couples/00000000-0000-0000-0000-000000000000/x', up.body.objectKey + '/x']) {
      expect((await ctx.call('POST', '/media/download-url', { token: alice.token, body: { objectKey } })).status).toBe(404);
    }
    expect((await ctx.call('POST', '/media/upload-url', { token: alice.token, body: { size: 26 * 1024 * 1024 } })).status).toBe(400);
  });
});

describe('memories', () => {
  it('lets either partner add and remove shared memories', async () => {
    const { alice, bob, coupleId } = await ctx.pair();
    const sealed = crypto.encryptForCouple({ title: 'First date', date: '2023-06-01' }, {
      coupleId, senderId: alice.id, mySecretKey: alice.keys.secretKey, partnerPublicKey: bob.keys.publicKey,
    });
    const { memory } = (await ctx.call('POST', '/memories', { token: alice.token, body: sealed })).body;
    const list = (await ctx.call('GET', '/memories', { token: bob.token })).body.memories;
    expect(list.map((m: { id: string }) => m.id)).toEqual([memory.id]);
    expect((await ctx.call('DELETE', `/memories/${memory.id}`, { token: bob.token })).status).toBe(200);
    expect((await ctx.call('GET', '/memories', { token: alice.token })).body.memories).toEqual([]);
  });
});

describe('unpairing and account deletion', () => {
  it('unpairing wipes shared history and media for both', async () => {
    const { alice, bob, coupleId } = await ctx.pair();
    await sendText(ctx.call, alice, bob, coupleId, 'bye');
    expect((await ctx.call('DELETE', '/couple', { token: bob.token })).status).toBe(200);
    expect(await ctx.db.select().from(schema.messages)).toEqual([]);
    expect(ctx.deletedPrefixes).toEqual([`couples/${coupleId}/`]);
    expect((await ctx.call('GET', '/me', { token: alice.token })).body.couple).toBeNull();
    expect((await ctx.call('POST', '/couple/invite', { token: alice.token })).status).toBe(201);
  });

  it('deleting an account removes the couple too', async () => {
    const { alice, bob } = await ctx.pair();
    expect((await ctx.call('DELETE', '/me', { token: alice.token })).status).toBe(200);
    expect((await ctx.call('GET', '/me', { token: alice.token })).status).toBe(401);
    expect((await ctx.call('GET', '/me', { token: bob.token })).body.couple).toBeNull();
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

  it('delivers messages, typing, and read receipts live', async () => {
    const { alice, bob, coupleId } = await ctx.pair();
    const url = await ctx.listen();
    const a = connect(url, alice.token);
    const b = connect(url, bob.token);
    await Promise.all([a.ready, b.ready]);

    a.ws.send(JSON.stringify({ type: 'typing' }));
    await waitFor(() => b.events.some((e) => e.type === 'typing' && e.userId === alice.id));
    expect(a.events.some((e) => e.type === 'typing')).toBe(false);

    const msg = (await sendText(ctx.call, alice, bob, coupleId, 'live!')).body.message;
    await waitFor(() => b.events.some((e) => e.type === 'message' && e.message.id === msg.id));
    expect(ctx.pushes).toEqual([]); // Bob is online, so no push

    await ctx.call('POST', '/messages/read', { token: bob.token, body: { upTo: msg.id } });
    await waitFor(() => a.events.some((e) => e.type === 'read' && e.upTo === msg.id));

    a.ws.close();
    b.ws.close();
  });

  it('closes sockets that fail to authenticate', async () => {
    const url = await ctx.listen();
    const bad = connect(url, 'not-a-token');
    await expect(bad.ready).rejects.toThrow('closed 4001');
  });
});
