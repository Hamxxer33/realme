/**
 * End-to-end encryption for Realme.
 *
 * Every user has an X25519 key pair generated on their device; the server only
 * ever sees public keys and ciphertext.
 *
 * Messages (1:1 and group) use a fresh random key per message:
 *   1. The body is encrypted with that key (XChaCha20-Poly1305).
 *   2. The key is sealed for every member — including the sender — with
 *      `crypto_box(senderSecret, memberPublic)`, together with a hash of the
 *      ciphertext. Opening a member's copy proves who sent it (only the sender's
 *      secret key can produce it) and that the ciphertext wasn't swapped.
 * So a member can read a message only if they were a member when it was sent,
 * and neither the server nor another member can forge one in someone's name.
 *
 * Photos and voice notes are encrypted with their own random key per file; that
 * key travels inside the (encrypted) message body.
 *
 * The secret key is backed up to the server wrapped with a key derived from the
 * user's password (Argon2id). The password never leaves the device: the server
 * receives a separate authentication secret derived from the same master key.
 *
 * Sodium is injected so the same code runs on react-native-libsodium (app) and
 * libsodium-wrappers-sumo (Node). Call sites must await `sodium.ready`.
 */

export interface Sodium {
  crypto_box_NONCEBYTES: number;
  crypto_aead_xchacha20poly1305_ietf_NPUBBYTES: number;
  crypto_aead_xchacha20poly1305_ietf_KEYBYTES: number;
  crypto_secretbox_NONCEBYTES: number;
  crypto_pwhash_SALTBYTES: number;
  crypto_pwhash_ALG_ARGON2ID13: number;
  crypto_pwhash_OPSLIMIT_INTERACTIVE: number;
  crypto_pwhash_MEMLIMIT_INTERACTIVE: number;
  crypto_box_keypair(): { publicKey: Uint8Array; privateKey: Uint8Array };
  crypto_box_easy(message: string | Uint8Array, nonce: Uint8Array, publicKey: Uint8Array, privateKey: Uint8Array): Uint8Array;
  crypto_box_open_easy(ciphertext: Uint8Array, nonce: Uint8Array, publicKey: Uint8Array, privateKey: Uint8Array): Uint8Array;
  crypto_secretbox_easy(message: string | Uint8Array, nonce: Uint8Array, key: Uint8Array): Uint8Array;
  crypto_secretbox_open_easy(ciphertext: Uint8Array, nonce: Uint8Array, key: Uint8Array): Uint8Array;
  crypto_aead_xchacha20poly1305_ietf_encrypt(
    message: string | Uint8Array,
    additionalData: string | null,
    secretNonce: null,
    publicNonce: Uint8Array,
    key: Uint8Array,
  ): Uint8Array;
  crypto_aead_xchacha20poly1305_ietf_decrypt(
    secretNonce: null,
    ciphertext: Uint8Array,
    additionalData: string | null,
    publicNonce: Uint8Array,
    key: Uint8Array,
  ): Uint8Array;
  crypto_aead_xchacha20poly1305_ietf_keygen(): Uint8Array;
  crypto_generichash(length: number, message: string | Uint8Array, key: Uint8Array | null): Uint8Array;
  crypto_pwhash(
    keyLength: number,
    password: string | Uint8Array,
    salt: Uint8Array,
    opsLimit: number,
    memLimit: number,
    algorithm: number,
  ): Uint8Array;
  crypto_kdf_derive_from_key(subkeyLength: number, subkeyId: number, context: string, key: Uint8Array): Uint8Array;
  randombytes_buf(length: number): Uint8Array;
  to_base64(input: Uint8Array): string;
  from_base64(input: string): Uint8Array;
  to_string(input: Uint8Array): string;
}

export interface KeyPair {
  publicKey: string;
  secretKey: string;
}

export interface Sealed {
  nonce: string;
  ciphertext: string;
}

/** One member's copy of a message key. */
export interface WrappedKey {
  nonce: string;
  key: string;
}

/** What gets sent to the server: one ciphertext plus a wrapped key per member. */
export interface EncryptedMessage extends Sealed {
  keys: Record<string, WrappedKey>;
}

/** A status update. `conversationId` for its envelope is `status:<clientId>`. */
export type StatusBody =
  | { kind: 'text'; text: string; background: string }
  | { kind: 'image'; media: MediaRef; caption?: string };

export type MessageBody =
  | { kind: 'text'; text: string }
  | { kind: 'image'; media: MediaRef; caption?: string }
  | { kind: 'voice'; media: MediaRef; durationMs: number }
  | { kind: 'nudge' }
  | { kind: 'reaction'; targetId: string; emoji: string };

export interface MediaRef {
  objectKey: string;
  fileKey: string;
  nonce: string;
  mime: string;
  size: number;
  width?: number;
  height?: number;
}

/** Sealed inside the ciphertext so the server can't move a message between chats or senders. */
interface Envelope<T> {
  v: 2;
  conversationId: string;
  senderId: string;
  body: T;
}

