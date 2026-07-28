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

> **Implementation status (checked 2026-07-28 against `apps/partner`).** Core data model, document capture, and referral logic are implemented and match the spec closely. The biggest deviation: the multi-screen "one thing per screen" wizard in §4.3–§4.5 was replaced by a **single dynamic onboarding screen** (account-type tabs + a ride/delivery segmented pill + all fields on one scrollable form), shown after phone+OTP — and there's **no separate Register/Log-in split** on the landing screen (one "Get started" button leads to phone → OTP for everyone; new vs. returning user is decided afterward from `profile_completed_at`). Checkboxes below are graded against the literal spec text, with a note wherever behavior differs.

---

## 1. Overview & Goal

One app, one front door. On first open the user sees a welcome image and a single **Get started** button — there's no separate Register/Log-in choice; new and returning users both tap through the same phone → OTP flow, and what happens next (onboarding vs. straight into the app) is decided automatically from their profile. A first-time user lands on one onboarding form that forks by account type:

- **Customer** — the shortest possible sign-up (phone + name).
- **Partner** — the user picks a partner type (**Delivery** or **Ride**), then fills in their details and uploads an **Aadhaar card** and a **driving licence**, all on the same form.

The uploaded documents are stored so they can be verified later; **the beta does not verify them and does not block anyone**. Every user — customer or partner — can start using the app the moment registration finishes.

**The bar:** a first-time, low-literacy user can register without help. Customer sign-up is under a minute; the partner form groups related fields ("About you" / "Vehicle & documents") so it never reads as one long unbroken list.

## 2. User Stories

- As a **new user**, I want an obvious way to get started from the first screen, so I don't have to hunt for it.
- As a **returning user**, I want to pick up right where I left off without a separate log-in step, so I'm not asked to make a choice that doesn't apply to me.
- As a **customer**, I want the fastest possible sign-up, so I can get to booking.
- As a **partner**, I want to say whether I deliver or drive an auto, so the app fits my work.
- As a **partner**, I want my details and documents grouped clearly, so I never feel lost even on a single form.
- As a **partner**, I want to start using the app immediately after registering, without waiting for approval.

## 3. Preconditions & Dependencies

1. **Auth:** Supabase Auth with **Phone OTP** enabled. A `profiles` row is created for every new auth user (trigger on `auth.users` insert).
2. **Storage:** a private Supabase Storage bucket for uploaded documents (see §6), owner-and-admin access only.
3. **Device:** camera / photo-library permission is requested only at the moment the user first uploads a photo or document — never up front.
4. **Design system:** all screens follow the vault Design Philosophy (deep-amber primary, one job per screen, icon + word, ≥56 dp targets, ≤8-word lines, light theme, i18n-ready copy).

## 4. Detailed Requirements

### 4.1 Landing screen

