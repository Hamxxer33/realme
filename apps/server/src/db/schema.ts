import { sql } from 'drizzle-orm';
import { boolean, index, integer, jsonb, pgTable, primaryKey, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';

// Messages are stored only as ciphertext plus one wrapped key per member
// (see @realme/crypto). Timeline posts are public by design and stored as-is.

const ts = (name: string) => timestamp(name, { withTimezone: true });

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  username: text('username').notNull(), // lowercase, [a-z0-9_]
  email: text('email').notNull(),
  // Argon2 hash of the client-derived auth secret — not of the password itself.
  authHash: text('auth_hash').notNull(),
  displayName: text('display_name').notNull(),
  bio: text('bio').notNull().default(''),
  publicKey: text('public_key').notNull(),
  // Secret key wrapped with a password-derived key the server never sees.
  keyBackupNonce: text('key_backup_nonce').notNull(),
  keyBackupCiphertext: text('key_backup_ciphertext').notNull(),
  pushToken: text('push_token'),
  // Privacy: when off, others don't see when I've read their messages — and I don't see theirs.
  readReceipts: boolean('read_receipts').notNull().default(true),
  createdAt: ts('created_at').notNull().defaultNow(),
}, (t) => [
  uniqueIndex('users_email_unique').on(sql`lower(${t.email})`),
  uniqueIndex('users_username_unique').on(t.username),
]);

/**
 * A community bundles groups under one announcements group. Its members are
 * the announcements group's members; its admins are that group's admins.
 */
export const communities = pgTable('communities', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  description: text('description').notNull().default(''),
  createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt: ts('created_at').notNull().defaultNow(),
});

export const conversations = pgTable('conversations', {
  id: uuid('id').primaryKey().defaultRandom(),
  kind: text('kind', { enum: ['direct', 'group'] }).notNull(),
  title: text('title'), // groups only
  description: text('description').notNull().default(''),
  // Group settings: who may send messages, and who may change the name/description.
  adminsOnlyMessages: boolean('admins_only_messages').notNull().default(false),
  adminsOnlyEdit: boolean('admins_only_edit').notNull().default(false),
  communityId: uuid('community_id').references(() => communities.id, { onDelete: 'set null' }),
  // The community's announcements group (one per community; admins post, everyone reads).
  announcements: boolean('announcements').notNull().default(false),
  // For direct chats: "<smaller user id>:<larger user id>", so a pair has exactly one chat.
  directKey: text('direct_key'),
  createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt: ts('created_at').notNull().defaultNow(),
  lastMessageAt: ts('last_message_at'),
}, (t) => [
  uniqueIndex('conversations_direct_key_unique').on(t.directKey),
  index('conversations_community_idx').on(t.communityId),
]);

