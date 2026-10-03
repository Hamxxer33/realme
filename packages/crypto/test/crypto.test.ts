import sodiumLib from 'libsodium-wrappers-sumo';
import { beforeAll, describe, expect, it } from 'vitest';
import { createCrypto, DecryptionError, type EncryptedMessage, type KeyPair, type MessageBody, type RealmeCrypto, type Sodium } from '../src/index';

let c: RealmeCrypto;
let sodium: typeof sodiumLib;
const FAST = { opsLimit: 1, memLimit: 8192 * 4 };

beforeAll(async () => {
  await sodiumLib.ready;
  sodium = sodiumLib;
  c = createCrypto(sodiumLib as unknown as Sodium);
});

type Person = { id: string } & KeyPair;
const person = (id: string): Person => ({ id, ...c.generateKeyPair() });
const recipientsOf = (...people: Person[]) => Object.fromEntries(people.map((p) => [p.id, p.publicKey]));

function send(from: Person, members: Person[], body: MessageBody, conversationId = 'conv1') {
  return c.encryptMessage(body, { conversationId, senderId: from.id, mySecretKey: from.secretKey, recipients: recipientsOf(...members) });
}
function read(as: Person, from: Person, msg: EncryptedMessage, conversationId = 'conv1') {
  const key = msg.keys[as.id];
  if (!key) throw new DecryptionError('no key for me');
  return c.decryptMessage<MessageBody>({ ...msg, key }, {
    conversationId, senderId: from.id, senderPublicKey: from.publicKey, mySecretKey: as.secretKey,
  });
}

describe('messages', () => {
  it('every member of a group can read, including the sender', () => {
    const [ana, ben, cat] = [person('ana'), person('ben'), person('cat')];
    const body: MessageBody = { kind: 'text', text: 'dinner at 8? 🍝' };
    const msg = send(ana, [ana, ben, cat], body);
    expect(Object.keys(msg.keys).sort()).toEqual(['ana', 'ben', 'cat']);
    for (const p of [ana, ben, cat]) expect(read(p, ana, msg)).toEqual(body);
    expect(msg.ciphertext).not.toContain('dinner');
  });

  it('works for a 1:1 chat', () => {
    const [ana, ben] = [person('ana'), person('ben')];
    const msg = send(ben, [ana, ben], { kind: 'nudge' });
    expect(read(ana, ben, msg)).toEqual({ kind: 'nudge' });
  });

  it('a non-member cannot read it, even with a member\'s key copy', () => {
    const [ana, ben, eve] = [person('ana'), person('ben'), person('eve')];
    const msg = send(ana, [ana, ben], { kind: 'text', text: 'secret' });
    expect(() => c.decryptMessage({ ...msg, key: msg.keys.ben! }, {
      conversationId: 'conv1', senderId: 'ana', senderPublicKey: ana.publicKey, mySecretKey: eve.secretKey,
    })).toThrow(DecryptionError);
  });

  it('a member cannot forge a message in someone else\'s name', () => {
    const [ana, ben, cat] = [person('ana'), person('ben'), person('cat')];
    // Ben encrypts but claims Ana sent it.
    const forged = c.encryptMessage<MessageBody>({ kind: 'text', text: 'from ana (not really)' }, {
      conversationId: 'conv1', senderId: 'ana', mySecretKey: ben.secretKey, recipients: recipientsOf(ana, ben, cat),
    });
    expect(() => read(cat, ana, forged)).toThrow(DecryptionError);
  });

  it('rejects a swapped ciphertext reusing someone\'s genuine key copies', () => {
    const [ana, ben, cat] = [person('ana'), person('ben'), person('cat')];
    const genuine = send(ana, [ana, ben, cat], { kind: 'text', text: 'hi' });
    // Ben knows the message key (he's a member) and re-encrypts new content under it,
    // then a malicious server pairs it with Ana's genuine key copy for Cat.
    const other = send(ben, [ana, ben, cat], { kind: 'text', text: 'evil' });
    const spliced = { ...genuine, ciphertext: other.ciphertext, nonce: other.nonce };
    expect(() => read(cat, ana, spliced)).toThrow(DecryptionError);
  });

  it('rejects a message moved to another conversation or relabelled', () => {
    const [ana, ben] = [person('ana'), person('ben')];
    const msg = send(ana, [ana, ben], { kind: 'text', text: 'hi' });
    expect(() => read(ben, ana, msg, 'conv2')).toThrow(DecryptionError);
    expect(() => read(ben, ben, msg)).toThrow(DecryptionError);
  });

  it('requires the sender among recipients', () => {
    const [ana, ben] = [person('ana'), person('ben')];
    expect(() => send(ana, [ben], { kind: 'nudge' })).toThrow('include the sender');
  });
});

describe('files', () => {
  it('round-trips and detects tampering', () => {
    const data = sodium.randombytes_buf(5000);
    const { ciphertext, fileKey, nonce } = c.encryptFile(data);
    expect(c.decryptFile(ciphertext, fileKey, nonce)).toEqual(data);
    ciphertext[10] = ciphertext[10]! ^ 1;
    expect(() => c.decryptFile(ciphertext, fileKey, nonce)).toThrow(DecryptionError);
  });
});

describe('password-derived secrets', () => {
  it('is deterministic per email+password and separates auth from backup', () => {
    const a = c.derivePasswordSecrets('Me@Example.com ', 'hunter2!', FAST);
    const b = c.derivePasswordSecrets('me@example.com', 'hunter2!', FAST);
    const other = c.derivePasswordSecrets('me@example.com', 'hunter3!', FAST);
    expect(a).toEqual(b);
    expect(a.authSecret).not.toEqual(a.backupKey);
    expect(other.authSecret).not.toEqual(a.authSecret);
  });

  it('restores the secret key only with the right password', () => {
    const keys = c.generateKeyPair();
    const { backupKey } = c.derivePasswordSecrets('me@example.com', 'right', FAST);
    const wrapped = c.wrapSecretKey(keys.secretKey, backupKey);
    expect(c.unwrapSecretKey(wrapped, backupKey)).toEqual(keys.secretKey);
    const wrong = c.derivePasswordSecrets('me@example.com', 'wrong', FAST);
    expect(() => c.unwrapSecretKey(wrapped, wrong.backupKey)).toThrow(DecryptionError);
  });
});

describe('setup', () => {
  it('refuses a libsodium build that lacks required primitives', () => {
    const partial = { ...sodium, crypto_pwhash_SALTBYTES: undefined } as unknown as Sodium;
    expect(() => createCrypto(partial)).toThrow('crypto_pwhash_SALTBYTES');
  });
});

describe('safety number', () => {
  it('matches on both phones and changes if a key is swapped', () => {
    const alice = c.generateKeyPair();
    const bob = c.generateKeyPair();
    const mallory = c.generateKeyPair();
    const n = c.safetyNumber(alice.publicKey, bob.publicKey);
    expect(n).toEqual(c.safetyNumber(bob.publicKey, alice.publicKey));
    expect(n).toMatch(/^\d{5}( \d{5}){4}$/);
    expect(c.safetyNumber(alice.publicKey, mallory.publicKey)).not.toEqual(n);
  });
});
