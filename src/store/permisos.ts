import { useSyncExternalStore } from 'react'
import { api, ApiError } from '../lib/api'
import { useAuth } from './auth'
import type { ModulePermissionMap } from './auth'

/**
 * Jerarquía de módulos y sub-módulos del sistema.
 *
 * Reglas:
 *   - Para que un módulo padre aparezca en el sidebar, el usuario debe tener
 *     `<modulo>.ver` (o al menos una acción en algún submódulo si es plano).
 *   - Para que un sub-módulo aparezca, el usuario debe tener
 *     `<modulo>.<submodulo>.ver`.
 *   - Los permisos granulares (crear, editar, eliminar) son POR SUB-MÓDULO
 *     cuando el módulo padre tiene hijos; en módulos planos (sin sub-módulos)
 *     son por el módulo.
 */

export type ModuloKey =
  | 'dashboard'
  | 'inventario'
  | 'movimientos'
  | 'despachos'
  | 'usuarios'
  | 'roles'
  | 'kits'
  | 'alertas'
  | 'auditoria'
  | 'tecnicos'
  | 'reportes'
  | 'valores'
  | 'admin'

export const ACCIONES = ['ver', 'crear', 'editar', 'eliminar'] as const
export type Accion = (typeof ACCIONES)[number]

/**
 * Acciones custom de sub-módulos (no son las 4 base). Se concatenan
 * como key final: `<modulo>.<sub>.<accion>` (ej: `tecnicos.proyectos.
 * nodo.gestionar`). El front las renderiza con un chip "ver"-equivalente
 * en la matriz de permisos del modal de Crear/Editar Usuario.
 */
export type AccionCustom = string

export type SubmoduloDef = {
  key: string
  label: string
  acciones?: readonly (Accion | AccionCustom)[]
}

export type ModuloDef = {
  key: ModuloKey
  label: string
  acciones: readonly Accion[]
  submodulos?: readonly SubmoduloDef[]
}

export const MODULOS: readonly ModuloDef[] = [
  { key: 'dashboard', label: 'Dashboard', acciones: ['ver'] },
  { key: 'inventario', label: 'Inventario', acciones: ['ver', 'crear', 'editar', 'eliminar'], submodulos: [
    { key: 'productos', label: 'Productos' },
    { key: 'categorias', label: 'Categorías' },
    { key: 'marcas', label: 'Marcas' },
    { key: 'proveedores', label: 'Proveedores' },
    { key: 'ubicaciones', label: 'Secciones de la bodega' },
  ]},
  { key: 'movimientos', label: 'Movimientos', acciones: ['ver', 'crear', 'editar', 'eliminar'] },
  { key: 'despachos', label: 'Despachos', acciones: ['ver', 'crear', 'editar', 'eliminar'] },
  { key: 'usuarios', label: 'Usuarios', acciones: ['ver', 'crear', 'editar', 'eliminar'] },
  { key: 'roles', label: 'Roles', acciones: ['ver', 'crear', 'editar', 'eliminar'] },
  { key: 'kits', label: 'Kits', acciones: ['ver', 'crear', 'editar', 'eliminar'] },
  {
    // Módulo "Alertas" (de stock). NO es sub de Inventario ni de Técnicos
    // — son dos cosas distintas: estas son las alertas de stock del
    // inventario, las de "Alertas de Kit" viven como sub de Técnicos.
    // Sin 'crear'/'eliminar': las alertas se generan automáticamente al
    // dispararse (cuando un producto baja del stock mínimo).
    key: 'alertas',
    label: 'Alertas',
    acciones: ['ver', 'editar'],
    submodulos: [{ key: 'historial', label: 'Historial', acciones: ['ver'] }],
  },
  {
    key: 'auditoria',
    label: 'Auditoría inteligente',
    acciones: ['ver', 'crear', 'editar'],
  },
  {
    key: 'tecnicos',
    label: 'Técnicos',
    acciones: ['ver'],
    submodulos: [
      { key: 'solicitudes', label: 'Solicitudes de Recursos' },
      { key: 'herramientas', label: 'Herramientas Obligatorias' },
      { key: 'alertas', label: 'Alertas de Kit' },
      { key: 'devoluciones', label: 'Devoluciones' },
      { key: 'asignadas', label: 'Herramientas Asignadas' },
      {
        // Sub-módulo Proyectos con acciones CUSTOM (no las 4 base).
        // Espejo del back (src/auth/permisos.catalogo.ts) y del seed
        // (prisma/seed.ts -> PERMISOS_PROYECTOS_CUSTOM). Si agregás
        // una acción custom nueva, tenés que sumarla en los 3 lugares.
        key: 'proyectos',
        label: 'Proyectos',
        acciones: [
          'ver',                  // tecnicos.proyectos.ver
          'crear',                // tecnicos.proyectos.crear
          'editar',               // tecnicos.proyectos.editar
          'eliminar',             // tecnicos.proyectos.eliminar
          'tecnico.asignar',      // tecnicos.proyectos.tecnico.asignar
          'producto.inicial',     // tecnicos.proyectos.producto.inicial
          'solicitud.crear',      // tecnicos.proyectos.solicitud.crear
          'solicitud.aprobar',    // tecnicos.proyectos.solicitud.aprobar
          'solicitud.entregar',   // tecnicos.proyectos.solicitud.entregar
          'avance.registrar',     // tecnicos.proyectos.avance.registrar
          'avance.ver',           // tecnicos.proyectos.avance.ver
          'costo.ver',            // tecnicos.proyectos.costo.ver
          'nodo.gestionar',       // tecnicos.proyectos.nodo.gestionar
        ],
      },
      { key: 'checklist', label: 'Checklist' },
    ],
  },
  {
    key: 'reportes',
    label: 'Reportes',
    acciones: ['ver'],
    submodulos: [
      { key: 'entradas', label: 'Entradas' },
      { key: 'salidas', label: 'Salidas' },
      { key: 'kardex', label: 'Kardex' },
    ],
  },
  {
    // Módulo "Valores" — permiso CROSS-MÓDULO que controla si el
    // front muestra los precios/costos o los oculta con candado.
    // No tiene sub-módulos: aplica a TODO el sistema (productos,
    // proyectos, compras, movimientos, reportes, dashboard).
    // El control de visibilidad es 100% del front.
    key: 'valores',
    label: 'Valores monetarios',
    acciones: ['ver'],
  },
] as const