export const members = pgTable('conversation_members', {
  conversationId: uuid('conversation_id').notNull().references(() => conversations.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  role: text('role', { enum: ['admin', 'member'] }).notNull().default('member'),
  // 'pending' = a message request: shown in Requests until accepted.
  status: text('status', { enum: ['accepted', 'pending'] }).notNull(),
  joinedAt: ts('joined_at').notNull().defaultNow(),
  lastReadAt: ts('last_read_at'),
  // Per-member settings: no push notifications, and "clear chat" hides history before this moment.
  muted: boolean('muted').notNull().default(false),
  clearedAt: ts('cleared_at'),
}, (t) => [
  primaryKey({ columns: [t.conversationId, t.userId] }),
  index('members_user_idx').on(t.userId),
]);

export const messages = pgTable('messages', {
  id: uuid('id').primaryKey().defaultRandom(),
  conversationId: uuid('conversation_id').notNull().references(() => conversations.id, { onDelete: 'cascade' }),
  senderId: uuid('sender_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  // Client-generated id so a retried send doesn't create a duplicate.
  clientId: text('client_id').notNull(),
  nonce: text('nonce').notNull(),
  ciphertext: text('ciphertext').notNull(),
  // userId → { nonce, key }: each member's copy of the message key.
  keys: jsonb('keys').$type<Record<string, { nonce: string; key: string }>>().notNull(),
  createdAt: ts('created_at').notNull().defaultNow(),
}, (t) => [
  index('messages_conversation_created_idx').on(t.conversationId, t.createdAt, t.id),
  uniqueIndex('messages_sender_client_unique').on(t.senderId, t.clientId),
]);

/**
 * Group history shown inline in the chat ("Ana added Ben"). Plain metadata the
 * server already knows — never message content.
 */
export const conversationEvents = pgTable('conversation_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  conversationId: uuid('conversation_id').notNull().references(() => conversations.id, { onDelete: 'cascade' }),
  actorId: uuid('actor_id').references(() => users.id, { onDelete: 'set null' }),
  kind: text('kind', {
    enum: ['created', 'added', 'removed', 'left', 'joined', 'renamed', 'described', 'promoted', 'demoted', 'settings'],
  }).notNull(),
  targetId: uuid('target_id').references(() => users.id, { onDelete: 'set null' }),
  // renamed: the new name; settings: e.g. "messages:admins" / "edit:all".
  detail: text('detail'),
  createdAt: ts('created_at').notNull().defaultNow(),
}, (t) => [index('conversation_events_idx').on(t.conversationId, t.createdAt)]);

export const posts = pgTable('posts', {
  id: uuid('id').primaryKey().defaultRandom(),
  authorId: uuid('author_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  text: text('text').notNull(),
  mediaKey: text('media_key'),
  mediaWidth: integer('media_width'),
  mediaHeight: integer('media_height'),
  createdAt: ts('created_at').notNull().defaultNow(),
}, (t) => [
  index('posts_created_idx').on(t.createdAt, t.id),
  index('posts_author_idx').on(t.authorId, t.createdAt),
]);

export const likes = pgTable('post_likes', {
  postId: uuid('post_id').notNull().references(() => posts.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  createdAt: ts('created_at').notNull().defaultNow(),
}, (t) => [primaryKey({ columns: [t.postId, t.userId] })]);

export const comments = pgTable('post_comments', {
  id: uuid('id').primaryKey().defaultRandom(),
  postId: uuid('post_id').notNull().references(() => posts.id, { onDelete: 'cascade' }),
  authorId: uuid('author_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  text: text('text').notNull(),
  createdAt: ts('created_at').notNull().defaultNow(),
}, (t) => [index('comments_post_idx').on(t.postId, t.createdAt)]);

export const blocks = pgTable('blocks', {
  blockerId: uuid('blocker_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  blockedId: uuid('blocked_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  createdAt: ts('created_at').notNull().defaultNow(),
}, (t) => [primaryKey({ columns: [t.blockerId, t.blockedId] }), index('blocks_blocked_idx').on(t.blockedId)]);

export const reports = pgTable('reports', {
  id: uuid('id').primaryKey().defaultRandom(),
  reporterId: uuid('reporter_id').references(() => users.id, { onDelete: 'set null' }),
  targetUserId: uuid('target_user_id').references(() => users.id, { onDelete: 'set null' }),
  postId: uuid('post_id').references(() => posts.id, { onDelete: 'set null' }),
  commentId: uuid('comment_id').references(() => comments.id, { onDelete: 'set null' }),
  conversationId: uuid('conversation_id').references(() => conversations.id, { onDelete: 'set null' }),
  channelId: uuid('channel_id').references(() => channels.id, { onDelete: 'set null' }),
  channelPostId: uuid('channel_post_id').references(() => channelPosts.id, { onDelete: 'set null' }),
  reason: text('reason', { enum: ['spam', 'harassment', 'inappropriate', 'impersonation', 'underage', 'other'] }).notNull(),
  // Free text from the reporter. For encrypted chats this is the only way the
  // content reaches moderators: the reporter chooses what to share.
  details: text('details').notNull().default(''),
  createdAt: ts('created_at').notNull().defaultNow(),
  resolvedAt: ts('resolved_at'),
});

/** 24-hour status updates, encrypted like messages: one wrapped key per viewer. */
export const statuses = pgTable('statuses', {
  id: uuid('id').primaryKey().defaultRandom(),
  authorId: uuid('author_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  // The envelope is bound to `status:<clientId>`, so it can't be passed off as a chat message.
  clientId: text('client_id').notNull(),
  nonce: text('nonce').notNull(),
  ciphertext: text('ciphertext').notNull(),
  keys: jsonb('keys').$type<Record<string, { nonce: string; key: string }>>().notNull(),
  createdAt: ts('created_at').notNull().defaultNow(),
  expiresAt: ts('expires_at').notNull(),
}, (t) => [
  index('statuses_author_idx').on(t.authorId, t.createdAt),
  index('statuses_expires_idx').on(t.expiresAt),
  uniqueIndex('statuses_author_client_unique').on(t.authorId, t.clientId),
]);

export const statusViews = pgTable('status_views', {
  statusId: uuid('status_id').notNull().references(() => statuses.id, { onDelete: 'cascade' }),
  viewerId: uuid('viewer_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  viewedAt: ts('viewed_at').notNull().defaultNow(),
}, (t) => [primaryKey({ columns: [t.statusId, t.viewerId] })]);

/** Public one-way broadcasts. Not end-to-end encrypted: anyone can follow and read. */
export const channels = pgTable('channels', {
  id: uuid('id').primaryKey().defaultRandom(),
  ownerId: uuid('owner_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  description: text('description').notNull().default(''),
  createdAt: ts('created_at').notNull().defaultNow(),
  lastPostAt: ts('last_post_at'),
}, (t) => [index('channels_owner_idx').on(t.ownerId)]);

export const channelFollowers = pgTable('channel_followers', {
  channelId: uuid('channel_id').notNull().references(() => channels.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  muted: boolean('muted').notNull().default(false),
  lastSeenAt: ts('last_seen_at'),
  createdAt: ts('created_at').notNull().defaultNow(),
}, (t) => [primaryKey({ columns: [t.channelId, t.userId] }), index('channel_followers_user_idx').on(t.userId)]);

export const channelPosts = pgTable('channel_posts', {
  id: uuid('id').primaryKey().defaultRandom(),
  channelId: uuid('channel_id').notNull().references(() => channels.id, { onDelete: 'cascade' }),
  text: text('text').notNull(),
  mediaKey: text('media_key'),
  mediaWidth: integer('media_width'),
  mediaHeight: integer('media_height'),
  createdAt: ts('created_at').notNull().defaultNow(),
}, (t) => [index('channel_posts_channel_idx').on(t.channelId, t.createdAt, t.id)]);

export const channelReactions = pgTable('channel_reactions', {
  postId: uuid('post_id').notNull().references(() => channelPosts.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  emoji: text('emoji').notNull(),
  createdAt: ts('created_at').notNull().defaultNow(),
}, (t) => [primaryKey({ columns: [t.postId, t.userId] })]);

/**
 * One-to-one voice/video calls: the record behind the Calls tab and the
 * ringing state. Media flows peer-to-peer (or via TURN), encrypted with
 * DTLS-SRTP keys that the two phones agree on through end-to-end encrypted
 * signaling — the server never sees them.
 */
export const calls = pgTable('calls', {
  id: uuid('id').primaryKey().defaultRandom(),
  conversationId: uuid('conversation_id').notNull().references(() => conversations.id, { onDelete: 'cascade' }),
  callerId: uuid('caller_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  calleeId: uuid('callee_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  kind: text('kind', { enum: ['audio', 'video'] }).notNull(),
  createdAt: ts('created_at').notNull().defaultNow(),
  answeredAt: ts('answered_at'),
  endedAt: ts('ended_at'),
  endReason: text('end_reason', { enum: ['hangup', 'declined', 'cancelled', 'missed', 'failed'] }),
}, (t) => [
  index('calls_caller_idx').on(t.callerId, t.createdAt),
  index('calls_callee_idx').on(t.calleeId, t.createdAt),
]);
