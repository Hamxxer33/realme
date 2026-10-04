import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import type { Context } from 'hono';
import type { App, AppEnv } from '../context';

/** Public web pages the app stores require: privacy policy, terms, child safety, account deletion. */
export interface SiteInfo {
  appName: string;
  contactEmail: string;
}

export const DEFAULT_SITE: SiteInfo = { appName: 'Lovenest', contactEmail: 'hz3302m@gmail.com' };
const EFFECTIVE = '4 October 2026';

const require = createRequire(import.meta.url);
const wrappersDir = dirname(require.resolve('libsodium-wrappers-sumo'));
const sodiumDir = dirname(createRequire(join(wrappersDir, 'x.js')).resolve('libsodium-sumo'));
const read = (path: string | URL) => readFileSync(path, 'utf8');
const STATIC: Record<string, () => string> = {
  // libsodium is served from here rather than a CDN, so the deletion page loads nothing from third parties.
  'sodium/libsodium-wrappers.mjs': () => read(join(wrappersDir, '../modules-sumo-esm/libsodium-wrappers.mjs')),
  'sodium/libsodium-sumo.mjs': () => read(join(sodiumDir, '../modules-sumo-esm/libsodium-sumo.mjs')),
  'derive.mjs': () => read(new URL('../web/derive.mjs', import.meta.url)),
  'delete-account.mjs': () => read(new URL('../web/delete-account.mjs', import.meta.url)),
};

