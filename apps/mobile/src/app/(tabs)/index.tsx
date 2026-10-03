import { router } from 'expo-router';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { ConversationRow } from '../../components/ConversationRow';
import { Icon } from '../../components/Icon';
import { Screen } from '../../components/ui';
import { refreshConversations, useConversations } from '../../lib/conversations';
import { colors, fonts, radius, shadow, space } from '../../theme';

export default function Chats() {
  const { chats, requests } = useConversations();

  return (
    <Screen edges={['top']}>
      <View style={styles.header}>
        <Text accessibilityRole="header" style={styles.title}>Chats</Text>
        <HeaderButton icon="users" label="New group" onPress={() => router.push('/new-group')} />
        <HeaderButton icon="edit" label="New chat" onPress={() => router.push('/new-chat')} />
      </View>

      <Pressable accessibilityRole="search" accessibilityLabel="Search people" onPress={() => router.push('/new-chat')} style={styles.search}>
        <Icon name="search" color={colors.inkMuted} size={20} />
        <Text style={styles.searchText}>Search by @username</Text>
      </Pressable>

      {chats === null ? (
        <ActivityIndicator color={colors.rose} style={{ marginTop: space.xxl }} />
      ) : (
        <FlatList
          data={chats}
          keyExtractor={(c) => c.id}
          renderItem={({ item }) => <ConversationRow conv={item} onPress={() => router.push(`/chat/${item.id}`)} />}
          onRefresh={() => void refreshConversations()}
          refreshing={false}
          ListHeaderComponent={requests?.length ? (
            <Pressable accessibilityRole="button" onPress={() => router.push('/requests')} style={styles.requests}>
              <View style={styles.requestIcon}><Icon name="inbox" color={colors.rose} size={22} /></View>
              <Text style={styles.requestText}>Message requests</Text>
              <View style={styles.badge}><Text style={styles.badgeText}>{requests.length}</Text></View>
            </Pressable>
          ) : null}
          ListEmptyComponent={
            <View style={styles.empty}>
              <View style={styles.emptyMark}><Icon name="heart" size={30} color={colors.rose} filled /></View>
              <Text style={styles.emptyTitle}>No chats yet</Text>
              <Text style={styles.emptyBody}>Find someone by their @username and say hello. Every chat is end-to-end encrypted.</Text>
              <Pressable accessibilityRole="button" onPress={() => router.push('/new-chat')} style={styles.emptyButton}>
                <Text style={styles.emptyButtonText}>Start a chat</Text>
              </Pressable>
            </View>
          }
          contentContainerStyle={{ paddingBottom: space.lg, flexGrow: 1 }}
        />
      )}
    </Screen>
  );
}

function HeaderButton({ icon, label, onPress }: { icon: 'users' | 'edit'; label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} hitSlop={6} style={styles.headerButton}>
      <Icon name={icon} color={colors.ink} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingHorizontal: space.lg, paddingTop: space.sm, paddingBottom: space.sm },
  title: { flex: 1, fontFamily: fonts.heavy, fontSize: 32, color: colors.ink, letterSpacing: -0.5 },
  headerButton: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface, ...shadow, shadowOpacity: 0.05 },
  search: {
    flexDirection: 'row', alignItems: 'center', gap: space.sm, marginHorizontal: space.lg, marginBottom: space.sm,
    paddingHorizontal: space.md, height: 46, borderRadius: radius.pill, backgroundColor: colors.surface, ...shadow, shadowOpacity: 0.04,
  },
  searchText: { fontFamily: fonts.regular, fontSize: 15, color: colors.inkMuted },
  requests: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.lg, paddingVertical: 12 },
  requestIcon: { width: 52, height: 52, borderRadius: 26, backgroundColor: colors.roseTint, alignItems: 'center', justifyContent: 'center' },
  requestText: { flex: 1, fontFamily: fonts.bold, fontSize: 16, color: colors.ink },
  badge: { minWidth: 24, height: 24, borderRadius: 12, paddingHorizontal: 7, backgroundColor: colors.rose, alignItems: 'center', justifyContent: 'center' },
  badgeText: { fontFamily: fonts.bold, fontSize: 13, color: colors.onRose },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: space.xl, gap: space.sm },
  emptyMark: { width: 72, height: 72, borderRadius: 36, backgroundColor: colors.roseTint, alignItems: 'center', justifyContent: 'center', marginBottom: space.sm },
  emptyTitle: { fontFamily: fonts.heavy, fontSize: 22, color: colors.ink },
  emptyBody: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 22, color: colors.inkMuted, textAlign: 'center' },
  emptyButton: { marginTop: space.md, backgroundColor: colors.rose, borderRadius: radius.pill, paddingHorizontal: space.lg, paddingVertical: 13 },
  emptyButtonText: { fontFamily: fonts.bold, color: colors.onRose, fontSize: 15 },
});
