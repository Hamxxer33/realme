/** Set EXPO_PUBLIC_API_URL in apps/mobile/.env, e.g. https://realme-api.up.railway.app */
const raw = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8787';

export const API_URL = raw.replace(/\/$/, '');
export const WS_URL = API_URL.replace(/^http/, 'ws') + '/ws';
