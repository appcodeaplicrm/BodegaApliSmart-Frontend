import { useSyncExternalStore } from 'react'
import { api, ApiError } from '../lib/api'

export type NivelAlerta = 'Advertencia' | 'Critica'

export type AlertaStock = {
  id: string
  nivel: NivelAlerta
  mensaje: string
  atendida: boolean
  createdAt: string
  updatedAt: string
  producto: {
    id: string
    nombre: string
    codigo: string
    stockMinimo: number
  }
  bodega: { id: string; nombre: string }
}

type Estado =
  | { status: 'idle' }
  | { status: 'cargando'; bodegaId: string | null }
  | { status: 'listo'; alertas: AlertaStock[]; bodegaId: string }
  | { status: 'error'; mensaje: string; bodegaId: string | null }

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
    if (cacheSnapshot.bodegaId !== e.bodegaId || cacheSnapshot.alertas !== e.alertas) {
      cacheSnapshot = e
      return cacheSnapshot
    }
  } else if (e.status === 'error' && cacheSnapshot.status === 'error') {
    if (cacheSnapshot.bodegaId !== e.bodegaId || cacheSnapshot.mensaje !== e.mensaje) {
      cacheSnapshot = e
      return cacheSnapshot
    }
  } else if (e.status === 'cargando' && cacheSnapshot.status === 'cargando') {
    if (cacheSnapshot.bodegaId !== e.bodegaId) {
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

export const alertasStore = {
  subscribe,
  getSnapshot,

  async cargar(bodegaId: string, soloActivas = true): Promise<AlertaStock[]> {
    if (
      estado.status === 'listo' &&
      estado.bodegaId === bodegaId
    ) {
      return estado.alertas
    }
    setEstado({ status: 'cargando', bodegaId })
    try {
      const alertas = await api.get<AlertaStock[]>(
        `/alertas?bodegaId=${encodeURIComponent(bodegaId)}&soloActivas=${soloActivas}`,
      )
      setEstado({ status: 'listo', alertas, bodegaId })
      return alertas
    } catch (err) {
      const mensaje = err instanceof ApiError ? err.message : 'No se pudieron cargar las alertas.'
      setEstado({ status: 'error', mensaje, bodegaId })
      throw err
    }
  },

  async atender(id: string, atendida = true): Promise<AlertaStock> {
    const updated = await api.patch<AlertaStock>(
      `/alertas/${encodeURIComponent(id)}`,
      { atendida },
    )
    if (estado.status === 'listo') {
      if (atendida) {
        // Sacar de la lista si estamos viendo solo activas
        setEstado({
          status: 'listo',
          bodegaId: estado.bodegaId,
          alertas: estado.alertas.filter((a) => a.id !== id),
        })
      } else {
        // Reabrir: actualizar o insertar
        const idx = estado.alertas.findIndex((a) => a.id === id)
        if (idx >= 0) {
          const nueva = [...estado.alertas]
          nueva[idx] = updated
          setEstado({ status: 'listo', bodegaId: estado.bodegaId, alertas: nueva })
        } else {
          setEstado({
            status: 'listo',
            bodegaId: estado.bodegaId,
            alertas: [updated, ...estado.alertas],
          })
        }
      }
    }
    return updated
  },

  reset() {
    setEstado({ status: 'idle' })
  },

  /**
   * Handler para el evento realtime `alerta.created`.
   * Inserta la alerta arriba de la lista si la bodega coincide con la actual
   * y estamos mostrando solo activas.
   *
   * Si la bodega del evento no coincide con la que tiene el usuario cargada,
   * lo ignora (cada usuario ve solo su bodega activa).
   */
  handleAlertaCreada(event: { bodegaId: string | null; payload: AlertaStock }) {
    if (estado.status !== 'listo') return
    if (event.bodegaId !== estado.bodegaId) return
    // Si estamos mostrando solo activas y la nueva ya viene atendida, ignorar
    if (event.payload.atendida) return
    // Deduplicar: si ya existe, no insertar
    if (estado.alertas.some((a) => a.id === event.payload.id)) return
    setEstado({
      status: 'listo',
      bodegaId: estado.bodegaId,
      alertas: [event.payload, ...estado.alertas],
    })
  },

  /**
   * Handler para el evento realtime `alerta.resolved`.
   * Saca la alerta de la lista si la estamos mostrando (asumimos
   * que la vista actual muestra solo activas, que es el default).
   */
  handleAlertaResuelta(event: { id: string; bodegaId: string | null }) {
    if (estado.status !== 'listo') return
    if (event.bodegaId !== estado.bodegaId) return
    if (!estado.alertas.some((a) => a.id === event.id)) return
    setEstado({
      status: 'listo',
      bodegaId: estado.bodegaId,
      alertas: estado.alertas.filter((a) => a.id !== event.id),
    })
  },
}

export function useAlertas() {
  return useSyncExternalStore(alertasStore.subscribe, alertasStore.getSnapshot, alertasStore.getSnapshot)
}
