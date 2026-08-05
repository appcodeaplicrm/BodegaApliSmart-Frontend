import { useSyncExternalStore } from 'react'
import { api, ApiError } from '../lib/api'

/* ─── Tipos ───────────────────────────────────── */

export type EstadoDevolucion =
  | 'pendiente'
  | 'en_transito'
  | 'recibida'
  | 'cancelada'

export type EstadoDevolucionItem =
  | 'pendiente'
  | 'en_transito'
  | 'recibido'
  | 'rechazado'

export type DevolucionItem = {
  id: string
  devolucionId: string
  detalleId: string
  productoId: string
  cantidad: number
  estado: EstadoDevolucionItem
  fotoRecibidoUrl: string | null
  fotoOperadorUrl: string | null
  /** URL pública (campo virtual del back). */
  fotoRecibidoImageUrl?: string | null
  fotoOperadorImageUrl?: string | null
  motivoRechazo: string | null
  recibidoEn: string | null
  recibidoPor: string | null
  operadorProcesadoEn: string | null
  producto: { id: string; codigo: string; nombre: string }
  detalle: {
    id: string
    productoId: string | null
    kitId: string | null
    cantidad: number
  }
}

export type Devolucion = {
  id: string
  codigo: string
  motivo: string | null
  motivoCancelacion: string | null
  createdAt: string
  updatedAt: string
  pedidoId: string
  bodegaId: string
  operadorId: string
  recibidaPorId: string | null
  recibidaAt: string | null
  canceladaPorId: string | null
  canceladaAt: string | null
  estado: EstadoDevolucion
  operador?: { id: string; nombre: string } | null
  recibidaPor?: { id: string; nombre: string } | null
  canceladaPor?: { id: string; nombre: string } | null
  pedido?: { id: string; codigo: string } | null
  items: DevolucionItem[]
}

/* ─── Helpers ─────────────────────────────────── */

function formatFecha(iso: string): string {
  return new Date(iso).toLocaleString('es-CO', {
    dateStyle: 'short',
    timeStyle: 'short',
  })
}

/** Forma liviana para listas. */
export type DevolucionListItem = {
  id: string
  codigo: string
  motivo: string | null
  estadoNombre: EstadoDevolucion
  createdAt: number
  createdAtLabel: string
  operadorId: string
  operadorNombre: string | null
  bodegaId: string
  pedidoId: string
  pedidoCodigo: string | null
  itemsCount: number
  /** Items ya recibidos / total. */
  progreso: { recibidos: number; rechazados: number; pendientes: number; total: number }
  recibidaAt: string | null
  recibidaAtLabel: string | null
  recibidaPorNombre: string | null
  canceladaAt: string | null
  canceladaAtLabel: string | null
  motivoCancelacion: string | null
}

/**
 * Items pendientes de devolución por pedido Entregado.
 * Lo que aún tiene el técnico en la mano y debería devolver.
 */
export type PendientePorPedido = {
  pedidoId: string
  pedidoCodigo: string
  bodegaId: string
  operadorId: string
  operadorNombre: string | null
  items: Array<{
    detalleId: string
    productoId: string
    productoNombre: string
    productoCodigo: string
    kitNombre: string | null
    cantidadOriginal: number
    yaDevuelto: number
    disponible: number
  }>
}

/**
 * Convierte una Devolución (con includes) en un DevolucionListItem.
 * Exportado para que el handler realtime pueda usarlo al insertar.
 */
export function toListItem(d: Devolucion): DevolucionListItem {
  const total = d.items.length
  const recibidos = d.items.filter((it) => it.estado === 'recibido').length
  const rechazados = d.items.filter((it) => it.estado === 'rechazado').length
  const pendientes = total - recibidos - rechazados
  return {
    id: d.id,
    codigo: d.codigo,
    motivo: d.motivo,
    estadoNombre: d.estado,
    createdAt: new Date(d.createdAt).getTime(),
    createdAtLabel: formatFecha(d.createdAt),
    operadorId: d.operadorId,
    operadorNombre: d.operador?.nombre ?? null,
    bodegaId: d.bodegaId,
    pedidoId: d.pedidoId,
    pedidoCodigo: d.pedido?.codigo ?? null,
    itemsCount: total,
    progreso: { recibidos, rechazados, pendientes, total },
    recibidaAt: d.recibidaAt,
    recibidaAtLabel: d.recibidaAt ? formatFecha(d.recibidaAt) : null,
    recibidaPorNombre: d.recibidaPor?.nombre ?? null,
    canceladaAt: d.canceladaAt,
    canceladaAtLabel: d.canceladaAt ? formatFecha(d.canceladaAt) : null,
    motivoCancelacion: d.motivoCancelacion,
  }
}

