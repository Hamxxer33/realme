import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Modal, Pressable, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { Avatar, GroupAvatar } from '../../components/Avatar';
import { Bubble } from '../../components/Bubble';
import { Composer } from '../../components/Composer';
import { Icon } from '../../components/Icon';
import { Button, Screen } from '../../components/ui';
import { api, type ConversationView, type GroupEvent } from '../../lib/api';
import { onChatEvent } from '../../lib/chatEvents';
import { confirm, notify } from '../../lib/confirm';
import { forget, refreshConversation, upsert, useConversation } from '../../lib/conversations';
import { conversationTitle, otherMembers } from '../../lib/format';
import { describeEvent, useGroupEvents } from '../../lib/groupEvents';
import { useSession } from '../../lib/session';
import { useChat, type ChatItem } from '../../lib/useChat';
import { noWebOutline, colors, fonts, radius, shadow, space, themed } from '../../theme';

const REACTIONS = ['❤️', '🥰', '😂', '😮', '😢', '🔥'];

export default function ChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const conv = useConversation(id);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    if (id) void refreshConversation(id).then((c) => !c && setMissing(true));
  }, [id]);

  if (!conv) {
    return (
      <Screen>
        <TopBar title="" onBack={() => router.back()} />
        {missing ? <Text style={styles.missing}>This chat isn't available.</Text> : <ActivityIndicator color={colors.rose} style={{ marginTop: space.xxl }} />}
      </Screen>
    );
  }
  return <Chat conv={conv} />;
}

