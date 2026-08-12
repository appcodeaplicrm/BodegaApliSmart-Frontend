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
import { useEffect, useRef } from 'react'
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
  // Guardamos el handler en una ref para que la suscripción se haga UNA
  // sola vez (al montar/cambiar eventType) pero el handler que se
  // ejecuta sea siempre el más reciente. Esto evita:
  //   - handlers "viejos" con state obsoleto (bodegaActiva, navigate, etc.)
  //   - re-suscripciones innecesarias en cada render que duplicarían
  //     listeners en el socket.
  const handlerRef = useRef<Handler<T>>(handler)
  useEffect(() => {
    handlerRef.current = handler
  }, [handler])

  useEffect(() => {
    if (options?.skip) return
    // Si el socket aún no está listo (getSocket devolvió null porque el
    // usuario se está autenticando), reintentamos cuando conecte.
    // Esto evita la race condition de montar este hook ANTES que
    // el RealtimeProvider haya llamado a getSocket().
    let unsub: (() => void) | null = null
    let cancelled = false

    const trySubscribe = () => {
      if (cancelled) return
      const socket = getSocket()
      if (!socket) {
        // Reintentar en el próximo tick (cuando el provider ya creó el socket)
        setTimeout(trySubscribe, 50)
        return
      }
      const channel = `realtime:${eventType}`
      const wrapped = (event: unknown) => handlerRef.current(event as RealtimeEvent<T>)
      socket.on(channel, wrapped)
      unsub = () => socket.off(channel, wrapped)
    }

    trySubscribe()

    return () => {
      cancelled = true
      if (unsub) unsub()
    }
  }, [eventType, options?.skip])
}
