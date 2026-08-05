import { useEffect, useMemo, useState } from 'react'
import { X, Loader2, Undo2 } from 'lucide-react'
import { useBodegaActiva } from '../store/bodegaActiva'
import { useAuth } from '../store/auth'
import { usePedidos, pedidosStore, type Pedido } from '../store/pedidos'
import { devolucionesStore, type Devolucion } from '../store/devoluciones'
import { ApiError } from '../lib/api'

type Props = {
  onClose: () => void
  /**
   * Callback cuando se crea la devolución. Recibe la dev recién creada
   * para que el padre pueda abrir el wizard del operador.
   */
  onCreated: (dev: Devolucion) => void
  /**
   * Si se pasa, preselecciona ese pedido al abrir el modal.
   * Útil para los botones "Devolver" del banner de pendientes.
   */
  pedidoInicialId?: string | null
}

type ItemDraft = {
  detalleId: string
  productoId: string
  productoNombre: string
  productoCodigo: string
  kitNombre: string | null
  cantidadOriginal: number
  cantidad: number
  /** Unidad del producto (abreviatura) para mostrar al lado del input. */
  unidadAbreviatura: string
  /** Si la unidad permite decimales (false = und, par; true = metro, kg). */
  permiteDecimales: boolean
}

/**
 * Modal para que el técnico cree una devolución.
 *
 * 1. Elige el pedido original (filtrado a estado "Entregado").
 * 2. Elige qué productos y en qué cantidad quiere devolver.
 *    El tope por producto es lo que se pidió originalmente; el back
 *    rechaza si la cantidad sumada con devoluciones previas excede.
 * 3. Confirma con un motivo opcional.
 */
