import { useEffect, useState } from 'react'
import { api, ApiError } from '../lib/api'

export type Ubicacion = {
  id: string
  nombre: string
  bodegaId: string
}

const cachePorBodega = new Map<string, Ubicacion[]>()
/**
 * Versión del cache. Cuando el realtime notifica un cambio en
 * ubicaciones, incrementamos este contador para que el hook
 * `useUbicaciones` invalide el cache y vuelva a fetchear.
 */
let cacheVersion = 0

async function listarPorBodega(bodegaId: string): Promise<Ubicacion[]> {
  return api.get<Ubicacion[]>(`/ubicaciones?bodegaId=${encodeURIComponent(bodegaId)}`)
}

async function crear(input: { bodegaId: string; nombre: string }): Promise<Ubicacion> {
  const u = await api.post<Ubicacion>('/ubicaciones', input)
  const arr = cachePorBodega.get(input.bodegaId) ?? []
  cachePorBodega.set(input.bodegaId, [...arr, u])
  return u
}

async function eliminar(bodegaId: string, id: string): Promise<void> {
  await api.delete<void>(`/ubicaciones/${encodeURIComponent(id)}`)
  const arr = cachePorBodega.get(bodegaId)
  if (arr) cachePorBodega.set(bodegaId, arr.filter((u) => u.id !== id))
}

/** Invalida el cache de la bodega (y de paso todas). Usado por realtime. */
function invalidarCache() {
  cachePorBodega.clear()
  cacheVersion += 1
}

export const ubicacionesService = { listarPorBodega, crear, eliminar, invalidarCache }

/**
 * Hook que carga ubicaciones de una bodega con cache estable.
 * Devuelve un objeto con status + datos. Re-carga solo si cambia bodegaId
 * o si `cacheVersion` cambia (forzado por realtime).
 */
export function useUbicaciones(bodegaId: string | null) {
  const [state, setState] = useState<{
    status: 'idle' | 'cargando' | 'listo' | 'error'
    ubicaciones: Ubicacion[]
    error: string | null
  }>({ status: 'idle', ubicaciones: [], error: null })

  useEffect(() => {
    if (!bodegaId) {
      setState({ status: 'idle', ubicaciones: [], error: null })
      return
    }
    if (cachePorBodega.has(bodegaId)) {
      setState({ status: 'listo', ubicaciones: cachePorBodega.get(bodegaId)!, error: null })
      return
    }
    let cancelado = false
    setState({ status: 'cargando', ubicaciones: [], error: null })
    listarPorBodega(bodegaId)
      .then((data) => {
        if (cancelado) return
        cachePorBodega.set(bodegaId, data)
        setState({ status: 'listo', ubicaciones: data, error: null })
      })
      .catch((err) => {
        if (cancelado) return
        const msg = err instanceof ApiError ? err.message : 'Error al cargar ubicaciones.'
        setState({ status: 'error', ubicaciones: [], error: msg })
      })
    return () => {
      cancelado = true
    }
  }, [bodegaId, cacheVersion])

  return state
}
