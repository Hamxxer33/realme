import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Modal, Pressable, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { Avatar } from '../../components/Avatar';
import { Icon } from '../../components/Icon';
import { PublicImage } from '../../components/PostCard';
import { Button, Screen } from '../../components/ui';
import { api, CHANNEL_REACTIONS, type ChannelPost, type ChannelView } from '../../lib/api';
import { follow, followerLabel } from '../../lib/channels';
import { confirm, notify } from '../../lib/confirm';
import { shortTime } from '../../lib/format';
import { uploadPublic } from '../../lib/media';
import { realtime } from '../../lib/realtime';
import { colors, fonts, noWebOutline, radius, shadow, space, themed } from '../../theme';

const PAGE = 30;

export default function ChannelScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [channel, setChannel] = useState<ChannelView | null | 'missing'>(null);
  const [posts, setPosts] = useState<ChannelPost[] | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [reactingTo, setReactingTo] = useState<ChannelPost | null>(null);
  const { width } = useWindowDimensions();
  const cardWidth = Math.min(width * 0.86, 460);
  const loadingMore = useRef(false);
  const initialLoaded = useRef(false);

  const loadChannel = useCallback(async () => {
    try {
      setChannel((await api<{ channel: ChannelView }>('GET', `/channels/${id}`)).channel);
    } catch {
      setChannel('missing');
    }
  }, [id]);

  const loadLatest = useCallback(async () => {
    const res = await api<{ posts: ChannelPost[]; hasMore: boolean }>('GET', `/channels/${id}/posts?limit=${PAGE}`);
    setPosts((prev) => {
      const older = (prev ?? []).filter((p) => !res.posts.some((n) => n.id === p.id) && p.createdAt < (res.posts[res.posts.length - 1]?.createdAt ?? ''));
      return [...res.posts, ...older];
    });
    // Paging state comes from the first load; later refreshes only add newer posts.
    if (!initialLoaded.current) {
      initialLoaded.current = true;
      setHasMore(res.hasMore);
    }
  }, [id]);

  const loadOlder = async () => {
    const oldest = posts?.[posts.length - 1];
    if (!hasMore || !oldest || loadingMore.current) return;
    loadingMore.current = true;
    try {
      const res = await api<{ posts: ChannelPost[]; hasMore: boolean }>('GET', `/channels/${id}/posts?limit=${PAGE}&before=${oldest.id}`);
      setPosts((prev) => [...(prev ?? []), ...res.posts]);
      setHasMore(res.hasMore);
    } finally {
      loadingMore.current = false;
    }
  };

  useEffect(() => {
    void loadChannel();
    void loadLatest().catch(() => setPosts([]));
    return realtime.subscribe((evt) => {
      if ((evt.type === 'channel_post' && evt.channelId === id) || evt.type === 'connected') void loadLatest().catch(() => {});
    });
  }, [id, loadChannel, loadLatest]);

  // Reading the channel marks it seen.
  const following = channel && channel !== 'missing' && channel.following;
  const newest = posts?.[0]?.id;
  useFocusEffect(useCallback(() => {
    if (following) void api('PATCH', `/channels/${id}/me`, { seen: true }).catch(() => {});
  }, [following, id, newest])); // eslint-disable-line react-hooks/exhaustive-deps

  if (channel === 'missing') {
    return (
      <Screen>
        <Header onBack={() => router.back()} />
        <Text style={styles.missing}>This channel isn't available.</Text>
      </Screen>
    );
  }

  const toggleFollow = async () => {
    if (!channel) return;
    try {
      setChannel(await follow(channel, !channel.following));
    } catch (e) {
      notify("Couldn't update", e instanceof Error ? e.message : undefined);
    }
  };

  const react = async (post: ChannelPost, emoji: string | null) => {
    setReactingTo(null);
    try {
      const { post: updated } = await api<{ post: ChannelPost }>('PUT', `/channels/${id}/posts/${post.id}/reaction`, { emoji });
      setPosts((prev) => prev?.map((p) => (p.id === post.id ? updated : p)) ?? prev);
    } catch {
      notify("Couldn't react");
    }
  };

  const remove = async (post: ChannelPost) => {
    if (!(await confirm('Delete this update?', 'It will be removed for all followers.', 'Delete'))) return;
    try {
      await api('DELETE', `/channels/${id}/posts/${post.id}`);
      setPosts((prev) => prev?.filter((p) => p.id !== post.id) ?? prev);
    } catch {
      notify("Couldn't delete");
    }
  };

  return (
    <Screen>
      <Header
        onBack={() => router.back()}
        channel={channel ?? undefined}
        onInfo={channel ? () => router.push(`/channel-info/${channel.id}`) : undefined}
      />
      {posts === null || !channel ? (
        <ActivityIndicator color={colors.rose} style={{ marginTop: space.xxl }} />
      ) : (
        <FlatList
          inverted
          data={posts}
          keyExtractor={(p) => p.id}
          renderItem={({ item }) => (
            <PostBubble
              post={item}
              width={cardWidth}
              canDelete={channel.isOwner}
              onReact={() => setReactingTo(item)}
              onToggle={(emoji) => void react(item, item.myReaction === emoji ? null : emoji)}
              onDelete={() => void remove(item)}
            />
          )}
          onEndReached={() => void loadOlder()}
          onEndReachedThreshold={0.4}
          contentContainerStyle={{ paddingVertical: space.md, paddingHorizontal: space.md, flexGrow: 1 }}
          ListEmptyComponent={
            <View style={[styles.empty, { transform: [{ scaleY: -1 }] }]}>
              <Avatar name={channel.name} seed={channel.id} size={80} />
              <Text style={styles.emptyTitle}>{channel.name}</Text>
              <Text style={styles.emptyBody}>
                {channel.isOwner ? 'Post your first update. Followers will see it here.' : 'No updates yet.'}
              </Text>
            </View>
          }
        />
      )}

      {channel?.isOwner ? <OwnerComposer channelId={channel.id} onPosted={(p) => setPosts((prev) => [p, ...(prev ?? [])])} /> : channel && !channel.following ? (
        <View style={styles.followBar}>
          <Text style={styles.followHint}>{followerLabel(channel.followerCount)}</Text>
          <Button title={`Follow ${channel.name}`} onPress={() => void toggleFollow()} />
        </View>
      ) : null}

      <Modal transparent visible={!!reactingTo} animationType="fade" onRequestClose={() => setReactingTo(null)}>
        <Pressable style={styles.scrim} onPress={() => setReactingTo(null)} accessibilityLabel="Close reactions">
          <Animated.View entering={FadeIn.springify()} exiting={FadeOut} style={styles.picker}>
            {CHANNEL_REACTIONS.map((emoji) => (
              <Pressable
                key={emoji}
                accessibilityRole="button"
                accessibilityLabel={`React ${emoji}`}
                onPress={() => reactingTo && void react(reactingTo, reactingTo.myReaction === emoji ? null : emoji)}
                style={[styles.pickerOption, reactingTo?.myReaction === emoji && { backgroundColor: colors.roseTint }]}
              >
                <Text style={{ fontSize: 28 }}>{emoji}</Text>
              </Pressable>
            ))}
          </Animated.View>
        </Pressable>
      </Modal>
    </Screen>
  );
}

