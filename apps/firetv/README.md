# Flyhigh.tv Fire TV App (Android TV / Fire OS Scaffold)

Android TV / Fire TV scaffold wired to the Flyhigh API for:

- Home feed (`/v1/content/home`)
- Device code sign-in (`/v1/device-auth/start`, `/poll`)
- Playback authorization (`/v1/content/:id/playback`)

## What this scaffold covers

- Compose-based TV app shell
- API client + repository layer
- Bearer token storage (for device auth)
- Device code approval polling flow
- Basic playback screen using Media3 ExoPlayer

## Configure local dev API endpoints

Edit `apps/firetv/gradle.properties`:

- `FLYHIGH_API_BASE_URL`
- `FLYHIGH_WEB_ACTIVATE_URL`

Use your computer's LAN IP (not `localhost`) when testing on a real Fire TV device.
Use `adb reverse` plus `127.0.0.1` when testing on the Android emulator.

Example:

```properties
FLYHIGH_API_BASE_URL=http://127.0.0.1:4000
FLYHIGH_WEB_ACTIVATE_URL=http://127.0.0.1:3004
```

## Open in Android Studio

1. Open `apps/firetv` in Android Studio.
2. Let Gradle sync/download dependencies.
3. Run on:
   - Fire TV device (developer mode / ADB enabled), or
   - Android TV emulator.

## Notes

- UI is intentionally basic; focus handling and TV polish come next.
- Device-code auth is aligned with the web `/activate` page already implemented.
- Playback requests go through the Flyhigh API and return Mux HLS URLs.
