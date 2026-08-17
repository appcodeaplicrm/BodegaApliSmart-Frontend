/**
 * Cliente de Socket.IO para StockPro.
 *
 * Maneja:
 *  - Conexión autenticada con el JWT (mandado por `auth.token`).
 *  - Lista de bodegas del user (mandada en `auth.bodegas`) — el back
 *    joinea al socket a N rooms (una por bodega) en el handshake.
 *  - Reconexión automática con backoff exponencial.
 *  - Rotación del token: cuando el back rota el accessToken (cada 15min
 *    o cuando el front hace /me), actualizamos la referencia interna.
 *  - Cambio de bodega activa: `setActiveBodega(id)` emite `cambiar-bodega`
 *    al server (tracking, futuro: filtrado en back).
 *  - API minimalista: `getSocket()` devuelve la instancia única; los
 *    hooks (useRealtimeEvent) se suscriben a canales.
 *
 * El token se guarda en sessionStorage (decisión documentada: 权衡权衡
 * entre complejidad y seguridad. Migrable a tickets one-time sin
 * cambiar la API de este módulo).
 *
 * El socket se crea LAZY (al primer uso) para que el bundle inicial
 * no lo incluya si nadie lo usa (code splitting friendly).
 */

import { io, type Socket } from 'socket.io-client'

const STORAGE_KEY = 'sp_access_token'

/** Estado de la conexión, para el indicador "🟢 En vivo" en el UI. */
export type SocketStatus = 'disconnected' | 'connecting' | 'connected' | 'error'

type Listener<T> = (value: T) => void

// ── Estado interno ──────────────────────────────────────────
let socket: Socket | null = null
let currentToken: string | null = null
let currentBodegas: string[] = []
let currentActiveBodega: string | null = null
let status: SocketStatus = 'disconnected'

const statusListeners = new Set<Listener<SocketStatus>>()

function setStatus(next: SocketStatus): void {
  status = next
  statusListeners.forEach((l) => l(status))
}

// ── Token + bodegas (sessionStorage) ───────────────────────

/**
 * Guarda el access token que viene del back (en /auth/login, /auth/refresh, /auth/me).
 * Si las bodegas cambiaron (otro user, login de otra cuenta), re-conecta.
 */
export function setAccessToken(token: string | null): void {
  currentToken = token
  if (token) {
    sessionStorage.setItem(STORAGE_KEY, token)
  } else {
    sessionStorage.removeItem(STORAGE_KEY)
  }
  // Si el socket está conectado y el token cambió, forzar reconexión
  if (socket?.connected && token) {
    socket.disconnect()
    socket.auth = { token, bodegas: currentBodegas }
    socket.connect()
  }
}

export function getAccessToken(): string | null {
  if (currentToken) return currentToken
  if (typeof sessionStorage === 'undefined') return null
  const stored = sessionStorage.getItem(STORAGE_KEY)
  currentToken = stored
  return stored
}

/**
 * Setea la lista de bodegas a las que el user tiene acceso. Se manda
 * al back en el handshake del socket para que el back joinee al socket
 * a N rooms (una por bodega).
 *
 * Si la lista cambia (caso borde: admin agregó una bodega), re-conecta.
 */
export function setUserBodegas(bodegas: string[]): void {
  const sorted1 = [...bodegas].sort()
  const sorted2 = [...currentBodegas].sort()
  const changed =
    sorted1.length !== sorted2.length ||
    sorted1.some((b, i) => b !== sorted2[i])
  currentBodegas = bodegas
  if (!changed) return
  // Re-conectar con la nueva lista (el back joinea a N rooms nuevas)
  if (socket?.connected) {
    socket.disconnect()
    if (socket) {
      socket.auth = {
        token: getAccessToken(),
        bodegas: currentBodegas,
      }
      socket.connect()
    }
  }
}

/**
 * Indica al back cuál es la bodega "activa" (la que está mirando el
 * front). Solo afecta tracking/métricas — los eventos siguen llegando
 * para todas las bodegas del user (la UI filtra).
 */
export function setActiveBodega(bodegaId: string | null): void {
  currentActiveBodega = bodegaId
  const s = getSocket()
  if (s?.connected) {
    s.emit('cambiar-bodega', { bodegaId })
  }
}

