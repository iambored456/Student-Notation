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
      '@': fileURLToPath(new URL('./js', import.meta.url)),
      '@components': fileURLToPath(new URL('./js/components', import.meta.url)),
      '@services': fileURLToPath(new URL('./js/services', import.meta.url)),
      '@state': fileURLToPath(new URL('./js/state', import.meta.url)),
      '@utils': fileURLToPath(new URL('./js/utils', import.meta.url)),
      tone: 'tone/build/Tone.js'
    }
  },
  build: {
    outDir: 'docs',
    emptyOutDir: true
  }
});
