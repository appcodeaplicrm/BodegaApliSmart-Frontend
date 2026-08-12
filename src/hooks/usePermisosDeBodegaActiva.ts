/**
 * usePermisosDeBodegaActiva — hook "todo-en-uno" para la bodega activa.
 *
 * Devuelve los permisos efectivos de la bodega activa del usuario
 * (la que está en `bodegaActivaStore`). Si no hay cache, dispara
 * la carga automáticamente. Si está cargando, devuelve el último
 * valor cacheado si existe (para no parpadear), o `null` si es la
 * primera vez.
 *
 * Por qué este hook y no `usePermisosDeBodega(bodegaId)` directo:
 *   - Evita que cada componente tenga que subscribirse al cambio
 *     de bodega activa y disparar la carga.
 *   - Centraliza la lógica de "asegurate de que los permisos de
 *     la bodega activa están en cache antes de renderizar".
 *
 * Sprint 3 Fase 6.
 */

import { useEffect } from 'react'
import {
  permisosPorBodegaStore,
  usePermisosDeBodega,
  type PermisosEfectivos,
} from '../store/permisosPorBodega'
import { useBodegaActiva } from '../store/bodegaActiva'

export type UsePermisosDeBodegaActivaResult = {
  /** Permisos efectivos de la bodega activa. `null` si todavía no
   *  hay cache (primera carga, o bodega sin permisos). */
  permisos: PermisosEfectivos | null
  /** `true` mientras se está haciendo el fetch inicial. */
  cargando: boolean
  /** id de la bodega activa (para que el componente sepa qué bodega
   *  está renderizando sin tener que suscribirse a `useBodegaActiva` aparte). */
  bodegaId: string | null
}

export function usePermisosDeBodegaActiva(): UsePermisosDeBodegaActivaResult {
  const bodegaId = useBodegaActiva()
  const permisos = usePermisosDeBodega(bodegaId)
  const state = permisosPorBodegaStore.getSnapshot()
  const cargando =
    state.status === 'cargando' && state.cargandoBodegaId === bodegaId

  // Disparar carga automática si no hay cache. Usamos un effect con
  // `bodegaId` como dep para que se re-dispare al cambiar de bodega.
  useEffect(() => {
    if (!bodegaId) return
    // Si ya están cacheados, no hacemos nada.
    if (permisosPorBodegaStore.get(bodegaId)) return
    void permisosPorBodegaStore.cargar(bodegaId).catch(() => {
      /* el estado 'error' ya se seteó; los componentes lo manejan */
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bodegaId])

  return { permisos, cargando, bodegaId }
}
