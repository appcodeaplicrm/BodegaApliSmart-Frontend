/**
 * Store del submódulo Proyectos.
 *
 * Patrón idéntico al de `pedidos.ts`: `useSyncExternalStore` con un
 * snapshot cacheado. Solo guarda el LISTADO (cards). El detalle de
 * un proyecto se pide on-demand con `obtenerProyecto()` (Capa 8).
 */
import { useSyncExternalStore } from 'react'
import { ApiError } from '../../lib/api'
import { authStore } from '../../store/auth'
import * as apiClient from './api'
import type {
  ListProyectosQuery,
  ProyectoListItem,
} from './types'

/**
 * Filtra el query para que un user NO admin del tenant SOLO vea
 * los proyectos donde está asignado. El admin del tenant ve todos.
 *
 * Esto lo aplicamos en el front (no en el back) porque:
 *   - El user lo pidió así: "Front (simple)".
 *   - Es seguro en este sistema porque los proyectos son visibles
 *     para todos los users con `tecnicos.proyectos.ver` (no tienen
 *     info ultra-sensible más allá de los costos, que ya se manejan
 *     con el permiso `valores.ver` separado).
 *
 * ⚠️ IMPORTANTE: el rol admin del tenant es un user NORMAL con
 * `rol === 'admin'` que NO debe confundirse con el ROL DEL SISTEMA
 * `superadmin`. El `BYPASS_ROLES` del front (en `store/auth.ts`)
 * usa la misma convención: `['admin']` es admin del tenant.
 */
function applyUserScope(query: ListProyectosQuery): ListProyectosQuery {
  const auth = authStore.getSnapshot()
  // Sin sesión o cargando: no restringimos (dejamos que el back
  // rechace si no tiene permisos, o que cargue vacío si está anon).
  if (auth.status !== 'autenticado') return query
  const { usuario } = auth.sesion
  // Admin del tenant (rol === 'admin') ve TODOS los proyectos del
  // tenant. Superadmin también (chequeado por el back).
  if (usuario.rol === 'admin' || usuario.rol === 'superadmin') return query
  // Cualquier otro rol (técnico, bodeguero, operador, custom del
  // tenant) solo ve los proyectos donde está asignado. Si el query
  // ya tenía un tecnicoId explícito del front (ej: el admin filtró
  // por un técnico específico desde el dashboard), NO lo pisamos —
  // respetamos el filtro explícito.
  if (query.tecnicoId) return query
  return { ...query, tecnicoId: usuario.id }
}

type Estado =
  | { status: 'idle' }
  | { status: 'cargando' }
  | {
      status: 'listo'
      proyectos: ProyectoListItem[]
      total: number
      page: number
      pageSize: number
      totalPages: number
      query: ListProyectosQuery
    }
  | { status: 'error'; mensaje: string }

let estado: Estado = { status: 'idle' }
let cacheSnapshot: Estado = estado
const listeners = new Set<() => void>()

function setEstado(next: Estado): void {
  estado = next
  cacheSnapshot = next
  listeners.forEach((l) => l())
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb)
  return () => listeners.delete(cb)
}

function getSnapshot(): Estado {
  return cacheSnapshot
}

export const proyectosStore = {
  subscribe,
  getSnapshot,

  /** Carga una página del listado con los filtros dados. */
  async cargarPaginado(query: ListProyectosQuery): Promise<void> {
    setEstado({ status: 'cargando' })
    const scopedQuery = applyUserScope(query)
    try {
      const result = await apiClient.listarProyectos(scopedQuery)
      setEstado({
        status: 'listo',
        proyectos: result.data,
        total: result.total,
        page: result.page,
        pageSize: result.pageSize,
        totalPages: result.totalPages,
        query: scopedQuery,
      })
    } catch (err) {
      const mensaje =
        err instanceof ApiError
          ? err.message
          : 'No se pudieron cargar los proyectos.'
      setEstado({ status: 'error', mensaje })
    }
  },

  /** Refetch silencioso con el último query. */
  async recargar(): Promise<void> {
    if (estado.status !== 'listo') return
    const { query } = estado
    // ⚠️ No re-aplicamos `applyUserScope` acá porque el `query` ya
    // fue scopeado cuando se cargó. Re-aplicarlo podría filtrar
    // otra vez con un `usuario.id` que cambió (ej: cambio de
    // bodega activa → user cambia), pero el efecto sería el mismo
    // (filtra por sí mismo). Lo dejamos como está para evitar
    // un refetch doble del filtro.
    try {
      const result = await apiClient.listarProyectos(query)
      setEstado({
        status: 'listo',
        proyectos: result.data,
        total: result.total,
        page: result.page,
        pageSize: result.pageSize,
        totalPages: result.totalPages,
        query,
      })
    } catch {
      /* noop */
    }
  },

  reset(): void {
    setEstado({ status: 'idle' })
  },

  // ─────────────────────────────────────────────────────────────
  //  Realtime handlers
  // ─────────────────────────────────────────────────────────────

  /**
   * Inserta un proyecto nuevo al tope del listado si:
   *  - el store ya está cargado
   *  - el proyecto pertenece a la bodega activa (o no se está
   *    filtrando por bodega)
   *  - el proyecto no estaba ya en la lista (dedup por id)
   */
  handleProyectoCreado(event: {
    id: string
    codigo: string
    nombreProyecto: string
    estado: string
    bodegaId: string | null
  }) {
    if (estado.status !== 'listo') return
    if (event.bodegaId && estado.query.bodegaId && event.bodegaId !== estado.query.bodegaId) {
      return
    }
    if (estado.proyectos.some((p) => p.id === event.id)) return
    // Como no tenemos el `ProyectoListItem` completo, hacemos un
    // refetch silencioso de la página actual. Más simple y robusto.
    void this.recargar()
  },

  /**
   * Cuando cambia el estado de un proyecto, actualizamos la fila
   * in-place si ya está en el listado. Si no, no hacemos nada.
   */
  handleEstadoCambiado(event: {
    id: string
    codigo: string
    estadoAnterior: string
    estadoNuevo: string
    bodegaId: string | null
  }) {
    if (estado.status !== 'listo') return
    const idx = estado.proyectos.findIndex((p) => p.id === event.id)
    if (idx === -1) return
    const nuevosProyectos = [...estado.proyectos]
    nuevosProyectos[idx] = {
      ...nuevosProyectos[idx],
      estado: {
        ...nuevosProyectos[idx].estado,
        nombre: event.estadoNuevo,
      },
    }
    setEstado({ ...estado, proyectos: nuevosProyectos })
  },

  /**
   * Cuando se asigna/desasigna un producto o se registra un avance
   * en un proyecto, no podemos actualizar el row in-place (cambia
   * `costoTotal` o `kmAvanzados`). Hacemos un refetch silencioso.
   * Si el evento es de un proyecto que NO está en el listado
   * (de otro tenant u otro filtro), lo ignoramos.
   */
  handleProyectoActualizado(event: { proyectoId: string; bodegaId: string | null }) {
    if (estado.status !== 'listo') return
    if (event.bodegaId && estado.query.bodegaId && event.bodegaId !== estado.query.bodegaId) {
      return
    }
    if (!estado.proyectos.some((p) => p.id === event.proyectoId)) return
    void this.recargar()
  },
}

export function useProyectos() {
  return useSyncExternalStore(
    proyectosStore.subscribe,
    proyectosStore.getSnapshot,
    proyectosStore.getSnapshot,
  )
}
