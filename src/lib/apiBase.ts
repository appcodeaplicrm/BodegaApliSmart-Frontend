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
const RAW_ENV_BASE = (import.meta.env.VITE_API_URL ?? '').replace(/\/+$/, '')
const ENV_BASE = RAW_ENV_BASE.replace(/\/api$/, '')

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
 *  - Si empieza con `/uploads/...` → la concatena con `apiBaseUrl()`
 *    (caso típico de URLs legacy que ya vienen con el prefijo).
 *  - Si es una key RELATIVA (sin prefijo) → le agregamos `/uploads/`
 *    antes de concatenarla con `apiBaseUrl()`. Esto es lo más común
 *    hoy: el back devuelve `fotoKey` con la forma
 *    `{adminId}/bodegas/{warehouseId}/checklist/{uuid}.{ext}` (sin
 *    el `/uploads/`), y el front la usa directo en `<img>` o
 *    `fetch`. Si no le pusiéramos el prefijo, el browser pediría
 *    `http://host/{key}` y el back devolvería 404.
 *  - Si es `null`/`undefined`/vacía → devuelve `null` (el caller decide qué hacer).
 */
export function imageUrl(urlOrKey: string | null | undefined): string | null {
  if (!urlOrKey) return null
  // data: URLs y blobs no se tocan
  if (urlOrKey.startsWith('data:') || urlOrKey.startsWith('blob:')) return urlOrKey

  const isLocalBrowser =
    typeof window !== 'undefined' &&
    (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')

  // En aaPanel/Nginx los archivos del backend se publican a través
  // de `/api/uploads/*`. Normalizamos también URLs absolutas legacy
  // del mismo dominio que todavía apuntan a `/uploads/*`.
  if (/^https?:\/\//i.test(urlOrKey)) {
    try {
      const parsed = new URL(urlOrKey)
      if (
        !isLocalBrowser &&
        typeof window !== 'undefined' &&
        parsed.origin === window.location.origin &&
        parsed.pathname.startsWith('/uploads/')
      ) {
        parsed.pathname = `/api${parsed.pathname}`
        return parsed.toString()
      }
    } catch {
      // Si no se puede interpretar, dejamos que el navegador trate la URL.
    }
    return urlOrKey
  }

  if (urlOrKey.startsWith('/api/uploads/')) return urlOrKey

  const key = urlOrKey
    .replace(/^\/api\/uploads\//, '')
    .replace(/^\/uploads\//, '')
    .replace(/^\/+/, '')

  // Si VITE_API_URL termina en /api, esa es también la ruta pública
  // correcta para uploads. Sin variable: localhost accede directo al
  // backend y producción usa el proxy /api del mismo origen.
  if (RAW_ENV_BASE) {
    const assetBase = RAW_ENV_BASE.endsWith('/api') ? RAW_ENV_BASE : ENV_BASE
    return `${assetBase}/uploads/${key}`
  }
  if (isLocalBrowser) return `${apiBaseUrl()}/uploads/${key}`
  return `/api/uploads/${key}`
}
