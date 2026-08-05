/**
 * Hook genérico para suscribirse a un evento del WebSocket.
 *
 * Ejemplo:
 *
 *   useRealtimeEvent<Movimiento>('movimiento.created', (event) => {
 *     setMovimientos((prev) => [event.payload, ...prev])
 *   })
 *
 * El hook se encarga de:
 *  - Obtener el socket (lazy, vía getSocket()).
 *  - Suscribirse al canal `realtime:${eventType}`.
 *  - Limpiar la suscripción al desmontar.
 *  - Si `options.skip` es true, no se suscribe (útil para vistas
 *    condicionales o para usuarios sin permiso).
 *
 * El evento recibido tiene la forma estandarizada:
 *   { id, type, adminId, bodegaId, timestamp, actorId, payload }
 */
import { useEffect } from 'react'
import { getSocket } from '../lib/socket'

export type RealtimeEvent<T = unknown> = {
  id: string
  type: string
  adminId: string
  bodegaId: string | null
  timestamp: string
  actorId: string
  payload: T
}

type Handler<T> = (event: RealtimeEvent<T>) => void

export function useRealtimeEvent<T = unknown>(
  eventType: string,
  handler: Handler<T>,
  options?: { skip?: boolean },
): void {
  useEffect(() => {
    if (options?.skip) return
    const socket = getSocket()
    if (!socket) return
    const channel = `realtime:${eventType}`
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const wrapped = (event: any) => handler(event as RealtimeEvent<T>)
    socket.on(channel, wrapped)
    return () => {
      socket.off(channel, wrapped)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventType, options?.skip])
}
