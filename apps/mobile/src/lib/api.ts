import type { Sealed, WrappedKey } from '@realme/crypto';
import { API_URL } from './config';

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

let authToken: string | null = null;
let onUnauthorized: (() => void) | null = null;

export function setAuthToken(token: string | null) {
  authToken = token;
}

export function setUnauthorizedHandler(fn: (() => void) | null) {
  onUnauthorized = fn;
}

export async function api<T>(method: string, path: string, body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(API_URL + path, {
      method,
      headers: {
        'content-type': 'application/json',
        ...(authToken ? { authorization: `Bearer ${authToken}` } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, "Can't reach the server. Check your connection.");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401 && authToken) onUnauthorized?.();
    throw new ApiError(res.status, (data as { error?: string }).error ?? 'Something went wrong');
  }
  return data as T;
}

// ---- response shapes (mirror apps/server/src/routes) ----

export interface PublicUser {
  id: string;
  username: string;
  displayName: string;
  bio: string;
  publicKey: string;
}

export interface Me extends PublicUser {
  email: string;
  readReceipts: boolean;
}

export interface MemberView extends PublicUser {
  role: 'admin' | 'member';
  status: 'accepted' | 'pending';
  lastReadAt: string | null;
}

export interface MessageRow extends Sealed {
  id: string;
  conversationId: string;
  senderId: string;
  clientId: string;
  key: WrappedKey | null; // my copy; null if I joined after it was sent
  createdAt: string;
}

export interface ConversationView {
  id: string;
  kind: 'direct' | 'group';
  title: string | null;
  description: string;
  adminsOnlyMessages: boolean;
  adminsOnlyEdit: boolean;
  createdBy: { id: string; displayName: string; username: string } | null;
  community: { id: string; name: string } | null;
  announcements: boolean;
  createdAt: string;
  lastMessageAt: string | null;
  myStatus: 'accepted' | 'pending';
  myRole: 'admin' | 'member';
  myMuted: boolean;
  members: MemberView[];
  lastMessage: MessageRow | null;
  unreadCount: number;
}

export interface GroupEvent {
  id: string;
  kind: 'created' | 'added' | 'removed' | 'left' | 'joined' | 'renamed' | 'described' | 'promoted' | 'demoted' | 'settings';
  actor: { id: string; displayName: string } | null;
  target: { id: string; displayName: string } | null;
  detail: string | null;
  createdAt: string;
}

export interface ChannelView {
  id: string;
  name: string;
  description: string;
  owner: PublicUser;
  isOwner: boolean;
  followerCount: number;
  following: boolean;
  muted: boolean;
  unreadCount: number;
  createdAt: string;
  lastPostAt: string | null;
  lastPost: { text: string; hasMedia: boolean } | null;
}

export interface ChannelPost {
  id: string;
  channelId: string;
  text: string;
  media: { objectKey: string; width: number | null; height: number | null } | null;
  createdAt: string;
  reactions: Record<string, number>;
  myReaction: string | null;
}

export const CHANNEL_REACTIONS = ['❤️', '👍', '😂', '😮', '😢', '🙏'] as const;

export interface CommunityGroup {
  id: string;
  title: string;
  description: string;
  memberCount: number;
  joined: boolean;
}

export interface CommunityView {
  id: string;
  name: string;
  description: string;
  createdAt: string;
  announcementsId: string;
  myRole: 'admin' | 'member';
  myStatus: 'accepted' | 'pending';
  memberCount: number;
  groups: CommunityGroup[];
}

export interface PostView {
  id: string;
  text: string;
  media: { objectKey: string; width: number | null; height: number | null } | null;
  createdAt: string;
  author: PublicUser;
  likeCount: number;
  commentCount: number;
  likedByMe: boolean;
}

export interface CommentView {
  id: string;
  text: string;
  createdAt: string;
  author: PublicUser;
}

export type ReportReason = 'spam' | 'harassment' | 'inappropriate' | 'impersonation' | 'underage' | 'other';
