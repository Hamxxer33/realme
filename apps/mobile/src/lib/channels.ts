import { useCallback, useEffect, useState } from 'react';
import { api, type ChannelView } from './api';
import { realtime } from './realtime';

/** Channels I follow or own, kept fresh as new posts arrive. */
export function useFollowingChannels() {
  const [channels, setChannels] = useState<ChannelView[] | null>(null);
  const refresh = useCallback(async () => {
    setChannels((await api<{ channels: ChannelView[] }>('GET', '/channels/following')).channels);
  }, []);
  useEffect(() => {
    void refresh().catch(() => {});
    return realtime.subscribe((evt) => {
      if (evt.type === 'channel_post' || evt.type === 'connected') void refresh().catch(() => {});
    });
  }, [refresh]);
  return { channels, refresh };
}

export async function follow(channel: ChannelView, on: boolean): Promise<ChannelView> {
  if (on) return (await api<{ channel: ChannelView }>('POST', `/channels/${channel.id}/follow`)).channel;
  await api('DELETE', `/channels/${channel.id}/follow`);
  return { ...channel, following: false, followerCount: Math.max(0, channel.followerCount - 1), unreadCount: 0 };
}

export const followerLabel = (n: number) => `${n.toLocaleString()} ${n === 1 ? 'follower' : 'followers'}`;
