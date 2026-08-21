import { useSyncExternalStore } from 'react'
import { api, ApiError } from '../lib/api'

/* ─── Tipos ───────────────────────────────────── */

export type UnidadMedida = {
  id: string
  nombre: string
  abreviatura: string
  permiteDecimales: boolean
  activo: boolean
}

export type StockPorBodega = {
  id: string
  cantidad: number
  bodegaId: string
  ubicacion: { id: string; nombre: string } | null
}

export type DocumentoProducto = {
  id: string
  tipo: 'FichaTecnica' | 'Certificacion' | 'Foto' | 'Manual' | 'Otro'
  nombre: string
  url: string
  /** Key relativa en `uploads/` (campo nuevo del back, Sprint 1). */
  key?: string | null
  /** URL pública armada por el back (campo virtual). */
  imageUrl?: string | null
  mimeType: string
  sizeBytes: number
  createdAt: string
}

export type ConversionUnidad = {
  id: string
  factorConversion: number
  unidadOrigen: { id: string; nombre: string; abreviatura: string }
  unidadDestino: { id: string; nombre: string; abreviatura: string }
}

export type ProductoListItem = {
  id: string
  codigo: string
  nombre: string
  descripcion: string | null
  precio: number
  stockMinimo: number
  stockMaximo: number | null
  activo: boolean
  // Sprint 3 — Política de devolución (sección 21 del .md).
  // TRUE → el técnico debe devolver el producto después de su uso.
  // FALSE → producto consumible o no retornable.
  admiteDevolucion: boolean
  categoria: { id: string; nombre: string }
  marca: { id: string; nombre: string } | null
  unidadMedida: { id: string; nombre: string; abreviatura: string; permiteDecimales: boolean }
  stocks: StockPorBodega[]
  proveedorIds?: string[]
  _count: { documentos: number; conversiones: number; proveedores: number }
  /** URL de la foto principal del producto (miniatura del listado). */
  fotoUrl?: string | null
  /** Key de la foto principal (multi-tenant). */
  fotoKey?: string | null
}

export type Producto = ProductoListItem & {
  bodega: { id: string; nombre: string } | null
  documentos: DocumentoProducto[]
  conversiones: ConversionUnidad[]
  proveedores: Array<{
    proveedor: { id: string; nombre: string; ruc: string | null }
    precioCompra: number
  }>
}

export type CreateProductoInput = {
  codigo: string
  nombre: string
  descripcion?: string
  precio?: number
  stockMinimo?: number
  stockMaximo?: number
  admiteDevolucion?: boolean
  categoriaNombre: string
  marcaId?: string
  unidadMedidaId: string
  bodegaId?: string
  ubicacionId?: string
  activo?: boolean
  stockInicial?: number
  stockInicialUnidadId?: string
  proveedores?: Array<{ proveedorId: string; precioCompra?: number }>
}

export type UpdateProductoInput = {
  codigo?: string
  nombre?: string
  descripcion?: string
  precio?: number
  stockMinimo?: number
  stockMaximo?: number
  admiteDevolucion?: boolean
  categoriaNombre?: string
  marcaId?: string
  unidadMedidaId?: string
  bodegaId?: string
  activo?: boolean
  stockCantidad?: number
  stockUbicacionId?: string
}

export type UploadResult = {
  /** URL pública legacy (`/uploads/...`). Compat con front viejo. */
  url: string
  /** Key multi-tenant (`{adminId}/bodegas/{warehouseId}/...`). La nueva fuente de verdad. */
  key: string
  mimeType: string
  sizeBytes: number
  nombre: string
}

