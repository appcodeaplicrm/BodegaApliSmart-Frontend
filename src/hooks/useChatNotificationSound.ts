/**
 * Hook para reproducir el sonido de notificación del chat.
 *
 * El sonido se reproduce cuando llega un mensaje NUEVO a una
 * conversación que el user NO está mirando activamente:
 *  - No está en la ruta `/chat`, o
 *  - Está en `/chat` pero la conversación activa NO es la del
 *    mensaje nuevo.
 *
 * Además: si el documento está oculto (otra pestaña), también
 * suena (criterio Slack/Discord).
 *
 * Notas técnicas:
 *  - Los browsers bloquean `audio.play()` hasta que el user haya
 *    interactuado con la página. La primera vez que se llama a
 *    `play()`, se "desbloquea" el audio para futuras llamadas
 *    (el browser recuerda que hubo interacción).
 *  - Usamos un único `<audio>` element, pre-instanciado, para
 *    que el sonido arranque sin delay (sin tener que crear el
 *    element cada vez).
 *  - Throttle: si llegan 5 mensajes en 1 segundo, NO reproducimos
 *    5 veces. Uno solo, y el próximo se reproduce después de 2s.
 */

import { useCallback, useEffect, useRef } from 'react'

const SOUND_SRC = '/sounds/chat-notification.mp3'
const THROTTLE_MS = 2000

export function useChatNotificationSound() {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const lastPlayedRef = useRef<number>(0)

  // Creamos el <audio> element una sola vez. El browser
  // lo carga pero no lo reproduce hasta que llamemos a
  // .play(). Como está en el DOM (vía `new Audio()`), el
  // browser ya lo "conoce" y el primer play() no tiene
  // delay por carga.
  useEffect(() => {
    const audio = new Audio(SOUND_SRC)
    audio.preload = 'auto'
    // Volumen por defecto. Lo dejo así; si querés bajarlo,
    // mover a un control en el UI más adelante.
    audio.volume = 0.6
    audioRef.current = audio
    return () => {
      audio.pause()
      audio.src = ''
      audioRef.current = null
    }
  }, [])

  const play = useCallback(() => {
    const audio = audioRef.current
    if (!audio) return
    const now = Date.now()
    if (now - lastPlayedRef.current < THROTTLE_MS) return
    lastPlayedRef.current = now
    // Volvemos al inicio por si quedó a mitad de reproducción.
    audio.currentTime = 0
    const p = audio.play()
    if (p && typeof p.catch === 'function') {
      // El browser puede rechazar el play() (ej. si no hubo
      // interacción previa). Lo tragamos silenciosamente;
      // al primer click del user ya queda desbloqueado.
      p.catch(() => {
        /* noop */
      })
    }
  }, [])

  return { play }
}
