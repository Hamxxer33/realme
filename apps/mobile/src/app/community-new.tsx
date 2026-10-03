import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { CommunityAvatar } from '../components/Avatar';
import { BackHeader } from '../components/BackHeader';
import { Button, ErrorText, Field, Screen } from '../components/ui';
import { api, type CommunityView } from '../lib/api';
import { refreshConversations } from '../lib/conversations';
import { colors, fonts, space, themed } from '../theme';

/** Start a community, or edit one (`?id=`). */
export default function CommunityNew() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!id) return;
    api<{ community: CommunityView }>('GET', `/communities/${id}`).then(({ community }) => {
      setName(community.name);
      setDescription(community.description);
    }, () => {});
  }, [id]);

  const save = async () => {
    setError(null);
    setBusy(true);
    try {
      const body = { name: name.trim(), description: description.trim() };
      if (id) {
        await api('PATCH', `/communities/${id}`, body);
        router.back();
      } else {
        const { community } = await api<{ community: CommunityView }>('POST', '/communities', body);
        await refreshConversations().catch(() => {});
        router.replace(`/community/${community.id}`);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <BackHeader title={id ? 'Edit community' : 'New community'} icon="close" />
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        {!id ? (
          <View style={styles.intro}>
            <CommunityAvatar size={84} />
            <Text style={styles.introText}>
              Bring related groups together, with one announcements chat for everyone. Only admins post announcements; members can join any group in the community.
            </Text>
          </View>
        ) : null}
        <Field label="Community name" value={name} onChangeText={setName} maxLength={60} autoFocus={!id} />
        <Field
          label="Description"
          value={description}
          onChangeText={setDescription}
          maxLength={512}
          multiline
          placeholder="What's this community about?"
          style={{ minHeight: 110, textAlignVertical: 'top', paddingTop: 14 }}
        />
        <ErrorText>{error}</ErrorText>
        <Button title={id ? 'Save' : 'Create community'} onPress={() => void save()} loading={busy} disabled={!name.trim()} />
      </ScrollView>
    </Screen>
  );
}

const styles = themed(() => StyleSheet.create({
  container: { padding: space.lg, gap: space.md },
  intro: { alignItems: 'center', gap: space.md, marginBottom: space.sm },
  introText: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, color: colors.inkMuted, textAlign: 'center' },
}));
