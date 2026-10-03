import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, fonts, space } from '../theme';
import { Icon } from './Icon';

export function BackHeader({ title, right, icon = 'back' }: { title: string; right?: ReactNode; icon?: 'back' | 'close' }) {
  return (
    <View style={styles.header}>
      <Pressable accessibilityRole="button" accessibilityLabel={icon === 'back' ? 'Back' : 'Close'} onPress={() => router.back()} hitSlop={12} style={styles.button}>
        <Icon name={icon} color={colors.ink} />
      </Pressable>
      <Text accessibilityRole="header" style={styles.title} numberOfLines={1}>{title}</Text>
      <View style={styles.button}>{right}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.md, paddingVertical: space.sm, gap: space.sm },
  button: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  title: { flex: 1, textAlign: 'center', fontFamily: fonts.bold, fontSize: 18, color: colors.ink },
});
