import { defineConfig } from 'vite';

export default defineConfig({
  // Relative base so the build works on Cloudflare Pages and game portals
  base: './',
  build: {
    outDir: 'dist',
  },
});
