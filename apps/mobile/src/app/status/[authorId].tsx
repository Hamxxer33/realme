import type { StatusBody } from '@realme/crypto';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { cancelAnimation, Easing, runOnJS, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Avatar } from '../../components/Avatar';
import { Icon } from '../../components/Icon';
import { EncryptedImage } from '../../components/Media';
import { api, type PublicUser } from '../../lib/api';
import { confirm } from '../../lib/confirm';
import { ago } from '../../lib/format';
import { useSession } from '../../lib/session';
import { markStatusViewed, type StatusGroup, useStatusCrypto, useStatusFeed } from '../../lib/status';
import { colors, fonts, radius, space, themed } from '../../theme';

const TEXT_MS = 5000;
const PHOTO_MS = 6000;

export default function StatusViewer() {
  const { authorId } = useLocalSearchParams<{ authorId: string }>();
  const { me } = useSession();
  const { feed, refresh } = useStatusFeed();
  const group: StatusGroup | null | undefined = useMemo(() => {
    if (!feed) return undefined;
    if (authorId === me?.id) return feed.mine;
    return [...feed.recent, ...feed.viewed].find((g) => g.author.id === authorId) ?? null;
  }, [feed, authorId, me?.id]);

  if (group === undefined) return <View style={styles.screen}><ActivityIndicator color="#FFFFFF" style={{ marginTop: 120 }} /></View>;
  if (!group || !group.items.length) {
    return (
      <View style={styles.screen}>
        <SafeAreaView><CloseButton /></SafeAreaView>
        <Text style={styles.gone}>This status is no longer available.</Text>
      </View>
    );
  }
  return <Viewer group={group} isMe={authorId === me?.id} onChanged={() => void refresh()} />;
}

function CloseButton() {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={() => router.back()} hitSlop={12} style={styles.close}>
      <Icon name="close" color="#FFFFFF" />
    </Pressable>
  );
}

