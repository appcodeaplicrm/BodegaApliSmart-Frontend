/**
 * Store de bodegas ACCESIBLES para el user actual (Sprint 3 Fase 6).
 *
 * Distinto de `bodegasStore`, que carga TODAS las bodegas del tenant
 * (vía `GET /bodegas`, protegido por `inventario.ver`). Acá
 * cargamos solamente las bodegas a las que el user tiene acceso,
 * con su rol por bodega, vía `GET /auth/me/bodegas` (que no exige
 * un permiso operativo de bodega — solo autenticación).
 *
 * Esto evita la dependencia circular del .md (sección 3.4):
 *   "Para elegir una bodega necesito listar bodegas
 *    → para listar bodegas necesito inventario.ver
 *    → inventario.ver depende del rol de una bodega
 *    → todavía no elegí la bodega"
 *
 * Además, el endpoint ya marca `esPrincipal` en cada asignación
 * (vía el orderBy de `listarBodegasAccesibles` en el back), así
 * el front puede elegir la principal del user como default al
 * iniciar.
 */

import { useSyncExternalStore } from 'react'
import { api, ApiError } from '../lib/api'

export type RolDeBodega = {
  id: string | null
  key: string
  nombre: string
}

export type BodegaAccesible = {
  id: string
  nombre: string
  rol: RolDeBodega
  esPropietario: boolean
  esPrincipal: boolean
}

type Estado =
  | { status: 'idle' }
  | { status: 'cargando' }
  | { status: 'listo'; bodegas: BodegaAccesible[]; esPropietario: boolean }
  | { status: 'error'; mensaje: string }

let estado: Estado = { status: 'idle' }
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

export const bodegasAccesiblesStore = {
  subscribe,
  getSnapshot,

  /**
   * Trae la lista de bodegas accesibles del user actual. NO usa la
   * cache (siempre hace fetch) para mantenerlo simple. Si el user
   * ya está autenticado y refresca, esto trae la lista actualizada
   * de bodegas después de un cambio de plan o asignación.
   */
  async cargar(): Promise<{
    bodegas: BodegaAccesible[]
    esPropietario: boolean
  }> {
    setEstado({ status: 'cargando' })
    try {
      const data = await api.get<{
        bodegas: BodegaAccesible[]
        esPropietario: boolean
      }>('/auth/me/bodegas')
      setEstado({
        status: 'listo',
        bodegas: data.bodegas,
        esPropietario: data.esPropietario,
      })
      return data
    } catch (err) {
      const mensaje =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'No se pudieron cargar las bodegas accesibles.'
      setEstado({ status: 'error', mensaje })
      throw err
    }
  },

  /**
   * Devuelve la lista cacheada o `null` si todavía no se cargó.
   */
  listar(): BodegaAccesible[] | null {
    if (estado.status !== 'listo') return null
    return estado.bodegas
  },

  /**
   * Elige la bodega activa "correcta" para el user, en este orden:
   *   1. La que el user ya tenía elegida y sigue accesible.
   *   2. La marcada como `esPrincipal` en `UsuarioBodega`.
   *   3. La primera de la lista.
   * Si no hay bodegas accesibles, devuelve `null`.
   */
  elegirBodegaActiva(bodegaIdAlmacenada: string | null): BodegaAccesible | null {
    if (estado.status !== 'listo') return null
    const { bodegas } = estado
    if (bodegas.length === 0) return null
    const guardada = bodegas.find((b) => b.id === bodegaIdAlmacenada)
    if (guardada) return guardada
    const principal = bodegas.find((b) => b.esPrincipal)
    if (principal) return principal
    return bodegas[0]
  },

  reset() {
    setEstado({ status: 'idle' })
  },
}

export function useBodegasAccesibles() {
  return useSyncExternalStore(
    bodegasAccesiblesStore.subscribe,
    bodegasAccesiblesStore.getSnapshot,
    bodegasAccesiblesStore.getSnapshot,
  )
}
