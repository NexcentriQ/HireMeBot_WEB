/// <reference types="vitest" />
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'node:path'

export default defineConfig(({ command, mode }) => {
  // Build-time safety: refuse to produce a production bundle that bakes in
  // live mode. Live mode uses the dev-only X-Dev-Student-Id header, which
  // must never ship to a public deployment. Runtime also enforces this via
  // assertLiveEnv() so a dev build served statically still refuses to run.
  if (command === 'build') {
    const envVars = loadEnv(mode, process.cwd(), '')
    if (envVars.VITE_STUDENT_API_MODE === 'live') {
      throw new Error(
        'Refusing to build with VITE_STUDENT_API_MODE=live. ' +
          'The dev-only X-Dev-Student-Id header must not ship to production. ' +
          'Unset VITE_STUDENT_API_MODE (or set it to "mock") before `npm run build`.'
      )
    }
  }

  return {
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'HireMeBot',
        short_name: 'HireMeBot',
        description: 'Track your job applications towards a brighter future',
        theme_color: '#2563eb',
        background_color: '#ffffff',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        scope: '/',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icons/icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ]
      },
      workbox: {
        // Precache the app shell only — never any /api/* response (private
        // student data must stay in the in-memory TanStack Query cache).
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
        globIgnores: ['**/api/**'],
        navigateFallback: '/index.html',
        // Keep /api out of the SPA shell fallback AND out of every runtime
        // caching rule (see explicit NetworkOnly rule below).
        navigateFallbackDenylist: [/^\/api/, /^\/auth\/callback/],
        runtimeCaching: [
          {
            // Belt-and-suspenders: explicitly declare NetworkOnly for every
            // /api/* request so no future runtime rule can accidentally
            // start caching private dashboard responses in the SW storage.
            urlPattern: ({ url }) => url.pathname.startsWith('/api/'),
            handler: 'NetworkOnly'
          },
          {
            urlPattern: ({ url, request }) =>
              request.destination === 'image' && !url.pathname.startsWith('/api/'),
            handler: 'CacheFirst',
            options: {
              cacheName: 'images',
              expiration: { maxEntries: 60, maxAgeSeconds: 60 * 60 * 24 * 30 }
            }
          }
        ]
      }
    })
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  },
  server: {
    port: 5173,
    host: true,
    // Dev-only reverse proxy. The backend has no CORS configuration (see
    // API.md), so the browser cannot call http://127.0.0.1:3000 directly
    // from http://localhost:5173. Routing /api through Vite avoids the
    // CORS preflight and lets `.env.local` leave VITE_API_BASE_URL empty.
    proxy: {
      '/api': {
        target: process.env.VITE_API_PROXY_TARGET || 'http://127.0.0.1:3000',
        changeOrigin: true
      }
    }
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    css: true
  }
  }
})
