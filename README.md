This is a small art piece application.  It implements a 2d world/physics engine.

Click on the black background area some for action. Wait a bit and the colliding balls will explode and subdivide. :pizza:

![Example of Web Page](./pizza.png "Example of Web Page")

It is hosted at:
http://allan.pizza

This repo also hosts a deployment of the golang-wasm implementation, which can be accessed at:
http://allan.pizza/go
(and the source can be found at https://github.com/aortez/pizza-pizza)

## Development

Start the development server with hot reload:

```bash
npm run dev
```

WebGL2 is selected automatically when the browser supports it. The app falls
back to Canvas2D if WebGL2 cannot start, and the Renderer button switches
between the two implementations. Both renderers support the animated
background, pizza texture, purple mode, debug drawing, and quadtree overlay.
To force the reference renderer while comparing behavior, open:

```text
http://localhost:5173/?renderer=canvas2d
```

## Build for production

```bash
npm run build
```

## Preview production build

```bash
npm run preview
```

## Frame app and publishing

The frame app lives at `/frame/`; `/setup/` provisions WiFi over Bluetooth and hands
the local address to it, and the old `/wifi/` QR URL still redirects to setup. These
pages are built and tested in [inky-soup](https://github.com/aortez/inky-soup/tree/main/app),
whose `app-v*` releases attach them as `frame-web.tar.gz`. `frame-app.json` pins the
release tag and the archive's SHA-256. `npm run build` downloads that archive, checks
the checksum, and adds it to `dist/` with `tools/frame-app.mjs`, failing if the site's
own build already has any of its files. `npm run test:frame` builds the site and checks
that it serves the pinned release.

To publish a new frame app release, set `tag` in `frame-app.json` to the new release
and `sha256` to the contents of its `frame-web.tar.gz.sha256`, for example:

```bash
curl -fsSL https://github.com/aortez/inky-soup/releases/download/app-v0.2.2/frame-web.tar.gz.sha256
```

Merging that change deploys it; reverting it rolls back. Installed web apps find the
new version and offer **Reload**.

GitHub Pages publishes the tested Vite `dist/` artifact through `.github/workflows/ci.yml`
after a successful push to `master`. Repository Pages settings must use GitHub
Actions (`build_type: workflow`), not direct branch publishing: the frame app's files
are added at build time. Go/WASM assets and the custom-domain file live in `public/`
so they are included in the deployed artifact.
