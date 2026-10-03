import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Avatar, GroupAvatar } from '../../components/Avatar';
import { BackHeader } from '../../components/BackHeader';
import { Icon, type IconName } from '../../components/Icon';
import { ReportSheet, type ReportTarget } from '../../components/ReportSheet';
import { Button, Card, ErrorText, Field, Screen } from '../../components/ui';
import { UserRow } from '../../components/UserRow';
import { api, type ConversationView } from '../../lib/api';
import { confirm, notify } from '../../lib/confirm';
import { forget, upsert, useConversation } from '../../lib/conversations';
import { conversationTitle, otherMembers } from '../../lib/format';
import { useSession } from '../../lib/session';
import { colors, fonts, space } from '../../theme';

export default function ChatInfo() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const conv = useConversation(id);
  const { me, crypto } = useSession();
  const [report, setReport] = useState<ReportTarget | null>(null);
  const [renaming, setRenaming] = useState(false);
  const [title, setTitle] = useState(conv?.title ?? '');
  const [error, setError] = useState<string | null>(null);
  if (!conv || !me) return <Screen><BackHeader title="" /></Screen>;

  const others = otherMembers(conv, me.id);
  const isGroup = conv.kind === 'group';
  const admin = conv.myRole === 'admin';
  const other = others[0];
  const name = conversationTitle(conv, me.id);
  const safety = !isGroup && other && crypto ? crypto.safetyNumber(me.publicKey, other.publicKey) : null;

  const rename = async () => {
    setError(null);
    try {
      const { conversation } = await api<{ conversation: ConversationView }>('PATCH', `/conversations/${conv.id}`, { title });
      upsert(conversation);
      setRenaming(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
    }
  };

  const removeMember = async (userId: string, displayName: string) => {
    if (!(await confirm(`Remove ${displayName}?`, 'They will no longer get new messages in this group.', 'Remove'))) return;
    try {
      await api('DELETE', `/conversations/${conv.id}/members/${userId}`);
      upsert({ ...conv, members: conv.members.filter((m) => m.id !== userId) });
    } catch {
      notify("Couldn't remove");
    }
  };

  const leave = async () => {
    const ok = await confirm(
      isGroup ? `Leave ${name}?` : 'Delete this chat?',
      isGroup ? "You won't get new messages from this group." : 'It will be removed from your chats. They can still message you.',
      isGroup ? 'Leave' : 'Delete',
    );
    if (!ok) return;
    await api('DELETE', `/conversations/${conv.id}/membership`).catch(() => {});
    forget(conv.id);
    router.dismissAll();
  };

  const block = async () => {
    if (!other) return;
    if (!(await confirm(`Block ${other.displayName}?`, "They won't be able to message you or see your posts. They won't be told.", 'Block'))) return;
    await api('POST', '/blocks', { userId: other.id }).catch(() => {});
    forget(conv.id);
    router.dismissAll();
  };

  return (
    <Screen>
      <BackHeader title={isGroup ? 'Group info' : 'Chat info'} />
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.hero}>
          {isGroup
            ? <GroupAvatar size={80} />
            : <Avatar name={name} seed={other?.username ?? conv.id} size={80} />}
          <Text accessibilityRole="header" style={styles.name}>{name}</Text>
          {!isGroup && other ? (
            <Pressable accessibilityRole="link" onPress={() => router.push(`/user/${other.username}`)}>
              <Text style={styles.link}>@{other.username} · View profile</Text>
            </Pressable>
          ) : null}
        </View>

        {isGroup && admin ? (
          renaming ? (
            <Card style={{ gap: space.md }}>
              <Field label="Group name" value={title} onChangeText={setTitle} maxLength={60} />
              <ErrorText>{error}</ErrorText>
              <Button title="Save" onPress={() => void rename()} />
            </Card>
          ) : (
            <Card style={styles.menu}>
              <Row icon="edit" label="Rename group" onPress={() => setRenaming(true)} />
              <Row icon="plus" label="Add people" onPress={() => router.push({ pathname: '/new-group', params: { add: conv.id } })} />
            </Card>
          )
        ) : null}

        {isGroup ? (
          <Card style={{ paddingHorizontal: 0, paddingVertical: space.sm }}>
            <Text style={[styles.section, { paddingHorizontal: space.lg }]}>{conv.members.length} people</Text>
            {conv.members.map((m) => (
              <UserRow
                key={m.id}
                user={m}
                subtitle={`@${m.username}${m.role === 'admin' ? ' · Admin' : ''}${m.status === 'pending' ? ' · Invited' : ''}`}
                onPress={m.id === me.id ? undefined : () => router.push(`/user/${m.username}`)}
                right={admin && m.id !== me.id ? (
                  <Pressable accessibilityRole="button" accessibilityLabel={`Remove ${m.displayName}`} onPress={() => void removeMember(m.id, m.displayName)} hitSlop={8}>
                    <Text style={styles.remove}>Remove</Text>
                  </Pressable>
                ) : null}
              />
            ))}
          </Card>
        ) : null}

        {safety ? (
          <Card style={{ gap: space.sm }}>
            <View style={styles.lockRow}>
              <Icon name="lock" size={18} color={colors.rose} />
              <Text style={styles.section}>Encryption</Text>
            </View>
            <Text style={styles.small}>
              Compare this number with {other?.displayName}'s phone, in person. If they match, nobody — including our server — can read your chat.
            </Text>
            <Text style={styles.safety} selectable accessibilityLabel={`Safety number ${safety}`}>{safety}</Text>
          </Card>
        ) : null}

        <Card style={styles.menu}>
          {!isGroup ? <Row icon="block" label={`Block ${other?.displayName ?? ''}`} onPress={() => void block()} danger /> : null}
          <Row icon="flag" label={isGroup ? 'Report group' : `Report ${other?.displayName ?? ''}`} danger
            onPress={() => setReport({ conversationId: conv.id, userId: isGroup ? undefined : other?.id, label: isGroup ? 'this group' : `@${other?.username}` })} />
          <Row icon="trash" label={isGroup ? 'Leave group' : 'Delete chat'} onPress={() => void leave()} danger />
        </Card>
      </ScrollView>
      <ReportSheet target={report} onClose={() => setReport(null)} />
    </Screen>
  );
}

function Row({ icon, label, onPress, danger }: { icon: IconName; label: string; onPress: () => void; danger?: boolean }) {
  const color = danger ? colors.danger : colors.ink;
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.row, pressed && { opacity: 0.6 }]}>
      <Icon name={icon} color={color} size={22} />
      <Text style={[styles.rowText, { color }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { padding: space.lg, gap: space.lg },
  hero: { alignItems: 'center', gap: space.xs },
  name: { fontFamily: fonts.heavy, fontSize: 24, color: colors.ink, marginTop: space.sm, textAlign: 'center' },
  link: { fontFamily: fonts.bold, fontSize: 15, color: colors.rose },
  menu: { paddingVertical: space.sm, paddingHorizontal: space.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 52 },
  rowText: { flex: 1, fontFamily: fonts.bold, fontSize: 16 },
  section: { fontFamily: fonts.bold, fontSize: 16, color: colors.ink },
  remove: { fontFamily: fonts.bold, fontSize: 14, color: colors.danger },
  lockRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  small: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, color: colors.inkMuted },
  safety: { fontFamily: fonts.bold, fontSize: 19, letterSpacing: 2, lineHeight: 30, color: colors.ink, textAlign: 'center', paddingVertical: space.sm, fontVariant: ['tabular-nums'] },
});

