import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from 'react-native';
import { BackHeader } from '../components/BackHeader';
import { SearchField } from '../components/SearchField';
import { Screen } from '../components/ui';
import { UserRow } from '../components/UserRow';
import { api, type ConversationView, type PublicUser } from '../lib/api';
import { notify } from '../lib/confirm';
import { upsert } from '../lib/conversations';
import { useUserSearch } from '../lib/useUserSearch';
import { colors, fonts, space, themed } from '../theme';

export default function NewChat() {
  const [query, setQuery] = useState('');
  const { results, searching } = useUserSearch(query);
  const [opening, setOpening] = useState<string | null>(null);

  const open = async (user: PublicUser) => {
    setOpening(user.id);
    try {
      const { conversation } = await api<{ conversation: ConversationView }>('POST', '/conversations/direct', { userId: user.id });
      upsert(conversation);
      router.replace(`/chat/${conversation.id}`);
    } catch (e) {
      notify("Couldn't start chat", e instanceof Error ? e.message : undefined);
      setOpening(null);
    }
  };

  return (
    <Screen>
      <BackHeader title="New chat" icon="close" />
      <SearchField value={query} onChangeText={setQuery} autoFocus />
      <FlatList
        data={results}
        keyExtractor={(u) => u.id}
        keyboardShouldPersistTaps="handled"
        renderItem={({ item }) => (
          <UserRow user={item} onPress={() => void open(item)} right={opening === item.id ? <ActivityIndicator color={colors.rose} /> : null} />
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            {searching ? <ActivityIndicator color={colors.rose} /> : (
              <Text style={styles.emptyText}>
                {query.trim() ? 'No one found. Check the spelling of their @username.' : 'Type a @username to find someone.'}
              </Text>
            )}
          </View>
        }
      />
    </Screen>
  );
}

const styles = themed(() => StyleSheet.create({
  empty: { padding: space.xl, alignItems: 'center' },
  emptyText: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 22, color: colors.inkMuted, textAlign: 'center' },
}));
