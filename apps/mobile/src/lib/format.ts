import type { ConversationView, MemberView } from './api';

export function otherMembers(conv: ConversationView, myId: string): MemberView[] {
  return conv.members.filter((m) => m.id !== myId);
}

export function conversationTitle(conv: ConversationView, myId: string) {
  if (conv.kind === 'group') return conv.title ?? 'Group';
  return otherMembers(conv, myId)[0]?.displayName ?? 'Deleted account';
}

/** "3:42 PM" today, "Tue" this week, otherwise "12 Mar". */
export function shortTime(iso: string, now = new Date()) {
  const d = new Date(iso);
  const sameDay = d.toDateString() === now.toDateString();
  if (sameDay) return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  const days = (now.getTime() - d.getTime()) / 86_400_000;
  if (days < 6) return d.toLocaleDateString([], { weekday: 'short' });
  return d.toLocaleDateString([], { day: 'numeric', month: 'short' });
}

/** "now", "5m", "3h", "2d", then a date. */
export function ago(iso: string, now = new Date()) {
  const s = Math.max(0, (now.getTime() - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'now';
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  if (s < 7 * 86400) return `${Math.floor(s / 86400)}d`;
  return new Date(iso).toLocaleDateString([], { day: 'numeric', month: 'short' });
}
