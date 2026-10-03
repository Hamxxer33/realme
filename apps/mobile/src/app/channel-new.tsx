import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { BackHeader } from '../components/BackHeader';
import { Icon } from '../components/Icon';
import { Button, ErrorText, Field, Screen } from '../components/ui';
import { api, type ChannelView } from '../lib/api';
import { colors, fonts, space, themed } from '../theme';

/** Create a channel, or edit one (`?id=`). */
export default function ChannelNew() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!id) return;
    api<{ channel: ChannelView }>('GET', `/channels/${id}`).then(({ channel }) => {
      setName(channel.name);
      setDescription(channel.description);
    }, () => {});
  }, [id]);

  const save = async () => {
    setError(null);
    setBusy(true);
    try {
      const body = { name: name.trim(), description: description.trim() };
      if (id) {
        await api('PATCH', `/channels/${id}`, body);
        router.back();
      } else {
        const { channel } = await api<{ channel: ChannelView }>('POST', '/channels', body);
        router.replace(`/channel/${channel.id}`);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <BackHeader title={id ? 'Edit channel' : 'New channel'} icon="close" />
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        {!id ? (
          <View style={styles.intro}>
            <View style={styles.icon}><Icon name="broadcast" color={colors.rose} size={30} /></View>
            <Text style={styles.introText}>
              Share updates with anyone who follows. Channels are public — they aren't end-to-end encrypted, and followers can't reply, only react.
            </Text>
          </View>
        ) : null}
        <Field label="Channel name" value={name} onChangeText={setName} maxLength={60} autoFocus={!id} />
        <Field
          label="Description"
          value={description}
          onChangeText={setDescription}
          maxLength={512}
          multiline
          placeholder="What will you post about?"
          style={{ minHeight: 110, textAlignVertical: 'top', paddingTop: 14 }}
        />
        <ErrorText>{error}</ErrorText>
        <Button title={id ? 'Save' : 'Create channel'} onPress={() => void save()} loading={busy} disabled={!name.trim()} />
      </ScrollView>
    </Screen>
  );
}

const styles = themed(() => StyleSheet.create({
  container: { padding: space.lg, gap: space.md },
  intro: { alignItems: 'center', gap: space.md, marginBottom: space.sm },
  icon: { width: 72, height: 72, borderRadius: 36, backgroundColor: colors.roseTint, alignItems: 'center', justifyContent: 'center' },
  introText: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, color: colors.inkMuted, textAlign: 'center' },
}));
