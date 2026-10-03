import { ScrollView, StyleSheet, Text } from 'react-native';
import { BackHeader } from '../../components/BackHeader';
import { Row, Section } from '../../components/SettingsList';
import { Screen } from '../../components/ui';
import { api } from '../../lib/api';
import { confirm, notify } from '../../lib/confirm';
import { useSession } from '../../lib/session';
import { colors, fonts, space, themed } from '../../theme';

export default function Account() {
  const { me, signOut } = useSession();
  if (!me) return null;

  const deleteAccount = async () => {
    const ok = await confirm('Delete your account?', 'Your profile, posts and messages will be permanently deleted. This cannot be undone.', 'Delete');
    if (!ok) return;
    try {
      await api('DELETE', '/me');
      await signOut();
    } catch {
      notify("Couldn't delete account", 'Please try again.');
    }
  };

  return (
    <Screen>
      <BackHeader title="Account" />
      <ScrollView contentContainerStyle={styles.container}>
        <Section>
          <Row icon="user" title="Username" subtitle={`@${me.username}`} />
          <Row icon="mail" title="Email" subtitle={me.email} />
        </Section>
        <Text style={styles.note}>
          Your password unlocks your encryption key on each phone you sign in on. We never see it, so we can't reset it for you —
          keep it somewhere safe.
        </Text>
        <Section>
          <Row icon="logout" title="Sign out" onPress={() => void signOut()} />
          <Row icon="trash" title="Delete account" danger onPress={() => void deleteAccount()} />
        </Section>
      </ScrollView>
    </Screen>
  );
}

const styles = themed(() => StyleSheet.create({
  container: { padding: space.md, gap: space.lg },
  note: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, color: colors.inkMuted, paddingHorizontal: space.sm },
}));
