import type { RealmeCrypto, Sealed } from '@realme/crypto';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { api, setAuthToken, setUnauthorizedHandler, type MeResponse, type PublicUser } from './api';
import { realtime } from './realtime';
import { secureStorage } from './secureStorage';
import { getCrypto } from './sodium';

const TOKEN_KEY = 'realme.token';
const SECRET_KEY = 'realme.secretKey';

export interface CoupleSettings {
  anniversary?: string; // YYYY-MM-DD
  coupleName?: string;
}

type Status = 'loading' | 'signedOut' | 'signedIn';

interface SessionValue {
  status: Status;
  me: MeResponse | null;
  settings: CoupleSettings;
  signUp(input: { email: string; password: string; displayName: string }): Promise<void>;
  signIn(input: { email: string; password: string }): Promise<void>;
  signOut(): Promise<void>;
  refresh(): Promise<void>;
  /** Encrypt something for the couple, as me. */
  seal<T>(value: T): Sealed;
  /** Decrypt something written by `senderId` (either partner). */
  open<T>(sealed: Sealed, senderId: string): T;
  saveSettings(next: CoupleSettings): Promise<void>;
  crypto: RealmeCrypto | null;
}

const SessionContext = createContext<SessionValue | null>(null);

export function useSession() {
  const value = useContext(SessionContext);
  if (!value) throw new Error('useSession must be used inside <SessionProvider>');
  return value;
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>('loading');
  const [me, setMe] = useState<MeResponse | null>(null);
  const [crypto, setCrypto] = useState<RealmeCrypto | null>(null);
  const secretKey = useRef<string | null>(null);

  const clear = useCallback(async () => {
    realtime.stop();
    setAuthToken(null);
    secretKey.current = null;
    await secureStorage.remove(TOKEN_KEY);
    await secureStorage.remove(SECRET_KEY);
    setMe(null);
    setStatus('signedOut');
  }, []);

  const refresh = useCallback(async () => {
    setMe(await api<MeResponse>('GET', '/me'));
  }, []);

  const start = useCallback(async (token: string, key: string) => {
    setAuthToken(token);
    secretKey.current = key;
    await secureStorage.set(TOKEN_KEY, token);
    await secureStorage.set(SECRET_KEY, key);
    setMe(await api<MeResponse>('GET', '/me'));
    realtime.start(token);
    setStatus('signedIn');
  }, []);

  // Restore a saved session on launch.
  useEffect(() => {
    setUnauthorizedHandler(() => void clear());
    (async () => {
      setCrypto(await getCrypto());
      const [token, key] = await Promise.all([
        secureStorage.get(TOKEN_KEY),
        secureStorage.get(SECRET_KEY),
      ]);
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

  // Pairing, unpairing and settings changes from the other phone.
  useEffect(() => realtime.subscribe((evt) => {
    if (evt.type === 'couple_changed') void refresh().catch(() => {});
  }), [refresh]);

  const signUp = useCallback<SessionValue['signUp']>(async ({ email, password, displayName }) => {
    const c = await getCrypto();
    const keys = c.generateKeyPair();
    const { authSecret, backupKey } = c.derivePasswordSecrets(email, password);
    const res = await api<{ token: string; user: PublicUser }>('POST', '/auth/signup', {
      email,
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

  const value = useMemo<SessionValue>(() => {
    const partnerKey = () => {
      const pk = me?.couple?.partner?.publicKey;
      if (!pk || !secretKey.current || !crypto || !me?.couple) throw new Error('Not paired yet');
      return { coupleId: me.couple.id, mySecretKey: secretKey.current, partnerPublicKey: pk, c: crypto };
    };
    const seal = <T,>(body: T) => {
      const { c, ...ctx } = partnerKey();
      return c.encryptForCouple(body, { ...ctx, senderId: me!.user.id });
    };
    const open = <T,>(sealed: Sealed, senderId: string) => {
      const { c, ...ctx } = partnerKey();
      return c.decryptForCouple<T>(sealed, { ...ctx, senderId });
    };

    let settings: CoupleSettings = {};
    const raw = me?.couple?.settings;
    if (raw && me?.couple?.partner) {
      try {
        settings = open<CoupleSettings>(raw, raw.updatedBy);
      } catch {
        settings = {};
      }
    }

    return {
      status,
      me,
      settings,
      crypto,
      signUp,
      signIn,
      signOut: clear,
      refresh,
      seal,
      open,
      async saveSettings(next) {
        await api('PUT', '/couple/settings', seal(next));
        await refresh();
      },
    };
  }, [status, me, crypto, signUp, signIn, clear, refresh]);

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}
