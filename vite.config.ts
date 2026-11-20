import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// Warna sesuai docs/DESIGN.md (bg light & ikon).
const BG_LIGHT = '#F5F4F0'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',
      injectRegister: false, // registrasi lewat useRegisterSW di src/ui/UpdatePrompt.tsx
      includeAssets: ['favicon.svg', 'favicon-32.png', 'apple-touch-icon.png', 'icon.svg'],
      manifest: {
        id: '/',
        name: 'Arus',
        short_name: 'Arus',
        description: 'Pencatat keuangan pribadi. Semua data hanya ada di perangkat ini.',
        lang: 'id',
        dir: 'ltr',
        start_url: '/?source=pwa',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
        background_color: BG_LIGHT,
        theme_color: BG_LIGHT,
        categories: ['finance', 'productivity'],
        icons: [
          { src: '/pwa-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/pwa-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/pwa-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2,webmanifest}'],
        navigateFallback: 'index.html',
        cleanupOutdatedCaches: true,
        clientsClaim: false,
        skipWaiting: false,
      },
      devOptions: { enabled: false },
    }),
  ],
})
