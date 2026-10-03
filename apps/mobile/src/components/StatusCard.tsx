import type { StatusBody } from '@realme/crypto';
import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { PublicUser } from '../lib/api';
import { type StatusGroup, useStatusCrypto } from '../lib/status';
import { colors, fonts, radius, themed } from '../theme';
import { Avatar } from './Avatar';
import { Icon } from './Icon';
import { EncryptedCover } from './Media';

const W = 108;
const H = 168;

function Preview({ body }: { body: StatusBody | null }) {
  if (!body) return <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.surfaceMuted }]} />;
  if (body.kind === 'text') {
    return (
      <View style={[StyleSheet.absoluteFill, styles.textPreview, { backgroundColor: body.background }]}>
        <Text style={styles.textPreviewText} numberOfLines={5}>{body.text}</Text>
      </View>
    );
  }
  return (
    <View style={StyleSheet.absoluteFill}>
      <EncryptedCover media={body.media} />
    </View>
  );
}

/** A tall story card: latest update as the preview, author ring on top. */
export function StatusCard({ group, label, onPress, isMe }: { group: StatusGroup; label: string; onPress: () => void; isMe?: boolean }) {
  const { open } = useStatusCrypto();
  const latest = group.items[group.items.length - 1];
  const body = useMemo(() => (latest ? open(latest, group.author) : null), [latest?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const ring = isMe ? colors.inkMuted : group.allViewed ? colors.inkMuted : colors.rose;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={isMe ? label : `${label}'s status${group.allViewed ? '' : ', new'}`} onPress={onPress} style={styles.card}>
      <Preview body={body} />
      <View style={styles.shade} />
      <View style={[styles.ring, { borderColor: ring }]}>
        <Avatar name={group.author.displayName} seed={group.author.username} size={34} />
      </View>
      <Text style={styles.name} numberOfLines={1}>{label}</Text>
    </Pressable>
  );
}

export function AddStatusCard({ me, onPress }: { me: PublicUser; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel="Add status" onPress={onPress} style={[styles.card, styles.addCard]}>
      <View style={styles.addAvatar}>
        <Avatar name={me.displayName} seed={me.username} size={56} />
        <View style={styles.plus}><Icon name="plus" color={colors.onRose} size={16} strokeWidth={2.6} /></View>
      </View>
      <Text style={[styles.name, { color: colors.ink }]}>My status</Text>
    </Pressable>
  );
}

const styles = themed(() => StyleSheet.create({
  card: { width: W, height: H, borderRadius: radius.md, overflow: 'hidden', backgroundColor: colors.surfaceMuted },
  addCard: { alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface },
  addAvatar: { marginBottom: 28 },
  plus: {
    position: 'absolute', right: -4, bottom: -4, width: 26, height: 26, borderRadius: 13, backgroundColor: colors.roseFill,
    alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: colors.surface,
  },
  shade: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.18)' },
  textPreview: { alignItems: 'center', justifyContent: 'center', padding: 10 },
  textPreviewText: { fontFamily: fonts.heavy, fontSize: 13, color: '#FFFFFF', textAlign: 'center' },
  ring: { position: 'absolute', top: 8, left: 8, borderWidth: 2.5, borderRadius: 22, padding: 2 },
  name: { position: 'absolute', left: 8, right: 8, bottom: 8, fontFamily: fonts.bold, fontSize: 13, color: '#FFFFFF' },
}));
