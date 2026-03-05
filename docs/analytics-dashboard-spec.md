# FlyHigh TV Analytics Dashboard Spec

## Goal
Track funnel health from visitor to active subscriber, plus playback engagement and churn.

## Dashboard 1: Acquisition + Conversion
- `Homepage visits` (daily)
- `Subscribe page visits` (daily)
- `Checkout session starts` (daily)
- `Checkout completions` (daily)
- `Trial starts` (daily)
- `Trial -> Paid conversion rate` (rolling 7 and 30 day)

## Dashboard 2: Subscriber Health
- `Active subscribers`
- `Trialing subscribers`
- `Past due subscribers`
- `Estimated MRR`
- `Cancellation count` (daily/weekly)
- `Resume count` (daily/weekly)

## Dashboard 3: Playback Quality + Engagement
- `Playback authorization success rate`
- `Playback unavailable events` (alerted)
- `Top watched titles by watch hours`
- `Average progress % per title`
- `Completion rate per title`
- `Continue watching population`

## Dashboard 4: Funnel Diagnostics
- `Device auth start -> approve -> consume` conversion
- `Gift card checkout -> issued -> redeemed` conversion
- `Contact + sponsorship submission volume`
- `Rate-limit rejection counts by endpoint`

## Data Sources
- API admin analytics endpoints (`/v1/admin/analytics*`)
- Webhook logs (`/v1/admin/webhooks`)
- Stripe events (`checkout.session.completed`, `invoice.payment_failed`)
- Hero analytics (`/v1/analytics/hero-events`)

## Minimum Alert Thresholds
- Playback unavailable > 2% of playback requests (5-minute window)
- Stripe payment failures > baseline + 3 sigma
- Device auth approvals drop > 40% day-over-day
- API 5xx > 1% for 5 minutes

