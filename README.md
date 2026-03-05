# Flyhigh.tv OTT Platform

Monorepo starter for a subscription video streaming platform (web, Roku, Fire TV, more later) with a single backend/admin control plane.

## Goals

- Consumer streaming app for `Flyhigh.tv` (web first, OTT devices next)
- Admin console for content, collections, plans, and publishing
- Shared API and domain model across all clients
- Gradual migration from Uscreen without downtime

## Proposed stack (initial)

- `apps/api`: Fastify + TypeScript (headless API for all clients)
- `apps/web`: Next.js consumer web app
- `apps/admin`: Next.js admin dashboard
- `packages/contracts`: shared TypeScript DTOs/interfaces

## Monorepo commands (after install)

```bash
pnpm install
pnpm dev
```

## Local backend setup (Phase 1 foundation)

1. Copy `.env.example` to `.env` and set `DATABASE_URL` + `JWT_SECRET`.
2. Start PostgreSQL.
3. Generate Prisma client and run migrations.

```bash
pnpm --filter @flyhigh/api prisma:generate
pnpm --filter @flyhigh/api prisma:migrate:dev -- --name init
pnpm --filter @flyhigh/api prisma:seed
```

If you change the Prisma schema while the API server is running on Windows, stop the API first (`Ctrl+C`) before `prisma generate` / `migrate` to avoid Prisma DLL file-lock errors.

4. Start apps:

```bash
pnpm --filter @flyhigh/api dev
pnpm --filter @flyhigh/web dev
pnpm --filter @flyhigh/admin dev
```

Seeded admin account (dev only): `admin@flyhigh.tv` / `change-me-123`

## Billing Mode (safe placeholder)

The web app supports a placeholder billing UX using:

- `NEXT_PUBLIC_BILLING_MODE=placeholder`

This lets you build signup/account/pricing flows without enabling real Stripe checkout or touching your current Uscreen billing.

## Device Auth (Roku / Fire TV pattern)

The API now includes a device-code flow for TV apps:

- TV app requests a code: `POST /v1/device-auth/start`
- TV app polls for approval: `POST /v1/device-auth/poll`
- User approves on web: `POST /v1/device-auth/activate`

Web activation page:

- `/activate`

## Mux Video Uploads (current integration)

The admin app can now request a Mux direct upload URL and upload a video file from the browser.

### Required server env vars

- `MUX_TOKEN_ID`
- `MUX_TOKEN_SECRET`
- `MUX_WEBHOOK_SECRET` (placeholder is okay until webhook is created)

### Mux webhook (needed for processing -> ready sync)

Create a Mux webhook pointing to:

- Local dev (with tunnel): `https://<your-tunnel-domain>/v1/webhooks/mux`

Suggested events:

- `video.upload.asset_created`
- `video.asset.ready`
- `video.asset.errored`

Note: webhook signature verification is not fully enforced yet in code (header presence check only). We should add raw-body signature verification next.

## Current status

This repository now includes a Prisma/Postgres-backed API foundation with auth, subscriptions/plans, content CRUD, and collection-row management endpoints for the OTT control plane.
