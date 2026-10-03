import {
  Nunito_400Regular,
  Nunito_600SemiBold,
  Nunito_700Bold,
  Nunito_800ExtraBold,
  useFonts,
} from '@expo-google-fonts/nunito';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { useColorScheme } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { resetConversations, startConversationSync } from '../lib/conversations';
import { SessionProvider, useSession } from '../lib/session';
import { loadAppearance, useAppearance } from '../lib/appearance';
import { colors, setScheme, type Scheme } from '../theme';

void SplashScreen.preventAutoHideAsync();

void loadAppearance();

export default function RootLayout() {
  const [fontsLoaded] = useFonts({ Nunito_400Regular, Nunito_600SemiBold, Nunito_700Bold, Nunito_800ExtraBold });
  const pref = useAppearance();
  const system = useColorScheme();
  const scheme: Scheme = pref === 'system' ? (system === 'dark' ? 'dark' : 'light') : pref;
  // Styles are built per scheme; set it before anything below renders, and
  // remount the tree when it changes so every screen picks up the new palette.
  setScheme(scheme);
  return (
    // The session lives outside the remounted part, so switching themes doesn't sign you out or reconnect.
    <SessionProvider>
      <GestureHandlerRootView key={scheme} style={{ flex: 1, backgroundColor: colors.bg }}>
        <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
        {fontsLoaded ? <Routes /> : null}
      </GestureHandlerRootView>
    </SessionProvider>
  );
}

function Routes() {
  const { status, me } = useSession();

  useEffect(() => {
    if (status !== 'loading') void SplashScreen.hideAsync();
    if (status === 'signedIn' && me) startConversationSync(me.id);
    if (status === 'signedOut') resetConversations();
  }, [status, me]);

  if (status === 'loading') return null;
  const signedIn = status === 'signedIn';

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg }, animation: 'slide_from_right' }}>
      <Stack.Protected guard={!signedIn}>
        <Stack.Screen name="welcome" options={{ animation: 'fade' }} />
        <Stack.Screen name="sign-up" />
        <Stack.Screen name="sign-in" />
      </Stack.Protected>
      <Stack.Protected guard={signedIn}>
        <Stack.Screen name="(tabs)" options={{ animation: 'fade' }} />
        <Stack.Screen name="chat/[id]" />
        <Stack.Screen name="chat-info/[id]" />
        <Stack.Screen name="verify/[id]" />
        <Stack.Screen name="members/[id]" />
        <Stack.Screen name="group-settings/[id]" />
        <Stack.Screen name="group-edit/[id]" options={{ presentation: 'modal' }} />
        <Stack.Screen name="add-to-group" options={{ presentation: 'modal' }} />
        <Stack.Screen name="new-chat" options={{ presentation: 'modal' }} />
        <Stack.Screen name="new-group" options={{ presentation: 'modal' }} />
        <Stack.Screen name="requests" />
        <Stack.Screen name="user/[username]" />
        <Stack.Screen name="post/[id]" />
        <Stack.Screen name="compose" options={{ presentation: 'modal' }} />
        <Stack.Screen name="blocked" />
        <Stack.Screen name="settings/edit-profile" />
        <Stack.Screen name="settings/account" />
        <Stack.Screen name="settings/privacy" />
        <Stack.Screen name="settings/appearance" />
        <Stack.Screen name="settings/notifications" />
        <Stack.Screen name="settings/help" />
        <Stack.Screen name="channel/[id]" />
        <Stack.Screen name="channel-info/[id]" />
        <Stack.Screen name="channels-explore" />
        <Stack.Screen name="channel-new" options={{ presentation: 'modal' }} />
        <Stack.Screen name="community/[id]" />
        <Stack.Screen name="community-new" options={{ presentation: 'modal' }} />
        <Stack.Screen name="community-group-new" options={{ presentation: 'modal' }} />
        <Stack.Screen name="call" options={{ presentation: 'fullScreenModal', animation: 'fade', gestureEnabled: false }} />
        <Stack.Screen name="new-call" options={{ presentation: 'modal' }} />
        <Stack.Screen name="photo" options={{ presentation: 'fullScreenModal', animation: 'fade' }} />
        <Stack.Screen name="status/[authorId]" options={{ presentation: 'fullScreenModal', animation: 'fade' }} />
        <Stack.Screen name="status-compose" options={{ presentation: 'fullScreenModal', animation: 'slide_from_bottom' }} />
      </Stack.Protected>
    </Stack>
  );
}
