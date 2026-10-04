/** The live server on Railway. Override with EXPO_PUBLIC_API_URL (apps/mobile/.env) to use a local one. */
const PRODUCTION_API_URL = 'https://server-production-403b.up.railway.app';
const raw = process.env.EXPO_PUBLIC_API_URL || PRODUCTION_API_URL;

export const API_URL = raw.replace(/\/$/, '');
export const WS_URL = API_URL.replace(/^http/, 'ws') + '/ws';
