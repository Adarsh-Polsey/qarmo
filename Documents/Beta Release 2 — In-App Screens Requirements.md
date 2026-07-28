# Beta Release 2 — In-App Screens Requirements

| | |
|---|---|
| **Spec ID** | BETA-APP |
| **Name** | Beta In-App Screens (post-login) |
| **App** | Beta app — single build; the tab set is chosen by `account_type` |
| **Phase** | Beta |
| **Status** | planned |
| **Builds on** | Beta Release 1 registration (`profiles`, `account_type`, `partner_type`, phone-OTP login) |

> **Beta note.** This covers everything a user sees **after login**. It is self-contained. Location shown on the map is **static last-known** data, never live tracking. Follows the vault Design Philosophy for all visuals.

---

## 1. Overview & Goal

After login the app shows a **three-tab bottom navigation** whose contents depend on `account_type`:

- **Customer:** **Home** (a map of nearby partners) · **AI Agent** (coming soon) · **Account**.
- **Partner:** **Home** (an ID-card summary) · **Job Board** (coming soon) · **Account**.

Two beta goals shape this release:

1. **Show liquidity to build trust and motivation.** Customers see partners on a map; both customers and partners see a **global count of partners onboarded**. Partners also see their **own referral progress**.
2. **Stay dead simple and cheap.** No live location, no polling. A partner's position is written **once when they open the app**; a customer sees a **snapshot** for whatever map area they're looking at.

## 2. User Stories

- As a **customer**, I want to open the app and see partners near me on a map, so I believe the service is real and close by.
- As a **customer**, I want to pan the map to another area and see partners there, so I can check coverage where I'm going.
- As a **partner**, I want an ID-card home that shows my referral points and how many friends joined, so I feel rewarded and want to invite more.
- As **both**, I want to see how many partners have joined Qarmo, so the platform feels like it's growing.
- As **both**, I want a simple account screen with my details and a clear way to log out.

## 3. Preconditions & Dependencies

1. **Registration done (Beta 1):** the user has a `profiles` row with `account_type` (`customer` | `partner`) and, for partners, `partner_type`, `full_name`, `city`, `plate_number`, `avatar_path`, and a shareable `referral_code`.
2. **Maps SDK** available for the map view; a **PostGIS** `geography(Point)` column for partner locations.
3. **Location permission** is requested contextually: on the customer's first Home open (to center the map) and on a partner's app open (to place them on the map). Denial never blocks app use.
4. **Design system:** Design Philosophy applies (light theme, one amber element per screen, icon + word, ≥56 dp targets, ≤8-word lines, money/success in Kerala Green, i18n-ready copy, visible bottom tabs only).

## 4. Detailed Requirements

> **Status key:** `[x]` implemented and verified in code · `[ ]` missing or contradicts the spec. *Italic notes* flag partial coverage or a pending deploy step.

### 4.1 App shell & tab routing

- [x] **B2-1.** After login the app reads `account_type` and renders the matching **3-tab bottom navigation**, tabs always visible, each **icon + label**:
  - Customer → **Home · AI Agent · Account**
  - Partner → **Home · Job Board · Account**
- [x] **B2-2.** The bottom tab bar is the only navigation. No hamburger, no hidden gestures, no horizontal swiping; back is predictable.
- [x] **B2-3.** Both Home screens carry the **global "partners onboarded" counter** (§4.8) as a top strip.

### 4.2 Customer — Home (map)

