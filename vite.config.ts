import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifestFilename: 'manifest.json',
      filename: 'sw-v2.js',
      includeAssets: [
        'favicon.png',
        'pwa-icon-192.png',
        'pwa-icon-maskable-512.png',
        'screenshot-wide.png',
        'screenshot-narrow.png',
      ],
      manifest: {
        id: '/',
        name: 'BodegaApliSmart',
        short_name: 'BodegaApliSmart',
        description: 'Sistema de gestión de bodegas, inventario y operaciones.',
        lang: 'es',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        background_color: '#242424',
        theme_color: '#242424',
        icons: [
          {
            src: '/pwa-icon-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/pwa-icon-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable',
          },
        ],
        screenshots: [
          {
            src: '/screenshot-wide.png',
            sizes: '1376x768',
            type: 'image/png',
            form_factor: 'wide',
            label: 'Dashboard de BodegaApliSmart',
          },
          {
            src: '/screenshot-narrow.png',
            sizes: '768x1376',
            type: 'image/png',
            form_factor: 'narrow',
            label: 'Vista móvil de BodegaApliSmart',
          },
        ],
      },
      workbox: {
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: true,
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api\//, /^\/socket\.io\//, /^\/uploads\//],
        runtimeCaching: [
          {
            urlPattern: /\/(?:api\/|socket\.io\/|uploads\/)/,
            handler: 'NetworkOnly',
          },
        ],
      },
      devOptions: {
        enabled: false,
      },
    }),
  ],
  server: {
    port: 5173,
    proxy: {
      // Redirige /api/* al backend NestJS en :3001
      // Las cookies httpOnly se reenvían automáticamente
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        // Reescribe /api/auth/login → /auth/login
        // (porque el backend no tiene prefijo /api)
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
      // Redirige /uploads/* al backend. Sirve los archivos subidos por
      // los usuarios (fotos de producto, fotos de evidencia, etc.).
      '/uploads': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      // Proxy del WebSocket. En LOCAL:
      //   - El front pide http://localhost:5173/socket.io
      //   - Vite lo reenvía a http://localhost:3001/socket.io (back).
      //   - `ws: true` es crítico para que Vite haga el upgrade a
      //     WebSocket (sino se queda en long-polling y se cae en
      //     cuanto el dev server se recarga).
      // En PRODUCCIÓN este bloque no se usa (Vite no corre); el
      // front pide directamente /api/socket.io y el reverse proxy
      // de aaPanel se encarga del rewrite /api/* → /*.
      '/socket.io': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        ws: true,
      },
    },
  },
})
