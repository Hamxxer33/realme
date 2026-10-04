import { Linking } from 'react-native';
import { API_URL } from './config';

/** Public policy pages, served by the Lovenest server (apps/server/src/routes/pages.ts). */
export const LINKS = {
  privacy: `${API_URL}/privacy`,
  terms: `${API_URL}/terms`,
  childSafety: `${API_URL}/child-safety`,
  deleteAccount: `${API_URL}/delete-account`,
  support: 'mailto:hz3302m@gmail.com?subject=Lovenest%20support',
};

export const openLink = (url: string) => void Linking.openURL(url).catch(() => {});
