import { forwardRef, type ReactNode } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type PressableProps,
  type StyleProp,
  type TextInputProps,
  type TextProps,
  type ViewStyle,
} from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { noWebOutline, colors, fonts, motion, radius, shadow, space, themed } from '../theme';

export function Screen({ children, style, edges = ['top', 'bottom'] }: {
  children: ReactNode;
  style?: ViewStyle;
  /** Tab screens skip the bottom edge — the tab bar handles it. */
  edges?: Array<'top' | 'bottom'>;
}) {
  return (
    <SafeAreaView style={[styles.screen, style]} edges={edges}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {children}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

export function Title({ style, ...props }: TextProps) {
  return <Text accessibilityRole="header" style={[styles.title, style]} {...props} />;
}

export function Body({ muted, style, ...props }: TextProps & { muted?: boolean }) {
  return <Text style={[styles.body, muted && { color: colors.inkMuted }, style]} {...props} />;
}

export function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <View style={styles.eyebrow}>
      <Text style={styles.eyebrowText}>{children}</Text>
    </View>
  );
}

/** Tactile press: scales down slightly on a spring, never a flat opacity flash. */
export function PressScale({ children, style, disabled, ...props }: Omit<PressableProps, 'style' | 'children'> & {
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
}) {
  const scale = useSharedValue(1);
  const animated = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <Pressable
      disabled={disabled}
      onPressIn={() => (scale.value = withSpring(0.96, motion.spring))}
      onPressOut={() => (scale.value = withSpring(1, motion.spring))}
      {...props}
    >
      <Animated.View style={[style, animated, disabled && { opacity: 0.5 }]}>{children}</Animated.View>
    </Pressable>
  );
}

export function Button({ title, onPress, loading, variant = 'primary', disabled }: {
  title: string;
  onPress: () => void;
  loading?: boolean;
  variant?: 'primary' | 'ghost';
  disabled?: boolean;
}) {
  const primary = variant === 'primary';
  return (
    <PressScale
      accessibilityRole="button"
      accessibilityLabel={title}
      onPress={onPress}
      disabled={disabled || loading}
      style={[styles.button, primary ? styles.buttonPrimary : styles.buttonGhost]}
    >
      {loading ? (
        <ActivityIndicator color={primary ? colors.onRose : colors.rose} />
      ) : (
        <Text style={[styles.buttonText, { color: primary ? colors.onRose : colors.rose }]}>{title}</Text>
      )}
    </PressScale>
  );
}

export const Field = forwardRef<TextInput, TextInputProps & { label: string; error?: string | null }>(
  function Field({ label, error, style, ...props }, ref) {
    return (
      <View style={{ gap: space.xs }}>
        <Text style={styles.label}>{label}</Text>
        <TextInput
          ref={ref}
          placeholderTextColor={colors.inkMuted}
          style={[styles.input, error ? { borderColor: colors.danger } : null, style]}
          accessibilityLabel={label}
          {...props}
        />
        {error ? <Text style={styles.error}>{error}</Text> : null}
      </View>
    );
  },
);

export function Card({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function ErrorText({ children }: { children: ReactNode }) {
  if (!children) return null;
  return <Text accessibilityRole="alert" style={styles.error}>{children}</Text>;
}

const styles = themed(() => StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  title: { fontFamily: fonts.heavy, fontSize: 34, lineHeight: 40, color: colors.ink, letterSpacing: -0.5 },
  body: { fontFamily: fonts.regular, fontSize: 16, lineHeight: 24, color: colors.ink },
  eyebrow: {
    alignSelf: 'flex-start',
    backgroundColor: colors.roseTint,
    borderRadius: radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  eyebrowText: { fontFamily: fonts.bold, fontSize: 11, letterSpacing: 1.6, textTransform: 'uppercase', color: colors.rose },
  button: { minHeight: 54, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', paddingHorizontal: space.lg },
  buttonPrimary: { backgroundColor: colors.roseFill, ...shadow },
  buttonGhost: { backgroundColor: 'transparent' },
  buttonText: { fontFamily: fonts.bold, fontSize: 16 },
  label: { fontFamily: fonts.medium, fontSize: 14, color: colors.inkMuted, marginLeft: 4 },
  input: { ...noWebOutline,
    minHeight: 54,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.surface,
    paddingHorizontal: space.md,
    fontFamily: fonts.regular,
    fontSize: 16,
    color: colors.ink,
  },
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: space.lg, ...shadow },
  error: { fontFamily: fonts.medium, fontSize: 14, color: colors.danger, marginLeft: 4 },
}));
