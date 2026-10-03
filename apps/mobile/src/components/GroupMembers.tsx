import { router } from 'expo-router';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { api, type ConversationView, type MemberView } from '../lib/api';
import { confirm, notify } from '../lib/confirm';
import { upsert } from '../lib/conversations';
import { colors, fonts, radius, space, themed } from '../theme';
import { Avatar } from './Avatar';
import { Icon, type IconName } from './Icon';

/** Me first, then admins, then everyone else by name. */
export function sortMembers(members: MemberView[], myId: string) {
  return [...members].sort((a, b) =>
    Number(b.id === myId) - Number(a.id === myId)
    || Number(b.role === 'admin') - Number(a.role === 'admin')
    || a.displayName.localeCompare(b.displayName));
}

export function MemberRow({ member, myId, onPress }: { member: MemberView; myId: string; onPress?: () => void }) {
  const me = member.id === myId;
  const name = me ? 'You' : member.displayName;
  return (
    <Pressable
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={member.role === 'admin' ? `${name}, group admin` : name}
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.surfaceMuted }]}
    >
      <Avatar name={member.displayName} seed={member.username} size={44} />
      <View style={{ flex: 1 }}>
        <Text style={styles.rowTitle} numberOfLines={1}>{name}</Text>
        <Text style={styles.rowSub} numberOfLines={1}>
          {member.bio || `@${member.username}`}{member.status === 'pending' ? ' · Invited' : ''}
        </Text>
      </View>
      {member.role === 'admin' ? <Text style={styles.badge}>Group admin</Text> : null}
    </Pressable>
  );
}

/** What you can do with someone in a group: message, view, and (for admins) promote or remove. */
export function MemberSheet({ conv, member, myId, onClose }: {
  conv: ConversationView;
  member: MemberView | null;
  myId: string;
  onClose: () => void;
}) {
  const admin = conv.myRole === 'admin';
  const close = onClose;

  const run = (fn: () => Promise<void>) => () => {
    close();
    void fn();
  };

  const message = run(async () => {
    try {
      const { conversation } = await api<{ conversation: ConversationView }>('POST', '/conversations/direct', { userId: member!.id });
      upsert(conversation);
      router.push(`/chat/${conversation.id}`);
    } catch (e) {
      notify("Couldn't start chat", e instanceof Error ? e.message : undefined);
    }
  });

  const setRole = (role: 'admin' | 'member') => run(async () => {
    try {
      const { conversation } = await api<{ conversation: ConversationView }>('PATCH', `/conversations/${conv.id}/members/${member!.id}`, { role });
      upsert(conversation);
    } catch (e) {
      notify("Couldn't change admin", e instanceof Error ? e.message : undefined);
    }
  });

  const remove = run(async () => {
    const body = conv.announcements ? 'They will leave the community and all of its groups.' : 'They will no longer get new messages in this group.';
    if (!(await confirm(`Remove ${member!.displayName}?`, body, 'Remove'))) return;
    try {
      // In a community's announcements, removing someone removes them from the whole community.
      await api('DELETE', conv.announcements && conv.community
        ? `/communities/${conv.community.id}/members/${member!.id}`
        : `/conversations/${conv.id}/members/${member!.id}`);
      upsert({ ...conv, members: conv.members.filter((m) => m.id !== member!.id) });
    } catch {
      notify("Couldn't remove");
    }
  });

  return (
    <Modal visible={!!member} transparent animationType="slide" onRequestClose={close}>
      <Pressable accessibilityRole="button" style={styles.scrim} onPress={close} accessibilityLabel="Close" />
      {member ? (
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <View style={styles.head}>
            <Avatar name={member.displayName} seed={member.username} size={56} />
            <View style={{ flex: 1 }}>
              <Text style={styles.headName} numberOfLines={1}>{member.displayName}</Text>
              <Text style={styles.rowSub}>@{member.username}{member.role === 'admin' ? ' · Group admin' : ''}</Text>
            </View>
          </View>
          <View style={styles.actions}>
            <Action icon="chat" label={`Message ${member.displayName}`} onPress={message} />
            <Action icon="user" label={`View ${member.displayName}`} onPress={() => { close(); router.push(`/user/${member.username}`); }} />
            {admin && member.id !== myId ? (
              member.role === 'admin'
                ? <Action icon="shield" label="Dismiss as admin" onPress={setRole('member')} />
                : <Action icon="shield" label="Make group admin" onPress={setRole('admin')} />
            ) : null}
            {admin && member.id !== myId ? <Action icon="logout" danger label={`Remove ${member.displayName}`} onPress={remove} /> : null}
          </View>
        </View>
      ) : null}
    </Modal>
  );
}

function Action({ icon, label, onPress, danger }: { icon: IconName; label: string; onPress: () => void; danger?: boolean }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={({ pressed }) => [styles.action, pressed && { backgroundColor: colors.surfaceMuted }]}>
      <Icon name={icon} color={danger ? colors.danger : colors.inkMuted} size={22} />
      <Text style={[styles.actionText, danger && { color: colors.danger }]} numberOfLines={1}>{label}</Text>
    </Pressable>
  );
}

const styles = themed(() => StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.md, paddingVertical: 10, minHeight: 60 },
  rowTitle: { fontFamily: fonts.bold, fontSize: 16, color: colors.ink },
  rowSub: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 19, color: colors.inkMuted, marginTop: 1 },
  badge: { fontFamily: fonts.bold, fontSize: 12, color: colors.rose, backgroundColor: colors.roseTint, paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill, overflow: 'hidden' },
  scrim: { flex: 1, backgroundColor: colors.scrim },
  sheet: { backgroundColor: colors.bg, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, paddingHorizontal: space.md, paddingBottom: space.xl },
  handle: { alignSelf: 'center', width: 40, height: 5, borderRadius: 3, backgroundColor: colors.surfaceMuted, marginTop: space.sm, marginBottom: space.md },
  head: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.sm, paddingBottom: space.md },
  headName: { fontFamily: fonts.heavy, fontSize: 20, color: colors.ink },
  actions: { backgroundColor: colors.surface, borderRadius: radius.lg, overflow: 'hidden', paddingVertical: space.xs },
  action: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.md, minHeight: 54 },
  actionText: { flex: 1, fontFamily: fonts.bold, fontSize: 16, color: colors.ink },
}));
