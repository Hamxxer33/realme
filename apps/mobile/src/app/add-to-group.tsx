import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { GroupAvatar } from '../components/Avatar';
import { BackHeader } from '../components/BackHeader';
import { Screen } from '../components/ui';
import { api, type ConversationView } from '../lib/api';
import { notify } from '../lib/confirm';
import { upsert, useConversations } from '../lib/conversations';
import { colors, fonts, radius, space, themed } from '../theme';

/** Add one person to any group I administer. */
export default function AddToGroup() {
  const { userId, name } = useLocalSearchParams<{ userId: string; name: string }>();
  const { chats } = useConversations();
  const [busy, setBusy] = useState<string | null>(null);
  const groups = (chats ?? []).filter((c) => c.kind === 'group' && c.myRole === 'admin' && !c.members.some((m) => m.id === userId));

  const add = async (g: ConversationView) => {
    setBusy(g.id);
    try {
      const { conversation } = await api<{ conversation: ConversationView }>('POST', `/conversations/${g.id}/members`, { userIds: [userId] });
      upsert(conversation);
      router.back();
      notify(`Added ${name} to ${g.title}`);
    } catch (e) {
      notify("Couldn't add", e instanceof Error ? e.message : undefined);
      setBusy(null);
    }
  };

  return (
    <Screen>
      <BackHeader title={`Add ${name} to…`} icon="close" />
      <FlatList
        data={groups}
        keyExtractor={(g) => g.id}
        renderItem={({ item }) => (
          <Pressable accessibilityRole="button" accessibilityLabel={`Add to ${item.title}`} onPress={() => void add(item)} style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.surfaceMuted }]}>
            <GroupAvatar size={48} />
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>{item.title}</Text>
              <Text style={styles.sub}>{item.members.length} members</Text>
            </View>
            {busy === item.id ? <ActivityIndicator color={colors.rose} /> : <Text style={styles.add}>Add</Text>}
          </Pressable>
        )}
        ListEmptyComponent={<Text style={styles.empty}>You don't manage any groups {name} isn't already in.</Text>}
      />
    </Screen>
  );
}

const styles = themed(() => StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.lg, paddingVertical: 12 },
  title: { fontFamily: fonts.bold, fontSize: 16, color: colors.ink },
  sub: { fontFamily: fonts.regular, fontSize: 14, color: colors.inkMuted },
  add: { fontFamily: fonts.bold, fontSize: 14, color: colors.rose, backgroundColor: colors.roseTint, paddingHorizontal: 14, paddingVertical: 7, borderRadius: radius.pill, overflow: 'hidden' },
  empty: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 22, color: colors.inkMuted, textAlign: 'center', padding: space.xl },
}));
