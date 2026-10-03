import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { BackHeader } from '../components/BackHeader';
import { Icon } from '../components/Icon';
import { SearchField } from '../components/SearchField';
import { Button, ErrorText, Field, Screen } from '../components/ui';
import { UserRow } from '../components/UserRow';
import { api, type ConversationView, type PublicUser } from '../lib/api';
import { upsert, useConversation } from '../lib/conversations';
import { useUserSearch } from '../lib/useUserSearch';
import { colors, fonts, radius, space } from '../theme';

/** Create a group, or (with ?add=<conversationId>) add people to an existing one. */
export default function NewGroup() {
  const { add } = useLocalSearchParams<{ add?: string }>();
  const existing = useConversation(add);
  const [title, setTitle] = useState('');
  const [query, setQuery] = useState('');
  const [picked, setPicked] = useState<PublicUser[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const { results } = useUserSearch(query);
  const alreadyIn = new Set(existing?.members.map((m) => m.id) ?? []);

  const toggle = (u: PublicUser) =>
    setPicked((list) => (list.some((p) => p.id === u.id) ? list.filter((p) => p.id !== u.id) : [...list, u]));

  const submit = async () => {
    setError(null);
    if (!add && !title.trim()) return setError('Give the group a name.');
    if (!picked.length) return setError('Add at least one person.');
    setBusy(true);
    try {
      const { conversation } = add
        ? await api<{ conversation: ConversationView }>('POST', `/conversations/${add}/members`, { userIds: picked.map((p) => p.id) })
        : await api<{ conversation: ConversationView }>('POST', '/conversations/group', { title: title.trim(), memberIds: picked.map((p) => p.id) });
      upsert(conversation);
      if (add) router.back();
      else router.replace(`/chat/${conversation.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
      setBusy(false);
    }
  };

  return (
    <Screen>
      <BackHeader title={add ? 'Add people' : 'New group'} icon="close" />
      {!add ? (
        <View style={{ paddingHorizontal: space.lg }}>
          <Field label="Group name" value={title} onChangeText={setTitle} placeholder="Weekend crew" maxLength={60} />
        </View>
      ) : null}
      {picked.length ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips} style={{ flexGrow: 0 }}>
          {picked.map((p) => (
            <Pressable key={p.id} accessibilityRole="button" accessibilityLabel={`Remove ${p.displayName}`} onPress={() => toggle(p)} style={styles.chip}>
              <Text style={styles.chipText}>{p.displayName}</Text>
              <Icon name="close" color={colors.rose} size={14} strokeWidth={2} />
            </Pressable>
          ))}
        </ScrollView>
      ) : null}
      <SearchField value={query} onChangeText={setQuery} />
      <FlatList
        data={results.filter((u) => !alreadyIn.has(u.id))}
        keyExtractor={(u) => u.id}
        keyboardShouldPersistTaps="handled"
        renderItem={({ item }) => {
          const on = picked.some((p) => p.id === item.id);
          return (
            <UserRow user={item} onPress={() => toggle(item)} right={
              <View accessibilityRole="checkbox" accessibilityState={{ checked: on }} style={[styles.check, on && styles.checkOn]}>
                {on ? <Icon name="check" color={colors.onRose} size={16} strokeWidth={2.4} /> : null}
              </View>
            } />
          );
        }}
        ListEmptyComponent={<Text style={styles.hint}>{query.trim() ? 'No one found.' : 'Search for people to add.'}</Text>}
      />
      <View style={styles.footer}>
        <ErrorText>{error}</ErrorText>
        <Button title={add ? `Add ${picked.length || ''}`.trim() : `Create group${picked.length ? ` (${picked.length + 1})` : ''}`} onPress={submit} loading={busy} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  chips: { gap: space.sm, paddingHorizontal: space.lg, paddingTop: space.md },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: radius.pill, backgroundColor: colors.roseTint },
  chipText: { fontFamily: fonts.bold, fontSize: 14, color: colors.rose },
  check: { width: 26, height: 26, borderRadius: 13, borderWidth: 2, borderColor: colors.hairline, alignItems: 'center', justifyContent: 'center' },
  checkOn: { backgroundColor: colors.rose, borderColor: colors.rose },
  hint: { fontFamily: fonts.regular, fontSize: 15, color: colors.inkMuted, textAlign: 'center', padding: space.xl },
  footer: { padding: space.lg, gap: space.sm },
});
