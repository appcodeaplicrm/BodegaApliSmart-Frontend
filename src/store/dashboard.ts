import { useSyncExternalStore } from 'react'
import { api, ApiError } from '../lib/api'

/** Tipos de la respuesta del endpoint /dashboard/resumen (ver DashboardService del back) */
export type DashboardResumen = {
  bodega: {
    id: string
    nombre: string
    direccion: string | null
  }
  rango: {
    desde: string
    hasta: string
  }
  kpis: {
    totalProductos: number
    stockTotal: number
    valorInventario: number
    stockBajo: number
    ordenesPendientes: number
    movimientosHoy: number
    entradasHoy: number
    salidasHoy: number
  }
  topProductos: Array<{
    id: string
    nombre: string
    codigo: string
    cantidad: number
    movimientos: number
  }>
  ultimosMovimientos: Array<{
    id: string
    tipo: string // ID del TipoMovimiento
    producto: string
    codigo: string
    cantidad: number
    cantidadBase: number
    usuario: string
    hora: string
    createdAt: string
  }>
  alertasStock: Array<{
    id: string
    producto: string
    codigo: string
    stock: number
    minimo: number
    nivel: 'Advertencia' | 'Critica'
  }>
  ordenesPorEstado: Record<string, number>
  actividadPorDia: Array<{
    fecha: string
    entradas: number
    salidas: number
  }>
  /** Stock agrupado por unidad de medida (no se suman entre unidades). */
  stockPorUnidad: Array<{
    unidad: string
    abreviatura: string
    total: number
    productos: number
  }>
}

type Estado =
  | { status: 'idle' }
  | { status: 'cargando'; bodegaId: string | null }
  | { status: 'listo'; resumen: DashboardResumen; bodegaId: string }
  | { status: 'error'; mensaje: string; bodegaId: string | null }

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
    if (cacheSnapshot.bodegaId !== e.bodegaId || cacheSnapshot.resumen !== e.resumen) {
      cacheSnapshot = e
      return cacheSnapshot
    }
  } else if (e.status === 'error' && cacheSnapshot.status === 'error') {
    if (cacheSnapshot.bodegaId !== e.bodegaId || cacheSnapshot.mensaje !== e.mensaje) {
      cacheSnapshot = e
      return cacheSnapshot
    }
  } else if (e.status === 'cargando' && cacheSnapshot.status === 'cargando') {
    if (cacheSnapshot.bodegaId !== e.bodegaId) {
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

export const dashboardStore = {
  subscribe,
  getSnapshot,

  async cargar(bodegaId: string): Promise<DashboardResumen> {
    if (estado.status === 'listo' && estado.bodegaId === bodegaId) {
      return estado.resumen
    }
    setEstado({ status: 'cargando', bodegaId })
    try {
      const resumen = await api.get<DashboardResumen>(
        `/dashboard/resumen?bodegaId=${encodeURIComponent(bodegaId)}`,
      )
      setEstado({ status: 'listo', resumen, bodegaId })
      return resumen
    } catch (err) {
      const mensaje =
        err instanceof ApiError ? err.message : 'No se pudo cargar el resumen del dashboard.'
      setEstado({ status: 'error', mensaje, bodegaId })
      throw err
    }
  },

  reset() {
    setEstado({ status: 'idle' })
  },
}

export function useDashboard() {
  return useSyncExternalStore(
    dashboardStore.subscribe,
    dashboardStore.getSnapshot,
    dashboardStore.getSnapshot,
  )
}
