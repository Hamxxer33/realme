import Constants from 'expo-constants';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { BackHeader } from '../../components/BackHeader';
import { Icon, type IconName } from '../../components/Icon';
import { Screen } from '../../components/ui';
import { colors, fonts, radius, space, themed } from '../../theme';

const TOPICS: Array<{ icon: IconName; title: string; body: string }> = [
  {
    icon: 'lock',
    title: 'End-to-end encryption',
    body: 'Messages, photos, voice notes and status updates are locked on your phone and only unlocked on the phones of the people they are for. Our servers only ever see scrambled data.',
  },
  {
    icon: 'check',
    title: 'Verifying a chat',
    body: 'Open a chat, tap the name, then Encryption. Compare the number with the other person in person. If it matches, nobody in between can read your chat.',
  },
  {
    icon: 'key',
    title: 'Your password',
    body: 'Your password unlocks your encryption key. We never see it, so we cannot reset it. If you forget it you can create a new account, but old messages cannot be recovered.',
  },
  {
    icon: 'inbox',
    title: 'Message requests',
    body: "Messages from people you don't chat with yet wait in Requests. They can't tell you've read them until you accept.",
  },
  {
    icon: 'flag',
    title: 'Staying safe',
    body: 'Block anyone from their profile or chat info — they will not be told. Report people, posts or chats and we will review them. Because chats are encrypted, include what was said if you want us to see it.',
  },
];

export default function Help() {
  return (
    <Screen>
      <BackHeader title="Help" />
      <ScrollView contentContainerStyle={styles.container}>
        {TOPICS.map((t) => (
          <View key={t.title} style={styles.card}>
            <View style={styles.icon}><Icon name={t.icon} color={colors.rose} size={20} /></View>
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={styles.title}>{t.title}</Text>
              <Text style={styles.body}>{t.body}</Text>
            </View>
          </View>
        ))}
        <Text style={styles.version}>Realme {Constants.expoConfig?.version ?? ''}</Text>
      </ScrollView>
    </Screen>
  );
}

const styles = themed(() => StyleSheet.create({
  container: { padding: space.md, gap: space.md, paddingBottom: space.xxl },
  card: { flexDirection: 'row', gap: space.md, padding: space.md, borderRadius: radius.lg, backgroundColor: colors.surface },
  icon: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.roseTint, alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: fonts.bold, fontSize: 16, color: colors.ink },
  body: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, color: colors.inkMuted },
  version: { fontFamily: fonts.medium, fontSize: 13, color: colors.inkMuted, textAlign: 'center', marginTop: space.md },
}));
