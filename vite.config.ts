import { defineConfig } from 'vite';

export default defineConfig({
  root: '.',
  base: './',
  server: {
    port: 3000,
    open: true,
    host: true
  },
  build: {
    outDir: 'docs',
    emptyOutDir: true,
    target: 'esnext'
  }
});

