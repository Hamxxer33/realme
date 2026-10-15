# Recon map: Threads (Android-first mobile)

Scope: the core loop only. Read the feed, post or reply, get activity back, message someone. Settings, privacy, invites, help and about pages are mapped because they sit on that loop's edges.
For: Lovenest, the founder's own branded product (Expo SDK 57 app in `apps/mobile`, Hono/Postgres server in `apps/server`, libsodium E2EE in `packages/crypto`). It isn't launched yet; the Play closed test is still pending.
Date: 2026-10-15

Founder's brief: "We need the app to be like this but make it better than it."

## Clean-room rules for everything below

- We rebuild what Threads does and how people move through it. We never use its code, private APIs, name, logo, wordmark, icons, illustrations or copy.
- Quoted strings in the screen inventory record what the founder's screenshots show. They're reference only and never ship. `features.csv` describes functions in our own words.
- The reference screenshots stay in `replica/screens/`. That folder is already in `.gitignore`, so they're never committed or shipped.
- Third-party glyphs seen in the screenshots (the parent-company badge, the GIF provider's name, messaging-app logos) are other companies' marks. Lovenest uses the OS share sheet and its own icons.
- No scraping, no network inspection, no decompiling. Sources are public pages plus the founder's own account, captured by hand.

## Sources

**On the founder's account and Meta's terms.** The founder took the 24 screenshots by hand on their own Threads account (iOS, dark mode). Nothing was automated, nothing was scraped and no network traffic was logged. As commonly published, Meta's terms (the Threads terms, which build on the Instagram Terms of Use) forbid automated data collection and reverse engineering of Meta's software. We did neither: we looked at screens a user sees and wrote our own descriptions. We didn't read the current terms text in this session, because Meta's sites were unreachable from the research tool (see the method note). Check the current text for any clause about building a competing product before launch, and have counsel look at it if one is there.

**Method note.** WebFetch couldn't reach `about.fb.com` (DNS failure). Every fact credited to a Meta page comes from search-result snippets and summaries, not from the full page. ID prefixes: **A** = the founder's own account, **V** = owned by Meta (vendor), **N** = news and other secondary sources, **C** = the Lovenest codebase.

| # | source | URL | notes |
| --- | --- | --- | --- |
| A1 | Founder's own Threads account, 24 screenshots (iOS, dark, captured 4:12 to 4:15) | `replica/screens/threads-01.png` … `threads-24.png` (local, not committed) | Captured by hand, from threads-24 (first) to threads-01 (last). The primary source for screens, controls and states |
| C1 | Lovenest repo | `/home/user/realme` (`apps/server/src/db/schema.ts`, `routes/*.ts`, `apps/mobile/src/app/**`) | What exists today. File and line references throughout |
| V1 | Meta Newsroom: Messaging and highlighted perspectives (Jul 2025, updated Oct 2025) | https://about.fb.com/news/2025/07/introducing-messaging-highlighted-perspectives-threads/ | DM launch, requests folder (no links or media), request caps, hidden spam folder, media in DMs, groups up to 50 |
| V2 | Meta Newsroom: Attach text to posts (Sep 2025) | https://about.fb.com/news/2025/09/attach-text-threads-posts-share-longer-perspectives/ | Long-text attachment up to 10,000 characters with formatting |
| V3 | Meta Newsroom: Share custom feeds (Feb 2025) | https://about.fb.com/news/2025/02/share-custom-feeds-on-threads/ | Public, followable, shareable custom feeds |
| V4 | Meta Newsroom: New Threads features (Mar 2025) | https://about.fb.com/news/2025/03/new-threads-features/ | Choose the default feed, reorder feeds |
| V5 | Meta Newsroom: Web experience (Apr 2025) | https://about.fb.com/news/2025/04/new-features-threads-web-experience/ | Desktop columns |
| V6 | Meta Newsroom: public feed-steering posts (Feb 2026) | https://about.fb.com/news/2026/02/threads-dear-algo/ | A public post adjusts your feed for 3 days |
| V7 | Meta Newsroom: Live chats (Apr 2026) | https://about.fb.com/news/2026/04/threads-live-chats/ | Public real-time chats in Communities |
| V8 | Meta Newsroom: 500M monthly users (Jun 2026) | https://about.fb.com/news/2026/06/meta-launching-new-features-500-million-monthly-threads-users | Communities out of beta, private topic tuning (1/3/7 days) |
| V9 | Meta developer docs: Reply management | https://developers.facebook.com/documentation/threads/reply-management | Reply-control values, reply approvals, hiding replies |
| V10 | Meta developer docs: Location tagging | https://developers.facebook.com/docs/threads/create-posts/location-tagging | Search for places and attach them to posts |
| V11 | Meta Transparency: Labeling AI content | https://transparency.meta.com/governance/tracking-impact/labeling-ai-content | AI labels |
| V12 | Meta Help: Identify AI content | https://www.meta.com/en-gb/help/artificial-intelligence/1783222608822690/ | Disclosure rules for realistic AI media |
| N1 | TechCrunch, 15 Oct 2025 | https://techcrunch.com/2025/10/15/threads-is-getting-group-chats-as-messaging-rolls-out-to-the-eu | Group chats aren't E2EE; you can only be added by people who follow you |
| N2 | TechCrunch, 5 May 2026 | https://techcrunch.com/2026/05/05/threads-finally-brings-messaging-to-the-web/ | Web DMs; about 350M DMs a week |
| N3 | The Week, 2 Jul 2025 | https://www.theweek.in/news/sci-tech/2025/07/02/meta-rolls-out-threads-d-ms-to-all-users-minus-end-to-end-encryption-instagram-social-media.amp.html | DMs 18+; spokesperson: Threads won't support E2EE |
| N4 | TechCrunch, 3 Jul 2025 | https://techcrunch.com/2025/07/03/not-everyone-is-thrilled-with-threads-dms | Backlash: no way to turn DMs off |
| N5 | Jang | https://jang.com.pk/en/41841-threads-latest-dms-feature-sparks-mixed-reactions-from-users-news | Harassment worries |
| N6 | Techjuice | https://www.techjuice.pk/threads-expands-dm-settings-to-let-anyone-send-you-message-requests/ | Optional setting for requests from anyone |
| N7 | TechCrunch, 2 Oct 2025 | https://techcrunch.com/2025/10/02/threads-takes-on-x-with-new-communities-feature | Communities created by Meta, not users |
| N8 | Social Media Today | https://www.socialmediatoday.com/news/threads-rolls-out-topic-tags-to-all-users-globally/701915/ | One topic tag per post, no #, can be several words |
| N9 | TechCrunch, 15 Nov 2023 | https://techcrunch.com/2023/11/15/threads-starts-testing-hashtags-without-the-hash/ | Tag history |
| N10 | Engadget | https://www.engadget.com/social-media/threads-rolls-out-its-custom-feeds-tool-after-a-quick-testing-phase-195012720.html | Custom feeds from keywords and accounts |
| N11 | Techloy | https://techloy.com/threads-rolls-out-custom-feeds-to-give-users-more-control-of-their-content | Up to 128 pinned custom feeds |
| N12 | TechCrunch, 4 Feb 2025 | https://techcrunch.com/2025/02/04/challenging-bluesky-threads-now-allows-for-public-custom-feeds/ | Public custom feeds |
| N13 | Droid Life, 20 Mar 2025 | https://www.droid-life.com/2025/03/20/threads-finally-lets-you-customize-your-default-feed-improves-that-terrible-video-player/ | Default feed choice, reordering |
| N14 | TechCrunch, 30 Oct 2025 | https://techcrunch.com/2025/10/30/threads-now-lets-you-approve-and-filter-your-replies/ | Reply approvals; Activity filters |
| N15 | TechCrunch, 4 May 2024 | https://techcrunch.com/2024/05/04/farewell-dunks-threads-launches-quote-controls-for-all-users | Quote controls |
| N16 | Social Media Today | https://www.socialmediatoday.com/news/threads-you-hide-both-like-and-share-counts/704640/ | Hide like and share counts |
| N17 | GIGAZINE, 26 Apr 2024 | https://gigazine.net/gsc_news/en/20240426-threads-hidden-words-expanding | Hidden words in feeds, search, profiles |
| N18 | Kaspersky blog | https://www.kaspersky.com/blog/threads-privacy-security-settings/48704/ | Mute, restrict, hide replies |
| N19 | ZDNet | https://www.zdnet.com.au/article/threads-now-lets-you-control-the-amount-of-political-content-you-see/ | Political content setting |
| N20 | TechCrunch, 15 May 2025 | https://techcrunch.com/2025/05/15/threads-now-lets-creators-add-up-to-5-links-to-profiles-track-clicks | Up to 5 profile links |
| N21 | Business Today, 24 Jan 2025 | https://businesstoday.in/technology/news/story/threads-introduces-post-scheduling-and-new-markup-features-461949-2025-01-24 | Scheduling from the composer; scheduled posts sit in drafts |
| N22 | Social Media Today | https://www.socialmediatoday.com/news/threads-rolls-out-post-editing-and-voice-notes/696467/ | 5-minute edit window, no edit history |
| N23 | Lindsey Gamble | https://www.lindseygamble.com/blog/threads-adds-polls-and-gifs-features | Polls (4 options, 24 h); GIFs |
| N24 | Metricool | https://metricool.com/20-limit-carousels-on-threads/ | Carousels of up to 20 items |
| N25 | PostFast spec page | https://postfa.st/sizes/threads/video | Video up to 5 min (third-party spec) |
| N26 | Social Media Today | https://www.socialmediatoday.com/news/threads-expands-spoiler-tags-video-image-posts/751919/ | Spoilers on media |
| N27 | Neowin | https://www.neowin.net/news/threads-is-getting-a-feature-reddit-has-had-for-nearly-a-decade/ | Spoiler history |
| N28 | Engadget | https://www.engadget.com/social-media/threads-introduces-ghost-posts-that-disappear-after-24-hours-160000228.html | Posts archived after 24 h |
| N29 | 9to5Mac, 17 Jun 2025 | https://9to5mac.com/2025/06/17/threads-adds-fediverse-feed-and-profile-search/ | Fediverse feed |
| N30 | Open Terms Archive | https://opentermsarchive.org/en/memos/threads-expands-profile-creation-beyond-instagram-users/ | Sign-up without Instagram (2025) |
| N31 | Net Influencer | https://www.netinfluencer.com/threads-tests-instagram-free-sign-up-option-for-eu-users/ | Instagram-free sign-up test |
| N32 | BGR | https://bgr.com/tech/you-can-finally-delete-threads-without-deleting-your-instagram-account/ | Delete Threads on its own |
| N33 | SlashGear | https://www.slashgear.com/1332132/deleting-threads-account-also-deletes-instagram | Earlier deletion lock-in |
| N34 | TechCrunch, 13 Nov 2023 | https://techcrunch.com/2023/11/13/threads-now-lets-users-opt-out-of-having-their-posts-appear-on-facebook-and-instagram | Cross-app opt-out |
| N35 | Fast Company | https://www.fastcompany.com/90981757/how-stop-threads-posts-showing-up-instagram-facebook-disable | Cross-app sharing on by default |
| N36 | TechCrunch, 21 Jan 2026 | https://techcrunch.com/2026/01/21/threads-rolls-out-ads-to-all-users-worldwide | Ads worldwide |
| N37 | Jumpfly | https://www.jumpfly.com/blog/threads-ads-go-global-what-meta-advertisers-need-to-know/ | Ad formats |
| N38 | Neowin | https://www.neowin.net/news/angry-users-react-as-meta-begins-testing-ads-on-threads-in-the-us-and-japan/ | Ad backlash |
| N39 | PhoneArena | https://www.phonearena.com/news/meta-threads-ads_id166962 | Ad backlash |
| N40 | Pureinfotech | https://pureinfotech.com/verify-account-threads/ | Paid verification carries over from Instagram |
| N41 | Storyboard18 | https://www.storyboard18.com/amp/brand-marketing/threads-rolls-out-new-metrics-to-help-creators-track-content-performance-76142.htm | Insights metrics |
| N42 | Net Influencer | https://www.netinfluencer.com/threads-rebuilds-creator-insights-dashboard-with-plain-language-performance-summaries/ | Plain-language insights |
| N43 | TechCrunch, 11 Feb 2026 | https://techcrunch.com/2026/02/11/threads-new-dear-algo-ai-feature-lets-you-personalize-your-feed/ | Concern that feed-steering requests are public |
| N44 | GIGAZINE, 12 Feb 2026 | https://gigazine.net/gsc_news/en/20260212-meta-threads-dear-aigo | Up to 6 active requests |
| N45 | Engadget | https://engadget.com/2171113/threads-users-are-pissed-they-cant-block-metas-new-ai-chatbot | The company's AI account can't be blocked |
| N46 | Digital Trends | https://www.digitaltrends.com/social-media/you-cant-block-metas-ai-bot-on-threads-i-dont-know-what-we-did-to-deserve-this/ | Same |
| N47 | GIGAZINE, 13 May 2026 | https://gigazine.net/gsc_news/en/20260513-threads-cannot-block-ai | Same |
| N48 | MediaPost | https://www.mediapost.com/publications/article/415042 | AI integration angers users |
| N49 | The Next Web | https://thenextweb.com/news/threads-meta-ai-dm-global-rollout | AI in DMs worldwide; feed bot mute-only |
| N50 | TechCrunch, 6 Nov 2024 | https://techcrunch.com/2024/11/06/for-you-feeds-fail-on-election-night-offering-outdated-information-angering-users | Recommended feed stale on election night |
| N51 | Nieman Lab | https://niemanlab.org/2024/11/threads-was-next-to-useless-on-election-night-but-thats-kind-of-the-point | Same |
| N52 | Sherwood News | https://sherwood.news/tech/meta-threads-for-you-feed-quantified | More than a third of posts were 6–12 h old |
| N53 | BGR | https://www.bgr.com/tech/threads-has-absolutely-no-idea-what-i-want-to-see-on-the-feed/ | Feed feels random |
| N54 | Irish Times, 22 Jul 2024 | https://www.irishtimes.com/technology/consumer-tech/2024/07/22/how-to-clean-up-your-threads-feed/ | Topic pile-ons |
| N55 | Yahoo Tech | https://tech.yahoo.com/general/articles/only-see-threads-people-090000154.html | Strangers' posts; reverts to recommended |
| N56 | Status | https://www.status.news/p/threads-engagement-meta-bluesky-x | Filler after you've seen everyone you follow |
| N57 | Business Insider (NL) | https://businessinsider.nl/rage-bait-is-all-the-rage-on-threads-so-i-tried-it-im-sorry/ | Rage bait rewarded |
| N58 | Social Media Today | https://www.socialmediatoday.com/news/threads-will-look-to-reduce-the-presence-of-rage-bait-posts/729131/ | Meta says it will reduce rage bait |
| N59 | Pixel Envy | https://pxlnv.com/linklog/engagement-bait-threads/ | Engagement bait |
| N60 | TheWrap | https://thewrap.com/meta-threads-toxic-social-content | Toxicity |
| N61 | Substack (personal) | https://postcardsbykayla.substack.com/p/why-is-threads-so-toxic | Replies can be hidden but not deleted (single source) |
| N62 | The Wild Hunt | https://wildhunt.org/2025/01/meta-claims-more-speech-and-fewer-mistakes-while-ending-fact-checking-and-updating-guidelines.html | Fact-checking ended; looser rules |
| N63 | GIGAZINE, 14 Mar 2025 | https://www.gigazine.net/gsc_news/en/20250314-community-notes-facebook-instagram-threads-meta | Community notes (US) |
| N64 | TechCrunch, 11 Oct 2024 | https://techcrunch.com/2024/10/11/instagram-blames-moderation-issues-on-human-reviewers-not-ai | Wrongful enforcement |
| N65 | tech.co | https://tech.co/news/head-instagram-admits-failures-threads-moderation | Moderation failures admitted |
| N66 | GIGAZINE, 10 Oct 2024 | https://gigazine.net/gsc_news/en/20241010-instagram-threads-moderation-deleted | Accounts wrongly marked under 13 |
| N67 | eMarketer | https://www.emarketer.com/content/meta-s-automated-moderation-wrongfully-restricts-instagram--threads-accounts | Wrongful restrictions |
| N68 | TechCentral.ie | https://www.techcentral.ie/instagram-users-complain-of-massive-bans-see-ai-as-culprit/ | Mass bans, unanswered appeals |
| N69 | OECD AI incident record | https://oecd.ai/en/incidents/2025-06-16-ec0c | Same incident |
| N70 | Boston 25 | https://boston25news.com/news/local/more-than-devastating-locked-out-meta-users-accused-vicious-act/VQTGS33ARZBLRKTWMNREH53F7I | No human support (all of Meta) |
| N71 | NBC DFW | https://www.nbcdfw.com/news/nbc-5-responds/meta-users-continue-report-disabled-accounts/4014683/ | Disabled accounts (all of Meta) |
| N72 | Top10VPN | https://www.top10vpn.com/research/threads-vs-twitter/ | Broad store privacy label (2023) |
| N73 | tech.co | https://tech.co/news/threads-privacy-policy-criticism | Privacy policy criticism |
| N74 | Hwb (Welsh Government) | https://hwb.gov.wales/keeping-safe-online/in-the-know/threads | Needed an Instagram account |
| N75 | Engadget | https://engadget.com/social-media/why-is-threads-recommending-these-weird-spammy-posts-from-people-looking-for-friends-234829584.html | Spammy recommendations |
| N76 | TechCrunch, 17 Jul 2023 | https://techcrunch.com/2023/07/17/the-spam-bots-have-now-found-threads-as-company-announces-its-own-rate-limits | Spam bots, rate limits |
| N77 | Meltwater | https://www.meltwater.com/en/blog/bluesky-vs-threads | Bluesky = control, Threads = reach |
| N78 | InfoWorld | https://www.infoworld.com/article/3624701/faq-getting-started-with-bluesky.html | Bluesky moderation lists, custom feeds |
| N79 | TechCrunch, 10 Oct 2024 | https://techcrunch.com/2024/10/10/bluesky-joins-threads-to-court-users-frustrated-by-metas-moderation-issues | Bluesky won't downrank politics |
| N80 | Social Media Today | https://www.socialmediatoday.com/news/meta-says-link-posts-ranked-properly-threads-reach/750126/ | Link ranking "fixed" |
| N81 | SocialBee changelog | https://socialbee.com/blog/threads-news/ | 2026 changes: chat pinning test and more |
| N82 | ProPakistani, 17 Sep 2026 | https://propakistani.pk/2026/09/17/metas-threads-gets-a-list-of-new-features-to-attract-podcast-creators/ | Podcast tools |
| N83 | TechCrunch, 22 Sep 2023 | https://techcrunch.com/2023/09/22/threads-adds-easy-profile-switching-to-its-mobile-apps | Profile switching |
| N84 | MediaPost | https://www.mediapost.com/publications/article/414893/threads-desktop-dms-ahead-of-website-rede.html | Desktop DMs |
| N85 | GIGAZINE, 25 Apr 2025 | https://www.gigazine.net/gsc_news/en/20250425-threads-net-to-com | Web domain move |
| N86 | Lowyat | https://lowyat.net/2024/333745/meta-rolls-out-threads-location-tagging | Location tagging; tap a place to see its posts |
| N87 | RouteNote | https://routenote.com/blog/threads-experiments-with-in-feed-music-stickers/ | Music stickers in test |
| N88 | TechCrunch, 31 Jul 2024 | https://techcrunch.com/2024/07/31/threads-now-highlights-relevant-trending-topics-above-posts | Trending-topic labels |

Gaps: we couldn't read any app-store or Reddit review text directly, so the complaints come from press coverage of user reactions. No Meta page was read in full.

## Core loop

You read short public posts from people you follow, post or reply in seconds, see who responded in Activity, and move the conversation into a private message. Lovenest's version makes that last step end-to-end encrypted.

Platform note: the screenshots are iOS, but Lovenest ships Android-first. On Android, the drawer's left-edge swipe collides with the system back gesture, sheets must close on Back, photo access goes through the Android photo picker, and notifications need the Android 13+ runtime permission.

## Screens

Captured screens: 24 shots that group into 20 distinct screens or surfaces (S01–S20). Screens the flows need but no shot shows are inferred (S21–S41).

| ID | screen (shots) | how to reach | purpose | key components | states seen / inferred |
| --- | --- | --- | --- | --- | --- |
| S01 | Home feed (24) | App launch; Home tab; double-tap Home (inferred) | Main reading surface | Top bar: feeds menu (2 lines) left, app mark centre, search right. Inline compose row: avatar, name, prompt placeholder, hairline. Feed list. Bottom tab bar, Home active | Seen: loading (5 skeleton post rows). Inferred: loaded, pull to refresh, paging spinner, empty Following, error + retry, offline, new-posts pill. Nothing shows which feed is active |
| S02 | Feeds drawer (23) | Menu button on S01, or swipe from the left edge. Home slides right with a rounded corner and dims | Switch feeds; Liked/Saved shortcuts; manage custom feeds | Large title. Header icons: add feed (+ in circle), edit (pencil). Two outlined square tiles: heart (Liked), bookmark (Saved). Grouped card: two built-in feeds (recommended, following) | Seen: default with 2 built-in feeds. Inferred: active-feed check, custom feed rows, edit/reorder mode, close by tapping the peek |
| S03 | Composer (18, 13) | Centre + tab, or the inline row on S01 | Write a post or multi-part thread with media, topic, location, reply controls, schedule, AI label | Modal sheet. Header: Cancel (text), centred title, drafts icon, overflow (…) icon. Body: avatar with vertical connector line; author name › topic placeholder; multiline input with placeholder; attach toolbar of 6 icons (photo library, camera, GIF, horizontal bars = poll or long-text attachment, meaning inferred; location pin; music note); dimmed add-another-part row with mini avatar. Footer pinned above keyboard: reply-options button (sliders icon) left, Post pill right | Seen: empty, focused, Post disabled (18); overflow menu open with an AI-label item, divider, schedule item with clock icon (13). Inferred: Post enabled, character limit, media strip, poll builder, location/topic chips, scheduled state, 2+ parts with delete, posting progress, failure/retry, save-or-discard on Cancel |
| S04 | Drafts sheet (17) | Drafts icon in S03 | Restore a saved draft | Stacked modal (S03 peeks behind). Header: Cancel, title | Seen: empty (one centred grey line). Inferred: draft list (preview, thumb, time), delete, open into S03, scheduled section |
| S05 | GIF picker (14) | GIF icon in S03 | Attach a GIF | Bottom sheet, grabber. Search field naming the provider. Category icon tabs: trending (selected, tonal square), smiley, heart, sad, party, thumbs-up | Seen: error (left-aligned "could not load" line, no retry). Inferred: loading grid, results, search results, no results, attribution |
| S06 | Location picker (15) | Location icon in S03 after permission | Tag a place | Bottom sheet, grabber. Search field (focused). Current-location arrow button. Keyboard with search key | Seen: focused, empty body. Inferred: nearby list, results, no results, loading, denied = search only |
| S07 | Location permission explainer (16) | First tap on location in S03, before the OS prompt | Explain location use before asking | Full screen. Hero icon tile. Bold centred title. 3 icon rows (how you can use it / how it's used / how to control it), each heading + body. Full-width primary Continue | Seen: default. Inferred: OS prompt next, denied outcome. Gap: no decline or close control |
| S08 | Messages inbox (22, 21) | Messages tab (paper-plane icon) | DM inbox | Large title, compose icon right. Pill search field. Chip row: filter-icon chip, Inbox (selected, tonal), Requests. Conversation list. Tab bar, Messages active | Seen: loading (7+ skeleton rows) (22); filter popover with a section label and 4 single-select items: all (checked), unread, unanswered, verified (21). Inferred: rows (avatar, name, preview, time, unread dot), empty, search results, no results for a filter, request count, swipe actions |
| S09 | Message requests (20) | Requests chip on S08 | Review messages from people you don't follow | Nav bar: back, title. Chips: filter icon, Requests (selected), Hidden. List | Seen: loading under the S10 sheet. Inferred: request rows, empty, accept/delete/block |
| S10 | Requests explainer sheet (20) | Shown on first visit to S09 (trigger inferred) | Explain request rules and safety | Bottom sheet, grabber, scrim. Bold centred title. 3 icon rows: you decide and the sender isn't told; extra protection (no photos, videos or links; harmful or spam hidden); you can limit requests to people you follow. Primary OK, outlined settings shortcut | Seen: open. Inferred: shown once; the settings button deep-links to Privacy › Messages |
| S11 | Hidden requests (19) | Hidden chip on S09 (pushes a page) | Review filtered/spam requests | Nav bar: back, title. List. No tab bar | Seen: loading (8 skeleton rows). Inferred: rows, empty, delete all, move to Requests |
| S12 | Activity (11, 12) | Activity tab (heart) | Notifications centre | Large title. Horizontal filter chips: all (selected, light fill), follows, conversations, reposts, with more off-screen (11 is scrolled). Tab bar, Activity active | Seen: error (centred grey line + bold tappable retry) in both shots. Inferred: loading, list grouped by time, per-chip empty, follow-back buttons, unread highlight, tab badge, pull to refresh |
| S13 | Own profile (08, 09, 10) | Profile tab | Identity plus your posts, replies, reposts | Top bar: insights icon left; search and settings gear right. Large display name, username line, XL avatar right. Two equal outlined buttons: edit profile, share profile. Underline tabs: posts / replies / reposts | Seen: all three tabs empty, each with a grey "not available" line (the wrong message for an empty tab). Inferred: bio, links, follower count with stacked avatars, populated lists, loading, private lock |
| S14 | Settings (07, 01) | Gear on S13 | Settings hub | Nav bar: back, title. Account-hub row (person icon, title, 2-line subtitle: password, security, personal details, connected experiences, ad preferences; parent-company badge). Icon rows without chevrons: follow and invite friends, notifications, saved, liked, archive, privacy, account status, more settings, help, about. Text actions: switch profiles (accent), log out (destructive). Tab bar | Seen: full list (07); dimmed under S15 (01). Inferred: log-out confirm, version footer |
| S15 | Switch profiles sheet (01) | Switch profiles on S14; long-press Profile tab (inferred) | Switch or add accounts | Bottom sheet, grabber, scrim. Grouped card: current profile row (avatar, name, check); inset divider; add-profile row with circular + | Seen: one profile + add. Inferred: 2+ profiles with unread badges, switching spinner, add flow |
| S16 | Privacy (05) | Privacy on S14 | Privacy controls | Lock icon + private-profile toggle (off). Icon + chevron rows: mentions, online status, messages, muted, hidden words, profiles you follow, suggesting posts on other apps. Section header with external-link icon and helper text with a learn-more link (links out to the sister app). Rows: blocked profiles, hide like and share counts | Seen: toggle off. Inferred: toggle on, confirm before going private, save failure, trailing values, each sub-page |
| S17 | Followers and invitations (06) | Follow-and-invite row on S14 (the page title differs from the row label) | Grow your network | Icon rows without chevrons: contacts, invite via share sheet, copy invite link, SMS, then 5 third-party app rows with those apps' logos | Seen: default. Inferred: link-copied toast, contacts permission, OS share sheet |
| S18 | More settings (04) | More settings on S14 | Secondary preferences | Label + chevron rows: content preferences, time management, media quality, accessibility, political content, language, website permissions | Seen: default. Inferred: each sub-page |
| S19 | Help (03) | Help on S14 | Support entry points | Label + chevron rows: report a problem, help centre, privacy and security help, support requests | Seen: default. Inferred: report form with screenshot, in-app help browser, ticket list |
| S20 | About (02) | About on S14 | Legal and transparency | Label + chevron rows: about your profile, parent-company privacy policy and terms, product privacy policy and terms, third-party notices | Seen: default. Inferred: document viewer; account info page |
| S21 | Search (inferred) | Search icon on S01 or S13 | Find people, posts, topics | Search field, recent searches, suggested accounts with follow, result tabs | Empty/recent, typing, results, none, error |
| S22 | Post / thread detail (inferred) | Tap a post anywhere | Read a post and its replies | Parent post, connected reply chain, reply entry | Loading, deleted, replies restricted |
| S23 | Reply composer (inferred) | Reply icon on a post | Reply | S03 in reply mode with the parent above | Disabled with a reason when the author limits replies |
| S24 | Repost / quote menu (inferred) | Repost icon on a post | Repost or quote | Action sheet: repost, quote (undo when reposted) | Reposted state; quote opens S03 with an embed |
| S25 | Post share sheet (inferred) | Share icon on a post | Share a post | Copy link, send in a chat, OS share | Copied toast |
| S26 | Other user's profile (inferred) | Tap an avatar or name | View someone | S13 header with follow / mention / message | Private, blocked, follows-you badge, loading |
| S27 | Edit profile (inferred) | Edit button on S13 | Change identity | Photo, name, bio, links, private toggle, done | Validation, saving, upload failure |
| S28 | Share profile (inferred) | Share button on S13 | Share your profile | Profile card / QR, copy link, OS share | Copied toast |
| S29 | Insights (inferred) | Insights icon on S13 | Reach and engagement | Range chips, metric tiles, charts | Empty for new accounts, loading |
| S30 | DM conversation (inferred; exists in Lovenest) | Row in S08 | Chat | Header, bubbles, input, media | Sending, failed, request mode |
| S31 | New message (inferred; exists in Lovenest) | Compose icon on S08 | Start a DM or group | Recipient search, suggestions | No results, can't message |
| S32 | Request preview (inferred) | Row in S09/S11 | Decide on a request | Preview, accept / delete / block | Accepted moves it to the inbox |
| S33 | Topic picker (inferred) | Topic placeholder in S03 | One topic per post | Search, suggested topics | Selected, clear |
| S34 | Reply options sheet (inferred) | Reply-options button in S03 | Who can reply and quote, approvals | Radio list, approvals toggle | Value echoed in the footer |
| S35 | Schedule picker and scheduled list (inferred) | Schedule item in S03 overflow | Pick a time; manage scheduled posts | Date + time picker; list | Past-time error, edit, cancel |
| S36 | Liked / Saved lists (inferred) | Tiles in S02; rows in S14 | Revisit posts | Post list | Empty, loading |
| S37 | Create / edit custom feed (inferred) | + and pencil in S02 | Build a feed | Name, sources, reorder | Empty, saved |
| S38 | Settings sub-pages (inferred) | Rows in S14, S16, S18 | Notifications, archive, account status, account, mentions, online status, messages, muted, hidden words, profiles you follow, blocked, hide counts, content prefs, time management, media quality, accessibility, language | Radio, toggle and list rows | Per page |
| S39 | Contacts sync (inferred) | Contacts row in S17 | Find friends | Explainer, list | Denied, no matches |
| S40 | Add profile / sign in (inferred) | Add row in S15 | Add a second account | Sign-in form | Error, 2FA |
| S41 | Confirmation dialogs (inferred) | Log out, Cancel with content, going private, block | Prevent mistakes | Alert or action sheet | — |

## Flows

Tap counts exclude typing. The happy-path count is the number to beat.

```
F01 Browse the feed and switch feeds
    S01 -> (menu or edge swipe) S02 -> pick a feed -> S01
    happy path taps: 2 (Liked or Saved: S02 tile -> S36 = 2)
    edge: load error + retry; empty Following; edge swipe vs Android back gesture;
          S01 never says which feed is active; empty custom feed
    better: show the active feed under the header with tap-to-switch; remember the last feed (1 tap)

F02 Compose a multi-part thread with media, topic and reply options
    S01 -> + -> S03 -> topic S33 -> photo (OS picker) -> add part -> reply options S34 -> Post
    happy path taps: ~10
    variants: GIF -> S05; first location tap -> S07 -> Continue -> OS prompt -> S06; camera; poll
    edge: Post disabled until content; character limit; poll vs media; GIF load error (seen);
          location denied = search only; upload fails or offline -> retry queue;
          removing a middle part; Cancel with content -> save or discard
    better: a decline control on S07; audience presets (followers, close friends) next to reply options

F03 Save a draft and schedule
    save: S03 -> Cancel -> save (S41)                    taps: 2
    restore: + -> drafts icon -> S04 -> row -> S03       taps: 3
    schedule: S03 -> overflow -> schedule -> S35 -> done -> Post   taps: ~5
    edge: empty drafts (seen); past time; finding a scheduled post to edit or cancel;
          drafts per profile; media expiring before the scheduled time
    better: continuous autosave, synced across devices, encrypted with the user's key

F04 Like, reply, repost, quote, share
    like: heart on a post card                           taps: 1
    reply: reply icon -> S23 -> Post                     taps: 2
    repost: repost icon -> S24 -> repost                 taps: 2
    quote: repost icon -> quote -> S03 with embed -> Post  taps: 3
    share: share icon -> S25 -> target                   taps: 2+
    results land in S13 replies/reposts and in the other person's S12
    edge: replies restricted (disabled with a reason); undo repost; hidden counts;
          deleted post; blocked user; double-tap to like (inferred)
    better: a private reaction only the author sees

F05 Check activity
    Activity tab -> S12 -> filter chip -> item -> S22 or S26
    happy path taps: 1–3
    edge: error with retry (seen); empty per chip; badge clears on open; follow back;
          notification about deleted content
    better: keep cached activity visible offline and say why loading failed

F06 Message someone
    Messages tab -> S08 -> compose -> S31 -> pick -> S30 -> send  (also S26 message button)
    happy path taps: 4
    edge: recipient doesn't follow you -> lands in their requests with no media or links;
          no search results; filters with no results; loading skeleton (seen); send failure
    better: E2EE everywhere, shown with a lock and a safety-number check (Lovenest has both)

F07 Handle message requests and hidden requests
    S08 -> Requests chip -> S09 -> (first visit S10 -> OK) -> row -> S32 -> accept / delete / block
    hidden: S09 -> Hidden chip -> S11 -> row -> S32
    happy path taps: 5 first visit, 4 after
    edge: S10 settings shortcut deep-links to Privacy › Messages; sender not told until accepted;
          media and links stripped; empty lists; bulk delete; spam false positives
    better: accept-and-mute in one tap; show mutual follows on a request

F08 Edit and share your profile
    edit: Profile tab -> S13 -> edit -> S27 -> change -> done   taps: 4
    share: S13 -> share -> S28 -> copy or QR                    taps: 3
    edge: bio or link validation; photo upload fails; unsaved changes on back;
          private profile link needs follow approval; empty tabs show "not available" (seen)
    better: empty tabs explain and offer a first-post CTA

F09 Change privacy
    S13 -> gear -> S14 -> Privacy -> S16 -> private toggle -> confirm (S41)
    happy path taps: 4–5
    sub-pages via S38: mentions, online status, messages, muted, hidden words,
          profiles you follow, blocked, hide counts
    edge: going private with existing followers; toggle fails to save and reverts;
          some settings live in the sister app (Lovenest keeps every setting in-app)
    better: a privacy checkup with plain "who can see this" previews

F10 Invite friends
    S13 -> gear -> S14 -> invite -> S17 -> copy link (toast) | OS share | contacts S39
    happy path taps: 4
    edge: target app not installed; contacts denied; invite attribution
    better: a personal invite link that makes you follow each other; OS share sheet instead of brand rows

F11 Switch profiles
    S13 -> gear -> S14 -> switch profiles -> S15 -> profile (or add -> S40)
    happy path taps: 4 (long-press Profile tab: 1 gesture, inferred)
    edge: one profile (seen); add fails; badges, drafts and notifications per profile;
          Lovenest: E2EE keys are per account, so keystores must never mix
    better: unread counts per profile in S15

F12 Log out
    S13 -> gear -> S14 -> log out -> confirm (S41) -> sign in
    happy path taps: 4
    edge: which profile or all; unsent posts or drafts pending;
          Lovenest: logging out without a key backup loses encrypted history
    better: "this device" vs "everywhere"; warn and offer backup first

F13 Get help or report a problem
    S14 -> Help -> S19 -> report a problem -> form -> send
    happy path taps: 4
    edge: attach a screenshot; offline queue; ticket status

F14 Read legal pages
    S14 -> About -> S20 -> document
    happy path taps: 3
    edge: offline viewer. Lovenest already has privacy, terms and child-safety pages.
```

## Components

| component | variants | states (seen / inferred) | used on |
| --- | --- | --- | --- |
| Bottom tab bar | 5 slots: Home, Messages, Compose (centre, tonal rounded square, opens a modal), Activity, Profile | Seen: active = filled glyph, inactive = outline grey; Compose has no active state. Inferred: badges, double-tap Home, long-press Profile, hidden on pushed pages and modals | S01, S08, S12–S20 |
| Top bars | (a) Home: menu / centred mark / search. (b) Large-title header + right icons. (c) Nav bar: back + centred title + hairline. (d) Modal header: Cancel text, centred title, right icons. (e) Profile bar: insights left, search + gear right | Seen: default, dimmed under scrim. Inferred: large title collapses on scroll, truncation | all |
| Chips | Icon-only filter chip; outlined text chip; selected light-fill; selected tonal | Seen: selected, unselected, horizontal scroll with edge bleed. Inferred: pressed, count badge, label reflects the active filter | S08, S09, S12 |
| Context menu / popover | (a) Action menu: plain item, divider, icon item. (b) Single-select filter menu with section label and leading check | Seen: open, anchored, blurred translucent surface. Inferred: animation, outside-tap dismiss, destructive style | S03, S08 |
| Bottom sheet | (a) Action sheet with grouped card. (b) Explainer sheet: title, icon rows, primary + outlined buttons. (c) Picker sheet with search on top. (d) Stacked full-height modal with header, parent peeks behind | Seen: grabber, scrim, rounded top, stacking. Inferred: drag to dismiss, snap points, keyboard avoiding, Android Back closes | S03–S06, S10, S15 |
| Skeleton loaders | (a) Row: circle + 2 bars (lists). (b) Post: circle + 3 bars (feed). (c) Grid tiles (GIFs, inferred) | Seen: static grey shapes. Inferred: pulse, reduced-motion fallback, no layout shift on swap | S01, S08, S09, S11 |
| Settings row | (a) icon + label. (b) label + chevron. (c) icon + label + chevron. (d) icon + label + toggle. (e) icon + title + 2-line subtitle + badge. (f) icon action row. (g) text-only accent / destructive action | Seen: default, full-bleed group dividers. Inferred: pressed, disabled, trailing value, loading, 48dp hit area | S14, S16–S20 |
| Section header + helper text | Bold title + trailing icon; grey paragraph with inline link | Seen: default | S16 |
| Toggle | Standard | Seen: off. Inferred: on, disabled, saving, error revert | S16, S38 |
| Empty / error message | (a) centred grey line. (b) centred error + bold retry link. (c) inline picker error | Seen: all three. Inferred: illustrated empty with CTA, offline | S04, S05, S12, S13 |
| Search field | (a) full-width pill. (b) sheet search. (c) search + trailing action icon | Seen: idle, focused with keyboard. Inferred: clear button, suggestions, results, none, recents | S05, S06, S08, S21 |
| Composer block | Avatar column with thread connector; author line with topic placeholder; multiline input; attach toolbar; add-part ghost row; footer with reply options + Post | Seen: empty, focused, Post disabled. Inferred: enabled, loading, counter, per-part delete, media strip, poll builder, chips, reply mode, schedule badge | S03, S23 |
| Composer toolbar | 6 icon buttons: library, camera, GIF, poll/long-text (inferred), location, music | Seen: default, muted grey. Inferred: active, disabled when incompatible, permission-gated | S03 |
| Avatar | XL, L, M, XS; photo, default silhouette (seen), add placeholder (seen), skeleton (seen) | Inferred: verified badge, online dot, selected check (seen as trailing check), private lock | S01, S03, S13, S15, lists |
| Buttons | Outlined equal-width pair; full-width primary; full-width outlined; pill primary; text button; text link; icon buttons | Seen: default, disabled (Post). Inferred: pressed, loading, destructive | many |
| Underline tabs | Equal-width text tabs with underline indicator | Seen: each of 3 active. Inferred: swipe between, sticky | S13, S26 |
| Profile header | Large name, username, XL avatar right, action pair | Seen: own, minimal. Inferred: bio, links, follower count + stacked avatars, other-user actions, private badge | S13, S26 |
| Feeds drawer | Push-reveal drawer (content slides right with rounded corner + dim); header with add/edit icons; 2 icon tiles; grouped list | Seen: open. Inferred: active highlight, edit mode, custom rows, swipe to close | S02 |
| Explainer list | Optional hero tile; rows of icon + bold heading + grey body | Seen: full page (S07) and sheet (S10) | S07, S10 |
| Inline compose row | Avatar + name + prompt, hairline; tap opens composer | Seen: default | S01 |
| Category icon tabs | Icon row; selected gets a tonal square | Seen: first selected | S05 |
| Grouped list card | Rounded card with inset dividers | Seen | S02, S15 |
| Post card (inferred) | Avatar, name, time, overflow, text, media, topic/place chips; actions: like, reply, repost, share; counts (hideable) | Inferred: liked, reposted, deleted, sensitive, replies restricted | S01, S13, S22, S36 |
| Conversation / person row (inferred) | Avatar, name, preview, time, unread dot; request variant | Inferred: unread, muted, typing, pinned | S08, S09, S11, S31 |
| Toast (inferred) | Link copied, posted, scheduled, draft saved, with undo | — | S03, S17, S25, S28 |
| Confirmation dialog (inferred) | Log out, discard/save draft, go private, block | — | S03, S14, S16, S32 |

## Inferred data model

Mapped onto Lovenest's Postgres schema (`apps/server/src/db/schema.ts`, written `schema:` below). **EXISTS** means a table is there today; `+` marks a new column.

```
User          id, username, display_name, bio, +avatar_key, +links (<=5), +is_private,
              +verified_at, created_at
              Lovenest: users (schema:9-32) EXISTS; no avatar, links, private or verified columns
              evidence: S13 header, S16 private toggle, S27; N20 (5 links)
              confidence: high (name, username, photo, private), medium (links), guess (verified)

UserSettings  user_id, who_can_message (requests_from_everyone | following | nobody),
              who_can_add_to_groups (following | nobody), mentions (everyone | following | nobody),
              show_online_status, hide_counts_default, default_reply_policy, default_quote_policy,
              default_feed, political_content, language, media_quality, daily_limit_minutes
              Lovenest: only users.read_receipts (schema:23). New table
              evidence: S16 rows, S18 rows, S10 settings shortcut, S34; V1, N6, N19
              confidence: medium (the enum values are ours)

Follow        follower_id, followee_id, status (accepted | pending), created_at
              Lovenest: MISSING. Only channel_followers (schema:201-207), which can be migrated
              evidence: S16 "profiles you follow", S12 follows chip, S26, F09, N1
              confidence: high

Post          id, author_id, text, created_at, +root_id, +reply_to_id, +position,
              +quote_of_id, +topic_id, +place_id, +audience (public | followers | close_friends | community),
              +reply_policy (everyone | followers | following | mentioned | nobody), +quote_policy,
              +reply_state (visible | pending | hidden), +ai_label, +spoiler, +hide_counts,
              +status (published | scheduled | deleted), +scheduled_at, +edited_at, +expires_at
              Lovenest: posts (schema:116-127) EXISTS; post_comments (schema:135-141) migrate into
              posts as replies (reply_to_id set)
              evidence: S03 composer, S13 tabs, S22, S23, S34, S35; V9, N14, N15, N21, N22, N28
              confidence: high (replies, threads, quotes), medium (policies), guess (audience)

PostMedia     post_id, position, kind (image | video | gif), object_key or provider_ref,
              width, height, duration_ms, alt_text
              Lovenest: posts.media_key/width/height (schema:120-122) holds one photo; move into a table
              evidence: S03 toolbar (library, camera, GIF); N24 (20 per post), N25
              confidence: high

PostEdit      post_id, previous_text, edited_at      (ours: visible edit history)
              evidence: N22 (Threads has no history)
              confidence: ours

Like          post_id, user_id, created_at
              Lovenest: post_likes (schema:129-133) EXISTS; +index on user_id for the Liked list
              evidence: S02 Liked tile, S14 Liked row, PostCard
              confidence: high

Repost        user_id, post_id, created_at
              Lovenest: MISSING. evidence: S13 reposts tab, S12 reposts chip. confidence: high

Save          user_id, post_id, created_at
              Lovenest: MISSING. evidence: S02 Saved tile, S14 Saved row. confidence: high

Draft         id, user_id, ciphertext (sealed with the user's own key), part_count, has_media, updated_at
              Lovenest: MISSING. evidence: S04, S03 drafts icon; N21. confidence: medium
              (encryption is ours; scheduled posts are Posts with status=scheduled, not drafts)

Topic         id, name (multi-word, no #), slug, created_at
              Lovenest: MISSING. evidence: S03 topic placeholder, S33; N8, N9. confidence: high

Poll          post_id, ends_at;  PollOption id, poll_id, position, label (<=4);
PollVote      poll_id, user_id, option_id, created_at
              Lovenest: MISSING. evidence: S03 toolbar bars icon (meaning inferred); N23. confidence: medium

Place         id, provider, provider_place_id, name, locality, approx_lat, approx_lng
              Lovenest: MISSING (expo-location not installed). evidence: S06, S07; V10, N86
              confidence: guess (depends on the places API we license)

Notification  id, recipient_id, actor_id, type (like | reply | follow | follow_request | mention |
              repost | quote | poll_closed | reply_pending), post_id, group_key, read_at, created_at
              Lovenest: MISSING (push only for messages, calls, channel posts)
              evidence: S12 chips (all, follows, conversations, reposts, more); N14. confidence: high

Feed          id, owner_id, name, is_public, rules (keywords[], account_ids[], topic_ids[]);
FeedPin       user_id, feed_key (built-in or feed id), position, is_default
              Lovenest: MISSING. evidence: S02 (+, pencil, 2 built-ins); V3, V4, N10, N11. confidence: medium

FeedSignal    user_id, target_type (topic | account | post), direction (more | less), expires_at
              Lovenest: MISSING. evidence: V8 (private tuning), N43 (complaint about public tuning)
              confidence: ours

Mute          muter_id, muted_id, scope (posts | replies | all), created_at
HiddenWord    user_id, phrase, created_at  (applies to feed, replies, search; DMs on device)
              Lovenest: MISSING (only chat and channel mute). evidence: S16; N17, N18. confidence: high

Block         blocker_id, blocked_id, created_at
              Lovenest: blocks (schema:143-147) EXISTS, applied both ways via blockRelation
              (apps/server/src/context.ts:79). confidence: high

Report        reporter_id, target (user | post | comment | conversation | channel…), reason, details,
              resolved_at, resolution
              Lovenest: reports (schema:149-166) EXISTS. evidence: post overflow menus. confidence: high

ModerationAction  id, user_id, rule, target_ref, action (remove | restrict | ban), created_at
Appeal        action_id, text, status (open | upheld | reversed), reviewer_id, decided_at
              Lovenest: users.banned_at (schema:27), reports.resolution (schema:165), routes/admin.ts:60-82;
              no user-facing status or appeal. evidence: S14 account-status row; N64–N71
              confidence: medium (Threads has the page; the appeal SLA is ours)

Conversation / Member / Message
              Lovenest: conversations, conversation_members (status accepted | pending, schema:72),
              messages (ciphertext + per-member wrapped keys) EXIST. +members.folder (inbox | request | hidden)
              evidence: S08, S09, S11, S21 filters; V1. confidence: high

DeviceAccount (client only) per-account token + secret key, namespaced by user id in secure storage
              Lovenest: one token and one key (apps/mobile/src/lib/session.tsx:8-9)
              evidence: S15; N83. confidence: high (need), ours (design)

PostView      post_id, day, views, unique_viewers;  FollowerDaily user_id, day, delta
              Lovenest: MISSING. evidence: S13 insights icon, S29; N41, N42. confidence: guess

InviteLink    code, inviter_id, auto_follow, uses, created_at
              Lovenest: MISSING. evidence: S17 copy-link row. confidence: medium

SupportTicket id, user_id, kind (problem | privacy | appeal), body, screenshot_key, status, created_at
              Lovenest: MISSING (mailto only). evidence: S19. confidence: medium

Kept from Lovenest, outside Threads' model: statuses + status_views (fold into Messages),
calls (keep), communities (park), channels + channel_posts + channel_reactions (drop after migrating followers).
```

Relationships:
- A User has many Posts.
- A Post has many reply Posts (`reply_to_id`) and ordered thread parts (`root_id` + `position`), and may quote one Post.
- Users relate to Users through Follow, Mute and Block.
- Users relate to Posts through Like, Repost and Save.
- A Post has 0 or 1 Topic, 0 or 1 Place and 0 or 1 Poll. A Poll has many PollOptions, and a PollOption has many PollVotes. A Post has many PostMedia rows and many PostEdit rows.
- A User has many Notifications, each with one actor User.
- A User owns many Feeds and orders feeds through FeedPin.
- A User has one UserSettings and many HiddenWords and FeedSignals.
- Conversations relate to Users through Members, and a Conversation has many Messages.
- A ModerationAction has 0 or 1 Appeal.

Entities: 31 server tables (11 exist or are extended, 20 new) plus 1 client-side keystore.

## Feature matrix

See `features.csv`: 118 rows. Must: 39, should: 43, could: 23, skip: 13. By Threads origin, 94 rows are Threads features (`original=yes`) and 24 are Lovenest additions (`original=no`). Today's `clone` column doubles as the gap list: 17 yes, 26 partial, 75 no.

## Better than Threads: the top 8

Each one answers a complaint with evidence behind it. Feature names are ours. Don't reuse Meta's names.

1. **Every chat is end-to-end encrypted, and we say so.** Threads DMs and group chats aren't E2EE, and Meta has said they won't be (N3, N1). Lovenest already encrypts 1:1 chats, groups, status and voice notes (`packages/crypto`, schema:83-97) and has a safety-number check (`verify/[id].tsx`). Keep requests encrypted too, and block links and media inside requests on the sender's device, so we match Threads' spam protection (V1) without the server reading anything.
2. **A real "who can message me" switch.** At launch Threads had no way to turn DMs off, and the backlash came mostly from women worried about harassment (N4, N5). It later added a requests setting (N6). Offer three choices: everyone (as requests), people I follow, nobody. Add "who can add me to groups". It's cheap: requests and block already exist (`chats.ts:121-136`, `routes/safety.ts`).
3. **A Following-first home that remembers your choice.** The most common complaint is a random, stale feed that drifts back to recommendations: 7 publishers (N50–N56), and more than a third of recommended posts were 6–12 hours old (N52). Default to a chronological Following feed with an "all caught up" marker instead of filler. Keep recommendations in their own feed with an age cap. Show which feed is active (S01 doesn't) and remember the last one opened.
4. **Private feed tuning, with a reason on every recommendation.** Threads' first tuning tool made your requests public (N43, V6). Its private version only came later (V8). Offer "more / less like this" on any post, person or topic, stored privately (FeedSignal), plus a one-line "why you're seeing this". Hidden words should apply to the feed, replies, search and, on the device, to DMs (N17 covers everything except DMs).
5. **Ranking that doesn't reward rage bait.** A rage-bait experiment pulled 3,000+ replies (N57), and Meta has said it would cut back on it (N58). Don't rank recommendations mainly on reply volume. Down-rank reply fishing. Weight topics the user picked and people their follows follow.
6. **Nothing you can't block, and no AI pushed on you.** The company's AI account can't be blocked, only muted (N45–N49), and the backlash trended with 1M+ posts. In Lovenest every account can be blocked, including official ones (block already works on every user through `blockRelation`), and any AI feature is opt-in.
7. **Authors control their replies.** Threads has reply and quote controls and reply approvals (V9, N14, N15). One source says you can hide replies on your own posts but not delete them (N61, single source). Offer per-post reply and quote policies, approvals, hidden words for replies, and both hide *and* delete on your own posts. Lovenest's post owners can already delete comments (`timeline.ts:109-139`).
8. **Moderation with a human on the other end.** Wrongful bans and unanswered appeals come up across 8 publishers (N64–N71). Every removal or restriction shows the rule and the content involved, with a one-tap appeal and a stated response time. Never auto-ban on an age guess. Lovenest is small enough to deliver this, and it can build on the existing admin API (`routes/admin.ts:28-112`) and an account-status page.

Also on the list, in rough order:
- A standalone account with a clean exit. Email sign-up already exists (`accounts.ts:36-70`), as do in-app and web deletion. Add a data export and never share posts outside the app (N30–N35, N72).
- No ads at launch, and a published promise of no ads in chats, ever (N36–N39).
- Choose the audience for each post (public, followers, close friends, a community), plus a 24-hour post that builds on Status. We found no source for a per-post audience on Threads, so don't claim it lacks one.
- Communities that members start and run themselves. Threads' communities are created by Meta (N7).
- Edit history shown on edited posts, which Threads doesn't keep (N22).

## Out of scope (cannot or should not be cloned)

- **The network and its users.** About 500M monthly users (V8) and their follow graph, posts and conversations. Lovenest starts empty. Cold start is a product problem: invite links, a Following-first home, and the founder's own community.
- **Instagram account linkage.** That means sign-in with a sister-app account, the cross-app account hub in S14 (password, personal details, connected experiences, ad preferences), sharing posts to sister apps (S16), the privacy settings that link out to the sister app, and verification that carries over. Lovenest has its own email accounts and keeps every setting in-app.
- **Meta's ranking models and training data.** We can build a simple, explainable ranker. We can't build theirs, and shouldn't try.
- **GIF content without an agreement with the provider.** S05 names a specific provider. GIFs come only through a provider's official API, with our own key, their attribution rules and their content rating. Never through scraping or cached copies.
- **A music catalogue.** Music on posts (S03 toolbar, N87) needs licences we don't have. Drop it.
- **Paid verification.** Meta's paid identity product is tied to Instagram (N40). Revisit our own verification once there's demand. Until then, the inbox's verified filter (S08) is skipped.
- **Fediverse federation, at first.** ActivityPub sharing (N29) is a big build, and it conflicts with private-first positioning. Revisit after launch.
- **The company's AI assistant account and AI in DMs** (N45–N49). This is deliberately not built.
- **Ads, and their ad system** (N36, N37). Not at launch.
- **Partner-driven features.** Company-curated communities with live chats tied to sports leagues (V7, V8), podcast tools (N82), community notes (needs scale, N63), and trending labels driven by Meta's signals (N88).
- **Third-party share rows with other apps' logos** (S17). Use the OS share sheet.
- **Contact upload** (S17, S39). Lovenest deliberately collects no phone numbers.
- **Their name, logo, wordmark, icons, illustrations and copy.** Includes the empty, error and explainer wording seen in the screenshots.

## Lovenest today vs target

| area | Lovenest today | target (this slice) |
| --- | --- | --- |
| Tabs | Chats, Updates, Communities, Calls, You (`(tabs)/_layout.tsx:46-58`) | Home, Messages, compose (centre), Activity, Profile |
| Home feed | Everyone's posts newest-first under Status and Channels (`(tabs)/updates.tsx:88-115`); spinner; errors become an empty list (`lib/useFeed.ts:24`) | Following (default) + Recommended + custom feeds, feeds drawer, inline compose row, skeletons, error + retry |
| Follow graph | None (only `channel_followers`) | Follows with pending requests for private profiles |
| Compose | Text up to 1000 + one library photo (`compose.tsx`, `timeline.ts:71`) | Multi-part, photo carousel, camera, video, GIF, poll, place, topic, reply/quote policy, drafts, schedule, AI label, audience |
| Replies | Flat text comments up to 500, no likes (`post_comments`) | Replies are posts: nested, likeable, with media |
| Repost / quote / save / share | None | All four, plus https post links |
| Activity | None; push only for messages, calls and channel posts | Notifications table, filter chips, live + push |
| Profile | You tab is a settings list; profile has a post list and post count | Profile tab: photo, bio, links, followers, posts/replies/reposts tabs, edit, share, insights |
| Messages | E2EE 1:1 + groups, requests, receipts, typing, voice notes, calls from chat | Same, plus inbox/requests chips, hidden folder, filters, status row, call history |
| Privacy | Read receipts, blocked list, an informational note | Private profile, who can message/mention/add to groups, mute, hidden words, hide counts, online status |
| Settings | Account, Privacy, My posts, Appearance, Notifications, Help, Invite | Settings hub from the profile gear: invite, notifications, saved, liked, archive, privacy, account status, more settings, help, about, switch profiles, log out |
| Moderation | Report everything; admin API only (`routes/admin.ts`) | Plus account status, rule shown, appeals with a human reviewer, a small admin dashboard |
| Status / Calls / Channels / Communities | Own tabs or sections | Status and call history move into Messages; Channels dropped; Communities behind a flag |
| Brand | "A private place for the people you love"; 18+ messenger listing | Needs a decision (below) |

## Decisions the founder must make

1. **Brand and name for a public social app.** "A private place for the people you love" and an 18+ messenger Play listing don't fit a public-first Home tab. Choose one:
   - (a) Keep Lovenest, with Messages as the centre and Home as the public side.
   - (b) Rename and reposition as a social app.

   Then run `/replica-brand`. The landing page (`routes/pages.ts:96,154`) and the store listing (`replica/launch/listing.json`) both change either way.
2. **Keep the couples features?** Streaks, link-your-person and Plus themes are specified in `docs/roadmap.md:85-153` but not built. They could be a private layer inside Messages, or be dropped to keep the product focused.
3. **Keep E2EE DMs.** Recommend yes. It's the single clearest way to beat Threads (N3), and it's already built.
4. **What happens to calls, status, channels and communities.** Recommendations:
   - Calls: keep, started from chats, with history in Messages.
   - Status: keep, as a row in Messages for people you chat with.
   - Channels: drop, and migrate `channel_followers` into follows before launch.
   - Communities: park behind a flag.
5. **Default feed.** Recommend Following, with Recommended one tap away and the last choice remembered.
6. **Moderation scope.** Public posts make this user-generated content under Play's policy. Decide:
   - who reviews reports, and the target response time
   - the appeal turnaround
   - whether the 18+ age gate stays
   - which content rules apply to public posts versus private chats (the server can't see private chats)
   - whether to build a small admin dashboard before opening public posting
7. **Third-party providers.** Choose (or skip) a GIF provider and a places provider. Both have API terms, attribution rules and possibly costs.
8. **Timing against the Play closed test.** The launch blockers (push, TURN, answering calls with the app closed, `docs/roadmap.md:10-12`) don't depend on this change. Choose whether the closed test ships the current messenger first, or waits for the new tabs.
9. **Multiple profiles: now or later.** This needs separate encrypted keystores for each account. Recommend later.

## Size

- **Screens.** 41 screen IDs: 20 captured and 21 inferred. S38 alone covers about 17 settings sub-pages.
- **Flows.** 14.
- **Entities.** 31 tables plus 1 client keystore. 11 of the tables exist today.

**Hard parts:**
1. **Replies become posts, and the follow graph arrives.** Migrating `post_comments` into `posts` and adding follows with private profiles means every feed, profile and search query needs visibility rules alongside `blockRelation`.
2. **Activity.** Fan-out of notifications over the WebSocket hub (`realtime.ts`) and push, and push registration is still a launch blocker.
3. **The composer rewrite.** Multi-part posts, carousel and video upload, encrypted autosaved drafts, and a scheduling worker the server doesn't have yet.
4. **Recommendations with a cold-start network.** The ranking has to be explainable and not reward bait.
5. **Moderating public posts at Play's bar for user-generated content.** That means appeals, an account-status page and a dashboard.
6. **Multiple profiles.** Each account needs its own E2EE keystore, and password change needs the key backup re-wrapped on the device.

**Size:**
- **The core-loop slice (must rows only): L.** About a quarter for one engineer. The server model alone (follows, replies as posts, reposts, notifications) takes roughly 2–4 weeks before the new tabs have real content.
- **Everything in the matrix: XL.** Rescope to must rows first, then the should rows that make up the top-8 "better" list.

Next step: `/replica-architect`.
