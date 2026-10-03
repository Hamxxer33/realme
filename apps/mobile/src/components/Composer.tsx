import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import { Alert, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, { FadeIn, FadeOut, useAnimatedStyle, useSharedValue, withSequence, withSpring } from 'react-native-reanimated';
import { colors, fonts, motion, radius, shadow, space } from '../theme';
import { Icon } from './Icon';
import { PressScale } from './ui';

const MAX_TEXT = 4000;
const MIN_VOICE_MS = 700;

export function Composer({ onSendText, onSendNudge, onSendImage, onSendVoice, onTyping }: {
  onSendText: (text: string) => void;
  onSendNudge: () => void;
  onSendImage: (uri: string, meta: { mime: string; width: number; height: number }) => Promise<void>;
  onSendVoice: (uri: string, durationMs: number) => Promise<void>;
  onTyping: () => void;
}) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState<null | 'image' | 'voice'>(null);
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recState = useAudioRecorderState(recorder, 200);
  const recording = recState.isRecording;

  const heart = useSharedValue(1);
  const heartStyle = useAnimatedStyle(() => ({ transform: [{ scale: heart.value }] }));

  const sendText = () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    onSendText(trimmed);
    setText('');
  };

  const sendNudge = () => {
    heart.value = withSequence(withSpring(1.35, motion.spring), withSpring(1, motion.spring));
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onSendNudge();
  };

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8, exif: false });
    const asset = result.canceled ? null : result.assets[0];
    if (!asset) return;
    setBusy('image');
    try {
      await onSendImage(asset.uri, { mime: asset.mimeType ?? 'image/jpeg', width: asset.width, height: asset.height });
    } catch {
      Alert.alert("Couldn't send photo", 'Please try again.');
    } finally {
      setBusy(null);
    }
  };

  const startRecording = async () => {
    const { granted } = await requestRecordingPermissionsAsync();
    if (!granted) {
      Alert.alert('Microphone access needed', 'Allow microphone access in Settings to send voice notes.');
      return;
    }
    await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
    await recorder.prepareToRecordAsync();
    recorder.record();
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const stopRecording = async (send: boolean) => {
    const durationMs = Math.round(recState.durationMillis);
    await recorder.stop();
    await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
    const uri = recorder.uri;
    if (!send || !uri || durationMs < MIN_VOICE_MS) return;
    setBusy('voice');
    try {
      await onSendVoice(uri, durationMs);
    } catch {
      Alert.alert("Couldn't send voice note", 'Please try again.');
    } finally {
      setBusy(null);
    }
  };

  if (recording) {
    const secs = Math.floor(recState.durationMillis / 1000);
    return (
      <Animated.View entering={FadeIn} exiting={FadeOut} style={styles.bar}>
        <PressScale accessibilityRole="button" accessibilityLabel="Cancel recording" onPress={() => stopRecording(false)} style={styles.iconButton}>
          <Icon name="trash" color={colors.inkMuted} />
        </PressScale>
        <View style={[styles.inputShell, styles.recordingShell]}>
          <View style={styles.recDot} />
          <Text style={styles.recText}>Recording… {Math.floor(secs / 60)}:{String(secs % 60).padStart(2, '0')}</Text>
        </View>
        <PressScale accessibilityRole="button" accessibilityLabel="Send voice note" onPress={() => stopRecording(true)} style={styles.sendButton}>
          <Icon name="send" color={colors.onRose} strokeWidth={2} />
        </PressScale>
      </Animated.View>
    );
  }

  const hasText = text.trim().length > 0;
  return (
    <View style={styles.bar}>
      <PressScale accessibilityRole="button" accessibilityLabel="Send a photo" onPress={pickImage} disabled={!!busy} style={styles.iconButton}>
        <Icon name="image" color={colors.inkMuted} />
      </PressScale>
      <View style={styles.inputShell}>
        <TextInput
          value={text}
          onChangeText={(t) => {
            setText(t);
            if (t) onTyping();
          }}
          placeholder={busy ? (busy === 'image' ? 'Sending photo…' : 'Sending voice note…') : 'Say something sweet'}
          placeholderTextColor={colors.inkMuted}
          multiline
          maxLength={MAX_TEXT}
          style={styles.input}
          accessibilityLabel="Message"
        />
        <PressScale accessibilityRole="button" accessibilityLabel="Send a heart: thinking of you" onPress={sendNudge} style={styles.heartButton}>
          <Animated.View style={heartStyle}>
            <Icon name="heart" color={colors.rose} filled size={22} />
          </Animated.View>
        </PressScale>
      </View>
      {hasText ? (
        <PressScale accessibilityRole="button" accessibilityLabel="Send message" onPress={sendText} style={styles.sendButton}>
          <Icon name="send" color={colors.onRose} strokeWidth={2} />
        </PressScale>
      ) : (
        <PressScale accessibilityRole="button" accessibilityLabel="Record a voice note" onPress={startRecording} disabled={!!busy} style={styles.sendButton}>
          <Icon name="mic" color={colors.onRose} />
        </PressScale>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: space.sm,
    paddingHorizontal: space.md,
    paddingTop: space.sm,
    paddingBottom: space.sm,
    backgroundColor: colors.bg,
  },
  iconButton: { width: 44, height: 48, alignItems: 'center', justifyContent: 'center' },
  inputShell: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-end',
    minHeight: 48,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    paddingLeft: space.md,
    ...shadow,
    shadowOpacity: 0.06,
  },
  input: {
    flex: 1,
    maxHeight: 140,
    paddingTop: 13,
    paddingBottom: 13,
    fontFamily: fonts.regular,
    fontSize: 16,
    color: colors.ink,
  },
  heartButton: { width: 44, height: 48, alignItems: 'center', justifyContent: 'center' },
  sendButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.rose,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow,
  },
  recordingShell: { alignItems: 'center', gap: space.sm, paddingRight: space.md },
  recDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.rose },
  recText: { fontFamily: fonts.medium, fontSize: 15, color: colors.ink, fontVariant: ['tabular-nums'] },
});
