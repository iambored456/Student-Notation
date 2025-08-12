// vite.config.js
import { defineConfig } from 'vite';

export default defineConfig({
  
  base: process.env.NODE_ENV === 'production' ? '/Student-Notation/' : '/',

  server: {
    open: true,               // auto-opens default browser on `vite dev`
  },

  resolve: {
    alias: {
      tone: 'tone/build/Tone.js',   // keeps your Tone.js import working
    },
  },

  build: {
    outDir: 'docs',           // write the production build to /docs
    emptyOutDir: true,        // wipe /docs before each build
  },
});