/** Filtros y paginación para `cargarPaginado`. */
export type ProductosQuery = {
  bodegaId?: string
  buscar?: string
  categoriaId?: string
  marcaId?: string
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

/* ─── Store ───────────────────────────────────── */

type Estado =
  | { status: 'idle' }
  | { status: 'cargando' }
  | {
      status: 'listo'
      productos: ProductoListItem[]
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
 * los handlers realtime puedan hacer un refetch silencioso.
 */
let lastQuery: ProductosQuery | null = null
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
      cacheSnapshot.productos !== e.productos ||
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

export const productosStore = {
  subscribe,
  getSnapshot,

  /**
   * Carga una página de productos con filtros opcionales.
   * Devuelve la `PageResult<ProductoListItem>` para que el front
   * pueda mostrar "Mostrando X-Y de Z" y los botones de paginación.
   */
  async cargarPaginado(query: ProductosQuery): Promise<PageResult<ProductoListItem>> {
    lastQuery = query
    setEstado({ status: 'cargando' })
    try {
      const result = await this.fetchPaginado(query)
      setEstado({
        status: 'listo',
        productos: result.data,
        total: result.total,
        page: result.page,
        pageSize: result.pageSize,
        totalPages: result.totalPages,
      })
      return result
    } catch (err) {
      const mensaje = err instanceof ApiError ? err.message : 'No se pudieron cargar los productos.'
      setEstado({ status: 'error', mensaje })
      throw err
    }
  },

  /**
   * Refetch silencioso: igual a `cargarPaginado` pero NO cambia el
   * status a 'cargando' (la lista sigue mostrándose, no parpadea).
   * Usado por los handlers realtime para re-sincronizar después de
   * un cambio (ej: stock de un producto cambió por un movimiento).
   */
  async recargarSilencioso(): Promise<void> {
    if (!lastQuery) return
    try {
      const result = await this.fetchPaginado(lastQuery)
      if (estado.status === 'listo') {
        setEstado({
          status: 'listo',
          productos: result.data,
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
  async fetchPaginado(query: ProductosQuery): Promise<PageResult<ProductoListItem>> {
    const params = new URLSearchParams()
    if (query.bodegaId) params.set('bodegaId', query.bodegaId)
    if (query.buscar) params.set('buscar', query.buscar)
    if (query.categoriaId) params.set('categoriaId', query.categoriaId)
    if (query.marcaId) params.set('marcaId', query.marcaId)
    params.set('page', String(query.page))
    params.set('pageSize', String(query.pageSize))
    return api.get<PageResult<ProductoListItem>>(`/productos?${params.toString()}`)
  },

  async findOne(id: string): Promise<Producto> {
    return api.get<Producto>(`/productos/${encodeURIComponent(id)}`)
  },

  async crear(input: CreateProductoInput): Promise<Producto> {
    // La mutación local del array no tiene sentido con paginación: la vista
    // hace refetch de la página actual después de crear/editar/eliminar.
    return api.post<Producto>('/productos', input)
  },

  async actualizar(id: string, input: UpdateProductoInput): Promise<Producto> {
    return api.patch<Producto>(`/productos/${encodeURIComponent(id)}`, input)
  },

  async eliminar(id: string): Promise<void> {
    await api.delete<void>(`/productos/${encodeURIComponent(id)}`)
  },

  async listarConversiones(productoId: string): Promise<ConversionUnidad[]> {
    return api.get<ConversionUnidad[]>(
      `/productos/${encodeURIComponent(productoId)}/conversiones`,
    )
  },

  async crearConversion(
    productoId: string,
    input: { unidadOrigenId: string; unidadDestinoId: string; factorConversion: number },
  ): Promise<ConversionUnidad> {
    return api.post<ConversionUnidad>(
      `/productos/${encodeURIComponent(productoId)}/conversiones`,
      input,
    )
  },

  async eliminarConversion(productoId: string, conversionId: string): Promise<void> {
    await api.delete<void>(
      `/productos/${encodeURIComponent(productoId)}/conversiones/${encodeURIComponent(conversionId)}`,
    )
  },

  reset() {
    setEstado({ status: 'idle' })
  },

  /**
   * Handler para el evento realtime `movimiento.created`.
   *
   * Estrategia: refetch silencioso del back con el último query. Esto
   * actualiza la lista con la nueva cantidad de stock del producto
   * afectado (vino en el payload pero el back lo recalcula todo en el
   * `GET /productos?bodegaId=X`).
   *
   * Si el evento es de una bodega distinta a la del query, ignora.
   */
  async handleMovimientoCreado(event: {
    bodegaId: string | null
  }) {
    if (!lastQuery) return
    // Si el evento es de otra bodega y el query filtra por una bodega
    // específica, no refrescar.
    if (
      event.bodegaId &&
      lastQuery.bodegaId &&
      event.bodegaId !== lastQuery.bodegaId
    ) {
      return
    }
    await this.recargarSilencioso()
  },

  /**
   * Handler para los eventos realtime `producto.creado`,
   * `producto.actualizado` y `producto.eliminado`.
   *
   * Estrategia: refetch silencioso del back con el último query. Si
   * el evento es de la bodega que está mirando el usuario, la lista
   * se re-sincroniza. Si es de otra, ignora.
   */
  async handleProductoCambiado(event: { bodegaId: string | null }) {
    if (!lastQuery) return
    if (
      event.bodegaId &&
      lastQuery.bodegaId &&
      event.bodegaId !== lastQuery.bodegaId
    ) {
      return
    }
    await this.recargarSilencioso()
  },
}

export function useProductos() {
  return useSyncExternalStore(productosStore.subscribe, productosStore.getSnapshot, productosStore.getSnapshot)
}

/* ─── Uploads (servicio aparte) ───────────────── */

/**
 * Secciones del StorageService. El front las usa para indicar
 * al back DÓNDE guardar el archivo (multi-tenant).
 */
export type UploadSeccion = 'products' | 'dispatches' | 'returns' | 'documents' | 'proyectos'

export type UploadOptions = {
  seccion: UploadSeccion
  bodegaId: string
}

export const uploadsService = {
  /**
   * Sube un File (input file) con scope multi-tenant.
   * El back devuelve la `key` completa (`{adminId}/bodegas/{warehouseId}/seccion/...`).
   */
  async subir(file: File, opts: UploadOptions): Promise<UploadResult> {
    const fd = new FormData()
    fd.append('file', file)
    return api.post<UploadResult>(
      `/uploads?seccion=${encodeURIComponent(opts.seccion)}&bodegaId=${encodeURIComponent(opts.bodegaId)}`,
      fd,
    )
  },

  /**
   * Sube un FormData ya armado (lo usa el Wizard de aprobación, donde
   * el Blob viene de un canvas o un input file, no de un File directo).
   * El back devuelve la `key` completa.
   */
  async subirBlob(fd: FormData, opts: UploadOptions): Promise<UploadResult> {
    return api.post<UploadResult>(
      `/uploads?seccion=${encodeURIComponent(opts.seccion)}&bodegaId=${encodeURIComponent(opts.bodegaId)}`,
      fd,
    )
  },

  async agregarDocumento(
    productoId: string,
    input: {
      tipo: 'FichaTecnica' | 'Certificacion' | 'Foto' | 'Manual' | 'Otro'
      nombre: string
      url: string
      /** Key multi-tenant opcional. Si está, el back la prioriza sobre `url`. */
      key?: string
      mimeType: string
      sizeBytes: number
    },
  ): Promise<DocumentoProducto> {
    return api.post<DocumentoProducto>(
      `/productos/${encodeURIComponent(productoId)}/documentos`,
      input,
    )
  },

  async eliminarDocumento(productoId: string, documentoId: string): Promise<void> {
    await api.delete<void>(
      `/productos/${encodeURIComponent(productoId)}/documentos/${encodeURIComponent(documentoId)}`,
    )
  },
}

export const catalogosService = {
  /** Lista las categorías de la bodega indicada. */
  async categorias(bodegaId: string): Promise<Array<{ id: string; nombre: string }>> {
    if (!bodegaId) return []
    return api.get<Array<{ id: string; nombre: string }>>(
      `/categorias?bodegaId=${encodeURIComponent(bodegaId)}`,
    )
  },
  /** Crea una categoría atada a la bodega indicada. */
  async crearCategoria(input: { nombre: string; bodegaId: string }): Promise<{ id: string; nombre: string }> {
    return api.post<{ id: string; nombre: string }>('/categorias', input)
  },
  async proveedores(bodegaId: string): Promise<
    Array<{ id: string; nombre: string; ruc: string | null; telefono: string | null }>
  > {
    if (!bodegaId) return []
    return api.get(`/proveedores?bodegaId=${encodeURIComponent(bodegaId)}`)
  },
  async crearProveedor(input: {
    nombre: string
    ruc?: string
    telefono?: string
    bodegaId: string
  }): Promise<{ id: string; nombre: string }> {
    return api.post('/proveedores', input)
  },
}

/* ─── Compat: exports legacy (lo que aún importan los modales de Orden) ─ */

export const PRODUCTOS: Array<{ value: string; label: string }> = [
  { value: 'legacy-1', label: 'Cinta aislante 20m' },
  { value: 'legacy-2', label: 'Tornillo M8 x 40 mm' },
  { value: 'legacy-3', label: 'Tuerca hexagonal M8' },
  { value: 'legacy-4', label: 'Cable UTP Cat 6' },
  { value: 'legacy-5', label: 'Guantes dieléctricos' },
  { value: 'legacy-6', label: 'Fusible 10A' },
]

export function getProductoLabel(id: string): string {
  return PRODUCTOS.find((p) => p.value === id)?.label ?? id
}
