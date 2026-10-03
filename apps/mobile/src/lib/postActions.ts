import { router } from 'expo-router';
import { ActionSheetIOS, Alert, Platform } from 'react-native';
import { api, type PostView } from './api';
import { confirm, notify } from './confirm';

/** "…" menu on a post: delete your own, or report/block someone else's. */
export function postMenu(post: PostView, myId: string, handlers: { onDeleted: () => void; onReport: () => void }) {
  const mine = post.author.id === myId;
  const options = mine ? ['Delete post', 'Cancel'] : [`View @${post.author.username}`, 'Report post', 'Cancel'];
  const run = async (i: number) => {
    if (mine && i === 0) {
      if (!(await confirm('Delete this post?', 'It will be removed for everyone.', 'Delete'))) return;
      try {
        await api('DELETE', `/posts/${post.id}`);
        handlers.onDeleted();
      } catch {
        notify("Couldn't delete post");
      }
    }
    if (!mine && i === 0) router.push(`/user/${post.author.username}`);
    if (!mine && i === 1) handlers.onReport();
  };
  if (Platform.OS === 'ios') {
    ActionSheetIOS.showActionSheetWithOptions(
      { options, cancelButtonIndex: options.length - 1, destructiveButtonIndex: mine ? 0 : 1 },
      (i) => void run(i),
    );
  } else if (Platform.OS === 'web') {
    // Simple fallback for the web preview.
    if (mine) void run(0);
    else void run(1);
  } else {
    // Android: an Alert with one button per action keeps it native without extra dependencies.
    Alert.alert('Post', undefined, [
      ...options.slice(0, -1).map((text, i) => ({ text, onPress: () => void run(i) })),
      { text: 'Cancel', style: 'cancel' as const },
    ]);
  }
}
