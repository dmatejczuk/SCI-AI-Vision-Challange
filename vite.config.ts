import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({
  plugins: [react()],
  // Use Phaser's official pre-minified distribution to avoid reprocessing its large UMD bundle.
  resolve: { alias: [{ find: /^phaser$/, replacement: 'phaser/dist/phaser.min.js' }] },
  build: {
    chunkSizeWarningLimit: 2000,
    rollupOptions: {
      output: { manualChunks: { tensorflow: ['@tensorflow/tfjs'], phaser: ['phaser'] } },
    },
  },
});
