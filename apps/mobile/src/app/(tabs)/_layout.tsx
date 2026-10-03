import { Tabs } from 'expo-router/js-tabs';
import { useEffect } from 'react';
import { Icon } from '../../components/Icon';
import { useConversations } from '../../lib/conversations';
import { registerForPush } from '../../lib/push';
import { colors, fonts } from '../../theme';

export default function TabsLayout() {
  const { chats, requests } = useConversations();
  const unread = (chats ?? []).reduce((n, c) => n + c.unreadCount, 0) + (requests?.length ?? 0);

  useEffect(() => {
    void registerForPush().catch(() => {});
  }, []);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: colors.bg },
        tabBarActiveTintColor: colors.rose,
        tabBarInactiveTintColor: colors.inkMuted,
        tabBarLabelStyle: { fontFamily: fonts.bold, fontSize: 12, lineHeight: 16 },
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
          tabBarBadgeStyle: { backgroundColor: colors.rose, fontFamily: fonts.bold, fontSize: 11 },
        }}
      />
      <Tabs.Screen name="timeline" options={{ title: 'Timeline', tabBarIcon: ({ color }) => <Icon name="feed" color={String(color)} /> }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile', tabBarIcon: ({ color }) => <Icon name="user" color={String(color)} /> }} />
    </Tabs>
  );
}
