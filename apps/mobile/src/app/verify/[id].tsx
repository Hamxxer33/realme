import { useLocalSearchParams } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Avatar } from '../../components/Avatar';
import { BackHeader } from '../../components/BackHeader';
import { Icon } from '../../components/Icon';
import { Screen } from '../../components/ui';
import { useConversation } from '../../lib/conversations';
import { otherMembers } from '../../lib/format';
import { useSession } from '../../lib/session';
import { colors, fonts, radius, shadow, space } from '../../theme';

/** Compare-in-person verification for a 1:1 chat. */
export default function Verify() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const conv = useConversation(id);
  const { me, crypto } = useSession();
  const other = conv && me ? otherMembers(conv, me.id)[0] : undefined;
  const number = me && other && crypto ? crypto.safetyNumber(me.publicKey, other.publicKey) : null;
  const groups = number?.split(' ') ?? [];

  return (
    <Screen>
      <BackHeader title="Verify encryption" />
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.pair}>
          {me ? <Avatar name={me.displayName} seed={me.username} size={64} /> : null}
          <View style={styles.lock}><Icon name="lock" color={colors.onRose} size={20} /></View>
          {other ? <Avatar name={other.displayName} seed={other.username} size={64} /> : null}
        </View>
        <Text style={styles.title}>You and {other?.displayName}</Text>

        <View style={styles.card} accessible accessibilityLabel={`Safety number ${number}`}>
          <View style={styles.grid}>
            {groups.map((g, i) => <Text key={i} style={styles.group}>{g}</Text>)}
          </View>
        </View>

        <Text style={styles.body}>
          Open this screen on {other?.displayName}'s phone too and compare the numbers. If they're the same, your
          messages are end-to-end encrypted to each other — nobody else, including our server, can read them.
        </Text>
        <Text style={styles.body}>
          If the numbers ever change, one of you reinstalled the app or signed in on a new phone. Check again in person.
        </Text>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { padding: space.lg, gap: space.lg, alignItems: 'center' },
  pair: { flexDirection: 'row', alignItems: 'center', gap: space.md, marginTop: space.md },
  lock: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.rose, alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: fonts.heavy, fontSize: 22, color: colors.ink },
  card: { alignSelf: 'stretch', backgroundColor: colors.surface, borderRadius: radius.lg, padding: space.lg, ...shadow },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', rowGap: space.md, columnGap: space.lg },
  group: { fontFamily: fonts.bold, fontSize: 26, letterSpacing: 2, color: colors.ink, fontVariant: ['tabular-nums'], width: 110, textAlign: 'center' },
  body: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 22, color: colors.inkMuted, textAlign: 'center' },
});
