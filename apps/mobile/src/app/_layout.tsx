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
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SessionProvider, useSession } from '../lib/session';
import { colors } from '../theme';

void SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded] = useFonts({ Nunito_400Regular, Nunito_600SemiBold, Nunito_700Bold, Nunito_800ExtraBold });
  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.bg }}>
      <SessionProvider>
        <StatusBar style="dark" />
        {fontsLoaded ? <Routes /> : null}
      </SessionProvider>
    </GestureHandlerRootView>
  );
}

function Routes() {
  const { status, me } = useSession();
  const paired = Boolean(me?.couple?.paired);

  useEffect(() => {
    if (status !== 'loading') void SplashScreen.hideAsync();
  }, [status]);

  if (status === 'loading') return null;

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg }, animation: 'slide_from_right' }}>
      <Stack.Protected guard={status === 'signedOut'}>
        <Stack.Screen name="welcome" options={{ animation: 'fade' }} />
        <Stack.Screen name="sign-up" />
        <Stack.Screen name="sign-in" />
      </Stack.Protected>
      <Stack.Protected guard={status === 'signedIn' && !paired}>
        <Stack.Screen name="pair" options={{ animation: 'fade' }} />
      </Stack.Protected>
      <Stack.Protected guard={status === 'signedIn' && paired}>
        <Stack.Screen name="index" options={{ animation: 'fade' }} />
        <Stack.Screen name="memories" />
        <Stack.Screen name="memory-new" options={{ presentation: 'modal' }} />
        <Stack.Screen name="settings" />
        <Stack.Screen name="photo" options={{ presentation: 'fullScreenModal', animation: 'fade' }} />
      </Stack.Protected>
    </Stack>
  );
}
