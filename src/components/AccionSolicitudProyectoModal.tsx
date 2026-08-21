/**
 * Modal de acción para que el BODEGUERO gestione una solicitud
 * de productos a bodega generada desde un PROYECTO.
 *
 * Mismo patrón que `AccionOrdenModal` de Despachos, pero apuntando
 * a los endpoints de `ProyectoSolicitudBodega`:
 *  - `PATCH /solicitudes-bodega/:id/aprobar`
 *  - `PATCH /solicitudes-bodega/:id/rechazar`
 *  - `PATCH /solicitudes-bodega/:id/entregar`
 *
 * Tres modos según el estado actual:
 *  - pendiente → Aprobar / Rechazar
 *  - aprobada  → Entregar (con cantidad a entregar por item)
 *  - otros     → solo ver detalle
 */
import { useEffect, useState } from 'react'
import { AlertCircle, Check, Loader2, Send, Truck, X } from 'lucide-react'
import { Modal } from './Modal'
import { api, ApiError } from '../lib/api'
import type {
  SolicitudDetalle,
  SolicitudProducto,
  AprobarSolicitudInput,
  RechazarSolicitudInput,
  EntregarSolicitudInput,
} from './proyectos/types'

type Props = {
  open: boolean
  solicitudId: string
  /** Cuando se resuelve, refrescar la lista. */
  onResolved: () => void
  onClose: () => void
}

