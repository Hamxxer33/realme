import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Avatar, ConversationAvatar, GroupAvatar } from '../../components/Avatar';
import { Icon, type IconName } from '../../components/Icon';
import { EncryptedImage } from '../../components/Media';
import { MemberRow as GroupMemberRow, MemberSheet, sortMembers } from '../../components/GroupMembers';
import { ReportSheet, type ReportTarget } from '../../components/ReportSheet';
import { Screen } from '../../components/ui';
import { api, type ConversationView, type MemberView } from '../../lib/api';
import { emitChatEvent } from '../../lib/chatEvents';
import { confirm, notify } from '../../lib/confirm';
import { forget, upsert, useConversation, useConversations } from '../../lib/conversations';
import { conversationTitle, otherMembers } from '../../lib/format';
import { useSession } from '../../lib/session';
import { useChat } from '../../lib/useChat';
import { colors, fonts, radius, shadow, space, themed } from '../../theme';

export default function ChatInfoScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const conv = useConversation(id);
  const { me } = useSession();
  if (!conv || !me) return <Screen><Header onBack={() => router.back()} /></Screen>;
  return <ChatInfo conv={conv} />;
}

function ChatInfo({ conv }: { conv: ConversationView }) {
  const { me } = useSession();
  const myId = me!.id;
  const { chats } = useConversations();
  const chat = useChat(conv);
  const [report, setReport] = useState<ReportTarget | null>(null);
  const [selected, setSelected] = useState<MemberView | null>(null);
  const [expanded, setExpanded] = useState(false);

  const isGroup = conv.kind === 'group';
  const admin = conv.myRole === 'admin';
  // A community's announcements are edited from the community itself.
  const canEdit = isGroup && !conv.announcements && conv.myStatus === 'accepted' && (admin || !conv.adminsOnlyEdit);
  const PREVIEW = 8;
  const sortedMembers = useMemo(() => sortMembers(conv.members, myId), [conv.members, myId]);
  const others = otherMembers(conv, myId);
  const other = others[0];
  const name = conversationTitle(conv, myId);

  // Photos shared in this chat (from the history loaded on this device).
  const photos = useMemo(
    () => chat.messages.flatMap((m) => (m.body?.kind === 'image' ? [{ id: m.id, media: m.body.media }] : [])),
    [chat.messages],
  );
  const groupsInCommon = useMemo(
    () => (other ? (chats ?? []).filter((c) => c.kind === 'group' && c.members.some((m) => m.id === other.id)) : []),
    [chats, other],
  );

  const setMuted = async (muted: boolean) => {
    upsert({ ...conv, myMuted: muted });
    try {
      const { conversation } = await api<{ conversation: ConversationView }>('PATCH', `/conversations/${conv.id}/me`, { muted });
      upsert(conversation);
    } catch {
      upsert({ ...conv, myMuted: !muted });
      notify("Couldn't change notifications");
    }
  };

  const search = () => {
    emitChatEvent({ type: 'search', conversationId: conv.id });
    router.back();
  };

  const clearChat = async () => {
    const ok = await confirm('Clear this chat?', 'Messages will be removed from this chat for you. Others keep their copy.', 'Clear chat');
    if (!ok) return;
    try {
      const { conversation } = await api<{ conversation: ConversationView }>('POST', `/conversations/${conv.id}/clear`);
      upsert(conversation);
      emitChatEvent({ type: 'cleared', conversationId: conv.id });
    } catch {
      notify("Couldn't clear chat");
    }
  };

  const leave = async () => {
    if (conv.announcements && conv.community) {
      const ok = await confirm(`Leave ${conv.community.name}?`, "You'll leave the announcements and every group in this community.", 'Leave community');
      if (!ok) return;
      await api('DELETE', `/communities/${conv.community.id}/membership`).catch(() => {});
      forget(conv.id);
      router.dismissAll();
      return;
    }
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
      <Header onBack={() => router.back()} onEdit={canEdit ? () => router.push(`/group-edit/${conv.id}`) : undefined} />
      <ScrollView contentContainerStyle={styles.container}>
        {/* Hero */}
        <Animated.View entering={FadeInDown.springify().damping(20)} style={styles.hero}>
          <ConversationAvatar conv={conv} title={name} seed={other?.username ?? conv.id} size={112} />
          <Text accessibilityRole="header" style={styles.name}>{name}</Text>
          <Text style={styles.sub}>
            {isGroup
              ? `${conv.announcements ? 'Announcements' : 'Group'} · ${conv.members.length} ${conv.members.length === 1 ? 'member' : 'members'}`
              : other ? `@${other.username}` : ''}
          </Text>
          {!isGroup && other?.bio ? <Text style={styles.bio}>{other.bio}</Text> : null}

          <View style={styles.actions}>
            {isGroup ? (
              admin ? <QuickAction icon="plus" label="Add" onPress={() => router.push({ pathname: '/new-group', params: { add: conv.id } })} /> : null
            ) : (
              <QuickAction icon="user" label="Profile" onPress={() => other && router.push(`/user/${other.username}`)} />
            )}
            <QuickAction icon="search" label="Search" onPress={search} />
            <QuickAction icon={conv.myMuted ? 'bellOff' : 'bell'} label={conv.myMuted ? 'Unmute' : 'Mute'} onPress={() => void setMuted(!conv.myMuted)} />
          </View>
        </Animated.View>

        {conv.community ? (
          <Section>
            <Row icon="community" accent title={conv.community.name} subtitle={conv.announcements ? 'Community · Only admins can post here' : 'Part of this community'} onPress={() => router.push(`/community/${conv.community!.id}`)} />
          </Section>
        ) : null}

        {isGroup ? (
          <Section>
            {conv.description ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Group description"
                onPress={() => setExpanded((x) => !x)}
                style={styles.description}
              >
                <Text style={styles.descriptionText} numberOfLines={expanded ? undefined : 3}>{conv.description}</Text>
                {!expanded && (conv.description.length > 140 || conv.description.split('\n').length > 3)
                  ? <Text style={styles.readMore}>Read more</Text> : null}
              </Pressable>
            ) : canEdit ? (
              <Row icon="edit" title="Add group description" onPress={() => router.push({ pathname: '/group-edit/[id]', params: { id: conv.id, focus: 'description' } })} />
            ) : null}
            <Text style={styles.created}>
              Created by {conv.createdBy ? (conv.createdBy.id === myId ? 'you' : conv.createdBy.displayName) : 'a former member'}, {formatDate(conv.createdAt)}
            </Text>
          </Section>
        ) : null}

        {/* Shared photos */}
        <Section>
          <View style={styles.sectionHead}>
            <Text style={styles.sectionTitle}>Photos</Text>
            <Text style={styles.count}>{photos.length}</Text>
          </View>
          {photos.length ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.photos}>
              {photos.slice(0, 20).map((p) => (
                <View key={p.id} style={styles.thumb}>
                  <EncryptedImage media={{ ...p.media, width: 1, height: 1 }} maxWidth={96} onPress={(uri) => router.push({ pathname: '/photo', params: { uri } })} />
                </View>
              ))}
            </ScrollView>
          ) : (
            <Text style={styles.emptyLine}>Photos you share here will show up here.</Text>
          )}
        </Section>

        {/* Settings */}
        <Section>
          <Row
            icon={conv.myMuted ? 'bellOff' : 'bell'}
            title="Notifications"
            subtitle={conv.myMuted ? 'Muted' : 'On'}
            right={
              <Switch
                value={!conv.myMuted}
                onValueChange={(on) => void setMuted(!on)}
                trackColor={{ true: colors.roseFill, false: colors.surfaceMuted }}
                thumbColor="#FFFFFF"
                ios_backgroundColor={colors.surfaceMuted}
                // react-native-web colours the active thumb separately (teal by default).
                {...({ activeThumbColor: '#FFFFFF' } as object)}
                accessibilityLabel="Notifications"
              />
            }
          />
          {isGroup && admin && !conv.announcements ? (
            <Row icon="settings" title="Group settings" subtitle={groupSettingsSummary(conv)} onPress={() => router.push(`/group-settings/${conv.id}`)} />
          ) : null}
          <Row
            icon="lock"
            title="Encryption"
            subtitle={isGroup ? 'Messages are end-to-end encrypted. Only members can read them.' : 'Messages are end-to-end encrypted. Tap to verify.'}
            onPress={!isGroup && other ? () => router.push(`/verify/${conv.id}`) : undefined}
          />
        </Section>

        {/* People */}
        {isGroup ? (
          <Section>
            <View style={styles.sectionHead}>
              <Text style={styles.sectionTitle}>{conv.members.length} members</Text>
              <Pressable accessibilityRole="button" accessibilityLabel="Search members" onPress={() => router.push(`/members/${conv.id}`)} hitSlop={10}>
                <Icon name="search" color={colors.inkMuted} size={20} />
              </Pressable>
            </View>
            {admin ? <Row icon="plus" accent title="Add people" onPress={() => router.push({ pathname: '/new-group', params: { add: conv.id } })} /> : null}
            {sortedMembers.slice(0, PREVIEW).map((m) => (
              <GroupMemberRow key={m.id} member={m} myId={myId} onPress={m.id === myId ? undefined : () => setSelected(m)} />
            ))}
            {conv.members.length > PREVIEW ? (
              <Pressable accessibilityRole="button" accessibilityLabel={`See all ${conv.members.length} members`} onPress={() => router.push(`/members/${conv.id}`)} style={styles.seeAll}>
                <Text style={styles.seeAllText}>See all</Text>
                <Text style={styles.count}>{conv.members.length - PREVIEW} more</Text>
              </Pressable>
            ) : null}
          </Section>
        ) : other ? (
          <Section>
            <View style={styles.sectionHead}>
              <Text style={styles.sectionTitle}>{groupsInCommon.length ? `${groupsInCommon.length} ${groupsInCommon.length === 1 ? 'group' : 'groups'} in common` : 'No groups in common'}</Text>
            </View>
            <Row icon="users" accent title={`Create group with ${other.displayName}`} onPress={() => router.push({ pathname: '/new-group', params: { with: other.username } })} />
            <Row icon="userPlus" accent title="Add to groups" subtitle="Add them to groups you manage." onPress={() => router.push({ pathname: '/add-to-group', params: { userId: other.id, name: other.displayName } })} />
            {groupsInCommon.map((g) => (
              <MemberRow
                key={g.id}
                group
                name={g.title ?? 'Group'}
                seed={g.id}
                subtitle={g.members.map((m) => (m.id === myId ? 'You' : m.displayName)).join(', ')}
                onPress={() => router.push(`/chat/${g.id}`)}
              />
            ))}
          </Section>
        ) : null}

        {/* Destructive */}
        <Section>
          <Row icon="eraser" danger title="Clear chat" onPress={() => void clearChat()} />
          {isGroup ? (
            <Row icon="logout" danger title={conv.announcements ? 'Leave community' : 'Leave group'} onPress={() => void leave()} />
          ) : (
            <>
              <Row icon="block" danger title={`Block ${other?.displayName ?? ''}`} onPress={() => void block()} />
              <Row icon="trash" danger title="Delete chat" onPress={() => void leave()} />
            </>
          )}
          <Row
            icon="flag"
            danger
            title={isGroup ? 'Report group' : `Report ${other?.displayName ?? ''}`}
            onPress={() => setReport({ conversationId: conv.id, userId: isGroup ? undefined : other?.id, label: isGroup ? 'this group' : `@${other?.username}` })}
          />
        </Section>
      </ScrollView>
      <ReportSheet target={report} onClose={() => setReport(null)} />
      <MemberSheet conv={conv} member={selected} myId={myId} onClose={() => setSelected(null)} />
    </Screen>
  );
}

