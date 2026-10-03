import { Image } from 'expo-image';
import { router } from 'expo-router';
import { memo, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withSpring } from 'react-native-reanimated';
import type { PostView } from '../lib/api';
import { ago } from '../lib/format';
import { publicUrlFor } from '../lib/media';
import { colors, fonts, motion, radius, shadow, space } from '../theme';
import { Avatar } from './Avatar';
import { Icon } from './Icon';

export function PublicImage({ objectKey, width, height, maxWidth }: { objectKey: string; width: number | null; height: number | null; maxWidth: number }) {
  const [uri, setUri] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    publicUrlFor(objectKey).then((u) => alive && setUri(u), () => {});
    return () => {
      alive = false;
    };
  }, [objectKey]);
  const ratio = width && height ? width / height : 4 / 3;
  return (
    <View style={[styles.image, { width: maxWidth, height: Math.min(maxWidth / ratio, maxWidth * 1.25) }]}>
      {uri ? <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="cover" transition={220} accessibilityLabel="Post photo" /> : null}
    </View>
  );
}

export const PostCard = memo(function PostCard({ post, width, onLike, onMore, linkToPost = true }: {
  post: PostView;
  width: number;
  onLike: (post: PostView) => void;
  onMore: (post: PostView) => void;
  linkToPost?: boolean;
}) {
  const heart = useSharedValue(1);
  const heartStyle = useAnimatedStyle(() => ({ transform: [{ scale: heart.value }] }));
  const like = () => {
    heart.value = withSequence(withSpring(1.3, motion.spring), withSpring(1, motion.spring));
    onLike(post);
  };
  const openPost = linkToPost ? () => router.push(`/post/${post.id}`) : undefined;

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${post.author.displayName}'s profile`}
          onPress={() => router.push(`/user/${post.author.username}`)}
          style={styles.author}
        >
          <Avatar name={post.author.displayName} seed={post.author.username} size={40} />
          <View style={{ flex: 1 }}>
            <Text style={styles.name} numberOfLines={1}>{post.author.displayName}</Text>
            <Text style={styles.meta} numberOfLines={1}>@{post.author.username} · {ago(post.createdAt)}</Text>
          </View>
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="Post options" onPress={() => onMore(post)} hitSlop={10} style={styles.more}>
          <Icon name="more" color={colors.inkMuted} strokeWidth={3} />
        </Pressable>
      </View>

      <Pressable onPress={openPost} disabled={!openPost} accessibilityHint={openPost ? 'Opens comments' : undefined}>
        {post.text ? <Text style={styles.text}>{post.text}</Text> : null}
        {post.media ? (
          <View style={{ marginTop: post.text ? space.sm : 0 }}>
            <PublicImage objectKey={post.media.objectKey} width={post.media.width} height={post.media.height} maxWidth={width - space.md * 2} />
          </View>
        ) : null}
      </Pressable>

      <View style={styles.actions}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={post.likedByMe ? 'Unlike' : 'Like'}
          accessibilityState={{ selected: post.likedByMe }}
          onPress={like}
          hitSlop={8}
          style={styles.action}
        >
          <Animated.View style={heartStyle}>
            <Icon name="heart" size={22} color={post.likedByMe ? colors.rose : colors.inkMuted} filled={post.likedByMe} />
          </Animated.View>
          <Text style={[styles.count, post.likedByMe && { color: colors.rose }]}>{post.likeCount || ''}</Text>
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel={`Comments (${post.commentCount})`} onPress={openPost} disabled={!openPost} hitSlop={8} style={styles.action}>
          <Icon name="comment" size={22} color={colors.inkMuted} />
          <Text style={styles.count}>{post.commentCount || ''}</Text>
        </Pressable>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: space.md, gap: space.sm, ...shadow, shadowOpacity: 0.05 },
  header: { flexDirection: 'row', alignItems: 'center' },
  author: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: space.sm },
  name: { fontFamily: fonts.bold, fontSize: 15, color: colors.ink },
  meta: { fontFamily: fonts.regular, fontSize: 13, color: colors.inkMuted },
  more: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  text: { fontFamily: fonts.regular, fontSize: 16, lineHeight: 23, color: colors.ink },
  image: { borderRadius: radius.md, overflow: 'hidden', backgroundColor: colors.surfaceMuted },
  actions: { flexDirection: 'row', gap: space.lg, paddingTop: space.xs },
  action: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 32, minWidth: 44 },
  count: { fontFamily: fonts.medium, fontSize: 14, color: colors.inkMuted, minWidth: 8 },
});
