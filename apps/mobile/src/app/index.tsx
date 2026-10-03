import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Modal, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { Bubble } from '../components/Bubble';
import { Composer } from '../components/Composer';
import { Icon } from '../components/Icon';
import { Screen } from '../components/ui';
import { relationshipStats } from '../lib/dates';
import { registerForPush } from '../lib/push';
import { useSession } from '../lib/session';
import { useChat, type ChatItem } from '../lib/useChat';
import { colors, fonts, radius, shadow, space } from '../theme';

const REACTIONS = ['❤️', '🥰', '😂', '😮', '😢', '🔥'];

export default function Chat() {
  const { me, settings } = useSession();
  const partner = me?.couple?.partner;
  const chat = useChat();
  const { width } = useWindowDimensions();
  const [reactingTo, setReactingTo] = useState<ChatItem | null>(null);
  const stats = settings.anniversary ? relationshipStats(settings.anniversary) : null;

  useEffect(() => {
    void registerForPush().catch(() => {});
  }, []);

  // Mark messages read whenever the chat is on screen and something new arrives.
  const { markRead, messages } = chat;
  const [focused, setFocused] = useState(false);
  useFocusEffect(useCallback(() => {
    setFocused(true);
    return () => setFocused(false);
  }, []));
  useEffect(() => {
    if (focused) markRead();
  }, [focused, messages, markRead]);

  // My newest message bubble gets the sent/read tick (nudges render as pills without one).
  const lastMineId = messages.find((m) => m.senderId === chat.myId && m.status === 'sent' && m.body?.kind !== 'nudge')?.id;

  return (
    <Screen>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.name} numberOfLines={1}>{settings.coupleName || partner?.displayName}</Text>
          <Text style={styles.status}>
            {chat.partnerTyping ? 'typing…' : stats ? `${stats.daysTogether.toLocaleString()} days together` : 'Just the two of you'}
          </Text>
        </View>
        <HeaderButton icon="album" label="Memories" onPress={() => router.push('/memories')} />
        <HeaderButton icon="settings" label="Settings" onPress={() => router.push('/settings')} />
      </View>

      {stats && stats.daysUntilAnniversary <= 30 ? (
        <Animated.View entering={FadeIn} style={styles.anniversary}>
          <Icon name="heart" size={16} color={colors.gold} filled />
          <Text style={styles.anniversaryText}>
            {stats.daysUntilAnniversary === 0
              ? `Happy ${ordinal(stats.years)} anniversary!`
              : `${stats.daysUntilAnniversary} ${stats.daysUntilAnniversary === 1 ? 'day' : 'days'} until your ${ordinal(stats.years)} anniversary`}
          </Text>
        </Animated.View>
      ) : null}

      <FlatList
        inverted
        data={messages}
        keyExtractor={(m) => m.clientId}
        renderItem={({ item }) => (
          <Bubble
            item={item}
            mine={item.senderId === chat.myId}
            reactions={[...(chat.reactions.get(item.id)?.values() ?? [])]}
            maxWidth={Math.min(width * 0.78, 420)}
            showReceipt={item.id === lastMineId}
            onLongPress={setReactingTo}
            onRetry={chat.retry}
            onOpenImage={(uri) => router.push({ pathname: '/photo', params: { uri } })}
          />
        )}
        onEndReached={() => void chat.loadOlder()}
        onEndReachedThreshold={0.4}
        ListFooterComponent={chat.loading ? <ActivityIndicator color={colors.rose} style={{ margin: space.lg }} /> : null}
        ListEmptyComponent={<EmptyState name={partner?.displayName ?? 'them'} />}
        contentContainerStyle={{ paddingVertical: space.sm, flexGrow: 1 }}
        keyboardDismissMode="interactive"
      />

      <Composer
        onSendText={chat.sendText}
        onSendNudge={chat.sendNudge}
        onSendImage={(uri, meta) => chat.sendMedia('image', uri, meta)}
        onSendVoice={(uri, durationMs) => chat.sendMedia('voice', uri, { mime: 'audio/mp4', durationMs })}
        onTyping={chat.notifyTyping}
      />

      <Modal transparent visible={!!reactingTo} animationType="fade" onRequestClose={() => setReactingTo(null)}>
        <Pressable style={styles.scrim} onPress={() => setReactingTo(null)} accessibilityLabel="Close reactions">
          <Animated.View entering={FadeIn.springify()} exiting={FadeOut} style={styles.reactionPicker}>
            {REACTIONS.map((emoji) => (
              <Pressable
                key={emoji}
                accessibilityRole="button"
                accessibilityLabel={`React ${emoji}`}
                onPress={() => {
                  if (reactingTo) chat.react(reactingTo.id, emoji);
                  setReactingTo(null);
                }}
                style={styles.reactionOption}
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

function HeaderButton({ icon, label, onPress }: { icon: 'album' | 'settings'; label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} hitSlop={8} style={styles.headerButton}>
      <Icon name={icon} color={colors.ink} />
    </Pressable>
  );
}

function EmptyState({ name }: { name: string }) {
  // The list is inverted, so flip the empty state back upright.
  return (
    <View style={[styles.empty, { transform: [{ scaleY: -1 }] }]}>
      <View style={styles.emptyMark}>
        <Icon name="heart" size={32} color={colors.rose} filled />
      </View>
      <Text style={styles.emptyTitle}>You and {name} are connected</Text>
      <Text style={styles.emptyBody}>Everything here is end-to-end encrypted.{'\n'}Say hello, or tap the heart to send a little love.</Text>
    </View>
  );
}

function ordinal(n: number) {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]!);
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    paddingHorizontal: space.lg,
    paddingTop: space.sm,
    paddingBottom: space.md,
  },
  name: { fontFamily: fonts.heavy, fontSize: 24, color: colors.ink, letterSpacing: -0.3 },
  status: { fontFamily: fonts.medium, fontSize: 14, color: colors.inkMuted, marginTop: 2 },
  headerButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    ...shadow,
    shadowOpacity: 0.05,
  },
  anniversary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    marginHorizontal: space.lg,
    marginBottom: space.sm,
    paddingHorizontal: space.md,
    paddingVertical: 10,
    backgroundColor: colors.goldTint,
    borderRadius: radius.pill,
  },
  anniversaryText: { fontFamily: fonts.bold, fontSize: 14, color: colors.gold },
  scrim: { flex: 1, backgroundColor: 'rgba(46,30,36,0.25)', alignItems: 'center', justifyContent: 'center' },
  reactionPicker: {
    flexDirection: 'row',
    gap: space.xs,
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
    padding: space.sm,
    ...shadow,
  },
  reactionOption: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: space.xl, gap: space.sm },
  emptyMark: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.roseTint,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: space.sm,
  },
  emptyTitle: { fontFamily: fonts.bold, fontSize: 18, color: colors.ink, textAlign: 'center' },
  emptyBody: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 22, color: colors.inkMuted, textAlign: 'center' },
});
