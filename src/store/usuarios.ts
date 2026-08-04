import { useSyncExternalStore } from 'react'
import { api, ApiError } from '../lib/api'

export type RolUsuario = 'admin' | 'bodeguero' | 'operador' | 'tecnico'

export const ROL_LABELS: Record<RolUsuario, string> = {
  admin: 'ADMIN',
  bodeguero: 'BODEGUERO',
  operador: 'OPERADOR',
  tecnico: 'TÉCNICO',
}

export type EstadoUsuario = 'Activo' | 'Inactivo'

/** Shape que el back devuelve en `GET /usuarios` y `GET /usuarios/:id`. */
export type ApiUsuario = {
  id: string
  nombre: string
  email: string
  estado: EstadoUsuario
  rol: string // string plano (key del rol: "admin", "bodeguero", etc.)
  rolNombre: string
  bodegaId: string | null
  bodegaNombre: string | null
  createdAt: string // ISO
  updatedAt: string // ISO
}

/**
 * Shape que consume el front (legacy). Es un subset de ApiUsuario
 * con tipos adaptados (rol como RolUsuario, createdAt como ms epoch).
 */
export type Usuario = {
  id: string
  nombre: string
  email: string
  rol: RolUsuario
  estado: EstadoUsuario
  bodegaId: string | null
  bodegaNombre: string | null
  createdAt: number
}

function fromApi(u: ApiUsuario): Usuario {
  return {
    id: u.id,
    nombre: u.nombre,
    email: u.email,
    rol: (u.rol ?? 'operador') as RolUsuario,
    estado: u.estado,
    bodegaId: u.bodegaId,
    bodegaNombre: u.bodegaNombre,
    createdAt: typeof u.createdAt === 'string' ? new Date(u.createdAt).getTime() : Date.now(),
  }
}

// ─────────────────────────────────────────────
//  Estado del store
// ─────────────────────────────────────────────

type Estado =
  | { status: 'idle' }
  | { status: 'cargando' }
  | {
      status: 'listo'
      usuarios: Usuario[]
      total: number
      page: number
      pageSize: number
      totalPages: number
    }
  | { status: 'error'; mensaje: string }

/** Filtros + paginación para `cargarPaginado`. */
export type UsuariosQuery = {
  bodegaId?: string
  rol?: string
  estado?: string
  buscar?: string
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

let estado: Estado = { status: 'idle' }
let snapshot: { usuarios: Usuario[]; estado: Estado } = {
  usuarios: [],
  estado: { status: 'idle' },
}

const listeners = new Set<() => void>()

function emit() {
  snapshot = {
    usuarios: estado.status === 'listo' ? estado.usuarios : [],
    estado,
  }
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

export const usuariosStore = {
  subscribe,
  getSnapshot,

  estado() {
    return estado
  },

  /** Trae la lista de usuarios desde el back. */
  async cargar(): Promise<Usuario[]> {
    if (estado.status === 'cargando') return []
    setEstado({ status: 'cargando' })
    try {
      const data = await api.get<ApiUsuario[]>('/usuarios')
      const usuarios = data.map(fromApi)
      setEstado({
        status: 'listo',
        usuarios,
        total: usuarios.length,
        page: 1,
        pageSize: usuarios.length,
        totalPages: 1,
      })
      return usuarios
    } catch (err) {
      const mensaje =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'No se pudieron cargar los usuarios.'
      setEstado({ status: 'error', mensaje })
      throw err
    }
  },

  /** Carga una página de usuarios con filtros opcionales. */
  async cargarPaginado(query: UsuariosQuery): Promise<PageResult<Usuario>> {
    setEstado({ status: 'cargando' })
    try {
      const params = new URLSearchParams()
      if (query.bodegaId) params.set('bodegaId', query.bodegaId)
      if (query.rol) params.set('rol', query.rol)
      if (query.estado) params.set('estado', query.estado)
      if (query.buscar) params.set('buscar', query.buscar)
      params.set('page', String(query.page))
      params.set('pageSize', String(query.pageSize))
      const result = await api.get<PageResult<ApiUsuario>>(`/usuarios?${params.toString()}`)
      const usuarios = result.data.map(fromApi)
      setEstado({
        status: 'listo',
        usuarios,
        total: result.total,
        page: result.page,
        pageSize: result.pageSize,
        totalPages: result.totalPages,
      })
      return { ...result, data: usuarios }
    } catch (err) {
      const mensaje =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'No se pudieron cargar los usuarios.'
      setEstado({ status: 'error', mensaje })
      throw err
    }
  },

  /** Crea un usuario en el back via `POST /auth/register`. */
  async crear(input: {
    nombre: string
    email: string
    password: string
    rol: RolUsuario | string
    bodegaId?: string | null
    estado: EstadoUsuario
  }): Promise<Usuario> {
    const body = {
      nombre: input.nombre,
      email: input.email,
      password: input.password,
      rolKey: input.rol,
      bodegaId: input.bodegaId ?? undefined,
      estado: input.estado,
    }
    const created = await api.post<ApiUsuario>('/auth/register', body)
    return fromApi(created)
  },

  /**
   * Actualiza info básica (nombre, email, bodega, estado).
   * Si el body incluye `rol`, lo aplica con un endpoint aparte
   * (`PATCH /usuarios/:id/rol`).
   */
  async actualizar(
    id: string,
    patch: {
      nombre?: string
      email?: string
      rol?: RolUsuario | string
      bodegaId?: string | null
      estado?: EstadoUsuario
    },
  ): Promise<Usuario> {
    const { rol, ...info } = patch
    // 1) Actualizar info básica (si hay algo distinto a rol)
    if (Object.keys(info).length > 0) {
      await api.patch<ApiUsuario>(`/usuarios/${id}`, info)
    }
    // 2) Actualizar rol (si viene)
    const updated: ApiUsuario = rol
      ? await api.patch<ApiUsuario>(`/usuarios/${id}/rol`, { rolKey: rol })
      : await api.get<ApiUsuario>(`/usuarios/${id}`)
    return fromApi(updated)
  },

  /** Elimina un usuario en el back. */
  async eliminar(id: string): Promise<void> {
    await api.delete(`/usuarios/${id}`)
  },

  /**
   * Toggle local de estado. Útil para el botón rápido de activar/desactivar.
   * DEPRECADO: ya no sincroniza con la lista paginada. Usar `cambiarRol`
   * o un PATCH + `cargarPaginado` para mantener la página actual.
   */
  toggleEstado(id: string) {
    // No-op: la mutación local ya no es confiable con paginación.
    void id
  },
}

export function useUsuarios() {
  return useSyncExternalStore(usuariosStore.subscribe, usuariosStore.getSnapshot, usuariosStore.getSnapshot)
}
