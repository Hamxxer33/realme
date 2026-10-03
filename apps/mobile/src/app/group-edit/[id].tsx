import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';
import { BackHeader } from '../../components/BackHeader';
import { Button, ErrorText, Field, Screen } from '../../components/ui';
import { api, type ConversationView } from '../../lib/api';
import { upsert, useConversation } from '../../lib/conversations';
import { colors, fonts, space, themed } from '../../theme';

const MAX_DESCRIPTION = 512;

/** Edit a group's name and description. */
export default function GroupEdit() {
  const { id, focus } = useLocalSearchParams<{ id: string; focus?: string }>();
  const conv = useConversation(id);
  const [title, setTitle] = useState(conv?.title ?? '');
  const [description, setDescription] = useState(conv?.description ?? '');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setError(null);
    setBusy(true);
    try {
      const { conversation } = await api<{ conversation: ConversationView }>('PATCH', `/conversations/${id}`, {
        title: title.trim(), description: description.trim(),
      });
      upsert(conversation);
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <BackHeader title="Edit group" />
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Field label="Group name" value={title} onChangeText={setTitle} maxLength={60} autoFocus={focus !== 'description'} />
        <Field
          label="Description"
          value={description}
          onChangeText={setDescription}
          maxLength={MAX_DESCRIPTION}
          multiline
          placeholder="What's this group about?"
          autoFocus={focus === 'description'}
          style={{ minHeight: 120, textAlignVertical: 'top', paddingTop: 14 }}
        />
        <Text style={styles.counter}>{description.length}/{MAX_DESCRIPTION}</Text>
        <ErrorText>{error}</ErrorText>
        <Button title="Save" onPress={() => void save()} loading={busy} disabled={!title.trim()} />
      </ScrollView>
    </Screen>
  );
}

const styles = themed(() => StyleSheet.create({
  container: { padding: space.lg, gap: space.md },
  counter: { fontFamily: fonts.medium, fontSize: 13, color: colors.inkMuted, textAlign: 'right', marginTop: -space.sm },
}));
