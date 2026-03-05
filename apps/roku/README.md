# Flyhigh.tv Roku App (MVP Scaffold)

SceneGraph Roku channel scaffold wired to the Flyhigh API for:

- Home feed (`/v1/content/home`)
- My List (`/v1/viewer/my-list`) once TV is signed in
- Device code sign-in (`/v1/device-auth/start`, `/poll`)
- Playback authorization (`/v1/content/:id/playback`)

## What works (scaffold level)

- Loads rows from your API
- Loads a `My List` row after TV sign-in
- Shows a detail panel for selected content
- Press `OK` to request playback
- If premium content requires auth, press `*` (Options) to start TV device sign-in
- Displays a device code and activation URL (`/activate`)
- Polls for approval and stores a device bearer token locally on Roku

## Configure for local dev

Edit `source/Config.brs`:

- `apiBaseUrl` -> your computer's LAN IP + API port (NOT `localhost`)
- `webActivateBaseUrl` -> your computer's LAN IP + web app port (e.g. `3002`)

Example:

```brightscript
apiBaseUrl: "http://192.168.1.160:4000"
webActivateBaseUrl: "http://192.168.1.160:3002"
```

Roku devices cannot use your PC's `localhost`.

## Sideloading (dev)

1. Enable Developer Mode on Roku (follow Roku dev instructions on device).
2. Zip the contents of `apps/roku` (zip the files/folders inside, not the parent folder itself).
3. In a browser, go to your Roku dev installer page:
   - `http://<roku-ip-address>`
4. Upload the zip and install.

## Controls (current)

- `OK`: attempt playback for selected item
- `Play/Pause`: add/remove selected item from `My List`
- `*` (Options): start TV sign-in flow
- `Back`: close auth panel / stop video

## Notes

- Video playback uses standard HLS URLs returned by your Flyhigh API (Mux-backed).
- UI is intentionally minimal to prove end-to-end API/device auth/playback flow first.
- Next step is a proper Roku UX (hero rows, poster art, detail screen, loading/error states, and resume/watch history).
