/**
 * Store de permisos por bodega (Sprint 3 Fase 6).
 *
 * El usuario puede tener roles distintos en cada bodega y cada rol
 * tiene una matriz de permisos diferente. Como los permisos dependen
 * de la bodega ACTIVA, no podemos usar un solo set global
 * (auth.sesion.permisos). Este store cachea los permisos efectivos
 * POR BODEGA:
 *
 *   { bodegaId: { modulePermissions, permisos (plano), rol } }
 *
 * El estado tiene una forma ESTABLE: la cache es un campo que
 * persiste entre transiciones de status (idle → cargando → listo).
 * Eso permite que mientras se carga la bodega B, la cache de la
 * bodega A siga disponible para los componentes que la estén viendo.
 *
 * Flujo:
 *   1. Usuario cambia de bodega activa desde el sidebar.
 *   2. El Sidebar llama a `permisosPorBodegaStore.cargar(bodegaId)`.
 *   3. El store hace `GET /auth/me/permisos-efectivos?bodegaId=...`,
 *      guarda el resultado y emite a los listeners.
 *   4. Cualquier componente suscrito a `usePermisosDeBodega(bodegaId)`
 *      re-renderiza con los nuevos permisos.
 *
 * El back recalcula los permisos desde DB (rol + override per-bodega
 * + plan del tenant) en cada request, así que el front SIEMPRE está
 * sincronizado con la fuente de verdad.
 */

import { useSyncExternalStore } from 'react'
import { api, ApiError } from '../lib/api'
import type { ModulePermissionMap } from './auth'

export type PermisosEfectivos = {
  bodegaId: string
  modulePermissions: ModulePermissionMap
  /** Keys planas (`modulo.accion` o `modulo.submodulo.accion`). Compat
   *  con código que espera array plano. */
  permisos: string[]
  /** Rol del user en esta bodega. `null` para el propietario del
   *  tenant (que no tiene asignación explícita). */
  rol: { id: string; key: string; nombre: string } | null
  esPropietario: boolean
}

/**
 * Estado del store. La cache es ESTABLE: aunque el status sea
 * 'cargando' o 'error', la cache conserva los permisos ya
 * descargados de otras bodegas. Eso evita "flashes" de sidebar
 * vacío al cambiar de bodega.
 */
type Estado = {
  status: 'idle' | 'cargando' | 'listo' | 'error'
  /** id de la bodega que se está cargando AHORA (puede diferir del
   *  que el caller pidió si hay una carga en vuelo). `null` cuando
   *  no hay carga en curso. */
  cargandoBodegaId: string | null
  /** Cache de permisos por bodega. La bodega activa puede estar
   *  faltando (cargando) sin que esto signifique "no hay nada" —
   *  solo que esa bodega puntual todavía no se descargó. */
  cache: Record<string, PermisosEfectivos>
  /** Mensaje de error de la última carga que falló. */
  error: string | null
}

let estado: Estado = {
  status: 'idle',
  cargandoBodegaId: null,
  cache: {},
  error: null,
}
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

function setEstado(next: Estado | ((prev: Estado) => Estado)) {
  estado =
    typeof next === 'function'
      ? (next as (prev: Estado) => Estado)(estado)
      : next
  emit()
}

export const permisosPorBodegaStore = {
  subscribe,
  getSnapshot,

  /**
   * Devuelve los permisos cacheados de una bodega. Devuelve `null`
   * solo si la bodega puntual NO está en la cache (sea porque nunca
   * se cargó o porque falló la carga). NO se fija en `status` —
   * incluso si el status global es 'cargando' o 'error', la cache
   * puede tener la entrada que nos interesa.
   */
  get(bodegaId: string | null): PermisosEfectivos | null {
    if (!bodegaId) return null
    return estado.cache[bodegaId] ?? null
  },

  /**
   * Trae los permisos efectivos del user actual para `bodegaId`.
   * Cachea el resultado y emite. Si ya está cacheado, NO vuelve
   * a llamar al back (a menos que `force: true`).
   *
   * Concurrencia: si ya hay una carga en vuelo para esa bodega,
   * devuelve la misma promesa (no se disparan dos fetches
   * paralelos por el StrictMode de React en dev).
   */
  cargar(bodegaId: string, opts: { force?: boolean } = {}): Promise<PermisosEfectivos> {
    if (!bodegaId) {
      return Promise.reject(new Error('permisosPorBodegaStore.cargar requiere bodegaId'))
    }
    // Cache hit (no respeta `force`)
    if (!opts.force && estado.cache[bodegaId]) {
      return Promise.resolve(estado.cache[bodegaId])
    }
    // Ya hay una carga en vuelo para esta bodega → devolver su promesa.
    if (estado.status === 'cargando' && estado.cargandoBodegaId === bodegaId) {
      return enVuelo.get(bodegaId) ?? Promise.reject(new Error('carga en vuelo no encontrada'))
    }
    setEstado((prev) => ({
      ...prev,
      status: 'cargando',
      cargandoBodegaId: bodegaId,
      error: null,
    }))
    const promise = api
      .get<PermisosEfectivos>(
        `/auth/me/permisos-efectivos?bodegaId=${encodeURIComponent(bodegaId)}`,
      )
      .then((data) => {
        setEstado((prev) => ({
          ...prev,
          status: 'listo',
          cargandoBodegaId: null,
          cache: { ...prev.cache, [bodegaId]: data },
        }))
        enVuelo.delete(bodegaId)
        return data
      })
      .catch((err) => {
        const mensaje =
          err instanceof ApiError
            ? err.message
            : err instanceof Error
              ? err.message
              : 'No se pudieron cargar los permisos de la bodega.'
        setEstado((prev) => ({
          ...prev,
          status: 'error',
          cargandoBodegaId: null,
          error: mensaje,
        }))
        enVuelo.delete(bodegaId)
        throw err
      })
    enVuelo.set(bodegaId, promise)
    return promise
  },

  /**
   * Invalida la cache. Útil cuando el admin cambió un rol/permiso
   * y queremos forzar refetch la próxima vez que el user abra esa
   * bodega.
   */
  invalidar(bodegaId?: string) {
    setEstado((prev) => {
      if (!bodegaId) {
        return { ...prev, cache: {} }
      }
      const cache = { ...prev.cache }
      delete cache[bodegaId]
      return { ...prev, cache }
    })
  },

  reset() {
    enVuelo.clear()
    setEstado({
      status: 'idle',
      cargandoBodegaId: null,
      cache: {},
      error: null,
    })
  },
}

/** Mapa de promesas en vuelo por bodega, para deduplicar fetches. */
const enVuelo = new Map<string, Promise<PermisosEfectivos>>()

/**
 * Hook que devuelve los permisos efectivos de `bodegaId`. Si la
 * bodega está en la cache, la devuelve. Si NO está, devuelve `null`
 * (los componentes deben disparar `cargar(bodegaId)` o usar el
 * hook "todo-en-uno" `usePermisosDeBodegaActiva`).
 *
 * NO se fija en `status` global: la cache puede tener la entrada
 * que nos interesa aunque otra carga esté en vuelo o haya fallado.
 */
export function usePermisosDeBodega(bodegaId: string | null): PermisosEfectivos | null {
  const state = useSyncExternalStore(
    permisosPorBodegaStore.subscribe,
    permisosPorBodegaStore.getSnapshot,
    permisosPorBodegaStore.getSnapshot,
  )
  if (!bodegaId) return null
  return state.cache[bodegaId] ?? null
}