// ── Socket lifecycle ───────────────────────────────────────

/**
 * Detecta si el front está corriendo en local (Vite dev server). En
 * ese caso usamos el proxy de Vite (`/socket.io` → `localhost:3001`)
 * y NO apuntamos directo al back, para no romper el handshake del
 * WebSocket (el back escucha en `/socket.io`, no en `/api/socket.io`).
 *
 * En producción (aaPanel), el front apunta a la URL del back con
 * `path: '/api/socket.io'` y el reverse proxy se encarga del rewrite.
 */
function isLocalDev(): boolean {
  if (typeof window === 'undefined') return false
  const { hostname } = window.location
  return hostname === 'localhost' || hostname === '127.0.0.1'
}

/**
 * Resuelve la URL del WebSocket.
 *
 *  - LOCAL: mismo origin que la página (Vite, :5173). El proxy de
 *    Vite reescribe `/socket.io` → `localhost:3001/socket.io` y
 *    mantiene el upgrade a WebSocket (`ws: true`).
 *  - PROD: si hay `VITE_API_URL` apuntando al back, usa ese origin.
 *    Si no, usa el origin de la página (caso típico de aaPanel donde
 *    front y back comparten dominio detrás de un reverse proxy).
 */
function getSocketUrl(): string {
  if (typeof window === 'undefined') return ''
  if (isLocalDev()) {
    // Mismo origin que Vite. El proxy se encarga de redirigir al back.
    return window.location.origin
  }
  const envBase = (import.meta.env.VITE_API_URL ?? '').replace(/\/+$/, '')
  if (envBase) {
    try {
      return new URL(envBase, window.location.origin).origin
    } catch {
      return window.location.origin
    }
  }
  return window.location.origin
}

/**
 * Path HTTP que usa Socket.IO. En local es `/socket.io` (Vite proxia
 * tal cual al back). En prod es `/api/socket.io` (aaPanel reescribe
 * `/api/*` → `/` antes de pasarlo al back, así que el back termina
 * recibiendo `/socket.io`).
 */
function getSocketPath(): string {
  return isLocalDev() ? '/socket.io' : '/api/socket.io'
}

/**
 * Devuelve la instancia singleton del socket. Si no existe, la crea.
 *
 * Si el usuario no está autenticado (no hay token), el socket queda
 * en estado `disconnected` y no se conecta. Cuando se setee el token,
 * llamar `getSocket()` de nuevo.
 */
export function getSocket(): Socket | null {
  if (typeof window === 'undefined') return null

  const token = getAccessToken()
  if (!token) {
    setStatus('disconnected')
    return null
  }

  if (socket) return socket

  setStatus('connecting')

  socket = io(getSocketUrl(), {
    path: getSocketPath(),
    auth: { token, bodegas: currentBodegas },
    // Inicia con polling y, si el proxy lo permite, asciende a WebSocket.
    // Si el upgrade falla, Socket.IO mantiene la conexión por polling.
    transports: ['polling', 'websocket'],
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 10000,
    reconnectionAttempts: Infinity,
    timeout: 20000,
  })

  socket.on('connect', () => {
    setStatus('connected')
    // eslint-disable-next-line no-console
    console.log('[socket] conectado', socket?.id)
    // Si hay una bodega activa, avisarle al back
    if (currentActiveBodega) {
      socket?.emit('cambiar-bodega', { bodegaId: currentActiveBodega })
    }
  })

  socket.on('disconnect', (reason) => {
    setStatus('disconnected')
    // eslint-disable-next-line no-console
    console.log('[socket] desconectado:', reason)
  })

  socket.on('connect_error', (err) => {
    setStatus('error')
    // eslint-disable-next-line no-console
    console.warn('[socket] error de conexión:', err.message)
  })

  return socket
}

/** Cierra el socket (logout). */
export function disconnectSocket(): void {
  if (socket) {
    socket.disconnect()
    socket = null
  }
  currentBodegas = []
  currentActiveBodega = null
  setStatus('disconnected')
}

// ── Status subscription (para el indicador "En vivo") ──────

/** Suscribe un listener al estado de la conexión. */
export function subscribeSocketStatus(l: Listener<SocketStatus>): () => void {
  statusListeners.add(l)
  l(status)
  return () => {
    statusListeners.delete(l)
  }
}
