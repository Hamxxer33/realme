import { router } from 'expo-router';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { BackHeader } from '../components/BackHeader';
import { ConversationRow } from '../components/ConversationRow';
import { Icon } from '../components/Icon';
import { Screen } from '../components/ui';
import { useConversations } from '../lib/conversations';
import { colors, fonts, space } from '../theme';

export default function Requests() {
  const { requests } = useConversations();
  return (
    <Screen>
      <BackHeader title="Message requests" />
      <View style={styles.note}>
        <Icon name="lock" size={16} color={colors.inkMuted} />
        <Text style={styles.noteText}>People you don't chat with yet. They won't know you've seen their message until you accept.</Text>
      </View>
      <FlatList
        data={requests ?? []}
        keyExtractor={(c) => c.id}
        renderItem={({ item }) => <ConversationRow conv={item} onPress={() => router.push(`/chat/${item.id}`)} />}
        ListEmptyComponent={<Text style={styles.empty}>No requests right now.</Text>}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  note: { flexDirection: 'row', gap: space.sm, paddingHorizontal: space.lg, paddingBottom: space.md },
  noteText: { flex: 1, fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, color: colors.inkMuted },
  empty: { fontFamily: fonts.regular, fontSize: 15, color: colors.inkMuted, textAlign: 'center', padding: space.xl },
});
