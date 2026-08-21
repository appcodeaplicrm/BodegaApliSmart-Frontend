/**
 * API client del submódulo Proyectos.
 *
 * Pasa por el cliente central `api` (cookies httpOnly + refresh
 * automático). Tipos de retorno en `./types.ts`.
 *
 * Endpoints (todos bajo `/proyectos`):
 *  - GET    /proyectos
 *  - GET    /proyectos/estados
 *  - GET    /proyectos/roles
 *  - GET    /proyectos/usuarios-para-asignar?rolIds=...&bodegaId=...
 *  - GET    /proyectos/:id
 *  - POST   /proyectos
 *  - PATCH  /proyectos/:id
 *  - PATCH  /proyectos/:id/estado
 *  - POST   /proyectos/:id/tecnicos
 *  - DELETE /proyectos/:id
 */
import { api } from '../../lib/api'
import type {
  ProyectoDetalle,
  ProyectoEstado,
  ProyectoListItem,
  ProyectoRol,
  ProyectoUsuarioAsignable,
  CrearProyectoInput,
  EditarProyectoInput,
  AsignarTecnicosInput,
  ListProyectosQuery,
  ProyectoProductoInicial,
  ProductoDelProyecto,
  AsignarProductosInicialesInput,
  SolicitudListItem,
  SolicitudDetalle,
  CrearSolicitudInput,
  AprobarSolicitudInput,
  EntregarSolicitudInput,
  RechazarSolicitudInput,
  ListSolicitudesQuery,
  AvanceListItem,
  AvanceDetalle,
  CrearAvanceInput,
  ListAvancesQuery,
  ProyectoNodo,
  CreateProyectoNodoInput,
  UpdateProyectoNodoInput,
} from './types'

/** Shape de respuesta estándar para listados paginados. */
type PageResult<T> = {
  data: T[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

function qs(params: Record<string, string | number | null | undefined>): string {
  const usp = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v != null && v !== '') usp.set(k, String(v))
  }
  const s = usp.toString()
  return s ? `?${s}` : ''
}

export const listarProyectos = (query: ListProyectosQuery) =>
  api.get<PageResult<ProyectoListItem>>(`/proyectos${qs(query)}`)

export const listarEstados = () =>
  api.get<ProyectoEstado[]>('/proyectos/estados')

export const listarRoles = () => api.get<ProyectoRol[]>('/proyectos/roles')

export const listarUsuariosParaAsignar = (params: {
  rolIds: string[]
  bodegaId: string | null
  excluirProyectoId?: string | null
}) =>
  api.get<ProyectoUsuarioAsignable[]>(
    `/proyectos/usuarios-para-asignar${qs({
      rolIds: params.rolIds.join(','),
      bodegaId: params.bodegaId,
      excluirProyectoId: params.excluirProyectoId,
    })}`,
  )

export const obtenerProyecto = (id: string) =>
  api.get<ProyectoDetalle>(`/proyectos/${encodeURIComponent(id)}`)

export const crearProyecto = (input: CrearProyectoInput) =>
  api.post<ProyectoDetalle>('/proyectos', input)

export const editarProyecto = (id: string, input: EditarProyectoInput) =>
  api.patch<ProyectoDetalle>(`/proyectos/${encodeURIComponent(id)}`, input)

export const cambiarEstado = (
  id: string,
  estadoId: string,
  motivo?: string,
) =>
  api.patch<ProyectoDetalle>(
    `/proyectos/${encodeURIComponent(id)}/estado`,
    { estadoId, motivo },
  )

export const asignarTecnicos = (
  id: string,
  input: AsignarTecnicosInput,
) =>
  api.post<ProyectoDetalle>(
    `/proyectos/${encodeURIComponent(id)}/tecnicos`,
    input,
  )

// ───────── Productos iniciales ─────────

export const listarProductosIniciales = (proyectoId: string) =>
  api.get<ProyectoProductoInicial[]>(
    `/proyectos/${encodeURIComponent(proyectoId)}/productos-iniciales`,
  )

/**
 * Vista unificada para la tab "Productos" del detalle: mezcla la
 * dotación inicial con los productos que llegaron vía solicitudes
 * a bodega entregadas. Cada ENTREGA es una row, con `origen` para
 * distinguir.
 */
