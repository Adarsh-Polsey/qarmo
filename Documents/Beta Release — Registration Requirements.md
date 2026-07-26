# Beta Release — Registration Requirements

| | |
|---|---|
| **Spec ID** | BETA-REG |
| **Name** | Beta Registration & Onboarding |
| **App** | Beta app — a **single build** that hosts both customer and partner registration |
| **Phase** | Beta |
| **Status** | planned |
| **Auth** | Phone OTP |
| **Verification** | Documents are collected and stored for **later** review — verification itself is **out of scope** |

> **Beta note.** For the beta, customer and partner sign-up live in **one app**. This is a deliberate beta-only choice; it does not change the longer-term plan of separate customer and partner apps. This document is self-contained and does not depend on any other spec in the vault.

---

## 1. Overview & Goal

One app, one front door. On first open the user sees a welcome image, one big **Register** button, and a small **Log in** link beneath it. Registration forks into two paths:

- **Customer** — the shortest possible sign-up (phone + name).
- **Partner** — the user first picks a partner type (**Delivery** or **Ride**), then fills their details and uploads an **Aadhaar card** and a **driving licence**.

The uploaded documents are stored so they can be verified later; **the beta does not verify them and does not block anyone**. Every user — customer or partner — can start using the app the moment registration finishes.

**The bar:** a first-time, low-literacy user can register without help. Customer sign-up is under a minute; partner sign-up is a short guided wizard where each screen asks for exactly one thing.

## 2. User Stories

- As a **new user**, I want an obvious way to register from the first screen, so I don't have to hunt for it.
- As a **returning user**, I want a small, clear way to log in instead of registering.
- As a **customer**, I want the fastest possible sign-up, so I can get to booking.
- As a **partner**, I want to say whether I deliver or drive an auto, so the app fits my work.
- As a **partner**, I want to submit my details and documents in simple one-at-a-time steps, so I never feel lost.
- As a **partner**, I want to start using the app immediately after registering, without waiting for approval.

## 3. Preconditions & Dependencies

1. **Auth:** Supabase Auth with **Phone OTP** enabled. A `profiles` row is created for every new auth user (trigger on `auth.users` insert).
2. **Storage:** a private Supabase Storage bucket for uploaded documents (see §6), owner-and-admin access only.
3. **Device:** camera / photo-library permission is requested only at the moment the user first uploads a photo or document — never up front.
4. **Design system:** all screens follow the vault Design Philosophy (deep-amber primary, one job per screen, icon + word, ≥56 dp targets, ≤8-word lines, light theme, i18n-ready copy).

## 4. Detailed Requirements

### 4.1 Landing screen

