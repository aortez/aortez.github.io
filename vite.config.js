import { defineConfig } from 'vite';
import { framePwa } from './tools/frame-pwa.js';

export default defineConfig(({ mode }) => ({
  root: '.',
  plugins: [framePwa()],
  base: '/',
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: {
        main: './index.html',
        go: './go.html',
        setup: './setup/index.html',
        frame: './frame/index.html',
        wifi: './wifi/index.html'
      }
    }
  },
  server: {
    port: 8080,
    open: mode !== 'headless'
  }
}));