export class DecryptionError extends Error {
  constructor(message = 'Could not decrypt') {
    super(message);
    this.name = 'DecryptionError';
  }
}

const MESSAGE_AD = 'realme-message-v2';
const MEDIA_AD = 'realme-media-v1';
const KDF_CONTEXT = 'realmekd'; // crypto_kdf contexts are exactly 8 bytes
const AUTH_SUBKEY_ID = 1;
const BACKUP_SUBKEY_ID = 2;
const KEY_BYTES = 32;
const HASH_BYTES = 32;
export const MAX_RECIPIENTS = 64;

export interface PasswordCost {
  opsLimit: number;
  memLimit: number;
}

const REQUIRED: Array<keyof Sodium> = [
  'crypto_box_NONCEBYTES',
  'crypto_aead_xchacha20poly1305_ietf_NPUBBYTES',
  'crypto_secretbox_NONCEBYTES',
  'crypto_pwhash_SALTBYTES',
  'crypto_pwhash_ALG_ARGON2ID13',
  'crypto_pwhash_OPSLIMIT_INTERACTIVE',
  'crypto_pwhash_MEMLIMIT_INTERACTIVE',
  'crypto_box_easy',
  'crypto_pwhash',
  'crypto_kdf_derive_from_key',
  'crypto_aead_xchacha20poly1305_ietf_encrypt',
];

