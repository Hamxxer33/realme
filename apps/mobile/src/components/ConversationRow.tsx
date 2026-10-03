import type { MessageBody } from '@realme/crypto';
import { memo, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { ConversationView } from '../lib/api';
import { conversationTitle, otherMembers, shortTime } from '../lib/format';
import { useSession } from '../lib/session';
import { colors, fonts, space, themed } from '../theme';
import { Avatar, GroupAvatar } from './Avatar';

function preview(body: MessageBody | null, mine: boolean, sender: string | null) {
  const who = mine ? 'You: ' : sender ? `${sender}: ` : '';
  if (!body) return 'Encrypted message';
  switch (body.kind) {
    case 'text': return who + body.text;
    case 'image': return `${who}📷 Photo`;
    case 'voice': return `${who}🎤 Voice note`;
    case 'nudge': return mine ? 'You sent a little love' : `${sender ?? 'They'} sent a little love ❤️`;
    case 'reaction': return `${who}reacted ${body.emoji}`;
  }
}

export const ConversationRow = memo(function ConversationRow({ conv, onPress }: { conv: ConversationView; onPress: () => void }) {
  const { me, decrypt, publicKeyOf } = useSession();
  const myId = me?.id ?? '';
  const others = otherMembers(conv, myId);
  const title = conversationTitle(conv, myId);
  const last = conv.lastMessage;
  const [text, setText] = useState<string>('');

  useEffect(() => {
    let alive = true;
    if (!last) return setText(conv.kind === 'group' ? `${conv.members.length} people` : 'Say hi 👋');
    void publicKeyOf(last.senderId, conv).then((key) => {
      let body: MessageBody | null = null;
      try {
        body = key ? decrypt<MessageBody>(last, key) : null;
      } catch {
        body = null;
      }
      const sender = conv.kind === 'group' ? conv.members.find((m) => m.id === last.senderId)?.displayName ?? null : null;
      if (alive) setText(preview(body, last.senderId === myId, sender));
    });
    return () => {
      alive = false;
    };
  }, [last?.id, conv.members.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const unread = conv.unreadCount > 0;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${title}${unread ? `, ${conv.unreadCount} unread` : ''}`}
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.surfaceMuted }]}
    >
      {conv.kind === 'group'
        ? <GroupAvatar size={52} />
        : <Avatar name={title} seed={others[0]?.username ?? conv.id} size={52} />}
      <View style={{ flex: 1, gap: 2 }}>
        <View style={styles.top}>
          <Text style={[styles.title, unread && { fontFamily: fonts.heavy }]} numberOfLines={1}>{title}</Text>
          {last ? <Text style={[styles.time, unread && { color: colors.rose }]}>{shortTime(last.createdAt)}</Text> : null}
        </View>
        <View style={styles.top}>
          <Text style={[styles.preview, unread && { color: colors.ink, fontFamily: fonts.medium }]} numberOfLines={1}>{text}</Text>
          {unread ? (
            <View style={styles.badge}><Text style={styles.badgeText}>{conv.unreadCount > 99 ? '99+' : conv.unreadCount}</Text></View>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
});

const styles = themed(() => StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.lg, paddingVertical: 10 },
  top: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  title: { flex: 1, fontFamily: fonts.bold, fontSize: 16, color: colors.ink },
  time: { fontFamily: fonts.medium, fontSize: 12, color: colors.inkMuted },
  preview: { flex: 1, fontFamily: fonts.regular, fontSize: 14, color: colors.inkMuted },
  badge: { minWidth: 22, height: 22, borderRadius: 11, paddingHorizontal: 6, backgroundColor: colors.roseFill, alignItems: 'center', justifyContent: 'center' },
  badgeText: { fontFamily: fonts.bold, fontSize: 12, color: colors.onRose },
}));
