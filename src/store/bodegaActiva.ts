import { useSyncExternalStore } from 'react'

const STORAGE_KEY = 'winerysmart:bodegaActivaId'

/**
 * Bodega actualmente seleccionada para el dashboard.
 * Se persiste en localStorage para que al refrescar la página quede la misma.
 *
 * El flujo:
 *  1. El usuario elige una bodega en el SelectorBodega
 *  2. Se guarda en localStorage + se emite a los listeners
 *  3. El DashboardView lee el id y llama a dashboardStore.cargar(id)
 */
type Estado = { bodegaId: string | null }

function read(): string | null {
  if (typeof window === 'undefined') return null
  try {
    return window.localStorage.getItem(STORAGE_KEY)
  } catch {
    return null
  }
}

function write(value: string | null) {
  if (typeof window === 'undefined') return
  try {
    if (value) window.localStorage.setItem(STORAGE_KEY, value)
    else window.localStorage.removeItem(STORAGE_KEY)
  } catch {
    /* localStorage bloqueado: no pasa nada, queda en memoria */
  }
}

let estado: Estado = { bodegaId: read() }
let cacheSnapshot: Estado = estado
const listeners = new Set<() => void>()

function emit() {
  listeners.forEach((l) => l())
}

function subscribe(l: () => void) {
  listeners.add(l)
  return () => {
    listeners.delete(l)
  }
}

function getSnapshot(): Estado {
  // useSyncExternalStore requiere que el snapshot sea referencialmente
  // estable cuando el estado no cambia. Cacheamos el último objeto
  // devuelto y solo creamos uno nuevo cuando el id efectivamente cambió.
  if (cacheSnapshot.bodegaId !== estado.bodegaId) {
    cacheSnapshot = estado
  }
  return cacheSnapshot
}

function setEstado(next: Estado) {
  estado = next
  emit()
}

export const bodegaActivaStore = {
  subscribe,
  getSnapshot,

  /** Devuelve el id de la bodega activa. */
  getId(): string | null {
    return estado.bodegaId
  },

  /** Cambia la bodega activa y persiste en localStorage. */
  set(bodegaId: string | null) {
    write(bodegaId)
    setEstado({ bodegaId })
  },

  /** Resetea (se usa en logout). */
  reset() {
    write(null)
    setEstado({ bodegaId: null })
  },
}

/**
 * Hook de React. Devuelve el id de la bodega activa (string | null)
 * directamente, sin necesidad de hacer .bodegaId en cada uso.
 *
 * El getter se cachea por valor para que useSyncExternalStore no vea
 * "cambios" cuando el id no cambió.
 */
let cacheId: string | null | undefined = undefined
function getBodegaIdSnapshot(): string | null {
  const current = bodegaActivaStore.getSnapshot().bodegaId
  if (cacheId === undefined || cacheId !== current) {
    cacheId = current
  }
  return cacheId
}

export function useBodegaActiva(): string | null {
  return useSyncExternalStore(
    bodegaActivaStore.subscribe,
    getBodegaIdSnapshot,
    getBodegaIdSnapshot,
  )
}