- [x] **B2-4.** Home is a **full-screen, Google-Maps-style map**, centered on the **customer's current location** (device GPS) at a sensible default zoom. *(Mobile only — the web build shows a static "open on phone" placeholder card, no live map.)*
- [x] **B2-5.** The map shows **partner pins** whose last-known location falls **within the current map viewport**: **Ride Partners (🛺)** and **Delivery Partners (🛵)** with distinct markers.
- [x] **B2-6.** **Viewport-driven refresh:** when the customer pans or zooms, the app re-queries partners for the **newly visible region** once the map settles (debounced ~400 ms). This is the **only** refresh trigger — no polling, no interval, no auto-movement of pins.
- [x] **B2-7.** Partner positions are **static last-known** locations (written when each partner last opened the app, §4.9). They do **not** move in real time; a pin is wherever that partner last opened Qarmo.
- [x] **B2-8.** Partners appear as **plain type icons** on the map (🛺 Ride / 🛵 Delivery) — **no tap callout**. No name, phone, address, or status is shown; the icon alone signals that a partner of that type is there.
- [x] **B2-9.** **Result cap:** a single query returns at most **100** partners; if the region holds more, show the 100 nearest to the map center and a subtle "Zoom in to see more" hint.
- [x] **B2-10.** The customer's own location is used **only to center the map**. It is **never written to the database and never shown to partners**.
- [x] **B2-11.** **Location denied:** center the map on **Kochi** (the default fallback coordinates), show a one-line fix-it banner ("Turn on location to see partners near you. **Open settings**"), and still allow panning/querying.

### 4.3 Customer — AI Agent

- [x] **B2-12.** *(Supersedes the original "Coming soon" placeholder — shipped early by product decision.)* The tab embeds a **live Botpress webchat**, full-screen, via the Botpress Cloud **shareable webchat URL** (`config/botpress.ts`), not the floating-bubble inject script — the shareable build renders identically whether hosted in a native `WebView` or a web `<iframe>`, so one URL and one screen work on both targets:
  - **Native (`AiAgentScreen.tsx`):** `react-native-webview`'s `WebView` loads the URL with `javaScriptEnabled`/`domStorageEnabled` on, `originWhitelist={['*']}`, and a centered `ActivityIndicator` overlay shown between `onLoadStart`/`onLoadEnd`.
  - **Web (`AiAgentScreen.web.tsx`):** a raw DOM `<iframe>` (react-native-web renders through React DOM, so this is a plain element, not a wrapped component) pointed at the same URL, borderless and filling the tab, with `allow="microphone; clipboard-write"` for the chat's mic/copy features.
  - No app-side chat UI, message list, or state is built or maintained — Botpress Cloud owns the entire conversation surface; the screen is just a sized, styled embed.

### 4.4 Customer — Account

- [ ] **B2-13.** Shows the customer's profile: photo (if set), **name**, **phone**, and **account type**. **View-only.** *(Screen exists but is not view-only — see B2-15.)*
- [x] **B2-14.** A **Log out** action (secondary style) with a confirm: "Log out? **Yes / No**".
- [ ] **B2-15.** Editing profile details is **out of scope** for the beta. *(Violated — ProfileScreen currently allows tap-to-edit avatar and name.)*

### 4.5 Partner — Home (ID card)

- [x] **B2-16.** Home shows an **ID-card-style summary**: partner **photo**, **name**, **partner type** (🛺 Ride / 🛵 Delivery), **city**, and **plate number** — laid out like an identity card.
- [x] **B2-17.** The card leads with **referral figures**:
  - **Referral points** — **50 points per successfully onboarded partner**, shown **huge** in Kerala Green (money/success color). **Display-only** — points accumulate but cannot be redeemed in the beta.
  - **Referred count** — "N friends joined" (the partner's own onboarded count, §4.8).
- [x] **B2-18.** The card shows the partner's **own shareable referral code**, with a **Share my code** action — the single amber element on this screen — that opens the OS share sheet pre-filled with **"Join Qarmo with my code &lt;CODE&gt;"** (e.g., "Join Qarmo with my code QARM123"). *(Includes copy-to-clipboard fallback when the share sheet is unavailable.)*
- [x] **B2-19.** **Earnings are hidden** in the beta (no jobs yet) — `DashboardScreen.tsx`'s ID card (`idStats`) renders exactly three rows (points, referred count, referral code) and nothing else; there is no earnings field, no placeholder value, and no dedicated space in the layout for one. *(Deviates from the original spec: no room is reserved for an earnings figure — adding one later means editing the card's layout, not just filling in a blank.)*

### 4.6 Partner — Job Board

- [x] **B2-20.** A centered **"Coming soon"** placeholder (icon + words), no job list, no other controls.

### 4.7 Partner — Account

- [ ] **B2-21.** Shows the partner's profile: photo, **name**, **phone**, **partner type**, **city**, **plate number**. **View-only.** *(Same shared ProfileScreen as B2-13 — not view-only.)*
- [x] **B2-22.** A **Log out** action with the same confirm as B2-14. Editing is out of scope. *(Log out itself is correct; editing is present elsewhere on the same screen — see B2-15.)*

