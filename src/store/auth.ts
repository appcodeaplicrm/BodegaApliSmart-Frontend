import { useSyncExternalStore } from 'react'
import { api, ApiError } from '../lib/api'

export type UsuarioActivo = {
  id: string
  nombre: string
  email: string
  /** Key del rol (ej: "admin", "superadmin", "rol-1786-yznh"). Se usa
   * para checks de permiso, BYPASS_ROLES, etc. */
  rol: string
  /** Nombre legible del rol (ej: "Administrador", "Operador"). Es el
   * que se muestra en UI (sidebar, chips, etc.). */
  rolNombre?: string
  /** ID del tenant (admin dueño de la empresa). `null` solo para
   * superadmin. Lo usa el front para filtrar roles/custom-permissions
   * del tenant actual. NO confundir con `id` (que es el user.id). */
  adminId: string | null
  bodegas: string[]
  bodegaId: string | null
  fotoUrl?: string | null
}

/** Permiso con la forma "modulo.accion" (ej: "inventario.ver", "ordenes.crear") */
export type PermisoKey = string

/**
 * Shape anidado de permisos: { modulo: { submodulo: [acciones] } }
 * Es la fuente de verdad que viene del back desde la refactorización de
 * jun 2026. `permisos` (array plano) se mantiene por compat con código
 * que ya lo consumía, pero el `can()` de grano fino usa este.
 */
export type ModulePermissionMap = Record<string, Record<string, string[]>>

export type Sesion = {
  usuario: UsuarioActivo
  /** Mapa anidado de permisos. Si tiene algo, manda sobre el rol. */
  modulePermissions: ModulePermissionMap
  /** Array plano de keys para compat (se deriva de `modulePermissions`). */
  permisos: PermisoKey[]
}

type EstadoAuth =
  | { status: 'cargando' } // boot inicial, no sabemos si hay sesión
  | { status: 'autenticado'; sesion: Sesion }
  | { status: 'anonimo' } // ya chequeamos y no hay sesión

let estado: EstadoAuth = { status: 'cargando' }
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

function getSnapshot() {
  return estado
}

function setEstado(next: EstadoAuth) {
  estado = next
  emit()
}

/**
 * Roles de plataforma con bypass total. Coincide con el back:
 * - `admin` pasa cualquier check de permiso (la DB le asigna todos).
 * - `superadmin` NO está acá: solo tiene los permisos que se le asignen
 *   explícitamente (por ahora: `admin.ver` + `admin.tenants.ver`). Esto
 *   evita que el superadmin vea todos los módulos en el sidebar
 *   (solo ve "Admin" → "Tenants"). Si en el futuro queremos que el
 *   superadmin también vea inventario, se lo damos explícito.
 */
const BYPASS_ROLES = ['admin'] as const

