import { useSyncExternalStore } from 'react'
import { api, ApiError } from '../lib/api'

export type UnidadMedida = {
  id: string
  nombre: string
  abreviatura: string
  permiteDecimales: boolean
  activo: boolean
}

type Estado =
  | { status: 'idle' }
  | { status: 'cargando' }
  | { status: 'listo'; unidades: UnidadMedida[] }
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
    if (cacheSnapshot.unidades !== e.unidades) {
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

export const unidadesMedidaStore = {
  subscribe,
  getSnapshot,

  async cargar(soloActivas = true): Promise<UnidadMedida[]> {
    if (estado.status === 'listo') return estado.unidades
    setEstado({ status: 'cargando' })
    try {
      const unidades = await api.get<UnidadMedida[]>(
        `/unidades-medida?soloActivas=${soloActivas}`,
      )
      setEstado({ status: 'listo', unidades })
      return unidades
    } catch (err) {
      const mensaje =
        err instanceof ApiError ? err.message : 'No se pudieron cargar las unidades.'
      setEstado({ status: 'error', mensaje })
      throw err
    }
  },

  reset() {
    setEstado({ status: 'idle' })
  },
}

export function useUnidadesMedida() {
  return useSyncExternalStore(
    unidadesMedidaStore.subscribe,
    unidadesMedidaStore.getSnapshot,
    unidadesMedidaStore.getSnapshot,
  )
}
