import { useSyncExternalStore } from 'react'
import { api, ApiError } from '../lib/api'

/* ─── Tipos ───────────────────────────────────── */

export type EstadoPedido =
  | 'Pendiente'
  | 'AprobadoPorBodega'
  | 'Entregado'
  | 'Cancelado'

/**
 * Estado de la revisión del técnico (segunda etapa del wizard).
 *  - 'pendiente'  → el bodeguero aprobó, falta que el técnico procese
 *  - 'aprobado'   → el técnico confirmó todos los items
 *  - 'saltado'    → todos los items del técnico fueron saltados
 *  - 'mixto'      → algunos confirmados, otros saltados
 *  - 'no_aplica'  → el pedido no llegó a la etapa del técnico
 */
export type EstadoRevision =
  | 'pendiente'
  | 'aprobado'
  | 'saltado'
  | 'mixto'
  | 'no_aplica'

export type EstadoEntregaItem = 'pendiente' | 'en_bodega' | 'en_tecnico' | 'saltado'

export type EntregaItem = {
  id: string
  pedidoId: string
  detalleId: string
  productoId: string
  cantidad: number
  estado: EstadoEntregaItem
  fotoBodegueroUrl: string | null
  fotoTecnicoUrl: string | null
  /** URL pública (campo virtual del back). */
  fotoBodegueroImageUrl?: string | null
  fotoTecnicoImageUrl?: string | null
  saltadoPorBodega: boolean
  motivoSaltoBodega: string | null
  saltadoPorTecnico: boolean
  motivoSaltoTecnico: string | null
  bodegaProcesadoEn: string | null
  tecnicoProcesadoEn: string | null
  producto: { id: string; codigo: string; nombre: string }
}

export type PedidoItem = {
  id: string
  /** Exactamente uno de los dos está poblado. */
  productoId: string | null
  kitId: string | null
  /** Viene como string desde Prisma Decimal */
  cantidad: number
  producto: {
    id: string
    codigo: string
    nombre: string
    /** Solo viene en listar/findOne. Útil para el PDF. */
    documentos?: Array<{ id: string; url: string; mimeType: string }>
  } | null
  kit: {
    id: string
    codigo: string
    nombre: string
    descripcion: string | null
    bodegaId: string
    activo: boolean
    items: Array<{
      id: string
      productoId: string
      cantidad: number
      producto: { id: string; codigo: string; nombre: string }
    }>
  } | null
  /** Filas de entrega (1 por producto concreto del pedido). */
  entregaItems?: EntregaItem[]
}

export type Pedido = {
  id: string
  codigo: string
  motivo: string | null
  fotoEvidenciaUrl: string | null
  createdAt: string
  updatedAt: string
  deletedAt: string | null
  operadorId: string
  bodegaId: string
  estadoId: string
  aprobadaPorId: string | null
  aprobadaAt: string | null
  canceladaPorId: string | null
  canceladaAt: string | null
  motivoCancelacion: string | null
  estado: { id: string; nombre: EstadoPedido; createdAt: string }
  /** Traído por el back en el `include` del listar/findOne. */
  operador?: { id: string; nombre: string } | null
  aprobadaPor?: { id: string; nombre: string } | null
  canceladaPor?: { id: string; nombre: string } | null
  items: PedidoItem[]
}

/** Forma liviana que consume la UI (la lista necesita solo lo mínimo). */
export type PedidoListItem = {
  id: string
  codigo: string
  motivo: string | null
  estadoNombre: EstadoPedido
  createdAt: number
  createdAtLabel: string
  operadorId: string
  operadorNombre: string | null
  bodegaId: string
  /** URL de la foto de evidencia (la trae el back si el pedido está aprobado). */
  fotoEvidenciaUrl: string | null
  items: Array<{
    id: string
    /** 'producto' = ítem suelto; 'kit' = agrupador de N productos. */
    kind: 'producto' | 'kit'
    /** Nombre a mostrar (producto.nombre o kit.nombre). */
    nombre: string
    /** SKU/código del producto (o código del kit si es kit). */
    sku: string
    cantidad: number
    /** URL de la primera foto del producto (compatibilidad). */
    fotoUrl: string | null
    /** Todas las URLs de fotos del producto (galería del PDF). */
    fotos: string[]
    /** Si es kit, los productos que lo componen (con su cantidad). */
    kitItems?: Array<{ nombre: string; cantidad: number }>
  }>
  /** Resumen del wizard: total / procesados / saltados. */
  entregaResumen?: {
    total: number
    bodegaDone: number
    tecnicoDone: number
    saltados: number
  }
  /**
   * Estado de la revisión del técnico (la segunda etapa del wizard).
   *  - 'pendiente'  → el bodeguero aprobó, falta que el técnico procese
   *  - 'aprobado'   → el técnico confirmó todos los items
   *  - 'saltado'    → todos los items del técnico fueron saltados
   *  - 'mixto'      → algunos confirmados, otros saltados
   *  - 'no_aplica'  → el pedido no llegó a la etapa del técnico
   *  - undefined    → sin datos (caso legacy o sin EntregaItem)
   */
  revisionEstado?: EstadoRevision
  /** ISO string del back (o null). Útil para "Aprobadas hoy". */
  aprobadaAt: string | null
  aprobadaAtLabel: string | null
  aprobadaPorId: string | null
  aprobadaPorNombre: string | null
  canceladaAt: string | null
  canceladaAtLabel: string | null
  canceladaPorId: string | null
  canceladaPorNombre: string | null
  motivoCancelacion: string | null
}