### 4.8 "Partners onboarded" counter (shared)

- [x] **B2-23.** Both Home screens show a **global count of partners onboarded app-wide** ("512 partners on Qarmo") — the same number for everyone. It **updates live** via a Supabase Realtime subscription: the initial value is fetched on Home open, then the number ticks up on its own as new partners join while the screen is visible. *(Code fixed this session — requires migration `00014_profiles_realtime_publication.sql` to be applied to the database before live ticking works.)*
- [x] **B2-24.** The global number counts `profiles` where `account_type = 'partner'`.
- [x] **B2-25.** On the **partner** Home only, the ID card **additionally** shows the partner's **personal** referred-count (people they onboarded) — distinct from the global number (B2-17).
- [x] **B2-26.** Copy handles singular/zero gracefully ("1 partner on Qarmo", "Be the first — invite a friend").

### 4.9 Partner location capture (on app open)

- [x] **B2-27.** When a **partner** opens the app (cold start or foreground), capture the device's current GPS **once** and write it to `last_location` + `location_updated_at` on their profile. **One-shot only** — no interval, no background service, no continuous tracking.
- [x] **B2-28.** Requires location permission. If denied, the partner is simply **not placed on the map** (no block on using the app); show a gentle one-line note: "Turn on location so customers can find you."
- [x] **B2-29.** **Customers never write location** — only partners do. A partner's stored location is exposed to customers **only** through the bounded map query (§6.2), returning coarse fields.

## 5. UI / UX Specification

All screens pass the Design Philosophy §8 checklist. Bottom tabs always visible; one amber element per screen; money/referral figures in Kerala Green; text ≥16 px; ≤8-word lines; i18n-keyed copy.

**Customer — Home (map):**

```
┌─────────────────────────────────┐
│  🎉 512 partners on Qarmo       │  ← global counter strip
├─────────────────────────────────┤
│      🛺            🛵           │
│                                 │
│           📍 (you)              │  ← map centered on customer
│    🛵          🛺              │
│                                 │
│      (pan → re-query region)    │
├─────────────────────────────────┤
│ [ Home ]  [ AI Agent ] [Account]│
└─────────────────────────────────┘
```

**Coming-soon tabs (AI Agent / Job Board):**

```
┌─────────────────────────────────┐
│                                 │
│            🤖 / 📋              │
│         Coming soon             │
│                                 │
├─────────────────────────────────┤
│           (bottom tabs)         │
└─────────────────────────────────┘
```

**Partner — Home (ID card):**

```
┌─────────────────────────────────┐
│  🎉 512 partners on Qarmo       │  ← global counter strip
├─────────────────────────────────┤
│ ┌──────────── ID ─────────────┐ │
│ │ (photo)  Ramesh             │ │
│ │          🛺 Ride Partner    │ │
│ │          Kottayam · KL00AB.. │ │
│ │                             │ │
│ │   ⭐ 150 points             │ │  ← 40 px, Kerala Green
│ │   3 friends joined          │ │  ← personal referred count
│ │   Your code:  QARM123       │ │
│ └─────────────────────────────┘ │
│ ┌─────────────────────────────┐ │
│ │      🔗  Share my code      │ │  ← single amber element
│ └─────────────────────────────┘ │
├─────────────────────────────────┤
│ [ Home ]   [ Jobs ]   [Account] │
└─────────────────────────────────┘
```

**Account (customer or partner):**

```
┌─────────────────────────────────┐
│  Account                        │
│   (photo)                       │
│   Ramesh                        │
│   +91 90000 00000               │
│   Ride Partner · Kottayam       │  ← partner shows type/city/plate
│                                 │
│ ┌─────────────────────────────┐ │
│ │      🚪  Log out            │ │  ← secondary; "Yes / No" confirm
│ └─────────────────────────────┘ │
├─────────────────────────────────┤
│            (bottom tabs)        │
└─────────────────────────────────┘
```

- Empty map (no partners in view): no error — just the map, optionally a faint "No partners here yet" hint.
- Fix-it banners are full-width inline (not toasts): icon + ≤8-word line + one button.

