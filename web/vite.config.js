import { defineConfig } from 'vite';

// `base: './'` makes the built app load with relative paths so pywebview can
// open it straight from the filesystem (file://) without a server.
export default defineConfig({
  base: './',
  build: {
    target: 'es2020',
    outDir: 'dist',
    assetsInlineLimit: 0, // keep worker.glb as a real file, not a data: URI
    chunkSizeWarningLimit: 800,
  },
});
