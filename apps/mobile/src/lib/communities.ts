import { useCallback, useEffect, useState } from 'react';
import { api, type CommunityView } from './api';
import { realtime } from './realtime';

/** Communities I'm in. Refreshes when a community or any chat in it changes. */
export function useCommunities() {
  const [communities, setCommunities] = useState<CommunityView[] | null>(null);
  const refresh = useCallback(async () => {
    setCommunities((await api<{ communities: CommunityView[] }>('GET', '/communities')).communities);
  }, []);
  useEffect(() => {
    void refresh().catch(() => {});
    return realtime.subscribe((evt) => {
      if (evt.type === 'community_changed' || evt.type === 'conversation_changed' || evt.type === 'connected') void refresh().catch(() => {});
    });
  }, [refresh]);
  return { communities, refresh };
}

export function useCommunity(id: string | undefined) {
  const [community, setCommunity] = useState<CommunityView | null | 'missing'>(null);
  const refresh = useCallback(async () => {
    if (!id) return;
    try {
      setCommunity((await api<{ community: CommunityView }>('GET', `/communities/${id}`)).community);
    } catch {
      setCommunity('missing');
    }
  }, [id]);
  useEffect(() => {
    void refresh();
    return realtime.subscribe((evt) => {
      if ((evt.type === 'community_changed' && evt.communityId === id) || evt.type === 'conversation_changed' || evt.type === 'connected') void refresh();
    });
  }, [id, refresh]);
  return { community, refresh, setCommunity };
}