- **B-1.** The first screen shows: a **welcome image** (top), a **big primary Register button** (amber, full-width, bottom-anchored — the single amber element), and below it a **smaller "Log in" text button**.
- **B-2.** Tapping **Register** opens the **account-type** screen (§4.2). Tapping **Log in** opens the phone-OTP login flow (§4.7).
- **B-3.** No other actions, banners, or menus appear on this screen (P4 — nothing that isn't needed).

### 4.2 Account type

- **B-4.** After Register, the user chooses between two large, equally-weighted, tappable cards: **Customer** and **Partner** (each icon + word). Neither card is amber — this is a choice, not a primary action.
- **B-5.** Tapping a card advances immediately (no separate Continue button). Choosing **Customer** → §4.3. Choosing **Partner** → §4.4.
- **B-6.** The chosen account type is stored on the profile as `account_type` (`customer` | `partner`).

### 4.3 Customer registration (minimal)

A short wizard — one field per screen, progress shown as dots ("1 of 3"):

- **B-7.** **Phone.** Enter phone number (number pad opens automatically) → send OTP.
- **B-8.** **OTP.** Enter the code → verify. On success the auth user + `profiles` row exist, with `account_type = 'customer'`. Resend is offered after a short cooldown.
- **B-9.** **Name (required).** Enter full name → **Finish**. Name is mandatory; Finish stays disabled (grey, with a one-line reason) until a name is entered.
- **B-10.** On finish, the customer lands in the app immediately. No documents, no further fields.

### 4.4 Partner type

- **B-11.** When the user picks **Partner**, they first see a **partner-type** screen with two large tappable cards: **🛵 Delivery Partner** and **🛺 Ride Partner** (icon + word each).
- **B-12.** Tapping a card stores `partner_type` (`delivery` | `auto`) and advances to partner details (§4.5).

### 4.5 Partner registration details

A guided wizard — one thing per screen, dots show progress ("3 of 8"). Order:

- **B-13.** **Phone** → OTP → verify (same as B-7/B-8; establishes identity).
- **B-14.** **Full name.**
- **B-15.** **Vehicle registration / plate number** (plate-friendly keyboard: capitals + numbers).
- **B-16.** **City / area** (the town or area the partner works in).
- **B-17.** **Profile photo** — capture with camera or pick from library.
- **B-18.** **Aadhaar card** — upload/capture an image (see §4.6).
- **B-19.** **Driving licence** — upload/capture an image (see §4.6).
- **B-20.** **Referral code (optional)** — a partner may enter a referral code, or **Skip**. The code is validated against existing codes; an unknown code shows "**Code not found**" so the partner can correct it or Skip. Referral is never mandatory and never blocks Finish.
- **B-21.** **Finish.** On finish the profile is complete, documents are stored, and the partner **can use the app right away** — there is no approval gate.

### 4.6 Document upload

- **B-22.** Both partner types (Delivery and Ride) submit the **same two documents**: Aadhaar card and driving licence. Each is captured with the **camera** or picked from the **gallery**, shown back as a thumbnail with a **Retake / Replace** option before continuing.
- **B-23.** Each file is uploaded to the private documents bucket (§6) and recorded in `partner_documents` with `doc_type` and `review_status = 'pending'`.
- **B-24.** **Verification is out of scope.** Nothing in the beta reads, checks, approves, or rejects these documents; `review_status` stays `pending`. No screen tells the partner they are "unverified," and nothing is blocked by document state.
- **B-25.** Upload failures (no network, file too large) show a plain-words retry line ("Upload failed. **Try again**") and never lose the partner's earlier steps.

### 4.7 Login (returning users)

- **B-26.** The **Log in** link runs phone-OTP sign-in: enter phone → OTP → verify. On success the user lands wherever their existing `account_type` belongs (customer or partner).
- **B-27.** If the phone number has no account, the app offers to register instead ("No account yet. **Register**") — no dead end.

## 5. UI / UX Specification

All screens must pass the Design Philosophy §8 checklist: light theme, white background, one amber element per screen, every action = icon + word, touch targets ≥ 56 dp, nothing readable below 16 px, no sentence over 8 words, strings via i18n resources (survive ~40% expansion).

**Landing screen:**

```
┌─────────────────────────────────┐
│                                 │
│        (welcome image)          │  ← hero image, top
│                                 │
│                                 │
│ ┌─────────────────────────────┐ │
│ │      📝  REGISTER           │ │  ← single amber element,
│ │   (full-width, 64dp tall)   │ │     black text, bottom-anchored
│ └─────────────────────────────┘ │
│           Log in                │  ← small text button, below
└─────────────────────────────────┘
```

**Account type:**

```
┌─────────────────────────────────┐
│   How will you use Qarmo?       │  ← title (one per screen)
│ ┌─────────────────────────────┐ │
│ │  🧍  I need rides           │ │  ← Customer card (Mist, tappable)
│ └─────────────────────────────┘ │
│ ┌─────────────────────────────┐ │
│ │  🛺  I want to earn         │ │  ← Partner card (Mist, tappable)
│ └─────────────────────────────┘ │
└─────────────────────────────────┘
```

**Partner type:**

```
┌─────────────────────────────────┐
│   What do you do?               │
│ ┌─────────────────────────────┐ │
│ │  🛵  Delivery Partner       │ │
│ └─────────────────────────────┘ │
│ ┌─────────────────────────────┐ │
│ │  🛺  Ride Partner  │ │
│ └─────────────────────────────┘ │
└─────────────────────────────────┘
```

**Wizard step (example — plate number):**

```
┌─────────────────────────────────┐
│  ● ● ● ○ ○ ○ ○ ○   3 of 8       │  ← progress dots + count
│                                 │
│  Vehicle number                 │  ← label above the field
│ ┌─────────────────────────────┐ │
│ │  KL 00 AB 0000              │ │  ← input, caps+number keyboard
│ └─────────────────────────────┘ │
│ ┌─────────────────────────────┐ │
│ │      ➡️  CONTINUE           │ │  ← single amber element
│ └─────────────────────────────┘ │
└─────────────────────────────────┘
```

**Document step (example — Aadhaar):**

```
┌─────────────────────────────────┐
│  ● ● ● ● ● ○ ○ ○   6 of 8       │
│                                 │
│  Upload your Aadhaar card       │
│ ┌─────────────────────────────┐ │
│ │     📷  Take photo          │ │  ← camera
│ │     🖼️  Choose from gallery │ │  ← library
│ └─────────────────────────────┘ │
│   (thumbnail + Retake once set) │
│ ┌─────────────────────────────┐ │
│ │      ➡️  CONTINUE           │ │  ← enabled once an image is set
│ └─────────────────────────────┘ │
└─────────────────────────────────┘
```

- Back always goes to the previous step without losing entered data (P3 — no dead ends).
- Disabled Continue is grey with a one-line reason above it ("Add a photo to continue") — never a silent no-op.
- Validate on submit with plain-words inline messages + red border; never a technical error string.

## 6. Data & Backend

### 6.1 `profiles` (created on first auth)

| Column | Notes |
|---|---|
| `id` | = auth user id |
| `phone` | from Phone OTP |
| `full_name` | required for both customer (B-9) and partner (B-14) |
| `account_type` | `customer` \| `partner` (B-6) |
| `partner_type` | `delivery` \| `auto` \| null (B-12) |
| `city` | partner only (B-16) |
| `plate_number` | partner only (B-15) |
| `avatar_path` | profile photo (B-17) |
| `referral_code` | the user's **own** shareable code |
| `referred_by` | referral code entered at sign-up, if any (B-20) |
| `created_at` | timestamp |

### 6.2 `partner_documents`

```sql
create table partner_documents (
  id            uuid primary key default gen_random_uuid(),
  partner_id    uuid not null references profiles(id),
  doc_type      text not null check (doc_type in ('aadhaar','driving_licence')),
  storage_path  text not null,
  review_status text not null default 'pending'
                check (review_status in ('pending','verified','rejected')),
  uploaded_at   timestamptz not null default now(),
  unique (partner_id, doc_type)
);
```

- `review_status` exists for the future but stays `pending` in the beta — **nothing sets it and nothing reads it as a gate** (B-24).
- Re-upload of the same `doc_type` replaces the record (upsert on `(partner_id, doc_type)`).

### 6.3 Storage

- Private bucket `partner-documents`, RLS: a partner may read/write **only their own** files; no public read. Profile photos go to a separate `avatars` bucket (public read).

### 6.4 RLS

- Every user reads/writes **only their own** `profiles` row and **only their own** `partner_documents` rows (`partner_id = auth.uid()`).
- No verification, admin-review, or KYC-provider logic ships in the beta.

## 7. Acceptance Scenarios

1. **Landing actions** — On first open, the welcome image, a big amber Register button, and a small Log in link are visible; Register opens account-type, Log in opens phone login.
2. **Customer happy path** — Choosing Customer, entering phone + OTP + name lands the user in the app with `account_type = 'customer'` and no document steps; Finish is disabled until a name is entered.
3. **Partner type stored** — Choosing Partner then Ride stores `partner_type = 'ride'` before any detail is entered.
4. **Partner happy path** — A partner completes phone + OTP, name, plate, city, photo, Aadhaar, licence, (skips referral), taps Finish, and can immediately use the app; two `partner_documents` rows exist with `review_status = 'pending'`.
5. **Referral optional** — A partner who taps Skip on the referral step finishes successfully with `referred_by = null`.
6. **Referral validated** — A valid referral code finishes with `referred_by` set to it; an unknown code shows "Code not found" and the partner can correct it or Skip (Finish is never blocked).
7. **No gate** — Immediately after Finish, nothing in the app labels the partner "unverified" and no action is blocked by document state.
8. **Document replace** — Retaking the Aadhaar photo before Continue replaces the thumbnail and uploads the new image; only one Aadhaar row exists.
9. **Upload failure** — With no network on the Aadhaar step, the app shows "Upload failed. **Try again**", keeps all earlier steps, and succeeds on retry.
10. **Back preserves data** — Going back from City to Plate shows the plate value still filled in.
11. **Login existing user** — A returning partner logs in via phone OTP and lands in the partner experience.
12. **Login unknown number** — Logging in with an unregistered number offers "No account yet. **Register**".

## 8. Edge Cases & Failure Modes

| Case | Required behavior |
|---|---|
| Phone already registered, user taps Register | After OTP, recognise the existing account and continue to the app (no duplicate profile) |
| OTP wrong / expired | Plain-words message + Resend after cooldown; never a technical error |
| Camera/library permission denied | One-line fix-it prompt with **Open settings**; the step is not skippable for required documents |
| File too large / unsupported | Reject with "Photo too big. **Try again**"; allow re-pick |
| App backgrounded mid-wizard | On return, restore to the last completed step with entered data intact |
| Network drop between steps | Field values held locally; writes retry; no progress lost |
| User abandons after phone+OTP but before Finish | Profile exists but is incomplete; on next open, resume the wizard from the **last completed step** (never restart from the top) |
| Referral code doesn't exist | Show "Code not found" on the referral step; the partner corrects it or taps Skip — Finish is never blocked |

## 9. Non-Functional Requirements

- **Speed:** customer registration ≤ ~1 minute; each wizard step is a single decision.
- **i18n:** all copy (including OTP, upload, and error messages) comes from locale resource files; layouts tolerate ~40% longer strings.
- **Privacy & security:** documents live in a private bucket, owner-access only; secrets never in the client; OTP rate-limited by Supabase Auth.
- **Resilience:** partial progress is never lost to a network blip or app backgrounding.
- **Device target:** budget Android, one-handed, readable in sunlight.

## 10. Out of Scope (Beta)

- **Verifying, reviewing, approving, or rejecting** Aadhaar / driving-licence documents — collection and storage only.
- Any admin/ops review tooling or KYC-provider integration.
- Any partner or customer functionality **beyond registration and login** (booking, bidding, deliveries, earnings, payments).
- Referral **reward mechanics** (points crediting/redemption) — the referral code is captured only.
- Email/password auth, social login, multi-device session management.
- Editing profile details or replacing documents after registration (beyond in-wizard retake).

## 11. Definition of Done

- [ ] Landing screen: welcome image, big amber Register, small Log in link — all wired
- [ ] Account-type screen forks correctly to customer vs. partner and stores `account_type`
- [ ] Customer wizard (phone → OTP → name) completes and lands in the app; Finish blocked until a name is entered
- [ ] Partner-type screen stores `delivery` / `auto`
- [ ] Partner wizard collects name, plate, city, photo, Aadhaar, licence, optional referral
- [ ] Documents upload to the private bucket; `partner_documents` rows created with `review_status = 'pending'`
- [ ] No verification gate anywhere; a partner can use the app immediately after Finish
- [ ] Back navigation preserves entered data at every step; upload retry works offline→online
- [ ] Login via phone OTP works; unknown numbers are offered registration
- [ ] Every screen passes the Design Philosophy §8 checklist on a budget Android device
- [ ] All copy via i18n keys; no hardcoded strings

## 12. Resolved Decisions

These were open during drafting and are now settled (folded into the requirements above):

1. **Invalid referral code** → validate against existing codes; show "Code not found" so the partner can correct it or Skip. Never blocks Finish (B-20).
2. **Customer name** → **mandatory** at sign-up; the customer enters phone → OTP → name before landing in the app (B-9 / B-10).
3. **Partner document types** → both Delivery and Ride partners submit the same two documents: Aadhaar + driving licence (B-22).
4. **Document sources** → both camera and gallery are allowed for document capture (B-22).
5. **Resuming an abandoned partner sign-up** → resume from the last completed step, never a restart (§8).