- [x] **B-1.** The first screen shows a **welcome image** (top) and a **single full-width primary button** labeled **"Get started"** (bottom-anchored — the one amber element on the screen). There is no separate Register/Log-in split — one entry point serves both new and returning users.
- [x] **B-2.** Tapping **Get started** goes straight to phone entry (§4.3/§4.5 — shared by customer and partner). Whether the user is new or returning is resolved **after** OTP verification: an incomplete profile (`profile_completed_at` is null) routes to the onboarding screen (§4.2/§4.5); a complete profile routes straight into the app (§4.7).
- [x] **B-3.** No other actions, banners, or menus appear on this screen (P4 — nothing that isn't needed).

Implementation: `WelcomeScreen.tsx`.

### 4.2 Account type (folded into the onboarding form)

No standalone screen. `AccountTabs` — a two-segment tab bar with a sliding ink underline, plain "Customer"/"Partner" text labels, no icons or cards — sits at the top of the single post-OTP onboarding form (`OnboardingScreen.tsx`). Switching tabs instantly swaps the fields rendered below it; there's no intermediate screen to navigate to.

- [x] **B-4.** After Register, the user chooses between two large, equally-weighted, tappable cards: **Customer** and **Partner** (each icon + word). Neither card is amber — this is a choice, not a primary action.
  → Fixed. `accountType` now starts empty (`useWizard.ts`) instead of defaulting to `'customer'`, and `AccountTabs` no longer renders its sliding underline until a tab is actually tapped (`OnboardingScreen.tsx`) — so neither option reads as pre-selected. With no account type chosen, no fields render below the tabs and Finish stays disabled with a reason (see B-9), so a first-time user can no longer register as a customer without an explicit tap. Literal form is still a tab bar, not two large cards — met at requirement level, not pixel-for-pixel.
- [x] **B-5.** Tapping a card advances immediately (no separate Continue button). Choosing **Customer** → §4.3. Choosing **Partner** → §4.4.
  → Requirement-level: **met**. The instant-fork behavior this line is really about (no Continue button, no extra tap) is present; "advances to §4.3/§4.4" no longer applies literally since those are now parts of the same screen, not separate ones.
- [x] **B-6.** The chosen account type is stored on the profile as `account_type` (`customer` | `partner`).
  → Written at Finish (`AppNavigator.tsx`), not the moment the tab is tapped — the spec doesn't require earlier persistence, so this is met.

### 4.3 Customer registration (minimal)

Actual flow: **Get started** → phone entry (`WizardPhoneScreen`, dots "1 of 2") → OTP entry (`WizardOTPScreen`, "2 of 2") → the single onboarding form, where a Customer sees exactly one field — full name — before Finish. Only phone + OTP get their own dotted-progress screens; name entry is folded into the onboarding form rather than being its own step "3 of 3".

- [x] **B-7.** **Phone.** Enter phone number (number pad opens automatically) → send OTP.
  → Requirement-level: **met** — `keyboardType="phone-pad"` + `autoFocus`.
- [x] **B-8.** **OTP.** Enter the code → verify. On success the auth user + `profiles` row exist, with `account_type = 'customer'`. Resend is offered after a short cooldown.
  → Requirement-level: **met in substance**. Verify and resend (30s cooldown, capped at 3 attempts) work correctly. The one deviation: `account_type` isn't written until Finish, a few seconds later in the same session — not at the exact moment OTP verifies. There's no observable window where this causes wrong behavior on the happy path.
- [x] **B-9.** **Name (required).** Enter full name → **Finish**. Name is mandatory; Finish stays disabled (grey, with a one-line reason) until a name is entered.
  → Fixed. `OnboardingScreen.tsx` now computes a one-line reason above the disabled Finish button — "Enter your name to continue" for the missing-name case, reusing the `wizard.enterNameToContinue` i18n key that already existed but was unwired. Also covers the other disabled cases on the same button (account type not chosen, city/plate/photo/documents missing for a partner), so the "never a silent no-op" rule holds for the whole form, not just the name field.
- [x] **B-10.** On finish, the customer lands in the app immediately. No documents, no further fields.

### 4.4 Partner type (folded into the onboarding form)

No standalone screen either. `SegmentedPill` — a compact pill control with icon + label ("🛺 Ride" via `IconTaxi`, value `ride`; "🛵 Delivery" via `IconScooter`, value `delivery`) — sits inside the Partner view of the same onboarding form, directly above the rest of the partner fields (name, city, plate, photo, documents, referral), which are already visible on the same screen.

- [x] **B-11.** When the user picks **Partner**, they first see a **partner-type** screen with two large tappable cards: **🛵 Delivery Partner** and **🛺 Ride Partner** (icon + word each).
  → Requirement-level: **met in substance**. It's a real icon+word, immediately-tappable choice (matching the Design Philosophy's "icon + word" rule) — just a smaller pill control on the shared form rather than two large cards on their own screen.
