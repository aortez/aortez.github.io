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

The [frame app](frame/README.md) lives at `/frame/`; `/setup/` provisions WiFi over
Bluetooth and hands the local address to it. The old `/wifi/` QR URL still redirects
to setup. The original device interface remains available as a fallback.

GitHub Pages publishes the tested Vite `dist/` artifact through `.github/workflows/ci.yml`
after a successful push to `master`. Repository Pages settings must use GitHub
Actions (`build_type: workflow`), not direct branch publishing: the frame’s service
worker and bundled assets are generated at build time. Go/WASM assets and the
custom-domain file live in `public/` so they are included in the deployed artifact.