/* ─── Helpers ─────────────────────────────────── */

function formatFecha(iso: string): string {
  return new Date(iso).toLocaleString('es-CO', {
    dateStyle: 'short',
    timeStyle: 'short',
  })
}

function toListItem(p: Pedido): PedidoListItem {
  // Resumen del wizard de entrega (sumamos todos los EntregaItem del pedido)
  const allEntregaItems = p.items.flatMap((it) => it.entregaItems ?? [])
  const entregaResumen =
    allEntregaItems.length > 0
      ? {
          total: allEntregaItems.length,
          bodegaDone: allEntregaItems.filter(
            (e) => e.estado === 'en_bodega' || e.estado === 'en_tecnico' || e.estado === 'saltado',
          ).length,
          tecnicoDone: allEntregaItems.filter(
            (e) => e.estado === 'en_tecnico' || e.estado === 'saltado',
          ).length,
          saltados: allEntregaItems.filter((e) => e.estado === 'saltado').length,
        }
      : undefined

  // Estado de la revisión del técnico (segunda etapa del wizard).
  // Lo calculamos a partir de los EntregaItem y el estado global del pedido.
  let revisionEstado: EstadoRevision = 'no_aplica'
  if (allEntregaItems.length > 0) {
    const estadoGlobal = p.estado.nombre
    if (estadoGlobal === 'Pendiente' || estadoGlobal === 'Cancelado') {
      revisionEstado = 'no_aplica'
    } else if (estadoGlobal === 'AprobadoPorBodega') {
      // El bodeguero ya terminó; el técnico todavía no procesó
      revisionEstado = 'pendiente'
    } else if (estadoGlobal === 'Entregado') {
      // El técnico ya terminó
      const saltados = allEntregaItems.filter((e) => e.estado === 'saltado').length
      const confirmados = allEntregaItems.filter((e) => e.estado === 'en_tecnico').length
      if (saltados === 0) revisionEstado = 'aprobado'
      else if (confirmados === 0) revisionEstado = 'saltado'
      else revisionEstado = 'mixto'
    } else {
      // Aprobado (legacy), Rechazado, etc.
      revisionEstado = 'no_aplica'
    }
  }

  return {
    id: p.id,
    codigo: p.codigo,
    motivo: p.motivo,
    estadoNombre: p.estado.nombre,
    createdAt: new Date(p.createdAt).getTime(),
    createdAtLabel: formatFecha(p.createdAt),
    operadorId: p.operadorId,
    operadorNombre: p.operador?.nombre ?? null,
    bodegaId: p.bodegaId,
    fotoEvidenciaUrl: p.fotoEvidenciaUrl ?? null,
    entregaResumen,
    revisionEstado,
    items: p.items.map((it) => {
      // Producto suelto
      if (it.productoId && it.producto) {
        const fotos = (it.producto.documentos ?? []).map((d) => d.url)
        return {
          id: it.id,
          kind: 'producto' as const,
          nombre: it.producto.nombre,
          sku: it.producto.codigo,
          cantidad: Number(it.cantidad),
          fotoUrl: fotos[0] ?? null,
          fotos,
        }
      }
      // Kit
      if (it.kitId && it.kit) {
        return {
          id: it.id,
          kind: 'kit' as const,
          nombre: it.kit.nombre,
          sku: it.kit.codigo,
          cantidad: Number(it.cantidad),
          // El kit en sí no tiene foto; usamos la primera foto del primer
          // producto del kit como "foto del kit" (si tiene).
          fotoUrl: null,
          fotos: [],
          kitItems: it.kit.items.map((ki) => ({
            nombre: ki.producto.nombre,
            cantidad: Number(ki.cantidad),
          })),
        }
      }
      // Caso raro (item huérfano)
      return {
        id: it.id,
        kind: 'producto' as const,
        nombre: '(ítem sin producto ni kit)',
        sku: '',
        cantidad: Number(it.cantidad),
        fotoUrl: null,
        fotos: [],
      }
    }),
    aprobadaAt: p.aprobadaAt,
    aprobadaAtLabel: p.aprobadaAt ? formatFecha(p.aprobadaAt) : null,
    aprobadaPorId: p.aprobadaPorId,
    aprobadaPorNombre: p.aprobadaPor?.nombre ?? null,
    canceladaAt: p.canceladaAt,
    canceladaAtLabel: p.canceladaAt ? formatFecha(p.canceladaAt) : null,
    canceladaPorId: p.canceladaPorId,
    canceladaPorNombre: p.canceladaPor?.nombre ?? null,
    motivoCancelacion: p.motivoCancelacion,
  }
}

