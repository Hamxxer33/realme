import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Avatar } from '../components/Avatar';
import { BackHeader } from '../components/BackHeader';
import { Icon } from '../components/Icon';
import { Screen } from '../components/ui';
import { startCall } from '../lib/calls';
import { useConversations } from '../lib/conversations';
import { otherMembers } from '../lib/format';
import { useSession } from '../lib/session';
import { colors, fonts, noWebOutline, radius, shadow, space, themed } from '../theme';

/** Pick someone to call: people you have an accepted 1:1 chat with. */
export default function NewCall() {
  const { me } = useSession();
  const { chats } = useConversations();
  const [query, setQuery] = useState('');
  const contacts = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (chats ?? [])
      .filter((c) => c.kind === 'direct' && c.members.every((m) => m.status === 'accepted'))
      .map((c) => ({ conv: c, person: otherMembers(c, me?.id ?? '')[0]! }))
      .filter((x) => x.person && (!q || x.person.displayName.toLowerCase().includes(q) || x.person.username.includes(q)))
      .sort((a, b) => a.person.displayName.localeCompare(b.person.displayName));
  }, [chats, me?.id, query]);

  const call = (conversationId: string, kind: 'audio' | 'video') => {
    router.back();
    void startCall(conversationId, kind);
  };

  return (
    <Screen>
      <BackHeader title="New call" icon="close" />
      <View style={styles.search}>
        <Icon name="search" color={colors.inkMuted} size={20} />
        <TextInput value={query} onChangeText={setQuery} placeholder="Search contacts" placeholderTextColor={colors.inkMuted}
          autoCapitalize="none" style={styles.input} accessibilityLabel="Search contacts" />
      </View>
      <FlatList
        data={contacts}
        keyExtractor={(x) => x.conv.id}
        renderItem={({ item: { conv, person } }) => (
          <View style={styles.row}>
            <Avatar name={person.displayName} seed={person.username} size={48} />
            <View style={{ flex: 1 }}>
              <Text style={styles.name} numberOfLines={1}>{person.displayName}</Text>
              <Text style={styles.sub} numberOfLines={1}>@{person.username}</Text>
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel={`Voice call ${person.displayName}`} onPress={() => call(conv.id, 'audio')} style={styles.action}>
              <Icon name="phone" color={colors.rose} size={22} />
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel={`Video call ${person.displayName}`} onPress={() => call(conv.id, 'video')} style={styles.action}>
              <Icon name="video" color={colors.rose} size={22} />
            </Pressable>
          </View>
        )}
        ListEmptyComponent={<Text style={styles.empty}>You can call people once you've both accepted a chat.</Text>}
        contentContainerStyle={{ paddingBottom: space.xl }}
      />
    </Screen>
  );
}

const styles = themed(() => StyleSheet.create({
  search: {
    flexDirection: 'row', alignItems: 'center', gap: space.sm, height: 44, marginHorizontal: space.md, marginBottom: space.sm,
    paddingHorizontal: space.md, borderRadius: radius.pill, backgroundColor: colors.surface, ...shadow, shadowOpacity: 0.05,
  },
  input: { ...noWebOutline, flex: 1, height: '100%', fontFamily: fonts.regular, fontSize: 16, color: colors.ink },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.lg, paddingVertical: 10 },
  name: { fontFamily: fonts.bold, fontSize: 16, color: colors.ink },
  sub: { fontFamily: fonts.regular, fontSize: 14, color: colors.inkMuted },
  action: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.roseTint, alignItems: 'center', justifyContent: 'center' },
  empty: { fontFamily: fonts.regular, fontSize: 15, color: colors.inkMuted, textAlign: 'center', padding: space.xl },
}));
