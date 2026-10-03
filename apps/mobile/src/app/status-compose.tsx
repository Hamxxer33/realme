import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Icon } from '../components/Icon';
import { notify } from '../lib/confirm';
import { STATUS_BACKGROUNDS, useStatusCrypto } from '../lib/status';
import { fonts, noWebOutline, radius, space, themed } from '../theme';

export default function StatusCompose() {
  const { photo: startWithPhoto } = useLocalSearchParams<{ photo?: string }>();
  const { postText, postPhoto } = useStatusCrypto();
  const [text, setText] = useState('');
  const [bg, setBg] = useState(STATUS_BACKGROUNDS[0]!);
  const [photo, setPhoto] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [caption, setCaption] = useState('');
  const [busy, setBusy] = useState(false);

  const pick = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.85, exif: false });
    if (!result.canceled && result.assets[0]) setPhoto(result.assets[0]);
    else if (startWithPhoto && !photo) router.back();
  };

  useEffect(() => {
    if (startWithPhoto) void pick();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const send = async () => {
    setBusy(true);
    try {
      const count = photo
        ? await postPhoto(photo.uri, { mime: photo.mimeType ?? 'image/jpeg', width: photo.width, height: photo.height }, caption.trim() || undefined)
        : await postText(text.trim(), bg);
      router.back();
      if (!count) notify('Status posted', 'Only you can see it for now — it goes to people you chat with.');
    } catch (e) {
      notify("Couldn't post status", e instanceof Error ? e.message : undefined);
      setBusy(false);
    }
  };

  const canSend = photo ? true : text.trim().length > 0;
  const nextBg = () => setBg(STATUS_BACKGROUNDS[(STATUS_BACKGROUNDS.indexOf(bg) + 1) % STATUS_BACKGROUNDS.length]!);

  return (
    <View style={[styles.screen, { backgroundColor: photo ? '#0D0809' : bg }]}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <SafeAreaView style={{ flex: 1 }}>
          <View style={styles.top}>
            <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={() => router.back()} hitSlop={12} style={styles.iconBtn}>
              <Icon name="close" color="#FFFFFF" />
            </Pressable>
            <View style={{ flex: 1 }} />
            {!photo ? (
              <>
                <Pressable accessibilityRole="button" accessibilityLabel="Change colour" onPress={nextBg} style={styles.iconBtn}>
                  <Icon name="palette" color="#FFFFFF" />
                </Pressable>
                <Pressable accessibilityRole="button" accessibilityLabel="Add a photo instead" onPress={() => void pick()} style={styles.iconBtn}>
                  <Icon name="image" color="#FFFFFF" />
                </Pressable>
              </>
            ) : null}
          </View>

          {photo ? (
            <View style={styles.preview}>
              <Image source={{ uri: photo.uri }} style={{ width: '100%', aspectRatio: photo.width / photo.height, maxHeight: '100%' }} contentFit="contain" />
            </View>
          ) : (
            <View style={styles.center}>
              <TextInput
                value={text}
                onChangeText={setText}
                placeholder="Type a status"
                placeholderTextColor="rgba(255,255,255,0.7)"
                multiline
                autoFocus
                maxLength={500}
                style={styles.input}
                accessibilityLabel="Status text"
              />
            </View>
          )}

          <View style={styles.bottom}>
            {photo ? (
              <TextInput
                value={caption}
                onChangeText={setCaption}
                placeholder="Add a caption"
                placeholderTextColor="rgba(255,255,255,0.7)"
                maxLength={300}
                style={styles.caption}
                accessibilityLabel="Caption"
              />
            ) : (
              <View style={styles.swatches}>
                {STATUS_BACKGROUNDS.map((c) => (
                  <Pressable key={c} accessibilityRole="radio" accessibilityState={{ checked: c === bg }} accessibilityLabel={`Colour ${c}`} onPress={() => setBg(c)}
                    style={[styles.swatch, { backgroundColor: c }, c === bg && styles.swatchOn]} />
                ))}
              </View>
            )}
            <Pressable accessibilityRole="button" accessibilityLabel="Post status" onPress={() => void send()} disabled={!canSend || busy} style={[styles.send, (!canSend || busy) && { opacity: 0.5 }]}>
              {busy ? <ActivityIndicator color="#2E1E24" /> : <Icon name="send" color="#2E1E24" strokeWidth={2.2} />}
            </Pressable>
          </View>
          <View style={styles.noteRow}>
            <Icon name="lock" color="rgba(255,255,255,0.85)" size={12} />
            <Text style={styles.note}>Visible for 24 hours to people you chat with · end-to-end encrypted</Text>
          </View>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = themed(() => StyleSheet.create({
  screen: { flex: 1 },
  top: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.sm, paddingTop: space.sm },
  iconBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  center: { flex: 1, justifyContent: 'center', paddingHorizontal: space.xl },
  input: { ...noWebOutline, fontFamily: fonts.heavy, fontSize: 30, lineHeight: 40, color: '#FFFFFF', textAlign: 'center' },
  preview: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  bottom: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.lg, paddingVertical: space.md },
  swatches: { flex: 1, flexDirection: 'row', gap: space.sm, flexWrap: 'wrap' },
  swatch: { width: 26, height: 26, borderRadius: 13, borderWidth: 2, borderColor: 'rgba(255,255,255,0.5)' },
  swatchOn: { borderColor: '#FFFFFF', transform: [{ scale: 1.15 }] },
  caption: { ...noWebOutline, flex: 1, minHeight: 48, borderRadius: radius.pill, paddingHorizontal: space.md, backgroundColor: 'rgba(255,255,255,0.16)', color: '#FFFFFF', fontFamily: fonts.regular, fontSize: 16 },
  send: { width: 54, height: 54, borderRadius: 27, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  noteRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingHorizontal: space.lg, paddingBottom: space.sm },
  note: { flexShrink: 1, fontFamily: fonts.medium, fontSize: 12, color: 'rgba(255,255,255,0.85)', textAlign: 'center' },
}));
