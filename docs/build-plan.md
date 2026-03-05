# Flyhigh.tv Build Plan

## Phase 0: Foundation (1-2 weeks)

- Finalize stack decisions (video provider, backend framework, auth, billing providers)
- Set up monorepo, environments, CI, staging
- Define data model and API contracts

## Phase 1: Core backend + admin (2-4 weeks)

- Auth (email/password + magic link optional)
- Content library CRUD
- Collections/home rows management
- Plans and entitlements domain
- Video ingest metadata + webhook handling
- Basic analytics events ingestion

## Phase 2: Consumer web MVP (2-4 weeks)

- Home/catalog/detail pages
- Auth/account pages
- Subscription checkout (Stripe)
- Video playback page
- Search and watchlist (optional for MVP)

## Phase 3: OTT apps (4-8+ weeks)

- Roku app (browse + playback + sign in + subscription status)
- Fire TV app (same capability set)
- Device auth flow (code-based sign-in) if needed

## Phase 4: Migration and scale hardening

- Dual-run testing with real catalog
- Billing reconciliation
- CDN/performance tuning
- Observability, alerts, support tooling

## What we can build next in this repo

- Prisma schema + migrations
- Real API endpoints with auth and Postgres
- Admin content editor UI
- Web playback UX matching Uscreen-style browsing

