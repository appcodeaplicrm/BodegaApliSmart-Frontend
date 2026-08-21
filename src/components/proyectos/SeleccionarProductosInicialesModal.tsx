/**
 * Modal de selección de productos iniciales (dotación) al crear
 * un proyecto.
 *
 * Patrón: mirror de `SeleccionarUsuarioModal` pero para productos.
 *
 * Características:
 *  - Self-contained: carga los productos por su cuenta (con retry).
 *  - Búsqueda por nombre o código.
 *  - Lista de productos con su stock disponible (chip en verde si
 *    hay stock, en rojo si no).
 *  - Click en un producto abre un sub-form con cantidad y receptor
 *    (opcional: "Uso común" o uno de los técnicos asignados).
 *  - Multi-selección: el user puede agregar varios productos antes
 *    de confirmar.
 *  - Footer: "Agregar N productos" para confirmar y cerrar.
 *
 * Decisión UX: en vez de un checkbox + columna de cantidad inline
 * (que era el patrón anterior, en la tabla dentro de
 * `ProyectoFormModal`), acá cada producto es una "tarjeta" clickable
 * que abre un mini-form. Es más limpio en mobile y permite mostrar
 * el stock con su color.
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
import type { ProyectoUsuarioAsignable } from './types'

export type ProductoInicialParaCrearModal = {
  productoId: string
  cantidad: number
  tecnicoReceptorId?: string
  // Para mostrar en la UI del padre (ProyectoFormModal) sin volver
  // a buscar el producto en el catálogo:
  nombre: string
  codigo: string
  unidad: string
  stockDisponible: number
}

type Props = {
  open: boolean
  bodegaId: string
  /** Técnicos ya elegidos en el form padre (para "Receptor"). */
  tecnicosAsignados: ProyectoUsuarioAsignable[]
  /** Items ya cargados (al reabrir, mantiene selección). */
  initialItems?: ProductoInicialParaCrearModal[]
  onConfirm: (items: ProductoInicialParaCrearModal[]) => void
  onClose: () => void
}

export function SeleccionarProductosInicialesModal({
  open,
  bodegaId,
  tecnicosAsignados,
  initialItems = [],
  onConfirm,
  onClose,
}: Props) {
  const [productos, setProductos] = useState<ProductoCatalogoT[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busqueda, setBusqueda] = useState('')

  // Borrador de productos que se están agregando. Cada row: una
  // tupla (productoId, cantidad, tecnicoReceptorId).
  const [draft, setDraft] = useState<ProductoInicialParaCrearModal[]>(initialItems)

  // Reset del draft cada vez que se abre el modal con un nuevo set
  // inicial (caso típico: se cerró, se cambió la selección, se vuelve
  // a abrir).
  useEffect(() => {
    if (open) setDraft(initialItems)
  }, [open, initialItems])

  // Carga self-contained de los productos. Si falla, retry inline.
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

  const filtrados = useMemo(() => {
    const q = busqueda.toLowerCase().trim()
    if (!q) return productos
    return productos.filter(
      (p) =>
        p.nombre.toLowerCase().includes(q) ||
        (p.codigo ?? '').toLowerCase().includes(q),
    )
  }, [productos, busqueda])

  // Productos ya en el draft (se muestran como "agregados" en la lista).
  const draftByProductoId = useMemo(() => {
    const map = new Map<string, ProductoInicialParaCrearModal>()
    for (const d of draft) map.set(d.productoId, d)
    return map
  }, [draft])

  function agregarProducto(p: ProductoCatalogoT) {
    if (draftByProductoId.has(p.id)) {
      // Ya está: lo removemos (toggle).
      setDraft((prev) => prev.filter((d) => d.productoId !== p.id))
      return
    }
    setDraft((prev) => [
      ...prev,
      {
        productoId: p.id,
        cantidad: 1,
        tecnicoReceptorId: undefined,
        nombre: p.nombre,
        codigo: p.codigo,
        unidad: p.unidadMedida?.abreviatura ?? '',
        stockDisponible: Number(p.stockBodega ?? 0),
      },
    ])
  }

  function updateDraft(productoId: string, patch: Partial<ProductoInicialParaCrearModal>) {
    setDraft((prev) =>
      prev.map((d) => (d.productoId === productoId ? { ...d, ...patch } : d)),
    )
  }

  function removeDraft(productoId: string) {
    setDraft((prev) => prev.filter((d) => d.productoId !== productoId))
  }

  function handleConfirm() {
    // Filtrar los vacíos (cantidad 0 o sin productoId) antes de mandar.
    const items = draft
      .filter((d) => d.productoId && d.cantidad > 0)
      .map((d) => ({
        productoId: d.productoId,
        cantidad: d.cantidad,
        tecnicoReceptorId: d.tecnicoReceptorId,
        nombre: d.nombre,
        codigo: d.codigo,
        unidad: d.unidad,
        stockDisponible: d.stockDisponible,
      }))
    onConfirm(items)
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Elegir productos iniciales"
      description="Dotación del proyecto. Se descuentan del stock al guardar."
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
              disabled={draft.length === 0}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
              style={{ borderRadius: '0.25rem' }}
            >
              <Check size={14} />
              Agregar {draft.length > 0 ? `${draft.length} ` : ''}a la lista
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
                    {/* Row clickable principal */}
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
                      {/* Checkbox */}
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

                      {/* Info */}
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

                      {/* Stock chip */}
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

                      {/* Plus icon */}
                      {!sinStock && !inDraft && (
                        <Plus size={13} className="text-muted-foreground shrink-0" />
                      )}
                    </button>

                    {/* Sub-form: cantidad + receptor (solo si está en el draft) */}
                    {inDraft && (
                      <div className="px-3 py-2 border-t border-border bg-muted/30 space-y-2">
                        <div className="grid grid-cols-12 gap-2 items-center">
                          <div className="col-span-3 text-[10px] uppercase tracking-widest text-muted-foreground" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
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
                          <div className="col-span-1 text-[10px] text-muted-foreground text-center" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                            {p.unidadMedida?.abreviatura ?? '—'}
                          </div>
                          {inDraft.cantidad > stock && (
                            <div className="col-span-5 text-[10px] text-destructive">
                              ⚠ Excede stock ({stock})
                            </div>
                          )}
                        </div>
                        <div className="grid grid-cols-12 gap-2 items-center">
                          <div className="col-span-3 text-[10px] uppercase tracking-widest text-muted-foreground" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
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
                                <option key={t.id} value={t.id}>
                                  {t.nombre}
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
                            Tip: primero elegí los técnicos en el form para poder
                            asignarles productos específicos. Si no, quedan como
                            "uso común".
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
        </div>
      )}
    </Modal>
  )
}
