import { useSyncExternalStore } from 'react'
import { api, ApiError } from '../lib/api'

export type Bodega = {
  id: string
  nombre: string
  direccion: string | null
  createdAt: string
}

type Estado =
  | { status: 'idle' } // todavía no se cargó
  | { status: 'cargando' }
  | { status: 'listo'; bodegas: Bodega[] }
  | { status: 'error'; mensaje: string }

let estado: Estado = { status: 'idle' }
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

function getSnapshot() {
  return estado
}

function setEstado(next: Estado | ((prev: Estado) => Estado)) {
  estado = typeof next === 'function' ? (next as (p: Estado) => Estado)(estado) : next
  emit()
}

export const bodegasStore = {
  subscribe,
  getSnapshot,

  /**
   * Trae la lista de bodegas. Es idempotente: si ya está cargando o ya
   * tiene datos, no vuelve a llamar al back. Esto evita loops infinitos
   * cuando varios componentes (Sidebar + Dashboard + SelectorBodega)
   * piden la lista en cada render.
   *
   * Si el usuario es superadmin, NO llama al back (el endpoint devuelve
   * 403 porque el superadmin no tiene `inventario.ver` por diseño — el
   * superadmin solo navega `/admin/tenants`, no la app de bodegas).
   *
   * Pasale `force: true` para forzar el refetch.
   */
  async cargar(opts: { force?: boolean; rol?: string } = {}): Promise<Bodega[]> {
    // Superadmin: skip. Su vista es /admin/tenants.
    if (opts.rol === 'superadmin') {
      setEstado({ status: 'listo', bodegas: [] })
      return []
    }
    if (!opts.force && (estado.status === 'cargando' || estado.status === 'listo')) {
      return estado.status === 'listo' ? estado.bodegas : []
    }
    setEstado({ status: 'cargando' })
    try {
      const bodegas = await api.get<Bodega[]>('/bodegas')
      setEstado({ status: 'listo', bodegas })
      return bodegas
    } catch (err) {
      const mensaje = err instanceof ApiError ? err.message : 'Error al cargar bodegas.'
      setEstado({ status: 'error', mensaje })
      throw err
    }
  },

  async crear(input: { nombre: string; direccion?: string }): Promise<Bodega> {
    const nueva = await api.post<Bodega>('/bodegas', input)
    // Refrescamos la lista completa (la nueva va a aparecer al inicio si la trae el back)
    setEstado((prev: Estado) => {
      if (prev.status === 'listo') {
        return {
          status: 'listo',
          bodegas: [nueva, ...prev.bodegas.filter((b: Bodega) => b.id !== nueva.id)],
        }
      }
      return { status: 'listo', bodegas: [nueva] }
    })
    return nueva
  },

  /** Resetea el store (para volver al onboarding). */
  reset() {
    setEstado({ status: 'idle' })
  },
}

export function useBodegas() {
  return useSyncExternalStore(bodegasStore.subscribe, bodegasStore.getSnapshot, bodegasStore.getSnapshot)
}
