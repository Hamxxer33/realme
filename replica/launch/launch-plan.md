# Launch plan

## 1. Beta list (now)

Google requires new personal developer accounts to run a **closed test with
at least 12 testers for 14 days in a row** before production.

- The landing page button ("Join the Android beta") opens an email to
  hz3302m@gmail.com asking for the person's Google Play email address.
- Add those addresses to a Google Group or an email list in Play Console →
  Testing → Closed testing → Testers. Aim for 20 or more, so that
  drop-outs don't break the 12.
- Ask testers to really use it: a chat a day with someone, one call a week.
  Google looks at engagement during the test.

## 2. Analytics and error tracking (before production)

Today the app has no analytics and no crash reporting. That's a privacy
feature, but it also means crashes go unseen.

- **Uptime:** a free monitor (UptimeRobot, Better Stack) on
  https://server-production-403b.up.railway.app/health.
- **Crashes:** Sentry for React Native is the usual choice. If you add it,
  update the data safety form ("Crash logs" and "Diagnostics", collected)
  and the privacy policy *before* the release that ships it, and never send
  message content.
- **Usage:** count sign-ups and active users from the database, with no
  third-party SDK.

## 3. Where to find unhappy users

Not researched yet: `/replica-entrepreneur` was blocked by the network
policy. Once it runs, list the threads and communities here. Until then,
don't post into communities you haven't read. Most of them ban
self-promotion.

## 4. Launch posts (after production approval)

Lead with what's different, and be straight about what's unproven.

**Show HN draft** (rewrite the first line in your own words, it's your story)

> Show HN: Lovenest – an end-to-end encrypted messenger for a few close people
>
> I built a messenger for my partner, family and closest friends rather than
> everyone I've ever met. You sign up with an email and a @username, no phone
> number. Messages, photos, voice notes, status updates and call signalling
> are encrypted on the device with libsodium (a random key per message,
> wrapped for each member with crypto_box). The password is stretched with
> Argon2id on the phone and never sent, and it also unlocks the backup of
> your private key. That means we can't reset it: forget it and your history
> is gone. Calls are WebRTC. The server is Hono on Postgres and only sees
> ciphertext for chats (the optional public timeline and channels are public
> by design). It hasn't had an independent security audit yet. I'd love
> feedback on the crypto design and the UX.

**Product Hunt**: tagline "A private place for the people you love"; use
the same screenshots as the store; first comment = the story above, without
the jargon.

## 5. The first 10 users

Talk to each of them by hand, ideally a call:

1. Who do you message most, and on what app today?
2. What would make you move one conversation over here?
3. What felt confusing in the first five minutes?
4. Did anything feel unsafe or unclear about privacy?
5. Would you invite the other person? What would stop you?

Write the answers down. They're the evidence for the next version of the
landing page, and the first real testimonials (with permission).