const formatDate = (iso: string) => new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' });

function groupSettingsSummary(conv: ConversationView) {
  if (conv.adminsOnlyMessages && conv.adminsOnlyEdit) return 'Only admins can send messages and edit info';
  if (conv.adminsOnlyMessages) return 'Only admins can send messages';
  if (conv.adminsOnlyEdit) return 'Only admins can edit group info';
  return 'Everyone can send messages and edit info';
}

function Header({ onBack, onEdit }: { onBack: () => void; onEdit?: () => void }) {
  return (
    <View style={styles.header}>
      <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={onBack} hitSlop={12} style={styles.headerButton}>
        <Icon name="back" color={colors.ink} />
      </Pressable>
      <View style={{ flex: 1 }} />
      {onEdit ? (
        <Pressable accessibilityRole="button" accessibilityLabel="Edit group" onPress={onEdit} hitSlop={12} style={styles.headerButton}>
          <Icon name="edit" color={colors.ink} />
        </Pressable>
      ) : null}
    </View>
  );
}

function QuickAction({ icon, label, onPress }: { icon: IconName; label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={({ pressed }) => [styles.action, pressed && { transform: [{ scale: 0.96 }] }]}>
      <Icon name={icon} color={colors.rose} size={22} />
      <Text style={styles.actionLabel}>{label}</Text>
    </Pressable>
  );
}

