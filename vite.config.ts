import { defineConfig } from 'vite';

// Vite config for the Mahjong game.
// - Fast dev server with HMR out of the box.
// - Production build emits a static bundle into dist/.
// - Base is './' so the built app can be served from any sub-path.
export default defineConfig({
  base: './',
  build: {
    outDir: 'dist',
    target: 'es2022',
    sourcemap: true,
  },
  server: {
    port: 5173,
    open: false,
  },
});
