import { useState } from 'react'
import { X, CheckCircle2, XCircle, Loader2 } from 'lucide-react'
import { useAuth } from '../store/auth'
import type { PedidoListItem } from '../store/pedidos'
import { pedidosStore, type Pedido } from '../store/pedidos'
import { WizardAprobacion, itemsParaWizard } from './WizardAprobacion'

type AccionOrdenModalProps = {
  pedido: PedidoListItem
  onClose: () => void
  /** Llamado cuando la acción (aprobar/cancelar) se confirma en el back. */
  onResolved?: () => void
  /**
   * Si es true, solo muestra la opción "Cancelar" (sin wizard de aprobación).
   * Lo usa el operador dueño de un pedido en estado Pendiente.
   */
  soloCancelar?: boolean
}

/**
 * Modal de acción para un pedido.
 *
 * - Aprobar (solo bodeguero/admin): abre el WizardAprobacion (rol='bodega')
 *   que pide foto por producto o permite saltear. Al finalizar, el
 *   pedido pasa a AprobadoPorBodega.
 * - Cancelar: pide un motivo y cancela. Disponible para ambos roles.
 */
export function AccionOrdenModal({
  pedido,
  onClose,
  onResolved,
  soloCancelar = false,
}: AccionOrdenModalProps) {
  const auth = useAuth()
  const initialMode: 'menu' | 'cancelar' | 'wizard' = soloCancelar ? 'cancelar' : 'menu'
  const [mode, setMode] = useState<'menu' | 'cancelar' | 'wizard'>(initialMode)
  const [motivo, setMotivo] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  // Para el wizard: necesito el pedido completo (con items.entregaItems).
  // Lo cargo on-demand al hacer click en "Aprobar".
  const [pedidoCompleto, setPedidoCompleto] = useState<Pedido | null>(null)
  const [cargandoCompleto, setCargandoCompleto] = useState(false)

  const aprobadorNombre =
    auth.status === 'autenticado' ? auth.sesion.usuario.nombre : 'sistema'

  async function openWizard() {
    setCargandoCompleto(true)
    setError('')
    try {
      const full = await pedidosStore.findOne(pedido.id)
      setPedidoCompleto(full)
      // El mode 'wizard' se setea solo cuando pedidoCompleto está listo
      setMode('wizard')
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : 'No se pudo cargar el pedido completo.'
      setError(msg)
    } finally {
      setCargandoCompleto(false)
    }
  }

  function handleCancelar() {
    setMode('cancelar')
  }

  async function handleConfirmCancel(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!motivo.trim()) {
      setError('Indicá el motivo de la cancelación.')
      return
    }
    setSubmitting(true)
    try {
      await pedidosStore.cancelar(pedido.id, motivo.trim())
      onResolved?.()
      onClose()
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : 'No se pudo cancelar la orden.'
      setError(msg)
    } finally {
      setSubmitting(false)
    }
  }

  // Si el modo es "wizard" y ya tenemos el pedido completo, mostramos
  // el wizard directamente.
  if (mode === 'wizard' && pedidoCompleto) {
    const steps = itemsParaWizard(pedidoCompleto, 'bodega')
    if (steps.length === 0) {
      return (
        <div
          className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={onClose}
        >
          <div
            className="bg-card border border-border p-6 max-w-md"
            onClick={(e) => e.stopPropagation()}
            style={{ borderRadius: '0.25rem' }}
          >
            <p className="text-foreground mb-4">
              Este pedido no tiene items para procesar (¿pedido legacy?). Podés
              aprobarlo con la foto global.
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={onClose}
                className="px-3 py-2 border border-border text-sm"
                style={{ borderRadius: '0.25rem' }}
              >
                Cerrar
              </button>
              <button
                onClick={async () => {
                  try {
                    await pedidosStore.aprobar(pedido.id)
                    onResolved?.()
                    onClose()
                  } catch (e) {
                    setError(e instanceof Error ? e.message : 'No se pudo aprobar.')
                  }
                }}
                className="px-3 py-2 bg-primary text-primary-foreground text-sm"
                style={{ borderRadius: '0.25rem' }}
              >
                Aprobar igual
              </button>
            </div>
          </div>
        </div>
      )
    }
    return (
      <WizardAprobacion
        pedido={pedido}
        rol="bodega"
        items={steps}
        onClose={onClose}
        onResolved={() => onResolved?.()}
      />
    )
  }

  // Overlay de carga mientras se baja el pedido completo (findOne)
  if (cargandoCompleto) {
    return (
      <div
        className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4"
      >
        <div
          className="bg-card border border-border p-6 flex items-center gap-3"
          style={{ borderRadius: '0.25rem' }}
        >
          <Loader2 size={20} className="text-primary animate-spin" />
          <span className="text-foreground">Cargando pedido…</span>
        </div>
      </div>
    )
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-card border border-border w-full max-w-md max-h-[90vh] overflow-y-auto"
        style={{ borderRadius: '0.25rem' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-5 border-b border-border">
          <div>
            <div
              className="text-[10px] text-muted-foreground tracking-widest uppercase"
              style={{ fontFamily: "'JetBrains Mono', monospace" }}
            >
              {pedido.codigo}
            </div>
            <h2
              className="text-lg uppercase text-foreground mt-1"
              style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800 }}
            >
              {mode === 'menu' && 'Resolver orden'}
              {mode === 'cancelar' && 'Cancelar orden'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground"
            aria-label="Cerrar"
          >
            <X size={18} />
          </button>
        </div>

        {mode === 'menu' && (
          <div className="p-5 space-y-3">
            <p
              className="text-sm text-muted-foreground"
              style={{ fontFamily: "'DM Sans', sans-serif" }}
            >
              ¿Qué querés hacer con la orden <strong>{pedido.codigo}</strong>?
            </p>
            <p
              className="text-xs text-muted-foreground"
              style={{ fontFamily: "'JetBrains Mono', monospace" }}
            >
              Resolverás como <span className="text-foreground">{aprobadorNombre}</span>.
            </p>
            <p
              className="text-[11px] text-muted-foreground"
              style={{ fontFamily: "'JetBrains Mono', monospace" }}
            >
              Fotos requeridas
            </p>

            <button
              onClick={openWizard}
              disabled={cargandoCompleto}
              className="w-full flex items-center gap-3 p-4 bg-muted border border-border hover:border-secondary/50 transition-colors text-left"
              style={{ borderRadius: '0.25rem' }}
            >
              <div className="w-10 h-10 bg-secondary/15 flex items-center justify-center shrink-0">
                {cargandoCompleto ? (
                  <Loader2 size={18} className="text-secondary animate-spin" />
                ) : (
                  <CheckCircle2 size={18} className="text-secondary" />
                )}
              </div>
              <div className="flex-1">
                <div
                  className="text-sm text-foreground"
                  style={{ fontFamily: "'DM Sans', sans-serif", fontWeight: 500 }}
                >
                  Aprobar
                </div>
                <div
                  className="text-[10px] text-muted-foreground mt-0.5"
                  style={{ fontFamily: "'JetBrains Mono', monospace" }}
                >
                  Wizard con foto por producto
                </div>
              </div>
            </button>

            <button
              onClick={handleCancelar}
              className="w-full flex items-center gap-3 p-4 bg-muted border border-border hover:border-primary/50 transition-colors text-left"
              style={{ borderRadius: '0.25rem' }}
            >
              <div className="w-10 h-10 bg-primary/15 flex items-center justify-center shrink-0">
                <XCircle size={18} className="text-primary" />
              </div>
              <div className="flex-1">
                <div
                  className="text-sm text-foreground"
                  style={{ fontFamily: "'DM Sans', sans-serif", fontWeight: 500 }}
                >
                  Cancelar
                </div>
                <div
                  className="text-[10px] text-muted-foreground mt-0.5"
                  style={{ fontFamily: "'JetBrains Mono', monospace" }}
                >
                  Indicá un motivo
                </div>
              </div>
            </button>
          </div>
        )}

        {mode === 'cancelar' && (
          <form onSubmit={handleConfirmCancel} className="p-5 space-y-4">
            <p
              className="text-sm text-muted-foreground"
              style={{ fontFamily: "'DM Sans', sans-serif" }}
            >
              Indicá el motivo por el cual se cancela esta orden. El operador lo
              verá en su historial.
            </p>
            <textarea
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              rows={4}
              placeholder="Ej: Stock insuficiente, producto dado de baja…"
              className="w-full px-3 py-2.5 bg-muted border border-border text-sm outline-none focus:border-primary/60 resize-none"
              style={{ borderRadius: '0.25rem', fontFamily: "'DM Sans', sans-serif" }}
            />

            {error && (
              <p
                className="text-xs text-primary bg-primary/10 border border-primary/20 px-3 py-2"
                style={{ fontFamily: "'JetBrains Mono', monospace", borderRadius: '0.25rem' }}
              >
                ⚠ {error}
              </p>
            )}

            <div className="flex items-center gap-2 pt-2">
              {!soloCancelar && (
                <button
                  type="button"
                  onClick={() => setMode('menu')}
                  disabled={submitting}
                  className="flex-1 py-2.5 border border-border text-sm disabled:opacity-50"
                  style={{ borderRadius: '0.25rem' }}
                >
                  Volver
                </button>
              )}
              <button
                type="submit"
                disabled={submitting}
                className={`${soloCancelar ? 'w-full' : 'flex-1'} py-2.5 bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-60 inline-flex items-center justify-center gap-2`}
                style={{ borderRadius: '0.25rem' }}
              >
                {submitting ? (
                  <>
                    <Loader2 size={14} className="animate-spin" /> Cancelando…
                  </>
                ) : (
                  'Confirmar cancelación'
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
