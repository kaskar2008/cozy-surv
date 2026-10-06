import { defineConfig } from 'vite';

// base './' — сборка работает и в корне домена, и в подпапке
export default defineConfig({
  base: './',
  server: { port: 5173, host: true },
  build: { outDir: 'dist', assetsInlineLimit: 0, target: 'es2020', chunkSizeWarningLimit: 1000 },
});
