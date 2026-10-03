import * as SecureStore from 'expo-secure-store';

// Keychain (iOS) / Keystore-backed storage (Android). See secureStorage.web.ts for the web preview.
export const secureStorage = {
  get: (key: string) => SecureStore.getItemAsync(key),
  set: (key: string, value: string) => SecureStore.setItemAsync(key, value),
  remove: (key: string) => SecureStore.deleteItemAsync(key),
};
