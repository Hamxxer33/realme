import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { Avatar } from '../../components/Avatar';
import { Icon } from '../../components/Icon';
import { Screen } from '../../components/ui';
import { api } from '../../lib/api';
import { type CallView, formatDuration, startCall } from '../../lib/calls';
import { shortTime } from '../../lib/format';
import { realtime } from '../../lib/realtime';
import { colors, fonts, radius, shadow, space, themed } from '../../theme';

/** Call history: who, which way, how it went; tap the icon to call back. */
export default function Calls() {
  const [history, setHistory] = useState<CallView[] | null>(null);
  const load = useCallback(() => {
    api<{ calls: CallView[] }>('GET', '/calls').then((r) => setHistory(r.calls), () => setHistory((h) => h ?? []));
  }, []);
  useFocusEffect(useCallback(() => {
    load();
    return realtime.subscribe((evt) => {
      if (evt.type === 'call_update' || evt.type === 'call_ring') load();
    });
  }, [load]));

  return (
    <Screen edges={['top']}>
      <View style={styles.header}>
        <Text accessibilityRole="header" style={styles.title}>Calls</Text>
      </View>
      {history === null ? <ActivityIndicator color={colors.rose} style={{ marginTop: space.xxl }} /> : (
        <FlatList
          data={history}
          keyExtractor={(c) => c.id}
          ListHeaderComponent={history.length ? <Text style={styles.section}>Recent</Text> : null}
          renderItem={({ item }) => <CallRow call={item} />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <View style={styles.emptyIcon}><Icon name="phone" color={colors.rose} size={36} /></View>
              <Text style={styles.emptyTitle}>No calls yet</Text>
              <Text style={styles.emptyBody}>Voice and video calls with people you chat with are end-to-end encrypted. Start one from a chat or below.</Text>
            </View>
          }
          contentContainerStyle={{ paddingHorizontal: space.md, paddingBottom: 120 }}
        />
      )}
      <Pressable accessibilityRole="button" accessibilityLabel="New call" onPress={() => router.push('/new-call')} style={styles.fab}>
        <Icon name="phone" color={colors.onRose} size={24} />
        <View style={styles.fabPlus}><Icon name="plus" color={colors.onRose} size={12} strokeWidth={3} /></View>
      </Pressable>
    </Screen>
  );
}

function CallRow({ call }: { call: CallView }) {
  const missed = call.direction === 'incoming' && (call.status === 'missed' || call.status === 'cancelled');
  const what =
    call.status === 'answered' && call.durationSeconds !== null ? formatDuration(call.durationSeconds)
    : missed ? 'Missed'
    : call.status === 'declined' ? (call.direction === 'incoming' ? 'Declined' : 'No answer')
    : call.status === 'missed' || call.status === 'cancelled' ? 'No answer'
    : call.status === 'failed' ? 'Failed'
    : call.status === 'active' ? 'Ongoing' : 'Ringing';
  return (
    <View style={styles.row}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${call.peer.displayName}, ${call.direction} ${call.kind} call, ${what}, ${shortTime(call.createdAt)}`}
        onPress={() => router.push(`/user/${call.peer.username}`)}
        style={({ pressed }) => [styles.rowMain, pressed && { backgroundColor: colors.surfaceMuted }]}
      >
        <Avatar name={call.peer.displayName} seed={call.peer.username} size={50} />
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={[styles.name, missed && { color: colors.danger }]} numberOfLines={1}>{call.peer.displayName}</Text>
          <View style={styles.meta}>
            <Icon name={call.direction === 'incoming' ? 'arrowIn' : 'arrowOut'} color={missed ? colors.danger : colors.inkMuted} size={16} strokeWidth={2.2} />
            <Text style={styles.metaText} numberOfLines={1}>{what} · {shortTime(call.createdAt)}</Text>
          </View>
        </View>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${call.kind === 'video' ? 'Video' : 'Voice'} call ${call.peer.displayName}`}
        onPress={() => void startCall(call.conversationId, call.kind)}
        hitSlop={8}
        style={styles.callBack}
      >
        <Icon name={call.kind === 'video' ? 'video' : 'phone'} color={colors.rose} size={22} />
      </Pressable>
    </View>
  );
}

const styles = themed(() => StyleSheet.create({
  header: { paddingHorizontal: space.lg, paddingTop: space.sm, paddingBottom: space.sm },
  title: { fontFamily: fonts.heavy, fontSize: 32, color: colors.ink, letterSpacing: -0.5 },
  section: { fontFamily: fonts.heavy, fontSize: 18, color: colors.ink, marginHorizontal: space.sm, marginVertical: space.sm },
  row: { flexDirection: 'row', alignItems: 'center' },
  rowMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: 10, paddingHorizontal: space.sm, borderRadius: radius.md },
  name: { fontFamily: fonts.bold, fontSize: 16, color: colors.ink },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { flex: 1, fontFamily: fonts.regular, fontSize: 14, color: colors.inkMuted },
  callBack: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  empty: { alignItems: 'center', gap: space.md, paddingHorizontal: space.lg, paddingTop: space.xxl },
  emptyIcon: { width: 88, height: 88, borderRadius: 44, backgroundColor: colors.roseTint, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { fontFamily: fonts.heavy, fontSize: 20, color: colors.ink },
  emptyBody: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 22, color: colors.inkMuted, textAlign: 'center' },
  fab: { position: 'absolute', right: space.lg, bottom: space.lg, width: 60, height: 60, borderRadius: 20, backgroundColor: colors.roseFill, alignItems: 'center', justifyContent: 'center', ...shadow, shadowOpacity: 0.2 },
  fabPlus: { position: 'absolute', right: 12, top: 12 },
}));
