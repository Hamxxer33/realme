import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { Avatar } from '../../components/Avatar';
import { BackHeader } from '../../components/BackHeader';
import { Icon } from '../../components/Icon';
import { PostCard } from '../../components/PostCard';
import { ReportSheet, type ReportTarget } from '../../components/ReportSheet';
import { Button, Screen } from '../../components/ui';
import { api, type ConversationView, type PublicUser } from '../../lib/api';
import { confirm, notify } from '../../lib/confirm';
import { upsert } from '../../lib/conversations';
import { postMenu } from '../../lib/postActions';
import { useSession } from '../../lib/session';
import { useFeed } from '../../lib/useFeed';
import { colors, fonts, radius, space, themed } from '../../theme';

interface Profile { user: PublicUser; blockedByMe: boolean; postCount: number; isMe: boolean }

export default function UserProfile() {
  const { username } = useLocalSearchParams<{ username: string }>();
  const { me } = useSession();
  const [profile, setProfile] = useState<Profile | null | 'missing'>(null);
  const [report, setReport] = useState<ReportTarget | null>(null);
  const [busy, setBusy] = useState(false);
  const feed = useFeed(username);
  const { width } = useWindowDimensions();

  const load = useCallback(async () => {
    try {
      setProfile(await api<Profile>('GET', `/users/${username}`));
    } catch {
      setProfile('missing');
    }
  }, [username]);
  useEffect(() => {
    void load();
  }, [load]);

  if (profile === null) return <Screen><BackHeader title="" /><ActivityIndicator color={colors.rose} style={{ marginTop: space.xxl }} /></Screen>;
  if (profile === 'missing') return <Screen><BackHeader title="" /><Text style={styles.missing}>This account isn't available.</Text></Screen>;
  const { user } = profile;

  const message = async () => {
    setBusy(true);
    try {
      const { conversation } = await api<{ conversation: ConversationView }>('POST', '/conversations/direct', { userId: user.id });
      upsert(conversation);
      router.push(`/chat/${conversation.id}`);
    } catch (e) {
      notify("Couldn't start chat", e instanceof Error ? e.message : undefined);
    } finally {
      setBusy(false);
    }
  };

  const toggleBlock = async () => {
    if (profile.blockedByMe) {
      await api('DELETE', `/blocks/${user.id}`).catch(() => {});
    } else {
      if (!(await confirm(`Block ${user.displayName}?`, "They won't be able to message you or see your posts. They won't be told.", 'Block'))) return;
      await api('POST', '/blocks', { userId: user.id }).catch(() => {});
    }
    await load();
    await feed.refresh().catch(() => {});
  };

  const header = (
    <View style={styles.header}>
      <Avatar name={user.displayName} seed={user.username} size={96} />
      <Text accessibilityRole="header" style={styles.name}>{user.displayName}</Text>
      <Text style={styles.handle}>@{user.username} · {profile.postCount} {profile.postCount === 1 ? 'post' : 'posts'}</Text>
      {user.bio ? <Text style={styles.bio}>{user.bio}</Text> : null}
      {!profile.isMe ? (
        <View style={styles.actions}>
          {profile.blockedByMe ? (
            <Text style={styles.blocked}>You blocked {user.displayName}.</Text>
          ) : (
            <View style={{ flex: 1 }}><Button title="Message" onPress={() => void message()} loading={busy} /></View>
          )}
          <Pressable accessibilityRole="button" accessibilityLabel={profile.blockedByMe ? 'Unblock' : 'Block'} onPress={() => void toggleBlock()} style={styles.iconButton}>
            {profile.blockedByMe ? <Text style={styles.unblock}>Unblock</Text> : <Icon name="block" color={colors.inkMuted} />}
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="Report" onPress={() => setReport({ userId: user.id, label: `@${user.username}` })} style={styles.iconButton}>
            <Icon name="flag" color={colors.inkMuted} />
          </Pressable>
        </View>
      ) : null}
    </View>
  );

  return (
    <Screen>
      <BackHeader title={`@${user.username}`} />
      <FlatList
        data={profile.blockedByMe ? [] : feed.posts ?? []}
        keyExtractor={(p) => p.id}
        ListHeaderComponent={header}
        renderItem={({ item }) => (
          <PostCard
            post={item}
            width={Math.min(width, 640) - space.lg * 2}
            onLike={feed.toggleLike}
            onMore={(p) => postMenu(p, me?.id ?? '', {
              onDeleted: () => feed.remove(p.id),
              onReport: () => setReport({ postId: p.id, userId: p.author.id, label: 'this post' }),
            })}
          />
        )}
        ItemSeparatorComponent={() => <View style={{ height: space.md }} />}
        onEndReached={() => void feed.loadMore()}
        contentContainerStyle={{ paddingHorizontal: space.lg, paddingBottom: space.xl }}
        ListEmptyComponent={!profile.blockedByMe && feed.posts?.length === 0 ? <Text style={styles.noPosts}>No posts yet.</Text> : null}
      />
      <ReportSheet target={report} onClose={() => setReport(null)} />
    </Screen>
  );
}

const styles = themed(() => StyleSheet.create({
  header: { alignItems: 'center', gap: 4, paddingVertical: space.lg },
  name: { fontFamily: fonts.heavy, fontSize: 26, color: colors.ink, marginTop: space.sm },
  handle: { fontFamily: fonts.medium, fontSize: 15, color: colors.inkMuted },
  bio: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 22, color: colors.ink, textAlign: 'center', marginTop: space.sm },
  actions: { flexDirection: 'row', alignItems: 'center', gap: space.sm, alignSelf: 'stretch', marginTop: space.lg },
  iconButton: { minWidth: 54, height: 54, borderRadius: radius.pill, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', paddingHorizontal: space.md },
  blocked: { flex: 1, fontFamily: fonts.medium, fontSize: 15, color: colors.inkMuted },
  unblock: { fontFamily: fonts.bold, fontSize: 15, color: colors.rose },
  missing: { fontFamily: fonts.regular, fontSize: 16, color: colors.inkMuted, textAlign: 'center', marginTop: space.xxl },
  noPosts: { fontFamily: fonts.regular, fontSize: 15, color: colors.inkMuted, textAlign: 'center', padding: space.xl },
}));
