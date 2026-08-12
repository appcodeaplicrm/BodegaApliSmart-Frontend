import { useSyncExternalStore } from 'react'
import { api, ApiError } from '../lib/api'

/* ─── Tipos ───────────────────────────────────── */

export type KitItem = {
  id: string
  productoId: string
  cantidad: number
  producto: {
    id: string
    codigo: string
    nombre: string
    /** Unidad de medida del producto (expuesta por el back en listar/findOne). */
    unidadMedida?: {
      id: string
      abreviatura: string
      permiteDecimales: boolean
    }
  }
}

export type KitDisponibilidad = 'disponible' | 'parcial' | 'agotado'

export type KitItemConStock = {
  productoId: string
  codigo: string
  nombre: string
  /** Cantidad que el kit pide de este producto (por unidad de kit). */
  cantidadKit: number
  /** Stock actual del producto en la bodega del kit. */
  stock: number
  /** Stock mínimo requerido. */
  stockMinimo: number
  /** Unidad de medida del producto (abreviatura). */
  unidad: string | null
}

export type Kit = {
  id: string
  codigo: string
  nombre: string
  descripcion: string | null
  bodegaId: string
  activo: boolean
  createdAt: string
  items: KitItem[]
  /** Calculado por el back en listar(): estado del kit según stock. */
  disponibilidad?: {
    estado: KitDisponibilidad
    items: KitItemConStock[]
  }
}

export type CreateKitInput = {
  bodegaId: string
  nombre: string
  descripcion?: string
  items: Array<{ productoId: string; cantidad: number }>
}

export type UpdateKitInput = {
  nombre?: string
  descripcion?: string
  items?: Array<{ productoId: string; cantidad: number }>
  activo?: boolean
}

/* ─── Store ───────────────────────────────────── */

type Estado =
  | { status: 'idle' }
  | { status: 'cargando' }
  | { status: 'listo'; kits: Kit[] }
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
    if (cacheSnapshot.kits !== e.kits) {
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

export const kitsStore = {
  subscribe,
  getSnapshot,

  async cargar(bodegaId?: string): Promise<Kit[]> {
    setEstado({ status: 'cargando' })
    try {
      const path = bodegaId ? `/kits?bodegaId=${encodeURIComponent(bodegaId)}` : '/kits'
      const data = await api.get<Kit[]>(path)
      setEstado({ status: 'listo', kits: data })
      return data
    } catch (err) {
      const mensaje = err instanceof ApiError ? err.message : 'No se pudieron cargar los kits.'
      setEstado({ status: 'error', mensaje })
      throw err
    }
  },

  async findOne(id: string): Promise<Kit> {
    return api.get<Kit>(`/kits/${encodeURIComponent(id)}`)
  },

  async crear(input: CreateKitInput): Promise<Kit> {
    const data = await api.post<Kit>('/kits', input)
    if (estado.status === 'listo') {
      setEstado({ status: 'listo', kits: [data, ...estado.kits] })
    }
    return data
  },

  async actualizar(id: string, input: UpdateKitInput): Promise<Kit> {
    const data = await api.patch<Kit>(`/kits/${encodeURIComponent(id)}`, input)
    if (estado.status === 'listo') {
      setEstado({
        status: 'listo',
        kits: estado.kits.map((k) => (k.id === id ? data : k)),
      })
    }
    return data
  },

  async eliminar(id: string): Promise<void> {
    await api.delete<void>(`/kits/${encodeURIComponent(id)}`)
    if (estado.status === 'listo') {
      setEstado({
        status: 'listo',
        kits: estado.kits.filter((k) => k.id !== id),
      })
    }
  },

  reset() {
    setEstado({ status: 'idle' })
  },
}

export function useKits() {
  return useSyncExternalStore(kitsStore.subscribe, kitsStore.getSnapshot, kitsStore.getSnapshot)
}
