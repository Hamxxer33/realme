import { StyleSheet, TextInput, View } from 'react-native';
import { noWebOutline, colors, fonts, radius, shadow, space } from '../theme';
import { Icon } from './Icon';

export function SearchField({ value, onChangeText, autoFocus }: { value: string; onChangeText: (t: string) => void; autoFocus?: boolean }) {
  return (
    <View style={styles.box}>
      <Icon name="search" color={colors.inkMuted} size={20} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder="Search @username or name"
        placeholderTextColor={colors.inkMuted}
        autoCapitalize="none"
        autoCorrect={false}
        autoFocus={autoFocus}
        style={styles.input}
        accessibilityLabel="Search people"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    flexDirection: 'row', alignItems: 'center', gap: space.sm, marginHorizontal: space.lg, marginVertical: space.sm,
    paddingHorizontal: space.md, height: 48, borderRadius: radius.pill, backgroundColor: colors.surface, ...shadow, shadowOpacity: 0.05,
  },
  input: { ...noWebOutline, flex: 1, fontFamily: fonts.regular, fontSize: 16, color: colors.ink, height: '100%' },
});
