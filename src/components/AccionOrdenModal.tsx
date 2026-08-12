import { useState } from 'react'
import { CheckCircle2, XCircle, Loader2 } from 'lucide-react'
import { useAuth } from '../store/auth'
import type { PedidoListItem } from '../store/pedidos'
import { pedidosStore, type Pedido } from '../store/pedidos'
import { WizardAprobacion, itemsParaWizard } from './WizardAprobacion'
import { Modal } from './Modal'

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
        <Modal
          open
          onClose={onClose}
          title="Pedido legacy"
          description="Este pedido no tiene items para procesar (¿pedido legacy?). Podés aprobarlo con la foto global."
          size="sm"
          footer={
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-3 min-h-[44px] py-2.5 border border-border text-sm"
                style={{ borderRadius: '0.25rem' }}
              >
                Cerrar
              </button>
              <button
                type="button"
                onClick={async () => {
                  try {
                    await pedidosStore.aprobar(pedido.id)
                    onResolved?.()
                    onClose()
                  } catch (e) {
                    setError(e instanceof Error ? e.message : 'No se pudo aprobar.')
                  }
                }}
                className="px-3 min-h-[44px] py-2.5 bg-primary text-primary-foreground text-sm"
                style={{ borderRadius: '0.25rem' }}
              >
                Aprobar igual
              </button>
            </div>
          }
        >
          <div className="p-5 text-sm text-foreground">
            <p>{error}</p>
          </div>
        </Modal>
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
      <Modal open onClose={onClose} title="Cargando" size="sm">
        <div className="p-6 flex items-center gap-3">
          <Loader2 size={20} className="text-primary animate-spin" />
          <span className="text-foreground">Cargando pedido…</span>
        </div>
      </Modal>
    )
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={mode === 'menu' ? 'Resolver orden' : 'Cancelar orden'}
      description={pedido.codigo}
      size="sm"
    >
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

          <button
            type="button"
            onClick={openWizard}
            disabled={cargandoCompleto}
            className="w-full min-h-[44px] flex items-center gap-3 p-4 bg-muted border border-border hover:border-secondary/50 transition-colors text-left"
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
            type="button"
            onClick={handleCancelar}
            className="w-full min-h-[44px] flex items-center gap-3 p-4 bg-muted border border-border hover:border-primary/50 transition-colors text-left"
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
            className="w-full px-3 py-2.5 min-h-[44px] bg-muted border border-border text-sm outline-none focus:border-primary/60 resize-none"
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
                className="flex-1 min-h-[44px] py-2.5 border border-border text-sm disabled:opacity-50"
                style={{ borderRadius: '0.25rem' }}
              >
                Volver
              </button>
            )}
            <button
              type="submit"
              disabled={submitting}
              className={`${soloCancelar ? 'w-full' : 'flex-1'} min-h-[44px] py-2.5 bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-60 inline-flex items-center justify-center gap-2`}
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
    </Modal>
  )
}