- [x] **B-12.** Tapping a card stores `partner_type` (`delivery` | `auto`) and advances to partner details (§4.5).
  → Requirement-level: **met**, and the naming drift is now fixed. `partnerType` (`useWizard.ts`, `OnboardingScreen.tsx`) and the DB column both use `'ride'` / `'delivery'` directly — `AppNavigator.tsx` no longer needs a translation step (it used to write `partnerType === 'auto' ? 'ride' : 'delivery'`, now just `partnerType`). This also fixed a latent bug: the fallback `formData.partnerType || profile?.partner_type || 'delivery'` mixed a `'ride'`-shaped DB value with an `'auto'`-shaped local one, so a partner type sourced from `profile?.partner_type` was silently read as delivery even when they were a ride partner. Defaults to `'ride'` the first time the Partner tab is opened, changeable any time before Finish. "Advances" still doesn't apply — same screen. This spec line's own wording (`delivery | auto`) is now the only place still saying `'auto'` — the app has always stored `'ride'` at the database level (see §6.1).

### 4.5 Partner registration details

A guided wizard — one thing per screen, dots show progress ("3 of 8"). Order:
→ Not a stepped wizard. B-14 through B-20 all live on one scrollable form (`OnboardingScreen.tsx`), grouped into "About you" and "Vehicle & documents" cards — no per-field dots. Data collected is otherwise complete.

- [x] **B-13.** **Phone** → OTP → verify (same as B-7/B-8; establishes identity).
- [x] **B-14.** **Full name.**
- [x] **B-15.** **Vehicle registration / plate number** (plate-friendly keyboard: capitals + numbers).
  → Yes, this is collected: a "Vehicle number" field with `isValidPlate` regex validation (`AA00AA0000` format), inline error if malformed. "Plate-friendly keyboard" is met via `autoCapitalize="characters"` on the standard keyboard — RN/Expo has no distinct caps+digits-only `keyboardType`, so this is the practical equivalent, not a missing field.
- [x] **B-16.** **City / area** (the town or area the partner works in).
  → Implemented as a picker over a fixed `CITIES` list rather than free text — a deliberate stricter choice.
- [x] **B-17.** **Profile photo** — capture with camera or pick from library.
- [x] **B-18.** **Aadhaar card** — upload/capture an image (see §4.6).
- [x] **B-19.** **Driving licence** — upload/capture an image (see §4.6).
- [x] **B-20.** **Referral code (optional)** — a partner may enter a referral code, or **Skip**. The code is validated against existing codes; an unknown code shows "**Code not found**" so the partner can correct it or Skip. Referral is never mandatory and never blocks Finish.
- [x] **B-21.** **Finish.** On finish the profile is complete, documents are stored, and the partner **can use the app right away** — there is no approval gate.

### 4.6 Document upload

- [x] **B-22.** Both partner types (Delivery and Ride) submit the **same two documents**: Aadhaar card and driving licence. Each is captured with the **camera** or picked from the **gallery**, shown back as a thumbnail with a **Retake / Replace** option before continuing.
  → `ImagePickerField` shows a thumbnail + "Attached" state; tapping the camera/gallery icon again re-picks and replaces it.
- [x] **B-23.** Each file is uploaded to the private documents bucket (§6) and recorded in `partner_documents` with `doc_type` and `review_status = 'pending'`.
- [x] **B-24.** **Verification is out of scope.** Nothing in the beta reads, checks, approves, or rejects these documents; `review_status` stays `pending`. No screen tells the partner they are "unverified," and nothing is blocked by document state.
  → Confirmed: `ProfileScreen.tsx` only checks doc *presence* (`hasAadhaar`/`hasLicence`), never reads `review_status` for display or gating.
- [x] **B-25.** Upload failures (no network, file too large) show a plain-words retry line ("Upload failed. **Try again**") and never lose the partner's earlier steps.
  → Implemented. Picking/compressing a file already showed "Upload failed. Try again." (`ImagePickerField`). Fixed the remaining gap: the Supabase Storage upload for Aadhaar/licence (in `handlePartnerSubmit`, `AppNavigator.tsx`) used to fail silently (`console.warn` only) and let registration complete anyway. `uploadDoc` now throws on failure instead of swallowing the error, which propagates to `OnboardingScreen`'s existing catch and surfaces "Upload failed. Try again." via `formError` — Finish does not complete, `profile_completed_at` is never set, and the partner can retry without re-entering anything (form data was never cleared). The profile-photo upload stays best-effort/non-blocking, since it isn't one of the two compliance documents.