export function AccionSolicitudProyectoModal({
  open,
  solicitudId,
  onResolved,
  onClose,
}: Props) {
  const [detalle, setDetalle] = useState<SolicitudDetalle | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // Estado del sub-form de entregar (cantidad por item, default = solicitada)
  const [entregaCantidades, setEntregaCantidades] = useState<
    Record<string, number>
  >({})
  const [motivoRechazo, setMotivoRechazo] = useState('')

  function cargar() {
    if (!open) return
    setLoading(true)
    setError(null)
    api
      .get<SolicitudDetalle>(
        `/solicitudes-bodega/${encodeURIComponent(solicitudId)}`,
      )
      .then((data) => {
        setDetalle(data)
        // Inicializar cantidades de entrega con la cantidadSolicitada.
        const init: Record<string, number> = {}
        for (const d of data.detalles) {
          init[d.productoId] = data.estado === 'aprobada' ? d.cantidadSolicitada : 0
        }
        setEntregaCantidades(init)
      })
      .catch((err) => {
        const msg =
          err instanceof ApiError
            ? err.message
            : err instanceof Error
              ? err.message
              : 'No se pudo cargar la solicitud.'
        setError(msg)
      })
      .finally(() => setLoading(false))
  }
  useEffect(cargar, [open, solicitudId])

  async function aprobar() {
    if (!detalle) return
    setSubmitting(true)
    setError(null)
    try {
      const items: AprobarSolicitudInput['items'] = detalle.detalles.map((d) => ({
        productoId: d.productoId,
        cantidadSolicitada: d.cantidadSolicitada,
      }))
      await api.patch(`/solicitudes-bodega/${encodeURIComponent(detalle.id)}/aprobar`, {
        items,
      })
      onResolved()
      onClose()
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'No se pudo aprobar la solicitud.'
      setError(msg)
    } finally {
      setSubmitting(false)
    }
  }

  async function rechazar() {
    if (!detalle) return
    if (!motivoRechazo.trim()) {
      setError('Indicá un motivo de rechazo.')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      const dto: RechazarSolicitudInput = { motivo: motivoRechazo.trim() }
      await api.patch(
        `/solicitudes-bodega/${encodeURIComponent(detalle.id)}/rechazar`,
        dto,
      )
      onResolved()
      onClose()
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'No se pudo rechazar la solicitud.'
      setError(msg)
    } finally {
      setSubmitting(false)
    }
  }

  async function entregar() {
    if (!detalle) return
    const items: EntregarSolicitudInput['items'] = detalle.detalles.map((d) => ({
      productoId: d.productoId,
      cantidadEntregada: Number(entregaCantidades[d.productoId] ?? 0),
    }))
    if (items.length === 0) {
      setError('La solicitud no tiene items.')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      await api.patch(
        `/solicitudes-bodega/${encodeURIComponent(detalle.id)}/entregar`,
        { items },
      )
      onResolved()
      onClose()
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'No se pudo marcar como entregada.'
      setError(msg)
    } finally {
      setSubmitting(false)
    }
  }

  const estadoActual = detalle?.estado
  const esPendiente = estadoActual === 'pendiente'
  const esAprobada = estadoActual === 'aprobada'

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={detalle ? `Solicitud ${detalle.codigo}` : 'Solicitud de proyecto'}
      description={
        detalle?.proyecto
          ? `Proyecto: ${detalle.proyecto.nombreProyecto} (${detalle.proyecto.codigo})`
          : 'Cargando…'
      }
      size="lg"
      footer={
        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 text-sm border border-border hover:border-foreground/40 transition-colors"
            style={{ borderRadius: '0.25rem' }}
          >
            Cerrar
          </button>
          {esPendiente && (
            <>
              <button
                type="button"
                onClick={rechazar}
                disabled={submitting}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-destructive text-destructive-foreground text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
                style={{ borderRadius: '0.25rem' }}
              >
                {submitting ? <Loader2 size={13} className="animate-spin" /> : <X size={13} />}
                Rechazar
              </button>
              <button
                type="button"
                onClick={aprobar}
                disabled={submitting}
                className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
                style={{ borderRadius: '0.25rem' }}
              >
                {submitting ? <Loader2 size={13} className="animate-spin" /> : <Check size={14} />}
                Aprobar
              </button>
            </>
          )}
          {esAprobada && (
            <button
              type="button"
              onClick={entregar}
              disabled={submitting}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
              style={{ borderRadius: '0.25rem' }}
            >
              {submitting ? <Loader2 size={13} className="animate-spin" /> : <Truck size={14} />}
              Marcar como entregada
            </button>
          )}
        </div>
      }
    >
      {loading ? (
        <div className="p-8 flex items-center justify-center text-muted-foreground">
          <Loader2 size={18} className="animate-spin mr-2" />
          Cargando solicitud…
        </div>
      ) : !detalle ? (
        <div className="p-6 text-center text-sm text-destructive">
          {error ?? 'No se pudo cargar la solicitud.'}
        </div>
      ) : (
        <div className="p-4 sm:p-5 space-y-4">
          {error && (
            <div className="border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive flex items-start gap-2">
              <AlertCircle size={12} className="mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Header con metadatos */}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <EstadoBadge estado={detalle.estado} />
            <span className="text-muted-foreground">
              Solicitada por <strong className="text-foreground">{detalle.solicitadoPor.nombre}</strong>
            </span>
            <span className="text-muted-foreground">·</span>
            <span className="text-muted-foreground" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
              {new Date(detalle.fechaSolicitud).toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' })}
            </span>
          </div>

          {detalle.comentario && (
            <div className="border border-border bg-muted/30 p-3 text-xs text-muted-foreground">
              <strong className="text-foreground">Comentario del solicitante:</strong> {detalle.comentario}
            </div>
          )}

          {detalle.motivoRechazo && (
            <div className="border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">
              <strong>Motivo de rechazo:</strong> {detalle.motivoRechazo}
            </div>
          )}

          {/* Tabla de items */}
          <div>
            <h4
              className="text-[10px] uppercase tracking-widest text-muted-foreground mb-2"
              style={{ fontFamily: "'JetBrains Mono', monospace" }}
            >
              Productos solicitados ({detalle.detalles.length})
            </h4>
            <div className="border border-border overflow-hidden" style={{ borderRadius: '0.25rem' }}>
              <table className="w-full text-sm">
                <thead className="bg-muted/40">
                  <tr
                    className="text-left text-[10px] text-muted-foreground uppercase tracking-widest"
                    style={{ fontFamily: "'JetBrains Mono', monospace" }}
                  >
                    <th className="px-3 py-2">Producto</th>
                    <th className="px-3 py-2 text-right">Solicitada</th>
                    <th className="px-3 py-2 text-right">Entregada</th>
                    {esAprobada && (
                      <th className="px-3 py-2 text-right">A entregar</th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {detalle.detalles.map((d) => (
                    <ItemRow
                      key={d.id}
                      item={d}
                      modo={esAprobada ? 'entregar' : esPendiente ? 'aprobar' : 'ver'}
                      cantidadEntrega={entregaCantidades[d.productoId] ?? 0}
                      onCantidadEntregaChange={(v) =>
                        setEntregaCantidades((prev) => ({
                          ...prev,
                          [d.productoId]: v,
                        }))
                      }
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Motivo de rechazo (solo pendiente) */}
          {esPendiente && (
            <div>
              <label className="block text-xs font-medium text-foreground mb-1">
                Motivo de rechazo (opcional hasta que rechaces)
              </label>
              <textarea
                value={motivoRechazo}
                onChange={(e) => setMotivoRechazo(e.target.value)}
                rows={2}
                placeholder="Por qué se rechaza esta solicitud…"
                className="w-full px-3 py-2 bg-background border border-border text-sm focus:outline-none focus:border-foreground/40 resize-none"
                style={{ borderRadius: '0.25rem' }}
              />
            </div>
          )}
        </div>
      )}
    </Modal>
  )
}

// ─────────────────────────────────────────────────────────────

function ItemRow({
  item,
  modo,
  cantidadEntrega,
  onCantidadEntregaChange,
}: {
  item: SolicitudProducto
  modo: 'aprobar' | 'entregar' | 'ver'
  cantidadEntrega: number
  onCantidadEntregaChange: (v: number) => void
}) {
  return (
    <tr className="border-t border-border">
      <td className="px-3 py-2">
        <div className="font-medium text-foreground">{item.producto.nombre}</div>
        <div
          className="text-[10px] text-muted-foreground tracking-widest"
          style={{ fontFamily: "'JetBrains Mono', monospace" }}
        >
          {item.producto.codigo} · {item.producto.unidadMedida.abreviatura}
        </div>
      </td>
      <td className="px-3 py-2 text-right" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
        {item.cantidadSolicitada.toFixed(2)}
      </td>
      <td className="px-3 py-2 text-right" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
        {item.cantidadEntregada.toFixed(2)}
      </td>
      {modo === 'entregar' && (
        <td className="px-3 py-2 text-right">
          <input
            type="number"
            step="0.001"
            min="0"
            value={cantidadEntrega || ''}
            onChange={(e) => onCantidadEntregaChange(Number(e.target.value) || 0)}
            className="w-24 px-2 py-1 bg-background border border-border text-xs text-right"
            style={{ borderRadius: '0.25rem', fontFamily: "'JetBrains Mono', monospace" }}
          />
        </td>
      )}
    </tr>
  )
}

function EstadoBadge({ estado }: { estado: SolicitudDetalle['estado'] }) {
  const map: Record<SolicitudDetalle['estado'], { color: string; label: string }> = {
    pendiente: { color: '#eab308', label: 'PENDIENTE' },
    aprobada: { color: '#3b82f6', label: 'APROBADA' },
    rechazada: { color: '#ef4444', label: 'RECHAZADA' },
    entregada: { color: '#22c55e', label: 'ENTREGADA' },
  }
  const m = map[estado]
  return (
    <span
      className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 text-white"
      style={{ backgroundColor: m.color, borderRadius: '0.125rem', fontFamily: "'JetBrains Mono', monospace" }}
    >
      {m.label}
    </span>
  )
}
