import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Avatar } from '../components/Avatar';
import { BackHeader } from '../components/BackHeader';
import { Icon } from '../components/Icon';
import { Button, ErrorText, Screen } from '../components/ui';
import { api } from '../lib/api';
import { uploadPublic } from '../lib/media';
import { useSession } from '../lib/session';
import { colors, fonts, radius, space } from '../theme';

const MAX = 1000;

export default function Compose() {
  const { me } = useSession();
  const [text, setText] = useState('');
  const [photo, setPhoto] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pick = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8, exif: false });
    if (!result.canceled && result.assets[0]) setPhoto(result.assets[0]);
  };

  const share = async () => {
    setError(null);
    setBusy(true);
    try {
      const media = photo ? { objectKey: await uploadPublic(photo.uri), width: photo.width, height: photo.height } : undefined;
      await api('POST', '/posts', { text: text.trim(), media });
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
      setBusy(false);
    }
  };

  return (
    <Screen>
      <BackHeader title="New post" icon="close" />
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <View style={styles.row}>
          {me ? <Avatar name={me.displayName} seed={me.username} size={44} /> : null}
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder="What's on your mind?"
            placeholderTextColor={colors.inkMuted}
            multiline
            autoFocus
            maxLength={MAX}
            style={styles.input}
            accessibilityLabel="Post text"
          />
        </View>
        {photo ? (
          <View style={[styles.photo, { aspectRatio: photo.width / photo.height }]}>
            <Image source={{ uri: photo.uri }} style={StyleSheet.absoluteFill} contentFit="cover" />
            <Pressable accessibilityRole="button" accessibilityLabel="Remove photo" onPress={() => setPhoto(null)} style={styles.remove}>
              <Icon name="close" color="#FFFFFF" size={18} />
            </Pressable>
          </View>
        ) : null}
        <View style={styles.footer}>
          <Pressable accessibilityRole="button" accessibilityLabel="Add a photo" onPress={pick} style={styles.addPhoto}>
            <Icon name="image" color={colors.rose} />
            <Text style={styles.addPhotoText}>Photo</Text>
          </Pressable>
          <Text style={styles.counter}>{text.length}/{MAX}</Text>
        </View>
        <Text style={styles.note}>Posts are public: anyone on Realme can see them. Chats stay private.</Text>
        <ErrorText>{error}</ErrorText>
        <Button title="Share" onPress={share} loading={busy} disabled={!text.trim() && !photo} />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { padding: space.lg, gap: space.md },
  row: { flexDirection: 'row', gap: space.md, alignItems: 'flex-start' },
  input: { flex: 1, minHeight: 120, fontFamily: fonts.regular, fontSize: 18, lineHeight: 26, color: colors.ink, textAlignVertical: 'top', paddingTop: 8 },
  photo: { width: '100%', maxHeight: 420, borderRadius: radius.lg, overflow: 'hidden', backgroundColor: colors.surfaceMuted },
  remove: { position: 'absolute', top: 10, right: 10, width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(46,30,36,0.55)', alignItems: 'center', justifyContent: 'center' },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  addPhoto: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8, paddingHorizontal: 14, borderRadius: radius.pill, backgroundColor: colors.roseTint },
  addPhotoText: { fontFamily: fonts.bold, color: colors.rose, fontSize: 14 },
  counter: { fontFamily: fonts.medium, fontSize: 13, color: colors.inkMuted },
  note: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18, color: colors.inkMuted },
});