export const MODULO_LABELS: Record<ModuloKey, string> = MODULOS.reduce(
  (acc, m) => {
    acc[m.key] = m.label
    return acc
  },
  {} as Record<ModuloKey, string>,
)

export const ACCION_LABELS: Record<Accion, string> = {
  ver: 'Ver',
  crear: 'Crear',
  editar: 'Editar',
  eliminar: 'Eliminar',
}

/**
 * Labels para acciones CUSTOM de sub-módulos (no entran en
 * `ACCION_LABELS` porque no son parte del union `Accion`).
 * El render de la matriz usa `ACCION_LABELS[a] ?? ACCION_LABELS_CUSTOM[a] ?? a`
 * para mostrarlos.
 *
 * Si agregás una acción custom nueva, agregá su label acá también.
 */
export const ACCION_LABELS_CUSTOM: Record<string, string> = {
  // tecnicos.proyectos
  'tecnico.asignar': 'Asignar técnicos',
  'producto.inicial': 'Dotación inicial',
  'solicitud.crear': 'Crear solicitudes',
  'solicitud.aprobar': 'Aprobar solicitudes',
  'solicitud.entregar': 'Entregar solicitudes',
  'avance.registrar': 'Registrar avance',
  'avance.ver': 'Ver avances',
  'costo.ver': 'Ver costos',
  'nodo.gestionar': 'Gestionar nodos',
}

/**
 * Helper: dado una acción (puede ser base o custom), devuelve el label
 * legible. Si no está mapeado, devuelve la key cruda con la primera letra
 * en mayúscula.
 */
export function labelAccion(a: string): string {
  return (
    ACCION_LABELS[a as Accion] ??
    ACCION_LABELS_CUSTOM[a] ??
    a.charAt(0).toUpperCase() + a.slice(1)
  )
}

export type Permiso = string

/**
 * Key del rol. Antes era una unión cerrada; ahora cualquier string
 * porque los tenants crean sus propios roles. Las únicas keys
 * garantizadas son `admin` y `superadmin` (sistema).
 */
export type RolKey = string

export type ApiRol = {
  id: string
  key: string
  nombre: string
  descripcion: string
  esSistema: boolean
  /** Tenant al que pertenece el rol. `null` = rol del sistema (admin/superadmin). */
  adminId: string | null
  createdAt: string
  updatedAt: string
  usuariosCount: number
  permisos: string[]
}

export type Rol = {
  id: string
  key: RolKey
  nombre: string
  descripcion: string
  permisos: Permiso[]
  esSistema: boolean
  /** Tenant al que pertenece el rol. `null` = rol del sistema. */
  adminId: string | null
  usuariosCount: number
}

// ─────────────────────────────────────────────
//  Generación de keys a partir del catálogo
// ─────────────────────────────────────────────

