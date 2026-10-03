import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Avatar } from '../components/Avatar';
import { Icon, type IconName } from '../components/Icon';
import { VideoView } from '../components/VideoView';
import { callErrorMessage, calls, formatDuration, useCall } from '../lib/calls';
import { notify } from '../lib/confirm';
import { fonts, space } from '../theme';

// The call screen keeps its own dark palette in both themes, like the photo viewer.
const BG = '#1B1218';
const INK = '#FFFFFF';
const MUTED = 'rgba(255,255,255,0.72)';
const RED = '#E5484D';
const GREEN = '#2EAD6B';

export default function CallScreen() {
  const state = useCall();
  const { phase, call, local, remote } = state;

  // Leave once the call is over (after the "Call ended" moment).
  useEffect(() => {
    if (phase === 'idle' && router.canGoBack()) router.back();
  }, [phase]);

  const elapsed = useElapsed(state.connectedAt);
  if (!call) return <View style={{ flex: 1, backgroundColor: BG }} />;

  const video = call.kind === 'video';
  const showRemoteVideo = video && remote && phase === 'active';
  const status =
    phase === 'incoming' ? (video ? 'Incoming video call' : 'Incoming voice call')
    : phase === 'outgoing' ? (call.status === 'ringing' ? 'Ringing…' : 'Calling…')
    : phase === 'connecting' ? 'Connecting…'
    : phase === 'active' ? formatDuration(elapsed)
    : state.endedLabel ?? 'Call ended';

  const run = (fn: () => Promise<void>) => () => fn().catch((e) => notify("Couldn't connect", callErrorMessage(e)));

  return (
    <View style={styles.root}>
      {showRemoteVideo ? <VideoView stream={remote} style={StyleSheet.absoluteFill} /> : null}
      {/* Voice calls still need the remote stream mounted to hear it on the web. */}
      {!showRemoteVideo && remote ? <VideoView stream={remote} style={styles.hidden} /> : null}
      {showRemoteVideo ? <View style={styles.videoShade} /> : null}

      <SafeAreaView style={styles.safe}>
        <View style={styles.top}>
          <View style={styles.e2ee}>
            <Icon name="lock" color={MUTED} size={13} />
            <Text style={styles.e2eeText}>End-to-end encrypted</Text>
          </View>
          {!showRemoteVideo ? <Pulse active={phase === 'incoming' || phase === 'outgoing'}><Avatar name={call.peer.displayName} seed={call.peer.username} size={128} /></Pulse> : null}
          <Text accessibilityRole="header" style={[styles.name, showRemoteVideo && styles.nameSmall]}>{call.peer.displayName}</Text>
          <Text accessibilityLiveRegion="polite" style={styles.status}>{status}</Text>
        </View>

        {video && local && !state.cameraOff && phase !== 'ended' ? (
          <View style={[styles.pip, phase === 'active' ? null : styles.pipLarge]}>
            <VideoView stream={local} mirror muted style={StyleSheet.absoluteFill} />
          </View>
        ) : null}

        <View style={styles.controls}>
          {phase === 'incoming' ? (
            <View style={styles.answerRow}>
              <Round icon="phone" label="Decline" color={RED} rotate onPress={run(() => calls.hangUp())} big />
              <Round icon={video ? 'video' : 'phone'} label="Accept" color={GREEN} onPress={run(() => calls.accept())} big />
            </View>
          ) : phase === 'ended' ? null : (
            <View style={styles.row}>
              <Round icon={state.muted ? 'micOff' : 'mic'} label={state.muted ? 'Unmute' : 'Mute'} on={state.muted} onPress={() => calls.toggleMute()} />
              {video ? <Round icon={state.cameraOff ? 'videoOff' : 'video'} label={state.cameraOff ? 'Turn camera on' : 'Turn camera off'} on={state.cameraOff} onPress={() => calls.toggleCamera()} /> : null}
              {video && Platform.OS !== 'web' ? <Round icon="flip" label="Flip camera" onPress={() => calls.flipCamera()} /> : null}
              <Round icon="phone" label="End call" color={RED} rotate onPress={run(() => calls.hangUp())} />
            </View>
          )}
        </View>
      </SafeAreaView>
    </View>
  );
}

function useElapsed(since: number | null) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!since) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [since]);
  return since ? Math.max(0, Math.floor((now - since) / 1000)) : 0;
}

function Pulse({ active, children }: { active: boolean; children: React.ReactNode }) {
  const scale = useSharedValue(1);
  useEffect(() => {
    scale.value = active ? withRepeat(withSequence(withTiming(1.06, { duration: 700 }), withTiming(1, { duration: 700 })), -1) : withTiming(1);
  }, [active, scale]);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return <Animated.View style={[styles.avatarRing, style]}>{children}</Animated.View>;
}

function Round({ icon, label, onPress, color, on, rotate, big }: {
  icon: IconName; label: string; onPress: () => void; color?: string; on?: boolean; rotate?: boolean; big?: boolean;
}) {
  const size = big ? 76 : 64;
  return (
    <View style={styles.roundWrap}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={on !== undefined ? { selected: on } : undefined}
        onPress={onPress}
        style={({ pressed }) => [
          styles.round,
          { width: size, height: size, borderRadius: size / 2, backgroundColor: color ?? (on ? INK : 'rgba(255,255,255,0.16)') },
          pressed && { transform: [{ scale: 0.94 }] },
        ]}
      >
        <View style={rotate ? { transform: [{ rotate: '135deg' }] } : undefined}>
          <Icon name={icon} color={!color && on ? BG : INK} size={big ? 32 : 26} />
        </View>
      </Pressable>
      {big ? <Text style={styles.roundLabel}>{label}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },
  hidden: { position: 'absolute', width: 1, height: 1, opacity: 0 },
  videoShade: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.18)' },
  safe: { flex: 1, justifyContent: 'space-between' },
  top: { alignItems: 'center', paddingTop: space.lg, gap: space.sm },
  e2ee: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: space.xl },
  e2eeText: { fontFamily: fonts.medium, fontSize: 13, color: MUTED },
  avatarRing: { padding: 6, borderRadius: 80, borderWidth: 2, borderColor: 'rgba(255,255,255,0.18)', marginBottom: space.md },
  name: { fontFamily: fonts.heavy, fontSize: 30, color: INK, textAlign: 'center', paddingHorizontal: space.lg },
  nameSmall: { fontSize: 22 },
  status: { fontFamily: fonts.medium, fontSize: 16, color: MUTED, fontVariant: ['tabular-nums'] },
  pip: { position: 'absolute', right: space.lg, top: 110, width: 110, height: 160, borderRadius: 18, overflow: 'hidden', backgroundColor: '#000' },
  pipLarge: { width: 132, height: 192 },
  controls: { paddingBottom: space.xl, paddingHorizontal: space.lg },
  row: { flexDirection: 'row', justifyContent: 'center', gap: space.lg, padding: space.md, borderRadius: 44, backgroundColor: 'rgba(0,0,0,0.28)', alignSelf: 'center' },
  answerRow: { flexDirection: 'row', justifyContent: 'space-around' },
  roundWrap: { alignItems: 'center', gap: space.sm },
  round: { alignItems: 'center', justifyContent: 'center' },
  roundLabel: { fontFamily: fonts.bold, fontSize: 14, color: INK },
});