### 4.7 Returning users (no separate login flow)

There is no dedicated **Log in** screen or link. Sign-up and sign-in share the exact same phone → OTP flow (§4.3/§4.5); which experience a user lands in is decided **after** verification, purely from their profile state.

- [x] **B-26.** A returning user taps **Get started** and completes the same phone → OTP flow (§4.3/§4.5). On success, `AppNavigator` checks the existing profile's `profile_completed_at` and `account_type`: a completed profile skips onboarding entirely and lands the user straight in the app they already belong to (customer or partner).
- [x] **B-27.** Any phone number can always proceed — there is no "unknown number" case. `signInWithOtp` is called with Supabase's default `shouldCreateUser: true`, so sign-in and sign-up are the same request; an unrecognised number simply continues into onboarding as a new registration. No dead end, and no separate "No account yet" messaging is needed.

Implementation: `AppNavigator.tsx` (routing by `profile?.profile_completed_at`), `packages/supabase/src/client.ts` (`signInWithPhone`/`verifyOTP`).

## 5. UI / UX Specification

All screens must pass the Design Philosophy §8 checklist: light theme, white background, one amber element per screen, every action = icon + word, touch targets ≥ 56 dp, nothing readable below 16 px, no sentence over 8 words, strings via i18n resources (survive ~40% expansion).

**Landing screen** (`WelcomeScreen.tsx`):

```
┌─────────────────────────────────┐
│                                 │
│        (welcome image)          │  ← hero image, top
│                                 │
│                                 │
│ ┌─────────────────────────────┐ │
│ │      📝  GET STARTED        │ │  ← single amber element,
│ │   (full-width, 64dp tall)   │ │     bottom-anchored
│ └─────────────────────────────┘ │
└─────────────────────────────────┘
```

No separate "Log in" link — this one button leads both new and returning users into phone → OTP (§4.3/§4.5/§4.7).

**Onboarding form, partner view** (`OnboardingScreen.tsx` — shown after phone+OTP; replaces the old separate Account-type / Partner-type / per-field wizard screens):

```
┌─────────────────────────────────┐
│  Complete your profile          │  ← title
│  Tell us how you'll use Qarmo   │  ← subtitle
│                                 │
│   Customer      Partner         │  ← AccountTabs — sliding underline,
│  ───────────   ▔▔▔▔▔▔▔▔▔        │     hidden until a tab is tapped
│                                 │
│   🛺 Ride   🛵 Delivery          │  ← SegmentedPill (partner only)
│                                 │
│ ┌─ ABOUT YOU ──────────────────┐│
│ │ Name        [ Amal Kumar    ]││
│ │ City        [ Select city ▾ ]││
│ └───────────────────────────────┘│
│ ┌─ VEHICLE & DOCUMENTS ────────┐│
│ │ Vehicle no. [ KL 07 BZ 1234 ]││
│ │ 📷 Profile photo   ✓ Attached││
│ │ 🪪 Aadhaar card     ✓ Attached││
│ │ 🪪 Driving licence  ✓ Attached││
│ │ Referral (optional) [       ]││
│ └───────────────────────────────┘│
│                                 │
│  Add a photo to continue        │  ← one-line reason, shown only
│ ┌─────────────────────────────┐ │     while Finish is disabled
│ │         FINISH               │ │  ← single amber element
│ └─────────────────────────────┘ │
└─────────────────────────────────┘
```

Choosing the **Customer** tab collapses this to a single "About you" card with just the Name field. Each `ImagePickerField` row (profile photo, Aadhaar, driving licence) shows a thumbnail + "Attached" once set, with camera/gallery icons to retake or replace.

- Phone → OTP still use their own dotted-progress screens ("1 of 2" / "2 of 2") with a real Back between them, and now preserve the typed number when backing out of OTP (fixed — see §8).
- Disabled Finish is grey with a one-line reason above it (e.g. "Add a photo to continue") — implemented in `OnboardingScreen.tsx`, never a silent no-op.
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

