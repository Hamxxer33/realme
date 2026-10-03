import sodiumLib from 'libsodium-wrappers-sumo';
import { beforeAll, describe, expect, it } from 'vitest';
import { createCrypto, DecryptionError, type MessageBody, type RealmeCrypto, type Sodium } from '../src/index';

let c: RealmeCrypto;
let sodium: typeof sodiumLib;
const FAST = { opsLimit: 1, memLimit: 8192 * 4 };

beforeAll(async () => {
  await sodiumLib.ready;
  sodium = sodiumLib;
  c = createCrypto(sodiumLib as unknown as Sodium);
});

describe('couple messages', () => {
  it('either partner can read every message, including their own', () => {
    const alice = c.generateKeyPair();
    const bob = c.generateKeyPair();
    const body: MessageBody = { kind: 'text', text: 'goodnight, love 🌙' };

    const sealed = c.encryptForCouple(body, {
      coupleId: 'c1',
      senderId: 'alice',
      mySecretKey: alice.secretKey,
      partnerPublicKey: bob.publicKey,
    });

    const asBob = c.decryptForCouple<MessageBody>(sealed, {
      coupleId: 'c1',
      senderId: 'alice',
      mySecretKey: bob.secretKey,
      partnerPublicKey: alice.publicKey,
    });
    const asAlice = c.decryptForCouple<MessageBody>(sealed, {
      coupleId: 'c1',
      senderId: 'alice',
      mySecretKey: alice.secretKey,
      partnerPublicKey: bob.publicKey,
    });
    expect(asBob).toEqual(body);
    expect(asAlice).toEqual(body);
    expect(sealed.ciphertext).not.toContain('goodnight');
  });

  it('an outsider cannot read the message', () => {
    const alice = c.generateKeyPair();
    const bob = c.generateKeyPair();
    const eve = c.generateKeyPair();
    const sealed = c.encryptForCouple({ kind: 'nudge' }, {
      coupleId: 'c1',
      senderId: 'alice',
      mySecretKey: alice.secretKey,
      partnerPublicKey: bob.publicKey,
    });
    expect(() =>
      c.decryptForCouple(sealed, { coupleId: 'c1', senderId: 'alice', mySecretKey: eve.secretKey, partnerPublicKey: alice.publicKey }),
    ).toThrow(DecryptionError);
  });

  it('rejects a message relabelled with another sender or couple', () => {
    const alice = c.generateKeyPair();
    const bob = c.generateKeyPair();
    const sealed = c.encryptForCouple({ kind: 'text', text: 'hi' }, {
      coupleId: 'c1',
      senderId: 'alice',
      mySecretKey: alice.secretKey,
      partnerPublicKey: bob.publicKey,
    });
    const ctx = { mySecretKey: bob.secretKey, partnerPublicKey: alice.publicKey };
    expect(() => c.decryptForCouple(sealed, { ...ctx, coupleId: 'c1', senderId: 'bob' })).toThrow(DecryptionError);
    expect(() => c.decryptForCouple(sealed, { ...ctx, coupleId: 'c2', senderId: 'alice' })).toThrow(DecryptionError);
  });

  it('rejects tampered ciphertext', () => {
    const alice = c.generateKeyPair();
    const bob = c.generateKeyPair();
    const sealed = c.encryptForCouple({ kind: 'text', text: 'hi' }, {
      coupleId: 'c1',
      senderId: 'alice',
      mySecretKey: alice.secretKey,
      partnerPublicKey: bob.publicKey,
    });
    const bytes = sodium.from_base64(sealed.ciphertext);
    bytes[0] = bytes[0]! ^ 1;
    const tampered = { ...sealed, ciphertext: sodium.to_base64(bytes) };
    expect(() =>
      c.decryptForCouple(tampered, { coupleId: 'c1', senderId: 'alice', mySecretKey: bob.secretKey, partnerPublicKey: alice.publicKey }),
    ).toThrow(DecryptionError);
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
