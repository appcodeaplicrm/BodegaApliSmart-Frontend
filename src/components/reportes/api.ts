/**
 * API client del módulo Reportes.
 *
 * Habla con los 4 endpoints del back:
 *   - GET /reportes/resumen?bodegaId&desde&hasta → KPIs + top productos
 *   - GET /reportes/entradas?bodegaId&desde&hasta → lista de entradas
 *   - GET /reportes/salidas?bodegaId&desde&hasta → lista de salidas
 *   - GET /reportes/kardex/:productoId?bodegaId&desde&hasta → trazabilidad
 *
 * Convenciones:
 *  - `desde` y `hasta` son `YYYY-MM-DD`.
 *  - `bodegaId` se toma del `bodegaActivaStore`. Si no hay bodega activa,
 *    los endpoints devuelven 400 con mensaje claro.
 */
import { apiBaseUrl } from '../../lib/apiBase'
import { bodegaActivaStore } from '../../store/bodegaActiva'

// ─── tipos compartidos ────────────────────────────────────────────────

/** Item genérico de movimiento. Lo usamos en entradas y salidas. */
export type ReporteItem = {
  id: string
  fecha: string
  tipoNombre: string
  producto: { id: string; codigo: string; nombre: string }
  cantidad: number
  cantidadBase: number
  unidad: string
  costoUnitario: number | null
  costoTotal: number | null
  usuario: string
  observacion: string | null
  bodegaOrigen?: { id: string; nombre: string } | null
  bodegaDestino?: { id: string; nombre: string } | null
  compra?: {
    id: string
    codigo: string
    numeroFactura: string | null
    proveedor: string | null
  } | null
}

/** Agregado por tipo (Compra, Entrada, etc). */
export type ReportePorTipo = {
  tipo: string
  cantidad: number
  costoTotal: number
  items: number
}

// ─── endpoints ────────────────────────────────────────────────────────

export type ResumenKpis = {
  totalEntradas: number
  totalSalidas: number
  variacionNeta: number
  valorStock: number
  totalProductosConStock: number
}

export type ResumenTopProducto = {
  id: string
  codigo: string
  nombre: string
  cantidad: number
  entradas: number
  salidas: number
}

export type ResumenTopValorizado = {
  id: string
  codigo: string
  nombre: string
  cantidad: number
  costoPromedio: number
  valorizado: number
}

export type ResumenResponse = {
  rango: { desde: string; hasta: string; bodegaId: string }
  kpis: ResumenKpis
  topProductos: ResumenTopProducto[]
  topProductosValorizados: ResumenTopValorizado[]
}

export type KardexLinea = {
  id: string
  fecha: string
  tipoNombre: string
  tipoSigno: 'E' | 'S'
  cantidad: number
  cantidadBase: number
  unidadAbreviatura: string
  esEntrada: boolean
  costoUnitario: number | null
  saldo: number
  saldoValorizado: number
  usuario: string
  observacion: string | null
  compra: {
    id: string
    codigo: string
    numeroFactura: string | null
    proveedor: string | null
  } | null
}

export type KardexResponse = {
  producto: {
    id: string
    codigo: string
    nombre: string
    unidad: string
    costoPromedioActual: number
  }
  rango: { desde: string; hasta: string; bodegaId: string }
  saldoInicial: number
  saldoInicialValorizado: number
  costoPromedioInicial: number
  lineas: KardexLinea[]
  saldoFinal: number
  saldoFinalValorizado: number
  costoPromedioFinal: number
  totalEntradas: number
  totalSalidas: number
}

export type ReporteResponse = {
  rango: { desde: string; hasta: string; bodegaId: string }
  totalItems: number
  totalCantidad: number
  totalCosto: number
  porTipo: ReportePorTipo[]
  items: ReporteItem[]
}

// ─── helpers ──────────────────────────────────────────────────────────

function qs(params: Record<string, string | number | undefined>): string {
  const usp = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v != null && v !== '') usp.set(k, String(v))
  }
  return usp.toString()
}

async function http<T>(path: string, params: Record<string, string | number | undefined>): Promise<T> {
  // El endpoint de reportes exige `bodegaId` explícito cuando el user
  // tiene varias bodegas. Lo mandamos como query param (y como header
  // `X-Bodega-Id` por compatibilidad) para que el back no rebote con
  // 400 "Tienes varias bodegas".
  const bodegaId = bodegaActivaStore.getId() ?? undefined
  const res = await fetch(`${apiBaseUrl()}${path}?${qs({ ...params, bodegaId })}`, {
    credentials: 'include',
    headers: bodegaId ? { 'X-Bodega-Id': bodegaId } : {},
  })
  if (!res.ok) {
    const txt = await res.text().catch(() => '')
    throw new Error(txt || `HTTP ${res.status} al pedir ${path}`)
  }
  return (await res.json()) as T
}

// ─── API pública ──────────────────────────────────────────────────────

export const reportesApi = {
  resumen: (desde: string, hasta: string) =>
    http<ResumenResponse>('/reportes/resumen', { desde, hasta }),

  entradas: (desde: string, hasta: string) =>
    http<ReporteResponse>('/reportes/entradas', { desde, hasta }),

  salidas: (desde: string, hasta: string) =>
    http<ReporteResponse>('/reportes/salidas', { desde, hasta }),

  kardex: (productoId: string, desde: string, hasta: string) =>
    http<KardexResponse>(`/reportes/kardex/${productoId}`, { desde, hasta }),
}

// ─── helpers de formato ──────────────────────────────────────────────

/** Formatea un número con separador de miles (es-CO). */
export function fmtNumero(n: number | null | undefined, decimales = 2): string {
  if (n == null || !Number.isFinite(n)) return '—'
  return n.toLocaleString('es-CO', {
    minimumFractionDigits: decimales,
    maximumFractionDigits: decimales,
  })
}

/** Formatea un monto en pesos colombianos. */
export function fmtMoneda(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return '—'
  return n.toLocaleString('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  })
}

/** Formatea una fecha ISO a "DD/MM/YY HH:mm" local. */
export function fmtFechaCorta(iso: string | Date): string {
  const d = typeof iso === 'string' ? new Date(iso) : iso
  if (Number.isNaN(d.getTime())) return '—'
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const yy = String(d.getFullYear()).slice(-2)
  const hh = String(d.getHours()).padStart(2, '0')
  const mn = String(d.getMinutes()).padStart(2, '0')
  return `${dd}/${mm}/${yy} ${hh}:${mn}`
}

/** Default: últimos 30 días en formato YYYY-MM-DD. */
export function defaultRango(): { desde: string; hasta: string } {
  const hoy = new Date()
  const hace30 = new Date(hoy.getTime() - 30 * 24 * 60 * 60 * 1000)
  return {
    desde: hace30.toISOString().slice(0, 10),
    hasta: hoy.toISOString().slice(0, 10),
  }
}
