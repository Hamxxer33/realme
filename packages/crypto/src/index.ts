/**
 * End-to-end encryption for Realme.
 *
 * Every user has an X25519 key pair generated on their device. A couple's
 * messages are sealed with `crypto_box` using one partner's secret key and the
 * other's public key. Because X25519 is symmetric, either partner can open any
 * message in the conversation (including their own), while the server — which
 * only ever sees ciphertext — can open none.
 *
 * Photos and voice notes are encrypted with a fresh random key per file
 * (XChaCha20-Poly1305); that key travels inside the encrypted message.
 *
 * The secret key is backed up to the server encrypted under a key derived from
 * the user's password (Argon2id), so a new phone can restore it. The password
 * itself never leaves the device: the server only receives a separate
 * authentication secret derived from the same master key.
 *
 * Sodium is injected so the same code runs on react-native-libsodium (app) and
 * libsodium-wrappers-sumo (Node tests). Call sites must await `sodium.ready`.
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
    message: Uint8Array,
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

/** What is actually encrypted: the body plus who sent it to whom, so the server can't relabel a message. */
interface Envelope<T> {
  v: 1;
  coupleId: string;
  senderId: string;
  body: T;
}

export class DecryptionError extends Error {
  constructor(message = 'Could not decrypt') {
    super(message);
    this.name = 'DecryptionError';
  }
}

const MEDIA_AD = 'realme-media-v1';
const KDF_CONTEXT = 'realmekd'; // crypto_kdf contexts are exactly 8 bytes
const AUTH_SUBKEY_ID = 1;
const BACKUP_SUBKEY_ID = 2;

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

  function seal<T>(value: T, mySecretKey: string, partnerPublicKey: string): Sealed {
    const nonce = sodium.randombytes_buf(sodium.crypto_box_NONCEBYTES);
    const ciphertext = sodium.crypto_box_easy(JSON.stringify(value), nonce, unb64(partnerPublicKey), unb64(mySecretKey));
    return { nonce: b64(nonce), ciphertext: b64(ciphertext) };
  }

  function open<T>(sealed: Sealed, mySecretKey: string, partnerPublicKey: string): T {
    let plaintext: Uint8Array;
    try {
      plaintext = sodium.crypto_box_open_easy(
        unb64(sealed.ciphertext),
        unb64(sealed.nonce),
        unb64(partnerPublicKey),
        unb64(mySecretKey),
      );
    } catch {
      throw new DecryptionError();
    }
    return JSON.parse(sodium.to_string(plaintext)) as T;
  }

  /**
   * Encrypt a couple-scoped record (message, memory, settings). The couple and
   * sender ids are sealed inside and checked on open, so ciphertext can't be
   * replayed into another couple or attributed to the other partner.
   */
  function encryptForCouple<T>(
    body: T,
    ctx: { coupleId: string; senderId: string; mySecretKey: string; partnerPublicKey: string },
  ): Sealed {
    const envelope: Envelope<T> = { v: 1, coupleId: ctx.coupleId, senderId: ctx.senderId, body };
    return seal(envelope, ctx.mySecretKey, ctx.partnerPublicKey);
  }

  function decryptForCouple<T>(
    sealed: Sealed,
    ctx: { coupleId: string; senderId: string; mySecretKey: string; partnerPublicKey: string },
  ): T {
    const envelope = open<Envelope<T>>(sealed, ctx.mySecretKey, ctx.partnerPublicKey);
    if (envelope.v !== 1 || envelope.coupleId !== ctx.coupleId || envelope.senderId !== ctx.senderId) {
      throw new DecryptionError('Message metadata does not match');
    }
    return envelope.body;
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
   * A short code both partners can compare in person. It is the same on both
   * phones only if each holds the other's real public key, which rules out a
   * server swapping keys to read messages.
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
    encryptForCouple,
    decryptForCouple,
    encryptFile,
    decryptFile,
    derivePasswordSecrets,
    wrapSecretKey,
    unwrapSecretKey,
    safetyNumber,
  };
}

export type RealmeCrypto = ReturnType<typeof createCrypto>;
