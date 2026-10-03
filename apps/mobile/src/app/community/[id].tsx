import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { CommunityAvatar, GroupAvatar } from '../../components/Avatar';
import { BackHeader } from '../../components/BackHeader';
import { ConversationRow } from '../../components/ConversationRow';
import { Icon, type IconName } from '../../components/Icon';
import { ReportSheet, type ReportTarget } from '../../components/ReportSheet';
import { Row, Section } from '../../components/SettingsList';
import { Screen } from '../../components/ui';
import { api, type CommunityGroup, type ConversationView } from '../../lib/api';
import { useCommunity } from '../../lib/communities';
import { confirm, notify } from '../../lib/confirm';
import { upsert, useConversation } from '../../lib/conversations';
import { colors, fonts, radius, shadow, space, themed } from '../../theme';

export default function CommunityScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { community, refresh } = useCommunity(id);
  const announcements = useConversation(community && community !== 'missing' ? community.announcementsId : undefined);
  const [report, setReport] = useState<ReportTarget | null>(null);
  const [expanded, setExpanded] = useState(false);

  if (community === null) return <Screen><BackHeader title="" /><ActivityIndicator color={colors.rose} style={{ marginTop: space.xxl }} /></Screen>;
  if (community === 'missing') return <Screen><BackHeader title="" /><Text style={styles.missing}>This community isn't available.</Text></Screen>;

  const admin = community.myRole === 'admin';
  const joined = community.groups.filter((g) => g.joined);
  const joinable = community.groups.filter((g) => !g.joined);

  const join = async (g: CommunityGroup) => {
    try {
      const { conversation } = await api<{ conversation: ConversationView }>('POST', `/communities/${community.id}/groups/${g.id}/join`);
      upsert(conversation);
      void refresh();
      router.push(`/chat/${conversation.id}`);
    } catch (e) {
      notify("Couldn't join", e instanceof Error ? e.message : undefined);
    }
  };

  const leave = async () => {
    const ok = await confirm(`Leave ${community.name}?`, "You'll leave the announcements and every group in this community.", 'Leave community');
    if (!ok) return;
    try {
      await api('DELETE', `/communities/${community.id}/membership`);
      router.back();
    } catch {
      notify("Couldn't leave");
    }
  };

  return (
    <Screen>
      <BackHeader
        title=""
        right={admin ? (
          <Pressable accessibilityRole="button" accessibilityLabel="Edit community" onPress={() => router.push({ pathname: '/community-new', params: { id: community.id } })} hitSlop={10}>
            <Icon name="edit" color={colors.ink} />
          </Pressable>
        ) : undefined}
      />
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.hero}>
          <CommunityAvatar size={96} />
          <Text accessibilityRole="header" style={styles.name}>{community.name}</Text>
          <Text style={styles.sub}>
            Community · {community.memberCount} {community.memberCount === 1 ? 'member' : 'members'} · {community.groups.length} {community.groups.length === 1 ? 'group' : 'groups'}
          </Text>
          {community.description ? (
            <Pressable accessibilityRole="button" accessibilityLabel="Community description" onPress={() => setExpanded((x) => !x)}>
              <Text style={styles.description} numberOfLines={expanded ? undefined : 3}>{community.description}</Text>
            </Pressable>
          ) : null}
          {admin ? (
            <View style={styles.actions}>
              <Action icon="plus" label="New group" onPress={() => router.push({ pathname: '/community-group-new', params: { communityId: community.id } })} />
              <Action icon="userPlus" label="Add members" onPress={() => router.push({ pathname: '/new-group', params: { add: community.announcementsId } })} />
              <Action icon="users" label="Members" onPress={() => router.push(`/members/${community.announcementsId}`)} />
            </View>
          ) : null}
        </View>

        {announcements ? (
          <Section title="Announcements">
            <ConversationRow conv={announcements} onPress={() => router.push(`/chat/${announcements.id}`)} />
          </Section>
        ) : null}

        <Section title="Groups you're in">
          {joined.length ? joined.map((g) => <JoinedGroup key={g.id} id={g.id} />) : (
            <Text style={styles.hint}>You haven't joined any groups here yet.</Text>
          )}
        </Section>

        {joinable.length ? (
          <Section title="Groups you can join">
            {joinable.map((g) => (
              <View key={g.id} style={styles.groupRow}>
                <GroupAvatar size={48} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.groupTitle} numberOfLines={1}>{g.title}</Text>
                  <Text style={styles.groupSub} numberOfLines={1}>{g.description || `${g.memberCount} ${g.memberCount === 1 ? 'member' : 'members'}`}</Text>
                </View>
                <Pressable accessibilityRole="button" accessibilityLabel={`Join ${g.title}`} onPress={() => void join(g)} style={styles.join}>
                  <Text style={styles.joinText}>Join</Text>
                </Pressable>
              </View>
            ))}
          </Section>
        ) : null}

        <Section>
          {!admin ? <Row icon="users" title="Members" subtitle={`${community.memberCount} people`} chevron onPress={() => router.push(`/members/${community.announcementsId}`)} /> : null}
          <Row icon="lock" title="Encryption" subtitle="Messages in the announcements and every group are end-to-end encrypted." />
        </Section>

        <Section>
          <Row icon="logout" danger title="Leave community" onPress={() => void leave()} />
          <Row icon="flag" danger title="Report community" onPress={() => setReport({ conversationId: community.announcementsId, label: community.name })} />
        </Section>
      </ScrollView>
      <ReportSheet target={report} onClose={() => setReport(null)} />
    </Screen>
  );
}