export function todasLasKeys(): string[] {
  const out: string[] = []
  for (const m of MODULOS) {
    if (!m.submodulos || m.submodulos.length === 0) {
      for (const a of m.acciones) out.push(`${m.key}.${a}`)
    } else {
      const accionesPadre = new Set<Accion>(['ver', ...m.acciones])
      for (const a of accionesPadre) out.push(`${m.key}.${a}`)
      for (const s of m.submodulos) {
        // Antes (BUG): solo se iteraban las 4 acciones base (`ACCIONES`),
        // descartando las acciones custom declaradas en `s.acciones`
        // (ej: `tecnicos.proyectos.solicitud.aprobar`). El front usaba
        // `TODAS_LAS_KEYS` para hidratar la matriz de permisos de un
        // user, así que los chips custom quedaban fuera y no se podían
        // marcar. Ahora: usamos `s.acciones ?? ACCIONES` para incluir
        // las custom (con `??` caemos a las 4 base si el sub no declara).
        const accsSub = s.acciones ?? ACCIONES
        for (const a of accsSub) {
          out.push(`${m.key}.${s.key}.${a}`)
        }
      }
    }
  }
  return out
}

export const TODAS_LAS_KEYS: readonly string[] = todasLasKeys()

export function keysSubmodulo(moduloKey: ModuloKey, subKey: string): string[] {
  return ACCIONES.map((a) => `${moduloKey}.${subKey}.${a}`)
}

/**
 * Devuelve TODAS las keys de un sub-módulo, incluyendo las acciones
 * custom (si el sub-módulo las declara). Si no declara acciones,
 * devuelve las 4 base (compat con `keysSubmodulo`).
 *
 * Útil para renderizar la matriz completa de un sub-módulo con
 * acciones custom (ej: `tecnicos.proyectos` con sus 13 acciones).
 */
export function keysSubmoduloFull(moduloKey: string, sub: SubmoduloDef): string[] {
  const accs = sub.acciones ?? ACCIONES
  return accs.map((a) => `${moduloKey}.${sub.key}.${a}`)
}

/**
 * Devuelve solo las acciones CUSTOM del sub-módulo (las que NO están
 * en las 4 base). Útil para la matriz de Roles: las 4 base van en
 * las columnas de la tabla, las custom van en una fila adicional
 * debajo del sub-módulo.
 */
export function accionesCustomSubmodulo(sub: SubmoduloDef): string[] {
  const accs = sub.acciones ?? ACCIONES
  return accs.filter((a) => !ACCIONES.includes(a as Accion))
}

export function keyVerPadre(moduloKey: ModuloKey): string {
  return `${moduloKey}.ver`
}

// ─────────────────────────────────────────────
//  Store de roles — backed por la API
// ─────────────────────────────────────────────

type Estado =
  | { status: 'idle' }
  | { status: 'cargando' }
  | { status: 'listo'; roles: Rol[] }
  | { status: 'error'; mensaje: string }

let estado: Estado = { status: 'idle' }

let snapshot: { roles: Rol[] } = { roles: [] }

const listeners = new Set<() => void>()

function emit() {
  snapshot = { roles: estado.status === 'listo' ? estado.roles : [] }
  listeners.forEach((l) => l())
}

function subscribe(l: () => void) {
  listeners.add(l)
  return () => {
    listeners.delete(l)
  }
}

function getSnapshot() {
  return snapshot
}

function setEstado(next: Estado) {
  estado = next
  emit()
}

function normalizarRol(r: ApiRol): Rol {
  return {
    id: r.id,
    key: r.key,
    nombre: r.nombre,
    descripcion: r.descripcion,
    esSistema: r.esSistema,
    adminId: r.adminId ?? null,
    usuariosCount: r.usuariosCount,
    permisos: r.permisos,
  }
}

