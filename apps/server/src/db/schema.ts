import { sql } from 'drizzle-orm';
import { index, integer, jsonb, pgTable, primaryKey, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';

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
  createdAt: ts('created_at').notNull().defaultNow(),
}, (t) => [
  uniqueIndex('users_email_unique').on(sql`lower(${t.email})`),
  uniqueIndex('users_username_unique').on(t.username),
]);

export const conversations = pgTable('conversations', {
  id: uuid('id').primaryKey().defaultRandom(),
  kind: text('kind', { enum: ['direct', 'group'] }).notNull(),
  title: text('title'), // groups only
  // For direct chats: "<smaller user id>:<larger user id>", so a pair has exactly one chat.
  directKey: text('direct_key'),
  createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt: ts('created_at').notNull().defaultNow(),
  lastMessageAt: ts('last_message_at'),
}, (t) => [uniqueIndex('conversations_direct_key_unique').on(t.directKey)]);

export const members = pgTable('conversation_members', {
  conversationId: uuid('conversation_id').notNull().references(() => conversations.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  role: text('role', { enum: ['admin', 'member'] }).notNull().default('member'),
  // 'pending' = a message request: shown in Requests until accepted.
  status: text('status', { enum: ['accepted', 'pending'] }).notNull(),
  joinedAt: ts('joined_at').notNull().defaultNow(),
  lastReadAt: ts('last_read_at'),
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
  reason: text('reason', { enum: ['spam', 'harassment', 'inappropriate', 'impersonation', 'underage', 'other'] }).notNull(),
  // Free text from the reporter. For encrypted chats this is the only way the
  // content reaches moderators: the reporter chooses what to share.
  details: text('details').notNull().default(''),
  createdAt: ts('created_at').notNull().defaultNow(),
  resolvedAt: ts('resolved_at'),
});
