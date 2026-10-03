import { router, useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { CommunityAvatar } from '../../components/Avatar';
import { ConversationRow } from '../../components/ConversationRow';
import { Icon } from '../../components/Icon';
import { Button, Screen } from '../../components/ui';
import type { CommunityView } from '../../lib/api';
import { useCommunities } from '../../lib/communities';
import { useConversation } from '../../lib/conversations';
import { colors, fonts, radius, shadow, space, themed } from '../../theme';

/** Communities: each with its announcements and the groups I'm in. */
export default function Communities() {
  const { communities, refresh } = useCommunities();
  useFocusEffect(useCallback(() => {
    void refresh().catch(() => {});
  }, [refresh]));

  return (
    <Screen edges={['top']}>
      <View style={styles.header}>
        <Text accessibilityRole="header" style={styles.title}>Communities</Text>
      </View>
      {communities === null ? <ActivityIndicator color={colors.rose} style={{ marginTop: space.xxl }} /> : (
        <ScrollView contentContainerStyle={styles.container}>
          <Pressable accessibilityRole="button" accessibilityLabel="New community" onPress={() => router.push('/community-new')} style={styles.newRow}>
            <View>
              <CommunityAvatar size={52} />
              <View style={styles.plus}><Icon name="plus" color={colors.onRose} size={14} strokeWidth={2.6} /></View>
            </View>
            <Text style={styles.newText}>New community</Text>
          </Pressable>

          {communities.length ? communities.map((c) => <CommunityCard key={c.id} community={c} />) : (
            <View style={styles.empty}>
              <View style={styles.emptyIcon}><Icon name="community" color={colors.rose} size={44} /></View>
              <Text style={styles.emptyTitle}>Stay connected with a community</Text>
              <Text style={styles.emptyBody}>
                Communities bring members together in topic-based groups, with one announcements chat everyone gets. Any community you're added to will appear here.
              </Text>
              <Button title="Start your community" onPress={() => router.push('/community-new')} />
            </View>
          )}
        </ScrollView>
      )}
    </Screen>
  );
}

function CommunityCard({ community }: { community: CommunityView }) {
  const announcements = useConversation(community.announcementsId);
  const joined = community.groups.filter((g) => g.joined);
  return (
    <View style={styles.card}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${community.name} community`}
        onPress={() => router.push(`/community/${community.id}`)}
        style={({ pressed }) => [styles.cardHead, pressed && { backgroundColor: colors.surfaceMuted }]}
      >
        <CommunityAvatar size={48} />
        <View style={{ flex: 1 }}>
          <Text style={styles.cardName} numberOfLines={1}>{community.name}</Text>
          <Text style={styles.cardSub}>{community.memberCount} {community.memberCount === 1 ? 'member' : 'members'} · {community.groups.length} {community.groups.length === 1 ? 'group' : 'groups'}</Text>
        </View>
      </Pressable>
      <View style={styles.divider} />
      {announcements ? <ConversationRow conv={announcements} onPress={() => router.push(`/chat/${announcements.id}`)} /> : null}
      {joined.slice(0, 3).map((g) => <JoinedGroup key={g.id} id={g.id} />)}
      <Pressable accessibilityRole="button" accessibilityLabel={`View all of ${community.name}`} onPress={() => router.push(`/community/${community.id}`)} style={styles.viewAll}>
        <Text style={styles.viewAllText}>View all</Text>
        <View style={{ transform: [{ rotate: '180deg' }] }}><Icon name="back" color={colors.inkMuted} size={16} /></View>
      </Pressable>
    </View>
  );
}

function JoinedGroup({ id }: { id: string }) {
  const conv = useConversation(id);
  return conv ? <ConversationRow conv={conv} onPress={() => router.push(`/chat/${id}`)} /> : null;
}

const styles = themed(() => StyleSheet.create({
  header: { paddingHorizontal: space.lg, paddingTop: space.sm, paddingBottom: space.sm },
  title: { fontFamily: fonts.heavy, fontSize: 32, color: colors.ink, letterSpacing: -0.5 },
  container: { paddingHorizontal: space.md, paddingBottom: space.xxl, gap: space.md },
  newRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md, borderRadius: radius.lg, backgroundColor: colors.surface, ...shadow, shadowOpacity: 0.04 },
  plus: { position: 'absolute', right: -4, bottom: -4, width: 22, height: 22, borderRadius: 11, backgroundColor: colors.roseFill, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: colors.surface },
  newText: { fontFamily: fonts.bold, fontSize: 17, color: colors.ink },
  card: { borderRadius: radius.lg, backgroundColor: colors.surface, overflow: 'hidden', ...shadow, shadowOpacity: 0.04 },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md },
  cardName: { fontFamily: fonts.heavy, fontSize: 18, color: colors.ink },
  cardSub: { fontFamily: fonts.regular, fontSize: 13, color: colors.inkMuted, marginTop: 1 },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.hairline, marginHorizontal: space.md },
  viewAll: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: space.lg, paddingVertical: 14 },
  viewAllText: { fontFamily: fonts.bold, fontSize: 15, color: colors.inkMuted },
  empty: { alignItems: 'center', gap: space.md, paddingHorizontal: space.lg, paddingTop: space.xl },
  emptyIcon: { width: 96, height: 96, borderRadius: 30, backgroundColor: colors.roseTint, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { fontFamily: fonts.heavy, fontSize: 20, color: colors.ink, textAlign: 'center' },
  emptyBody: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 22, color: colors.inkMuted, textAlign: 'center', marginBottom: space.sm },
}));
