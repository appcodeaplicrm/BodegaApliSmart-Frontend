/**
 * Tipos del módulo Checklist de Instrumentos.
 *
 * Reflejan 1:1 la respuesta del back (`/checklist/*`). Mantenemos los
 * nombres del .md de guidelines para que el front no se sorprenda
 * cuando se enchufe con la API real.
 */

export type CkItem = {
  id: string
  texto: string
  requerido: boolean
}

export type CkRol = {
  id: string
  key: string
  nombre: string
  esSistema?: boolean
  /** Solo presente en la respuesta de listarRoles. Útil para mostrar
   * el preview "N destinatarios" sin un fetch extra. */
  usuariosCount?: number
}

export type Plantilla = {
  id: string
  nombre: string
  descripcion: string
  rol: CkRol
  activa: boolean
  /** Hora del día sugerida para ejecutar este checklist (ISO 1970-01-01
   * con la hora/minuto, o null si no se setea). El calendario usa
   * esta hora para posicionar el bloque. */
  horaSugerida: string | null
  createdAt: string
  items: CkItem[]
}

export type PlantillaListItem = Omit<Plantilla, 'items'> & {
  itemsCount: number
  asignacionesCount: number
}

export type CkAsignado = {
  id: string
  plantilla: string
  plantillaId: string
  /** Hora del día sugerida (denormalizada desde la plantilla). El
   * calendario usa esta hora para posicionar el bloque. Null si la
   * plantilla no la tiene seteada. */
  plantillaHoraSugerida: string | null
  tecnico: string
  tecnicoEmail?: string
  rol: string
  fecha: string
  fechaLimite: string
  estado: 'pendiente' | 'completado' | 'vencido'
  progreso: number
}

/** Ítem dentro del detalle de una asignación, para el wizard de ejecución. */
export type CkEjecucionItemView = {
  itemId: string
  texto: string
  requerido: boolean
  /** null = aún no marcado, true = OK, false = NO OK (con incidencia). */
  ok: boolean | null
  observacion: string | null
  /** Key multi-tenant de la foto de evidencia subida (opcional). */
  fotoKey: string | null
  /** URL pública legacy (compat). */
  fotoUrl: string | null
}

export type CkAsignacionDetalle = {
  id: string
  plantilla: { id: string; nombre: string }
  tecnico: { id: string; nombre: string; email: string }
  bodegaId: string
  fechaLimite: string
  estado: 'pendiente' | 'completado' | 'vencido'
  progreso: number
  resultado: 'aprobado' | 'observaciones' | 'rechazado' | null
  okCount: number
  totalItems: number
  observacion: string | null
  startedAt: string | null
  finishedAt: string | null
  items: CkEjecucionItemView[]
}

export type CkHistorialItem = {
  id: string
  plantilla: string
  plantillaId: string
  tecnico: string
  rol: string
  fecha: string
  duracion: string
  total: number
  ok: number
  resultado: 'aprobado' | 'observaciones' | 'rechazado'
}

export type Usuario = {
  id: string
  nombre: string
  email: string
}
