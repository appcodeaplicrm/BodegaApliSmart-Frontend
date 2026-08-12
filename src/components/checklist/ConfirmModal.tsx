/**
 * Modal genérico de confirmación (reemplaza `confirm()` nativo).
 *
 * Se usa para acciones destructivas o sensibles: eliminar plantilla,
 * cancelar pedido, etc. El caller controla el texto y la promesa de
 * la acción vía `onConfirm`.
 *
 * - Botón primario: rojo (primary) para acciones destructivas,
 *   o se puede customizar vía `tone="primary"`.
 * - El botón queda disabled mientras se ejecuta la promesa.
 * - Si la promesa tira error, NO cierra el modal (el caller decide).
 */
import { useState, type ReactNode } from 'react'
import { AlertTriangle, Loader2 } from 'lucide-react'
import { Modal } from '../Modal'

type ConfirmModalProps = {
  open: boolean
  onClose: () => void
  title: string
  description?: ReactNode
  /** Texto del botón de confirmación. Default: "Eliminar". */
  confirmLabel?: string
  /** Texto del botón de cancelar. Default: "Cancelar". */
  cancelLabel?: string
  /** Si la acción es destructiva, usa rojo. Default: 'danger'. */
  tone?: 'danger' | 'primary'
  /**
   * Acción al confirmar. Devuelve una promesa: si resuelve, el modal
   * se cierra automáticamente. Si rechaza, se muestra el error y el
   * modal NO se cierra (caller decide).
   */
  onConfirm: () => Promise<void> | void
}

export function ConfirmModal({
  open,
  onClose,
  title,
  description,
  confirmLabel = 'Eliminar',
  cancelLabel = 'Cancelar',
  tone = 'danger',
  onConfirm,
}: ConfirmModalProps) {
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleConfirm = async () => {
    setError(null)
    setSubmitting(true)
    try {
      await onConfirm()
      onClose()
    } catch (e) {
      setError((e as Error).message ?? 'No se pudo completar la acción.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={submitting ? () => {} : onClose}
      title={title}
      size="sm"
      icon={<AlertTriangle size={14} className="text-primary" />}
      footer={
        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="min-h-[44px] px-4 py-2 border border-border text-sm text-foreground hover:border-foreground/30 transition-colors disabled:opacity-50"
            style={{ borderRadius: '0.25rem' }}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={submitting}
            className={[
              'inline-flex items-center gap-2 min-h-[44px] px-4 py-2 text-sm font-semibold transition-colors disabled:opacity-50',
              tone === 'danger'
                ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                : 'bg-primary text-primary-foreground hover:bg-primary/90',
            ].join(' ')}
            style={{ borderRadius: '0.25rem' }}
          >
            {submitting ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                Procesando…
              </>
            ) : (
              confirmLabel
            )}
          </button>
        </div>
      }
    >
      <div className="p-5 space-y-3">
        {description && <div className="text-sm text-foreground">{description}</div>}
        {error && (
          <div
            className="text-xs text-primary bg-primary/10 border border-primary/20 px-3 py-2"
            style={{ borderRadius: '0.25rem' }}
          >
            {error}
          </div>
        )}
      </div>
    </Modal>
  )
}
