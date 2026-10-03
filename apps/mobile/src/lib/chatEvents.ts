/**
 * Actions taken on the chat-info screen that the chat screen underneath must
 * react to: open in-chat search, or drop messages after "Clear chat".
 */
type ChatEvent = { type: 'search' | 'cleared'; conversationId: string };
const listeners = new Set<(e: ChatEvent) => void>();

export function emitChatEvent(e: ChatEvent) {
  for (const fn of listeners) fn(e);
}

export function onChatEvent(fn: (e: ChatEvent) => void) {
  listeners.add(fn);
  return () => void listeners.delete(fn);
}