function Viewer({ group, isMe, onChanged }: { group: StatusGroup; isMe: boolean; onChanged: () => void }) {
  const { open } = useStatusCrypto();
  // Start at the first unseen update, like WhatsApp.
  const [index, setIndex] = useState(() => {
    const first = group.items.findIndex((i) => !i.viewed);
    return isMe || first < 0 ? 0 : first;
  });
  const [paused, setPaused] = useState(false);
  const [viewers, setViewers] = useState<Array<PublicUser & { viewedAt: string }> | null>(null);
  const item = group.items[Math.min(index, group.items.length - 1)]!;
  const body: StatusBody | null = useMemo(() => open(item, group.author), [item.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const progress = useSharedValue(0);
  const indexRef = useRef(index);
  indexRef.current = index;

  const next = () => {
    if (indexRef.current < group.items.length - 1) setIndex((i) => i + 1);
    else router.back();
  };
  const prev = () => setIndex((i) => Math.max(0, i - 1));

  useEffect(() => {
    if (!isMe) markStatusViewed(item.id);
  }, [item.id, isMe]);

  useEffect(() => {
    cancelAnimation(progress);
    if (paused || viewers) return;
    const remaining = (1 - progress.value) * (body?.kind === 'image' ? PHOTO_MS : TEXT_MS);
    progress.value = withTiming(1, { duration: remaining, easing: Easing.linear }, (done) => {
      if (done) runOnJS(next)();
    });
  }, [item.id, paused, viewers]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    progress.value = 0;
  }, [item.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const bar = useAnimatedStyle(() => ({ width: `${progress.value * 100}%` }));

  const showViewers = async () => {
    setViewers([]);
    const res = await api<{ viewers: Array<PublicUser & { viewedAt: string }> }>('GET', `/status/${item.id}/views`).catch(() => ({ viewers: [] }));
    setViewers(res.viewers);
  };

  const remove = async () => {
    setPaused(true);
    if (!(await confirm('Delete this status?', 'It will be removed for everyone.', 'Delete'))) return setPaused(false);
    await api('DELETE', `/status/${item.id}`).catch(() => {});
    onChanged();
    router.back();
  };

  return (
    <View style={[styles.screen, body?.kind === 'text' && { backgroundColor: body.background }]}>
      {body?.kind === 'image' ? (
        <View style={styles.photo}>
          <EncryptedImage media={body.media} maxWidth={420} />
        </View>
      ) : body?.kind === 'text' ? (
        <View style={styles.textWrap}><Text style={styles.text}>{body.text}</Text></View>
      ) : (
        <View style={styles.textWrap}><Text style={styles.gone}>Can't show this update</Text></View>
      )}

      {/* Tap zones: left = back, right = next; hold to pause. */}
      <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
        <View style={styles.zones}>
          <Pressable accessibilityRole="button" accessibilityLabel="Previous update" style={{ flex: 1 }} onPress={prev} onLongPress={() => setPaused(true)} onPressOut={() => setPaused(false)} />
          <Pressable accessibilityRole="button" accessibilityLabel="Next update" style={{ flex: 2 }} onPress={next} onLongPress={() => setPaused(true)} onPressOut={() => setPaused(false)} />
        </View>
      </View>

      <SafeAreaView edges={['top']} style={styles.top}>
        <View style={styles.bars}>
          {group.items.map((it, i) => (
            <View key={it.id} style={styles.barTrack}>
              {i < index ? <View style={[styles.barFill, { width: '100%' }]} /> : i === index ? <Animated.View style={[styles.barFill, bar]} /> : null}
            </View>
          ))}
        </View>
        <View style={styles.header}>
          <Avatar name={group.author.displayName} seed={group.author.username} size={36} />
          <View style={{ flex: 1 }}>
            <Text style={styles.name}>{isMe ? 'My status' : group.author.displayName}</Text>
            <Text style={styles.time}>{ago(item.createdAt)}</Text>
          </View>
          {isMe ? (
            <Pressable accessibilityRole="button" accessibilityLabel="Delete status" onPress={() => void remove()} hitSlop={10} style={styles.close}>
              <Icon name="trash" color="#FFFFFF" />
            </Pressable>
          ) : null}
          <CloseButton />
        </View>
      </SafeAreaView>

      {body?.kind === 'image' && body.caption ? (
        <View style={styles.captionWrap} pointerEvents="none"><Text style={styles.caption}>{body.caption}</Text></View>
      ) : null}

      {isMe ? (
        <SafeAreaView edges={['bottom']} style={styles.bottom}>
          <Pressable accessibilityRole="button" accessibilityLabel={`Seen by ${item.viewCount ?? 0}`} onPress={() => void showViewers()} style={styles.seen}>
            <Icon name="eye" color="#FFFFFF" size={18} />
            <Text style={styles.seenText}>{item.viewCount ?? 0}</Text>
          </Pressable>
        </SafeAreaView>
      ) : null}

      <Modal transparent visible={!!viewers} animationType="slide" onRequestClose={() => setViewers(null)}>
        <Pressable style={{ flex: 1 }} onPress={() => setViewers(null)} accessibilityLabel="Close viewers" />
        <View style={styles.sheet}>
          <Text style={styles.sheetTitle}>Viewed by {viewers?.length ?? 0}</Text>
          <FlatList
            data={viewers ?? []}
            keyExtractor={(v) => v.id}
            renderItem={({ item: v }) => (
              <View style={styles.viewer}>
                <Avatar name={v.displayName} seed={v.username} size={40} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.viewerName}>{v.displayName}</Text>
                  <Text style={styles.viewerTime}>{ago(v.viewedAt)}</Text>
                </View>
              </View>
            )}
            ListEmptyComponent={<Text style={styles.viewerTime}>No views yet.</Text>}
          />
        </View>
      </Modal>
    </View>
  );
}

const styles = themed(() => StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#0D0809' },
  gone: { fontFamily: fonts.medium, fontSize: 16, color: '#FFFFFF', textAlign: 'center', marginTop: space.xxl },
  photo: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  textWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: space.xl },
  text: { fontFamily: fonts.heavy, fontSize: 30, lineHeight: 40, color: '#FFFFFF', textAlign: 'center' },
  zones: { flex: 1, flexDirection: 'row', marginTop: 110, marginBottom: 90 },
  top: { position: 'absolute', top: 0, left: 0, right: 0, paddingHorizontal: space.sm },
  bars: { flexDirection: 'row', gap: 4, paddingTop: space.sm, paddingHorizontal: space.xs },
  barTrack: { flex: 1, height: 3, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.35)', overflow: 'hidden' },
  barFill: { height: 3, backgroundColor: '#FFFFFF' },
  header: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingVertical: space.sm, paddingHorizontal: space.xs },
  name: { fontFamily: fonts.bold, fontSize: 15, color: '#FFFFFF' },
  time: { fontFamily: fonts.regular, fontSize: 13, color: 'rgba(255,255,255,0.8)' },
  close: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  captionWrap: { position: 'absolute', left: 0, right: 0, bottom: 90, paddingHorizontal: space.lg },
  caption: { fontFamily: fonts.medium, fontSize: 16, lineHeight: 22, color: '#FFFFFF', textAlign: 'center', backgroundColor: 'rgba(0,0,0,0.45)', borderRadius: radius.md, padding: space.sm },
  bottom: { position: 'absolute', left: 0, right: 0, bottom: 0, alignItems: 'center' },
  seen: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, paddingVertical: 10, marginBottom: space.md, borderRadius: radius.pill, backgroundColor: 'rgba(0,0,0,0.45)' },
  seenText: { fontFamily: fonts.bold, fontSize: 15, color: '#FFFFFF' },
  sheet: { maxHeight: '60%', backgroundColor: colors.bg, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, padding: space.lg, gap: space.md },
  sheetTitle: { fontFamily: fonts.heavy, fontSize: 18, color: colors.ink },
  viewer: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.sm },
  viewerName: { fontFamily: fonts.bold, fontSize: 15, color: colors.ink },
  viewerTime: { fontFamily: fonts.regular, fontSize: 13, color: colors.inkMuted },
}));