## 6. Data & Backend

### 6.1 `profiles` additions (partner location)

| Column | Notes |
|---|---|
| `last_location` | `geography(Point)` — partner's last-known position (B2-27) |
| `location_updated_at` | `timestamptz` — when it was written |

- Written **only** by the owning partner, one-shot on app open. Customers have no location columns.

### 6.2 Reading partner locations (map query)

- A **security-definer RPC** `partners_in_bounds(min_lng, min_lat, max_lng, max_lat)` returns, for `account_type = 'partner'` rows with a non-null `last_location` **inside the bounding box**: `id`, `partner_type`, `lng`, `lat` — **coarse fields only** (no name or phone, since there is no callout — only the type icon is drawn), capped at 100, ordered by distance to the box center.
- This RPC is the **only** path by which a customer reads partner locations; direct table RLS does **not** expose other users' rows. The bounding box comes from the current map viewport; the client calls it (debounced) on region change.

### 6.3 Counts

- **Global partners onboarded:** `select count(*) from profiles where account_type = 'partner'` for the **initial** value, then kept **live** via a Supabase Realtime subscription on `profiles` inserts (filtered to partners) so the displayed number increments as partners join (B2-23).
- **Personal referred count:** `select count(*) from profiles where referred_by = <my referral_code>`.
- **Referral points (display-only):** `personal_referred_count * 50`. No redemption, no ledger writes in this release.

### 6.4 RLS & privacy

- Partners `update` only their own `last_location`. No user can read another user's `profiles` row directly.
- Partner location is exposed to customers only via the bounded RPC (coarse), never customer location to anyone.
- **Accepted beta risk:** a partner's approximate last-known point is visible to any customer who pans there. Location jitter/approximation and online-only visibility are **future hardening**, not in this release.

## 7. Acceptance Scenarios

1. **Routing by role** — A logged-in customer sees Home/AI Agent/Account; a logged-in partner sees Home/Job Board/Account.
2. **Map centers on customer** — With location granted, the customer's Home opens centered on their GPS at default zoom.
3. **Partners in view** — Ride (🛺) and Delivery (🛵) partners whose last-known location is within the viewport appear as **type icons**; there is no tap callout.
4. **Pan re-queries** — Dragging the map to another town loads the partners in that region (debounced) and drops the previous region's pins; no interval refresh occurs while the map is still.
5. **Static positions** — Pins do not move on their own; a partner pin sits at wherever that partner last opened the app.
6. **Result cap** — In a dense region the map shows at most 100 nearest pins plus a "Zoom in to see more" hint.
7. **Customer location denied** — The map centers on **Kochi** (default), shows the fix-it banner, and still supports panning/querying.
8. **Customer location privacy** — No customer location row is ever written; partners never see customers on any map.
9. **Partner location on open** — Opening the app as a partner (location granted) writes one `last_location`/`location_updated_at`; no further writes happen while the app stays open.
10. **Partner location denied** — The partner uses the app normally but is absent from the map, with a gentle enable-location note.
11. **Live global counter** — Both Home screens show the same partner-onboarded total; when a new partner registers while the screen is open, the number ticks up **live** with no manual refresh.
12. **Partner referrals** — The ID card shows points = referred×50 (green) and "N friends joined"; a partner with 0 referrals shows 0 points and an invite nudge.
13. **Share code** — Tapping "Share my code" opens the OS share sheet pre-filled with "Join Qarmo with my code &lt;CODE&gt;".
14. **Earnings hidden** — Nothing about earnings appears on the partner Home in the beta.
15. **Coming-soon tabs** — AI Agent and Job Board each show only a "Coming soon" placeholder.
16. **Log out** — Log out asks "Yes / No"; confirming returns to the landing/login screen.

## 8. Edge Cases & Failure Modes

