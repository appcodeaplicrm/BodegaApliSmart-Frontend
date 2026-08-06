/**
 * API client del módulo Checklist.
 *
 * Todas las llamadas pasan por el cliente central `api` (cookies
 * httpOnly + refresh automático). Los tipos de retorno viven en
 * `./types.ts` y matchean la respuesta del back.
 *
 * Scope multi-bodega:
 *  - El `bodegaId` se manda en QUERY (GET) o en BODY (POST/PATCH).
 *  - Si NO se pasa, el back lo resuelve del JWT (solo si el user
 *    tiene una sola bodega). Si tiene varias, el back devuelve 400.
 *  - En el front, SIEMPRE pasamos el `bodegaId` activo para ser
 *    explícitos y evitar errores 400 innecesarios.
 */
import { api } from '../../lib/api'
import type {
  CkAsignacionDetalle,
  CkAsignado,
  CkHistorialItem,
  CkRol,
  Plantilla,
  PlantillaListItem,
  Usuario,
} from './types'

/** Convierte un objeto plano a query string. Ignora null/undefined. */
function qs(params: Record<string, string | null | undefined>): string {
  const usp = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v != null && v !== '') usp.set(k, v)
  }
  const s = usp.toString()
  return s ? `?${s}` : ''
}

// ───────── Plantillas ─────────

export const listarPlantillas = (bodegaId?: string | null) =>
  api.get<PlantillaListItem[]>(`/checklist/plantillas${qs({ bodegaId })}`)

export const obtenerPlantilla = (id: string, bodegaId?: string | null) =>
  api.get<Plantilla>(`/checklist/plantillas/${id}${qs({ bodegaId })}`)

export const crearPlantilla = (
  input: {
    nombre: string
    descripcion?: string
    rolId: string
    activa?: boolean
    items: { texto: string; requerido?: boolean }[]
    bodegaId?: string
    /** HH:mm (24h). Hora del día sugerida para ejecutar este checklist. */
    horaSugerida?: string
  },
) => api.post<Plantilla>('/checklist/plantillas', input)

export const actualizarPlantilla = (
  id: string,
  input: {
    nombre?: string
    descripcion?: string
    rolId?: string
    activa?: boolean
    items?: { id?: string; texto: string; requerido?: boolean }[]
    horaSugerida?: string
  },
  bodegaId?: string | null,
) =>
  api.patch<Plantilla>(`/checklist/plantillas/${id}${qs({ bodegaId })}`, input)

export const togglePlantilla = (id: string, bodegaId?: string | null) =>
  api.patch<{ id: string; activa: boolean; bodegaId: string }>(
    `/checklist/plantillas/${id}/toggle${qs({ bodegaId })}`,
  )

export const eliminarPlantilla = (id: string, bodegaId?: string | null) =>
  api.delete<{ ok: true }>(`/checklist/plantillas/${id}${qs({ bodegaId })}`)

// ───────── Auxiliares (roles / usuarios por rol) ─────────

export const listarRoles = (bodegaId?: string | null) =>
  api.get<CkRol[]>(`/checklist/roles${qs({ bodegaId })}`)

export const usuariosPorRol = (rolId: string, bodegaId?: string | null) =>
  api.get<Usuario[]>(`/checklist/usuarios-por-rol/${rolId}${qs({ bodegaId })}`)

// ───────── Agendar / Asignaciones / Historial ─────────

export const agendar = (
  input: {
    plantillaId: string
    rolId?: string
    bodegaId?: string
    fecha: string
    horaLimite: string
  },
) =>
  api.post<{ ok: true; creadas: number; omitidas: number; mensaje: string }>(
    '/checklist/agendar',
    input,
  )

export const listarAsignaciones = (bodegaId?: string | null) =>
  api.get<CkAsignado[]>(`/checklist/asignaciones${qs({ bodegaId })}`)

/**
 * Lista asignaciones dentro de un rango de fechas (vista calendario).
 * `desde` y `hasta` son `YYYY-MM-DD` (inclusivo).
 */
export const listarAsignacionesRango = (
  desde: string,
  hasta: string,
  bodegaId?: string | null,
) =>
  api.get<CkAsignado[]>(
    `/checklist/asignaciones/rango${qs({ desde, hasta, bodegaId })}`,
  )

export const obtenerAsignacion = (id: string, bodegaId?: string | null) =>
  api.get<CkAsignacionDetalle>(`/checklist/asignaciones/${id}${qs({ bodegaId })}`)

/**
 * Ejecuta (parcial o totalmente) un checklist.
 * Si el front marca TODOS los ítems, el back cierra la asignación
 * y calcula el resultado final (aprobado/observaciones/rechazado).
 * Si marca solo algunos, queda como "guardado parcial" y puede
 * seguir editando después.
 */
export const ejecutarChecklist = (
  id: string,
  input: {
    items: { itemId: string; ok: boolean; observacion?: string; fotoKey?: string | null }[]
    observacionGeneral?: string
  },
  bodegaId?: string | null,
) =>
  api.patch<CkAsignacionDetalle>(
    `/checklist/asignaciones/${id}/ejecutar${qs({ bodegaId })}`,
    input,
  )

export const historial = (bodegaId?: string | null, fecha?: string | null) =>
  api.get<CkHistorialItem[]>(`/checklist/historial${qs({ bodegaId, fecha })}`)

// ───────── Uploads (fotos de evidencia) ─────────

/**
 * Sube una foto de evidencia al storage multi-tenant del back.
 * Devuelve la `key` que después pasamos en el `ejecutarChecklist`.
 *
 * Acepta tanto un `File` (input file) como un `Blob` (de un canvas
 * al capturar con `getUserMedia`). Internamente los serializa como
 * `FormData` con el campo `file`.
 */
type UploadResult = { url: string; key: string; mimeType: string; sizeBytes: number; nombre: string }

export async function subirFoto(
  file: File | Blob,
  bodegaId: string,
  /** Nombre sugerido para el archivo. Opcional; el back genera uno. */
  nombre?: string,
): Promise<UploadResult> {
  const fd = new FormData()
  // El back espera un campo `file`. Si es un Blob sin nombre, le
  // ponemos uno por defecto para que multer no se queje.
  if (file instanceof File) {
    fd.append('file', file, file.name)
  } else {
    fd.append('file', file, nombre ?? `checklist-${Date.now()}.jpg`)
  }
  return api.post<UploadResult>(
    `/uploads?seccion=checklist&bodegaId=${encodeURIComponent(bodegaId)}`,
    fd,
  )
}