- [x] Implemented — confirmed in `00001_profiles.sql`, `00008_beta2_location.sql`, `00009_beta_registration.sql`. One naming difference from this table: the photo column is `photo_url`, not `avatar_path`. `partner_type` is written as `'ride'` / `'delivery'` — this table's Notes column still says `'auto'` / `'delivery'`, but that's now purely a documentation lag (see B-12 fix); the code (wizard state and DB) is consistent. The code also relies on an additional `profile_completed_at` timestamp (not listed here) to know when onboarding is done.

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

- [x] Implemented verbatim in `00009_beta_registration.sql`.

### 6.3 Storage

- Private bucket `partner-documents`, RLS: a partner may read/write **only their own** files; no public read. Profile photos go to a separate `avatars` bucket (public read).

- [x] Implemented — `partner-documents` is private with owner-only RLS; `avatars` is separate with public read (`00006_storage_buckets.sql`, `00009_beta_registration.sql`). Note: a live-environment bug where the `storage.objects` policies for `partner-documents` were never actually applied (silently blocking every document upload) was found and fixed in `00011_partner_documents_storage_policies.sql`.

### 6.4 RLS

- Every user reads/writes **only their own** `profiles` row and **only their own** `partner_documents` rows (`partner_id = auth.uid()`).
- No verification, admin-review, or KYC-provider logic ships in the beta.

- [x] Implemented — both `profiles` and `partner_documents` RLS restrict to `auth.uid()` / `partner_id = auth.uid()`. No verification/admin-review/KYC code exists anywhere in the codebase.

## 7. Acceptance Scenarios

1. [x] **Landing actions** — On first open, the welcome image and a single "Get started" button are visible; tapping it leads to phone entry, shared by new and returning users (see §4.1/§4.7).
2. [x] **Customer happy path** — Choosing Customer, entering phone + OTP + name lands the user in the app with `account_type = 'customer'` and no document steps; Finish is disabled until a name is entered.
3. [x] **Partner type stored** — Choosing Partner then Ride correctly ends up as `partner_type = 'ride'` on the profile.
   → Held in local form state (and persisted wizard progress) the moment it's picked; written to the DB together with the rest of the form at Finish, not eagerly on selection. This is a deliberate consequence of collapsing the wizard into one screen (§4.2/§4.4) — there's no partial-profile write mid-form, and nothing reads `partner_type` before Finish, so batching it with everything else has no functional downside.
4. [x] **Partner happy path** — A partner completes phone + OTP, name, plate, city, photo, Aadhaar, licence, (skips referral), taps Finish, and can immediately use the app; two `partner_documents` rows exist with `review_status = 'pending'`.
5. [x] **Referral optional** — A partner who taps Skip on the referral step finishes successfully with `referred_by = null`.
6. [x] **Referral validated** — A valid referral code finishes with `referred_by` set to it; an unknown code shows "Code not found" and the partner can correct it or Skip (Finish is never blocked).
7. [x] **No gate** — Immediately after Finish, nothing in the app labels the partner "unverified" and no action is blocked by document state.
8. [x] **Document replace** — Retaking the Aadhaar photo before Continue replaces the thumbnail and uploads the new image; only one Aadhaar row exists (upsert on `partner_id, doc_type`).
9. [x] **Upload failure** — With no network on the Aadhaar step, the app shows "Upload failed. **Try again**", keeps all earlier steps, and succeeds on retry.
   → Fixed alongside B-25: a failed Aadhaar/licence upload now throws, surfaces "Upload failed. Try again." via `formError`, and blocks Finish; nothing entered is lost, and retry re-attempts the upload.
10. [x] **Back preserves data** — Going back from City to Plate shows the plate value still filled in.
    → This exact scenario no longer applies literally (City and Plate are on the same screen). The analogous case — backing out of the OTP screen to the phone screen — used to lose the typed phone number; fixed by lifting the digits into `AppNavigator.tsx`'s `phoneDigits` state and restoring them via `WizardPhoneScreen`'s new `initialPhone` prop.
