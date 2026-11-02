import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// The app is served from https://<user>.github.io/timebank/ on GitHub Pages.
// Override with BASE_PATH=/ for other hosts.
const base = process.env.BASE_PATH ?? '/timebank/';

export default defineConfig({
  base,
  // date-holidays ships data for all countries; the bundle is cached by the service worker.
  build: { chunkSizeWarningLimit: 2600 },
  define: {
    __APP_VERSION__: JSON.stringify(
      `${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC${process.env.GITHUB_SHA ? ` · ${process.env.GITHUB_SHA.slice(0, 7)}` : ''}`,
    ),
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Timebank',
        short_name: 'Timebank',
        description: 'Track working hours and your overtime balance — offline.',
        theme_color: '#1f6f5c',
        background_color: '#f6f5f1',
        display: 'standalone',
        start_url: base,
        scope: base,
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,json}'],
        maximumFileSizeToCacheInBytes: 8 * 1024 * 1024,
      },
      devOptions: {
        enabled: false,
      },
    }),
  ],
});
