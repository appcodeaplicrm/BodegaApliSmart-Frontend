import { useSyncExternalStore } from 'react'
import { api, ApiError } from '../lib/api'

export type TipoMovimiento = {
  id: string
  nombre: string
  signo: 'E' | 'S' | '='
}

export type Movimiento = {
  id: string
  cantidad: number
  cantidadBase: number
  stockAnterior: number
  stockNuevo: number
  observacion: string | null
  fecha: string
  producto: {
    id: string
    nombre: string
    codigo: string
    unidadMedida: { id: string; abreviatura: string }
  }
  usuario: { id: string; nombre: string }
  tipoMovimiento: { id: string; nombre: string; signo: string }
  bodegaOrigen: { id: string; nombre: string } | null
  bodegaDestino: { id: string; nombre: string } | null
  /** Si este movimiento fue generado por una Compra, referencia a esa Compra. */
  compra?: { id: string; codigo: string } | null
}

type Estado =
  | { status: 'idle' }
  | { status: 'cargando' }
  | {
      status: 'listo'
      movimientos: Movimiento[]
      total: number
      page: number
      pageSize: number
      totalPages: number
    }
  | { status: 'error'; mensaje: string }

/** Filtros + paginación para `cargarPaginado`. */
export type MovimientosQuery = {
  bodegaId?: string
  dias?: number
  page: number
  pageSize: number
}

/** Shape estándar de respuesta paginada del back. */
export type PageResult<T> = {
  data: T[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

let estado: Estado = { status: 'idle' }
let cacheSnapshot: Estado = estado
let tiposCache: TipoMovimiento[] | null = null
// Última query ejecutada, para poder re-ejecutarla desde un evento
// realtime (ej: cuando llega 'movimiento.created', hacemos refetch de
// la página actual en vez de insertar el payload tal cual, porque el
// socket emite una versión "delgada" sin todos los campos que la UI lee).
let ultimaQuery: MovimientosQuery | null = null
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
  const e = estado
  if (cacheSnapshot === e) return cacheSnapshot
  if (cacheSnapshot.status !== e.status) {
    cacheSnapshot = e
    return cacheSnapshot
  }
  if (e.status === 'listo' && cacheSnapshot.status === 'listo') {
    if (
      cacheSnapshot.movimientos !== e.movimientos ||
      cacheSnapshot.total !== e.total ||
      cacheSnapshot.page !== e.page
    ) {
      cacheSnapshot = e
      return cacheSnapshot
    }
  } else if (e.status === 'error' && cacheSnapshot.status === 'error') {
    if (cacheSnapshot.mensaje !== e.mensaje) {
      cacheSnapshot = e
      return cacheSnapshot
    }
  }
  return cacheSnapshot
}
function setEstado(next: Estado) {
  estado = next
  emit()
}

export const movimientosStore = {
  subscribe,
  getSnapshot,

  async cargarPaginado(query: MovimientosQuery): Promise<PageResult<Movimiento>> {
    setEstado({ status: 'cargando' })
    ultimaQuery = query
    try {
      const params = new URLSearchParams()
      if (query.bodegaId) params.set('bodegaId', query.bodegaId)
      if (query.dias) params.set('dias', String(query.dias))
      params.set('page', String(query.page))
      params.set('pageSize', String(query.pageSize))
      const result = await api.get<PageResult<Movimiento>>(
        `/movimientos?${params.toString()}`,
      )
      setEstado({
        status: 'listo',
        movimientos: result.data,
        total: result.total,
        page: result.page,
        pageSize: result.pageSize,
        totalPages: result.totalPages,
      })
      return result
    } catch (err) {
      const mensaje =
        err instanceof ApiError ? err.message : 'No se pudieron cargar los movimientos.'
      setEstado({ status: 'error', mensaje })
      throw err
    }
  },

  /**
   * Re-ejecuta la última query usada. Se usa desde el realtime
   * provider cuando llega un evento que afecta la lista actual
   * (ej: 'movimiento.created' → refetch para que aparezca el nuevo
   * movimiento con la forma completa, no con el payload "delgado"
   * del socket).
   */
  async refetchActual(): Promise<PageResult<Movimiento> | null> {
    if (!ultimaQuery) return null
    return this.cargarPaginado(ultimaQuery)
  },

  async crear(input: {
    productoId: string
    tipoMovimientoId: string
    cantidad: number
    unidadMedidaId: string
    bodegaOrigenId?: string
    bodegaDestinoId?: string
    ubicacionId?: string
    observacion?: string
  }): Promise<Movimiento> {
    const movimiento = await api.post<Movimiento>('/movimientos', input)
    // Con paginación, la mutación local del array ya no es útil:
    // el front hace refetch de la página actual después de crear.
    return movimiento
  },

  /** Catálogo de tipos (con cache en memoria). */
  async tipos(): Promise<TipoMovimiento[]> {
    if (tiposCache) return tiposCache
    tiposCache = await api.get<TipoMovimiento[]>('/movimientos/tipos')
    return tiposCache
  },

  reset() {
    setEstado({ status: 'idle' })
  },

  /**
   * Handler para el evento realtime `movimiento.created`.
   *
   * Como la lista es paginada, solo insertamos arriba si la página
   * actual es 1 (para no romper la paginación). Si está en otra
   * página, no tocamos nada: el front hace refetch manual si quiere
   * ver el nuevo.
   *
   * Si el query está filtrado por bodega y el evento es de otra
   * bodega, lo ignoramos.
   */
  handleMovimientoCreado(args: {
    bodegaId: string | null
    payload: Movimiento
    currentBodegaId?: string
  }) {
    if (estado.status !== 'listo') return
    if (args.currentBodegaId && args.bodegaId !== args.currentBodegaId) return
    if (estado.page !== 1) return
    // Deduplicar
    if (estado.movimientos.some((m) => m.id === args.payload.id)) return
    setEstado({
      status: 'listo',
      movimientos: [args.payload, ...estado.movimientos].slice(0, estado.pageSize),
      total: estado.total + 1,
      page: estado.page,
      pageSize: estado.pageSize,
      totalPages: Math.ceil((estado.total + 1) / estado.pageSize),
    })
  },
}

export function useMovimientos() {
  return useSyncExternalStore(
    movimientosStore.subscribe,
    movimientosStore.getSnapshot,
    movimientosStore.getSnapshot,
  )
}
