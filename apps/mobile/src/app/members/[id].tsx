import { useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, StyleSheet, Text, TextInput, View } from 'react-native';
import { BackHeader } from '../../components/BackHeader';
import { MemberRow, MemberSheet, sortMembers } from '../../components/GroupMembers';
import { Icon } from '../../components/Icon';
import { Screen } from '../../components/ui';
import type { MemberView } from '../../lib/api';
import { useConversation } from '../../lib/conversations';
import { useSession } from '../../lib/session';
import { colors, fonts, noWebOutline, radius, shadow, space, themed } from '../../theme';

/** Every member of a group, searchable. */
export default function Members() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const conv = useConversation(id);
  const { me } = useSession();
  const myId = me?.id ?? '';
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<MemberView | null>(null);

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    const all = conv ? sortMembers(conv.members, myId) : [];
    return q ? all.filter((m) => m.displayName.toLowerCase().includes(q) || m.username.includes(q)) : all;
  }, [conv, myId, query]);

  if (!conv) return <Screen><BackHeader title="Members" /></Screen>;
  return (
    <Screen>
      <BackHeader title={`${conv.members.length} members`} />
      <View style={styles.search}>
        <Icon name="search" color={colors.inkMuted} size={20} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search members"
          placeholderTextColor={colors.inkMuted}
          autoCapitalize="none"
          style={styles.input}
          accessibilityLabel="Search members"
        />
      </View>
      <FlatList
        data={list}
        keyExtractor={(m) => m.id}
        renderItem={({ item }) => <MemberRow member={item} myId={myId} onPress={item.id === myId ? undefined : () => setSelected(item)} />}
        ListEmptyComponent={<Text style={styles.empty}>No one matches “{query}”.</Text>}
        contentContainerStyle={{ paddingBottom: space.xl }}
      />
      <MemberSheet conv={conv} member={selected} myId={myId} onClose={() => setSelected(null)} />
    </Screen>
  );
}

const styles = themed(() => StyleSheet.create({
  search: {
    flexDirection: 'row', alignItems: 'center', gap: space.sm, height: 44, marginHorizontal: space.md, marginBottom: space.sm,
    paddingHorizontal: space.md, borderRadius: radius.pill, backgroundColor: colors.surface, ...shadow, shadowOpacity: 0.05,
  },
  input: { ...noWebOutline, flex: 1, height: '100%', fontFamily: fonts.regular, fontSize: 16, color: colors.ink },
  empty: { fontFamily: fonts.regular, fontSize: 15, color: colors.inkMuted, textAlign: 'center', marginTop: space.xl },
}));
