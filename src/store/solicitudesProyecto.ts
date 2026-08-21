import { useSyncExternalStore } from 'react'
import { api, ApiError } from '../lib/api'
import type { SolicitudListItem, ListSolicitudesQuery } from '../components/proyectos/types'

/**
 * Store de `ProyectoSolicitudBodega` para usar en pantallas de
 * gestión (Despachos, etc.). Mismo patrón que `usePedidos()`.
 *
 * Las solicitudes de proyecto son DISTINTAS del modelo `Pedido`
 * general (códigos PSB-YYYY-NNNN, estado: pendiente / aprobada /
 * rechazada / entregada). El back expone el endpoint
 * `GET /solicitudes-bodega` que las lista (filtrable por bodegaId,
 * proyectoId y estado), y luego `PATCH /solicitudes-bodega/:id/{aprobar,rechazar,entregar}`
 * para que el bodeguero las resuelva.
 */

type Estado =
  | { status: 'idle' }
  | { status: 'cargando' }
  | {
      status: 'listo'
      solicitudes: SolicitudListItem[]
      total: number
      page: number
      pageSize: number
      totalPages: number
    }
  | { status: 'error'; mensaje: string }

let estado: Estado = { status: 'idle' }
let lastQuery: ListSolicitudesQuery | null = null
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
  return estado
}

function setEstado(next: Estado) {
  estado = next
  emit()
}

export const solicitudesProyectoStore = {
  subscribe,
  getSnapshot,

  async cargarPaginado(query: ListSolicitudesQuery): Promise<void> {
    lastQuery = query
    setEstado({ status: 'cargando' })
    try {
      const res = await api.get<{
        data: SolicitudListItem[]
        total: number
        page: number
        pageSize: number
        totalPages: number
      }>(`/solicitudes-bodega?${qs(query)}`)
      setEstado({
        status: 'listo',
        solicitudes: res.data,
        total: res.total,
        page: res.page,
        pageSize: res.pageSize,
        totalPages: res.totalPages,
      })
    } catch (err) {
      const mensaje =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'Error inesperado al cargar las solicitudes.'
      setEstado({ status: 'error', mensaje })
    }
  },

  /**
   * Re-fetch silencioso con el último query conocido. Lo usan los
   * handlers realtime cuando llega un cambio de estado.
   */
  async refrescar(): Promise<void> {
    if (!lastQuery) return
    await this.cargarPaginado(lastQuery)
  },
}

function qs(q: ListSolicitudesQuery): string {
  const usp = new URLSearchParams()
  for (const [k, v] of Object.entries(q)) {
    if (v != null && v !== '') usp.set(k, String(v))
  }
  const s = usp.toString()
  return s ? `?${s}` : ''
}

export function useSolicitudesProyecto() {
  return useSyncExternalStore(
    solicitudesProyectoStore.subscribe,
    solicitudesProyectoStore.getSnapshot,
    solicitudesProyectoStore.getSnapshot,
  )
}
