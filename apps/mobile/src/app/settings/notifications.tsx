import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';
import { BackHeader } from '../../components/BackHeader';
import { Row, Section, Toggle } from '../../components/SettingsList';
import { Screen } from '../../components/ui';
import { notify } from '../../lib/confirm';
import { notificationsEnabled, setNotificationsEnabled } from '../../lib/push';
import { colors, fonts, space, themed } from '../../theme';

export default function Notifications() {
  const [on, setOn] = useState<boolean | null>(null);
  useEffect(() => {
    void notificationsEnabled().then(setOn);
  }, []);

  const toggle = async (v: boolean) => {
    setOn(v);
    try {
      await setNotificationsEnabled(v);
    } catch {
      setOn(!v);
      notify("Couldn't change notifications");
    }
  };

  return (
    <Screen>
      <BackHeader title="Notifications" />
      <ScrollView contentContainerStyle={styles.container}>
        <Section>
          <Row
            icon="bell"
            title="Show notifications"
            subtitle="New messages, group messages and message requests"
            right={on === null ? null : <Toggle value={on} onChange={(v) => void toggle(v)} label="Show notifications" />}
          />
        </Section>
        <Text style={styles.note}>
          Notifications never contain your messages — only who sent something. To silence one chat, open it and tap Mute.
        </Text>
      </ScrollView>
    </Screen>
  );
}

const styles = themed(() => StyleSheet.create({
  container: { padding: space.md, gap: space.lg },
  note: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, color: colors.inkMuted, paddingHorizontal: space.sm },
}));
