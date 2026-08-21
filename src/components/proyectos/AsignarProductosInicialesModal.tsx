/**
 * Modal para asignar productos iniciales (dotación) a un proyecto
 * YA CREADO, desde la tab "Productos" del detalle.
 *
 * Misma UI que `SeleccionarProductosInicialesModal` (el del form de
 * crear proyecto), con la única diferencia de que acá la lista de
 * técnicos receptores se trae del proyecto ya armado, no del form.
 *
 * Patrón:
 *  - Self-contained: carga los productos del catálogo por su cuenta
 *    (con retry inline si falla).
 *  - Lista scrolleable con checkbox + chip de stock + ícono "+".
 *  - Al tildar un producto, se expande un sub-form con cantidad y
 *    receptor (opcional, default = "uso común").
 *  - Footer: "Agregar N productos a la lista".
 *  - Comentario libre opcional.
 */
import { useEffect, useMemo, useState } from 'react'
import {
  AlertCircle,
  Check,
  Loader2,
  Package,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  X,
} from 'lucide-react'
import { Modal } from '../Modal'
import { listarProductos, type ProductoCatalogoT } from './api'
import type { ProyectoTecnicoDetalle } from './types'

export type ProductoInicialParaAsignar = {
  productoId: string
  cantidad: number
  tecnicoReceptorId?: string
  // Cacheado en el front para mostrar en el form padre sin re-buscar:
  nombre: string
  codigo: string
  unidad: string
  stockDisponible: number
}

type Props = {
  open: boolean
  proyectoId: string
  bodegaId: string
  /** Técnicos ya asignados al proyecto (para "Receptor"). */
  tecnicosAsignados: ProyectoTecnicoDetalle[]
  onClose: () => void
  onCreated: () => void
}

type DraftItem = {
  productoId: string
  cantidad: number
  tecnicoReceptorId?: string
}

