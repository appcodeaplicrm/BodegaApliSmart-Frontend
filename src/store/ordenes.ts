import { useSyncExternalStore } from 'react'

export type EstadoOrden = 'EN PROCESO' | 'APROBADO' | 'CANCELADO'

export type ItemOrden = {
  id: string
  producto: string
  cantidad: number
}

export type Orden = {
  id: string
  /** código corto, ej: ORD-0001 */
  codigo: string
  operadorId: string
  operadorNombre: string
  operadorRol: string
  bodega: string
  items: ItemOrden[]
  motivo: string
  estado: EstadoOrden
  createdAt: number
  createdAtLabel: string
  /** aprobación */
  aprobadaPor?: string
  aprobadaAt?: number
  aprobadaAtLabel?: string
  fotoEvidencia?: string | null
  /** cancelación */
  canceladaPor?: string
  canceladaAt?: number
  canceladaAtLabel?: string
  motivoCancelacion?: string
}

type Listener = () => void

let ordenes: Orden[] = []
let nextId = 1
const listeners = new Set<Listener>()

function emit() {
  listeners.forEach((l) => l())
}

function subscribe(l: Listener) {
  listeners.add(l)
  return () => {
    listeners.delete(l)
  }
}

function getSnapshot() {
  return ordenes
}

function makeCodigo(n: number) {
  return `ORD-${String(n).padStart(4, '0')}`
}

function nowLabel() {
  return new Date().toLocaleString('es-CO', {
    dateStyle: 'short',
    timeStyle: 'short',
  })
}

export const ordenesStore = {
  subscribe,
  getSnapshot,
  crear(input: {
    operadorId: string
    operadorNombre: string
    operadorRol: string
    bodega: string
    items: ItemOrden[]
    motivo: string
  }): Orden {
    const id = `o-${Date.now()}-${nextId}`
    const codigo = makeCodigo(nextId)
    nextId += 1
    const orden: Orden = {
      id,
      codigo,
      operadorId: input.operadorId,
      operadorNombre: input.operadorNombre,
      operadorRol: input.operadorRol,
      bodega: input.bodega,
      items: input.items,
      motivo: input.motivo,
      estado: 'EN PROCESO',
      createdAt: Date.now(),
      createdAtLabel: nowLabel(),
    }
    ordenes = [orden, ...ordenes]
    emit()
    return orden
  },
  aprobar(id: string, params: { aprobadaPor: string; foto: string | null }) {
    ordenes = ordenes.map((o) =>
      o.id === id
        ? {
            ...o,
            estado: 'APROBADO' as EstadoOrden,
            aprobadaPor: params.aprobadaPor,
            aprobadaAt: Date.now(),
            aprobadaAtLabel: nowLabel(),
            fotoEvidencia: params.foto,
          }
        : o,
    )
    emit()
  },
  cancelar(id: string, params: { canceladaPor: string; motivo: string }) {
    ordenes = ordenes.map((o) =>
      o.id === id
        ? {
            ...o,
            estado: 'CANCELADO' as EstadoOrden,
            canceladaPor: params.canceladaPor,
            canceladaAt: Date.now(),
            canceladaAtLabel: nowLabel(),
            motivoCancelacion: params.motivo,
          }
        : o,
    )
    emit()
  },
}

export function useOrdenes() {
  return useSyncExternalStore(ordenesStore.subscribe, ordenesStore.getSnapshot, ordenesStore.getSnapshot)
}