function Header({ onBack, channel, onInfo }: { onBack: () => void; channel?: ChannelView; onInfo?: () => void }) {
  return (
    <View style={styles.header}>
      <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={onBack} hitSlop={12} style={styles.headerButton}>
        <Icon name="back" color={colors.ink} />
      </Pressable>
      {channel ? (
        <Pressable accessibilityRole="button" accessibilityLabel={`${channel.name} details`} onPress={onInfo} style={styles.headerMain}>
          <Avatar name={channel.name} seed={channel.id} size={40} />
          <View style={{ flex: 1 }}>
            <Text style={styles.name} numberOfLines={1}>{channel.name}</Text>
            <Text style={styles.sub} numberOfLines={1}>{followerLabel(channel.followerCount)}</Text>
          </View>
        </Pressable>
      ) : <View style={{ flex: 1 }} />}
      {onInfo ? (
        <Pressable accessibilityRole="button" accessibilityLabel="Channel info" onPress={onInfo} hitSlop={8} style={styles.headerButton}>
          <Icon name="more" color={colors.ink} strokeWidth={3} />
        </Pressable>
      ) : null}
    </View>
  );
}

function PostBubble({ post, width, canDelete, onReact, onToggle, onDelete }: {
  post: ChannelPost;
  width: number;
  canDelete: boolean;
  onReact: () => void;
  onToggle: (emoji: string) => void;
  onDelete: () => void;
}) {
  const reactions = Object.entries(post.reactions).sort((a, b) => b[1] - a[1]);
  return (
    <View style={styles.postRow}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Update: ${post.text || 'photo'}. React`}
        onPress={onReact}
        onLongPress={canDelete ? onDelete : undefined}
        style={[styles.bubble, { maxWidth: width }]}
      >
        {post.media ? (
          <View style={styles.photo}>
            <PublicImage objectKey={post.media.objectKey} width={post.media.width} height={post.media.height} maxWidth={width - 12} />
          </View>
        ) : null}
        {post.text ? <Text style={[styles.text, post.media && { paddingTop: space.sm }]}>{post.text}</Text> : null}
        <Text style={styles.time}>{shortTime(post.createdAt)}</Text>
      </Pressable>
      <View style={styles.reactions}>
        {reactions.map(([emoji, n]) => (
          <Pressable
            key={emoji}
            accessibilityRole="button"
            accessibilityLabel={`${emoji} ${n}${post.myReaction === emoji ? ', yours' : ''}`}
            onPress={() => onToggle(emoji)}
            style={[styles.chip, post.myReaction === emoji && styles.chipMine]}
          >
            <Text style={styles.chipText}>{emoji} {n}</Text>
          </Pressable>
        ))}
        <Pressable accessibilityRole="button" accessibilityLabel="Add reaction" onPress={onReact} hitSlop={8} style={styles.chipAdd}>
          <Icon name="smile" color={colors.inkMuted} size={18} />
        </Pressable>
        {canDelete ? (
          <Pressable accessibilityRole="button" accessibilityLabel="Delete update" onPress={onDelete} hitSlop={8} style={styles.chipAdd}>
            <Icon name="trash" color={colors.inkMuted} size={17} />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

function OwnerComposer({ channelId, onPosted }: { channelId: string; onPosted: (p: ChannelPost) => void }) {
  const [text, setText] = useState('');
  const [photo, setPhoto] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [busy, setBusy] = useState(false);
  const canSend = !busy && (!!text.trim() || !!photo);

  const send = async () => {
    if (!canSend) return;
    setBusy(true);
    try {
      const media = photo ? { objectKey: await uploadPublic(photo.uri), width: photo.width, height: photo.height } : undefined;
      const { post } = await api<{ post: ChannelPost }>('POST', `/channels/${channelId}/posts`, { text: text.trim(), media });
      onPosted(post);
      setText('');
      setPhoto(null);
    } catch (e) {
      notify("Couldn't post", e instanceof Error ? e.message : undefined);
    } finally {
      setBusy(false);
    }
  };

  const pick = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.85, exif: false });
    const asset = result.canceled ? null : result.assets[0];
    if (asset) setPhoto(asset);
  };

  return (
    <View>
      {photo ? (
        <View style={styles.attached}>
          <Image source={{ uri: photo.uri }} style={styles.attachedImage} contentFit="cover" accessibilityLabel="Attached photo" />
          <Text style={styles.attachedText}>Photo attached — add a caption or send</Text>
          <Pressable accessibilityRole="button" accessibilityLabel="Remove photo" onPress={() => setPhoto(null)} hitSlop={10}>
            <Icon name="close" color={colors.inkMuted} size={20} />
          </Pressable>
        </View>
      ) : null}
      <View style={styles.composer}>
        <Pressable accessibilityRole="button" accessibilityLabel="Attach a photo" onPress={() => void pick()} disabled={busy} style={styles.iconButton}>
          <Icon name="image" color={photo ? colors.rose : colors.inkMuted} />
        </Pressable>
        <View style={styles.inputShell}>
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder={busy ? 'Posting…' : photo ? 'Add a caption' : 'Post an update'}
            placeholderTextColor={colors.inkMuted}
            multiline
            maxLength={2000}
            style={styles.input}
            accessibilityLabel="Update text"
          />
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="Post update" onPress={() => void send()} disabled={!canSend} style={[styles.send, !canSend && { opacity: 0.5 }]}>
          {busy ? <ActivityIndicator color={colors.onRose} /> : <Icon name="send" color={colors.onRose} strokeWidth={2} />}
        </Pressable>
      </View>
    </View>
  );
}

const styles = themed(() => StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: space.xs, paddingHorizontal: space.sm, paddingVertical: space.sm },
  headerButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  headerMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: space.sm },
  name: { fontFamily: fonts.heavy, fontSize: 18, color: colors.ink },
  sub: { fontFamily: fonts.medium, fontSize: 13, color: colors.inkMuted },
  missing: { fontFamily: fonts.regular, fontSize: 16, color: colors.inkMuted, textAlign: 'center', marginTop: space.xxl },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: space.xl, gap: space.sm },
  emptyTitle: { fontFamily: fonts.heavy, fontSize: 20, color: colors.ink, marginTop: space.sm },
  emptyBody: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 22, color: colors.inkMuted, textAlign: 'center' },
  postRow: { alignItems: 'flex-start', marginVertical: space.xs },
  bubble: { backgroundColor: colors.surface, borderRadius: radius.lg, borderTopLeftRadius: 6, padding: 6, ...shadow, shadowOpacity: 0.05 },
  photo: { borderRadius: radius.md, overflow: 'hidden' },
  text: { fontFamily: fonts.regular, fontSize: 16, lineHeight: 23, color: colors.ink, paddingHorizontal: 10, paddingTop: 6 },
  time: { fontFamily: fonts.medium, fontSize: 12, color: colors.inkMuted, alignSelf: 'flex-end', paddingHorizontal: 10, paddingTop: 2, paddingBottom: 4 },
  reactions: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6, marginTop: 6, marginLeft: 4 },
  chip: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.hairline },
  chipMine: { backgroundColor: colors.roseTint, borderColor: colors.rose },
  chipText: { fontFamily: fonts.bold, fontSize: 13, color: colors.ink },
  chipAdd: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface },
  followBar: { padding: space.lg, gap: space.sm, backgroundColor: colors.surface, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, ...shadow },
  followHint: { fontFamily: fonts.medium, fontSize: 14, color: colors.inkMuted, textAlign: 'center' },
  scrim: { flex: 1, backgroundColor: colors.scrim, alignItems: 'center', justifyContent: 'center' },
  picker: { flexDirection: 'row', gap: space.xs, backgroundColor: colors.surface, borderRadius: radius.pill, padding: space.sm, ...shadow },
  pickerOption: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  composer: { flexDirection: 'row', alignItems: 'flex-end', gap: space.sm, paddingHorizontal: space.md, paddingVertical: space.sm, backgroundColor: colors.bg },
  iconButton: { width: 44, height: 48, alignItems: 'center', justifyContent: 'center' },
  inputShell: { flex: 1, minHeight: 48, borderRadius: radius.lg, backgroundColor: colors.surface, paddingHorizontal: space.md, ...shadow, shadowOpacity: 0.06 },
  input: { ...noWebOutline, maxHeight: 140, paddingTop: 13, paddingBottom: 13, fontFamily: fonts.regular, fontSize: 16, color: colors.ink },
  attached: { flexDirection: 'row', alignItems: 'center', gap: space.md, marginHorizontal: space.md, padding: space.sm, borderRadius: radius.md, backgroundColor: colors.surface },
  attachedImage: { width: 48, height: 48, borderRadius: radius.sm },
  attachedText: { flex: 1, fontFamily: fonts.medium, fontSize: 14, color: colors.inkMuted },
  send: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.roseFill, alignItems: 'center', justifyContent: 'center', ...shadow },
}));
