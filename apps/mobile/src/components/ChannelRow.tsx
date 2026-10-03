import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { ChannelView } from '../lib/api';
import { followerLabel } from '../lib/channels';
import { shortTime } from '../lib/format';
import { colors, fonts, radius, space, themed } from '../theme';
import { Avatar } from './Avatar';

/** A channel in a list: latest post for ones you follow, follower count otherwise. */
export function ChannelRow({ channel, onPress, action }: { channel: ChannelView; onPress: () => void; action?: React.ReactNode }) {
  const unread = channel.unreadCount > 0;
  const preview = channel.following || channel.isOwner
    ? channel.lastPost ? (channel.lastPost.hasMedia ? `📷 ${channel.lastPost.text || 'Photo'}` : channel.lastPost.text) : 'No updates yet'
    : followerLabel(channel.followerCount);
  return (
    <View style={styles.wrap}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${channel.name}${unread ? `, ${channel.unreadCount} new` : ''}`}
        onPress={onPress}
        style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.surfaceMuted }]}
      >
        <Avatar name={channel.name} seed={channel.id} size={50} />
        <View style={{ flex: 1, gap: 2 }}>
          <View style={styles.top}>
            <Text style={[styles.name, unread && { fontFamily: fonts.heavy }]} numberOfLines={1}>{channel.name}</Text>
            {channel.lastPostAt && (channel.following || channel.isOwner)
              ? <Text style={[styles.time, unread && { color: colors.rose }]}>{shortTime(channel.lastPostAt)}</Text> : null}
          </View>
          <View style={styles.top}>
            <Text style={[styles.preview, unread && { color: colors.ink }]} numberOfLines={1}>{preview}</Text>
            {unread ? <View style={styles.badge}><Text style={styles.badgeText}>{channel.unreadCount > 99 ? '99+' : channel.unreadCount}</Text></View> : null}
          </View>
        </View>
      </Pressable>
      {action ? <View style={styles.action}>{action}</View> : null}
    </View>
  );
}

export function FollowButton({ following, onPress, name }: { following: boolean; onPress: () => void; name: string }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={following ? `Unfollow ${name}` : `Follow ${name}`}
      onPress={onPress}
      style={[styles.follow, following && styles.following]}
    >
      <Text style={[styles.followText, following && { color: colors.ink }]}>{following ? 'Following' : 'Follow'}</Text>
    </Pressable>
  );
}

const styles = themed(() => StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center' },
  row: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: 10, paddingHorizontal: space.sm, borderRadius: radius.md },
  top: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  name: { flex: 1, fontFamily: fonts.bold, fontSize: 16, color: colors.ink },
  time: { fontFamily: fonts.medium, fontSize: 12, color: colors.inkMuted },
  preview: { flex: 1, fontFamily: fonts.regular, fontSize: 14, color: colors.inkMuted },
  badge: { minWidth: 22, height: 22, borderRadius: 11, paddingHorizontal: 6, backgroundColor: colors.roseFill, alignItems: 'center', justifyContent: 'center' },
  badgeText: { fontFamily: fonts.bold, fontSize: 12, color: colors.onRose },
  action: { paddingLeft: space.sm },
  follow: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: radius.pill, backgroundColor: colors.roseFill },
  following: { backgroundColor: colors.surfaceMuted },
  followText: { fontFamily: fonts.bold, fontSize: 14, color: colors.onRose },
}));
