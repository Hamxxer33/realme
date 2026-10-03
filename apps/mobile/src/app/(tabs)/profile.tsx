import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Avatar } from '../../components/Avatar';
import { Icon, type IconName } from '../../components/Icon';
import { Button, Card, ErrorText, Field, Screen } from '../../components/ui';
import { api, type Me } from '../../lib/api';
import { confirm, notify } from '../../lib/confirm';
import { useSession } from '../../lib/session';
import { colors, fonts, space } from '../../theme';

export default function Profile() {
  const { me, setMe, signOut } = useSession();
  const [editing, setEditing] = useState(false);
  const [displayName, setDisplayName] = useState(me?.displayName ?? '');
  const [bio, setBio] = useState(me?.bio ?? '');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  if (!me) return null;

  const save = async () => {
    setError(null);
    if (!displayName.trim()) return setError('Your name can’t be empty.');
    setSaving(true);
    try {
      const { user } = await api<{ user: Me }>('PATCH', '/me', { displayName: displayName.trim(), bio: bio.trim() });
      setMe(user);
      setEditing(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      setSaving(false);
    }
  };

  const deleteAccount = async () => {
    const ok = await confirm('Delete your account?', 'Your profile, posts and messages will be permanently deleted.', 'Delete');
    if (!ok) return;
    try {
      await api('DELETE', '/me');
      await signOut();
    } catch {
      notify("Couldn't delete account", 'Please try again.');
    }
  };

  return (
    <Screen edges={['top']}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.hero}>
          <Avatar name={me.displayName} seed={me.username} size={88} />
          <Text accessibilityRole="header" style={styles.name}>{me.displayName}</Text>
          <Text style={styles.handle}>@{me.username}</Text>
          {me.bio ? <Text style={styles.bio}>{me.bio}</Text> : null}
        </View>

        {editing ? (
          <Card style={{ gap: space.md }}>
            <Field label="Name" value={displayName} onChangeText={setDisplayName} maxLength={40} />
            <Field label="Bio" value={bio} onChangeText={setBio} maxLength={160} multiline style={{ minHeight: 80, paddingTop: 14, textAlignVertical: 'top' }} />
            <ErrorText>{error}</ErrorText>
            <Button title="Save" onPress={save} loading={saving} />
            <Button title="Cancel" variant="ghost" onPress={() => setEditing(false)} />
          </Card>
        ) : (
          <Card style={styles.menu}>
            <Row icon="edit" label="Edit profile" onPress={() => setEditing(true)} />
            <Row icon="feed" label="My posts" onPress={() => router.push(`/user/${me.username}`)} />
            <Row icon="block" label="Blocked people" onPress={() => router.push('/blocked')} />
          </Card>
        )}

        <Card style={styles.menu}>
          <View style={styles.lockRow}>
            <Icon name="lock" size={18} color={colors.rose} />
            <Text style={styles.lockText}>
              Your chats are end-to-end encrypted. Your password unlocks your key, so if you forget it your messages can't be recovered.
            </Text>
          </View>
        </Card>

        <View style={{ gap: space.xs }}>
          <Button title="Sign out" variant="ghost" onPress={() => void signOut()} />
          <Button title="Delete account" variant="ghost" onPress={deleteAccount} />
        </View>
      </ScrollView>
    </Screen>
  );
}

function Row({ icon, label, onPress }: { icon: IconName; label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.row, pressed && { opacity: 0.6 }]}>
      <Icon name={icon} color={colors.ink} size={22} />
      <Text style={styles.rowText}>{label}</Text>
      <View style={{ transform: [{ rotate: '180deg' }] }}><Icon name="back" color={colors.inkMuted} size={18} /></View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { padding: space.lg, gap: space.lg },
  hero: { alignItems: 'center', gap: 4, paddingVertical: space.md },
  name: { fontFamily: fonts.heavy, fontSize: 26, color: colors.ink, marginTop: space.sm },
  handle: { fontFamily: fonts.medium, fontSize: 15, color: colors.inkMuted },
  bio: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 22, color: colors.ink, textAlign: 'center', marginTop: space.sm },
  menu: { paddingVertical: space.sm, paddingHorizontal: space.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 52 },
  rowText: { flex: 1, fontFamily: fonts.bold, fontSize: 16, color: colors.ink },
  lockRow: { flexDirection: 'row', gap: space.md, paddingVertical: space.sm },
  lockText: { flex: 1, fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, color: colors.inkMuted },
});
