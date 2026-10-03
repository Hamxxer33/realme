# Realme

An end-to-end encrypted messenger with a public timeline. Find people by
@username, chat one-on-one or in groups (photos, voice notes, reactions, a
"thinking of you" heart), and share moments on the timeline.

<p>
  <img src="docs/screenshots/16-chats-list.png" width="200" alt="Chat list">
  <img src="docs/screenshots/10-dm-chat.png" width="200" alt="Chat">
  <img src="docs/screenshots/14-group-chat.png" width="200" alt="Group chat">
  <img src="docs/screenshots/18-timeline.png" width="200" alt="Timeline">
</p>

All screens: [`docs/screenshots/`](docs/screenshots).

```
apps/mobile      Expo (React Native) app — iOS & Android
apps/server      Hono API + WebSocket server on Postgres (Neon)
packages/crypto  End-to-end encryption shared by both (libsodium)
```

## Features

- **@usernames** — search for anyone by username or name; no invite codes.
- **Chats** — one-on-one and groups (up to 64), typing indicators, read
  receipts, reactions, photos, voice notes, retries that never double-send.
- **Message requests** — a first message from someone you don't chat with
  lands in Requests. They can't tell you've seen it until you accept.
- **Groups** — description, several admins, "only admins can send" and "only
  admins can edit info" settings, searchable member list, and a history of
  changes shown in the chat ("Ana added Ben"). Leaving hands admin to someone
  else; the last person out deletes the group and its media.
- **Status** — text or photo updates that disappear after 24 hours, shown to
  people you have an accepted chat with. End-to-end encrypted; you see who viewed.
- **Timeline** — public posts with an optional photo, likes and comments.
- **Settings & dark mode** — system / light / dark, read-receipt privacy,
  notification and account settings.
- **Safety** — block (both directions: no chats, no group adds, hidden from
  search, profiles and the timeline) and report people, posts, comments or chats.

## How the encryption works

- **Keys live on the phones.** Each account has an X25519 key pair generated on
  the device; the secret key stays in the iOS Keychain / Android Keystore.
- **Messages** get a fresh random key each. The message is encrypted with it
  (XChaCha20-Poly1305), and the key is sealed separately for every member with
  `crypto_box`, bound to a hash of the ciphertext. So:
  - only people who were members when it was sent can read it;
  - the server and other members can't forge a message in someone's name or
    swap one message's content for another's;
  - the chat id and sender are sealed inside, so a message can't be moved
    between chats or relabelled.
- **Photos and voice notes** in chats are encrypted on the phone with their own
  key, which travels inside the encrypted message.
- **Status updates** are encrypted the same way, sealed for you plus each
  contact at the moment you post. Someone you chat with later won't see it.
- **The password never leaves the phone.** It's stretched with Argon2id into
  two secrets: one logs in (the server stores only an Argon2 hash of it), the
  other wraps a backup of the secret key — so signing in on a new phone
  restores your key and history.
- **Safety number.** Chat info shows a number derived from both people's keys.
  If it matches on both phones, the server hasn't swapped in its own key.

**Not encrypted (by design):** timeline posts, comments and post photos are
public. The server also sees usernames, who is in which chat, group names,
group descriptions and history, message timestamps and sizes, read receipts, typing, who viewed a status, and reports.

**Known limitations:**

- No forward secrecy — a leaked secret key exposes past messages. A
  double-ratchet / MLS protocol would fix this.
- One device key per account (signing in elsewhere reuses it).
- Forgetting your password loses your chat history (nobody else holds the key).
- Reports of encrypted chats only include what the reporter chooses to paste;
  there is no moderation dashboard yet (reports are stored in the `reports` table).
- Real-time delivery is single-instance (in-memory hub). Running more than one
  server needs shared pub/sub (Postgres `LISTEN/NOTIFY` on a direct Neon
  connection, or Redis).

## Running it

Requirements: Node 22+, a Neon (or any Postgres) database, and for media an
S3-compatible bucket such as Cloudflare R2.

```bash
npm install

# Server
cp apps/server/.env.example apps/server/.env    # fill in DATABASE_URL, JWT_SECRET, S3_*
cd apps/server
npm run db:migrate
npm run dev
```

No bucket yet? Leave the `S3_*` lines out and set `STORAGE_DIR=./.media` and
`PUBLIC_URL=http://<your-computer's-LAN-IP>:8787` — the server then stores media
on disk. Development only.

```bash
# App
cp apps/mobile/.env.example apps/mobile/.env    # EXPO_PUBLIC_API_URL
cd apps/mobile
npx expo run:ios      # or run:android
```

The app uses native modules (libsodium, secure storage), so it needs a
**development build** — it won't run in Expo Go. Without Xcode/Android Studio,
use EAS: `npx eas-cli@latest build --profile development`. Push notifications
need an EAS project id (`npx eas-cli@latest init`).

The web target (`npx expo start --web`, with `CORS_ORIGIN` set on the server)
works as a development preview; keys are kept in `sessionStorage` there, so
don't treat it as secure.

## Tests

```bash
npm test          # crypto unit tests + API tests against in-memory Postgres
npm run typecheck
```

## Design

"Soft & romantic": warm cream canvas, rose accent (`#C2385E`), plum-brown ink,
Nunito type, diffused shadows and spring-based motion. Tokens live in
`apps/mobile/src/theme.ts`; every text/background pair meets WCAG AA.
