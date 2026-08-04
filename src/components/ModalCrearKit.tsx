import { useEffect, useState, type FormEvent } from 'react'
import { X, Plus, Trash2, Loader2, Package, Hash } from 'lucide-react'
import { kitsStore, type Kit } from '../store/kits'
import { productosStore, type ProductoListItem } from '../store/productos'
import { ApiError } from '../lib/api'

type ItemDraft = {
  uid: string
  productoId: string
  cantidad: number
}

type Props = {
  bodegaId: string
  /** Si viene, el modal se abre en modo edición con el kit cargado. */
  kitInicial?: Kit | null
  onClose: () => void
  onCreated?: (k: Kit) => void
  onUpdated?: (k: Kit) => void
}

function newItem(): ItemDraft {
  return { uid: `i-${Math.random().toString(36).slice(2, 8)}`, productoId: '', cantidad: 1 }
}

/**
 * Modal de creación / edición de un Kit.
 *
 *  - Si `kitInicial` está provisto, el modal entra en modo edición
 *    con los items prellenados.
 *  - Si no, es modo creación.
 *
 * El kit no es un Producto: es un agrupador que vive atado a una bodega
 * y se usa para pedir varios productos en una sola línea de Solicitud
 * de Recursos.
 */
export function ModalCrearKit({ bodegaId, kitInicial, onClose, onCreated, onUpdated }: Props) {
  const esEdicion = !!kitInicial
  const [nombre, setNombre] = useState(kitInicial?.nombre ?? '')
  const [descripcion, setDescripcion] = useState(kitInicial?.descripcion ?? '')
  const [items, setItems] = useState<ItemDraft[]>(() =>
    kitInicial && kitInicial.items.length > 0
      ? kitInicial.items.map((it) => ({
          uid: `i-${it.id}`,
          productoId: it.productoId,
          cantidad: it.cantidad,
        }))
      : [newItem()],
  )
  const [productos, setProductos] = useState<ProductoListItem[]>([])
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (productos.length === 0) {
      void productosStore
        .cargarPaginado({ bodegaId, page: 1, pageSize: 100 })
        .then((r) => setProductos(r.data))
        .catch(() => undefined)
    }
  }, [bodegaId, productos.length])

  function setItem(uid: string, patch: Partial<ItemDraft>) {
    setItems((prev) => prev.map((it) => (it.uid === uid ? { ...it, ...patch } : it)))
  }

  function addItem() {
    setItems((prev) => [...prev, newItem()])
  }

  function removeItem(uid: string) {
    setItems((prev) => (prev.length > 1 ? prev.filter((it) => it.uid !== uid) : prev))
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')

    if (!nombre.trim()) {
      setError('Indicá el nombre del kit.')
      return
    }
    const filled = items.filter((it) => it.productoId && it.cantidad > 0)
    if (filled.length === 0) {
      setError('Agregá al menos un producto con cantidad mayor a 0.')
      return
    }
    if (filled.length < items.length) {
      setError('Completá o eliminá todos los ítems antes de guardar.')
      return
    }
    const ids = filled.map((it) => it.productoId)
    if (new Set(ids).size !== ids.length) {
      setError('No se permiten productos duplicados en el kit.')
      return
    }

    setSubmitting(true)
    try {
      if (esEdicion && kitInicial) {
        const k = await kitsStore.actualizar(kitInicial.id, {
          nombre: nombre.trim(),
          descripcion: descripcion.trim() || undefined,
          items: filled.map((it) => ({
            productoId: it.productoId,
            cantidad: it.cantidad,
          })),
        })
        onUpdated?.(k)
      } else {
        const k = await kitsStore.crear({
          bodegaId,
          nombre: nombre.trim(),
          descripcion: descripcion.trim() || undefined,
          items: filled.map((it) => ({
            productoId: it.productoId,
            cantidad: it.cantidad,
          })),
        })
        onCreated?.(k)
      }
      onClose()
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'No se pudo guardar el kit.'
      setError(msg)
    } finally {
      setSubmitting(false)
    }
  }

  const inputClass =
    'w-full px-3 py-2.5 bg-muted border border-border text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/60 transition-colors'

  return (
    <div
      className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-card border border-border w-full max-w-2xl max-h-[92vh] flex flex-col"
        style={{ borderRadius: '0.25rem' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-5 border-b border-border shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-primary/15 flex items-center justify-center">
              <Package size={18} className="text-primary" />
            </div>
            <div>
              <h2
                className="text-xl uppercase text-foreground leading-none"
                style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900 }}
              >
                {esEdicion ? 'Editar Kit' : 'Nuevo Kit'}
              </h2>
              <p
                className="mt-1 text-xs text-muted-foreground"
                style={{ fontFamily: "'DM Sans', sans-serif" }}
              >
                {esEdicion
                  ? 'Modificá los productos que componen este kit'
                  : 'Agrupá varios productos en un solo ítem solicitable'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Cerrar"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label
                className="text-xs text-muted-foreground tracking-widest uppercase mb-1.5 block"
                style={{ fontFamily: "'JetBrains Mono', monospace" }}
              >
                Nombre *
              </label>
              <input
                type="text"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                placeholder="Ej: Kit de limpieza, Kit herramientas eléctricas…"
                className={inputClass}
                style={{ borderRadius: '0.25rem', fontFamily: "'DM Sans', sans-serif" }}
              />
            </div>
            <div>
              <label
                className="text-xs text-muted-foreground tracking-widest uppercase mb-1.5 block"
                style={{ fontFamily: "'JetBrains Mono', monospace" }}
              >
                Descripción
              </label>
              <input
                type="text"
                value={descripcion}
                onChange={(e) => setDescripcion(e.target.value)}
                placeholder="Opcional"
                className={inputClass}
                style={{ borderRadius: '0.25rem', fontFamily: "'DM Sans', sans-serif" }}
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <span
                className="text-xs text-muted-foreground tracking-widest uppercase"
                style={{ fontFamily: "'JetBrains Mono', monospace" }}
              >
                Productos del kit *
              </span>
              <button
                type="button"
                onClick={addItem}
                className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                style={{ fontFamily: "'JetBrains Mono', monospace" }}
              >
                <Plus size={12} /> Agregar producto
              </button>
            </div>

            <div className="space-y-2">
              {items.map((it, idx) => (
                <div
                  key={it.uid}
                  className="flex items-center gap-2 p-2 bg-muted border border-border"
                  style={{ borderRadius: '0.25rem' }}
                >
                  <span
                    className="text-[10px] text-muted-foreground w-5 shrink-0"
                    style={{ fontFamily: "'JetBrains Mono', monospace" }}
                  >
                    {String(idx + 1).padStart(2, '0')}
                  </span>
                  <select
                    value={it.productoId}
                    onChange={(e) => setItem(it.uid, { productoId: e.target.value })}
                    className="flex-1 min-w-0 px-2 py-1.5 bg-background border border-border text-sm text-foreground outline-none focus:border-primary/60"
                    style={{ borderRadius: '0.25rem', fontFamily: "'DM Sans', sans-serif" }}
                  >
                    <option value="" disabled>
                      Elegí un producto…
                    </option>
                    {productos.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.nombre} ({p.codigo}) · {p.unidadMedida.abreviatura}
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    min={0.001}
                    step={0.001}
                    value={it.cantidad}
                    onChange={(e) => setItem(it.uid, { cantidad: Number(e.target.value) })}
                    className="w-24 px-2 py-1.5 bg-background border border-border text-sm text-foreground text-center outline-none focus:border-primary/60"
                    style={{ borderRadius: '0.25rem', fontFamily: "'JetBrains Mono', monospace" }}
                    title="Cantidad por unidad de kit"
                  />
                  <button
                    type="button"
                    onClick={() => removeItem(it.uid)}
                    disabled={items.length === 1}
                    className="p-1.5 text-muted-foreground hover:text-primary transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                    aria-label="Eliminar ítem"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>

            {productos.length === 0 && (
              <p
                className="mt-2 text-[11px] text-muted-foreground"
                style={{ fontFamily: "'JetBrains Mono', monospace" }}
              >
                ⚠ Esta bodega no tiene productos registrados. Creá al menos uno antes de armar kits.
              </p>
            )}
          </div>

          {error && (
            <p
              className="text-xs text-primary bg-primary/10 border border-primary/20 px-3 py-2"
              style={{ fontFamily: "'JetBrains Mono', monospace", borderRadius: '0.25rem' }}
            >
              ⚠ {error}
            </p>
          )}
        </form>

        <div className="p-4 border-t border-border flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 inline-flex items-center justify-center gap-2 py-2.5 border border-border text-sm text-foreground hover:border-foreground/30 transition-colors"
            style={{ borderRadius: '0.25rem' }}
          >
            <X size={14} />
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting}
            className="flex-1 inline-flex items-center justify-center gap-2 py-2.5 bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            style={{ borderRadius: '0.25rem' }}
          >
            {submitting ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                Guardando…
              </>
            ) : (
              <>
                <Hash size={14} />
                {esEdicion ? 'Guardar cambios' : 'Crear Kit'}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
