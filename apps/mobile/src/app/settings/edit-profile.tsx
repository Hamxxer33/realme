import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Avatar } from '../../components/Avatar';
import { BackHeader } from '../../components/BackHeader';
import { Button, ErrorText, Field, Screen } from '../../components/ui';
import { api, type Me } from '../../lib/api';
import { useSession } from '../../lib/session';
import { colors, fonts, space, themed } from '../../theme';

export default function EditProfile() {
  const { me, setMe } = useSession();
  const [displayName, setDisplayName] = useState(me?.displayName ?? '');
  const [bio, setBio] = useState(me?.bio ?? '');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  if (!me) return null;

  const save = async () => {
    setError(null);
    if (!displayName.trim()) return setError("Your name can't be empty.");
    setSaving(true);
    try {
      const { user } = await api<{ user: Me }>('PATCH', '/me', { displayName: displayName.trim(), bio: bio.trim() });
      setMe(user);
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
      setSaving(false);
    }
  };

  return (
    <Screen>
      <BackHeader title="Edit profile" />
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <View style={styles.hero}>
          <Avatar name={displayName || me.displayName} seed={me.username} size={96} />
          <Text style={styles.handle}>@{me.username}</Text>
        </View>
        <Field label="Name" value={displayName} onChangeText={setDisplayName} maxLength={40} />
        <Field label="Bio" value={bio} onChangeText={setBio} maxLength={160} multiline placeholder="A little about you" style={{ minHeight: 90, paddingTop: 14, textAlignVertical: 'top' }} />
        <Text style={styles.count}>{bio.length}/160</Text>
        <ErrorText>{error}</ErrorText>
        <Button title="Save" onPress={save} loading={saving} />
      </ScrollView>
    </Screen>
  );
}

const styles = themed(() => StyleSheet.create({
  container: { padding: space.lg, gap: space.md },
  hero: { alignItems: 'center', gap: space.sm, marginBottom: space.md },
  handle: { fontFamily: fonts.medium, fontSize: 15, color: colors.inkMuted },
  count: { fontFamily: fonts.medium, fontSize: 12, color: colors.inkMuted, textAlign: 'right', marginTop: -8 },
}));
