import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { PublicUser } from '../lib/api';
import { colors, fonts, space } from '../theme';
import { Avatar } from './Avatar';

export function UserRow({ user, onPress, right, subtitle }: {
  user: Pick<PublicUser, 'id' | 'username' | 'displayName'>;
  onPress?: () => void;
  right?: ReactNode;
  subtitle?: string;
}) {
  // The trailing action is a sibling of the tappable area, never nested inside it
  // (nested buttons are invalid on web and ambiguous for screen readers).
  return (
    <View style={styles.row}>
      <Pressable
        accessibilityRole={onPress ? 'button' : undefined}
        accessibilityLabel={`${user.displayName}, @${user.username}`}
        onPress={onPress}
        disabled={!onPress}
        style={({ pressed }) => [styles.main, pressed && { opacity: 0.6 }]}
      >
        <Avatar name={user.displayName} seed={user.username} />
        <View style={{ flex: 1 }}>
          <Text style={styles.name} numberOfLines={1}>{user.displayName}</Text>
          <Text style={styles.handle} numberOfLines={1}>{subtitle ?? `@${user.username}`}</Text>
        </View>
      </Pressable>
      {right}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.lg, minHeight: 64 },
  main: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: 10 },
  name: { fontFamily: fonts.bold, fontSize: 16, color: colors.ink },
  handle: { fontFamily: fonts.regular, fontSize: 14, color: colors.inkMuted, marginTop: 1 },
});
