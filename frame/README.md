# Frame app

The `/frame/` entry is a phone-oriented PWA built with the existing Vite and vanilla
JavaScript stack. Install it from Android Chrome, connect to the frame’s local
address, choose a photo, adjust fit and saturation, and send it to the display.
It requires the app API update from the Inky Soup project.

## Data flow

- Bluetooth WiFi setup remains at `/setup/`. The app opens `/setup/?return=frame`;
  successful provisioning returns a validated local device address in the URL hash.
- The phone reads the display model/dimensions and gallery directly from the Pi.
- A Web Worker resizes, generates a thumbnail, and dithers using the display’s
  native palette. The 13.3-inch 2025 panel uses six colors at 1600 × 1200;
  the 5.7-inch panel uses seven colors at 600 × 448.
- The client saves the original and derived PNGs to the Pi, uses its image locks,
  submits one display job, and polls that job until success or failure. Lost
  connectivity never causes an automatic second flash submission.
- IndexedDB retains the current photo draft and settings on the phone. LocalStorage
  remembers the frame configuration and an active job. Storage is optional, but
  recovery cannot survive a reload when browser storage is disabled.

Photos never go to the hosted site. It serves app assets only; photo/API requests
use the local frame’s HTTP origin and need Chrome’s local-network permission.
The frame API permits the exact hosted origin and has no local-client authentication.
The current browser baseline is Android Chrome; other browser/platform combinations
are not validated for the hosted HTTPS-to-local-HTTP connection.

## Offline and updates

`tools/frame-pwa.js` generates a content-versioned service worker from the built
entry and its dependencies. It caches only the frame app shell, icons, and worker
libraries. It never intercepts cross-origin photo or API traffic. After one online
load, a remembered configuration and saved draft can be opened and edited offline.
Gallery loading and sending still require the frame. Bluetooth setup is online.

New service workers wait until the existing app windows close, so a worker update
does not take over an in-progress editing session. Reopen the app after a website
update to use the new version.

The image libraries in `public/frame/vendor/` are pinned copies of Inky Soup’s
existing worker code. `source.json` records the source commit, paths, and SHA-256
hashes. To update them, copy both files from a tested Inky Soup commit, update the
source metadata, and rerun unit, browser, and physical display validation. Preserve
the included license. The unit suite checks the recorded hashes.

## Development and validation

```bash
npm ci
npm run dev
npm run test:unit
npm test
npm run test:pwa
```

`test:pwa` builds the production site and tests service-worker installability,
offline reload, draft recovery, and exclusion of device requests from app caches.
Development Vite deliberately does not register the service worker. For a real Pi,
add the exact local preview origin to its `INKY_SOUP_CLIENT_ORIGINS` environment
variable and restart the server. Remove development origins after testing.

On 2026-10-24 (Pacific), a Pixel 9 Pro XL running Android 17 / Chrome 156 processed
a 1600 × 1200 six-color chart, uploaded it over WiFi to the original Pi Zero W,
and observed a completed physical display job. The Rust CLI independently watched
that same job. No API responses were mocked. Unpublished static assets were
fulfilled from the local production preview through CDP at `https://allan.pizza`;
this was not a test of the public deployment or an installed production WebAPK.
The recorded viewport was 448 CSS pixels wide with no horizontal overflow and no
page errors. See [results](../docs/validation/frame-pixel9.json) and the screenshot.

![Pixel editor after a successful refresh](../docs/screenshots/frame-pixel9-editor.png)

After publication, verify installation from the real HTTPS URL, launching from
Android’s home screen, and an offline launch of the saved draft. Automated Chromium
installability/offline checks do not replace that release check. Android installed
the localhost preview as a WebAPK, but launching it produced a blank page in this
ADB/CDP test setup. Standalone launch is therefore not yet validated; do not treat
the install prompt or package creation as a passing launch test.
