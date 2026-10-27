import { defineConfig } from 'vite';

// /frame/, /setup/, and /wifi/ come from a pinned inky-soup release; see tools/frame-app.mjs.
export default defineConfig(({ mode }) => ({
  root: '.',
  base: '/',
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: {
        main: './index.html',
        go: './go.html'
      }
    }
  },
  server: {
    port: 8080,
    open: mode !== 'headless'
  }
}));
