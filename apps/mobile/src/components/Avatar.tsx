import { StyleSheet, Text, View } from 'react-native';
import { colors, fonts, themed } from '../theme';
import { Icon } from './Icon';

// Soft, warm tints that all keep the plum-brown initials readable (AA at these sizes).
const TINTS = ['#F7D6DE', '#FBE3D2', '#E9DDF5', '#D9EDE4', '#FFF0C7', '#DCE8F7'];

function hash(text: string) {
  let h = 0;
  for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export function Avatar({ name, seed, size = 44 }: { name: string; seed: string; size?: number }) {
  const initials = name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? '').join('') || '?';
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no"
      style={[styles.circle, { width: size, height: size, borderRadius: size / 2, backgroundColor: TINTS[hash(seed) % TINTS.length] }]}
    >
      <Text style={[styles.text, { fontSize: size * 0.38 }]}>{initials}</Text>
    </View>
  );
}

/** Groups get one calm circle with a people icon — overlapping initials clip each other. */
export function GroupAvatar({ size = 44 }: { size?: number }) {
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no"
      style={[styles.circle, { width: size, height: size, borderRadius: size / 2, backgroundColor: colors.roseTint }]}
    >
      <Icon name="users" color={colors.rose} size={size * 0.5} />
    </View>
  );
}

/** Communities are rounded squares, so they never read as a person or a group chat. */
export function CommunityAvatar({ size = 44, announcements }: { size?: number; announcements?: boolean }) {
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no"
      style={[styles.circle, { width: size, height: size, borderRadius: size * 0.3, backgroundColor: announcements ? colors.roseFill : colors.roseTint }]}
    >
      <Icon name={announcements ? 'megaphone' : 'community'} color={announcements ? colors.onRose : colors.rose} size={size * 0.52} />
    </View>
  );
}

/** The right avatar for any chat: a person, a group, or a community's announcements. */
export function ConversationAvatar({ conv, title, seed, size = 44 }: {
  conv: { kind: 'direct' | 'group'; announcements: boolean };
  title: string;
  seed: string;
  size?: number;
}) {
  if (conv.announcements) return <CommunityAvatar size={size} announcements />;
  if (conv.kind === 'group') return <GroupAvatar size={size} />;
  return <Avatar name={title} seed={seed} size={size} />;
}

const styles = themed(() => StyleSheet.create({
  circle: { alignItems: 'center', justifyContent: 'center' },
  // Pastel circles in both themes, so initials stay dark ink.
  text: { fontFamily: fonts.bold, color: '#2E1E24' },
}));
