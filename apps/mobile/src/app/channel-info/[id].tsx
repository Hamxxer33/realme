import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Avatar } from '../../components/Avatar';
import { BackHeader } from '../../components/BackHeader';
import { FollowButton } from '../../components/ChannelRow';
import { ReportSheet, type ReportTarget } from '../../components/ReportSheet';
import { Row, Section, Toggle } from '../../components/SettingsList';
import { Screen } from '../../components/ui';
import { api, type ChannelView } from '../../lib/api';
import { follow, followerLabel } from '../../lib/channels';
import { confirm, notify } from '../../lib/confirm';
import { colors, fonts, space, themed } from '../../theme';

export default function ChannelInfo() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [channel, setChannel] = useState<ChannelView | null>(null);
  const [report, setReport] = useState<ReportTarget | null>(null);

  useFocusEffect(useCallback(() => {
    api<{ channel: ChannelView }>('GET', `/channels/${id}`).then((r) => setChannel(r.channel), () => router.back());
  }, [id]));

  if (!channel) return <Screen><BackHeader title="" /></Screen>;

  const toggleFollow = async () => {
    try {
      setChannel(await follow(channel, !channel.following));
    } catch (e) {
      notify("Couldn't update", e instanceof Error ? e.message : undefined);
    }
  };
  const setMuted = async (muted: boolean) => {
    setChannel({ ...channel, muted });
    try {
      setChannel((await api<{ channel: ChannelView }>('PATCH', `/channels/${channel.id}/me`, { muted })).channel);
    } catch {
      setChannel(channel);
    }
  };
  const remove = async () => {
    if (!(await confirm(`Delete ${channel.name}?`, 'All updates will be deleted and followers will lose the channel. This can’t be undone.', 'Delete channel'))) return;
    try {
      await api('DELETE', `/channels/${channel.id}`);
      router.dismissAll();
    } catch {
      notify("Couldn't delete");
    }
  };

  return (
    <Screen>
      <BackHeader title="" />
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.hero}>
          <Avatar name={channel.name} seed={channel.id} size={104} />
          <Text accessibilityRole="header" style={styles.name}>{channel.name}</Text>
          <Text style={styles.sub}>Channel · {followerLabel(channel.followerCount)}</Text>
          {!channel.isOwner ? (
            <View style={{ marginTop: space.md }}>
              <FollowButton following={channel.following} name={channel.name} onPress={() => void toggleFollow()} />
            </View>
          ) : null}
        </View>

        <Section>
          {channel.description ? <Text style={styles.description}>{channel.description}</Text> : null}
          <Text style={styles.meta}>
            Created by {channel.isOwner ? 'you' : channel.owner.displayName} · {new Date(channel.createdAt).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' })}
          </Text>
        </Section>

        <Section>
          {channel.following ? (
            <Row icon={channel.muted ? 'bellOff' : 'bell'} title="Notifications" subtitle={channel.muted ? 'Muted' : 'On'}
              right={<Toggle value={!channel.muted} onChange={(on) => void setMuted(!on)} label="Notifications" />} />
          ) : null}
          <Row icon="user" title={`@${channel.owner.username}`} subtitle="Channel owner" chevron onPress={() => router.push(`/user/${channel.owner.username}`)} />
          <Row icon="eye" title="Public channel" subtitle="Anyone can find and follow this channel. Updates are not end-to-end encrypted." />
        </Section>

        <Section>
          {channel.isOwner ? (
            <>
              <Row icon="edit" title="Edit channel" onPress={() => router.push({ pathname: '/channel-new', params: { id: channel.id } })} />
              <Row icon="trash" danger title="Delete channel" onPress={() => void remove()} />
            </>
          ) : (
            <>
              {channel.following ? <Row icon="logout" danger title="Unfollow channel" onPress={() => void toggleFollow()} /> : null}
              <Row icon="flag" danger title="Report channel" onPress={() => setReport({ channelId: channel.id, label: channel.name })} />
            </>
          )}
        </Section>
      </ScrollView>
      <ReportSheet target={report} onClose={() => setReport(null)} />
    </Screen>
  );
}

const styles = themed(() => StyleSheet.create({
  container: { paddingHorizontal: space.md, paddingBottom: space.xxl, gap: space.md },
  hero: { alignItems: 'center', paddingBottom: space.sm },
  name: { fontFamily: fonts.heavy, fontSize: 26, color: colors.ink, marginTop: space.md, textAlign: 'center' },
  sub: { fontFamily: fonts.medium, fontSize: 15, color: colors.inkMuted, marginTop: 2 },
  description: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 22, color: colors.ink, paddingHorizontal: space.md, paddingTop: space.sm },
  meta: { fontFamily: fonts.regular, fontSize: 13, color: colors.inkMuted, paddingHorizontal: space.md, paddingTop: space.xs, paddingBottom: space.sm },
}));
