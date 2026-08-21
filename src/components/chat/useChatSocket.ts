/**
 * Hook específico del chat para eventos WS.
 *
 * Eventos que escuchamos:
 *  - `realtime:chat.mensaje-nuevo`     → push de mensaje nuevo.
 *  - `realtime:chat.mensaje-eliminado` → mensaje soft-deleted.
 *  - `realtime:chat.leido-actualizado` → alguien marcó leído.
 *  - `realtime:chat.reaccion-cambiada` → cambió una reacción.
 *  - `chat:escribiendo`                → efímero (el otro está escribiendo).
 *  - `chat:dejo-de-escribir`           → efímero (dejó de escribir).
 *
 * El front también se "une" a la room de la conversación
 * (`chat:conv:${id}`) para recibir los eventos efímeros. Eso lo
 * hace el componente que abre la conversación (panel).
 */

import { useEffect } from 'react'
import { getSocket } from '../../lib/socket'
import type { ChatMensaje, EscribiendoEvent } from './types'

type Handler<T> = (payload: T) => void

/**
 * Suscribe a un canal WS del chat. Se suscribe UNA vez al montar
 * (mira el patrón de `useRealtimeEvent`).
 */
export function useChatWsEvent<T = unknown>(
  channel: string,
  handler: Handler<T>,
): void {
  useEffect(() => {
    let unsub: (() => void) | null = null
    let cancelled = false
    const trySub = () => {
      if (cancelled) return
      const s = getSocket()
      if (!s) {
        setTimeout(trySub, 50)
        return
      }
      const wrapped = (e: unknown) => handler(e as T)
      s.on(channel, wrapped)
      unsub = () => s.off(channel, wrapped)
    }
    trySub()
    return () => {
      cancelled = true
      if (unsub) unsub()
    }
    // handler va en el closure de `useEffect`; lo cambiamos cuando
    // el componente lo recrea (igual que en useRealtimeEvent).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channel])
}

/**
 * Helper para unirse / salir de la room de una conversación.
 * Llamar al abrir/cerrar la conv.
 */
export function chatUnirse(conversacionId: string): void {
  const s = getSocket()
  if (!s?.connected) return
  s.emit('chat:unirse', { conversacionId })
}

export function chatSalir(conversacionId: string): void {
  const s = getSocket()
  if (!s?.connected) return
  s.emit('chat:salir', { conversacionId })
}

export function chatEscribiendo(conversacionId: string): void {
  const s = getSocket()
  if (!s?.connected) return
  s.emit('chat:escribiendo', { conversacionId })
}

export function chatDejoDeEscribir(conversacionId: string): void {
  const s = getSocket()
  if (!s?.connected) return
  s.emit('chat:dejo-de-escribir', { conversacionId })
}

// Re-export del tipo de mensaje nuevo, útil para los handlers.
export type { ChatMensaje, EscribiendoEvent }
