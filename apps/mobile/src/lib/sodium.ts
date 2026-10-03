import { createCrypto, type RealmeCrypto } from '@realme/crypto';
import sodium, { loadSumoVersion } from 'react-native-libsodium';

// On web, react-native-libsodium wraps libsodium.js, whose default build lacks
// crypto_pwhash. Ask for the "sumo" build; this must run before it finishes
// loading (a no-op on iOS/Android, which always include everything).
loadSumoVersion();

let instance: RealmeCrypto | null = null;

/** Resolves once libsodium is loaded. Native builds are ready immediately; web waits for WASM. */
export async function getCrypto(): Promise<RealmeCrypto> {
  if (!instance) {
    await sodium.ready;
    instance = createCrypto(sodium);
  }
  return instance;
}
