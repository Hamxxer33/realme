import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { api } from './api';
import { secureStorage } from './secureStorage';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

const PREF_KEY = 'realme.notifications';

export async function notificationsEnabled() {
  return (await secureStorage.get(PREF_KEY).catch(() => null)) !== 'off';
}

/** Global on/off from Settings. Off removes this phone's push token from the server. */
export async function setNotificationsEnabled(on: boolean) {
  await secureStorage.set(PREF_KEY, on ? 'on' : 'off').catch(() => {});
  if (on) await registerForPush();
  else await api('PUT', '/me/push-token', { token: null });
}

/** Ask for permission and register this phone's push token. Silently skips where unsupported. */
export async function registerForPush() {
  if (!(await notificationsEnabled())) return;
  if (!Device.isDevice) return;
  const projectId = Constants.expoConfig?.extra?.eas?.projectId as string | undefined;
  if (!projectId) return; // set after `eas init`
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('messages', {
      name: 'Messages',
      importance: Notifications.AndroidImportance.HIGH,
    });
  }
  let { status } = await Notifications.getPermissionsAsync();
  if (status !== 'granted') ({ status } = await Notifications.requestPermissionsAsync());
  if (status !== 'granted') return;
  const { data } = await Notifications.getExpoPushTokenAsync({ projectId });
  await api('PUT', '/me/push-token', { token: data });
}
