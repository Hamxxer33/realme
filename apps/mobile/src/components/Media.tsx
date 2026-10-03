import type { MediaRef } from '@realme/crypto';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { localUriFor } from '../lib/media';
import { colors, fonts, radius, themed } from '../theme';
import { Icon } from './Icon';

function useDecrypted(media: MediaRef) {
  const [uri, setUri] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let alive = true;
    localUriFor(media).then((u) => alive && setUri(u), () => alive && setFailed(true));
    return () => {
      alive = false;
    };
  }, [media.objectKey]); // eslint-disable-line react-hooks/exhaustive-deps
  return { uri, failed };
}

export function EncryptedImage({ media, maxWidth, onPress }: { media: MediaRef; maxWidth: number; onPress?: (uri: string) => void }) {
  const { uri, failed } = useDecrypted(media);
  const ratio = media.width && media.height ? media.width / media.height : 4 / 5;
  const width = maxWidth;
  const height = Math.min(width / ratio, maxWidth * 1.4);
  return (
    <Pressable
      accessibilityRole="imagebutton"
      accessibilityLabel="Photo"
      disabled={!uri}
      onPress={() => uri && onPress?.(uri)}
      style={[styles.imageBox, { width, height }]}
    >
      {uri ? (
        <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="cover" transition={220} />
      ) : failed ? (
        <Icon name="alert" color={colors.inkMuted} />
      ) : (
        <ActivityIndicator color={colors.rose} />
      )}
    </Pressable>
  );
}

const formatDuration = (sec: number) => `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, '0')}`;

export function VoiceNote({ media, durationMs, mine }: { media: MediaRef; durationMs: number; mine: boolean }) {
  const { uri, failed } = useDecrypted(media);
  const player = useAudioPlayer(uri ? { uri } : null);
  const status = useAudioPlayerStatus(player);
  const total = status.duration || durationMs / 1000;
  const progress = total ? Math.min(1, status.currentTime / total) : 0;
  const fg = mine ? colors.onRose : colors.rose;

  useEffect(() => {
    if (status.didJustFinish) {
      player.pause();
      void player.seekTo(0);
    }
  }, [status.didJustFinish, player]);

  return (
    <View style={styles.voice}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={status.playing ? 'Pause voice note' : 'Play voice note'}
        disabled={!uri}
        onPress={() => (status.playing ? player.pause() : player.play())}
        style={[styles.playButton, { backgroundColor: mine ? 'rgba(255,255,255,0.22)' : colors.roseTint }]}
      >
        {uri ? <Icon name={status.playing ? 'pause' : 'play'} color={fg} size={20} filled={!status.playing} />
          : failed ? <Icon name="alert" color={fg} size={20} />
          : <ActivityIndicator color={fg} />}
      </Pressable>
      <View style={styles.track}>
        <View style={[styles.trackBg, { backgroundColor: mine ? 'rgba(255,255,255,0.3)' : colors.roseSoft }]} />
        <View style={[styles.trackFill, { width: `${progress * 100}%`, backgroundColor: fg }]} />
      </View>
      <Text style={[styles.duration, { color: mine ? colors.onRoseMuted : colors.inkMuted }]}>
        {formatDuration(status.playing ? status.currentTime : total)}
      </Text>
    </View>
  );
}

const styles = themed(() => StyleSheet.create({
  imageBox: {
    borderRadius: radius.md - 4,
    overflow: 'hidden',
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  voice: { flexDirection: 'row', alignItems: 'center', gap: 10, minWidth: 200 },
  playButton: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  track: { flex: 1, height: 4, justifyContent: 'center' },
  trackBg: { ...StyleSheet.absoluteFill, borderRadius: 2 },
  trackFill: { height: 4, borderRadius: 2 },
  duration: { fontFamily: fonts.medium, fontSize: 13, fontVariant: ['tabular-nums'], minWidth: 34, textAlign: 'right' },
}));
