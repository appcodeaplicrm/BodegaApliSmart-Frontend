import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { AlertTriangle, X, Loader2 } from 'lucide-react'

/**
 * Modal de confirmación reusable.
 *
 * Reemplaza al `confirm()` nativo del browser. Renderiza un portal a
 * `document.body` para evitar clipping por padres con `overflow:hidden`
 * o `transform`. Backdrop + animación suave de entrada.
 *
 * Pensado para confirmaciones destructivas o importantes: "Quitar foto",
 * "Eliminar plantilla", "Cancelar pedido", etc.
 *
 * Variantes:
 *   - `tone="danger"`  → rojo, para acciones destructivas (default)
 *   - `tone="primary"` → naranja, para acciones normales de confirmación
 *
 * Estado:
 *   - `loading` deshabilita los botones y muestra spinner en "Confirmar"
 *   - `error` muestra un banner rojo inline arriba de los botones
 *
 * Uso típico:
 *   <ConfirmModal
 *     open={show}
 *     onClose={() => setShow(false)}
 *     onConfirm={async () => { await api.delete(...) }}
 *     title="¿Quitar tu foto de perfil?"
 *     description="Volverás a ver tus iniciales."
 *     confirmLabel="Quitar foto"
 *     tone="danger"
 *   />
 */
export function ConfirmModal({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  tone = 'danger',
}: {
  open: boolean
  onClose: () => void
  /** Async; resuelve cuando termina. Errores se muestran inline. */
  onConfirm: () => Promise<void> | void
  title: string
  description?: string
  confirmLabel?: string
  cancelLabel?: string
  tone?: 'danger' | 'primary'
}) {
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Resetear estado cada vez que se (re)abre.
  useEffect(() => {
    if (open) {
      setSubmitting(false)
      setError(null)
    }
  }, [open])

  // Cerrar con Escape (solo si no está procesando).
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !submitting) onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, submitting, onClose])

  if (!open) return null

  async function handleConfirm() {
    setSubmitting(true)
    setError(null)
    try {
      await onConfirm()
      // Si no lanzó error, el padre probablemente ya cerró el modal
      // (porque limpia el state en su `finally`). Pero por si no lo
      // hizo, no cerramos nosotros: dejamos que el padre decida.
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo completar la acción.')
      setSubmitting(false)
    }
  }

  const accent = tone === 'danger' ? '#E8593F' : '#E8593F' // ambos usan primary naranja como accent; danger cambia el borde/texto del icono
  const confirmBg = tone === 'danger' ? 'bg-primary' : 'bg-primary'
  const confirmHover = 'hover:opacity-90'

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.65)' }}
      onMouseDown={(e) => {
        // Cerrar al clickar el backdrop (no al click dentro del modal).
        if (e.target === e.currentTarget && !submitting) onClose()
      }}
    >
      <div
        className="bg-card border border-border shadow-2xl w-full max-w-sm overflow-hidden"
        style={{ borderRadius: '0.25rem' }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-modal-title"
      >
        {/* Header con icono + título + X */}
        <div className="flex items-start gap-3 p-5 pb-3">
          <div
            className="shrink-0 w-9 h-9 flex items-center justify-center"
            style={{
              borderRadius: '0.25rem',
              background: tone === 'danger' ? 'rgba(232,89,63,0.12)' : 'rgba(232,89,63,0.12)',
              border: `1px solid ${accent}55`,
            }}
          >
            <AlertTriangle size={16} style={{ color: accent }} />
          </div>
          <div className="flex-1 min-w-0">
            <h3
              id="confirm-modal-title"
              className="text-base font-bold text-foreground leading-tight"
              style={{ fontFamily: "'Barlow Condensed', sans-serif" }}
            >
              {title}
            </h3>
          </div>
          <button
            onClick={onClose}
            disabled={submitting}
            className="shrink-0 text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
            aria-label="Cerrar"
          >
            <X size={16} />
          </button>
        </div>

        {/* Descripción */}
        {description && (
          <div className="px-5 pb-4 text-sm text-muted-foreground break-words">
            {description}
          </div>
        )}

        {/* Error inline (si el onConfirm falló) */}
        {error && (
          <div className="mx-5 mb-3 text-xs text-primary bg-primary/10 border border-primary/20 px-3 py-2" style={{ borderRadius: '0.25rem' }}>
            ⚠ {error}
          </div>
        )}

        {/* Acciones */}
        <div
          className="flex items-center justify-end gap-2 px-5 py-3 border-t border-border"
          style={{ background: 'rgba(255,255,255,0.02)' }}
        >
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="px-3 py-1.5 text-xs border border-border hover:border-foreground/30 transition-colors disabled:opacity-50"
            style={{ borderRadius: '0.25rem' }}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={submitting}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-primary-foreground ${confirmBg} ${confirmHover} transition-opacity disabled:opacity-60`}
            style={{ borderRadius: '0.25rem' }}
          >
            {submitting ? (
              <>
                <Loader2 size={12} className="animate-spin" />
                Procesando…
              </>
            ) : (
              confirmLabel
            )}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
