// vite.config.js
import { defineConfig } from 'vite';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  base: process.env.NODE_ENV === 'production' ? '/Student-Notation/' : '/',

  server: {
    open: true, // auto-opens default browser on `vite dev`
  },

  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./js', import.meta.url)),
      '@components': fileURLToPath(new URL('./js/components', import.meta.url)),
      '@services': fileURLToPath(new URL('./js/services', import.meta.url)),
      '@state': fileURLToPath(new URL('./js/state', import.meta.url)),
      '@utils': fileURLToPath(new URL('./js/utils', import.meta.url)),
      tone: 'tone/build/Tone.js', // keeps your Tone.js import working
    },
  },

  build: {
    outDir: 'docs', // write the production build to /docs
    emptyOutDir: true, // wipe /docs before each build
  },
});