export const listarProductosDelProyecto = (proyectoId: string) =>
  api.get<ProductoDelProyecto[]>(
    `/proyectos/${encodeURIComponent(proyectoId)}/productos`,
  )

export const asignarProductosIniciales = (
  proyectoId: string,
  input: AsignarProductosInicialesInput,
) =>
  api.post<ProyectoProductoInicial[]>(
    `/proyectos/${encodeURIComponent(proyectoId)}/productos-iniciales`,
    input,
  )

export const eliminarProductoInicial = (
  proyectoId: string,
  itemId: string,
) =>
  api.delete<ProyectoProductoInicial[]>(
    `/proyectos/${encodeURIComponent(proyectoId)}/productos-iniciales/${encodeURIComponent(itemId)}`,
  )

// ───────── Solicitudes a bodega ─────────

export const listarSolicitudes = (query: ListSolicitudesQuery) =>
  api.get<PageResult<SolicitudListItem>>(`/solicitudes-bodega${qs(query)}`)

export const listarSolicitudesDelProyecto = (
  proyectoId: string,
  query: { page: number; pageSize: number },
) =>
  api.get<PageResult<SolicitudListItem>>(
    `/proyectos/${encodeURIComponent(proyectoId)}/solicitudes-bodega${qs(query)}`,
  )

export const obtenerSolicitud = (id: string) =>
  api.get<SolicitudDetalle>(`/solicitudes-bodega/${encodeURIComponent(id)}`)

export const crearSolicitud = (
  proyectoId: string,
  input: CrearSolicitudInput,
) =>
  api.post<SolicitudDetalle>(
    `/proyectos/${encodeURIComponent(proyectoId)}/solicitudes-bodega`,
    input,
  )

export const aprobarSolicitud = (id: string, input: AprobarSolicitudInput) =>
  api.patch<SolicitudDetalle>(
    `/solicitudes-bodega/${encodeURIComponent(id)}/aprobar`,
    input,
  )

export const rechazarSolicitud = (id: string, input: RechazarSolicitudInput) =>
  api.patch<SolicitudDetalle>(
    `/solicitudes-bodega/${encodeURIComponent(id)}/rechazar`,
    input,
  )

export const entregarSolicitud = (id: string, input: EntregarSolicitudInput) =>
  api.patch<SolicitudDetalle>(
    `/solicitudes-bodega/${encodeURIComponent(id)}/entregar`,
    input,
  )

// ───────── Avances ─────────

export const listarAvances = (query: ListAvancesQuery) =>
  api.get<PageResult<AvanceListItem>>(
    `/proyectos/${encodeURIComponent(query.proyectoId)}/avances${qs({ page: query.page, pageSize: query.pageSize })}`,
  )

export const obtenerAvance = (id: string) =>
  api.get<AvanceDetalle>(`/avances/${encodeURIComponent(id)}`)

export const crearAvance = (proyectoId: string, input: CrearAvanceInput) =>
  api.post<AvanceDetalle>(
    `/proyectos/${encodeURIComponent(proyectoId)}/avances`,
    input,
  )

export const eliminarAvance = (id: string) =>
  api.delete<{ ok: boolean }>(`/avances/${encodeURIComponent(id)}`)

// ───────── Upload de fotos de avance ─────────
// Reusamos el endpoint genérico `/uploads?seccion=proyectos&bodegaId=...`.
// El back devuelve { key, url, mimeType, sizeBytes, nombre }.

export type UploadFileResult = {
  url: string
  key: string
  mimeType: string
  sizeBytes: number
  nombre: string
}

export async function subirFotoAvance(
  file: File,
  bodegaId: string,
): Promise<UploadFileResult> {
  const fd = new FormData()
  fd.append('file', file)
  return api.post<UploadFileResult>(
    `/uploads?seccion=proyectos&bodegaId=${encodeURIComponent(bodegaId)}`,
    fd,
  )
}

// ───────── Nodos del recorrido (mapa) ─────────

export const listarNodos = (proyectoId: string) =>
  api.get<ProyectoNodo[]>(
    `/proyectos/${encodeURIComponent(proyectoId)}/nodos`,
  )

