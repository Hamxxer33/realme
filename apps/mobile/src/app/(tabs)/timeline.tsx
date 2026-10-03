import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { Icon } from '../../components/Icon';
import { PostCard } from '../../components/PostCard';
import { ReportSheet, type ReportTarget } from '../../components/ReportSheet';
import { Screen } from '../../components/ui';
import { postMenu } from '../../lib/postActions';
import { useSession } from '../../lib/session';
import { useFeed } from '../../lib/useFeed';
import { colors, fonts, shadow, space } from '../../theme';

export default function Timeline() {
  const { me } = useSession();
  const feed = useFeed();
  const { width } = useWindowDimensions();
  const [report, setReport] = useState<ReportTarget | null>(null);
  const cardWidth = Math.min(width, 640) - space.lg * 2;

  // Pick up posts written in the compose screen.
  const { refresh } = feed;
  useFocusEffect(useCallback(() => {
    void refresh().catch(() => {});
  }, [refresh]));

  return (
    <Screen edges={['top']}>
      <View style={styles.header}>
        <Text accessibilityRole="header" style={styles.title}>Timeline</Text>
      </View>
      {feed.posts === null ? (
        <ActivityIndicator color={colors.rose} style={{ marginTop: space.xxl }} />
      ) : (
        <FlatList
          data={feed.posts}
          keyExtractor={(p) => p.id}
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
          onRefresh={() => void feed.refresh()}
          refreshing={feed.refreshing}
          contentContainerStyle={{ paddingHorizontal: space.lg, paddingBottom: 96, flexGrow: 1 }}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>Nothing here yet</Text>
              <Text style={styles.emptyBody}>Share a moment — everyone on Realme can see your posts.</Text>
            </View>
          }
        />
      )}
      <Pressable accessibilityRole="button" accessibilityLabel="New post" onPress={() => router.push('/compose')} style={styles.fab}>
        <Icon name="plus" color={colors.onRose} strokeWidth={2.2} size={26} />
      </Pressable>
      <ReportSheet target={report} onClose={() => setReport(null)} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: space.lg, paddingTop: space.sm, paddingBottom: space.md },
  title: { fontFamily: fonts.heavy, fontSize: 32, color: colors.ink, letterSpacing: -0.5 },
  fab: {
    position: 'absolute', right: space.lg, bottom: space.lg, width: 60, height: 60, borderRadius: 30,
    backgroundColor: colors.rose, alignItems: 'center', justifyContent: 'center', ...shadow, shadowOpacity: 0.2,
  },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: space.xl, gap: space.sm },
  emptyTitle: { fontFamily: fonts.heavy, fontSize: 22, color: colors.ink },
  emptyBody: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 22, color: colors.inkMuted, textAlign: 'center' },
});

