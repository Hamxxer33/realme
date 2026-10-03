# Realme

A private, end-to-end encrypted chat app for couples. Two people pair with an
invite code and get a space that only they can read: messages, photos, voice
notes, a "thinking of you" heart, reactions, a shared memories timeline, and an
anniversary counter.

```
apps/mobile      Expo (React Native) app — iOS & Android
apps/server      Hono API + WebSocket server on Postgres (Neon)
packages/crypto  End-to-end encryption shared by both (libsodium)
```

## How the encryption works

- **Keys live on the phones.** At sign-up each phone generates an X25519 key
  pair. The secret key is stored in the iOS Keychain / Android Keystore.
- **Couple messages** are sealed with `crypto_box` (X25519 + XSalsa20-Poly1305)
  using one partner's secret key and the other's public key, so either partner —
  and nobody else — can open them. The couple id and sender id are sealed inside
  each message and checked on open, so the server can't replay or relabel one.
- **Photos and voice notes** are encrypted on the phone with a fresh random key
  per file (XChaCha20-Poly1305) before upload. That key travels inside the
  encrypted message; storage only ever holds ciphertext.
- **Memories and couple settings** (anniversary, couple name) are encrypted the
  same way as messages.
- **The password never leaves the phone.** It's stretched with Argon2id into two
  independent secrets: one logs in (the server stores only an Argon2 hash of it),
  the other wraps a backup of the secret key. Signing in on a new phone downloads
  that backup and unwraps it locally, so history still decrypts.
- **Safety number.** Settings shows a 25-digit number derived from both public
  keys. If it matches on both phones, the server hasn't swapped in its own key.

**What the server can see:** emails, display names, who is paired with whom,
message timestamps and sizes, read receipts, typing indicators, and when a push
notification is sent. It cannot see message text, photos, voice notes,
memories, or the anniversary.

**Known limitations (v1):**

- No forward secrecy — if a secret key leaks, past messages can be decrypted.
  A double-ratchet protocol (as in Signal) would fix this.
- One active device per account; signing in elsewhere reuses the same key.
- Forgetting your password loses your history (by design: nobody else holds the key).
- Decrypted photos/voice notes are cached inside the app's private storage.
- Real-time delivery is single-instance (in-memory hub). Running more than one
  server instance needs a shared pub/sub (e.g. Postgres `LISTEN/NOTIFY` on a
  direct Neon connection, or Redis).

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
`PUBLIC_URL=http://<your-computer's-LAN-IP>:8787` — the server then stores
(encrypted) media on disk. Development only.

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

The web target (`npx expo start --web`) works as a development preview for UI
work; keys are kept in `sessionStorage` there, so don't treat it as secure.

## Tests

```bash
npm test          # crypto unit tests + API tests against in-memory Postgres
npm run typecheck
```

## Design

"Soft & romantic": warm cream canvas, rose accent (`#C2385E`), plum-brown ink,
Nunito type, diffused shadows and spring-based motion. Tokens live in
`apps/mobile/src/theme.ts`; every text/background pair meets WCAG AA.
