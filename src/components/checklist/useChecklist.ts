/**
 * Hook central del módulo Checklist. Carga en paralelo:
 *   - Plantillas (lista resumida)
 *   - Asignaciones (programados)
 *   - Historial
 *   - Roles disponibles (para los selects)
 *
 * El `bodegaId` se lee del store `useBodegaActiva`. Si cambia (el
 * user cambió de bodega en el sidebar), recargamos automáticamente.
 *
 * Manejo de errores: si una request falla, exponemos `error` y un
 * `loading` por separado. La UI decide si mostrar fallback o toast.
 */
import { useCallback, useEffect, useState } from 'react'
import {
  listarAsignaciones,
  listarPlantillas,
  listarRoles,
  historial as apiHistorial,
} from './api'
import { useBodegaActiva } from '../../store/bodegaActiva'
import type {
  CkAsignado,
  CkHistorialItem,
  CkRol,
  PlantillaListItem,
} from './types'

export type ChecklistData = {
  plantillas: PlantillaListItem[]
  asignaciones: CkAsignado[]
  historial: CkHistorialItem[]
  roles: CkRol[]
  loading: boolean
  error: string | null
  /** ID de la bodega activa usada para las queries. */
  bodegaId: string | null
  reload: () => Promise<void>
}

export function useChecklist(): ChecklistData {
  const bodegaId = useBodegaActiva()
  const [plantillas, setPlantillas] = useState<PlantillaListItem[]>([])
  const [asignaciones, setAsignaciones] = useState<CkAsignado[]>([])
  const [historial, setHistorial] = useState<CkHistorialItem[]>([])
  const [roles, setRoles] = useState<CkRol[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    // Si no hay bodega activa, mostramos vista vacía con mensaje claro.
    if (!bodegaId) {
      setPlantillas([])
      setAsignaciones([])
      setHistorial([])
      setRoles([])
      setError('Selecciona una bodega para ver los checklists.')
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    try {
      // Cargamos en paralelo. Si una falla, NO abortamos las otras.
      // El historial se carga sin filtro de fecha (modo "todo"). El
      // usuario puede elegir un día desde el datepicker de la tabla
      // y recargamos solo ese endpoint.
      const [pl, asg, hist, rols] = await Promise.allSettled([
        listarPlantillas(bodegaId),
        listarAsignaciones(bodegaId),
        apiHistorial(bodegaId, null),
        listarRoles(bodegaId),
      ])
      setPlantillas(pl.status === 'fulfilled' ? pl.value : [])
      setAsignaciones(asg.status === 'fulfilled' ? asg.value : [])
      setHistorial(hist.status === 'fulfilled' ? hist.value : [])
      setRoles(rols.status === 'fulfilled' ? rols.value : [])

      const errores = [pl, asg, hist, rols]
        .filter((r) => r.status === 'rejected')
        .map((r) => (r as PromiseRejectedResult).reason?.message ?? 'Error desconocido')
      if (errores.length === 4) {
        setError(errores[0])
      }
    } catch (e) {
      setError((e as Error).message ?? 'Error cargando el módulo')
    } finally {
      setLoading(false)
    }
  }, [bodegaId])

  useEffect(() => {
    void load()
  }, [load])

  return {
    plantillas,
    asignaciones,
    historial,
    roles,
    loading,
    error,
    bodegaId,
    reload: load,
  }
}
