import { sql } from 'drizzle-orm';
import { type AnyPgColumn, index, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';

// Everything a couple says to each other is stored only as ciphertext + nonce
// (see @realme/crypto). The server can route and order it but never read it.

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull(),
  // Argon2 hash of the client-derived auth secret — not of the password itself.
  authHash: text('auth_hash').notNull(),
  displayName: text('display_name').notNull(),
  publicKey: text('public_key').notNull(),
  // Secret key wrapped with a password-derived key the server never sees.
  keyBackupNonce: text('key_backup_nonce').notNull(),
  keyBackupCiphertext: text('key_backup_ciphertext').notNull(),
  coupleId: uuid('couple_id').references((): AnyPgColumn => couples.id, { onDelete: 'set null' }),
  pushToken: text('push_token'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [uniqueIndex('users_email_unique').on(sql`lower(${t.email})`)]);

export const couples = pgTable('couples', {
  id: uuid('id').primaryKey().defaultRandom(),
  inviterId: uuid('inviter_id').notNull().references((): AnyPgColumn => users.id, { onDelete: 'cascade' }),
  partnerId: uuid('partner_id').references((): AnyPgColumn => users.id, { onDelete: 'cascade' }),
  inviteCode: text('invite_code'),
  inviteExpiresAt: timestamp('invite_expires_at', { withTimezone: true }),
  // Encrypted couple settings (anniversary, couple name…) and who last wrote them,
  // which the reader needs to open the envelope.
  settingsNonce: text('settings_nonce'),
  settingsCiphertext: text('settings_ciphertext'),
  settingsUpdatedBy: uuid('settings_updated_by'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  pairedAt: timestamp('paired_at', { withTimezone: true }),
}, (t) => [uniqueIndex('couples_invite_code_unique').on(t.inviteCode)]);

export const messages = pgTable('messages', {
  id: uuid('id').primaryKey().defaultRandom(),
  coupleId: uuid('couple_id').notNull().references(() => couples.id, { onDelete: 'cascade' }),
  senderId: uuid('sender_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  // Client-generated id so a retried send doesn't create a duplicate.
  clientId: text('client_id').notNull(),
  nonce: text('nonce').notNull(),
  ciphertext: text('ciphertext').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  readAt: timestamp('read_at', { withTimezone: true }),
}, (t) => [
  index('messages_couple_created_idx').on(t.coupleId, t.createdAt, t.id),
  uniqueIndex('messages_sender_client_unique').on(t.senderId, t.clientId),
]);

export const memories = pgTable('memories', {
  id: uuid('id').primaryKey().defaultRandom(),
  coupleId: uuid('couple_id').notNull().references(() => couples.id, { onDelete: 'cascade' }),
  authorId: uuid('author_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  nonce: text('nonce').notNull(),
  ciphertext: text('ciphertext').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index('memories_couple_created_idx').on(t.coupleId, t.createdAt)]);
