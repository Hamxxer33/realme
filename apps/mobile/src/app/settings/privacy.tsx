import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';
import { BackHeader } from '../../components/BackHeader';
import { Row, Section, Toggle } from '../../components/SettingsList';
import { Screen } from '../../components/ui';
import { api, type Me } from '../../lib/api';
import { notify } from '../../lib/confirm';
import { useSession } from '../../lib/session';
import { colors, fonts, space, themed } from '../../theme';

export default function Privacy() {
  const { me, setMe } = useSession();
  const [saving, setSaving] = useState(false);
  if (!me) return null;

  const setReadReceipts = async (on: boolean) => {
    setSaving(true);
    setMe({ ...me, readReceipts: on });
    try {
      const { user } = await api<{ user: Me }>('PATCH', '/me', { readReceipts: on });
      setMe(user);
    } catch {
      setMe(me);
      notify("Couldn't save");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen>
      <BackHeader title="Privacy" />
      <ScrollView contentContainerStyle={styles.container}>
        <Section title="Messages">
          <Row
            icon="checks"
            title="Read receipts"
            subtitle="If you turn this off, you won't send or receive read receipts."
            right={<Toggle value={me.readReceipts} onChange={(v) => !saving && void setReadReceipts(v)} label="Read receipts" />}
          />
          <Row icon="inbox" title="Message requests" subtitle="People you don't chat with land in Requests until you accept" />
        </Section>
        <Section title="People">
          <Row icon="block" title="Blocked accounts" subtitle="They can't message you or see your posts" onPress={() => router.push('/blocked')} chevron />
        </Section>
        <Text style={styles.note}>
          Your chats, photos, voice notes and status updates are end-to-end encrypted. Your profile name, @username, bio and timeline
          posts are visible to everyone on Realme.
        </Text>
      </ScrollView>
    </Screen>
  );
}

const styles = themed(() => StyleSheet.create({
  container: { padding: space.md, gap: space.lg },
  note: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, color: colors.inkMuted, paddingHorizontal: space.sm },
}));
