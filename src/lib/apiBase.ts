/**
 * Devuelve la URL base del API (sin el `/api` final, sin slash al final).
 *
 * Sirve para construir URLs absolutas a recursos servidos por el back
 * (típicamente `/uploads/...`).
 *
 * Reglas:
 *  - Si `VITE_API_URL` está definido, se usa tal cual.
 *  - Si no, en dev se asume que el back vive en `http://localhost:3001`.
 *  - En prod (Render), `VITE_API_URL` se setea en el build.
 *
 * El `/api` final del prefijo se strippea porque las rutas de uploads
 * (p.ej. `/uploads/2026-07/abc.jpg`) están montadas sin el prefijo.
 */
const ENV_BASE = (import.meta.env.VITE_API_URL ?? '').replace(/\/+$/, '').replace(/\/api$/, '')

function fallbackBase(): string {
  if (typeof window === 'undefined') return ''
  const { protocol, hostname } = window.location
  // En dev: front en :5173, back en :3001. En prod: mismo host (Render proxy).
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return `${protocol}//${hostname}:3001`
  }
  return `${protocol}//${hostname}`
}

export function apiBaseUrl(): string {
  if (ENV_BASE) return ENV_BASE
  return fallbackBase()
}

/**
 * Resuelve una URL de imagen servida por el back a una URL absoluta
 * usable en `<img src>` o `<a href>`.
 *
 * Hoy el back sirve `/uploads/*` estáticamente (sin auth). En el
 * futuro, cuando `useStaticAssets` se apague, esto va a tener que
 * pasar por `GET /storage/:key` autenticado. En ese momento cambiamos
 * el helper y nada del front se entera.
 *
 * Reglas:
 *  - Si la URL es absoluta (`http://...` / `https://...`) → la devuelve igual.
 *  - Si empieza con `/uploads/...` o es una key relativa → la concatena con `apiBaseUrl()`.
 *  - Si es `null`/`undefined`/vacía → devuelve `null` (el caller decide qué hacer).
 */
export function imageUrl(urlOrKey: string | null | undefined): string | null {
  if (!urlOrKey) return null
  if (/^https?:\/\//i.test(urlOrKey)) return urlOrKey
  // data: URLs y blobs no se tocan
  if (urlOrKey.startsWith('data:') || urlOrKey.startsWith('blob:')) return urlOrKey
  const base = apiBaseUrl()
  if (!base) return null
  const path = urlOrKey.startsWith('/') ? urlOrKey : `/${urlOrKey}`
  return `${base}${path}`
}
