import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { colors, fonts, radius, shadow, space, themed } from '../theme';
import { Icon, type IconName } from './Icon';

/** WhatsApp-style grouped settings: rounded sections of icon rows. */
export function Section({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <View style={{ gap: space.xs }}>
      {title ? <Text style={styles.sectionTitle}>{title}</Text> : null}
      <View style={styles.section}>{children}</View>
    </View>
  );
}

export function Row({ icon, title, subtitle, onPress, right, danger, accent, chevron }: {
  icon?: IconName;
  title: string;
  subtitle?: string;
  onPress?: () => void;
  right?: ReactNode;
  danger?: boolean;
  accent?: boolean;
  chevron?: boolean;
}) {
  const color = danger ? colors.danger : colors.ink;
  return (
    <View style={styles.rowWrap}>
      <Pressable
        accessibilityRole={onPress ? 'button' : undefined}
        accessibilityLabel={subtitle ? `${title}. ${subtitle}` : title}
        onPress={onPress}
        disabled={!onPress}
        style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.surfaceMuted }]}
      >
        {icon ? (
          accent
            ? <View style={styles.accentIcon}><Icon name={icon} color={colors.onRose} size={20} /></View>
            : <View style={styles.rowIcon}><Icon name={icon} color={danger ? colors.danger : colors.inkMuted} size={22} /></View>
        ) : null}
        <View style={{ flex: 1 }}>
          <Text style={[styles.rowTitle, { color }]}>{title}</Text>
          {subtitle ? <Text style={styles.rowSub}>{subtitle}</Text> : null}
        </View>
        {chevron ? <View style={{ transform: [{ rotate: '180deg' }] }}><Icon name="back" color={colors.inkMuted} size={18} /></View> : null}
      </Pressable>
      {right ? <View style={styles.rowRight}>{right}</View> : null}
    </View>
  );
}

export function Toggle({ value, onChange, label }: { value: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <Switch
      value={value}
      onValueChange={onChange}
      trackColor={{ true: colors.roseFill, false: colors.surfaceMuted }}
      thumbColor="#FFFFFF"
      ios_backgroundColor={colors.surfaceMuted}
      accessibilityLabel={label}
      // react-native-web colours the active thumb separately (teal by default).
      {...({ activeThumbColor: '#FFFFFF' } as object)}
    />
  );
}

const styles = themed(() => StyleSheet.create({
  sectionTitle: { fontFamily: fonts.bold, fontSize: 13, color: colors.inkMuted, marginLeft: space.md, textTransform: 'uppercase', letterSpacing: 0.8 },
  section: { backgroundColor: colors.surface, borderRadius: radius.lg, paddingVertical: space.xs, overflow: 'hidden', ...shadow, shadowOpacity: 0.04 },
  rowWrap: { flexDirection: 'row', alignItems: 'center' },
  row: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.md, paddingVertical: 12, minHeight: 56 },
  rowIcon: { width: 44, alignItems: 'center' },
  accentIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.roseFill, alignItems: 'center', justifyContent: 'center' },
  rowTitle: { fontFamily: fonts.bold, fontSize: 16 },
  rowSub: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 19, color: colors.inkMuted, marginTop: 1 },
  rowRight: { paddingRight: space.md, paddingLeft: space.sm },
}));
