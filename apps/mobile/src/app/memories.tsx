import { router } from 'expo-router';
import { ActivityIndicator, Alert, FlatList, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { BackHeader } from '../components/BackHeader';
import { Icon } from '../components/Icon';
import { EncryptedImage } from '../components/Media';
import { Screen } from '../components/ui';
import { parseDate } from '../lib/dates';
import { useMemories } from '../lib/memories';
import { colors, fonts, radius, shadow, space } from '../theme';

export default function Memories() {
  const { memories, remove } = useMemories();
  const { width } = useWindowDimensions();

  const confirmDelete = (id: string, title: string) =>
    Alert.alert('Delete this memory?', `"${title}" will be removed for both of you.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => void remove(id).catch(() => Alert.alert("Couldn't delete", 'Please try again.')) },
    ]);

  return (
    <Screen>
      <BackHeader
        title="Our memories"
        right={
          <Pressable accessibilityRole="button" accessibilityLabel="Add a memory" onPress={() => router.push('/memory-new')} hitSlop={8}>
            <Icon name="plus" color={colors.rose} strokeWidth={2} />
          </Pressable>
        }
      />
      {memories === null ? (
        <ActivityIndicator color={colors.rose} style={{ marginTop: space.xxl }} />
      ) : (
        <FlatList
          data={memories}
          keyExtractor={(m) => m.id}
          contentContainerStyle={{ padding: space.lg, gap: space.lg, flexGrow: 1 }}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>Your story starts here</Text>
              <Text style={styles.emptyBody}>Save first dates, trips and little moments you never want to forget.</Text>
              <Pressable accessibilityRole="button" onPress={() => router.push('/memory-new')} style={styles.emptyButton}>
                <Text style={styles.emptyButtonText}>Add your first memory</Text>
              </Pressable>
            </View>
          }
          renderItem={({ item, index }) => (
            <Animated.View entering={FadeInDown.delay(Math.min(index, 6) * 60).springify().damping(20)}>
              <Pressable onLongPress={() => confirmDelete(item.id, item.title)} accessibilityHint="Long press to delete" style={styles.card}>
                {item.media ? <EncryptedImage media={item.media} maxWidth={width - space.lg * 2 - 16} /> : null}
                <View style={styles.cardBody}>
                  <Text style={styles.date}>{formatDate(item.date)}</Text>
                  <Text style={styles.title}>{item.title}</Text>
                  {item.note ? <Text style={styles.note}>{item.note}</Text> : null}
                </View>
              </Pressable>
            </Animated.View>
          )}
        />
      )}
    </Screen>
  );
}

function formatDate(value: string) {
  const d = parseDate(value);
  return d ? d.toLocaleDateString([], { day: 'numeric', month: 'long', year: 'numeric' }) : value;
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: 8, ...shadow },
  cardBody: { padding: space.md, gap: 4 },
  date: { fontFamily: fonts.bold, fontSize: 12, letterSpacing: 1.2, textTransform: 'uppercase', color: colors.rose },
  title: { fontFamily: fonts.heavy, fontSize: 20, color: colors.ink },
  note: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 22, color: colors.inkMuted, marginTop: 4 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.sm, padding: space.lg },
  emptyTitle: { fontFamily: fonts.heavy, fontSize: 22, color: colors.ink, textAlign: 'center' },
  emptyBody: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 22, color: colors.inkMuted, textAlign: 'center' },
  emptyButton: { marginTop: space.md, backgroundColor: colors.roseTint, borderRadius: radius.pill, paddingHorizontal: space.lg, paddingVertical: 12 },
  emptyButtonText: { fontFamily: fonts.bold, color: colors.rose, fontSize: 15 },
});
