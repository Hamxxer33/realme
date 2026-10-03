import type { EncryptedMessage, RealmeCrypto, Sealed, WrappedKey } from '@realme/crypto';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { api, setAuthToken, setUnauthorizedHandler, type ConversationView, type Me, type PublicUser } from './api';
import { realtime } from './realtime';
import { secureStorage } from './secureStorage';
import { getCrypto } from './sodium';

const TOKEN_KEY = 'realme.token';
const SECRET_KEY = 'realme.secretKey';

type Status = 'loading' | 'signedOut' | 'signedIn';

interface SessionValue {
  status: Status;
  me: Me | null;
  crypto: RealmeCrypto | null;
  signUp(input: { email: string; password: string; username: string; displayName: string }): Promise<void>;
  signIn(input: { email: string; password: string }): Promise<void>;
  signOut(): Promise<void>;
  setMe(me: Me): void;
  /** Encrypt for everyone currently in the conversation (including me). */
  encrypt<T>(conversation: ConversationView, body: T): EncryptedMessage;
  /** Decrypt a message using my key copy and the sender's public key. */
  decrypt<T>(message: Sealed & { key: WrappedKey | null; conversationId: string; senderId: string }, senderPublicKey: string): T;
  /** Public key for a user, from a conversation's members or (for past members) the server. */
  publicKeyOf(userId: string, conversation?: ConversationView): Promise<string | null>;
}

const SessionContext = createContext<SessionValue | null>(null);

export function useSession() {
  const value = useContext(SessionContext);
  if (!value) throw new Error('useSession must be used inside <SessionProvider>');
  return value;
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>('loading');
  const [me, setMe] = useState<Me | null>(null);
  const [crypto, setCrypto] = useState<RealmeCrypto | null>(null);
  const secretKey = useRef<string | null>(null);
  const keyCache = useRef(new Map<string, Promise<string | null>>());

  const clear = useCallback(async () => {
    realtime.stop();
    setAuthToken(null);
    secretKey.current = null;
    keyCache.current.clear();
    await secureStorage.remove(TOKEN_KEY);
    await secureStorage.remove(SECRET_KEY);
    setMe(null);
    setStatus('signedOut');
  }, []);

  const start = useCallback(async (token: string, key: string) => {
    setAuthToken(token);
    secretKey.current = key;
    await secureStorage.set(TOKEN_KEY, token);
    await secureStorage.set(SECRET_KEY, key);
    setMe((await api<{ user: Me }>('GET', '/me')).user);
    realtime.start(token);
    setStatus('signedIn');
  }, []);

  // Restore a saved session on launch.
  useEffect(() => {
    setUnauthorizedHandler(() => void clear());
    (async () => {
      setCrypto(await getCrypto());
      const [token, key] = await Promise.all([secureStorage.get(TOKEN_KEY), secureStorage.get(SECRET_KEY)]);
      if (!token || !key) return setStatus('signedOut');
      try {
        await start(token, key);
      } catch {
        // Offline or expired: an expired token triggers clear() via the 401 handler.
        setStatus((s) => (s === 'loading' ? 'signedOut' : s));
      }
    })();
    return () => setUnauthorizedHandler(null);
  }, [clear, start]);

  const signUp = useCallback<SessionValue['signUp']>(async ({ email, password, username, displayName }) => {
    const c = await getCrypto();
    const keys = c.generateKeyPair();
    const { authSecret, backupKey } = c.derivePasswordSecrets(email, password);
    const res = await api<{ token: string }>('POST', '/auth/signup', {
      email,
      username,
      displayName,
      authSecret,
      publicKey: keys.publicKey,
      keyBackup: c.wrapSecretKey(keys.secretKey, backupKey),
    });
    await start(res.token, keys.secretKey);
  }, [start]);

  const signIn = useCallback<SessionValue['signIn']>(async ({ email, password }) => {
    const c = await getCrypto();
    const { authSecret, backupKey } = c.derivePasswordSecrets(email, password);
    const res = await api<{ token: string; keyBackup: Sealed }>('POST', '/auth/login', { email, authSecret });
    await start(res.token, c.unwrapSecretKey(res.keyBackup, backupKey));
  }, [start]);

  const value = useMemo<SessionValue>(() => ({
    status,
    me,
    crypto,
    signUp,
    signIn,
    signOut: clear,
    setMe,
    encrypt(conversation, body) {
      if (!crypto || !me || !secretKey.current) throw new Error('Not signed in');
      const recipients = Object.fromEntries(conversation.members.map((m) => [m.id, m.publicKey]));
      return crypto.encryptMessage(body, {
        conversationId: conversation.id, senderId: me.id, mySecretKey: secretKey.current, recipients,
      });
    },
    decrypt(message, senderPublicKey) {
      if (!crypto || !secretKey.current) throw new Error('Not signed in');
      if (!message.key) throw new Error('No key for this message');
      return crypto.decryptMessage({ ...message, key: message.key }, {
        conversationId: message.conversationId,
        senderId: message.senderId,
        senderPublicKey,
        mySecretKey: secretKey.current,
      });
    },
    publicKeyOf(userId, conversation) {
      const member = conversation?.members.find((m) => m.id === userId);
      if (member) return Promise.resolve(member.publicKey);
      let job = keyCache.current.get(userId);
      if (!job) {
        job = api<{ user: PublicUser }>('GET', `/users/id/${userId}`).then((r) => r.user.publicKey, () => null);
        keyCache.current.set(userId, job);
      }
      return job;
    },
  }), [status, me, crypto, signUp, signIn, clear]);

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}
