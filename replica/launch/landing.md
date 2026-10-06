# Landing page

Built into the API server, so it's live wherever the server is:
`apps/server/src/routes/pages.ts` → `home()`. Screenshots are served from
`/static/img/` (cropped from `docs/play-store/phone-*.png`). The page loads
nothing from third parties: no fonts, no analytics, no scripts.

- Live today: https://server-production-403b.up.railway.app/ (after this branch is merged and deployed)
- Custom domain: in Railway, open the `server` service → Settings → Networking →
  Custom Domain, add e.g. `lovenest.app`, then create the CNAME record it shows
  at your DNS provider.
- When the Play listing is public, set `PLAY_STORE_URL` on Railway. The button
  changes from "Join the Android beta" (an email to the contact address) to
  "Get it on Google Play".

**Angle:** no review research yet (see "Status" below), so the page leads with
what Lovenest really does differently: a calm, private place for a few close
people, no phone number, no ads, end-to-end encrypted.

## Sections

1. **Hero.** "A private place for the people you love." Under it:
   "Encrypted chats, calls and little moments with your partner, family and
   closest friends. No ads, no phone number, and we can't read a word of it."
   One button. Real chat screenshot (the dark-theme one in dark mode).
2. **The problem.** "Your closest people deserve more than a crowded inbox."
   (a) they get lost between work groups and people you met once;
   (b) your conversations aren't the product: no ads, end-to-end encrypted.
3. **How it works.** Pick a @username (email, no phone number) → share it,
   strangers wait in Requests → chat, call, share moments, all encrypted.
4. **Features.** Private by design: end-to-end encryption, safety numbers,
   password never leaves the phone, Requests and block/report. Made for
   closeness: one-tap "thinking of you" heart, 24-hour status for your
   people only, voice and video calls, groups and communities, read receipts
   you control, light and dark.
5. **Pricing.** Free. No ads, no in-app purchases, no subscription.
6. **FAQ.** Can you read my messages? What if I forget my password (we can't
   recover it, by design)? Do I need a phone number? Who can message me? Is
   it on iPhone (Android first)? How do I delete my account? Who is it for (18+)?
7. **Final call to action.** "Make a little nest for your people."

No testimonials, user counts, ratings or press logos: there aren't any yet,
and the page doesn't pretend otherwise. Every feature claim was checked
against the app.

## Checks

- WCAG contrast, light and dark: all pairs pass AA
  (`python3 .claude/skills/replica-design/contrast.py replica/launch/landing-tokens.light.json`, same for `.dark.json`).
- No horizontal scroll at 390 px or 1280 px, light and dark (Playwright).
- Server test checks `/` and the screenshot routes.

## Status

`/replica-entrepreneur` (reading competitor reviews) could not run: this
environment's network policy blocks the review sources (itunes.apple.com,
apps.apple.com, play.google.com, trustpilot.com, reddit.com,
hn.algolia.com). Nothing was invented in its place. Once those hosts are
allowed, run it and revisit the hero and "The problem" with real evidence.