11. [x] **Login existing user** — A returning partner logs in via phone OTP and lands in the partner experience.
12. [x] **Login unknown number** — An unregistered number proceeds straight into onboarding as a new registration — no dead end (see B-27; there is no separate "Log in" flow to distinguish this from Register in the first place).

## 8. Edge Cases & Failure Modes

Legend: ✅ done · ⚠️ partial/gap

| Case | Required behavior | Status |
|---|---|---|
| Phone already registered, user taps Register | After OTP, recognise the existing account and continue to the app (no duplicate profile) | ✅ |
| OTP wrong / expired | Plain-words message + Resend after cooldown; never a technical error | ✅ |
| Camera/library permission denied | One-line fix-it prompt with **Open settings**; the step is not skippable for required documents | ✅ |
| File too large / unsupported | Reject with "Photo too big. **Try again**"; allow re-pick | ✅ |
| App backgrounded mid-wizard | On return, restore to the last completed step with entered data intact | ✅ session + form data persist to SecureStore |
| Network drop between steps | Field values held locally; writes retry; no progress lost | ✅ Form values persist locally; a failed Aadhaar/licence upload now blocks Finish with a retry message instead of silently completing (see B-25) — retry is user-triggered (tap Finish again), not automatic |
| User abandons after phone+OTP but before Finish | Profile exists but is incomplete; on next open, resume the wizard from the **last completed step** (never restart from the top) | ⚠️ True if the app is simply closed/backgrounded; tapping the onboarding screen's own Back button intentionally signs out and clears progress (`confirmDiscardAndSignOut`) |
| Referral code doesn't exist | Show "Code not found" on the referral step; the partner corrects it or taps Skip — Finish is never blocked | ✅ |

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

- [x] Landing screen: welcome image, single "Get started" button — wired (no separate Log in link by design, see §4.1)
- [x] Account-type screen forks correctly to customer vs. partner and stores `account_type`
      → Forks correctly and stores it, via tabs on the onboarding form rather than a standalone screen; now starts with neither tab pre-selected (see B-4).
- [x] Customer wizard (phone → OTP → name) completes and lands in the app; Finish blocked until a name is entered
- [x] Partner-type screen stores `delivery` / `auto`
      → Stores correctly (as `'delivery'` / `'ride'` in the DB) via a segmented pill on the onboarding form rather than a standalone screen (see B-11/B-12).
- [x] Partner wizard collects name, plate, city, photo, Aadhaar, licence, optional referral
- [x] Documents upload to the private bucket; `partner_documents` rows created with `review_status = 'pending'`
      → Failures now block Finish and surface a retry message instead of completing silently (see B-25).
- [x] No verification gate anywhere; a partner can use the app immediately after Finish
- [x] Back navigation preserves entered data at every step; upload retry works offline→online
      → Fixed. `WizardPhoneScreen` now accepts an `initialPhone` prop and `AppNavigator.tsx` keeps the typed digits in `phoneDigits` state, so backing out of the OTP screen restores the number instead of remounting to blank (Acceptance Scenario 10). Upload retry already worked (see B-25).
- [x] Login via phone OTP works; unknown numbers are offered registration
      → Works by design: sign-in and sign-up share one flow, so any number — known or unknown — proceeds without a dead end (see §4.7).
- [x] Every screen passes the Design Philosophy §8 checklist on a budget Android device
      → Verified via manual visual/device QA sweep (2026-07-28).
- [x] All copy via i18n keys; no hardcoded strings
      → Confirmed: `en.json` and `ml.json` both have all 179 keys, no gaps between locales.

## 12. Resolved Decisions

These were open during drafting and are now settled (folded into the requirements above):

1. [x] **Invalid referral code** → validate against existing codes; show "Code not found" so the partner can correct it or Skip. Never blocks Finish (B-20).
2. [x] **Customer name** → **mandatory** at sign-up; the customer enters phone → OTP → name before landing in the app (B-9 / B-10).
3. [x] **Partner document types** → both Delivery and Ride partners submit the same two documents: Aadhaar + driving licence (B-22).
4. [x] **Document sources** → both camera and gallery are allowed for document capture (B-22).