export const authStore = {
  subscribe,
  getSnapshot,

  /** Hidrata la sesión al cargar la app. Devuelve true si hay usuario. */
  async bootstrap(): Promise<boolean> {
    try {
      const res = await api.get<Sesion>('/auth/me')
      // Los logs de diagnóstico están en el back (auth.controller.ts#sesion).
      // No duplicamos aquí para no contaminar la consola del navegador.
      setEstado({ status: 'autenticado', sesion: res })
      return true
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setEstado({ status: 'anonimo' })
        return false
      }
      setEstado({ status: 'anonimo' })
      return false
    }
  },

  async login(email: string, password: string): Promise<void> {
    const res = await api.post<Sesion>('/auth/login', { email, password })
    // Los logs de diagnóstico están en el back (auth.controller.ts#sesion).
    // No duplicamos aquí para no contaminar la consola del navegador.
    setEstado({ status: 'autenticado', sesion: res })
  },

  /**
   * Rehidrata la sesión actual desde el back sin pasar por el login.
   * El back recalcula los permisos desde DB (override per-user + rol),
   * así que se usa después de que el admin editó un usuario o rol.
   */
  async refrescar(): Promise<void> {
    try {
      const res = await api.get<Sesion>('/auth/me')
      setEstado({ status: 'autenticado', sesion: res })
    } catch {
      // El `triggerSessionExpired` de `lib/api.ts` ya maneja 401.
    }
  },

  /**
   * Actualiza SOLO los permisos de la sesión actual, sin tocar
   * `usuario.bodegas`, `rol` ni nada más. Lo usa el flujo de "cambio
   * de bodega activa" del Sidebar: al cambiar de bodega, los permisos
   * efectivos cambian (rol distinto, override distinto) y queremos
   * que todos los componentes que leen `auth.sesion.permisos` (botones
   * de crear/editar/eliminar, badges, etc.) se enteren sin tener que
   * reloggear ni pegarle a `/auth/me` (que re-emite el JWT).
   *
   * Si no hay sesión, no hace nada.
   */
  actualizarPermisos(permisos: string[], modulePermissions: ModulePermissionMap) {
    if (estado.status !== 'autenticado') return
    setEstado({
      status: 'autenticado',
      sesion: {
        ...estado.sesion,
        permisos,
        modulePermissions,
      },
    })
  },

  /** Actualiza el avatar de la sesión sin volver a consultar /auth/me. */
  actualizarFoto(fotoUrl: string | null) {
    if (estado.status !== 'autenticado') return
    setEstado({
      status: 'autenticado',
      sesion: {
        ...estado.sesion,
        usuario: { ...estado.sesion.usuario, fotoUrl },
      },
    })
  },

  async logout(): Promise<void> {
    try {
      await api.post('/auth/logout')
    } catch {
      // ignore
    }
    setEstado({ status: 'anonimo' })
  },

  isAutenticado(): boolean {
    return estado.status === 'autenticado'
  },
  getSesion(): Sesion | null {
    return estado.status === 'autenticado' ? estado.sesion : null
  },
  getUsuario(): UsuarioActivo | null {
    return estado.status === 'autenticado' ? estado.sesion.usuario : null
  },

  // ─── Helpers de permiso ─────────────────────────────────────

  /**
   * Check de permiso plano (compat con PermissionGate existente).
   * El `key` puede ser `modulo.ver` o `modulo.submodulo.ver`.
   */
  tienePermisos(keys: PermisoKey[]): boolean {
    if (keys.length === 0) return true
    if (estado.status !== 'autenticado') return false
    if ((BYPASS_ROLES as readonly string[]).includes(estado.sesion.usuario.rol)) {
      return true
    }
    const set = new Set(estado.sesion.permisos)
    return keys.every((k) => set.has(k))
  },

  tieneAlgunPermiso(keys: PermisoKey[]): boolean {
    if (keys.length === 0) return true
    if (estado.status !== 'autenticado') return false
    if ((BYPASS_ROLES as readonly string[]).includes(estado.sesion.usuario.rol)) {
      return true
    }
    const set = new Set(estado.sesion.permisos)
    return keys.some((k) => set.has(k))
  },

  /**
   * Check granular estilo WEB-MOTORS: ¿este user tiene la `accion` en
   * `modulo` / `submodulo`?
   *
   * - Admins bypasean
   * - Acepta módulo plano (modulo === submodulo) y módulo con sub-módulo
   */
  can(modulo: string, submodulo: string, accion: string): boolean {
    if (estado.status !== 'autenticado') return false
    if ((BYPASS_ROLES as readonly string[]).includes(estado.sesion.usuario.rol)) {
      return true
    }
    const keyPlano = `${modulo}.${submodulo}.${accion}`
    return estado.sesion.permisos.includes(keyPlano)
  },

  /**
   * ¿El usuario tiene AL MENOS una acción en cualquier submódulo de `modulo`?
   * Útil para decidir si mostrar el item padre en el sidebar.
   */
  canSeeModule(modulo: string): boolean {
    if (estado.status !== 'autenticado') return false
    if ((BYPASS_ROLES as readonly string[]).includes(estado.sesion.usuario.rol)) {
      return true
    }
    const perms = estado.sesion.modulePermissions ?? {}
    const modulePerm = perms[modulo] ?? {}
    return Object.values(modulePerm).some(
      (actions) => Array.isArray(actions) && actions.length > 0,
    )
  },

  /**
   * Devuelve las acciones que el user tiene en `modulo/submodulo`.
   * Útil para la UI de matriz (mostrar checks prendidos).
   */
  actionsFor(modulo: string, submodulo: string): string[] {
    if (estado.status !== 'autenticado') return []
    if ((BYPASS_ROLES as readonly string[]).includes(estado.sesion.usuario.rol)) {
      return ['ver', 'crear', 'editar', 'eliminar']
    }
    const perms = estado.sesion.modulePermissions ?? {}
    return perms[modulo]?.[submodulo] ?? []
  },
}

export function useAuth() {
  return useSyncExternalStore(authStore.subscribe, authStore.getSnapshot, authStore.getSnapshot)
}
