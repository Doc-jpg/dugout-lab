import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// Dugout Lab is a static, offline-first PWA, separate from Dugout Dad: its own manifest,
// start URL, service-worker scope (the BASE_PATH) and its own IndexedDB database name.
const base = process.env.BASE_PATH || '/';
// White-label build: BRAND_NAME and BRAND_COLOR change the installed app's name, icon label and theme color.
const brandName = process.env.BRAND_NAME || 'Dugout Lab';
const brandColor = process.env.BRAND_COLOR || '#13213a';

export default defineConfig({
  base,
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/*.png', 'icons/*.svg'],
      manifest: {
        name: brandName,
        short_name: brandName,
        id: base,
        description: 'Personalized youth baseball practice planning and player development, offline-first',
        start_url: base,
        scope: base,
        display: 'standalone',
        orientation: 'portrait',
        background_color: brandColor,
        theme_color: brandColor,
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
        navigateFallback: base + 'index.html',
        cleanupOutdatedCaches: true
      }
    })
  ],
  define: { __BRAND_NAME__: JSON.stringify(brandName) },
  build: { target: 'es2020', sourcemap: false },
  test: { environment: 'node', include: ['tests/**/*.test.ts'], setupFiles: ['tests/setup.ts'] }
} as any);
