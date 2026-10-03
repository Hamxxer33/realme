import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { colors, space } from '../theme';
import { Icon } from './Icon';
import { Body, Screen, Title } from './ui';

export function AuthForm({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={() => router.back()} style={styles.back} hitSlop={12}>
          <Icon name="back" color={colors.ink} />
        </Pressable>
        <View style={{ gap: space.sm, marginBottom: space.lg }}>
          <Title>{title}</Title>
          <Body muted>{subtitle}</Body>
        </View>
        <View style={{ gap: space.md }}>{children}</View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { padding: space.lg, gap: space.md },
  back: { width: 44, height: 44, justifyContent: 'center', marginLeft: -8, marginBottom: space.md },
});