export function createCrypto(sodium: Sodium) {
  // Some libsodium builds (e.g. the non-"sumo" libsodium.js) omit primitives;
  // fail loudly here rather than with a confusing error at first use.
  const missing = REQUIRED.filter((name) => sodium[name] === undefined);
  if (missing.length) throw new Error(`libsodium build is missing: ${missing.join(', ')}`);

  const b64 = (bytes: Uint8Array) => sodium.to_base64(bytes);
  const unb64 = (text: string) => sodium.from_base64(text);

  function generateKeyPair(): KeyPair {
    const { publicKey, privateKey } = sodium.crypto_box_keypair();
    return { publicKey: b64(publicKey), secretKey: b64(privateKey) };
  }

  const ciphertextHash = (nonce: Uint8Array, ciphertext: Uint8Array) => {
    const joined = new Uint8Array(nonce.length + ciphertext.length);
    joined.set(nonce);
    joined.set(ciphertext, nonce.length);
    return sodium.crypto_generichash(HASH_BYTES, joined, null);
  };

  /**
   * Encrypt a message for every member of a conversation. `recipients` maps
   * user id → public key and must include the sender, so they can read their
   * own history on another device.
   */
  function encryptMessage<T>(
    body: T,
    ctx: {
      conversationId: string;
      senderId: string;
      mySecretKey: string;
      recipients: Record<string, string>;
      /** Defaults to MAX_RECIPIENTS (group size); status updates allow more. */
      maxRecipients?: number;
    },
  ): EncryptedMessage {
    const ids = Object.keys(ctx.recipients);
    if (!ids.includes(ctx.senderId)) throw new Error('Recipients must include the sender');
    if (ids.length > (ctx.maxRecipients ?? MAX_RECIPIENTS)) throw new Error('Too many recipients');

    const envelope: Envelope<T> = { v: 2, conversationId: ctx.conversationId, senderId: ctx.senderId, body };
    const messageKey = sodium.crypto_aead_xchacha20poly1305_ietf_keygen();
    const nonce = sodium.randombytes_buf(sodium.crypto_aead_xchacha20poly1305_ietf_NPUBBYTES);
    const ciphertext = sodium.crypto_aead_xchacha20poly1305_ietf_encrypt(
      JSON.stringify(envelope), MESSAGE_AD, null, nonce, messageKey,
    );

    // Each member's copy = messageKey ‖ hash(nonce ‖ ciphertext), boxed sender → member.
    const keyAndHash = new Uint8Array(KEY_BYTES + HASH_BYTES);
    keyAndHash.set(messageKey);
    keyAndHash.set(ciphertextHash(nonce, ciphertext), KEY_BYTES);

    const mySecret = unb64(ctx.mySecretKey);
    const keys: Record<string, WrappedKey> = {};
    for (const [userId, publicKey] of Object.entries(ctx.recipients)) {
      const wrapNonce = sodium.randombytes_buf(sodium.crypto_box_NONCEBYTES);
      keys[userId] = {
        nonce: b64(wrapNonce),
        key: b64(sodium.crypto_box_easy(keyAndHash, wrapNonce, unb64(publicKey), mySecret)),
      };
    }
    return { nonce: b64(nonce), ciphertext: b64(ciphertext), keys };
  }

  /** Open a message using my copy of its key and the claimed sender's public key. */
  function decryptMessage<T>(
    message: Sealed & { key: WrappedKey },
    ctx: { conversationId: string; senderId: string; senderPublicKey: string; mySecretKey: string },
  ): T {
    try {
      const nonce = unb64(message.nonce);
      const ciphertext = unb64(message.ciphertext);
      const keyAndHash = sodium.crypto_box_open_easy(
        unb64(message.key.key), unb64(message.key.nonce), unb64(ctx.senderPublicKey), unb64(ctx.mySecretKey),
      );
      if (keyAndHash.length !== KEY_BYTES + HASH_BYTES) throw new Error('bad key');
      if (!equal(keyAndHash.subarray(KEY_BYTES), ciphertextHash(nonce, ciphertext))) throw new Error('hash mismatch');
      const plain = sodium.crypto_aead_xchacha20poly1305_ietf_decrypt(
        null, ciphertext, MESSAGE_AD, nonce, keyAndHash.subarray(0, KEY_BYTES),
      );
      const envelope = JSON.parse(sodium.to_string(plain)) as Envelope<T>;
      if (envelope.v !== 2 || envelope.conversationId !== ctx.conversationId || envelope.senderId !== ctx.senderId) {
        throw new Error('metadata mismatch');
      }
      return envelope.body;
    } catch {
      throw new DecryptionError();
    }
  }

  function encryptFile(bytes: Uint8Array): { ciphertext: Uint8Array; fileKey: string; nonce: string } {
    const key = sodium.crypto_aead_xchacha20poly1305_ietf_keygen();
    const nonce = sodium.randombytes_buf(sodium.crypto_aead_xchacha20poly1305_ietf_NPUBBYTES);
    const ciphertext = sodium.crypto_aead_xchacha20poly1305_ietf_encrypt(bytes, MEDIA_AD, null, nonce, key);
    return { ciphertext, fileKey: b64(key), nonce: b64(nonce) };
  }

  function decryptFile(ciphertext: Uint8Array, fileKey: string, nonce: string): Uint8Array {
    try {
      return sodium.crypto_aead_xchacha20poly1305_ietf_decrypt(null, ciphertext, MEDIA_AD, unb64(nonce), unb64(fileKey));
    } catch {
      throw new DecryptionError('Could not decrypt file');
    }
  }

  const defaultCost: PasswordCost = {
    opsLimit: sodium.crypto_pwhash_OPSLIMIT_INTERACTIVE,
    memLimit: sodium.crypto_pwhash_MEMLIMIT_INTERACTIVE,
  };

  /**
   * Stretch the password into two independent secrets: `authSecret` is sent to
   * the server to log in, `backupKey` never leaves the device and wraps the
   * secret key backup. The salt is derived from the email so it is available
   * before login.
   */
  function derivePasswordSecrets(email: string, password: string, cost: PasswordCost = defaultCost) {
    const salt = sodium.crypto_generichash(
      sodium.crypto_pwhash_SALTBYTES,
      `realme:${email.trim().toLowerCase()}`,
      null,
    );
    const master = sodium.crypto_pwhash(
      32,
      password,
      salt,
      cost.opsLimit,
      cost.memLimit,
      sodium.crypto_pwhash_ALG_ARGON2ID13,
    );
    return {
      authSecret: b64(sodium.crypto_kdf_derive_from_key(32, AUTH_SUBKEY_ID, KDF_CONTEXT, master)),
      backupKey: b64(sodium.crypto_kdf_derive_from_key(32, BACKUP_SUBKEY_ID, KDF_CONTEXT, master)),
    };
  }

  function wrapSecretKey(secretKey: string, backupKey: string): Sealed {
    const nonce = sodium.randombytes_buf(sodium.crypto_secretbox_NONCEBYTES);
    const ciphertext = sodium.crypto_secretbox_easy(unb64(secretKey), nonce, unb64(backupKey));
    return { nonce: b64(nonce), ciphertext: b64(ciphertext) };
  }

  function unwrapSecretKey(wrapped: Sealed, backupKey: string): string {
    try {
      return b64(sodium.crypto_secretbox_open_easy(unb64(wrapped.ciphertext), unb64(wrapped.nonce), unb64(backupKey)));
    } catch {
      throw new DecryptionError('Could not restore key — wrong password?');
    }
  }

  /**
   * A short code two people can compare in person. It matches on both phones
   * only if each holds the other's real public key, which rules out a server
   * swapping keys to read messages.
   */
  function safetyNumber(publicKeyA: string, publicKeyB: string): string {
    const [first, second] = [publicKeyA, publicKeyB].sort();
    const digest = sodium.crypto_generichash(15, `${first}|${second}`, null);
    const groups: string[] = [];
    for (let i = 0; i < digest.length; i += 3) {
      const n = ((digest[i]! << 16) | (digest[i + 1]! << 8) | digest[i + 2]!) % 100000;
      groups.push(n.toString().padStart(5, '0'));
    }
    return groups.join(' ');
  }

  return {
    generateKeyPair,
    encryptMessage,
    decryptMessage,
    encryptFile,
    decryptFile,
    derivePasswordSecrets,
    wrapSecretKey,
    unwrapSecretKey,
    safetyNumber,
  };
}

export type RealmeCrypto = ReturnType<typeof createCrypto>;

function equal(a: Uint8Array, b: Uint8Array) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i]! ^ b[i]!;
  return diff === 0;
}

