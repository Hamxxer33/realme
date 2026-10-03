import { router } from 'expo-router';
import { Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { Avatar } from '../../components/Avatar';
import { Icon } from '../../components/Icon';
import { Row, Section } from '../../components/SettingsList';
import { Screen } from '../../components/ui';
import { useAppearance } from '../../lib/appearance';
import { useSession } from '../../lib/session';
import { colors, fonts, space, themed } from '../../theme';

const APPEARANCE_LABEL = { system: 'Match phone', light: 'Light', dark: 'Dark' } as const;

/** "You" tab: profile header plus settings, WhatsApp-style. */
export default function Settings() {
  const { me } = useSession();
  const appearance = useAppearance();
  if (!me) return null;

  const invite = () =>
    void Share.share({ message: `Let's chat on Realme — it's private and end-to-end encrypted. Find me as @${me.username}` });

  return (
    <Screen edges={['top']}>
      <View style={styles.header}>
        <Text accessibilityRole="header" style={styles.title}>Settings</Text>
      </View>
      <ScrollView contentContainerStyle={styles.container}>
        <Pressable accessibilityRole="button" accessibilityLabel="Edit profile" onPress={() => router.push('/settings/edit-profile')} style={styles.profile}>
          <Avatar name={me.displayName} seed={me.username} size={72} />
          <View style={{ flex: 1 }}>
            <Text style={styles.name} numberOfLines={1}>{me.displayName}</Text>
            <Text style={styles.handle}>@{me.username}</Text>
            {me.bio ? <Text style={styles.bio} numberOfLines={2}>{me.bio}</Text> : <Text style={styles.bioEmpty}>Add a bio</Text>}
          </View>
          <Icon name="edit" color={colors.inkMuted} size={22} />
        </Pressable>

        <Section>
          <Row icon="key" title="Account" subtitle="Email, sign out, delete account" onPress={() => router.push('/settings/account')} chevron />
          <Row icon="lock" title="Privacy" subtitle="Read receipts, blocked accounts" onPress={() => router.push('/settings/privacy')} chevron />
          <Row icon="feed" title="My posts" subtitle="Your public timeline posts" onPress={() => router.push(`/user/${me.username}`)} chevron />
        </Section>

        <Section>
          <Row icon="palette" title="Appearance" subtitle={APPEARANCE_LABEL[appearance]} onPress={() => router.push('/settings/appearance')} chevron />
          <Row icon="bell" title="Notifications" subtitle="Message and group alerts" onPress={() => router.push('/settings/notifications')} chevron />
        </Section>

        <Section>
          <Row icon="help" title="Help" subtitle="How encryption works, privacy, contact" onPress={() => router.push('/settings/help')} chevron />
          <Row icon="users" title="Invite a friend" onPress={invite} />
        </Section>

        <Text style={styles.footer}>Realme · end-to-end encrypted</Text>
      </ScrollView>
    </Screen>
  );
}

const styles = themed(() => StyleSheet.create({
  header: { paddingHorizontal: space.lg, paddingTop: space.sm, paddingBottom: space.sm },
  title: { fontFamily: fonts.heavy, fontSize: 32, color: colors.ink, letterSpacing: -0.5 },
  container: { padding: space.md, gap: space.lg, paddingBottom: space.xxl },
  profile: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md, borderRadius: 28, backgroundColor: colors.surface },
  name: { fontFamily: fonts.heavy, fontSize: 20, color: colors.ink },
  handle: { fontFamily: fonts.medium, fontSize: 14, color: colors.inkMuted },
  bio: { fontFamily: fonts.regular, fontSize: 14, color: colors.ink, marginTop: 4 },
  bioEmpty: { fontFamily: fonts.medium, fontSize: 14, color: colors.rose, marginTop: 4 },
  footer: { fontFamily: fonts.medium, fontSize: 13, color: colors.inkMuted, textAlign: 'center' },
}));
