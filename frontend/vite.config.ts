import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['manifest.json'],
      workbox: {
        navigateFallback: '/index.html',
        ignoreURLParametersMatching: [/.*/],
        globPatterns: ['**/*.{js,css,html,ico,png,svg}']
      },
      manifest: false
    })
  ],
  server: {
    port: 5173
  }
});