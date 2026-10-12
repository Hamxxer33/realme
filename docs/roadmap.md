# Lovenest roadmap: before launch, streaks, Plus v1

Written 2026-10-12 from a code audit, streak research, two engineering
designs, and two adversarial reviews (engineering; wellbeing and store
policy). Mockups: `docs/mockups/streaks-and-plus.jpg (badge options: docs/mockups/plus-badges.jpg)`.

**Short version.** Streaks and premium themes don't block launch. Four things
do:

1. One malformed WebSocket frame crashed the server. **Fixed** on this branch;
   it reaches production when merged.
2. Push notifications never register: there's no EAS projectId and no FCM.
3. Calls fail on most mobile networks: there's no TURN relay.
4. Calls can't be answered unless the app is already open.

Streaks come right after push works, during the closed test, and stay free
forever. Plus personalisation comes after launch.

---

## Stage 1: closed-test build #1 (about 1 week)

Only what must be in the native build or keeps the server alive.

| # | Item | Size | Notes |
|---|---|---|---|
| 1.1 | ~~Server crash on bad WebSocket frames~~ | XS | Done: `apps/server/src/app.ts`, tests in `api.test.ts`. Also set the Railway service restart policy to **Always** (railway.json isn't applied). |
| 1.2 | Neon backup and restore drill before the first migration on live users | XS | The privacy policy promises a 30-day backup window (`pages.ts`). |
| 1.3 | Health checks: keep `/health` DB-free for external monitors; add `/health/db` for deploys and occasional checks | XS | A DB health check every 5 minutes would keep Neon awake permanently. |
| 1.4 | **Push setup**: `eas init` (projectId and owner), Firebase project, `google-services.json`, FCM V1 key in EAS, `EXPO_ACCESS_TOKEN` on Railway | S, native | Today `registerForPush` returns early (`apps/mobile/src/lib/push.ts:34`). |
| 1.5 | One push format: `data {type, conversationId/callId}`, channel ids, tap opens the chat, permission asked in context after the first chat | S | Create channels now, because their sound and importance can't change later: `messages` (high), `calls_v1` (high, with a bundled ringtone), `streak_reminders` (low, silent), `anniversaries` (low). |
| 1.6 | Sign-out clears the push token on the server and cancels scheduled local notifications; a token belongs to one account | XS | Notifications currently leak across accounts on a shared phone. |
| 1.7 | expo-updates with `runtimeVersion: {policy: 'fingerprint'}`; app sends its build number (versionCode); server returns 426 only when the header is **present** and too old; unknown message kinds show an `alt` fallback | S, native | Needs the projectId from 1.4. The web delete-account page sends no header and must keep working. |
| 1.8 | Own domain and a support@ mailbox (replaces the Railway URL and the personal Gmail in builds and policies) | S | |
| 1.9 | Error boundary with a retry screen | XS | |
| 1.10 | Closed track: upload the first AAB manually, finish the listing, content rating and Data safety, honest reviewer notes (the demo user can't answer calls) | XS | Recruit **real pairs** as testers, not tester-exchange strangers, so streaks get tested. |

## Stage 2: during the 14-day closed test

Ships by Railway deploy or EAS Update. Sentry rides build #2.

| # | Item | Size |
|---|---|---|
| 2.1 | **Streak core on the server** (spec below), with privacy policy and Data safety updated **in the same deploy** | M |
| 2.2 | **Streak UI**: nest badge, join card, streak sheet, settings, time-zone sync | M |
| 2.3 | Spare days: earned, used automatically, never sold | S |
| 2.4 | Milestones at 7, 30, 100 and 365 days | S |
| 2.5 | Gentle local reminders (opt-in, one a day, no server scheduler) | S |
| 2.6 | **TURN, which takes code as well as config.** Self-host coturn (the HMAC credentials already exist), or add a credential minter for Cloudflare/Twilio to `GET /calls/ice`, and refresh credentials in the app | S |
| 2.7 | **Calls ring in the background**: on connect or notification tap, fetch the ringing call (`GET /calls/ringing`); high-priority call push. If it can't make the test, hide calls. | M |
| 2.8 | Detect phones that silently lost signal (server pings them), so they still get pushes | S |
| 2.9 | Stay signed in offline; never forget a chat because of a network error | S |
| 2.10 | Sentry for the app and the server (update Data safety: crash logs) | S, native |
| 2.11 | CI that runs the server tests before Railway deploys | S |

## Stage 3: before production launch

| # | Item | Size |
|---|---|---|
| 3.1 | Rate limits: 60 messages a minute and 2,000 a day; 3 messages and 1 push to someone who hasn't accepted your request; limits on sign-ups and upload URLs | S |
| 3.2 | Moderation: hide banned users' content everywhere; alert on every new report | S |
| 3.3 | Requests: blur strangers' photos; Report and "Block and report" | S |
| 3.4 | **Account safety for people leaving a relationship**: change password (re-wrap the key backup, revoke tokens), sign out of all devices, and a "new sign-in on another phone" notice | M |
| 3.5 | Account recovery: email verification plus "reset account" | M |
| 3.6 | Outbox with automatic retry for unsent messages | S |
| 3.7 | Invite links and Android App Links, so you can bring in "your person" | M, native |
| 3.8 | **Full emoji picker and any-emoji reactions** (recommended free, see decisions) | S |
| 3.9 | Resize photos before encrypting; animate only visible bubbles | S, native |
| 3.10 | Quiet hours (default 23:00–07:00 in the recipient's time): night message pushes go silent, calls still ring | S |
| 3.11 | Commission the sticker and heart art now, because it takes the longest | XS |
| 3.12 | Final pass on the listing, Data safety and policies | XS |

Decide here: launch with the public timeline, channels and communities, or
hide them? They add moderation and EU legal duties (DSA points of contact,
notice-and-action) to what is meant to be a couples app.

## Stage 4: launch month

Unsend and delete for everyone · push receipts and dead-token cleanup ·
mute durations and pinned chats · chat text size · keep calls alive in the
background (foreground service, which needs a native library and the Android
14 permission declaration) · accessibility pass · streak review against
thresholds written down **before** stage 2 ships.

## Stage 5: Plus v1

Comes after TURN, the closed test, "link your person", about 1k MAU and billing.

| # | Item | Tier |
|---|---|---|
| 5.1 | Link your person: only the two account ids are stored; a neutral notice to the other person when it ends; fresh mutual consent to re-link | free |
| 5.2 | Encrypted per-chat settings (version sealed inside the ciphertext) and a **Customise chat** screen | — |
| 5.3 | Nicknames (shared), "Together since" date and a days-together counter | free |
| 5.4 | Theme engine with 4 free themes: Rose, Blush, Sage, Plum night | free |
| 5.5 | Billing: Play Billing via RevenueCat, entitlements, partner grant | plus |
| 5.6 | About 10 more themes, custom bubble colour, shared photo wallpaper | plus |
| 5.7 | Stickers: 1 free pack plus Plus packs (commissioned "two birds in a nest" mascot; full copyright assignment) | split |
| 5.8 | Heart styles for "thinking of you": sparkle, heartbeat, hug and more | plus |
| 5.9 | About 40 animated love emoji (Noto Animated Emoji, CC BY 4.0, credited) | plus |
| 5.10 | Notification sounds: 3 free, plus a Plus sound pack | split |
| 5.11 | Anniversary reminders, on their own notification channel | plus |
| 5.12 | 7-day status and an opt-in supporter badge | plus |

Rules: anything a Plus user sends renders for everyone. Nothing made with Plus
is locked away when it lapses. No sales prompts inside conversations; Plus is
offered only in Settings and on the Customise chat screen. Hide Plus items
until Plus exists.

---

## Streak spec (free, never sold)

- **What:** two people in an accepted 1:1 chat both opt in. Each kept day adds
  one. There are no streaks in groups, channels, communities, Requests or with
  blocked people. Each person can have at most 5 active streaks.
- **What counts:** anything either person sends on their own day: text, photo,
  voice note, heart, reaction, or a call that actually connected. One is
  enough. The server learns only *who sent in which chat and when*, which it
  already sees. No message type is ever revealed.
- **Day rule:** each person's own calendar day, in their own time zone, rolling
  over at **4 am local wall-clock time**, so a late goodnight counts. Compute it
  from wall-clock parts: if the local hour is before 4, use the previous date.
  Don't subtract 4 hours, which breaks on DST days. The same code runs on server
  and phone, with DST and date-line tests. All timestamps come from the app
  clock (`ctx.now()`), never from DB `now()`.
- **Spare days:** earn 1 for every 7 days in a row, hold up to 2, used
  automatically. A quiet pill says "A spare day kept your 12-day streak going".
  Outage days are covered for everyone.
- **Milestones:** 7, 30, 100 and 365 days, then yearly. A soft in-chat card for
  both people; no push, nothing public. Milestone history is stored, so the
  best run and the total survive a break.
- **Reminders:** offered once when a streak starts and off unless chosen. At
  most one local notification a day, at 20:00 by default, only if a streak
  chat is still open. No names on the lock screen by default. Cancelled on
  sign-out, block, end and every sync. They pause after 3 ignored.
- **Ending:** either person, any time, per chat or everywhere. The copy is
  honest: "Ben will see that the streak has ended." After an end or a lapsed
  invite, the same person can't re-invite for 30 days, and the other person
  gets a quiet "Don't ask me again". Lovenest suggests a streak once and stops
  after one "no".
- **Never:** countdown timers, hourglasses, red warnings, escalating pushes,
  paid restores, extra spare days in Plus, boosts, rankings, or public streak
  badges.
- **Icon:** a nest with an egg (filled when today is kept, outline while open).
  The supporter badge must then use a different glyph (heart, or the "Plus"
  pill), so a paid badge never looks like a relationship metric.
- **Privacy:** store the user's IANA time zone (declare it as approximate
  location in Data safety), per-day activity flags pruned after 7 days from
  *today* (not from the last streak day), and the pair's counts. All of it is
  deleted on end, block, chat deletion or account deletion.
- **Measure:** privacy-safe daily counters with no user ids (starts, joins,
  ends, breaks, spare days used), a server kill switch, and kill and
  tone-down thresholds written down before 2.1 ships.

## Decisions for the founder

1. Streak name and icon: "streak", "12 days in a row", nest with egg?
2. Does every kind of message count, including reactions and hearts?
   (Recommended: yes. Anything narrower would leak message types to the server.)
3. Opt-in by both people (recommended) or on by default?
4. Is the full emoji picker and any-emoji reactions free? (Recommended: yes,
   because reacting is messaging. Plus gets animated love emoji and heart
   styles instead.)
5. Calls at launch: background ringing (2.7), or hide calls until ready?
6. Public timeline, channels and communities at launch, or hide them?
7. Account recovery: email code plus reset (M), or a recovery code only (S)?
8. Sticker art: who draws it, the budget, the mascot, and whether AI-assisted
   art is acceptable (purely AI-generated art can't be copyrighted in the US).
9. Free samplers: 4 themes, 1 sticker pack, the classic heart, 3 sounds?
10. Supporter badge glyph, now that the nest means "streak".