const escape = (s: string) => s.replace(/[&<>"']/g, (ch) => `&#${ch.charCodeAt(0)};`);

function layout(site: SiteInfo, title: string, body: string, head = '') {
  const name = escape(site.appName);
  return `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escape(title)} · ${name}</title>
<style>
:root { --bg:#FFF8F5; --surface:#FFFFFF; --ink:#2E1E24; --muted:#7A6168; --rose:#C2385E; --tint:#FBE7EC; --line:#F0E1E4; }
@media (prefers-color-scheme: dark) { :root { --bg:#151016; --surface:#211A23; --ink:#F6ECEF; --muted:#B9A3AA; --rose:#FF8FB0; --tint:#3A2530; --line:#33272F; } }
* { box-sizing: border-box; }
body { margin:0; background:var(--bg); color:var(--ink); font:16px/1.65 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
main { max-width: 760px; margin: 0 auto; padding: 32px 20px 64px; }
header { display:flex; flex-wrap:wrap; align-items:center; justify-content:space-between; gap:8px 12px; margin-bottom: 24px; }
.brand { font-weight: 800; font-size: 20px; color: var(--rose); text-decoration: none; }
nav { display:flex; flex-wrap:wrap; gap:4px 14px; } nav a { color: var(--muted); text-decoration: none; font-size: 14px; white-space: nowrap; }
nav a:hover { color: var(--rose); }
h1 { font-size: 34px; line-height: 1.2; margin: 8px 0 4px; letter-spacing: -0.5px; }
h2 { font-size: 21px; margin: 32px 0 6px; }
h3 { font-size: 17px; margin: 20px 0 4px; }
.meta { color: var(--muted); font-size: 14px; margin-bottom: 24px; }
a { color: var(--rose); }
.card { background: var(--surface); border: 1px solid var(--line); border-radius: 20px; padding: 20px 22px; margin: 16px 0; }
.callout { background: var(--tint); border-radius: 16px; padding: 14px 18px; }
ul { padding-left: 22px; } li { margin: 4px 0; }
table { width:100%; border-collapse: collapse; font-size: 15px; } td, th { text-align:left; padding: 8px 6px; border-bottom: 1px solid var(--line); vertical-align: top; }
label { display:block; font-weight: 600; margin: 14px 0 6px; }
input[type=email], input[type=password] { width:100%; padding: 12px 14px; border-radius: 12px; border: 1px solid var(--line); background: var(--bg); color: var(--ink); font-size: 16px; }
.check { display:flex; gap:10px; align-items:flex-start; font-weight: 400; }
.check input { margin-top: 5px; }
button { margin-top: 18px; width: 100%; padding: 14px; border: 0; border-radius: 999px; background: #B8325A; color: #fff; font-size: 16px; font-weight: 700; cursor: pointer; }
button:disabled { opacity: .6; cursor: progress; }
.status { margin-top: 14px; min-height: 1.5em; } .status.error { color: #D64545; } .status.done { font-weight: 700; color: var(--rose); }
footer { margin-top: 48px; color: var(--muted); font-size: 14px; }
</style>${head}
</head><body><main>
<header><a class="brand" href="/">${name}</a>
<nav><a href="/privacy">Privacy</a><a href="/terms">Terms</a><a href="/child-safety">Child safety</a><a href="/delete-account">Delete account</a></nav></header>
${body}
<footer>Questions? Email <a href="mailto:${escape(site.contactEmail)}">${escape(site.contactEmail)}</a>.</footer>
</main></body></html>`;
}

function home(site: SiteInfo) {
  const n = escape(site.appName);
  return layout(site, n, `
<h1>${n}</h1>
<p class="meta">A private messenger for the people you love.</p>
<div class="card">
<p>${n} is a messaging app with end-to-end encrypted chats, photos, voice notes, status updates and calls — plus an optional public timeline and channels.</p>
<ul>
<li><a href="/privacy">Privacy Policy</a></li>
<li><a href="/terms">Terms of Service</a></li>
<li><a href="/child-safety">Child Safety Standards</a></li>
<li><a href="/delete-account">Delete your account</a></li>
</ul></div>`);
}

function privacy(site: SiteInfo) {
  const n = escape(site.appName);
  const mail = `<a href="mailto:${escape(site.contactEmail)}">${escape(site.contactEmail)}</a>`;
  return layout(site, 'Privacy Policy', `
<h1>Privacy Policy</h1>
<p class="meta">Effective ${EFFECTIVE}</p>

<div class="callout"><strong>The short version.</strong> Your messages, chat photos, voice notes, status updates and calls are end-to-end encrypted: we can't read, see or hear them. We collect only what we need to run the service, we don't show ads, we don't sell or share your data for advertising, and you can delete your account at any time.</div>

<h2>1. Who we are</h2>
<p>${n} (“we”, “us”) provides the ${n} mobile app and the service behind it. Contact: ${mail}.</p>

<h2>2. What we can't see</h2>
<p>Chats (one-to-one, groups, community announcements), chat photos and voice notes, and status updates are encrypted on your device with keys that only you and the people you're talking to hold. Our servers store and relay only encrypted data. Voice and video calls are encrypted end to end between the two phones; the call setup is also encrypted so our servers can't intercept it. Your password never leaves your device — we receive only a derived login secret, which we store as a one-way hash.</p>

<h2>3. Information we collect</h2>
<table>
<tr><th>What</th><th>Why</th></tr>
<tr><td><strong>Account details</strong>: email address, username, display name, optional bio; your public encryption key and an encrypted backup of your private key (which only your password can unlock)</td><td>Create and secure your account, let people find you by username, restore your chats when you sign in on a new phone</td></tr>
<tr><td><strong>Content you choose to make public</strong>: timeline posts and their photos, comments and likes, channels you create, their posts and reactions, your profile</td><td>Show it to other users, as you intend</td></tr>
<tr><td><strong>Messaging metadata</strong>: who is in which chat, group names, descriptions and settings, group history (e.g. “Ana added Ben”), message timestamps and sizes, read receipts (if you turn them on), who viewed your status, encrypted media files</td><td>Deliver messages and keep chats in sync across your devices</td></tr>
<tr><td><strong>Call information</strong>: who called whom, when, whether it was answered, and how long it lasted</td><td>Connect calls and show your call history</td></tr>
<tr><td><strong>Safety information</strong>: people you block, and reports you make (including anything you choose to paste into a report)</td><td>Enforce our Terms and keep people safe</td></tr>
<tr><td><strong>Device information</strong>: a push-notification token</td><td>Send notifications. Notifications never contain message content.</td></tr>
<tr><td><strong>Technical logs</strong>: IP address and request information kept briefly by our hosting provider</td><td>Security, abuse prevention and fixing problems</td></tr>
</table>
<p>We do not collect your contacts, location, or advertising identifiers, and we don't use analytics or tracking SDKs. Camera and microphone are used only when you take or send a photo, record a voice note or make a call.</p>

<h2>4. How we share information</h2>
<p>We don't sell your personal information or share it for advertising. We share it only with:</p>
<ul>
<li><strong>Service providers</strong> that run the service for us, under contract: Railway (servers and encrypted media storage, United States), Neon (database, United States), and Expo, Google and Apple (delivering push notifications).</li>
<li><strong>Other users</strong>, as you direct — e.g. your profile and public posts, or messages to the people you send them to.</li>
<li><strong>Authorities</strong>, when required by law, or to protect someone's safety — including reporting child sexual abuse material to the National Center for Missing &amp; Exploited Children (NCMEC). We can only provide what we hold; we cannot decrypt messages.</li>
</ul>

<h2>5. How long we keep it</h2>
<p>We keep your information while your account exists. When you delete your account we delete your profile, the messages and status updates you sent, your posts, comments, channels and reactions, your media, and chats nobody is left in. Reports you made are kept without your identity so we can finish acting on them. Backups are overwritten within 30 days. Expired status updates are deleted automatically after 24 hours.</p>

<h2>6. Your choices and rights</h2>
<ul>
<li>Edit your profile and privacy settings (like read receipts) in the app.</li>
<li>Block or report anyone from their profile or chat.</li>
<li>Delete your account in the app (<em>You → Account → Delete account</em>) or on the web at <a href="/delete-account">/delete-account</a>.</li>
<li>Depending on where you live (e.g. the EU, UK or California), you can ask to access, correct, export or delete your information, or object to how it's used. Email ${mail}; we respond within 30 days. You can also complain to your local data-protection authority.</li>
</ul>

<h2>7. Security</h2>
<p>Besides end-to-end encryption, all traffic to our servers uses TLS, and stored media is private and only reachable through short-lived links. No system is perfectly secure; if we learn of a breach affecting you we'll tell you as the law requires.</p>

<h2>8. Children</h2>
<p>${n} is for people aged 18 and over. We don't knowingly collect information from anyone younger. If you believe a child is using ${n}, contact us and we'll remove the account.</p>

<h2>9. International transfers</h2>
<p>We process information in the United States. Where the law requires, we rely on appropriate safeguards such as standard contractual clauses.</p>

<h2>10. Changes</h2>
<p>We'll post any update here and change the date above. For significant changes we'll also tell you in the app.</p>

<h2>11. Contact</h2>
<p>${mail}</p>`);
}

function terms(site: SiteInfo) {
  const n = escape(site.appName);
  const mail = `<a href="mailto:${escape(site.contactEmail)}">${escape(site.contactEmail)}</a>`;
  return layout(site, 'Terms of Service', `
<h1>Terms of Service</h1>
<p class="meta">Effective ${EFFECTIVE}</p>
<p>These terms are an agreement between you and ${n}. By creating an account you agree to them and to our <a href="/privacy">Privacy Policy</a>.</p>

<h2>1. Who can use ${n}</h2>
<p>You must be at least <strong>18 years old</strong> and able to form a binding contract. You may not use ${n} if we've suspended you before or if the law prohibits it. Keep your password safe — because your messages are end-to-end encrypted, we can't recover them if you lose it.</p>

<h2>2. Acceptable use</h2>
<p>Don't use ${n} to:</p>
<ul>
<li>Sexualise, exploit or endanger children in any way. We have zero tolerance — see our <a href="/child-safety">Child Safety Standards</a>.</li>
<li>Harass, bully, threaten, stalk or intimidate anyone, or promote violence or hatred against people based on who they are.</li>
<li>Share intimate images of anyone without their consent, or sexually explicit content in public places (timeline, channels, profiles).</li>
<li>Impersonate others, scam, spam, or mislead people.</li>
<li>Share content that's illegal or that you don't have the right to share.</li>
<li>Break, overload, probe or reverse-engineer the service, or access accounts or data that aren't yours.</li>
</ul>

<h2>3. Your content</h2>
<p>You own what you create. Private messages stay between you and the people you send them to — we can't read them. For content you make public (timeline posts, comments, channels, your profile), you give us a worldwide, non-exclusive, royalty-free licence to host, store and display it so the service works; this ends when you delete the content, except for copies others have already shared.</p>

<h2>4. Safety and moderation</h2>
<p>You can block anyone and report people, posts, comments, channels and chats from inside the app. We review reports and may remove content, restrict features, or suspend or delete accounts that break these terms, and we report child sexual abuse material to the authorities. Because chats are end-to-end encrypted, we act on what reporters share with us and on public content.</p>

<h2>5. The service</h2>
<p>We work to keep ${n} running and secure, but we provide it “as is”, without warranties, and we may change or stop features. To the extent the law allows, we're not liable for indirect or consequential losses, and our total liability is limited to the greater of what you paid us in the last 12 months or USD 50. Nothing here limits rights you have under consumer law that can't be waived.</p>

<h2>6. Ending</h2>
<p>You can delete your account at any time (<em>You → Account → Delete account</em>, or <a href="/delete-account">on the web</a>). We may suspend or terminate accounts that break these terms or the law.</p>

<h2>7. Changes and contact</h2>
<p>We may update these terms and will post the new version here; continuing to use ${n} means you accept them. Questions: ${mail}.</p>`);
}

function childSafety(site: SiteInfo) {
  const n = escape(site.appName);
  const mail = `<a href="mailto:${escape(site.contactEmail)}">${escape(site.contactEmail)}</a>`;
  return layout(site, 'Child Safety Standards', `
<h1>Child Safety Standards</h1>
<p class="meta">Effective ${EFFECTIVE}</p>
<div class="callout"><strong>${n} has zero tolerance for child sexual abuse and exploitation (CSAE), including child sexual abuse material (CSAM), grooming, sextortion and trafficking.</strong></div>

<h2>Our standards</h2>
<ul>
<li>${n} is only for adults aged 18+. Accounts we believe belong to minors are removed.</li>
<li>Any content or behaviour that sexualises, exploits or endangers children is prohibited, in private chats and in public spaces alike, and breaks our <a href="/terms">Terms</a>.</li>
<li>We remove violating content, permanently ban the accounts involved, and preserve relevant information as the law requires.</li>
<li>We report apparent CSAM and child exploitation to the National Center for Missing &amp; Exploited Children (NCMEC) and to law enforcement where required, and we comply with applicable child-safety laws.</li>
</ul>

<h2>How to report</h2>
<ul>
<li><strong>In the app:</strong> open the person's profile, the chat, the post, the comment or the channel and tap <em>Report</em>. You can include details or screenshots of what you saw — because chats are end-to-end encrypted, your report is how we learn about it.</li>
<li><strong>By email:</strong> ${mail} — we prioritise child-safety reports.</li>
<li>If a child is in immediate danger, contact your local emergency services. You can also report to NCMEC's CyberTipline (<a href="https://report.cybertip.org">report.cybertip.org</a>) or your national hotline (see <a href="https://www.inhope.org">inhope.org</a>).</li>
</ul>

<h2>Child safety contact</h2>
<p>Our designated point of contact for child safety, including enquiries from Google Play and law enforcement: ${mail}.</p>`);
}

function deleteAccount(site: SiteInfo) {
  const n = escape(site.appName);
  const mail = `<a href="mailto:${escape(site.contactEmail)}?subject=Delete%20my%20${n}%20account">${escape(site.contactEmail)}</a>`;
  return layout(site, 'Delete your account', `
<h1>Delete your ${n} account</h1>
<p class="meta">This permanently deletes your account and its data. It can't be undone.</p>

<h2>In the app</h2>
<p>Open ${n}, go to <strong>You → Account → Delete account</strong>, and confirm.</p>

<h2>On the web</h2>
<div class="card">
<form id="delete-form" autocomplete="on">
<label for="email">Email</label>
<input id="email" name="email" type="email" required autocomplete="username">
<label for="password">Password</label>
<input id="password" name="password" type="password" required autocomplete="current-password">
<label class="check"><input id="confirm" name="confirm" type="checkbox"> I understand my account, messages and posts will be permanently deleted.</label>
<button type="submit">Delete my account</button>
</form>
<p id="status" class="status" role="status" aria-live="polite"></p>
<p class="meta">Your password is checked in this browser and never sent to us.</p>
</div>

<h2>Forgot your password?</h2>
<p>Email ${mail} from the email address on your account and we'll delete it within 30 days.</p>

<h2>What's deleted</h2>
<ul>
<li>Your profile, username and email address</li>
<li>Messages, photos, voice notes and status updates you sent</li>
<li>Your timeline posts, comments, likes, channels and reactions, and their photos</li>
<li>Chats nobody is left in, your call history and blocks</li>
</ul>
<h2>What's kept</h2>
<ul>
<li>Reports you made are kept without your identity so we can finish acting on them.</li>
<li>Backups are overwritten within 30 days.</li>
</ul>`,
  `<script type="importmap">{"imports":{"libsodium-sumo":"/static/sodium/libsodium-sumo.mjs"}}</script>
<script type="module" src="/static/delete-account.mjs"></script>`);
}

export function registerPages(app: App, site: SiteInfo = DEFAULT_SITE) {
  const html = (render: (s: SiteInfo) => string) => {
    const page = render(site);
    return (c: Context<AppEnv>) => {
      c.header('x-frame-options', 'DENY');
      c.header('referrer-policy', 'no-referrer');
      c.header('cache-control', 'public, max-age=300');
      return c.html(page);
    };
  };
  app.get('/', html(home));
  app.get('/privacy', html(privacy));
  app.get('/terms', html(terms));
  app.get('/child-safety', html(childSafety));
  app.get('/delete-account', html(deleteAccount));

  const files = Object.fromEntries(Object.entries(STATIC).map(([k, load]) => [k, load()]));
  app.get('/static/*', (c) => {
    const file = files[c.req.path.slice('/static/'.length)];
    if (file === undefined) return c.notFound();
    c.header('content-type', 'text/javascript; charset=utf-8');
    c.header('cache-control', 'public, max-age=3600');
    return c.body(file);
  });
}
