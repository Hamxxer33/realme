import { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { BackHeader } from '../components/BackHeader';
import { Icon } from '../components/Icon';
import { Body, Button, Card, ErrorText, Field, Screen } from '../components/ui';
import { api } from '../lib/api';
import { parseDate } from '../lib/dates';
import { useSession } from '../lib/session';
import { colors, fonts, space } from '../theme';

export default function Settings() {
  const { me, settings, saveSettings, signOut, crypto } = useSession();
  const partner = me?.couple?.partner;
  const [anniversary, setAnniversary] = useState(settings.anniversary ?? '');
  const [coupleName, setCoupleName] = useState(settings.coupleName ?? '');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const dirty = anniversary !== (settings.anniversary ?? '') || coupleName !== (settings.coupleName ?? '');
  const safetyNumber = me && partner && crypto ? crypto.safetyNumber(me.user.publicKey, partner.publicKey) : null;

  const save = async () => {
    setError(null);
    if (anniversary && !parseDate(anniversary)) return setError('Use the date format YYYY-MM-DD.');
    setSaving(true);
    try {
      await saveSettings({ anniversary: anniversary || undefined, coupleName: coupleName.trim() || undefined });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      setSaving(false);
    }
  };

  const unpair = () =>
    Alert.alert(
      `Unpair from ${partner?.displayName}?`,
      'This permanently deletes your shared messages, photos, voice notes and memories for both of you.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Unpair', style: 'destructive', onPress: () => void api('DELETE', '/couple').catch(() => Alert.alert("Couldn't unpair", 'Please try again.')) },
      ],
    );

  const deleteAccount = () =>
    Alert.alert('Delete your account?', 'Your account and everything you and your partner shared will be permanently deleted.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () =>
          void api('DELETE', '/me').then(() => signOut(), () => Alert.alert("Couldn't delete account", 'Please try again.')),
      },
    ]);

  return (
    <Screen>
      <BackHeader title="Settings" />
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Card style={styles.section}>
          <Text style={styles.sectionTitle}>Us</Text>
          <Field label="Couple name (optional)" value={coupleName} onChangeText={setCoupleName} placeholder={partner?.displayName} maxLength={40} />
          <Field
            label="Anniversary"
            value={anniversary}
            onChangeText={setAnniversary}
            placeholder="YYYY-MM-DD"
            keyboardType="numbers-and-punctuation"
            maxLength={10}
          />
          <ErrorText>{error}</ErrorText>
          {dirty ? <Button title="Save" onPress={save} loading={saving} /> : null}
        </Card>

        <Card style={styles.section}>
          <View style={styles.row}>
            <Icon name="lock" size={18} color={colors.rose} />
            <Text style={styles.sectionTitle}>Encryption</Text>
          </View>
          <Body muted style={styles.small}>
            Compare this number with {partner?.displayName}'s phone, in person. If they match, nobody — including our server — can read your messages.
          </Body>
          <Text style={styles.safety} selectable accessibilityLabel={`Safety number ${safetyNumber}`}>
            {safetyNumber}
          </Text>
        </Card>

        <Card style={styles.section}>
          <Text style={styles.sectionTitle}>Account</Text>
          <Body muted style={styles.small}>Signed in as {me?.user.email}</Body>
          <Button title="Sign out" variant="ghost" onPress={() => void signOut()} />
          <Button title={`Unpair from ${partner?.displayName ?? 'partner'}`} variant="ghost" onPress={unpair} />
          <Button title="Delete account" variant="ghost" onPress={deleteAccount} />
        </Card>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { padding: space.lg, gap: space.lg },
  section: { gap: space.md },
  sectionTitle: { fontFamily: fonts.bold, fontSize: 18, color: colors.ink },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  small: { fontSize: 14, lineHeight: 20 },
  safety: {
    fontFamily: fonts.bold,
    fontSize: 20,
    letterSpacing: 2,
    lineHeight: 30,
    color: colors.ink,
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
    paddingVertical: space.sm,
  },
});
