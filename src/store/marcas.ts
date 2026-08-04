import { useSyncExternalStore } from 'react'
import { api, ApiError } from '../lib/api'

export type Marca = {
  id: string
  nombre: string
}

type Estado =
  | { status: 'idle' }
  | { status: 'cargando' }
  | { status: 'listo'; marcas: Marca[]; bodegaId?: string }
  | { status: 'error'; mensaje: string }

let estado: Estado = { status: 'idle' }
let cacheSnapshot: Estado = estado
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
function getSnapshot(): Estado {
  const e = estado
  if (cacheSnapshot === e) return cacheSnapshot
  if (cacheSnapshot.status !== e.status) {
    cacheSnapshot = e
    return cacheSnapshot
  }
  if (e.status === 'listo' && cacheSnapshot.status === 'listo') {
    if (cacheSnapshot.marcas !== e.marcas) {
      cacheSnapshot = e
      return cacheSnapshot
    }
  } else if (e.status === 'error' && cacheSnapshot.status === 'error') {
    if (cacheSnapshot.mensaje !== e.mensaje) {
      cacheSnapshot = e
      return cacheSnapshot
    }
  }
  return cacheSnapshot
}
function setEstado(next: Estado) {
  estado = next
  emit()
}

export const marcasStore = {
  subscribe,
  getSnapshot,

  async cargar(bodegaId?: string): Promise<Marca[]> {
    // Sin bodegaId → no pegamos al back (el endpoint lo requiere)
    if (!bodegaId) {
      setEstado({ status: 'listo', marcas: [] })
      return []
    }
    // Si ya hay datos para esta bodega, los devolvemos sin re-pegar
    if (estado.status === 'listo' && estado.bodegaId === bodegaId) {
      return estado.marcas
    }
    setEstado({ status: 'cargando' })
    try {
      const marcas = await api.get<Marca[]>(`/marcas?bodegaId=${encodeURIComponent(bodegaId)}`)
      setEstado({ status: 'listo', marcas, bodegaId })
      return marcas
    } catch (err) {
      const mensaje = err instanceof ApiError ? err.message : 'No se pudieron cargar las marcas.'
      setEstado({ status: 'error', mensaje })
      throw err
    }
  },

  async crear(input: { nombre: string; bodegaId: string }): Promise<Marca> {
    const marca = await api.post<Marca>('/marcas', input)
    if (estado.status === 'listo') {
      setEstado({ status: 'listo', marcas: [...estado.marcas, marca], bodegaId: input.bodegaId })
    }
    return marca
  },

  reset() {
    setEstado({ status: 'idle' })
  },
}

export function useMarcas() {
  return useSyncExternalStore(marcasStore.subscribe, marcasStore.getSnapshot, marcasStore.getSnapshot)
}
