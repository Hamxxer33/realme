import { useEffect, useState } from 'react';
import { api, type PublicUser } from './api';

/** Debounced @username / name search. */
export function useUserSearch(query: string) {
  const [results, setResults] = useState<PublicUser[]>([]);
  const [searching, setSearching] = useState(false);
  useEffect(() => {
    const q = query.trim();
    if (!q) {
      setResults([]);
      return;
    }
    let alive = true;
    setSearching(true);
    const t = setTimeout(() => {
      api<{ users: PublicUser[] }>('GET', `/users/search?q=${encodeURIComponent(q)}`)
        .then((r) => alive && setResults(r.users), () => alive && setResults([]))
        .finally(() => alive && setSearching(false));
    }, 250);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [query]);
  return { results, searching };
}
