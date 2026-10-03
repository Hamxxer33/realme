import { useCallback, useEffect, useState } from 'react';
import { api, type ConversationView, type GroupEvent } from './api';
import { onChatEvent } from './chatEvents';
import { realtime } from './realtime';

/** Group history lines ("Ana added Ben") for a group chat; empty for 1:1 chats. */
export function useGroupEvents(conv: ConversationView) {
  const [events, setEvents] = useState<GroupEvent[]>([]);
  const isGroup = conv.kind === 'group';
  const id = conv.id;

  const load = useCallback(async () => {
    if (!isGroup) return;
    try {
      setEvents((await api<{ events: GroupEvent[] }>('GET', `/conversations/${id}/events`)).events);
    } catch {
      // Keep what we have; the chat still works without history lines.
    }
  }, [id, isGroup]);

  useEffect(() => {
    void load();
    const offRealtime = realtime.subscribe((evt) => {
      if ((evt.type === 'conversation_changed' && evt.conversationId === id) || evt.type === 'connected') void load();
    });
    const offChat = onChatEvent((e) => {
      if (e.type === 'cleared' && e.conversationId === id) setEvents([]);
    });
    return () => {
      offRealtime();
      offChat();
    };
  }, [id, load]);

  return events;
}

/** One-line description, from my point of view. */
export function describeEvent(e: GroupEvent, myId: string, announcements = false) {
  const who = (p: GroupEvent['actor']) => (!p ? 'Someone' : p.id === myId ? 'You' : p.displayName);
  const whom = (p: GroupEvent['target']) => (!p ? 'someone' : p.id === myId ? 'you' : p.displayName);
  const actor = who(e.actor);
  switch (e.kind) {
    case 'created': return `${actor} created the ${announcements ? 'community' : 'group'} "${e.detail ?? ''}"`;
    case 'added': return `${actor} added ${whom(e.target)}`;
    case 'removed': return `${actor} removed ${whom(e.target)}`;
    case 'left': return `${actor} left`;
    case 'joined': return `${actor} joined from the community`;
    case 'renamed': return `${actor} changed the group name to "${e.detail ?? ''}"`;
    case 'described': return `${actor} changed the group description`;
    case 'promoted': return e.actor
      ? `${actor} made ${whom(e.target)} an admin`
      : `${e.target?.id === myId ? "You're" : `${whom(e.target)} is`} now an admin`;
    case 'demoted': return `${actor} dismissed ${whom(e.target)} as admin`;
    case 'settings': {
      const [what, who] = (e.detail ?? '').split(':');
      if (what === 'messages') return who === 'admins'
        ? `${actor} changed this group so only admins can send messages`
        : `${actor} changed this group so all members can send messages`;
      return who === 'admins'
        ? `${actor} changed this group so only admins can edit the group info`
        : `${actor} changed this group so all members can edit the group info`;
    }
  }
}
