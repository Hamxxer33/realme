import type { MediaRef } from '@realme/crypto';
import { useCallback, useEffect, useState } from 'react';
import { api, type MemoryRow } from './api';
import { realtime } from './realtime';
import { useSession } from './session';

export interface MemoryBody {
  title: string;
  date: string; // YYYY-MM-DD
  note?: string;
  media?: MediaRef;
}

export interface Memory extends MemoryBody {
  id: string;
  authorId: string;
}

export function useMemories() {
  const { open, seal } = useSession();
  const [rows, setRows] = useState<MemoryRow[] | null>(null);

  const load = useCallback(async () => {
    setRows((await api<{ memories: MemoryRow[] }>('GET', '/memories')).memories);
  }, []);

  useEffect(() => {
    void load().catch(() => setRows([]));
    return realtime.subscribe((evt) => {
      if (evt.type === 'memory') setRows((r) => [evt.memory, ...(r ?? []).filter((m) => m.id !== evt.memory.id)]);
      if (evt.type === 'memory_deleted') setRows((r) => (r ?? []).filter((m) => m.id !== evt.id));
      if (evt.type === 'connected') void load().catch(() => {});
    });
  }, [load]);

  const memories: Memory[] | null = rows
    ? rows
        .flatMap((row) => {
          try {
            return [{ ...open<MemoryBody>(row, row.authorId), id: row.id, authorId: row.authorId }];
          } catch {
            return [];
          }
        })
        .sort((a, b) => b.date.localeCompare(a.date))
    : null;

  return {
    memories,
    add: async (body: MemoryBody) => {
      const { memory } = await api<{ memory: MemoryRow }>('POST', '/memories', seal(body));
      setRows((r) => [memory, ...(r ?? []).filter((m) => m.id !== memory.id)]);
    },
    remove: async (id: string) => {
      await api('DELETE', `/memories/${id}`);
      setRows((r) => (r ?? []).filter((m) => m.id !== id));
    },
  };
}
