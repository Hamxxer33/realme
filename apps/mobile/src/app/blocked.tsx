import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { BackHeader } from '../components/BackHeader';
import { Screen } from '../components/ui';
import { UserRow } from '../components/UserRow';
import { api, type PublicUser } from '../lib/api';
import { notify } from '../lib/confirm';
import { colors, fonts, radius, space, themed } from '../theme';

export default function Blocked() {
  const [users, setUsers] = useState<PublicUser[] | null>(null);
  const load = useCallback(async () => setUsers((await api<{ users: PublicUser[] }>('GET', '/blocks')).users), []);
  useEffect(() => {
    void load().catch(() => setUsers([]));
  }, [load]);

  const unblock = async (u: PublicUser) => {
    try {
      await api('DELETE', `/blocks/${u.id}`);
      setUsers((list) => list?.filter((x) => x.id !== u.id) ?? list);
    } catch {
      notify("Couldn't unblock");
    }
  };

  return (
    <Screen>
      <BackHeader title="Blocked people" />
      {users === null ? <ActivityIndicator color={colors.rose} style={{ marginTop: space.xxl }} /> : (
        <FlatList
          data={users}
          keyExtractor={(u) => u.id}
          renderItem={({ item }) => (
            <UserRow user={item} right={
              <Pressable accessibilityRole="button" accessibilityLabel={`Unblock ${item.displayName}`} onPress={() => void unblock(item)} style={styles.pill}>
                <Text style={styles.pillText}>Unblock</Text>
              </Pressable>
            } />
          )}
          ListEmptyComponent={<View style={styles.empty}><Text style={styles.emptyText}>You haven't blocked anyone.</Text></View>}
        />
      )}
    </Screen>
  );
}

const styles = themed(() => StyleSheet.create({
  pill: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.pill, backgroundColor: colors.roseTint },
  pillText: { fontFamily: fonts.bold, fontSize: 14, color: colors.rose },
  empty: { padding: space.xl, alignItems: 'center' },
  emptyText: { fontFamily: fonts.regular, fontSize: 15, color: colors.inkMuted },
}));