/* ─── Store ───────────────────────────────────── */

type Estado =
  | { status: 'idle' }
  | { status: 'cargando' }
  | {
      status: 'listo'
      devoluciones: DevolucionListItem[]
      total: number
      page: number
      pageSize: number
      totalPages: number
    }
  | { status: 'error'; mensaje: string }

/** Filtros + paginación para `cargarPaginado`. */
export type DevolucionesQuery = {
  bodegaId?: string
  estado?: string
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
/**
 * Cache del último query usado en `cargarPaginado`. Sirve para que
 * los handlers realtime puedan hacer un refetch silencioso.
 */
let lastQuery: DevolucionesQuery | null = null
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
      cacheSnapshot.devoluciones !== e.devoluciones ||
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

export const devolucionesStore = {
  subscribe,
  getSnapshot,

  async findOne(id: string): Promise<Devolucion> {
    return api.get<Devolucion>(`/devoluciones/${encodeURIComponent(id)}`)
  },

  /**
   * Trae los items pendientes de devolución por pedido Entregado.
   *
   * Filtros opcionales:
   *  - `bodegaId`: filtra a los pedidos de esa bodega (recomendado
   *    para que el admin vea solo lo de la bodega activa).
   *  - `operadorId`: filtra a los pedidos de ese operador.
   */
  async cargarPendientes(
    operadorId?: string,
    bodegaId?: string,
  ): Promise<PendientePorPedido[]> {
    const params = new URLSearchParams()
    if (operadorId) params.set('operadorId', operadorId)
    if (bodegaId) params.set('bodegaId', bodegaId)
    const qs = params.toString()
    return api.get<PendientePorPedido[]>(
      `/devoluciones/pendientes-por-pedido${qs ? `?${qs}` : ''}`,
    )
  },

  async cargarPaginado(query: DevolucionesQuery): Promise<PageResult<DevolucionListItem>> {
    lastQuery = query
    setEstado({ status: 'cargando' })
    try {
      const params = new URLSearchParams()
      if (query.bodegaId) params.set('bodegaId', query.bodegaId)
      if (query.estado) params.set('estado', query.estado)
      params.set('page', String(query.page))
      params.set('pageSize', String(query.pageSize))
      const result = await api.get<PageResult<Devolucion>>(
        `/devoluciones?${params.toString()}`,
      )
      const devoluciones = result.data.map(toListItem)
      setEstado({
        status: 'listo',
        devoluciones,
        total: result.total,
        page: result.page,
        pageSize: result.pageSize,
        totalPages: result.totalPages,
      })
      return { ...result, data: devoluciones }
    } catch (err) {
      const mensaje = err instanceof ApiError ? err.message : 'No se pudieron cargar las devoluciones.'
      setEstado({ status: 'error', mensaje })
      throw err
    }
  },

  async recargar(query: DevolucionesQuery): Promise<void> {
    try {
      await this.cargarPaginado(query)
    } catch {
      /* ya quedó en error */
    }
  },

  /**
   * El técnico crea una devolución.
   * @param pedidoId ID del pedido original (debe estar Entregado)
   * @param motivo motivo opcional
   * @param items array de { detalleId, productoId, cantidad }
   */
  async crear(
    pedidoId: string,
    motivo: string | undefined,
    items: Array<{ detalleId: string; productoId: string; cantidad: number }>,
  ): Promise<Devolucion> {
    const data = await api.post<Devolucion>('/devoluciones', {
      pedidoId,
      motivo,
      items,
    })
    return data
  },

  /** Técnico: marca un item como en_transito con foto. */
  async fotoOperador(
    devolucionId: string,
    devolucionItemId: string,
    input: { url?: string; key?: string },
  ): Promise<DevolucionItem> {
    return api.patch<DevolucionItem>(
      `/devoluciones/${encodeURIComponent(devolucionId)}/foto-operador`,
      { entregaItemId: devolucionItemId, fotoUrl: input.url, fotoKey: input.key },
    )
  },

  /** Técnico: finaliza el wizard. La devolución pasa a en_transito. */
  async finalizarOperador(devolucionId: string): Promise<Devolucion> {
    return api.patch<Devolucion>(
      `/devoluciones/${encodeURIComponent(devolucionId)}/finalizar-operador`,
      {},
    )
  },

  /** Bodeguero: marca un item como recibido con foto. */
  async fotoRecibido(
    devolucionId: string,
    devolucionItemId: string,
    input: { url?: string; key?: string },
  ): Promise<DevolucionItem> {
    return api.patch<DevolucionItem>(
      `/devoluciones/${encodeURIComponent(devolucionId)}/foto-recibido`,
      { entregaItemId: devolucionItemId, fotoUrl: input.url, fotoKey: input.key },
    )
  },

  /** Bodeguero: rechaza un item (no se devuelve porque está dañado, etc.). */
  async rechazarItem(
    devolucionId: string,
    devolucionItemId: string,
    motivo: string,
  ): Promise<DevolucionItem> {
    return api.patch<DevolucionItem>(
      `/devoluciones/${encodeURIComponent(devolucionId)}/rechazar-item`,
      { entregaItemId: devolucionItemId, motivo },
    )
  },

  /** Bodeguero: cierra la devolución y suma el stock. */
  async finalizar(devolucionId: string): Promise<Devolucion> {
    return api.patch<Devolucion>(
      `/devoluciones/${encodeURIComponent(devolucionId)}/finalizar`,
      {},
    )
  },

  /** Cancela una devolución. */
  async cancelar(devolucionId: string, motivo?: string): Promise<Devolucion> {
    return api.patch<Devolucion>(
      `/devoluciones/${encodeURIComponent(devolucionId)}/cancelar`,
      motivo ? { motivo } : {},
    )
  },

  reset() {
    setEstado({ status: 'idle' })
  },

  /**
   * Handler para el evento realtime `devolucion.creada`.
   *
   * Inserta la devolución arriba de la lista.
   */
  handleDevolucionCreada(args: {
    bodegaId: string | null
    payload: Devolucion
    currentBodegaId?: string
  }) {
    if (estado.status !== 'listo') return
    if (args.currentBodegaId && args.bodegaId !== args.currentBodegaId) return
    if (estado.devoluciones.some((d) => d.id === args.payload.id)) return
    const nueva = toListItem(args.payload)
    setEstado({
      status: 'listo',
      devoluciones: [nueva, ...estado.devoluciones],
      total: estado.total + 1,
      page: estado.page,
      pageSize: estado.pageSize,
      totalPages: Math.ceil((estado.total + 1) / estado.pageSize),
    })
  },

  /**
   * Handler para el evento realtime `devolucion.cambiada`.
   *
   * Estrategia: refetch silencioso de la página actual con el último
   * query. Robusto contra cualquier discrepancia (ej: cambios en
   * items, recibidaPor, etc. que el evento no trae).
   */
  handleDevolucionCambiada(event: {
    id: string
    codigo: string
    estadoAnterior: string
    estadoNuevo: string
    bodegaId: string | null
  }) {
    if (!lastQuery) return
    if (
      event.bodegaId &&
      lastQuery.bodegaId &&
      event.bodegaId !== lastQuery.bodegaId
    ) {
      return
    }
    void this.recargarSilencioso()
  },

  /**
   * Refetch silencioso: igual a `cargarPaginado` pero NO cambia el
   * status a 'cargando' (no parpadea la UI).
   */
  async recargarSilencioso(): Promise<void> {
    if (!lastQuery) return
    try {
      const params = new URLSearchParams()
      if (lastQuery.bodegaId) params.set('bodegaId', lastQuery.bodegaId)
      if (lastQuery.estado) params.set('estado', lastQuery.estado)
      params.set('page', String(lastQuery.page))
      params.set('pageSize', String(lastQuery.pageSize))
      const result = await api.get<PageResult<Devolucion>>(
        `/devoluciones?${params.toString()}`,
      )
      const devoluciones = result.data.map(toListItem)
      if (estado.status === 'listo') {
        setEstado({
          status: 'listo',
          devoluciones,
          total: result.total,
          page: result.page,
          pageSize: result.pageSize,
          totalPages: result.totalPages,
        })
      }
    } catch {
      // Silencioso
    }
  },
}

export function useDevoluciones() {
  return useSyncExternalStore(
    devolucionesStore.subscribe,
    devolucionesStore.getSnapshot,
    devolucionesStore.getSnapshot,
  )
}