function Chat({ conv }: { conv: ConversationView }) {
  const { me } = useSession();
  const myId = me?.id ?? '';
  const chat = useChat(conv);
  const { width } = useWindowDimensions();
  const [reactingTo, setReactingTo] = useState<ChatItem | null>(null);
  const [query, setQuery] = useState<string | null>(null); // null = not searching
  const others = otherMembers(conv, myId);

  // "Search" on the info screen opens search here.
  useEffect(() => onChatEvent((e) => {
    if (e.type === 'search' && e.conversationId === conv.id) setQuery('');
  }), [conv.id]);
  const title = conversationTitle(conv, myId);
  const pending = conv.myStatus === 'pending';
  const isGroup = conv.kind === 'group';

  // Mark read while the chat is on screen — but not for requests: reading one shouldn't tell the sender.
  const { markRead, messages } = chat;
  const [focused, setFocused] = useState(false);
  useFocusEffect(useCallback(() => {
    setFocused(true);
    return () => setFocused(false);
  }, []));
  useEffect(() => {
    if (focused && !pending) markRead();
  }, [focused, pending, messages, markRead]);

  // Ticks on my newest message: read once every other (accepted) member has seen it.
  const lastMine = messages.find((m) => m.senderId === myId && m.status === 'sent' && m.body?.kind !== 'nudge');
  const readers = others.filter((m) => m.status === 'accepted');
  const readByAll = lastMine && readers.length > 0 && readers.every((m) => m.lastReadAt && m.lastReadAt >= lastMine.createdAt);

  const needle = query?.trim().toLowerCase() ?? '';
  const shown = needle
    ? messages.filter((m) => m.body?.kind === 'text' && m.body.text.toLowerCase().includes(needle))
    : messages;

  // Group history lines, woven in by time — only as far back as the messages we've loaded.
  const events = useGroupEvents(conv);
  const rows: Row[] = useMemo(() => {
    if (query !== null || !events.length) return shown.map((m) => ({ type: 'message', item: m }));
    const oldest = shown[shown.length - 1]?.createdAt;
    const visible = events.filter((e) => !chat.hasMore || !oldest || e.createdAt >= oldest);
    return [
      ...shown.map((m): Row => ({ type: 'message', item: m })),
      ...visible.map((e): Row => ({ type: 'event', event: e })),
    ].sort((a, b) => rowTime(b).localeCompare(rowTime(a)));
  }, [shown, events, query, chat.hasMore]);
  const lockedOut = isGroup && conv.adminsOnlyMessages && conv.myRole !== 'admin';

  const typingNames = chat.typingUserIds.map((uid) => conv.members.find((m) => m.id === uid)?.displayName).filter(Boolean);
  const subtitle = typingNames.length
    ? `${isGroup ? typingNames.join(', ') + ' ' : ''}typing…`
    : isGroup ? `${conv.members.length} people` : others[0] ? `@${others[0].username}` : '';

  const accept = async () => {
    try {
      const { conversation } = await api<{ conversation: ConversationView }>('POST', `/conversations/${conv.id}/accept`);
      upsert(conversation);
    } catch {
      notify("Couldn't accept");
    }
  };
  const decline = async () => {
    if (!(await confirm('Delete this request?', 'The chat will be removed from your requests.', 'Delete'))) return;
    await api('DELETE', `/conversations/${conv.id}/membership`).catch(() => {});
    forget(conv.id);
    router.back();
  };
  const block = async () => {
    const who = others[0];
    if (!who || !(await confirm(`Block ${who.displayName}?`, "They won't be able to message you or see your posts. They won't be told.", 'Block'))) return;
    await api('POST', '/blocks', { userId: who.id }).catch(() => {});
    if (pending) await api('DELETE', `/conversations/${conv.id}/membership`).catch(() => {});
    forget(conv.id);
    router.back();
  };

  return (
    <Screen>
      {query !== null ? (
        <View style={styles.searchBar}>
          <View style={styles.searchBox}>
            <Icon name="search" color={colors.inkMuted} size={20} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Search this chat"
              placeholderTextColor={colors.inkMuted}
              autoFocus
              style={styles.searchInput}
              accessibilityLabel="Search this chat"
            />
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel="Close search" onPress={() => setQuery(null)} hitSlop={8}>
            <Text style={styles.searchCancel}>Cancel</Text>
          </Pressable>
        </View>
      ) : null}
      {query !== null && needle ? (
        <Text style={styles.searchCount}>{shown.length ? `${shown.length} ${shown.length === 1 ? 'match' : 'matches'}` : 'No matches in loaded messages'}</Text>
      ) : null}
      {query === null ? <TopBar
        title={title}
        subtitle={subtitle}
        avatar={isGroup
          ? <GroupAvatar size={40} />
          : <Avatar name={title} seed={others[0]?.username ?? conv.id} size={40} />}
        onBack={() => router.back()}
        onInfo={() => router.push(`/chat-info/${conv.id}`)}
      /> : null}

      <FlatList
        inverted
        data={rows}
        keyExtractor={(r) => (r.type === 'message' ? r.item.clientId : `event:${r.event.id}`)}
        renderItem={({ item: row, index }) => {
          if (row.type === 'event') return <EventPill text={describeEvent(row.event, myId)} />;
          const item = row.item;
          const olderRow = rows[index + 1];
          const older = olderRow?.type === 'message' ? olderRow.item : undefined;
          const showName = isGroup && item.senderId !== myId && older?.senderId !== item.senderId;
          return (
            <Bubble
              item={item}
              mine={item.senderId === myId}
              senderName={showName ? conv.members.find((m) => m.id === item.senderId)?.displayName ?? 'Former member' : undefined}
              reactions={[...(chat.reactions.get(item.id)?.values() ?? [])]}
              maxWidth={Math.min(width * 0.78, 420)}
              receipt={item.id === lastMine?.id ? (readByAll ? 'read' : 'sent') : null}
              onLongPress={setReactingTo}
              onRetry={chat.retry}
              onOpenImage={(uri) => router.push({ pathname: '/photo', params: { uri } })}
            />
          );
        }}
        onEndReached={() => void chat.loadOlder()}
        onEndReachedThreshold={0.4}
        ListFooterComponent={chat.loading ? <ActivityIndicator color={colors.rose} style={{ margin: space.lg }} /> : null}
        ListEmptyComponent={
          <View style={[styles.empty, { transform: [{ scaleY: -1 }] }]}>
            <View style={styles.lock}><Icon name="lock" size={22} color={colors.rose} /></View>
            <Text style={styles.emptyTitle}>{isGroup ? `Welcome to ${title}` : `Say hi to ${title}`}</Text>
            <Text style={styles.emptyBody}>Messages here are end-to-end encrypted. Only the people in this chat can read them.</Text>
          </View>
        }
        contentContainerStyle={{ paddingVertical: space.sm, flexGrow: 1 }}
        keyboardDismissMode="interactive"
      />

      {query !== null ? null : pending ? (
        <View style={styles.request}>
          <Text style={styles.requestTitle}>
            {isGroup ? `You were added to ${title}` : `${title} wants to message you`}
          </Text>
          <Text style={styles.requestBody}>They won't know you've seen this until you accept.</Text>
          <Button title="Accept" onPress={() => void accept()} />
          <View style={styles.requestRow}>
            {!isGroup ? <Pressable accessibilityRole="button" onPress={() => void block()} style={styles.requestAlt}><Text style={styles.requestAltText}>Block</Text></Pressable> : null}
            <Pressable accessibilityRole="button" onPress={() => void decline()} style={styles.requestAlt}><Text style={styles.requestAltText}>Delete</Text></Pressable>
          </View>
        </View>
      ) : lockedOut ? (
        <View style={styles.locked}>
          <Icon name="lock" color={colors.inkMuted} size={16} />
          <Text style={styles.lockedText}>Only admins can send messages</Text>
        </View>
      ) : (
        <Composer
          onSendText={chat.sendText}
          onSendNudge={chat.sendNudge}
          onSendImage={(uri, meta) => chat.sendMedia('image', uri, meta)}
          onSendVoice={(uri, durationMs) => chat.sendMedia('voice', uri, { mime: 'audio/mp4', durationMs })}
          onTyping={chat.notifyTyping}
        />
      )}

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

type Row = { type: 'message'; item: ChatItem } | { type: 'event'; event: GroupEvent };
const rowTime = (r: Row) => (r.type === 'message' ? r.item.createdAt : r.event.createdAt);

function EventPill({ text }: { text: string }) {
  return (
    <View style={styles.eventWrap}>
      <Text style={styles.event}>{text}</Text>
    </View>
  );
}

function TopBar({ title, subtitle, avatar, onBack, onInfo }: {
  title: string;
  subtitle?: string;
  avatar?: React.ReactNode;
  onBack: () => void;
  onInfo?: () => void;
}) {
  return (
    <View style={styles.header}>
      <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={onBack} hitSlop={12} style={styles.headerButton}>
        <Icon name="back" color={colors.ink} />
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel={`${title} details`} onPress={onInfo} disabled={!onInfo} style={styles.headerMain}>
        {avatar}
        <View style={{ flex: 1 }}>
          <Text style={styles.name} numberOfLines={1}>{title}</Text>
          {subtitle ? <Text style={styles.status} numberOfLines={1}>{subtitle}</Text> : null}
        </View>
      </Pressable>
      {onInfo ? (
        <Pressable accessibilityRole="button" accessibilityLabel="Chat info" onPress={onInfo} hitSlop={8} style={styles.headerButton}>
          <Icon name="more" color={colors.ink} strokeWidth={3} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = themed(() => StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: space.xs, paddingHorizontal: space.sm, paddingVertical: space.sm },
  headerButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  headerMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: space.sm },
  name: { fontFamily: fonts.heavy, fontSize: 18, color: colors.ink },
  status: { fontFamily: fonts.medium, fontSize: 13, color: colors.inkMuted },
  missing: { fontFamily: fonts.regular, fontSize: 16, color: colors.inkMuted, textAlign: 'center', marginTop: space.xxl },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: space.xl, gap: space.sm },
  lock: { width: 56, height: 56, borderRadius: 28, backgroundColor: colors.roseTint, alignItems: 'center', justifyContent: 'center', marginBottom: space.sm },
  emptyTitle: { fontFamily: fonts.bold, fontSize: 18, color: colors.ink, textAlign: 'center' },
  emptyBody: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 22, color: colors.inkMuted, textAlign: 'center' },
  request: { padding: space.lg, gap: space.sm, backgroundColor: colors.surface, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, ...shadow },
  requestTitle: { fontFamily: fonts.bold, fontSize: 17, color: colors.ink, textAlign: 'center' },
  requestBody: { fontFamily: fonts.regular, fontSize: 14, color: colors.inkMuted, textAlign: 'center', marginBottom: space.xs },
  requestRow: { flexDirection: 'row', justifyContent: 'center', gap: space.xl },
  requestAlt: { paddingVertical: 10, paddingHorizontal: space.md },
  requestAltText: { fontFamily: fonts.bold, fontSize: 15, color: colors.rose },
  searchBar: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.md, paddingVertical: space.sm },
  searchBox: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: space.sm, height: 44, paddingHorizontal: space.md, borderRadius: radius.pill, backgroundColor: colors.surface, ...shadow, shadowOpacity: 0.05 },
  searchInput: { ...noWebOutline, flex: 1, height: '100%', fontFamily: fonts.regular, fontSize: 16, color: colors.ink },
  searchCancel: { fontFamily: fonts.bold, fontSize: 15, color: colors.rose },
  searchCount: { fontFamily: fonts.medium, fontSize: 13, color: colors.inkMuted, paddingHorizontal: space.lg, paddingBottom: space.xs },
  eventWrap: { alignItems: 'center', paddingHorizontal: space.xl, paddingVertical: space.xs },
  event: {
    fontFamily: fonts.medium, fontSize: 13, lineHeight: 18, color: colors.inkMuted, textAlign: 'center',
    backgroundColor: colors.surface, paddingHorizontal: space.md, paddingVertical: 6, borderRadius: radius.md, overflow: 'hidden',
  },
  locked: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.sm, paddingVertical: space.md, marginHorizontal: space.md,
    marginBottom: space.sm, borderRadius: radius.lg, backgroundColor: colors.surface,
  },
  lockedText: { fontFamily: fonts.medium, fontSize: 14, color: colors.inkMuted },
  scrim: { flex: 1, backgroundColor: colors.scrim, alignItems: 'center', justifyContent: 'center' },
  reactionPicker: { flexDirection: 'row', gap: space.xs, backgroundColor: colors.surface, borderRadius: radius.pill, padding: space.sm, ...shadow },
  reactionOption: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
}));
