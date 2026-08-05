/**
 * Cliente HTTP central.
 *
 * Las cookies (access + refresh) son httpOnly, así que el front NUNCA
 * toca los tokens. Solo usamos `credentials: 'include'` para que viajen.
 *
 * Si una request devuelve 401, intenta un refresh silencioso. Si el refresh
 * también falla, marca la sesión como expirada.
 *
 * El back además devuelve el `accessToken` en el body de /auth/login,
 * /auth/refresh y /auth/me. Lo guardamos en sessionStorage para que el
 * WebSocket pueda leerlo (la cookie httpOnly no es accesible desde JS).
 */

import { setAccessToken, setUserBodegas } from './socket'

const BASE = '/api'

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public payload?: unknown,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

type RequestOptions = Omit<RequestInit, 'body'> & {
  body?: unknown
  /** Si es true, no intenta refresh automático en 401. */
  skipRefresh?: boolean
}

async function request<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const { body, headers, skipRefresh, ...rest } = opts

  // Si el body es FormData, lo dejamos al fetch (que setea el multipart boundary)
  // y NO seteamos Content-Type manualmente.
  const isFormData = body instanceof FormData

  const init: RequestInit = {
    method: rest.method ?? 'GET',
    credentials: 'include',
    headers: {
      Accept: 'application/json',
      ...(body !== undefined && !isFormData ? { 'Content-Type': 'application/json' } : {}),
      ...headers,
    },
    ...rest,
  }
  if (body !== undefined) {
    if (isFormData) {
      init.body = body
    } else {
      init.body = JSON.stringify(body)
    }
  }

  const res = await fetch(`${BASE}${path}`, init)

  // 401 → intentar refresh (una vez)
  if (res.status === 401 && !skipRefresh && !path.startsWith('/auth/')) {
    const refreshed = await tryRefresh()
    if (refreshed) {
      return request<T>(path, opts) // reintenta la request original
    }
    // Si el refresh también falló, la sesión está irrecuperable.
    // Forzamos logout (limpia stores y manda al login) en vez de quedar
    // en un estado donde todas las requests devuelven 401.
    triggerSessionExpired()
  }

  // 204 No Content
  if (res.status === 204) return undefined as T

  const text = await res.text()
  const data: unknown = text ? JSON.parse(text) : null

  // Si la respuesta trae `accessToken` (login/refresh/me), guardarlo
  // para el WebSocket. Si no viene, no tocamos el token actual.
  if (data && typeof data === 'object' && 'accessToken' in data) {
    const token = (data as { accessToken?: unknown }).accessToken
    if (typeof token === 'string' && token.length > 0) {
      setAccessToken(token)
    }
    // También guardar la lista de bodegas del user, así el back
    // joinea al socket a las rooms correctas.
    const obj = data as { usuario?: { bodegas?: unknown } }
    if (Array.isArray(obj.usuario?.bodegas)) {
      const bodegas = obj.usuario!.bodegas.filter(
        (b): b is string => typeof b === 'string' && b.length > 0,
      )
      setUserBodegas(bodegas)
    }
  }

  if (!res.ok) {
    const obj = data as { error?: string; message?: string | string[] } | null
    const code = obj?.error ?? `HTTP ${res.status}`
    const message = Array.isArray(obj?.message)
      ? obj!.message.join(', ')
      : (obj?.message ?? res.statusText)
    throw new ApiError(res.status, code, message, data)
  }

  return data as T
}

/** Intenta un refresh. Devuelve true si tuvo éxito. */
let refreshing: Promise<boolean> | null = null
async function tryRefresh(): Promise<boolean> {
  if (refreshing) return refreshing
  refreshing = (async () => {
    try {
      const res = await fetch(`${BASE}/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
      })
      return res.ok
    } catch {
      return false
    } finally {
      // pequeño delay para no spamear el refresh
      setTimeout(() => {
        refreshing = null
      }, 200)
    }
  })()
  return refreshing
}

export const api = {
  get: <T,>(path: string, opts?: RequestOptions) => request<T>(path, { ...opts, method: 'GET' }),
  post: <T,>(path: string, body?: unknown, opts?: RequestOptions) =>
    request<T>(path, { ...opts, method: 'POST', body }),
  put: <T,>(path: string, body?: unknown, opts?: RequestOptions) =>
    request<T>(path, { ...opts, method: 'PUT', body }),
  patch: <T,>(path: string, body?: unknown, opts?: RequestOptions) =>
    request<T>(path, { ...opts, method: 'PATCH', body }),
  delete: <T,>(path: string, opts?: RequestOptions) =>
    request<T>(path, { ...opts, method: 'DELETE' }),
}

/**
 * Llamado cuando una request devuelve 401 y el refresh también falló.
 * Limpia los stores locales y recarga la página para mandar al usuario al
 * login. El recargar es importante porque hay React state que se quedó
 * con la sesión vieja en memoria.
 *
 * Se exporta por separado para evitar import circular con el authStore.
 */
let sessionExpiredHandled = false
function triggerSessionExpired(): void {
  if (sessionExpiredHandled) return
  sessionExpiredHandled = true
  // Limpia el storage de auth y el access token del WebSocket.
  try {
    setAccessToken(null)
    window.location.replace('/login')
  } catch {
    /* ignore */
  }
  // Reseteamos el flag después de un tiempo para que un eventual próximo
  // login pueda disparar el flujo de nuevo.
  setTimeout(() => {
    sessionExpiredHandled = false
  }, 2000)
}
