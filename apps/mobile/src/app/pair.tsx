import { useState } from 'react';
import { Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Body, Button, Card, ErrorText, Eyebrow, Field, Screen, Title } from '../components/ui';
import { api } from '../lib/api';
import { useSession } from '../lib/session';
import { colors, fonts, radius, space } from '../theme';

export default function Pair() {
  const { me, refresh, signOut } = useSession();
  const couple = me?.couple;
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState<null | 'invite' | 'join'>(null);
  const [error, setError] = useState<string | null>(null);

  const expired = couple?.inviteExpiresAt ? new Date(couple.inviteExpiresAt) < new Date() : false;
  const myCode = couple?.inviteCode && !expired ? couple.inviteCode : null;

  const createInvite = async () => {
    setError(null);
    setBusy('invite');
    try {
      await api('POST', '/couple/invite');
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      setBusy(null);
    }
  };

  const join = async () => {
    setError(null);
    setBusy('join');
    try {
      await api('POST', '/couple/join', { code: code.trim().toUpperCase() });
      await refresh(); // flips the session to paired, which swaps in the chat
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
      setBusy(null);
    }
  };

  const share = () => {
    if (!myCode) return;
    void Share.share({ message: `Join me on Realme 💌 Our code: ${myCode}` });
  };

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Animated.View entering={FadeInDown.springify().damping(20)} style={{ gap: space.sm }}>
          <Eyebrow>Step 2 of 2</Eyebrow>
          <Title>Find each other</Title>
          <Body muted>One of you shares a code, the other enters it. That's it.</Body>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(100).springify().damping(20)}>
          <Card style={{ gap: space.md }}>
            <Text style={styles.cardTitle}>Share your code</Text>
            {myCode ? (
              <>
                <Pressable accessibilityRole="button" accessibilityLabel={`Your code is ${myCode.split('').join(' ')}. Tap to share.`} onPress={share} style={styles.codeBox}>
                  <Text style={styles.code}>{myCode}</Text>
                </Pressable>
                <Body muted style={styles.small}>Waiting for your partner… This code works for 24 hours.</Body>
                <Button title="Share code" onPress={share} />
              </>
            ) : (
              <Button title={expired ? 'Get a new code' : 'Get my code'} onPress={createInvite} loading={busy === 'invite'} />
            )}
          </Card>
        </Animated.View>

        <View style={styles.dividerRow}>
          <View style={styles.divider} />
          <Text style={styles.or}>or</Text>
          <View style={styles.divider} />
        </View>

        <Animated.View entering={FadeInDown.delay(200).springify().damping(20)}>
          <Card style={{ gap: space.md }}>
            <Text style={styles.cardTitle}>Enter their code</Text>
            <Field
              label="Partner's code"
              value={code}
              onChangeText={(t) => setCode(t.toUpperCase())}
              autoCapitalize="characters"
              autoCorrect={false}
              maxLength={6}
              placeholder="Enter code"
              style={styles.codeInput}
            />
            <Button title="Join" onPress={join} loading={busy === 'join'} disabled={code.trim().length !== 6} />
          </Card>
        </Animated.View>

        <ErrorText>{error}</ErrorText>
        <Button title="Sign out" variant="ghost" onPress={() => void signOut()} />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { padding: space.lg, gap: space.lg },
  cardTitle: { fontFamily: fonts.bold, fontSize: 18, color: colors.ink },
  codeBox: {
    backgroundColor: colors.roseTint,
    borderRadius: radius.md,
    paddingVertical: space.lg,
    alignItems: 'center',
  },
  code: { fontFamily: fonts.heavy, fontSize: 40, letterSpacing: 10, color: colors.rose },
  small: { fontSize: 14, lineHeight: 20 },
  codeInput: { fontFamily: fonts.bold, fontSize: 22, letterSpacing: 6, textAlign: 'center' },
  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  divider: { flex: 1, height: 1, backgroundColor: colors.hairline },
  or: { fontFamily: fonts.medium, color: colors.inkMuted },
});