export const crearNodo = (
  proyectoId: string,
  input: CreateProyectoNodoInput,
) =>
  api.post<ProyectoNodo>(
    `/proyectos/${encodeURIComponent(proyectoId)}/nodos`,
    input,
  )

export const actualizarNodo = (
  proyectoId: string,
  nodoId: string,
  input: UpdateProyectoNodoInput,
) =>
  api.patch<ProyectoNodo>(
    `/proyectos/${encodeURIComponent(proyectoId)}/nodos/${encodeURIComponent(nodoId)}`,
    input,
  )

export const eliminarNodo = (proyectoId: string, nodoId: string) =>
  api.delete<{ ok: boolean }>(
    `/proyectos/${encodeURIComponent(proyectoId)}/nodos/${encodeURIComponent(nodoId)}`,
  )

/**
 * Planifica el recorrido del proyecto en el mapa. El back llama a
 * OSRM para resolver la ruta por calles reales entre `inicio` y
 * `fin` (pasando por los `waypoints` opcionales), y genera nodos
 * cada `distanciaPorNodoKm` km a lo largo de la ruta.
 *
 * Reemplaza los nodos previos del proyecto y (por default)
 * sobrescribe `Proyecto.kmATrabajar` con la distancia total de
 * la ruta.
 */
export type WaypointInput = { latitud: number; longitud: number }

export type PlanificarRutaInput = {
  inicio: WaypointInput
  waypoints?: WaypointInput[]
  fin: WaypointInput
  distanciaPorNodoKm?: number
  sobrescribirKmATrabajar?: boolean
  nombreBase?: string
  /**
   * Si es true, el back NO persiste nada ni borra nodos previos:
   * solo calcula y devuelve los nodos que se crearían. Útil para
   * el form de crear proyecto (donde el proyecto todavía no
   * existe en la DB).
   */
  preview?: boolean
}

export type PlanificarRutaResultado = {
  cantidadNodos: number
  kmATrabajar: number
  kmTotalRuta: number
  kmTotalHaversine: number
  nodos: Array<{
    id: string
    orden: number
    latitud: number
    longitud: number
    tipo: 'inicio' | 'intermedio' | 'fin'
    kmAcumulado: number
    nombre: string
  }>
}

export const planificarRuta = (
  proyectoId: string,
  input: PlanificarRutaInput,
) =>
  api.post<PlanificarRutaResultado>(
    proyectoId
      ? `/proyectos/${encodeURIComponent(proyectoId)}/ruta/planificar`
      : `/proyectos/ruta/planificar-preview`,
    input,
  )

// ───────── Productos del catálogo (para los forms de avance / productos / solicitudes) ─────────

/** Trae el listado plano de productos del catálogo de la bodega. */
export async function listarProductos(bodegaId: string): Promise<ProductoCatalogoT[]> {
  const result = await api.get<{
    data: Array<
      ProductoCatalogoT & {
        // El back devuelve `stocks: StockPorBodega[]` (un stock por
        // ubicación dentro de la bodega). Acá los recibimos "crudos"
        // para sumar las cantidades en el front.
        stocks?: Array<{ cantidad: number | string }>
      }
    >
  }>(
    `/productos?bodegaId=${encodeURIComponent(bodegaId)}&pageSize=100`,
  )
  const list = result.data ?? []
  // Mapeo: el back devuelve `stocks: []` con un row por ubicación;
  // sumamos todas las cantidades para obtener el stock TOTAL de la
  // bodega para ese producto. Antes de este fix el front esperaba
  // `stockBodega: number` pero el back no lo seteaba, y se mostraba
  // siempre 0 en los forms de productos.
  return list.map((p) => {
    const stockTotal = (p.stocks ?? []).reduce(
      (acc, s) => acc + Number(s.cantidad ?? 0),
      0,
    )
    return {
      id: p.id,
      codigo: p.codigo,
      nombre: p.nombre,
      costoPromedio: p.costoPromedio,
      stockBodega: stockTotal,
      unidadMedida: p.unidadMedida,
    }
  })
}

/** Shape mínimo que esperan los modales del proyecto. */
export type ProductoCatalogoT = {
  id: string
  codigo: string
  nombre: string
  costoPromedio?: number | string | null
  stockBodega?: number | string | null
  unidadMedida?: { id: string; abreviatura: string } | null
}
