import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Icon } from '../components/Icon';
import { Body, Button, Eyebrow, Screen, Title } from '../components/ui';
import { colors, fonts, radius, space, themed } from '../theme';

export default function Welcome() {
  return (
    <Screen>
      <View style={styles.container}>
        <Animated.View entering={FadeInDown.duration(700).springify().damping(20)} style={styles.hero}>
          <View style={styles.mark}>
            <Icon name="heart" size={44} color={colors.rose} filled />
          </View>
          <Eyebrow>Private by default</Eyebrow>
          <Title>Talk to the people you love.</Title>
          <Body muted>
            Chats, groups, photos and voice notes that only the people in them can read. Share moments on the timeline.
          </Body>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(150).duration(700).springify().damping(20)} style={styles.actions}>
          <Button title="Create account" onPress={() => router.push('/sign-up')} />
          <Button title="I already have an account" variant="ghost" onPress={() => router.push('/sign-in')} />
          <View style={styles.lockRow}>
            <Icon name="lock" size={14} color={colors.inkMuted} />
            <Body muted style={styles.lockText}>End-to-end encrypted</Body>
          </View>
        </Animated.View>
      </View>
    </Screen>
  );
}

const styles = themed(() => StyleSheet.create({
  container: { flex: 1, paddingHorizontal: space.lg, paddingVertical: space.xl, justifyContent: 'space-between' },
  hero: { gap: space.md, marginTop: space.xxl },
  mark: {
    width: 88,
    height: 88,
    borderRadius: radius.lg,
    backgroundColor: colors.roseTint,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: space.md,
  },
  actions: { gap: space.sm },
  lockRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: space.sm },
  lockText: { fontFamily: fonts.medium, fontSize: 13 },
}));
