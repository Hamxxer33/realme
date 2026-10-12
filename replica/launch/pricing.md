# Pricing

Researched 2026-10-06. Most prices come from search summaries of US App Store
listings or third-party articles, because store and vendor pages were blocked
from this environment. "vendor" means the company's own page. Check each price
in the store before quoting it anywhere.

## Recommendation

**Lovenest Plus: one plan covers you and your person**

| | Price | After Play's 15% |
|---|---|---|
| Monthly | **$2.99** | $2.54 |
| Yearly | **$19.99** (save 44%) | $16.99 ($1.42/month) |
| Founding lifetime (optional, capped, e.g. first 500) | $39.99 | $33.99 once |

- 1-month free trial, yearly plan only, one trial per couple (checked on the
  server: Play's "developer determined" offer eligibility).
- One purchase covers the buyer and one linked person (partner, parent or best
  friend). Play can't share subscriptions, so the server grants it to the
  linked account. Either side can unlink at any time.
- Raise to **$3.99 / $29.99** for new subscribers once Plus has real substance
  (sealed love letters, a shared memories album). Check Play's rules for
  existing subscribers before changing their price.

**Free forever, for everyone:** chats, groups, photos in good quality, voice
notes, calls, status, channels, communities, encryption, requests,
block/report, account deletion. No ads. Anything a Plus user sends (a heart
style, a theme on a shared chat) shows for the other person whether or not
they pay. Nothing made with Plus is locked away if it lapses.

**In Plus (v1, small builds):** extra "thinking of you" heart styles and
animations, couple themes and chat wallpapers, alternate app icons, milestone
and anniversary reminders (100 / 365 / 1,000 days, scheduled on the phone),
status that lasts up to 7 days, an opt-in supporter badge.
Later: sealed love letters released on a date (needs a server scheduler), a
shared memories album, sticker packs.

### Why this price

- **Closest comparable, Between Plus** (a private couples messenger), is
  $2.99/month, $13.99/year, $26.99 lifetime, and one purchase covers both
  partners. Its free tier shows ads; Plus removes them and adds stickers,
  original-quality downloads, themes and icons
  ([vendor help](https://help.between.us/hc/en-us/articles/115006800147-What-is-Between-Plus),
  prices secondary). Lovenest's v1 Plus is mostly cosmetic, so it shouldn't
  cost much more: same monthly price, about 1.4x on yearly.
- **Couples utility apps** charge $2.49–4.99/month and $14–45/year; the median
  yearly price is about $19.99: Raft $2.49/$18.99, Widgetable $4.99/$19.99,
  Cupla $4.99/$44.99 (vendor), Locket Gold $3.99–4.99/$36–45 (sources
  disagree). Coaching and content apps cost far more (Paired $74.99–79.99/yr,
  vendor; Lasting $89.99/yr, vendor) because they sell expert content.
- **Messenger tiers are priced per person:** WhatsApp Plus $2.99/mo, Discord
  Nitro Basic $2.99/mo or $29.99/yr (vendor), Snapchat+ $3.99–4.49/mo,
  Telegram Premium $4.99/mo or $35.99/yr, Session Pro $35.99/yr (vendor).
  Lovenest's $19.99 a year for two is about $0.83 per person per month.
  That's cheaper than those, but still more than Between on yearly, so
  never call it "the cheapest".
- **Yearly at 6.7 months of monthly** is close to the couples-app norm. Social
  apps have the lowest monthly renewal rates, so pushing yearly matters.

### What it will earn (be realistic)

Running costs are about $0.03–0.05 per active user per month: about
$27–49/month at 1k users and $89–302/month at 10k users. They grow because
media and messages are kept forever. This assumes the free tier of
Cloudflare's TURN relay.

The Android median is 0.9% of downloads paying by day 35 (RevenueCat 2026),
and optional cosmetic tiers do worse. One purchase also covers two people.
So expect roughly **15–90 subscriptions at 10k users, about $28–168 a month**
(at about $1.87 blended net with 60% yearly). **Plus will not pay for the
servers at that size**, whatever the price. Cost control (resizing photos,
mono voice notes, rate limits, a free TURN tier) matters more than the
price. Plus is a way for people to support an ad-free app, not a business
model yet.

### When to launch it

Not now. Ship it in the first update after these are done:

1. Calls work everywhere (TURN set up). Never charge while calls fail.
2. The app is out of the closed test and in production.
3. "Link your person" is shipped, so one plan can cover two.
4. You have about 1,000 active users (an assumption; below that, Plus
   earns a few dollars a month).

### What changes when you add it

- Play Console: payments profile and tax info; subscription `lovenest_plus`
  with `monthly` and `yearly` base plans plus a trial offer; optional
  `lovenest_plus_lifetime`. Products can only be created after a build with
  Play Billing (library 8+) is uploaded to a test track.
- App: billing SDK (RevenueCat, free up to $2,500/month revenue, or
  react-native-iap), paywall that shows the billed price first ("$19.99 per
  year") with "about $1.67/month for both of you" as secondary text, how
  renewal and cancelling work, and "Messaging and calls stay free".
- Server: entitlements table, Play/RevenueCat webhooks (renewals, grace
  period, account hold, refunds), partner grant and revoke, one trial per
  couple, revoke on account deletion.
- Copy: listing ("In-app purchases: Yes", "Status ... 24 hours"), content
  rating (digital purchases), data safety (purchase history), privacy policy
  (billing providers, purchase records kept for tax), terms (auto-renewal,
  trials, refunds), landing page pricing section and FAQ. Tell existing users
  before release.

## Alternatives

- **$3.99/month, $29.99/year** per couple: once love letters or the
  memories album ship, or if most users are in the US or EU.
- **Free plus a tip jar:** Play doesn't support donations, so a "supporter"
  purchase with a small cosmetic perk is the closest option (Signal-style
  goodwill, Honeydue-style pay-what-you-want).

## Regional prices

Play converts the US price into local currency, VAT included. Set
purchasing-power markets by hand, because plain exchange-rate conversion
prices them like rich ones. A third-party guide suggests Brazil at about 50%
of US and India and Indonesia at about 35%, with Pakistan lower. Check every
override against Play Console's converter and its minimum prices.

## Fees (Google Play)

- Subscriptions: 15%. In the US, UK and EEA since 30 June 2026 it is 10% plus
  5% for billing on the first $1M a year
  ([Google](https://developer.android.com/blog/posts/expanded-billing-choice-and-lower-fees-on-google-play)).
  Australia moved 30 Sept 2026, Japan and Korea move 31 Dec 2026, and the
  rest of the world by 30 Sept 2027 (secondary). Until then those markets
  stay on the old structure.
- One-time purchases (lifetime): 15% in US/UK/EEA under the new structure.
  Elsewhere 15% only on the old 15% tier, otherwise 30%.
- Digital goods must be sold through Google Play Billing, not Stripe.
