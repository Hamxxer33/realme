import { router } from 'expo-router';
import { Tabs } from 'expo-router/js-tabs';
import { useEffect } from 'react';
import { Icon } from '../../components/Icon';
import { useConversations } from '../../lib/conversations';
import { calls, useCall } from '../../lib/calls';
import { registerForPush } from '../../lib/push';
import { useSession } from '../../lib/session';
import { colors, fonts } from '../../theme';

export default function TabsLayout() {
  const { chats, requests } = useConversations();
  const unread = (chats ?? []).reduce((n, c) => n + c.unreadCount, 0) + (requests?.length ?? 0);

  useEffect(() => {
    void registerForPush().catch(() => {});
  }, []);

  // Calls: seal signaling with my keys, and show the call screen when someone rings.
  const { me, encryptFor, decrypt } = useSession();
  useEffect(() => {
    calls.attach(me ? {
      myId: me.id,
      seal: (callId, peer, signal) => encryptFor(`call:${callId}`, [peer], signal),
      open: (callId, from, peerKey, payload) =>
        decrypt({ ...payload, key: payload.keys[me.id] ?? null, conversationId: `call:${callId}`, senderId: from }, peerKey),
    } : null);
  }, [me, encryptFor, decrypt]);
  const { phase } = useCall();
  useEffect(() => {
    if (phase === 'incoming') router.push('/call');
  }, [phase]);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: colors.bg },
        tabBarActiveTintColor: colors.rose,
        tabBarInactiveTintColor: colors.inkMuted,
        tabBarLabelStyle: { fontFamily: fonts.bold, fontSize: 11, lineHeight: 16 },
        // Nunito's tall line height needs explicit room, or the labels clip.
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.hairline, height: 72, paddingTop: 8, paddingBottom: 12 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Chats',
          tabBarIcon: ({ color }) => <Icon name="chat" color={String(color)} />,
          tabBarBadge: unread ? (unread > 99 ? '99+' : unread) : undefined,
          tabBarBadgeStyle: { backgroundColor: colors.roseFill, fontFamily: fonts.bold, fontSize: 11 },
        }}
      />
      <Tabs.Screen name="updates" options={{ title: 'Updates', tabBarIcon: ({ color }) => <Icon name="updates" color={String(color)} /> }} />
      <Tabs.Screen name="communities" options={{ title: 'Communities', tabBarIcon: ({ color }) => <Icon name="community" color={String(color)} /> }} />
      <Tabs.Screen name="calls" options={{ title: 'Calls', tabBarIcon: ({ color }) => <Icon name="phone" color={String(color)} /> }} />
      <Tabs.Screen name="profile" options={{ title: 'You', tabBarIcon: ({ color }) => <Icon name="user" color={String(color)} /> }} />
    </Tabs>
  );
}
