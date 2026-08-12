import { useEffect, useRef, type ReactNode } from 'react'
import { X } from 'lucide-react'
import { Portal } from './Portal'

/**
 * Modal accesible y responsive para todo StockPro.
 *
 * Estructura:
 *   <Portal>
 *     <div overlay flex>          ← full-viewport, flex bottom-aligned
 *       <div dialog>              ← max-h-[100dvh] h-fit, flex-col
 *         <header sticky>         ← shrink-0
 *         <body scroll>           ← flex-1 min-h-0 overflow-y-auto
 *         <footer sticky>         ← shrink-0 (opcional)
 *       </div>
 *     </div>
 *   </Portal>
 *
 * Estrategia de posición:
 *   - SIEMPRE anclado al borde inferior (bottom-sheet), en mobile Y desktop.
 *   - En desktop, dejamos 16px de aire arriba + a los costados para que no
 *     toque los bordes del viewport. El modal "flota" hacia abajo.
 *   - Esto garantiza que el footer (con los botones primarios) SIEMPRE sea
 *     visible sin importar cuánto contenido tenga el body.
 *   - Si el contenido es corto, el modal se queda con su altura natural
 *     pegado al fondo (centrado verticalmente queda implícito).
 *
 * Features:
 *   - Header sticky con título + botón cerrar (touch target 44px).
 *   - Body scrolleable con `min-h-0` (clave para flex + max-h).
 *   - Footer sticky opcional (botones siempre visibles al hacer scroll).
 *   - Cierra con `Escape` y al click sobre el overlay.
 *   - `role="dialog"`, `aria-modal="true"`, `aria-labelledby` al título.
 *   - Foco inicial al primer input enfocable del body (o `initialFocusRef.current`).
 *   - Respeta `safe-area-inset-bottom` en iOS con notch.
 *
 * Notas:
 *   - El consumidor controla la lógica de submit dentro de `children`.
 *   - Si necesitás click-fuera, pasá `dismissOnOverlay` (default true).
 *   - `size`: 'sm' (max-w-md) | 'md' (max-w-xl) | 'lg' (max-w-3xl) | 'xl' (max-w-5xl) | 'full' (max-w-[min(96vw,1200px)])
 */
type ModalSize = 'sm' | 'md' | 'lg' | 'xl' | 'full'

type ModalProps = {
  open: boolean
  onClose: () => void
  title: string
  description?: string
  /** Icono lucide-react que se muestra junto al título. */
  icon?: ReactNode
  /** Contenido principal. Si querés un formulario, pasá un <form> como children. */
  children: ReactNode
  /** Footer con acciones (botones). Se renderiza con borde arriba y padding safe-area. */
  footer?: ReactNode
  /** Tamaño máximo del modal. Default 'md'. */
  size?: ModalSize
  /** Cierra al click en el overlay. Default true. */
  dismissOnOverlay?: boolean
  /** Si true, previene el scroll del body mientras el modal está abierto. Default true. */
  lockScroll?: boolean
  /** className extra para el contenedor interno del modal. */
  contentClassName?: string
  /** Ref opcional al elemento que debe recibir foco al abrir. */
  initialFocusRef?: React.RefObject<HTMLElement>
}

const sizeClass: Record<ModalSize, string> = {
  sm: 'max-w-md',
  md: 'max-w-xl',
  lg: 'max-w-3xl',
  xl: 'max-w-5xl',
  full: 'max-w-[min(96vw,1200px)]',
}

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

