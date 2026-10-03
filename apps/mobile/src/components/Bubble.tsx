import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import type { ChatItem } from '../lib/useChat';
import { colors, fonts, radius, shadow, space } from '../theme';
import { Icon } from './Icon';
import { EncryptedImage, VoiceNote } from './Media';

const time = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

export const Bubble = memo(function Bubble({ item, mine, reactions, maxWidth, showReceipt, onLongPress, onRetry, onOpenImage }: {
  item: ChatItem;
  mine: boolean;
  reactions?: string[];
  maxWidth: number;
  showReceipt: boolean;
  onLongPress: (item: ChatItem) => void;
  onRetry: (clientId: string) => void;
  onOpenImage: (uri: string) => void;
}) {
  const body = item.body;

  if (body?.kind === 'nudge') {
    return (
      <Animated.View entering={FadeInDown.springify().damping(16)} style={styles.nudgeRow}>
        <View style={styles.nudge}>
          <Icon name="heart" size={16} color={colors.rose} filled />
          <Text style={styles.nudgeText}>{mine ? 'You sent a little love' : 'Thinking of you'}</Text>
          <Text style={styles.nudgeTime}>{time(item.createdAt)}</Text>
        </View>
      </Animated.View>
    );
  }

  const isImage = body?.kind === 'image';
  const meta = (
    <View style={styles.metaRow}>
      <Text style={[styles.meta, mine ? styles.metaMine : null]}>{time(item.createdAt)}</Text>
      {mine && item.status === 'sent' && showReceipt ? (
        <Icon name={item.readAt ? 'checks' : 'check'} size={14} color={colors.onRoseMuted} strokeWidth={2} />
      ) : null}
    </View>
  );

  return (
    <Animated.View
      entering={FadeInDown.springify().damping(18)}
      style={[styles.row, mine ? styles.rowMine : styles.rowTheirs]}
    >
      <Pressable
        onLongPress={() => item.status === 'sent' && onLongPress(item)}
        delayLongPress={280}
        accessibilityHint="Long press to react"
        style={[
          styles.bubble,
          mine ? styles.mine : styles.theirs,
          isImage && styles.imageBubble,
          { maxWidth },
          item.status === 'pending' && { opacity: 0.7 },
        ]}
      >
        {body === null ? (
          <Text style={[styles.text, styles.undecryptable]}>Couldn't decrypt this message</Text>
        ) : body.kind === 'text' ? (
          <Text style={[styles.text, mine && styles.textMine]} selectable>{body.text}</Text>
        ) : body.kind === 'image' ? (
          <EncryptedImage media={body.media} maxWidth={maxWidth - 8} onPress={onOpenImage} />
        ) : body.kind === 'voice' ? (
          <VoiceNote media={body.media} durationMs={body.durationMs} mine={mine} />
        ) : null}
        {isImage ? <View style={styles.imageMeta}>{meta}</View> : meta}
      </Pressable>

      {reactions?.length ? (
        <View style={[styles.reactions, mine ? { right: space.sm } : { left: space.sm }]}>
          <Text style={styles.reactionText}>{reactions.join(' ')}</Text>
        </View>
      ) : null}

      {item.status === 'failed' ? (
        <Pressable accessibilityRole="button" onPress={() => onRetry(item.clientId)} style={styles.failed}>
          <Icon name="alert" size={14} color={colors.danger} />
          <Text style={styles.failedText}>Not sent · Tap to retry</Text>
        </Pressable>
      ) : null}
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  row: { paddingHorizontal: space.md, marginVertical: 3 },
  rowMine: { alignItems: 'flex-end' },
  rowTheirs: { alignItems: 'flex-start' },
  bubble: { borderRadius: radius.md, paddingHorizontal: 14, paddingTop: 10, paddingBottom: 6, gap: 2 },
  mine: { backgroundColor: colors.rose, borderBottomRightRadius: 6 },
  theirs: { backgroundColor: colors.surface, borderBottomLeftRadius: 6, ...shadow, shadowOpacity: 0.05 },
  imageBubble: { padding: 4, paddingTop: 4, paddingBottom: 4 },
  text: { fontFamily: fonts.regular, fontSize: 16, lineHeight: 22, color: colors.ink },
  textMine: { color: colors.onRose },
  undecryptable: { fontStyle: 'italic', color: colors.inkMuted },
  metaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 4 },
  meta: { fontFamily: fonts.medium, fontSize: 11, color: colors.inkMuted },
  metaMine: { color: colors.onRoseMuted },
  imageMeta: {
    position: 'absolute',
    right: 10,
    bottom: 8,
    backgroundColor: 'rgba(46,30,36,0.45)',
    borderRadius: radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  reactions: {
    position: 'relative',
    marginTop: -8,
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 2,
    ...shadow,
    shadowOpacity: 0.1,
  },
  reactionText: { fontSize: 14 },
  nudgeRow: { alignItems: 'center', marginVertical: space.sm },
  nudge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.roseTint,
    borderRadius: radius.pill,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  nudgeText: { fontFamily: fonts.bold, fontSize: 14, color: colors.rose },
  nudgeTime: { fontFamily: fonts.medium, fontSize: 12, color: colors.inkMuted },
  failed: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  failedText: { fontFamily: fonts.medium, fontSize: 12, color: colors.danger },
});
