import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';
import { Avatar } from '../../components/Avatar';
import { BackHeader } from '../../components/BackHeader';
import { Icon } from '../../components/Icon';
import { PostCard } from '../../components/PostCard';
import { ReportSheet, type ReportTarget } from '../../components/ReportSheet';
import { PressScale, Screen } from '../../components/ui';
import { api, type CommentView, type PostView } from '../../lib/api';
import { confirm, notify } from '../../lib/confirm';
import { ago } from '../../lib/format';
import { postMenu } from '../../lib/postActions';
import { useSession } from '../../lib/session';
import { noWebOutline, colors, fonts, radius, shadow, space, themed } from '../../theme';

export default function PostScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { me } = useSession();
  const { width } = useWindowDimensions();
  const [post, setPost] = useState<PostView | null | 'missing'>(null);
  const [comments, setComments] = useState<CommentView[]>([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [report, setReport] = useState<ReportTarget | null>(null);

  const load = useCallback(async () => {
    try {
      const [p, c] = await Promise.all([
        api<{ post: PostView }>('GET', `/posts/${id}`),
        api<{ comments: CommentView[] }>('GET', `/posts/${id}/comments`),
      ]);
      setPost(p.post);
      setComments(c.comments);
    } catch {
      setPost('missing');
    }
  }, [id]);
  useEffect(() => {
    void load();
  }, [load]);

  if (post === null) return <Screen><BackHeader title="Post" /><ActivityIndicator color={colors.rose} style={{ marginTop: space.xxl }} /></Screen>;
  if (post === 'missing') return <Screen><BackHeader title="Post" /><Text style={styles.missing}>This post isn't available.</Text></Screen>;

  const like = (p: PostView) => {
    const liked = !p.likedByMe;
    setPost({ ...p, likedByMe: liked, likeCount: p.likeCount + (liked ? 1 : -1) });
    api(liked ? 'PUT' : 'DELETE', `/posts/${p.id}/like`).catch(() => setPost(p));
  };

  const send = async () => {
    const body = text.trim();
    if (!body) return;
    setSending(true);
    try {
      const { comment } = await api<{ comment: CommentView }>('POST', `/posts/${post.id}/comments`, { text: body });
      setComments((c) => [...c, comment]);
      setPost({ ...post, commentCount: post.commentCount + 1 });
      setText('');
    } catch (e) {
      notify("Couldn't post comment", e instanceof Error ? e.message : undefined);
    } finally {
      setSending(false);
    }
  };

  const commentMenu = async (c: CommentView) => {
    const canDelete = c.author.id === me?.id || post.author.id === me?.id;
    if (canDelete) {
      if (!(await confirm('Delete this comment?', '', 'Delete'))) return;
      await api('DELETE', `/comments/${c.id}`).catch(() => {});
      setComments((list) => list.filter((x) => x.id !== c.id));
      setPost({ ...post, commentCount: Math.max(0, post.commentCount - 1) });
    } else {
      setReport({ commentId: c.id, userId: c.author.id, label: 'this comment' });
    }
  };

  return (
    <Screen>
      <BackHeader title="Post" />
      <FlatList
        data={comments}
        keyExtractor={(c) => c.id}
        ListHeaderComponent={
          <View style={{ marginBottom: space.lg }}>
            <PostCard
              post={post}
              width={Math.min(width, 640) - space.lg * 2}
              onLike={like}
              linkToPost={false}
              onMore={(p) => postMenu(p, me?.id ?? '', {
                onDeleted: () => router.back(),
                onReport: () => setReport({ postId: p.id, userId: p.author.id, label: 'this post' }),
              })}
            />
            <Text style={styles.section}>{comments.length ? 'Comments' : 'No comments yet — be the first.'}</Text>
          </View>
        }
        renderItem={({ item }) => (
          <Pressable onLongPress={() => void commentMenu(item)} accessibilityHint="Long press for options" style={styles.comment}>
            <Pressable accessibilityRole="button" accessibilityLabel={`${item.author.displayName}'s profile`} onPress={() => router.push(`/user/${item.author.username}`)}>
              <Avatar name={item.author.displayName} seed={item.author.username} size={34} />
            </Pressable>
            <View style={styles.commentBubble}>
              <Text style={styles.commentName}>{item.author.displayName} <Text style={styles.commentMeta}>· {ago(item.createdAt)}</Text></Text>
              <Text style={styles.commentText}>{item.text}</Text>
            </View>
          </Pressable>
        )}
        contentContainerStyle={{ padding: space.lg, gap: space.sm }}
        keyboardShouldPersistTaps="handled"
      />
      <View style={styles.composer}>
        <View style={styles.inputShell}>
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder="Add a comment"
            placeholderTextColor={colors.inkMuted}
            multiline
            maxLength={500}
            style={styles.input}
            accessibilityLabel="Comment"
          />
        </View>
        <PressScale accessibilityRole="button" accessibilityLabel="Post comment" onPress={() => void send()} disabled={!text.trim() || sending} style={styles.send}>
          <Icon name="send" color={colors.onRose} strokeWidth={2} />
        </PressScale>
      </View>
      <ReportSheet target={report} onClose={() => setReport(null)} />
    </Screen>
  );
}

const styles = themed(() => StyleSheet.create({
  missing: { fontFamily: fonts.regular, fontSize: 16, color: colors.inkMuted, textAlign: 'center', marginTop: space.xxl },
  section: { fontFamily: fonts.bold, fontSize: 15, color: colors.inkMuted, marginTop: space.lg },
  comment: { flexDirection: 'row', gap: space.sm, alignItems: 'flex-start' },
  commentBubble: { flex: 1, backgroundColor: colors.surface, borderRadius: radius.md, borderTopLeftRadius: 6, paddingHorizontal: 14, paddingVertical: 10 },
  commentName: { fontFamily: fonts.bold, fontSize: 14, color: colors.ink },
  commentMeta: { fontFamily: fonts.regular, color: colors.inkMuted },
  commentText: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 21, color: colors.ink, marginTop: 2 },
  composer: { flexDirection: 'row', alignItems: 'flex-end', gap: space.sm, padding: space.md, backgroundColor: colors.bg },
  inputShell: { flex: 1, minHeight: 48, borderRadius: radius.lg, backgroundColor: colors.surface, paddingHorizontal: space.md, ...shadow, shadowOpacity: 0.06 },
  input: { ...noWebOutline, maxHeight: 120, paddingVertical: 13, fontFamily: fonts.regular, fontSize: 16, color: colors.ink },
  send: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.roseFill, alignItems: 'center', justifyContent: 'center' },
}));