function Section({ children }: { children: ReactNode }) {
  return <View style={styles.section}>{children}</View>;
}

function Row({ icon, title, subtitle, onPress, right, danger, accent }: {
  icon: IconName;
  title: string;
  subtitle?: string;
  onPress?: () => void;
  right?: ReactNode;
  danger?: boolean;
  accent?: boolean;
}) {
  const color = danger ? colors.danger : colors.ink;
  return (
    <View style={styles.rowWrap}>
      <Pressable
        accessibilityRole={onPress ? 'button' : undefined}
        accessibilityLabel={subtitle ? `${title}. ${subtitle}` : title}
        onPress={onPress}
        disabled={!onPress}
        style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.surfaceMuted }]}
      >
        {accent ? (
          <View style={styles.accentIcon}><Icon name={icon} color={colors.onRose} size={20} /></View>
        ) : (
          <View style={styles.rowIcon}><Icon name={icon} color={danger ? colors.danger : colors.inkMuted} size={22} /></View>
        )}
        <View style={{ flex: 1 }}>
          <Text style={[styles.rowTitle, { color }]}>{title}</Text>
          {subtitle ? <Text style={styles.rowSub}>{subtitle}</Text> : null}
        </View>
      </Pressable>
      {right ? <View style={styles.rowRight}>{right}</View> : null}
    </View>
  );
}