/* ─── Store ───────────────────────────────────── */

/** Filtros + paginación para cargar la lista de pedidos. */
export type PedidosQuery = {
  bodegaId?: string
  estado?: string
  /** Filtra por el operador que creó el pedido. La vista "Mis solicitudes"
   * lo manda con el `id` del usuario actual. */
  operadorId?: string
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

type Estado =
  | { status: 'idle' }
  | { status: 'cargando' }
  | {
      status: 'listo'
      pedidos: PedidoListItem[]
      total: number
      page: number
      pageSize: number
      totalPages: number
    }
  | { status: 'error'; mensaje: string }

let estado: Estado = { status: 'idle' }
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
  const e = estado
  if (cacheSnapshot === e) return cacheSnapshot
  if (cacheSnapshot.status !== e.status) {
    cacheSnapshot = e
    return cacheSnapshot
  }
  if (e.status === 'listo' && cacheSnapshot.status === 'listo') {
    if (
      cacheSnapshot.pedidos !== e.pedidos ||
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

export const pedidosStore = {
  subscribe,
  getSnapshot,

  /** Trae el detalle completo de un pedido (con items.entregaItems). */
  async findOne(id: string): Promise<Pedido> {
    return api.get<Pedido>(`/pedidos/${encodeURIComponent(id)}`)
  },

  /** Carga una página de pedidos con filtros opcionales. */
  async cargarPaginado(query: PedidosQuery): Promise<PageResult<PedidoListItem>> {
    setEstado({ status: 'cargando' })
    try {
      const params = new URLSearchParams()
      if (query.bodegaId) params.set('bodegaId', query.bodegaId)
      if (query.estado) params.set('estado', query.estado)
      if (query.operadorId) params.set('operadorId', query.operadorId)
      params.set('page', String(query.page))
      params.set('pageSize', String(query.pageSize))
      const result = await api.get<PageResult<Pedido>>(`/pedidos?${params.toString()}`)
      const pedidos = result.data.map(toListItem)
      const pageResult: PageResult<PedidoListItem> = {
        data: pedidos,
        total: result.total,
        page: result.page,
        pageSize: result.pageSize,
        totalPages: result.totalPages,
      }
      setEstado({
        status: 'listo',
        pedidos,
        total: pageResult.total,
        page: pageResult.page,
        pageSize: pageResult.pageSize,
        totalPages: pageResult.totalPages,
      })
      return pageResult
    } catch (err) {
      const mensaje = err instanceof ApiError ? err.message : 'No se pudieron cargar los pedidos.'
      setEstado({ status: 'error', mensaje })
      throw err
    }
  },

  /** Recarga la página actual (helper). */
  async recargar(query: PedidosQuery): Promise<void> {
    try {
      await this.cargarPaginado(query)
    } catch {
      /* el estado ya quedó en 'error' */
    }
  },

  /** Aprueba un pedido (PATCH /pedidos/:id/aprobar). */
  async aprobar(id: string, fotoEvidenciaUrl?: string): Promise<Pedido> {
    const data = await api.patch<Pedido>(
      `/pedidos/${encodeURIComponent(id)}/aprobar`,
      fotoEvidenciaUrl ? { fotoEvidenciaUrl } : {},
    )
    return data
  },

  /** Cancela un pedido (PATCH /pedidos/:id/cancelar). */
  async cancelar(id: string, motivo: string): Promise<Pedido> {
    const data = await api.patch<Pedido>(
      `/pedidos/${encodeURIComponent(id)}/cancelar`,
      { motivo },
    )
    return data
  },

  reset() {
    setEstado({ status: 'idle' })
  },
}

export function usePedidos() {
  return useSyncExternalStore(pedidosStore.subscribe, pedidosStore.getSnapshot, pedidosStore.getSnapshot)
}
