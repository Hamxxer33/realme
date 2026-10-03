import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';
import { BackHeader } from '../components/BackHeader';
import { ConversationRow } from '../components/ConversationRow';
import { Section } from '../components/SettingsList';
import { Button, ErrorText, Field, Screen } from '../components/ui';
import { api, type ConversationView } from '../lib/api';
import { notify } from '../lib/confirm';
import { refreshConversation, upsert, useConversations } from '../lib/conversations';
import { colors, fonts, space, themed } from '../theme';

/** Admins: start a new group in the community, or bring in a group they already run. */
export default function CommunityGroupNew() {
  const { communityId } = useLocalSearchParams<{ communityId: string }>();
  const { chats } = useConversations();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const linkable = (chats ?? []).filter((c) => c.kind === 'group' && !c.community && c.myRole === 'admin');

  const create = async () => {
    setError(null);
    setBusy(true);
    try {
      const { conversation } = await api<{ conversation: ConversationView }>('POST', `/communities/${communityId}/groups`, {
        title: title.trim(), description: description.trim(),
      });
      upsert(conversation);
      router.replace(`/chat/${conversation.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      setBusy(false);
    }
  };

  const link = async (conv: ConversationView) => {
    try {
      await api('POST', `/communities/${communityId}/groups/link`, { conversationId: conv.id });
      await refreshConversation(conv.id);
      router.back();
    } catch (e) {
      notify("Couldn't add group", e instanceof Error ? e.message : undefined);
    }
  };

  return (
    <Screen>
      <BackHeader title="Add a group" icon="close" />
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Section title="New group">
          <Text style={styles.hint}>Community members can find and join it.</Text>
          <ScrollView scrollEnabled={false} contentContainerStyle={{ padding: space.md, gap: space.md }}>
            <Field label="Group name" value={title} onChangeText={setTitle} maxLength={60} />
            <Field label="Description (optional)" value={description} onChangeText={setDescription} maxLength={512} />
            <ErrorText>{error}</ErrorText>
            <Button title="Create group" onPress={() => void create()} loading={busy} disabled={!title.trim()} />
          </ScrollView>
        </Section>
        {linkable.length ? (
          <Section title="Or add a group you admin">
            {linkable.map((c) => <ConversationRow key={c.id} conv={c} onPress={() => void link(c)} />)}
          </Section>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

const styles = themed(() => StyleSheet.create({
  container: { padding: space.md, gap: space.lg },
  hint: { fontFamily: fonts.regular, fontSize: 14, color: colors.inkMuted, paddingHorizontal: space.md, paddingTop: space.sm },
}));
