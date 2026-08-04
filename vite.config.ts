import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
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
    },
  },
})
