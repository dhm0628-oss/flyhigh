# FlyHigh TV Incident Runbook

## Severity
- `SEV-1`: Core streaming or auth unavailable for most users
- `SEV-2`: Major feature degraded (billing, playback for subset, device login issues)
- `SEV-3`: Minor degradation with workaround

## First 10 Minutes
1. Confirm incident scope (`web`, `api`, `stripe`, `mux`, `firetv`, `roku`).
2. Check API health:
   - `GET /health/live`
   - `GET /health/ready`
3. Check latest webhook/admin logs:
   - `/v1/admin/webhooks`
   - `/v1/admin/readiness`
4. Freeze deploys until impact is understood.
5. Open incident channel and assign:
   - Incident commander
   - Communications owner
   - Fix owner

## Common Incidents

### Auth failures
1. Verify `JWT_SECRET` and cookie domain settings.
2. Confirm DB connectivity in `/health/ready`.
3. Check rate-limit headers and blocked requests.
4. Roll back most recent auth-related deploy if needed.

### Playback unavailable
1. Confirm `/v1/content/:id/playback` response and request ID.
2. Check Mux asset status and `muxPlaybackId`.
3. Inspect alerts with `kind=playback_failure`.
4. Hotfix missing `playbackUrl` or Mux mapping for affected titles.

### Billing failures
1. Validate Stripe webhook health and signing secret.
2. Inspect `invoice.payment_failed` and `checkout.session.completed` logs.
3. Verify subscription records for affected user IDs.
4. Trigger manual finalize flow when checkout succeeded but local state lags.

## Communications Template
- `Status`: Investigating / Identified / Monitoring / Resolved
- `Impact`: Who is affected and what fails
- `Start Time (UTC)`
- `Current Mitigation`
- `Next Update ETA`

## Recovery + Follow-up
1. Confirm recovery with:
   - New checkout
   - Device auth
   - Playback start
2. Unfreeze deploys.
3. Create postmortem within 24 hours:
   - Root cause
   - Detection gap
   - Corrective actions