export function CrearDevolucionModal({ onClose, onCreated, pedidoInicialId }: Props) {
  const auth = useAuth()
  const bodegaId = useBodegaActiva()
  const pedidosState = usePedidos()
  const usuarioId = auth.status === 'autenticado' ? auth.sesion.usuario.id : null

  const [pedidoId, setPedidoId] = useState<string | null>(pedidoInicialId ?? null)
  const [items, setItems] = useState<ItemDraft[]>([])
  const [motivo, setMotivo] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [pedidoCompleto, setPedidoCompleto] = useState<Pedido | null>(null)
  const [cargandoPedido, setCargandoPedido] = useState(false)

  // Cargar pedidos si no están
  useEffect(() => {
    if (!bodegaId) return
    if (pedidosState.status === 'idle') {
      void pedidosStore
        .cargarPaginado({ bodegaId, page: 1, pageSize: 100 })
        .catch(() => undefined)
    }
  }, [bodegaId, pedidosState.status])

  // Filtrar pedidos: solo los Entregados del usuario actual
  const pedidosEntregados = useMemo(() => {
    if (pedidosState.status !== 'listo') return []
    return pedidosState.pedidos.filter(
      (p) => p.estadoNombre === 'Entregado' && (!usuarioId || p.operadorId === usuarioId),
    )
  }, [pedidosState, usuarioId])

  // Si se pasó un pedido preseleccionado, lo seteamos al tener la lista
  useEffect(() => {
    if (
      pedidoInicialId &&
      !pedidoId &&
      pedidosEntregados.some((p) => p.id === pedidoInicialId)
    ) {
      setPedidoId(pedidoInicialId)
    }
  }, [pedidoInicialId, pedidoId, pedidosEntregados])

  // Cuando elige un pedido, traer el detalle completo
  useEffect(() => {
    if (!pedidoId) {
      setPedidoCompleto(null)
      setItems([])
      return
    }
    let cancelado = false
    setCargandoPedido(true)
    setItems([])
    setError('')
    pedidosStore
      .findOne(pedidoId)
      .then((p) => {
        if (cancelado) return
        setPedidoCompleto(p)
      })
      .catch((err) => {
        if (!cancelado) {
          const msg = err instanceof Error ? err.message : 'No se pudo cargar el pedido.'
          setError(msg)
        }
      })
      .finally(() => {
        if (!cancelado) setCargandoPedido(false)
      })
    return () => {
      cancelado = true
    }
  }, [pedidoId])

  // Cuando llega el pedido completo, armar los items disponibles
  useEffect(() => {
    if (!pedidoCompleto) return
    const drafts: ItemDraft[] = []
    for (const it of pedidoCompleto.items) {
      if (it.producto) {
        const um = it.producto.unidadMedida
        drafts.push({
          detalleId: it.id,
          productoId: it.producto.id,
          productoNombre: it.producto.nombre,
          productoCodigo: it.producto.codigo,
          kitNombre: null,
          cantidadOriginal: Number(it.cantidad),
          cantidad: 0,
          unidadAbreviatura: um?.abreviatura ?? 'und',
          permiteDecimales: um?.permiteDecimales ?? false,
        })
      } else if (it.kit) {
        for (const ki of it.kit.items) {
          const um = ki.producto.unidadMedida
          drafts.push({
            detalleId: it.id,
            productoId: ki.producto.id,
            productoNombre: ki.producto.nombre,
            productoCodigo: ki.producto.codigo,
            kitNombre: it.kit.nombre,
            cantidadOriginal: Number(it.cantidad) * Number(ki.cantidad),
            cantidad: 0,
            unidadAbreviatura: um?.abreviatura ?? 'und',
            permiteDecimales: um?.permiteDecimales ?? false,
          })
        }
      }
    }
    setItems(drafts)
  }, [pedidoCompleto])

  function setCantidad(idx: number, val: number) {
    setItems((prev) =>
      prev.map((it, i) => {
        if (i !== idx) return it
        return {
          ...it,
          cantidad: Math.max(0, Math.min(it.cantidadOriginal, Number(val) || 0)),
        }
      }),
    )
  }

  const itemsValidos = items.filter((it) => it.cantidad > 0)
  const puedeEnviar =
    !!pedidoId && itemsValidos.length > 0 && !submitting && !cargandoPedido

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!puedeEnviar || !pedidoId) return
    setError('')
    setSubmitting(true)
    try {
      const dev = await devolucionesStore.crear(
        pedidoId,
        motivo.trim() || undefined,
        itemsValidos.map((it) => ({
          detalleId: it.detalleId,
          productoId: it.productoId,
          cantidad: it.cantidad,
        })),
      )
      onCreated(dev)
      onClose()
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'No se pudo crear la devolución.'
      setError(msg)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-card border border-border w-full max-w-2xl max-h-[90vh] flex flex-col"
        style={{ borderRadius: '0.25rem' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-5 border-b border-border shrink-0">
          <div>
            <div
              className="text-[10px] text-muted-foreground tracking-widest uppercase"
              style={{ fontFamily: "'JetBrains Mono', monospace" }}
            >
              Nueva devolución
            </div>
            <h2
              className="text-lg uppercase text-foreground mt-1"
              style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800 }}
            >
              Devolver productos al inventario
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Cerrar"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Selector de pedido — o display si vino preseleccionado */}
          <div>
            <label
              className="text-[10px] text-muted-foreground tracking-widest uppercase mb-1.5 block"
              style={{ fontFamily: "'JetBrains Mono', monospace" }}
            >
              Pedido original
            </label>
            {pedidoInicialId ? (
              // Vino preseleccionado desde un botón externo: solo display,
              // no le mostramos el select para que no pueda cambiarlo.
              <div
                className="w-full px-3 py-2 bg-muted/50 border border-border text-sm text-foreground"
                style={{ borderRadius: '0.25rem', fontFamily: "'DM Sans', sans-serif" }}
              >
                {pedidosEntregados.find((p) => p.id === pedidoInicialId)?.codigo ??
                  pedidoCompleto?.codigo ??
                  'Cargando…'}{' '}
                {pedidosEntregados.find((p) => p.id === pedidoInicialId)?.createdAtLabel ??
                  (pedidoCompleto
                    ? new Date(pedidoCompleto.createdAt).toLocaleString('es-CO', {
                        dateStyle: 'short',
                        timeStyle: 'short',
                      })
                    : '')}
              </div>
            ) : pedidosState.status === 'cargando' || pedidosState.status === 'idle' ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 size={14} className="animate-spin" /> Cargando pedidos…
              </div>
            ) : pedidosEntregados.length === 0 ? (
              <p
                className="text-xs text-muted-foreground"
                style={{ fontFamily: "'DM Sans', sans-serif" }}
              >
                No tenés pedidos en estado <strong>Entregado</strong> para devolver.
              </p>
            ) : (
              <select
                value={pedidoId ?? ''}
                onChange={(e) => setPedidoId(e.target.value || null)}
                className="w-full px-3 py-2 bg-muted border border-border text-sm text-foreground outline-none focus:border-primary/60"
                style={{ borderRadius: '0.25rem', fontFamily: "'DM Sans', sans-serif" }}
              >
                <option value="">Elegí un pedido…</option>
                {pedidosEntregados.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.codigo} · {p.createdAtLabel}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Items a devolver */}
          {cargandoPedido ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 size={14} className="animate-spin" /> Cargando detalle…
            </div>
          ) : items.length > 0 ? (
            <div>
              <label
                className="text-[10px] text-muted-foreground tracking-widest uppercase mb-1.5 block"
                style={{ fontFamily: "'JetBrains Mono', monospace" }}
              >
                Productos a devolver
              </label>
              <ul
                className="divide-y divide-border border border-border"
                style={{ borderRadius: '0.25rem' }}
              >
                {items.map((it, idx) => (
                  <li
                    key={`${it.detalleId}-${it.productoId}`}
                    className="p-3 bg-card flex items-center gap-3"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        {it.kitNombre && (
                          <span
                            className="text-[10px] text-muted-foreground"
                            style={{ fontFamily: "'JetBrains Mono', monospace" }}
                          >
                            [kit]
                          </span>
                        )}
                        <span
                          className="text-sm text-foreground"
                          style={{ fontFamily: "'DM Sans', sans-serif" }}
                        >
                          {it.productoNombre}
                        </span>
                        <span
                          className="text-[10px] text-muted-foreground"
                          style={{ fontFamily: "'JetBrains Mono', monospace" }}
                        >
                          SKU {it.productoCodigo}
                        </span>
                      </div>
                      <div
                        className="text-[10px] text-muted-foreground mt-1"
                        style={{ fontFamily: "'JetBrains Mono', monospace" }}
                      >
                        Pedido original: {it.cantidadOriginal} {it.unidadAbreviatura}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <input
                        type="number"
                        min={0}
                        max={it.cantidadOriginal}
                        step={it.permiteDecimales ? '0.001' : '1'}
                        value={it.cantidad}
                        onChange={(e) => setCantidad(idx, Number(e.target.value))}
                        className="w-20 px-2 py-1.5 bg-muted border border-border text-sm text-right outline-none focus:border-primary/60"
                        style={{
                          borderRadius: '0.25rem',
                          fontFamily: "'JetBrains Mono', monospace",
                        }}
                      />
                      <span
                        className="text-xs text-muted-foreground min-w-[3rem]"
                        style={{ fontFamily: "'JetBrains Mono', monospace" }}
                      >
                        {it.unidadAbreviatura}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {/* Motivo */}
          <div>
            <label
              className="text-[10px] text-muted-foreground tracking-widest uppercase mb-1.5 block"
              style={{ fontFamily: "'JetBrains Mono', monospace" }}
            >
              Motivo (opcional)
            </label>
            <textarea
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              rows={3}
              placeholder="Ej: terminé el trabajo, la herramienta está en buen estado…"
              className="w-full px-3 py-2.5 bg-muted border border-border text-sm outline-none focus:border-primary/60 resize-none"
              style={{ borderRadius: '0.25rem', fontFamily: "'DM Sans', sans-serif" }}
            />
          </div>

          {error && (
            <p
              className="text-xs text-primary bg-primary/10 border border-primary/20 px-3 py-2"
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                borderRadius: '0.25rem',
              }}
            >
              ⚠ {error}
            </p>
          )}
        </form>

        <div className="p-4 border-t border-border flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="px-3 py-2.5 border border-border text-sm disabled:opacity-50"
            style={{ borderRadius: '0.25rem' }}
          >
            Cancelar
          </button>
          <div className="flex-1" />
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!puedeEnviar}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ borderRadius: '0.25rem' }}
          >
            {submitting ? (
              <>
                <Loader2 size={14} className="animate-spin" /> Enviando…
              </>
            ) : (
              <>
                <Undo2 size={14} /> Crear devolución ({itemsValidos.length}{' '}
                {itemsValidos.length === 1 ? 'item' : 'ítems'})
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
