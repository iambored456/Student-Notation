// vite.config.ts
import { defineConfig } from 'vite';
import { fileURLToPath, URL } from 'node:url';

const isProd = process.env['NODE_ENV'] === 'production';

export default defineConfig({
  base: isProd ? '/Student-Notation/' : '/',
  server: {
    open: true
  },
  define: {
    'process.env.NODE_ENV': JSON.stringify(process.env['NODE_ENV'] || 'development')
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@components': fileURLToPath(new URL('./src/components', import.meta.url)),
      '@services': fileURLToPath(new URL('./src/services', import.meta.url)),
      '@state': fileURLToPath(new URL('./src/state', import.meta.url)),
      '@utils': fileURLToPath(new URL('./src/utils', import.meta.url)),
      tone: 'tone/build/Tone.js'
    }
  },
  build: {
    outDir: 'docs',
    emptyOutDir: true
  }
});
