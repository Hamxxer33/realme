import { useCallback, useEffect, useRef, useState } from 'react';
import { api, type PostView } from './api';

/** The global timeline, or one person's posts. */
export function useFeed(username?: string) {
  const path = username ? `/users/${username}/posts` : '/posts';
  const [posts, setPosts] = useState<PostView[] | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const loadingMore = useRef(false);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const res = await api<{ posts: PostView[]; hasMore: boolean }>('GET', `${path}?limit=20`);
      setPosts(res.posts);
      setHasMore(res.hasMore);
    } finally {
      setRefreshing(false);
    }
  }, [path]);

  useEffect(() => {
    void refresh().catch(() => setPosts([]));
  }, [refresh]);

  const loadMore = useCallback(async () => {
    const last = posts?.[posts.length - 1];
    if (!last || !hasMore || loadingMore.current) return;
    loadingMore.current = true;
    try {
      const res = await api<{ posts: PostView[]; hasMore: boolean }>('GET', `${path}?limit=20&before=${last.id}`);
      setPosts((p) => [...(p ?? []), ...res.posts.filter((n) => !(p ?? []).some((o) => o.id === n.id))]);
      setHasMore(res.hasMore);
    } finally {
      loadingMore.current = false;
    }
  }, [posts, hasMore, path]);

  /** Optimistic like toggle; rolls back if the server refuses. */
  const toggleLike = useCallback((post: PostView) => {
    const liked = !post.likedByMe;
    const patch = (p: PostView) => (p.id === post.id ? { ...p, likedByMe: liked, likeCount: p.likeCount + (liked ? 1 : -1) } : p);
    setPosts((list) => list?.map(patch) ?? list);
    api(liked ? 'PUT' : 'DELETE', `/posts/${post.id}/like`).catch(() => {
      setPosts((list) => list?.map((p) => (p.id === post.id ? post : p)) ?? list);
    });
  }, []);

  const remove = useCallback((id: string) => setPosts((list) => list?.filter((p) => p.id !== id) ?? list), []);
  const prepend = useCallback((post: PostView) => setPosts((list) => [post, ...(list ?? [])]), []);

  return { posts, hasMore, refreshing, refresh, loadMore, toggleLike, remove, prepend };
}
