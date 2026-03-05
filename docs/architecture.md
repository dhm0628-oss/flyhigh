# Flyhigh.tv Architecture (MVP -> OTT)

## Product objective

Replace Uscreen with a branded OTT platform for wakeboard films, starting with web and expanding to Roku and Fire TV while managing content, plans, and publishing from one admin system.

## Core principles

- One source of truth for catalog, users, entitlements, and publishing
- Device-specific apps consume the same backend APIs
- Video delivery/transcoding outsourced initially (Mux/Cloudflare Stream/AWS Media services)
- Incremental rollout with dual-run migration from Uscreen

## System overview

### 1) Control plane (your side)

- Admin web app (`apps/admin`)
- API (`apps/api`)
- Database (Postgres recommended)
- Object storage metadata references (video assets stored/transcoded by video provider)
- Background jobs (encoding webhooks, publishing jobs, email, analytics aggregation)

### 2) Playback apps (viewer side)

- Web app (`apps/web`) for browsing, subscriptions, playback, account management
- Roku channel (SceneGraph/BrightScript) consuming the same JSON APIs
- Fire TV app (Android TV / Fire OS; can be React Native TV or native Kotlin)
- Future apps (Apple TV, iOS, Android, Samsung/LG TV) reuse the same contracts/API patterns

## Recommended MVP stack

### Backend

- Fastify or NestJS (TypeScript)
- Postgres + Prisma
- Redis (sessions/cache/rate limit/job queues)
- Stripe (web subscriptions)
- Video platform: Mux (fastest path) or Cloudflare Stream

### Frontend

- Consumer web: Next.js
- Admin: Next.js
- Shared UI can come later; prioritize speed over premature abstraction

### OTT apps

- Roku: BrightScript SceneGraph app
- Fire TV: Android TV app (React Native TV if you want shared UI logic with future mobile apps, otherwise native Kotlin is simpler for TV-specific controls/performance)

## Domain model (high level)

- `ContentItem`: film, series, episode, trailer, bonus clip
- `Collection`: categories, curated rows, seasonal lists
- `Asset`: source video, poster, hero, captions, preview clips
- `PlaybackSource`: HLS/DASH URLs, DRM metadata, duration, variants
- `Plan`: monthly/yearly subscriptions
- `User`
- `Subscription`
- `Entitlement`
- `Device`

## API boundaries

### Public app API (all clients)

- Auth/session
- Catalog browsing
- Search
- Playback authorization (returns signed playback token/URL)
- Entitlements
- Account/subscription status

### Admin API

- Content CRUD
- Collection/rows management
- Publishing workflow
- Plan management
- User support tools
- Analytics summaries

## Subscription/billing strategy (important)

- Web: Stripe Billing (direct subscription)
- Roku: Roku in-channel billing / subscriptions
- Fire TV: Amazon IAP/subscriptions

Use a unified `entitlements` layer in your backend so each client app can ask one question: "Can this user watch this title?"

## Migration plan from Uscreen

1. Build backend + admin while Uscreen remains live.
2. Import catalog metadata and artwork.
3. Decide whether to migrate video files or keep temporary external playback links during transition.
4. Launch web beta on custom domain/subdomain.
5. Launch Roku + Fire TV using same APIs.
6. Migrate active subscribers (strategy depends on processor/export options and store rules).

## Risks to design for early

- Store billing differences (Roku/Amazon/web all behave differently)
- Device playback QA (remote controls, focus states, bitrate adaptation)
- DRM/caption support across devices
- Subscription state reconciliation and webhook reliability
- Analytics/event pipeline consistency across clients

