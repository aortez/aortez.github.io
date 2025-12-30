import { defineConfig } from 'vite';

export default defineConfig({
  root: '.',
  base: '/',
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: {
        main: './index.html',
        go: './go.html',
        setup: './setup/index.html'
      }
    }
  },
  server: {
    port: 8080,
    open: true
  }
});
