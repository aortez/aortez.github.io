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

The `/go` route serves a pre-compiled WebAssembly binary (`main.wasm`) with `wasm_exec.js` runtime. The source code lives in a separate repository (https://github.com/aortez/pizza-pizza).

### Sparkle Duck Setup

The `/setup` route provides a Bluetooth Low Energy (BLE) WiFi provisioning interface:
- Uses the Improv WiFi SDK (https://www.improv-wifi.com/sdk-ble-js/launch-button.js).
- Custom duck-themed UI with orbiting connectivity icons.
- Only works in browsers with Web Bluetooth support (Chrome, Edge) over HTTPS.

## Key Files

- `vite.config.js`: Vite build configuration with multi-page setup.
- `package.json`: NPM dependencies and build scripts.
- `src/scripts/*.js`: ES6 module source files with proper imports/exports.
- `index.html`: Main application entry point using `<script type="module">`.
- `go.html`: Go/WASM demo entry point.
- `setup/index.html`: Self-contained Bluetooth provisioning UI.
- `main.wasm`: Pre-built Go binary (built from external repo).

## Development Notes

- This is a personal playground project (per README disclaimer) - expect experimental code.
- Quadtree implementation is work-in-progress (see TODO file for design notes).
- Google Analytics is configured for the allan.pizza domain.
- The site is deployed via GitHub Pages from the master branch.
- For GitHub Pages deployment, build output should be committed (Vite builds to `dist/` by default).
