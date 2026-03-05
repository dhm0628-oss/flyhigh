# TV Release Checklist (Roku + Fire TV)

## 1. Environment
- Set API base URL to production HTTPS domain.
- Set web activate URL to production web domain (`/activate` route live).
- Confirm CORS includes Roku/Fire client origins if needed.

## 2. Auth and Entitlement
- Device code flow test:
- Start code on TV.
- Approve on web.
- Poll returns `approved` with access token.
- Premium playback blocked when signed out (`requires_subscription`).
- Premium playback allowed for active/trialing subscribers.

## 3. Home/Browse UX
- Home feed loads rows and featured banner items.
- Empty/error state shows retry path.
- My List row appears for signed-in users.
- Continue Watching row appears when progress exists.

## 4. Playback
- Free title playback succeeds.
- Premium title playback succeeds for entitled users.
- Resume playback starts near saved position.
- Restart playback starts at beginning.
- Playback error shows retry action.

## 5. Observability
- `/health/live` and `/health/ready` return healthy in production.
- API request/error logs visible in hosting platform.
- Alert webhook triggers on 5xx server errors.

## 6. Roku Package
- Update `apps/roku/source/Config.brs` for production endpoints.
- Build zip from contents of `apps/roku` (not parent folder).
- Sideload smoke test on physical Roku.
- Validate metadata/assets in `apps/roku/manifest`.
- Submit in Roku Developer Dashboard.

## 7. Fire TV Package
- Update `apps/firetv/gradle.properties` production endpoints.
- Build release AAB/APK from Android Studio/Gradle.
- Test on physical Fire TV + one Android TV emulator.
- Verify banner/icon and Leanback launcher behavior.
- Submit in Amazon Appstore Console.

## 8. Pre-Launch Smoke
- Create new subscriber account on production.
- Subscribe via Stripe live mode.
- Sign in on web + TV with same account.
- Play at least one premium and one free title on each platform.
- Send one test push campaign and confirm delivery.
