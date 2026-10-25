# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a personal GitHub Pages site (allan.pizza) hosting two interactive web applications:

1. **Canvas Ball Physics Simulation** (main site): A JavaScript/Canvas-based physics simulation featuring colliding balls that explode and subdivide. Built with ES6 modules and native HTML5 controls.
2. **Go/WASM Triangles Demo** (`/go` route): A Go-based WebAssembly application demonstrating graphics rendering.
3. **Sparkle Duck Setup** (`/setup` route): A Bluetooth-based WiFi provisioning interface for embedded devices using the Improv WiFi protocol.

## Build System

This project uses **Vite** for modern ES6 module bundling and development.

### Development server
```bash
npm run dev
```
Starts the Vite development server with hot module replacement on port 8080.

### Production build
```bash
npm run build
```
Builds the application for production into the `dist/` directory.

### Preview production build
```bash
npm run preview
```
Serves the production build locally for testing.

### Installing dependencies
```bash
npm install
```

## Architecture

### Main Application Structure

The canvas application (`index.html`) uses ES6 modules with proper import/export:

- **Vector math**: `vec2.js`, `vec3.js` - 2D/3D vector operations (exported classes).
- **Utilities**: `utils.js` - Array shuffling function.
- **Spatial partitioning**: `quadtree.js` - Collision detection optimization (work in progress per TODO file).
- **Physics**: `ball.js` - Ball entities with collision and subdivision logic.
- **World simulation**: `world.js` - Main physics simulation manager, handles ball interactions, gravity, collisions, and particle systems.
- **Rendering**: `background.js` - Animated background effects.
- **UI Control**: `controller.js` - Mouse/touch input handling and UI event wiring.
- **Initialization**: `main.js` - Application entry point, exports `init()` function.

### Module Dependencies

The ES6 module system automatically handles dependency resolution:
- `main.js` imports `World` and `Controller`
- `controller.js` imports `vec2`, `vec3`, `Ball`, `setDebugOn`
- `world.js` imports `vec2`, `vec3`, `Ball`, `Background`, `shuffle`, `quadtree`
- `ball.js` imports `vec2`, `vec3`
- `quadtree.js` imports `vec2`, `Ball`, `vec3`
- `background.js` imports `vec3`

### UI Components

The application now uses **native HTML5 controls**:
- Standard `<button>` elements with custom CSS styling
- Native `<input type="range">` sliders with custom thumb styling
- Live value display updates using vanilla JavaScript

Previous Polymer dependencies have been completely removed.

### Go/WASM Application

The `/go` route serves a pre-compiled WebAssembly binary (`public/main.wasm`) with `public/wasm_exec.js` runtime. The source code lives in a separate repository (https://github.com/aortez/pizza-pizza).

### Sparkle Duck Setup

The `/setup` route provides a Bluetooth Low Energy (BLE) WiFi provisioning interface:
- Uses the repo-owned Improv BLE client in `setup/improv-client.js`; no remote runtime SDK.
- Mobile setup form with connection status, retry/cancel, and an explicit device link.
- Only works in browsers with Web Bluetooth support (Chrome, Edge) over HTTPS.

## Key Files

- `vite.config.js`: Vite build configuration with multi-page setup.
- `package.json`: NPM dependencies and build scripts.
- `src/scripts/*.js`: ES6 module source files with proper imports/exports.
- `index.html`: Main application entry point using `<script type="module">`.
- `go.html`: Go/WASM demo entry point.
- `setup/`: Bluetooth provisioning UI and transport; `wifi/` redirects older QR links.
- `public/main.wasm`: Pre-built Go binary (built from external repo).

## Development Notes

- This is a personal playground project (per README disclaimer) - expect experimental code.
- Quadtree implementation is work-in-progress (see TODO file for design notes).
- Google Analytics is configured for the allan.pizza domain.
- Pushes to `master` run CI and deploy its tested Vite `dist/` artifact to GitHub Pages using Actions.
- Keep Pages configured for GitHub Actions (`build_type: workflow`); generated output is not committed.

Setup tests in `tests/setup.spec.js` use a mock Bluetooth device to cover success,
wrong credentials, missing notifications on older firmware, timeout, cancellation,
unsafe links, unsupported browsers, and the legacy QR URL. No test uses real WiFi
credentials. The page stores no credentials and sends them only over Bluetooth.

A physical Pixel 9 Pro XL (Android 17, Chrome 156) also passed discovery, BLE
connection, an absent-network error, retry to the saved network, password
clearing, and opening the Pi's app over WiFi. The unmerged production build was
served through `adb reverse tcp:8080 tcp:8080` at `http://localhost:8080/setup/`,
which is a secure context. Android initially blocked Chrome's local-network
access despite showing Nearby devices as allowed; selecting Allow again cleared
the denial. The setup help includes that recovery path. Evidence is in
`docs/validation/setup-pixel9-real-ble.json` and
`docs/screenshots/setup-pixel9-real-ble.png`.