export function AsignarProductosInicialesModal({
  open,
  proyectoId,
  bodegaId,
  tecnicosAsignados,
  onClose,
  onCreated,
}: Props) {
  const [productos, setProductos] = useState<ProductoCatalogoT[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busqueda, setBusqueda] = useState('')
  const [draft, setDraft] = useState<DraftItem[]>([])
  const [comentario, setComentario] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [errorSubmit, setErrorSubmit] = useState<string | null>(null)

  function cargarProductos() {
    if (!open || !bodegaId) return
    setLoading(true)
    setError(null)
    listarProductos(bodegaId)
      .then(setProductos)
      .catch((err) => {
        const msg =
          err instanceof Error ? err.message : 'No se pudieron cargar los productos.'
        setError(msg)
      })
      .finally(() => setLoading(false))
  }
  useEffect(() => {
    if (open) cargarProductos()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, bodegaId])

  // Reset al cerrar
  useEffect(() => {
    if (!open) {
      setDraft([])
      setComentario('')
      setErrorSubmit(null)
      setBusqueda('')
    }
  }, [open])

  const filtrados = useMemo(() => {
    const q = busqueda.toLowerCase().trim()
    if (!q) return productos
    return productos.filter(
      (p) =>
        p.nombre.toLowerCase().includes(q) ||
        (p.codigo ?? '').toLowerCase().includes(q),
    )
  }, [productos, busqueda])

  const draftByProductoId = useMemo(() => {
    const map = new Map<string, DraftItem>()
    for (const d of draft) map.set(d.productoId, d)
    return map
  }, [draft])

  function agregarProducto(p: ProductoCatalogoT) {
    if (draftByProductoId.has(p.id)) {
      setDraft((prev) => prev.filter((d) => d.productoId !== p.id))
      return
    }
    setDraft((prev) => [
      ...prev,
      { productoId: p.id, cantidad: 1, tecnicoReceptorId: undefined },
    ])
  }

  function updateDraft(productoId: string, patch: Partial<DraftItem>) {
    setDraft((prev) =>
      prev.map((d) => (d.productoId === productoId ? { ...d, ...patch } : d)),
    )
  }

  function removeDraft(productoId: string) {
    setDraft((prev) => prev.filter((d) => d.productoId !== productoId))
  }

  async function handleConfirm() {
    if (submitting) return
    const itemsValidos = draft
      .filter((d) => d.productoId && d.cantidad > 0)
      .map((d) => ({
        productoId: d.productoId,
        cantidad: d.cantidad,
        tecnicoReceptorId: d.tecnicoReceptorId,
      }))
    if (itemsValidos.length === 0) {
      setErrorSubmit('Agregá al menos un producto con cantidad mayor a 0.')
      return
    }
    setSubmitting(true)
    setErrorSubmit(null)
    try {
      const { asignarProductosIniciales } = await import('./api')
      await asignarProductosIniciales(proyectoId, { items: itemsValidos })
      onCreated()
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : 'No se pudo asignar los productos.'
      setErrorSubmit(msg)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Asignar productos iniciales"
      description="Se descuentan del stock de la bodega y se genera un MovimientoInventario."
      icon={<Package size={18} />}
      size="lg"
      footer={
        <div className="flex items-center justify-between gap-2">
          <div className="text-xs text-muted-foreground">
            <strong className="text-foreground">{draft.length}</strong>{' '}
            {draft.length === 1 ? 'producto' : 'productos'} en la lista
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 text-sm border border-border hover:border-foreground/40 transition-colors"
              style={{ borderRadius: '0.25rem' }}
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={submitting}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
              style={{ borderRadius: '0.25rem' }}
            >
              {submitting ? (
                <Loader2 size={13} className="animate-spin" />
              ) : (
                <Check size={14} />
              )}
              Asignar
            </button>
          </div>
        </div>
      }
    >
      {loading ? (
        <div className="p-6 flex items-center justify-center text-muted-foreground">
          <Loader2 size={18} className="animate-spin mr-2" />
          Cargando productos…
        </div>
      ) : error ? (
        <div className="p-6 flex flex-col items-center text-center">
          <AlertCircle size={24} className="text-destructive mb-2" />
          <p className="text-sm text-destructive mb-3">{error}</p>
          <button
            type="button"
            onClick={cargarProductos}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-foreground text-background text-xs font-medium hover:opacity-90"
            style={{ borderRadius: '0.25rem' }}
          >
            <RefreshCw size={12} />
            Reintentar
          </button>
        </div>
      ) : productos.length === 0 ? (
        <div className="p-6 text-center">
          <p className="text-sm text-muted-foreground">
            No hay productos en el catálogo de esta bodega.
          </p>
        </div>
      ) : (
        <div className="p-3 sm:p-4 space-y-3">
          {errorSubmit && (
            <div className="border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive flex items-start gap-2">
              <AlertCircle size={12} className="mt-0.5 shrink-0" />
              <span>{errorSubmit}</span>
            </div>
          )}

          {/* Buscador */}
          <div className="relative">
            <Search
              size={14}
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
            />
            <input
              type="text"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar por nombre o código…"
              className="w-full pl-8 pr-3 py-2 bg-background border border-border text-sm focus:outline-none focus:border-foreground/40"
              style={{ borderRadius: '0.25rem' }}
            />
          </div>

          {/* Lista scrolleable */}
          <div className="max-h-72 overflow-y-auto space-y-1">
            {filtrados.length === 0 ? (
              <div className="p-4 text-center text-xs text-muted-foreground">
                No hay productos que coincidan con "{busqueda}".
              </div>
            ) : (
              filtrados.map((p) => {
                const inDraft = draftByProductoId.get(p.id)
                const stock = Number(p.stockBodega ?? 0)
                const sinStock = stock <= 0
                return (
                  <div
                    key={p.id}
                    className="border border-border"
                    style={{ borderRadius: '0.25rem' }}
                  >
                    <button
                      type="button"
                      onClick={() => !sinStock && agregarProducto(p)}
                      disabled={sinStock}
                      className={[
                        'w-full flex items-center gap-2.5 px-2.5 py-2 text-left transition-colors',
                        sinStock
                          ? 'opacity-60 cursor-not-allowed'
                          : inDraft
                            ? 'bg-primary/10'
                            : 'hover:bg-muted',
                      ].join(' ')}
                      style={{ borderRadius: '0.25rem' }}
                    >
                      <span
                        className={[
                          'w-4 h-4 border flex items-center justify-center shrink-0',
                          inDraft
                            ? 'bg-primary border-primary'
                            : 'bg-background border-border',
                        ].join(' ')}
                        style={{ borderRadius: '0.125rem' }}
                      >
                        {inDraft && <Check size={11} className="text-primary-foreground" />}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-foreground truncate">
                          {p.nombre}
                        </div>
                        <div
                          className="text-[10px] text-muted-foreground tracking-widest"
                          style={{ fontFamily: "'JetBrains Mono', monospace" }}
                        >
                          {p.codigo} · {p.unidadMedida?.abreviatura ?? '—'}
                        </div>
                      </div>
                      <span
                        className={[
                          'px-1.5 py-0.5 text-[10px] uppercase tracking-wider shrink-0',
                          sinStock
                            ? 'bg-destructive/10 text-destructive'
                            : 'bg-secondary/10 text-secondary',
                        ].join(' ')}
                        style={{ borderRadius: '0.125rem', fontFamily: "'JetBrains Mono', monospace" }}
                        title={`Stock disponible en bodega: ${stock}`}
                      >
                        stock: {stock}
                      </span>
                      {!sinStock && !inDraft && (
                        <Plus size={13} className="text-muted-foreground shrink-0" />
                      )}
                    </button>

                    {inDraft && (
                      <div className="px-3 py-2 border-t border-border bg-muted/30 space-y-2">
                        <div className="grid grid-cols-12 gap-2 items-center">
                          <div
                            className="col-span-3 text-[10px] uppercase tracking-widest text-muted-foreground"
                            style={{ fontFamily: "'JetBrains Mono', monospace" }}
                          >
                            Cantidad
                          </div>
                          <div className="col-span-3">
                            <input
                              type="number"
                              step="0.001"
                              min="0"
                              value={inDraft.cantidad || ''}
                              onChange={(e) =>
                                updateDraft(p.id, { cantidad: Number(e.target.value) || 0 })
                              }
                              className="w-full px-2 py-1.5 bg-background border border-border text-xs"
                              style={{ borderRadius: '0.25rem' }}
                            />
                          </div>
                          <div
                            className="col-span-1 text-[10px] text-muted-foreground text-center"
                            style={{ fontFamily: "'JetBrains Mono', monospace" }}
                          >
                            {p.unidadMedida?.abreviatura ?? '—'}
                          </div>
                          {inDraft.cantidad > stock && (
                            <div className="col-span-5 text-[10px] text-destructive">
                              ⚠ Excede stock ({stock})
                            </div>
                          )}
                        </div>
                        <div className="grid grid-cols-12 gap-2 items-center">
                          <div
                            className="col-span-3 text-[10px] uppercase tracking-widest text-muted-foreground"
                            style={{ fontFamily: "'JetBrains Mono', monospace" }}
                          >
                            Receptor
                          </div>
                          <div className="col-span-8">
                            <select
                              value={inDraft.tecnicoReceptorId ?? ''}
                              onChange={(e) =>
                                updateDraft(p.id, {
                                  tecnicoReceptorId: e.target.value || undefined,
                                })
                              }
                              className="w-full px-2 py-1.5 bg-background border border-border text-xs"
                              style={{ borderRadius: '0.25rem' }}
                            >
                              <option value="">— Uso común —</option>
                              {tecnicosAsignados.map((t) => (
                                <option key={t.tecnicoId} value={t.tecnicoId}>
                                  {t.tecnico.nombre}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div className="col-span-1 flex justify-end">
                            <button
                              type="button"
                              onClick={() => removeDraft(p.id)}
                              className="text-muted-foreground hover:text-destructive"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </div>
                        {tecnicosAsignados.length === 0 && (
                          <div className="text-[10px] text-muted-foreground italic">
                            Este proyecto aún no tiene técnicos asignados. Si
                            querés asignar receptores, andá a la tab "Técnicos"
                            primero.
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })
            )}
          </div>

          <div
            className="pt-2 border-t border-border text-[10px] text-muted-foreground text-center uppercase tracking-widest"
            style={{ fontFamily: "'JetBrains Mono', monospace" }}
          >
            {filtrados.length}{' '}
            {filtrados.length === 1 ? 'producto disponible' : 'productos disponibles'}
            {draft.length > 0 && ` · ${draft.length} seleccionado${draft.length === 1 ? '' : 's'}`}
          </div>

          {/* Comentario opcional */}
          <div>
            <label className="block text-xs font-medium text-foreground mb-1">
              Comentario (opcional)
            </label>
            <textarea
              value={comentario}
              onChange={(e) => setComentario(e.target.value)}
              rows={2}
              placeholder="Nota para la entrega…"
              className="w-full px-3 py-2 bg-background border border-border text-sm focus:outline-none focus:border-foreground/40 resize-none"
              style={{ borderRadius: '0.25rem' }}
            />
          </div>
        </div>
      )}
    </Modal>
  )
}
