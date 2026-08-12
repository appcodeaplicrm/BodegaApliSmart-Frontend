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
    // PDF: header de empresa
    empresaLogoKey?: string
    empresaNombre?: string
    empresaDepartamento?: string
    empresaFormato?: string
    // PDF: objeto
    objetoNombre?: string
    objetoLongitud?: string
    objetoTipos?: string[]
    objetoCapacidad?: string
    objetoCodigo?: string
    objetoFotoKey?: string
    /**
     * Qué plantilla de PDF se usa al imprimir. Hay 2 HTMLs
     * hardcodeados en el front:
     *   - "escaleras" → Inspección de Escaleras (ítems con SI / NO).
     *   - "epp"       → Inspección Semanal de EPP (ítems con 3 estados).
     * Default en el back: "escaleras".
     */
    htmlKind?: 'escaleras' | 'epp'
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
    // PDF: header de empresa
    empresaLogoKey?: string
    empresaNombre?: string
    empresaDepartamento?: string
    empresaFormato?: string
    // PDF: objeto
    objetoNombre?: string
    objetoLongitud?: string
    objetoTipos?: string[]
    objetoCapacidad?: string
    objetoCodigo?: string
    objetoFotoKey?: string
    /** Qué plantilla de PDF se usa al imprimir ("escaleras" | "epp"). */
    htmlKind?: 'escaleras' | 'epp'
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
    /**
     * Estado final del objeto: "operativa" | "noOperativa" | null.
     * Es el campo "ESCALERA OPERATIVA SI/NO" del PDF. Se setea cuando
     * el técnico cierra el checklist. Los demás datos del PDF
     * (logo, empresa, objeto, foto) vienen de la plantilla.
     */
    objetoOperativo?: boolean
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
    items: { itemId: string; ok: boolean | null; observacion?: string; fotoKey?: string | null }[]
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
    `/uploads?seccion=documents&bodegaId=${encodeURIComponent(bodegaId)}`,
    fd,
  )
}

// ───────── PDF ─────────

/**
 * Item de la respuesta de `pdfData`. Refleja lo que el back devuelve
 * en `GET /checklist/asignaciones/:id/pdf-data`.
 */
export type CkPdfItem = {
  id: string
  texto: string
  requerido: boolean
  ok: boolean | null
  observacion: string
}

/**
 * Un día dentro del PDF: la asignación ejecutada ese día, con sus
 * items marcados (OK/NO/observación). En el PDF, cada `dia` se
 * renderiza como una columna FECHA + par de celdas SI/NO.
 */
export type CkPdfDia = {
  /** Fecha corta DD/MM/YY del día. */
  fecha: string
  /** ID de la asignación original (útil para trazabilidad). */
  asignacionId: string
  /** Items de la plantilla con el resultado de ese día. */
  items: CkPdfItem[]
  /** Resultado global del checklist ese día. */
  resultado: 'aprobado' | 'observaciones' | 'rechazado' | null
  /** Observación general de ese día. */
  observacion: string
  /** SI/NO Escalera operativa de ese día. */
  objetoOperativo: boolean | null
}

export type CkPdfData = {
  id: string
  // Header
  empresaLogoDataUrl: string | null
  empresaNombre: string
  empresaDepartamento: string
  empresaFormato: string
  // Objeto
  objetoFotoDataUrl: string | null
  objetoNombre: string
  objetoLongitud: string
  objetoTipo: string
  /** Tipos elegidos: subset de ["III", "I", "IA", "IAA"]. */
  objetoTipos: string[]
  objetoCapacidad: string
  objetoCodigo: string
  /** Operativo colapsado: si todos los días dicen SI, es SI; si
   * alguno dice NO, es NO. Si ninguno lo setea, null. */
  objetoOperativo: boolean | null
  // Asignación
  plantillaNombre: string
  /** Persona que EJECUTÓ el checklist. Aparece en "REALIZADO POR:". */
  tecnico: string
  fecha: string
  fechaLimite: string
  resultado: 'aprobado' | 'observaciones' | 'rechazado' | null
  okCount: number
  totalItems: number
  observacion: string
  /**
   * Qué template de PDF usar. Hay 2 hardcodeados en el front:
   *   - "escaleras" → Formato de Inspección de Escaleras de Tijera
   *   - "epp"       → Formato de Inspección Semanal de EPP
   * Default: "escaleras".
   */
  htmlKind: 'escaleras' | 'epp'
  /**
   * Días a renderizar en el PDF. Por defecto tiene 1 entrada (la
   * asignación del id). Si el back recibe `?desde=&hasta=`, tiene N
   * entradas con cada día del rango.
   */
  dias: CkPdfDia[]
  // Compat: si el front viejo usa `data.items` en vez de `data.dias[0].items`,
  // exponemos un alias que apunta al primer día. Útil para no romper
  // consumidores que aún no migraron.
  items: CkPdfItem[]
}

/**
 * Devuelve los datos completos para renderizar el PDF del checklist.
 * El back mete el logo y la foto del objeto como data-URL base64
 * para que el HTML funcione sin auth headers.
 *
 * Si se pasa `desde` y `hasta` (YYYY-MM-DD), el back agrupa TODAS
 * las asignaciones del mismo (plantillaId, usuarioId) en ese rango
 * y devuelve cada día en `dias[]`. Si NO se pasa, devuelve 1 día.
 */
export const pdfData = (
  asignacionId: string,
  bodegaId?: string | null,
  opts?: { desde?: string; hasta?: string },
) => {
  const data = api.get<CkPdfData & { items?: CkPdfItem[] }>(
    `/checklist/asignaciones/${asignacionId}/pdf-data${qs({
      bodegaId,
      desde: opts?.desde,
      hasta: opts?.hasta,
    })}`,
  )
  // Helper: el back devuelve `dias[]`, y para compat también
  // exponemos `items` apuntando al primer día. Hacemos un wrapper
  // que normaliza la respuesta.
  return data.then((d) => {
    const dias = d.dias ?? []
    const items = dias[0]?.items ?? []
    return { ...d, dias, items } as CkPdfData
  })
}

// ───────── LOGO DEL TENANT ─────────
//
// 1 sola imagen por empresa, compartida por TODAS las plantillas
// del tenant. Si la plantilla tiene su propio `empresaLogoKey`,
// ese pisa al del tenant (override).
//
// Endpoints en /perfil/logo del back (cualquier user autenticado
// puede GET; solo admin/superadmin puede POST/DELETE).

export type TenantLogo = {
  key: string | null
  url: string | null
  empresaNombre: string | null
}

/**
 * GET /perfil/logo — devuelve el logo del tenant (key + url).
 * Si no hay logo, `key` y `url` son null.
 */
export const getTenantLogo = () => api.get<TenantLogo>('/perfil/logo')

/**
 * POST /perfil/logo — sube (o reemplaza) el logo del tenant.
 * multipart/form-data con campo `file`. Solo admin.
 * Devuelve el nuevo logo con su key + url.
 */
export const setTenantLogo = (file: File | Blob) => {
  const fd = new FormData()
  if (file instanceof File) {
    fd.append('file', file, file.name)
  } else {
    fd.append('file', file, `logo-${Date.now()}.png`)
  }
  return api.post<TenantLogo>('/perfil/logo', fd)
}

/**
 * DELETE /perfil/logo — elimina el logo del tenant. Solo admin.
 */
export const deleteTenantLogo = () =>
  api.delete<{ ok: true }>('/perfil/logo')
