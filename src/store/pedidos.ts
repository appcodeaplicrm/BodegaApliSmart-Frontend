import { useSyncExternalStore } from 'react'
import { api, ApiError } from '../lib/api'
import { authStore } from './auth'

/**
 * Filtra el query para que quien entra únicamente como técnico vea
 * SUS propios pedidos. La bandeja general se habilita por el permiso
 * efectivo `despachos.ver`, no por el nombre fijo del rol: un rol
 * delegado con ese permiso también debe ver todas las solicitudes de
 * la bodega activa.
 *
 * Mismo patrón que `proyectos/store.ts#applyUserScope`. Si el query
 * ya traía un `operadorId` explícito (ej: el admin filtró por un
 * operador específico desde la UI), NO lo pisamos.
 */
function applyUserScope(query: PedidosQuery): PedidosQuery {
  const auth = authStore.getSnapshot()
  if (auth.status !== 'autenticado') return query
  const { usuario } = auth.sesion
  if (authStore.tienePermisos(['despachos.ver'])) return query
  if (query.operadorId) return query
  return { ...query, operadorId: usuario.id }
}

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
    /** Traído por el back en findOne (con include producto: true). */
    unidadMedida?: {
      id: string
      nombre: string
      abreviatura: string
      permiteDecimales: boolean
    }
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
      producto: {
        id: string
        codigo: string
        nombre: string
        unidadMedida?: {
          id: string
          nombre: string
          abreviatura: string
          permiteDecimales: boolean
        }
      }
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

/**
 * Convierte un Pedido (con includes) en un PedidoListItem (forma liviana
 * para listas). Exportado para que el handler realtime pueda usarlo al
 * insertar un pedido nuevo arriba de la lista.
 */
export function toListItem(p: Pedido): PedidoListItem {
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
/**
 * Cache del último query usado en `cargarPaginado`. Sirve para que
 * los handlers realtime puedan hacer un refetch silencioso cuando
 * llega un cambio (ej: estado de pedido cambió) y re-sincronizar la
 * lista sin que el componente tenga que saber qué filtros se usaron.
 */
let lastQuery: PedidosQuery | null = null
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
    // Aplica el scope por user (admin ve todos, otros solo los suyos).
    // NO re-aplicamos en `recargarSilencioso` para no recalcular el
    // scope en cada refetch silencioso (ya quedó en el lastQuery).
    const scopedQuery = applyUserScope(query)
    lastQuery = scopedQuery
    setEstado({ status: 'cargando' })
    try {
      const result = await this.fetchPaginado(scopedQuery)
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

  /**
   * Refetch silencioso: igual a `cargarPaginado` pero NO cambia el
   * status a 'cargando' (la lista sigue mostrándose, no parpadea).
   * Usado por los handlers realtime para re-sincronizar después de
   * un cambio.
   */
  async recargarSilencioso(): Promise<void> {
    if (!lastQuery) return
    try {
      const result = await this.fetchPaginado(lastQuery)
      const pedidos = result.data.map(toListItem)
      // Solo actualizar si el status sigue siendo 'listo' (no pisar
      // un 'cargando' o 'error' que haya puesto el usuario).
      if (estado.status === 'listo') {
        setEstado({
          status: 'listo',
          pedidos,
          total: result.total,
          page: result.page,
          pageSize: result.pageSize,
          totalPages: result.totalPages,
        })
      }
    } catch {
      // Silencioso: si falla, el próximo GET manual del usuario lo arregla
    }
  },

  /** Helper interno: hace el GET al back con el query dado. */
  async fetchPaginado(query: PedidosQuery): Promise<PageResult<Pedido>> {
    const params = new URLSearchParams()
    if (query.bodegaId) params.set('bodegaId', query.bodegaId)
    if (query.estado) params.set('estado', query.estado)
    if (query.operadorId) params.set('operadorId', query.operadorId)
    params.set('page', String(query.page))
    params.set('pageSize', String(query.pageSize))
    return api.get<PageResult<Pedido>>(`/pedidos?${params.toString()}`)
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

  /**
   * Handler para el evento realtime `pedido.creado`.
   *
   * Inserta el pedido arriba de la lista (sin importar la página).
   * Si la lista no está cargada o el pedido ya está, lo ignora.
   *
   * Si el evento es de otra bodega a la que está mirando el usuario,
   * también lo ignora.
   */
  handlePedidoCreado(args: {
    bodegaId: string | null
    payload: Pedido
    /** Bodega activa del usuario (la que tiene cargada la lista). */
    currentBodegaId?: string
  }) {
    if (estado.status !== 'listo') return
    if (args.currentBodegaId && args.bodegaId !== args.currentBodegaId) return
    // Deduplicar (caso borde: el user creó el pedido y se lo emitimos a él mismo)
    if (estado.pedidos.some((p) => p.id === args.payload.id)) return
    const nuevo = toListItem(args.payload)
    setEstado({
      status: 'listo',
      pedidos: [nuevo, ...estado.pedidos],
      total: estado.total + 1,
      page: estado.page,
      pageSize: estado.pageSize,
      totalPages: Math.ceil((estado.total + 1) / estado.pageSize),
    })
  },

  /**
   * Handler para el evento realtime `pedido.estado-cambiado`.
   *
   * Estrategia: hacer un refetch silencioso de la página actual con el
   * último query que se usó. Esto SIEMPRE refleja el estado real del
   * back (incluyendo cambios en otros campos que el evento no trae,
   * como `aprobadaAt`, `aprobadaPor`, etc.).
   *
   * Ventaja sobre el update in-place: robusto contra cualquier
   * discrepancia entre el payload del evento y la realidad del back.
   * Desventaja: hace un GET extra. Para listas chicas (10-20 items)
   * es despreciable.
   *
   * Si el evento es de una bodega distinta a la del query, lo ignora
   * (no es relevante para el user).
   */
  handleEstadoCambiado(event: {
    id: string
    codigo: string
    estadoAnterior: string
    estadoNuevo: string
    bodegaId: string | null
  }) {
    if (!lastQuery) return
    // Si el evento es de otra bodega y el query filtra por una bodega
    // específica, no refrescar (no afecta a esta vista).
    if (
      event.bodegaId &&
      lastQuery.bodegaId &&
      event.bodegaId !== lastQuery.bodegaId
    ) {
      return
    }
    // Refetch silencioso. Si falla, no importa.
    void this.recargarSilencioso()
  },

  /**
   * Handler para `entrega-item.cambiado`.
   *
   * Como `entregaResumen` se deriva del estado del pedido, no podemos
   * actualizar el item in-place sin recargar el pedido entero.
   * Solución simple: marcar el pedido como "stale" para que la próxima
   * vez que el front lo abra, recargue con detalle. Por ahora no
   * recargamos la lista automáticamente — el usuario hace pull-to-refresh.
   */
  handleEntregaItemCambiado(_event: { pedidoId: string; bodegaId: string | null }) {
    // No-op por ahora (ver doc arriba). La próxima vez que el usuario
    // abra el detalle, verá los items actualizados.
  },
}

export function usePedidos() {
  return useSyncExternalStore(pedidosStore.subscribe, pedidosStore.getSnapshot, pedidosStore.getSnapshot)
}
