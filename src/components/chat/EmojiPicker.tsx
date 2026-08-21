/**
 * Picker de emojis nativo (sin librería externa).
 *
 * Mostramos un set curado de los emojis más usados en chat. Si más
 * adelante queremos el catálogo Unicode completo, se puede cambiar
 * por emoji-mart (1.5MB) o twemoji, pero para V1 esto basta.
 *
 * UX: popover anclado al botón que lo abre. Click fuera → cierra.
 */

import { useEffect, useRef, useState } from 'react'

const EMOJIS_POPULARES = [
  '😀','😃','😄','😁','😆','😅','😂','🤣','😊','😇',
  '🙂','🙃','😉','😌','😍','🥰','😘','😗','😙','😚',
  '😋','😛','😝','😜','🤪','🤨','🧐','🤓','😎','🤩',
  '🥳','😏','😒','😞','😔','😟','😕','🙁','☹️','😣',
  '😖','😫','😩','🥺','😢','😭','😤','😠','😡','🤬',
  '🤯','😳','🥵','🥶','😱','😨','😰','😥','😓','🤗',
  '🤔','🤭','🤫','🤥','😶','😐','😑','😬','🙄','😯',
  '😦','😧','😮','😲','🥱','😴','🤤','😪','😵','🤐',
  '🥴','🤢','🤮','🤧','😷','🤒','🤕','🤑','🤠','😈',
  '👍','👎','👌','✌️','🤞','🤟','🤘','🤙','👈','👉',
  '👆','👇','☝️','✋','🤚','🖐','🖖','👋','🤝','🙏',
  '💪','🦵','🦶','👂','👃','🧠','👀','👁','👄','👅',
  '❤️','🧡','💛','💚','💙','💜','🖤','🤍','🤎','💔',
  '❣️','💕','💞','💓','💗','💖','💘','💝','💟','☮️',
  '✝️','☪️','🕉','☸️','✡️','🔯','🕎','☯️','☦️','🛐',
  '⛎','♈','♉','♊','♋','♌','♍','♎','♏','♐',
  '🎉','🎊','🎁','🎂','🍰','🍕','🍔','🍟','☕','🍺',
  '🔥','✨','⭐','🌟','💯','💥','💫','💢','💨','💦',
]

type Props = {
  onEmoji: (emoji: string) => void
  /** Botón que abre el popover. Si no se pasa, renderiza un botón
   *  propio con el ícono de carita. */
  children?: React.ReactNode
  /** Tamaño del popover. */
  size?: 'sm' | 'md'
}

export function EmojiPicker({ onEmoji, children, size = 'md' }: Props) {
  const [open, setOpen] = useState(false)
  const wrapperRef = useRef<HTMLDivElement | null>(null)

  // Cerrar al click fuera / Escape.
  useEffect(() => {
    if (!open) return
    const onClick = (e: MouseEvent) => {
      if (!wrapperRef.current?.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const cellSize = size === 'sm' ? 'w-7 h-7 text-base' : 'w-8 h-8 text-lg'
  const gridCols = size === 'sm' ? 'grid-cols-10' : 'grid-cols-12'

  return (
    <div ref={wrapperRef} className="relative">
      {children ? (
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-label="Emojis"
          aria-expanded={open}
        >
          {children}
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="inline-flex items-center justify-center w-8 h-8 text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Emojis"
          aria-expanded={open}
        >
          <span className="text-lg">😊</span>
        </button>
      )}
      {open && (
        <div
          className="absolute z-50 bottom-full mb-2 right-0 bg-card border border-border shadow-lg p-2 w-[300px] sm:w-[360px]"
          style={{ borderRadius: '0.375rem' }}
          role="dialog"
          aria-label="Emojis"
        >
          <div className={`grid ${gridCols} gap-0.5 max-h-64 overflow-y-auto`}>
            {EMOJIS_POPULARES.map((e) => (
              <button
                key={e}
                type="button"
                onClick={() => {
                  onEmoji(e)
                  setOpen(false)
                }}
                className={`${cellSize} inline-flex items-center justify-center hover:bg-muted/60 transition-colors`}
                style={{ borderRadius: '0.125rem' }}
              >
                {e}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