function MemberRow({ name, avatarName, seed, subtitle, badge, onPress, onRemove, group }: {
  name: string;
  avatarName?: string;
  seed: string;
  subtitle: string;
  badge?: string;
  onPress?: () => void;
  onRemove?: () => void;
  group?: boolean;
}) {
  return (
    <View style={styles.rowWrap}>
      <Pressable
        accessibilityRole={onPress ? 'button' : undefined}
        accessibilityLabel={name}
        onPress={onPress}
        disabled={!onPress}
        style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.surfaceMuted }]}
      >
        {group ? <GroupAvatar size={44} /> : <Avatar name={avatarName ?? name} seed={seed} size={44} />}
        <View style={{ flex: 1 }}>
          <Text style={styles.rowTitle} numberOfLines={1}>{name}</Text>
          <Text style={styles.rowSub} numberOfLines={1}>{subtitle}</Text>
        </View>
        {badge ? <Text style={styles.badge}>{badge}</Text> : null}
      </Pressable>
      {onRemove ? (
        <Pressable accessibilityRole="button" accessibilityLabel={`Remove ${name}`} onPress={onRemove} hitSlop={8} style={styles.rowRight}>
          <Text style={styles.remove}>Remove</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = themed(() => StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.sm, paddingVertical: space.xs },
  headerButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  container: { paddingHorizontal: space.md, paddingBottom: space.xxl, gap: space.md },
  hero: { alignItems: 'center', paddingBottom: space.sm },
  name: { fontFamily: fonts.heavy, fontSize: 28, color: colors.ink, marginTop: space.md, textAlign: 'center', letterSpacing: -0.3 },
  sub: { fontFamily: fonts.medium, fontSize: 15, color: colors.inkMuted, marginTop: 2 },
  bio: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 21, color: colors.ink, textAlign: 'center', marginTop: space.sm, paddingHorizontal: space.lg },
  actions: { flexDirection: 'row', gap: space.sm, marginTop: space.lg, alignSelf: 'stretch', justifyContent: 'center' },
  action: {
    flex: 1, maxWidth: 110, alignItems: 'center', gap: 6, paddingVertical: 12, borderRadius: radius.md,
    backgroundColor: colors.surface, ...shadow, shadowOpacity: 0.05,
  },
  actionLabel: { fontFamily: fonts.bold, fontSize: 13, color: colors.ink },
  section: { backgroundColor: colors.surface, borderRadius: radius.lg, paddingVertical: space.xs, overflow: 'hidden', ...shadow, shadowOpacity: 0.04 },
  sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space.md, paddingTop: space.sm, paddingBottom: space.xs },
  sectionTitle: { fontFamily: fonts.bold, fontSize: 14, color: colors.inkMuted },
  count: { fontFamily: fonts.bold, fontSize: 14, color: colors.inkMuted },
  photos: { gap: space.sm, paddingHorizontal: space.md, paddingVertical: space.sm },
  thumb: { width: 96, height: 96, borderRadius: radius.sm, overflow: 'hidden' },
  emptyLine: { fontFamily: fonts.regular, fontSize: 14, color: colors.inkMuted, paddingHorizontal: space.md, paddingBottom: space.md },
  rowWrap: { flexDirection: 'row', alignItems: 'center' },
  row: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.md, paddingVertical: 12, minHeight: 56 },
  rowIcon: { width: 44, alignItems: 'center' },
  accentIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.roseFill, alignItems: 'center', justifyContent: 'center' },
  rowTitle: { fontFamily: fonts.bold, fontSize: 16, color: colors.ink },
  rowSub: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 19, color: colors.inkMuted, marginTop: 1 },
  rowRight: { paddingRight: space.md, paddingLeft: space.sm },
  badge: { fontFamily: fonts.bold, fontSize: 12, color: colors.rose, backgroundColor: colors.roseTint, paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill, overflow: 'hidden' },
  description: { paddingHorizontal: space.md, paddingTop: space.sm, paddingBottom: space.xs },
  descriptionText: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 22, color: colors.ink },
  readMore: { fontFamily: fonts.bold, fontSize: 15, color: colors.rose, marginTop: 2 },
  created: { fontFamily: fonts.regular, fontSize: 13, color: colors.inkMuted, paddingHorizontal: space.md, paddingTop: space.xs, paddingBottom: space.sm },
  seeAll: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space.md, minHeight: 52 },
  seeAllText: { fontFamily: fonts.bold, fontSize: 16, color: colors.rose },
  remove: { fontFamily: fonts.bold, fontSize: 14, color: colors.danger },
}));
