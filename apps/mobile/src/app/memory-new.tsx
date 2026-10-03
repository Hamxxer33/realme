import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { BackHeader } from '../components/BackHeader';
import { Icon } from '../components/Icon';
import { Button, ErrorText, Field, Screen } from '../components/ui';
import { parseDate } from '../lib/dates';
import { uploadEncrypted } from '../lib/media';
import { useMemories } from '../lib/memories';
import { colors, fonts, radius, space } from '../theme';

const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export default function NewMemory() {
  const { add } = useMemories();
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(today());
  const [note, setNote] = useState('');
  const [photo, setPhoto] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const pick = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8, exif: false });
    if (!result.canceled && result.assets[0]) setPhoto(result.assets[0]);
  };

  const save = async () => {
    setError(null);
    if (!title.trim()) return setError('Give this memory a title.');
    if (!parseDate(date)) return setError('Use the date format YYYY-MM-DD.');
    setBusy(true);
    try {
      const media = photo
        ? await uploadEncrypted(photo.uri, { mime: photo.mimeType ?? 'image/jpeg', width: photo.width, height: photo.height })
        : undefined;
      await add({ title: title.trim(), date, note: note.trim() || undefined, media });
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
      setBusy(false);
    }
  };

  return (
    <Screen>
      <BackHeader title="New memory" icon="close" />
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Pressable accessibilityRole="button" accessibilityLabel={photo ? 'Change photo' : 'Add a photo'} onPress={pick} style={styles.photo}>
          {photo ? (
            <Image source={{ uri: photo.uri }} style={StyleSheet.absoluteFill} contentFit="cover" />
          ) : (
            <>
              <Icon name="image" color={colors.rose} size={28} />
              <Text style={styles.photoText}>Add a photo</Text>
            </>
          )}
        </Pressable>
        <Field label="Title" value={title} onChangeText={setTitle} placeholder="Our first date" maxLength={80} />
        <Field label="Date" value={date} onChangeText={setDate} placeholder="YYYY-MM-DD" keyboardType="numbers-and-punctuation" maxLength={10} />
        <Field label="Note (optional)" value={note} onChangeText={setNote} multiline maxLength={1000} style={{ minHeight: 110, paddingTop: 14, textAlignVertical: 'top' }} />
        <ErrorText>{error}</ErrorText>
        <Button title="Save memory" onPress={save} loading={busy} />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { padding: space.lg, gap: space.md },
  photo: {
    height: 200,
    borderRadius: radius.lg,
    backgroundColor: colors.roseTint,
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
    overflow: 'hidden',
  },
  photoText: { fontFamily: fonts.bold, color: colors.rose, fontSize: 15 },
});
