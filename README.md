# Qarmo

**Qarmo** is a mobility and delivery platform built for **rural Kerala, India** — starting with auto-rickshaw rides and expanding into bike/cab booking and restaurant delivery.

What sets Qarmo apart from a typical ride-hailing app is its **bidding model**: instead of a fixed fare, a customer places a ride request with a fair base price, and nearby drivers respond in real time — accepting the base price, bidding lower, or bidding higher. The customer then picks the offer they want.

## The two sides of Qarmo

| Role | Service |
|---|---|
| **Customers** | Book rides (Phase 1: auto) — later, order food from restaurants |
| **Partners** — auto drivers & delivery executives | Fulfill rides and deliveries (one app, role chosen at onboarding) |
| **Restaurant owners** | Manage food orders (later phase) |

## This repository

This monorepo currently ships the **Partner App** — the first deliverable. In Phase 1 it works as an **acquisition and onboarding tool**: it gets drivers and delivery executives signed up, profiled, and referring each other *before* the customer app launches.

**Phase 1 features:**
- Phone OTP sign-up + a guided profile wizard (name, photo, role, vehicle, city)
- Login & session handling
- Referral system — share your code, earn points, see who you've referred
- Dashboard (with ride/delivery features shown as "Coming soon")
- Profile view & edit

Ride requests, bidding, trips, earnings, payments, and the customer/restaurant apps are built into the roadmap but out of scope for Phase 1.

## Who we build for

Our first users are **auto drivers and delivery executives in rural Kerala** — often first-generation smartphone users, on budget Android phones, in direct sunlight, on patchy 4G. Every screen is designed to be usable without anyone teaching them: one job per screen, one big button, icons over paragraphs, and a light theme tuned for outdoor readability. See [Documents/Design Philosophy.md](Documents/Design%20Philosophy.md) for the full design principles.

## Tech stack

| Layer | Choice |
|---|---|
| Mobile apps | React Native + Expo (SDK 54) |
| Monorepo | pnpm workspaces + Turborepo |
| Backend | Supabase (Auth, Postgres, Realtime, Storage, Edge Functions) |
| Auth | Phone OTP via Supabase Auth |
| Maps & GPS | Ola Maps / MapmyIndia (planned) |
| Push | Expo Push Notifications |
| Payments (Phase 1) | Cash only |

There is no custom backend server — Supabase is the backend, guarded by Row Level Security, with sensitive logic in Edge Functions.

## Repository layout

```
apps/
  partner/          # Driver & delivery-executive app (Phase 1 deliverable)
packages/
  ui/               # Shared design system + components (theme.ts)
  supabase/         # Typed Supabase client + generated DB types
  core/             # Shared business types, constants, utilities
  i18n/             # Localization (launches in English, Malayalam-ready)
supabase/
  migrations/       # Database schema
  functions/        # Edge Functions
  storage/          # Storage bucket config
Documents/          # Product, technical & design requirements
```

## Getting started

Prerequisites: **Node 20+**, **pnpm 11+**, and the [Expo](https://docs.expo.dev/) tooling.

```bash
# Install dependencies (pnpm only — enforced)
pnpm install

# Copy environment variables and fill in Supabase credentials
cp .env.example .env

# Start the partner app
pnpm --filter @qarmo/partner dev
```

Other useful commands:

```bash
pnpm dev          # Run all app dev servers (turbo)
pnpm lint         # Lint the workspace
pnpm typecheck    # Type-check the workspace
pnpm format       # Prettier across the repo
```

## Building a release APK for a physical device

This builds a self-contained release APK (JS bundle embedded, no Metro dev server needed at runtime) and installs it straight to a device connected over ADB — including over Wi-Fi debugging.

```bash
# 1. Point at the local Android SDK (one-time per shell session)
export ANDROID_HOME=/Users/adx/Develop/android
export ANDROID_SDK_ROOT=/Users/adx/Develop/android
export PATH="$ANDROID_HOME/platform-tools:$PATH"

# 2. Connect to the device (Settings → Developer options → Wireless debugging,
#    use the IP:port shown there)
adb connect <device-ip>:<port>

# 3. Build + install
cd apps/partner
npx expo run:android --variant release --no-bundler
```

Notes:
- `--variant release` produces a standalone APK — no attached dev server required, unlike the default debug variant.
- `--no-bundler` skips starting a Metro server, since release doesn't need one.
- With exactly one device connected, `expo run:android` auto-selects it — no `--device` flag needed (and its device-name matching doesn't accept a raw IP:port anyway).
- If the device drops off Wi-Fi debugging mid-session, `adb connect` will time out — re-enable Wireless debugging on the phone and retry.
- The first build after adding/removing a native dependency (e.g. the `@maplibre/maplibre-react-native` migration) needs a clean prebuild — delete `apps/partner/android` (gitignored, safe) before rerunning.

## Documentation

Detailed product and technical specs live in [Documents/](Documents/):

- [Project Requirements](Documents/Project%20Requirements.md) — business & functional overview
- [App Requirements](Documents/App%20Requirements.md) — structured app scope
- [Partner App — Phase 1 Requirements](Documents/Partner%20App%20%E2%80%94%20Phase%201%20Requirements.md) — the launch document
- [Technical Requirements](Documents/Technical%20Requirements.md) — architecture
- [Design Philosophy](Documents/Design%20Philosophy.md) — how every screen must look and feel

## License

See [LICENSE](LICENSE).
