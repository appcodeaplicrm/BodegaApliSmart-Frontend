import { api, ApiError } from '../lib/api'

/**
 * Store de Compras (Sprint 4).
 *
 * Una Compra agrupa N MovimientosInventario bajo un mismo código
 * (`C-2026-0001`), con metadatos extra: proveedor, número de
 * factura, observación, y 1 foto de evidencia por item + N fotos
 * de la factura. El back la expone en `GET /compras/:id`.
 *
 * El modal de detalle de la pantalla Movimientos consume este
 * store. NO listamos ni creamos desde acá (la lista la trae el
 * endpoint de movimientos, y la creación la hace el form de
 * CompraForm).
 */

export type CompraDetalle = {
  id: string
  codigo: string
  bodegaId: string
  adminId: string
  proveedorId: string | null
  numeroFactura: string | null
  observacion: string | null
  total: number | string
  createdAt: string
  updatedAt: string
  usuarioId: string
  items: Array<{
    id: string
    productoId: string
    cantidad: number | string
    cantidadBase: number | string
    unidadMedidaId: string
    precioUnitario: number | string | null
    foto: {
      id: string
      url: string
      key: string | null
      mimeType: string
      sizeBytes: number
    } | null
    producto: {
      id: string
      nombre: string
      codigo: string
      unidadMedida: { id: string; abreviatura: string }
    }
  }>
  facturaFotos: Array<{
    id: string
    url: string
    key: string | null
    mimeType: string
    sizeBytes: number
    orden: number
  }>
  proveedor: { id: string; nombre: string; ruc: string | null } | null
  usuario: { id: string; nombre: string }
  bodega: { id: string; nombre: string }
  movimientos: Array<{
    id: string
    productoId: string
    cantidad: number | string
    cantidadBase: number | string
    stockAnterior: number | string
    stockNuevo: number | string
    fecha: string
  }>
}

export const comprasStore = {
  /**
   * Devuelve el detalle completo de una Compra (items, fotos,
   * factura, movimientos). Usado por el modal de detalle.
   */
  async obtener(id: string): Promise<CompraDetalle> {
    try {
      return await api.get<CompraDetalle>(`/compras/${encodeURIComponent(id)}`)
    } catch (err) {
      if (err instanceof ApiError) throw err
      throw new Error(err instanceof Error ? err.message : 'No se pudo cargar la compra.')
    }
  },
}
