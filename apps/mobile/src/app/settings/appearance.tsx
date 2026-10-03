import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { BackHeader } from '../../components/BackHeader';
import { Icon } from '../../components/Icon';
import { Section } from '../../components/SettingsList';
import { Screen } from '../../components/ui';
import { setAppearance, useAppearance, type AppearancePref } from '../../lib/appearance';
import { colors, fonts, space, themed } from '../../theme';

const OPTIONS: Array<{ id: AppearancePref; title: string; subtitle: string }> = [
  { id: 'system', title: 'Match phone', subtitle: 'Light by day, dark by night — follows your phone setting' },
  { id: 'light', title: 'Light', subtitle: 'Warm cream and rose' },
  { id: 'dark', title: 'Dark', subtitle: 'Deep plum, easy on the eyes at night' },
];

export default function Appearance() {
  const pref = useAppearance();
  return (
    <Screen>
      <BackHeader title="Appearance" />
      <ScrollView contentContainerStyle={styles.container}>
        <Section title="Theme">
          {OPTIONS.map((o) => {
            const on = pref === o.id;
            return (
              <Pressable
                key={o.id}
                accessibilityRole="radio"
                accessibilityState={{ checked: on }}
                accessibilityLabel={o.title}
                onPress={() => setAppearance(o.id)}
                style={({ pressed }) => [styles.option, pressed && { backgroundColor: colors.surfaceMuted }]}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.title}>{o.title}</Text>
                  <Text style={styles.sub}>{o.subtitle}</Text>
                </View>
                <View style={[styles.radio, on && styles.radioOn]}>
                  {on ? <Icon name="check" color={colors.onRose} size={14} strokeWidth={2.6} /> : null}
                </View>
              </Pressable>
            );
          })}
        </Section>
      </ScrollView>
    </Screen>
  );
}

const styles = themed(() => StyleSheet.create({
  container: { padding: space.md, gap: space.lg },
  option: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.md, paddingVertical: 14 },
  title: { fontFamily: fonts.bold, fontSize: 16, color: colors.ink },
  sub: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 19, color: colors.inkMuted, marginTop: 1 },
  radio: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: colors.inkMuted, alignItems: 'center', justifyContent: 'center' },
  radioOn: { backgroundColor: colors.roseFill, borderColor: colors.roseFill },
}));