function JoinedGroup({ id }: { id: string }) {
  const conv = useConversation(id);
  return conv ? <ConversationRow conv={conv} onPress={() => router.push(`/chat/${id}`)} /> : null;
}

function Action({ icon, label, onPress }: { icon: IconName; label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={({ pressed }) => [styles.action, pressed && { transform: [{ scale: 0.96 }] }]}>
      <Icon name={icon} color={colors.rose} size={22} />
      <Text style={styles.actionLabel}>{label}</Text>
    </Pressable>
  );
}

const styles = themed(() => StyleSheet.create({
  container: { paddingHorizontal: space.md, paddingBottom: space.xxl, gap: space.lg },
  missing: { fontFamily: fonts.regular, fontSize: 16, color: colors.inkMuted, textAlign: 'center', marginTop: space.xxl },
  hero: { alignItems: 'center' },
  name: { fontFamily: fonts.heavy, fontSize: 26, color: colors.ink, marginTop: space.md, textAlign: 'center' },
  sub: { fontFamily: fonts.medium, fontSize: 14, color: colors.inkMuted, marginTop: 2, textAlign: 'center' },
  description: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 22, color: colors.ink, textAlign: 'center', marginTop: space.sm, paddingHorizontal: space.md },
  actions: { flexDirection: 'row', gap: space.sm, marginTop: space.lg, alignSelf: 'stretch', justifyContent: 'center' },
  action: { flex: 1, maxWidth: 116, alignItems: 'center', gap: 6, paddingVertical: 12, borderRadius: radius.md, backgroundColor: colors.surface, ...shadow, shadowOpacity: 0.05 },
  actionLabel: { fontFamily: fonts.bold, fontSize: 13, color: colors.ink },
  hint: { fontFamily: fonts.regular, fontSize: 14, color: colors.inkMuted, paddingHorizontal: space.md, paddingVertical: space.md },
  groupRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.md, paddingVertical: 10 },
  groupTitle: { fontFamily: fonts.bold, fontSize: 16, color: colors.ink },
  groupSub: { fontFamily: fonts.regular, fontSize: 14, color: colors.inkMuted, marginTop: 1 },
  join: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: radius.pill, backgroundColor: colors.roseTint },
  joinText: { fontFamily: fonts.bold, fontSize: 14, color: colors.rose },
}));
