import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { ChannelRow } from '../../components/ChannelRow';
import { Icon } from '../../components/Icon';
import { PostCard } from '../../components/PostCard';
import { ReportSheet, type ReportTarget } from '../../components/ReportSheet';
import { AddStatusCard, StatusCard } from '../../components/StatusCard';
import { Screen } from '../../components/ui';
import { useFollowingChannels } from '../../lib/channels';
import { postMenu } from '../../lib/postActions';
import { useSession } from '../../lib/session';
import { useStatusFeed } from '../../lib/status';
import { useFeed } from '../../lib/useFeed';
import { colors, fonts, radius, shadow, space, themed } from '../../theme';

/** Updates: status row on top, then the public timeline. */
export default function Updates() {
  const { me } = useSession();
  const feed = useFeed();
  const { feed: status, refresh: refreshStatus } = useStatusFeed();
  const { channels, refresh: refreshChannels } = useFollowingChannels();
  const { width } = useWindowDimensions();
  const [report, setReport] = useState<ReportTarget | null>(null);
  const cardWidth = Math.min(width, 640) - space.lg * 2;

  const { refresh } = feed;
  useFocusEffect(useCallback(() => {
    void refresh().catch(() => {});
    void refreshStatus().catch(() => {});
    void refreshChannels().catch(() => {});
  }, [refresh, refreshStatus, refreshChannels]));

  const statusRow = (
    <View style={{ gap: space.sm }}>
      <Text accessibilityRole="header" style={styles.section}>Status</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.cards}>
        {me ? (
          status?.mine
            ? <StatusCard group={status.mine} label="My status" isMe onPress={() => router.push(`/status/${me.id}`)} />
            : <AddStatusCard me={me} onPress={() => router.push('/status-compose')} />
        ) : null}
        {[...(status?.recent ?? []), ...(status?.viewed ?? [])].map((g) => (
          <StatusCard key={g.author.id} group={g} label={g.author.displayName} onPress={() => router.push(`/status/${g.author.id}`)} />
        ))}
      </ScrollView>
      {status && !status.recent.length && !status.viewed.length ? (
        <Text style={styles.hint}>Status updates from people you chat with show up here for 24 hours.</Text>
      ) : null}
      <View style={styles.timelineHead}>
        <Text accessibilityRole="header" style={styles.section}>Channels</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Explore channels" onPress={() => router.push('/channels-explore')} style={styles.pill}>
          <Icon name="search" color={colors.rose} size={15} strokeWidth={2.2} />
          <Text style={styles.pillText}>Explore</Text>
        </Pressable>
      </View>
      {channels?.length ? (
        <View>
          {channels.map((c) => <ChannelRow key={c.id} channel={c} onPress={() => router.push(`/channel/${c.id}`)} />)}
        </View>
      ) : (
        <Pressable accessibilityRole="button" accessibilityLabel="Find channels to follow" onPress={() => router.push('/channels-explore')} style={styles.findCard}>
          <View style={styles.findIcon}><Icon name="broadcast" color={colors.rose} size={24} /></View>
          <View style={{ flex: 1 }}>
            <Text style={styles.findTitle}>Find channels to follow</Text>
            <Text style={styles.hint}>Follow topics, creators and places you care about.</Text>
          </View>
        </Pressable>
      )}
      <View style={styles.timelineHead}>
        <Text accessibilityRole="header" style={styles.section}>Timeline</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="New post" onPress={() => router.push('/compose')} style={styles.pill}>
          <Icon name="plus" color={colors.rose} size={16} strokeWidth={2.2} />
          <Text style={styles.pillText}>Post</Text>
        </Pressable>
      </View>
    </View>
  );

  return (
    <Screen edges={['top']}>
      <View style={styles.header}>
        <Text accessibilityRole="header" style={styles.title}>Updates</Text>
      </View>
      {feed.posts === null ? (
        <ActivityIndicator color={colors.rose} style={{ marginTop: space.xxl }} />
      ) : (
        <FlatList
          data={feed.posts}
          keyExtractor={(p) => p.id}
          ListHeaderComponent={statusRow}
          ListHeaderComponentStyle={{ marginBottom: space.md }}
          renderItem={({ item }) => (
            <PostCard
              post={item}
              width={cardWidth}
              onLike={feed.toggleLike}
              onMore={(p) => postMenu(p, me?.id ?? '', {
                onDeleted: () => feed.remove(p.id),
                onReport: () => setReport({ postId: p.id, userId: p.author.id, label: 'this post' }),
              })}
            />
          )}
          ItemSeparatorComponent={() => <View style={{ height: space.md }} />}
          onEndReached={() => void feed.loadMore()}
          onEndReachedThreshold={0.5}
          onRefresh={() => {
            void feed.refresh();
            void refreshStatus();
            void refreshChannels();
          }}
          refreshing={feed.refreshing}
          contentContainerStyle={{ paddingHorizontal: space.lg, paddingBottom: 120 }}
          ListEmptyComponent={<Text style={styles.hint}>No posts yet — share a moment everyone on Lovenest can see.</Text>}
        />
      )}
      <View style={styles.fabs}>
        <Pressable accessibilityRole="button" accessibilityLabel="New text status" onPress={() => router.push('/status-compose')} style={styles.fabSmall}>
          <Icon name="edit" color={colors.ink} size={20} />
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="New photo status" onPress={() => router.push({ pathname: '/status-compose', params: { photo: '1' } })} style={styles.fab}>
          <Icon name="camera" color={colors.onRose} size={26} />
        </Pressable>
      </View>
      <ReportSheet target={report} onClose={() => setReport(null)} />
    </Screen>
  );
}

const styles = themed(() => StyleSheet.create({
  header: { paddingHorizontal: space.lg, paddingTop: space.sm, paddingBottom: space.sm },
  title: { fontFamily: fonts.heavy, fontSize: 32, color: colors.ink, letterSpacing: -0.5 },
  section: { fontFamily: fonts.heavy, fontSize: 20, color: colors.ink },
  cards: { gap: space.sm, paddingRight: space.lg },
  hint: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, color: colors.inkMuted },
  timelineHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: space.md },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.pill, backgroundColor: colors.roseTint },
  pillText: { fontFamily: fonts.bold, fontSize: 14, color: colors.rose },
  findCard: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md, borderRadius: radius.lg, backgroundColor: colors.surface, ...shadow, shadowOpacity: 0.04 },
  findIcon: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.roseTint, alignItems: 'center', justifyContent: 'center' },
  findTitle: { fontFamily: fonts.bold, fontSize: 16, color: colors.ink },
  fabs: { position: 'absolute', right: space.lg, bottom: space.lg, alignItems: 'center', gap: space.md },
  fabSmall: { width: 46, height: 46, borderRadius: 16, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', ...shadow, shadowOpacity: 0.12 },
  fab: { width: 60, height: 60, borderRadius: 20, backgroundColor: colors.roseFill, alignItems: 'center', justifyContent: 'center', ...shadow, shadowOpacity: 0.2 },
}));
