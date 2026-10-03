import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { BackHeader } from '../components/BackHeader';
import { ChannelRow, FollowButton } from '../components/ChannelRow';
import { Icon } from '../components/Icon';
import { Screen } from '../components/ui';
import { api, type ChannelView } from '../lib/api';
import { follow } from '../lib/channels';
import { notify } from '../lib/confirm';
import { colors, fonts, noWebOutline, radius, shadow, space, themed } from '../theme';

/** Find channels: the most-followed ones, or search by name. */
export default function ExploreChannels() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ChannelView[] | null>(null);

  useEffect(() => {
    let alive = true;
    const t = setTimeout(() => {
      api<{ channels: ChannelView[] }>('GET', `/channels?q=${encodeURIComponent(query.trim())}`)
        .then((r) => alive && setResults(r.channels), () => alive && setResults([]));
    }, query ? 250 : 0);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [query]);

  const toggle = async (c: ChannelView) => {
    try {
      const next = await follow(c, !c.following);
      setResults((prev) => prev?.map((x) => (x.id === c.id ? next : x)) ?? prev);
    } catch (e) {
      notify("Couldn't update", e instanceof Error ? e.message : undefined);
    }
  };

  return (
    <Screen>
      <BackHeader
        title="Channels"
        right={
          <Pressable accessibilityRole="button" accessibilityLabel="Create channel" onPress={() => router.push('/channel-new')} hitSlop={10}>
            <Icon name="plus" color={colors.ink} />
          </Pressable>
        }
      />
      <View style={styles.search}>
        <Icon name="search" color={colors.inkMuted} size={20} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search channels"
          placeholderTextColor={colors.inkMuted}
          autoCapitalize="none"
          style={styles.input}
          accessibilityLabel="Search channels"
        />
      </View>
      {results === null ? <ActivityIndicator color={colors.rose} style={{ marginTop: space.xl }} /> : (
        <FlatList
          data={results}
          keyExtractor={(c) => c.id}
          ListHeaderComponent={<Text style={styles.label}>{query.trim() ? 'Results' : 'Popular channels'}</Text>}
          renderItem={({ item }) => (
            <ChannelRow
              channel={item}
              onPress={() => router.push(`/channel/${item.id}`)}
              action={item.isOwner ? <Text style={styles.yours}>Yours</Text> : <FollowButton following={item.following} name={item.name} onPress={() => void toggle(item)} />}
            />
          )}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyText}>{query.trim() ? `No channels match “${query.trim()}”.` : 'No channels yet.'}</Text>
              <Pressable accessibilityRole="button" onPress={() => router.push('/channel-new')} style={styles.create}>
                <Text style={styles.createText}>Create a channel</Text>
              </Pressable>
            </View>
          }
          contentContainerStyle={{ paddingHorizontal: space.md, paddingBottom: space.xl }}
        />
      )}
    </Screen>
  );
}

const styles = themed(() => StyleSheet.create({
  search: {
    flexDirection: 'row', alignItems: 'center', gap: space.sm, height: 44, marginHorizontal: space.md, marginBottom: space.sm,
    paddingHorizontal: space.md, borderRadius: radius.pill, backgroundColor: colors.surface, ...shadow, shadowOpacity: 0.05,
  },
  input: { ...noWebOutline, flex: 1, height: '100%', fontFamily: fonts.regular, fontSize: 16, color: colors.ink },
  label: { fontFamily: fonts.bold, fontSize: 13, color: colors.inkMuted, textTransform: 'uppercase', letterSpacing: 0.8, marginHorizontal: space.sm, marginVertical: space.sm },
  yours: { fontFamily: fonts.bold, fontSize: 13, color: colors.inkMuted, paddingHorizontal: space.sm },
  empty: { alignItems: 'center', gap: space.md, marginTop: space.xl },
  emptyText: { fontFamily: fonts.regular, fontSize: 15, color: colors.inkMuted, textAlign: 'center' },
  create: { paddingHorizontal: space.lg, paddingVertical: 12, borderRadius: radius.pill, backgroundColor: colors.roseFill },
  createText: { fontFamily: fonts.bold, fontSize: 15, color: colors.onRose },
}));
