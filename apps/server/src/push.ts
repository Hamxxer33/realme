export interface Push {
  send(pushToken: string, title: string, body: string): Promise<void>;
}

/**
 * Expo push notifications. Message content is end-to-end encrypted, so the
 * notification never contains it — only that something new arrived.
 */
export function expoPush(accessToken?: string): Push {
  return {
    async send(to, title, body) {
      try {
        const res = await fetch('https://exp.host/--/api/v2/push/send', {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            ...(accessToken ? { authorization: `Bearer ${accessToken}` } : {}),
          },
          body: JSON.stringify({ to, title, body, sound: 'default', priority: 'high' }),
        });
        if (!res.ok) console.warn(`push failed: ${res.status}`);
      } catch (err) {
        console.warn('push failed', err);
      }
    },
  };
}
