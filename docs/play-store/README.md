# Google Play submission — Lovenest

Everything Play Console asks for, ready to paste. Live URLs are served by the API
server (`apps/server/src/routes/pages.ts`).

| | |
|---|---|
| **App name** | Lovenest |
| **Package** | `com.lovenest.app` |
| **Category** | Communication |
| **Contact email** | hz3302m@gmail.com |
| **Privacy policy** | https://server-production-403b.up.railway.app/privacy |
| **Terms of service** | https://server-production-403b.up.railway.app/terms |
| **Account deletion URL** | https://server-production-403b.up.railway.app/delete-account |
| **Child safety standards** | https://server-production-403b.up.railway.app/child-safety |
| **Contains ads** | No |
| **In-app purchases** | No |
| **Target audience** | 18 and over |

## Graphics (this folder)

| Asset | File | Play requirement |
|---|---|---|
| App icon | `icon-512.png` | 512 × 512, 32-bit PNG |
| Feature graphic | `feature-graphic.png` | 1024 × 500 |
| Phone screenshots | `phone-1.png` … `phone-6.png` | 1080 × 1920 (9:16), 2–8 |

## Store listing

**App name (30):** `Lovenest: Private Messenger`

**Short description (80):**
`End-to-end encrypted chats, calls and moments with the people you love.`

**Full description:**

```
Lovenest is a private messenger for the people who matter most — your partner, your family, your closest friends.

PRIVATE BY DESIGN
• Every chat, photo, voice note and status update is end-to-end encrypted. Not even we can read them.
• Voice and video calls are encrypted end to end, too.
• Your password never leaves your phone.
• Verify a chat's safety number to be sure nobody is listening in.

MADE FOR CLOSENESS
• One-to-one chats and groups with photos, voice notes and reactions.
• Send a "thinking of you" heart with one tap.
• Status updates that disappear after 24 hours, only for people you chat with.
• Read receipts you control — turn them off any time.

STAY IN THE LOOP
• Communities bring related groups together, with an announcements chat for everyone.
• Follow channels for the topics and places you love.
• Share moments on an optional public timeline.

SAFE AND IN YOUR CONTROL
• Messages from new people wait in Requests until you accept.
• Block and report anyone, any time.
• Delete your account and its data whenever you want.
• Light and dark themes.

Lovenest is for people aged 18 and over.
```

**Release notes (first release):** `Welcome to Lovenest 💛`

## App content declarations

### Privacy policy
https://server-production-403b.up.railway.app/privacy

### App access
Choose **"All or some functionality is restricted"** and add the reviewer
login (you'll find it in the setup notes from Claude, created on the live
server):

- Username/email: `reviewer@lovenest.app`
- Password: *(given to you separately — not stored in the repo)*
- Instructions: "Sign in with 'I already have an account'. The account already
  has a chat with the demo user @lovenest_demo you can message and call."

### Ads
**No**, the app does not contain ads.

### Content rating (IARC questionnaire)
- Category: **Social / Communication**
- Violence, fear, sexuality, language, controlled substances, gambling: **No**
- Does the app allow users to interact or exchange content? **Yes**
- Can users share their physical location with others? **No**
- Does the app allow purchase of digital goods? **No**
- Does the app contain user-generated content? **Yes** (in-app reporting and blocking available)

### Target audience and content
- Age groups: **18 and over** only
- Appeals to children: **No**

### News app
No.

### Data safety
**Data collection and security**
- Does your app collect or share any of the required user data types? **Yes**
- Is all of the user data collected by your app encrypted in transit? **Yes**
- Do you provide a way for users to request that their data be deleted? **Yes** (in-app and https://server-production-403b.up.railway.app/delete-account)

**Data shared with third parties:** none. Hosting (Railway), database (Neon) and
push delivery (Expo/Google) are service providers acting on our behalf, which
Google doesn't count as "sharing".

**Data collected** — end-to-end encrypted chats, chat photos, voice notes,
status updates and calls are **not** listed: Google's definition excludes data
the developer can't access.

| Data type | Collected | Required? | Purposes | Processed ephemerally? |
|---|---|---|---|---|
| Personal info → Email address | Yes | Required | Account management, App functionality | No |
| Personal info → Name (display name) | Yes | Required | App functionality | No |
| Personal info → User IDs (username) | Yes | Required | App functionality, Account management | No |
| Photos and videos → Photos (public timeline & channel posts only) | Yes | Optional | App functionality | No |
| App activity → Other user-generated content (public posts, comments, channel posts, bio) | Yes | Optional | App functionality | No |
| App activity → App interactions (likes, follows, reactions, call history) | Yes | Optional | App functionality | No |
| Device or other IDs (push-notification token) | Yes | Optional | App functionality | No |

Not collected: location, contacts, calendar, health, financial info, web
history, files, audio (voice notes are E2EE), messages (E2EE), crash logs,
diagnostics, advertising ID.

### Government apps / Financial features / Health
Not applicable.

### Account deletion
- In-app: You → Account → Delete account
- Web: https://server-production-403b.up.railway.app/delete-account

### Child safety standards (required for social apps)
- Standards URL: https://server-production-403b.up.railway.app/child-safety
- In-app reporting: Yes (Report on profiles, chats, posts, comments, channels)
- Child safety point of contact: hz3302m@gmail.com

### Permissions
The Android build only requests: Internet, network state, camera (photos and
video calls), microphone (voice notes and calls), notifications, Bluetooth
(headsets in calls), vibrate, wake lock, audio settings. Broad storage,
media-library, overlay and foreground-service permissions are removed
(`android.blockedPermissions` in `app.json`), so no special permission
declarations are needed.

## Release checklist

1. Play Console → **Create app** → name *Lovenest*, app, free.
2. Fill **App content** using the answers above.
3. Fill **Store listing** with the text and graphics above.
4. Build: `cd apps/mobile && npx eas-cli@latest build --profile production --platform android`
5. Upload the `.aab` to **Testing → Internal testing** (the first upload must be manual), add testers, roll out.
6. When ready: **Production** → create release → promote the build. New personal
   developer accounts must first run a **closed test with at least 12 testers for
   14 days** before production access is granted.