export const permisosStore = {
  subscribe,
  getSnapshot,

  async cargar(): Promise<Rol[]> {
    if (estado.status === 'cargando') return []
    setEstado({ status: 'cargando' })
    try {
      const data = await api.get<ApiRol[]>('/roles')
      const roles = data.map(normalizarRol)
      setEstado({ status: 'listo', roles })
      return roles
    } catch (err) {
      const mensaje =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'No se pudieron cargar los roles.'
      setEstado({ status: 'error', mensaje })
      throw err
    }
  },

  estado() {
    return estado
  },

  roles: {
    listar() {
      return estado.status === 'listo' ? estado.roles : []
    },
    obtener(key: RolKey) {
      return permisosStore.roles.listar().find((r) => r.key === key)
    },

    async crear(input: {
      nombre: string
      descripcion: string
      permisos: Permiso[]
    }): Promise<Rol> {
      const body = {
        key: `rol-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        nombre: input.nombre,
        descripcion: input.descripcion,
        permisos: input.permisos,
      }
      const created = await api.post<ApiRol>('/roles', body)
      const rol = normalizarRol(created)
      if (estado.status === 'listo') {
        setEstado({ status: 'listo', roles: [...estado.roles, rol] })
      }
      return rol
    },

    async eliminar(id: string): Promise<void> {
      await api.delete(`/roles/${id}`)
      if (estado.status === 'listo') {
        setEstado({
          status: 'listo',
          roles: estado.roles.filter((r) => r.id !== id),
        })
      }
    },

    async actualizarPermisos(id: string, permisos: Permiso[]): Promise<Rol> {
      const updated = await api.put<ApiRol>(`/roles/${id}/permisos`, { permisos })
      const rol = normalizarRol(updated)
      if (estado.status === 'listo') {
        setEstado({
          status: 'listo',
          roles: estado.roles.map((r) => (r.id === id ? rol : r)),
        })
      }
      return rol
    },

    async actualizarMeta(
      id: string,
      patch: { nombre?: string; descripcion?: string },
    ): Promise<Rol> {
      const updated = await api.patch<ApiRol>(`/roles/${id}`, patch)
      const rol = normalizarRol(updated)
      if (estado.status === 'listo') {
        setEstado({
          status: 'listo',
          roles: estado.roles.map((r) => (r.id === id ? rol : r)),
        })
      }
      return rol
    },
  },
}

export function usePermisos() {
  const snap = useSyncExternalStore(permisosStore.subscribe, permisosStore.getSnapshot, permisosStore.getSnapshot)
  // El back ya filtra por tenant en `/roles`, pero como defensa en
  // profundidad filtramos también del lado del front: solo devolvemos
  // los roles del sistema (`adminId === null`) o los del tenant activo.
  // Esto evita que un cambio futuro del back que olvide el filtro
  // exponga roles de OTRO tenant en el dropdown del modal.
  const auth = useAuth()
  // ⚠️ `tenantAdminId` debe ser el `adminId` del TENANT, no el `id`
  // del usuario. Antes (ago 2026) usábamos `usuario.id` que filtraba
  // MAL — un admin sin bodega propia nunca matcheaba con sus propios
  // roles custom (que tienen `adminId = <tenant admin id>`, no
  // `<usuario id>`). Fix: leer `usuario.adminId` que ahora viene en
  // el payload de `/auth/me`.
  const tenantAdminId =
    auth.status === 'autenticado' ? auth.sesion.usuario.adminId : null
  const filtrados = tenantAdminId
    ? snap.roles.filter(
        (r) => r.adminId === null || r.adminId === tenantAdminId,
      )
    : snap.roles.filter((r) => r.adminId === null)
  return { ...snap, roles: filtrados }
}

// ─────────────────────────────────────────────
//  Helpers de override per-user (via API)
// ─────────────────────────────────────────────

/**
 * Trae el override per-user actual (null si no hay) y los permisos
 * efectivos recalculados por el back.
 */
export async function apiGetPermisosUsuario(usuarioId: string): Promise<{
  override: ModulePermissionMap | null
  permisosEfectivos: ModulePermissionMap
  /** Rol del user EN ESTA BODEGA (el de `UsuarioBodega`), no el
   *  global. `null` si es propietario del tenant sin asignación. */
  rol: { id: string; key: string; nombre: string } | null
  /** Permisos del ROL del user en la bodega activa, como lista plana
   *  de keys (`modulo.accion` o `modulo.submodulo.accion`). Vacío si
   *  no tiene rol explícito (propietario sin asignación) o si el
   *  endpoint no recibió el header `X-Bodega-Id`. */
  rolPermisos: string[]
  esPropietario: boolean
}> {
  return api.get<{
    override: ModulePermissionMap | null
    permisosEfectivos: ModulePermissionMap
    rol: { id: string; key: string; nombre: string } | null
    rolPermisos: string[]
    esPropietario: boolean
  }>(`/usuarios/${usuarioId}/permisos`)
}

/**
 * Reemplaza el override per-user de un usuario.
 *
 * - `null` → el back borra el override (el user hereda del rol)
 * - objeto (incluso `{}`) → guarda como override literal (el user deja
 *   de heredar del rol; con `{}` queda sin permisos)
 */
export async function apiReplacePermisosOverride(
  usuarioId: string,
  override: ModulePermissionMap | null,
): Promise<{ modulePermissions: ModulePermissionMap | null; permisosEfectivos: ModulePermissionMap }> {
  return api.patch<{ modulePermissions: ModulePermissionMap | null; permisosEfectivos: ModulePermissionMap }>(
    `/usuarios/${usuarioId}/permisos`,
    { override },
  )
}
