import { useSyncExternalStore } from 'react';
import { secureStorage } from './secureStorage';

export type AppearancePref = 'system' | 'light' | 'dark';
const KEY = 'realme.appearance';

let pref: AppearancePref = 'system';
const listeners = new Set<() => void>();

export async function loadAppearance() {
  try {
    const saved = await secureStorage.get(KEY);
    if (saved === 'light' || saved === 'dark' || saved === 'system') pref = saved;
  } catch {
    // keep default
  }
  for (const fn of listeners) fn();
}

export function setAppearance(next: AppearancePref) {
  pref = next;
  void secureStorage.set(KEY, next).catch(() => {});
  for (const fn of listeners) fn();
}

export function useAppearance() {
  return useSyncExternalStore(
    (fn) => {
      listeners.add(fn);
      return () => void listeners.delete(fn);
    },
    () => pref,
  );
}