| Case | Required behavior |
|---|---|
| Customer pans rapidly | Debounce; cancel in-flight queries; only the last settled region is queried |
| No partners in the viewport | Map shows no pins (optional faint hint); never an error |
| Partner opens app offline | Location write queued and retried; the map shows their previous position until it lands |
| Partner has never granted location | Absent from the map; enable-location note on their Home; no crash, no block |
| Stale partner location (opened days ago) | Still shown (beta has no staleness filter); acceptable for now |
| Global count = 0 or 1 | Singular/zero copy ("Be the first — invite a friend" / "1 partner on Qarmo") |
| Very dense area beyond the cap | Nearest 100 + "Zoom in to see more" |
| Map SDK / tiles fail to load | Plain retry state, not a blank crash; counter and tabs still work |
| Referral code share unavailable (no share targets) | Fall back to copying the code with a "Code copied" confirmation |

## 9. Non-Functional Requirements

- **No polling / battery-friendly:** partner location is a single write on app open; customer map refreshes only on settled region change (debounced); the live partner counter uses a Realtime **push** subscription, not polling. No background location, no timers.
- **Query performance:** `partners_in_bounds` uses a GiST index on `last_location`; returns within ~1 s at beta scale; capped at 100 rows.
- **Privacy:** customer location never persisted; partner location exposed only coarsely via the RPC.
- **i18n:** all copy (counter, coming-soon, callouts, errors) locale-keyed; layouts tolerate ~40% longer strings.
- **Device target:** budget Android, one-handed, readable in sunlight.

## 10. Out of Scope (Beta 2)

- **Live / real-time** partner tracking, pin movement, ETAs, or routes.
- Booking, bidding, ride or delivery flows, and **earnings** (Job Board is "Coming soon").
- Any **AI Agent** functionality beyond the placeholder.
- **Editing** profile details or documents from Account.
- Referral **redemption** (points stay display-only).
- Partner **online/offline** status — every partner with a stored location is visible.
- Location **approximation/jitter** and other privacy hardening.
- Customer-visible partner details beyond type + first name.

## 11. Definition of Done

- [x] Post-login routing shows the correct 3 tabs per `account_type`
- [x] Customer Home map centers on GPS; partner pins (🛺/🛵) render for the current viewport *(mobile; web build has no live map yet)*
- [x] Panning/zooming re-queries the new region (debounced); no interval/polling exists
- [x] Partner pins are static last-known positions drawn as type icons; no tap callout
- [x] Result cap (100) + "zoom in" hint verified in a dense region
- [x] Customer location denial falls back to the **Kochi** center with a fix-it banner; customer location never written
- [x] Partner writes `last_location` once on app open; denial leaves them off-map without blocking
- [x] `partners_in_bounds` RPC is the only customer path to partner locations; direct RLS exposes nothing
- [x] Global "partners onboarded" counter shows on both Homes and updates **live** (Realtime) as partners join *(fixed this session — needs migration `00014` applied to the DB to take effect)*
- [x] Partner ID card shows points (referred×50, green), "N friends joined", code, and a working Share; earnings hidden
- [ ] AI Agent and Job Board show only "Coming soon"; Account is view-only with a confirmed Log out *(AI Agent is a live chat by design decision; Account screens still allow editing — see B2-13/B2-15/B2-21)*
- [ ] Every screen passes the Design Philosophy §8 checklist on a budget Android device; all copy via i18n keys *(copy is fully i18n-keyed; visual QA pass on-device not performed)*

## 12. Resolved Decisions

Settled during drafting (folded into the requirements above):

1. **Customer map scope** → Google-Maps-style view centered on the customer; show partners **within the current viewport**, and **re-query on pan/zoom** to a new region (B2-4 – B2-6).
2. **Map centering** → center on the **customer's GPS**; their location is used only to center and is never stored or shown (B2-4, B2-10).
3. **"Partners onboarded" number** → show **both**: a **global** total to everyone, plus the **partner's personal** referred-count on their ID card (B2-23, B2-25).
4. **Partner ID card** → show **referral points + referred-count**; **earnings hidden** until the Job Board ships (B2-17, B2-19).
5. **Location fallback center** → **Kochi**, when a customer denies location (B2-11).
6. **Map pins** → **plain type icons only, no tap callout** (no name/photo) (B2-8).
7. **Global counter freshness** → **live** via a Supabase Realtime subscription, ticking up as partners join (B2-23).
8. **Referral share text** → the share sheet is pre-filled with **"Join Qarmo with my code &lt;CODE&gt;"** (B2-18).