export function Modal({
  open,
  onClose,
  title,
  description,
  icon,
  children,
  footer,
  size = 'md',
  dismissOnOverlay = true,
  lockScroll = true,
  contentClassName = '',
  initialFocusRef,
}: ModalProps) {
  const dialogRef = useRef<HTMLDivElement | null>(null)
  const previousActiveRef = useRef<HTMLElement | null>(null)

  // Cierre con Escape + restauración de foco al cerrar
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onClose])

  // Lock scroll del body mientras el modal está abierto
  useEffect(() => {
    if (!open || !lockScroll) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [open, lockScroll])

  // Foco inicial: guardamos el activo, movemos al dialog (o primer focusable).
  useEffect(() => {
    if (!open) return
    previousActiveRef.current = (document.activeElement as HTMLElement) || null
    // Pequeño delay para que el contenido se haya montado
    const t = window.setTimeout(() => {
      if (initialFocusRef?.current) {
        initialFocusRef.current.focus()
        return
      }
      const root = dialogRef.current
      if (!root) return
      const first = root.querySelector<HTMLElement>(FOCUSABLE_SELECTOR)
      if (first) {
        first.focus()
      } else {
        root.focus()
      }
    }, 0)
    return () => {
      window.clearTimeout(t)
      // Restaurar foco al elemento que abrió el modal
      const prev = previousActiveRef.current
      if (prev && typeof prev.focus === 'function') {
        prev.focus()
      }
    }
  }, [open])

  // Focus trap básico: Tab/Shift+Tab cicla dentro del modal
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return
      const root = dialogRef.current
      if (!root) return
      const focusables = Array.from(
        root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
      ).filter((el) => !el.hasAttribute('aria-hidden'))
      if (focusables.length === 0) {
        e.preventDefault()
        return
      }
      const first = focusables[0]
      const last = focusables[focusables.length - 1]
      const active = document.activeElement as HTMLElement | null
      if (e.shiftKey) {
        if (active === first || !root.contains(active)) {
          e.preventDefault()
          last.focus()
        }
      } else {
        if (active === last) {
          e.preventDefault()
          first.focus()
        }
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open])

  if (!open) return null

  return (
    <Portal>
      {/* Overlay: full viewport.
          - En mobile (<sm): items-end → modal ancla al borde inferior
            (bottom-sheet pattern, cómodo para el pulgar).
          - En PC (≥sm): items-center → modal centrado vertical y
            horizontalmente (patrón de dialog estándar de escritorio). */}
      <div
        className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
        onClick={dismissOnOverlay ? onClose : undefined}
        aria-hidden="true"
      >
        {/* Dialog: max-h-[100dvh] (en mobile) / 92dvh (desktop) para que
            NUNCA exceda el viewport. flex-col para sticky header/footer.
            En mobile corners: top redondeados, bottom planos.
            En desktop: las 4 esquinas redondeadas. */}
        <div
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-title"
          tabIndex={-1}
          onClick={(e) => e.stopPropagation()}
          className={[
            'bg-card border border-border w-full',
            'flex flex-col',
            'max-h-[100dvh] sm:max-h-[92dvh]',
            sizeClass[size],
            'overflow-hidden',
            'rounded-t-2xl sm:rounded-2xl',
            'pb-[env(safe-area-inset-bottom)]',
            contentClassName,
          ].join(' ')}
        >
          {/* Header sticky */}
          <div
            className="flex items-center justify-between gap-3 p-4 sm:p-5 border-b border-border shrink-0"
            style={{ paddingTop: 'max(1rem, env(safe-area-inset-top))' }}
          >
            <div className="flex items-center gap-3 min-w-0">
              {icon && (
                <div className="w-9 h-9 bg-primary/15 flex items-center justify-center shrink-0">
                  {icon}
                </div>
              )}
              <div className="min-w-0">
                <h2
                  id="modal-title"
                  className="text-lg sm:text-xl uppercase text-foreground leading-none truncate"
                  style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900 }}
                >
                  {title}
                </h2>
                {description && (
                  <p
                    className="mt-1 text-xs text-muted-foreground line-clamp-2"
                    style={{ fontFamily: "'DM Sans', sans-serif" }}
                  >
                    {description}
                  </p>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Cerrar"
              className="shrink-0 min-w-[44px] min-h-[44px] -mr-2 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
            >
              <X size={18} />
            </button>
          </div>

          {/* Body scrolleable: flex-1 min-h-0 es la combinación mágica
              que permite scrollear dentro de un flex-col con max-h. */}
          <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain">
            {children}
          </div>

          {/* Footer sticky: SIEMPRE visible al final del dialog. */}
          {footer && (
            <div
              className="p-4 border-t border-border shrink-0 bg-card"
              style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}
            >
              {footer}
            </div>
          )}
        </div>
      </div>
    </Portal>
  )
}
