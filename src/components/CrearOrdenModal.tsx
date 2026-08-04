import { useEffect, useState, type FormEvent } from 'react'
import { X, Plus, Trash2, ClipboardList, Loader2, Package, Boxes } from 'lucide-react'
import { useAuth } from '../store/auth'
import { useBodegaActiva } from '../store/bodegaActiva'
import { useProductos, productosStore, type ProductoListItem } from '../store/productos'
import { useKits, kitsStore, type Kit } from '../store/kits'
import { useBodegas, bodegasStore } from '../store/bodegas'
import { api, ApiError } from '../lib/api'

type ItemKind = 'producto' | 'kit'

type ItemDraft = {
  uid: string
  kind: ItemKind
  productoId: string
  kitId: string
  cantidad: number
}

type CrearOrdenModalProps = {
  onClose: () => void
  /** Callback cuando el back confirma la creación (refresca la lista, etc). */
  onCreated?: () => void
}

function newItem(): ItemDraft {
  return {
    uid: `i-${Math.random().toString(36).slice(2, 8)}`,
    kind: 'producto',
    productoId: '',
    kitId: '',
    cantidad: 1,
  }
}

/**
 * Modal de Solicitud de Recursos (técnicos/operadores).
 *
 * Reemplaza la versión legacy que usaba un store local de `ordenes` y una
 * lista hardcoded de productos. Ahora:
 *  - El OPERADOR y la BODEGA se leen del authStore + bodegaActivaStore.
 *  - El select de productos usa `productosStore` filtrado por bodega activa.
 *  - El POST va al back real: `POST /api/pedidos`.
 */
export function CrearOrdenModal({ onClose, onCreated }: CrearOrdenModalProps) {
  const auth = useAuth()
  const bodegaId = useBodegaActiva()
  const productosState = useProductos()
  const kitsState = useKits()
  const bodegasState = useBodegas()

  const [items, setItems] = useState<ItemDraft[]>([newItem()])
  const [motivo, setMotivo] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // Cargar productos y kits de la bodega activa la primera vez que abrimos el modal.
  useEffect(() => {
    if (bodegaId && productosState.status === 'idle') {
      void productosStore
        .cargarPaginado({ bodegaId, page: 1, pageSize: 100 })
        .catch(() => undefined)
    }
    if (bodegaId && kitsState.status === 'idle') {
      void kitsStore.cargar(bodegaId).catch(() => undefined)
    }
  }, [bodegaId, productosState.status, kitsState.status])

  // Hidratar la lista de bodegas para poder mostrar el nombre (no el id).
  useEffect(() => {
    if (bodegasState.status === 'idle') {
      void bodegasStore.cargar().catch(() => undefined)
    }
  }, [bodegasState.status])

  const sesion = auth.status === 'autenticado' ? auth.sesion : null
  const operadorNombre = sesion?.usuario.nombre ?? '—'
  const rol = sesion?.usuario.rol ?? '—'

  // Resolver nombre de la bodega a partir del id activo.
  // Si todavía no cargó la lista de bodegas, caemos al id para no quedar
  // en blanco (el back igual acepta el id).
  const bodegaActiva =
    bodegasState.status === 'listo'
      ? bodegasState.bodegas.find((b) => b.id === bodegaId) ?? null
      : null
  const bodegaNombre = bodegaActiva?.nombre ?? bodegaId ?? '—'

  const productos: ProductoListItem[] =
    productosState.status === 'listo' ? productosState.productos : []
  const productosLoading =
    productosState.status === 'cargando' || productosState.status === 'idle'

  const kits: Kit[] = kitsState.status === 'listo' ? kitsState.kits : []
  const kitsLoading = kitsState.status === 'cargando' || kitsState.status === 'idle'

  function setItem(uid: string, patch: Partial<ItemDraft>) {
    setItems((prev) => prev.map((it) => (it.uid === uid ? { ...it, ...patch } : it)))
  }

  function addItem() {
    setItems((prev) => [...prev, newItem()])
  }

  function removeItem(uid: string) {
    setItems((prev) => (prev.length > 1 ? prev.filter((it) => it.uid !== uid) : prev))
  }

  function productoLabel(it: ItemDraft): string {
    if (it.kind === 'kit') {
      const k = kits.find((x) => x.id === it.kitId)
      if (!k) return '(kit no encontrado)'
      return k.nombre
    }
    const p = productos.find((x) => x.id === it.productoId)
    if (!p) return '(producto no encontrado)'
    return p.nombre
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')

    if (!bodegaId) {
      setError('No hay una bodega activa seleccionada.')
      return
    }
    if (!sesion) {
      setError('No hay sesión activa.')
      return
    }
    // Items válidos: cada línea debe tener su id (productoId o kitId según kind) y cantidad > 0
    const filled = items.filter((it) => {
      if (it.cantidad <= 0) return false
      return it.kind === 'producto' ? !!it.productoId : !!it.kitId
    })
    if (filled.length === 0) {
      setError('Agrega al menos un producto o kit con cantidad mayor a 0.')
      return
    }
    if (filled.length < items.length) {
      setError('Completa o elimina todos los ítems antes de enviar.')
      return
    }

    setSubmitting(true)
    try {
      await api.post('/pedidos', {
        bodegaId,
        motivo: motivo.trim() || undefined,
        items: filled.map((it) => {
          if (it.kind === 'kit') {
            return { kitId: it.kitId, cantidad: it.cantidad }
          }
          return { productoId: it.productoId, cantidad: it.cantidad }
        }),
      })
      onCreated?.()
      onClose()
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'No se pudo enviar la orden.'
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
        className="bg-card border border-border w-full max-w-lg max-h-[90vh] overflow-y-auto"
        style={{ borderRadius: '0.25rem' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-5 border-b border-border">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-primary/15 flex items-center justify-center">
              <ClipboardList size={14} className="text-primary" />
            </div>
            <h2
              className="text-lg uppercase text-foreground"
              style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800 }}
            >
              Solicitud de Recursos
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

        <form onSubmit={handleSubmit} className="p-5 space-y-5">
          <div className="grid grid-cols-2 gap-3">
            <InfoCell label="Operador" value={operadorNombre} sub={rol} />
            <InfoCell label="Bodega" value={bodegaNombre} />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <span
                className="text-xs text-muted-foreground tracking-widest uppercase"
                style={{ fontFamily: "'JetBrains Mono', monospace" }}
              >
                Ítems de la orden
              </span>
              <button
                type="button"
                onClick={addItem}
                className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                style={{ fontFamily: "'JetBrains Mono', monospace" }}
              >
                <Plus size={12} />
                Agregar ítem
              </button>
            </div>

            <div className="space-y-2">
              {items.map((it, idx) => (
                <div
                  key={it.uid}
                  className="p-2 bg-muted border border-border"
                  style={{ borderRadius: '0.25rem' }}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className="text-[10px] text-muted-foreground w-5 shrink-0"
                      style={{ fontFamily: "'JetBrains Mono', monospace" }}
                    >
                      {String(idx + 1).padStart(2, '0')}
                    </span>

                    {/* Toggle Producto / Kit */}
                    <div
                      className="flex border border-border"
                      style={{ borderRadius: '0.25rem' }}
                    >
                      <button
                        type="button"
                        onClick={() =>
                          setItem(it.uid, { kind: 'producto', kitId: '' })
                        }
                        className={`px-2 py-1.5 text-[11px] inline-flex items-center gap-1 transition-colors ${
                          it.kind === 'producto'
                            ? 'bg-primary/15 text-primary'
                            : 'text-muted-foreground hover:text-foreground'
                        }`}
                        style={{ fontFamily: "'JetBrains Mono', monospace" }}
                      >
                        <Package size={11} /> Producto
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setItem(it.uid, { kind: 'kit', productoId: '' })
                        }
                        className={`px-2 py-1.5 text-[11px] inline-flex items-center gap-1 transition-colors ${
                          it.kind === 'kit'
                            ? 'bg-secondary/15 text-secondary'
                            : 'text-muted-foreground hover:text-foreground'
                        }`}
                        style={{ fontFamily: "'JetBrains Mono', monospace" }}
                      >
                        <Boxes size={11} /> Kit
                      </button>
                    </div>

                    {it.kind === 'producto' ? (
                      <select
                        value={it.productoId}
                        onChange={(e) => setItem(it.uid, { productoId: e.target.value })}
                        className="flex-1 min-w-0 px-2 py-1.5 bg-background border border-border text-sm text-foreground outline-none focus:border-primary/60"
                        style={{ borderRadius: '0.25rem', fontFamily: "'DM Sans', sans-serif" }}
                        disabled={productosLoading}
                      >
                        <option value="" disabled>
                          {productosLoading ? 'Cargando productos…' : 'Seleccionar producto…'}
                        </option>
                        {productos.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.nombre}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <select
                        value={it.kitId}
                        onChange={(e) => setItem(it.uid, { kitId: e.target.value })}
                        className="flex-1 min-w-0 px-2 py-1.5 bg-background border border-border text-sm text-foreground outline-none focus:border-primary/60"
                        style={{ borderRadius: '0.25rem', fontFamily: "'DM Sans', sans-serif" }}
                        disabled={kitsLoading}
                      >
                        <option value="" disabled>
                          {kitsLoading ? 'Cargando kits…' : 'Seleccionar kit…'}
                        </option>
                        {kits.map((k) => (
                          <option key={k.id} value={k.id}>
                            {k.nombre} ({k.codigo})
                          </option>
                        ))}
                      </select>
                    )}

                    <input
                      type="number"
                      min={1}
                      value={it.cantidad}
                      onChange={(e) => setItem(it.uid, { cantidad: Number(e.target.value) })}
                      className="w-20 px-2 py-1.5 bg-background border border-border text-sm text-foreground text-center outline-none focus:border-primary/60"
                      style={{ borderRadius: '0.25rem', fontFamily: "'JetBrains Mono', monospace" }}
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

                  {/* Si es kit, mostramos el desglose de productos que tiene */}
                  {it.kind === 'kit' && it.kitId && (() => {
                    const k = kits.find((x) => x.id === it.kitId)
                    if (!k) return null
                    return (
                      <div
                        className="mt-2 ml-7 p-2 bg-background border border-border"
                        style={{ borderRadius: '0.25rem' }}
                      >
                        <div
                          className="text-[10px] text-muted-foreground mb-1"
                          style={{ fontFamily: "'JetBrains Mono', monospace" }}
                        >
                          El kit incluye:
                        </div>
                        <ul
                          className="space-y-0.5"
                          style={{ fontFamily: "'JetBrains Mono', monospace" }}
                        >
                          {k.items.map((ki) => (
                            <li
                              key={ki.id}
                              className="text-[10px] text-foreground flex items-center justify-between"
                            >
                              <span className="truncate">· {ki.producto.nombre}</span>
                              <span className="text-muted-foreground">
                                ×{ki.cantidad} por kit
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )
                  })()}
                </div>
              ))}
            </div>

            {!productosLoading && !kitsLoading && productos.length === 0 && kits.length === 0 && (
              <p
                className="mt-2 text-[11px] text-muted-foreground"
                style={{ fontFamily: "'JetBrains Mono', monospace" }}
              >
                ⚠ Esta bodega no tiene productos ni kits registrados todavía.
              </p>
            )}
          </div>

          <div>
            <label
              className="block text-xs text-muted-foreground tracking-widest uppercase mb-1.5"
              style={{ fontFamily: "'JetBrains Mono', monospace" }}
            >
              Motivo / Referencia
            </label>
            <input
              type="text"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Ej: Stock bajo en línea, reposición turno tarde…"
              className={inputClass}
              style={{ borderRadius: '0.25rem', fontFamily: "'DM Sans', sans-serif" }}
            />
          </div>

          <div
            className="bg-muted border border-border p-3"
            style={{ borderRadius: '0.25rem' }}
          >
            <div
              className="text-[10px] text-muted-foreground tracking-widest uppercase mb-1"
              style={{ fontFamily: "'JetBrains Mono', monospace" }}
            >
              Resumen
            </div>
            <div className="text-sm text-foreground">
              {items.filter((it) => it.productoId).length}{' '}
              {items.filter((it) => it.productoId).length === 1 ? 'producto' : 'productos'} ·{' '}
              {items.reduce((acc, it) => acc + (it.productoId ? it.cantidad : 0), 0)} unidades totales
            </div>
            {items.some((it) => it.productoId) && (
              <ul
                className="mt-2 text-xs text-muted-foreground space-y-0.5"
                style={{ fontFamily: "'JetBrains Mono', monospace" }}
              >
                {items
                  .filter((it) => (it.kind === 'producto' ? it.productoId : it.kitId))
                  .map((it) => (
                    <li key={it.uid}>
                      · {it.kind === 'kit' ? '📦 ' : ''}
                      {productoLabel(it)} × {it.cantidad}
                    </li>
                  ))}
              </ul>
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

          <div className="flex items-center gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="flex-1 py-2.5 border border-border text-sm text-foreground hover:border-foreground/30 transition-colors disabled:opacity-50"
              style={{ borderRadius: '0.25rem' }}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 py-2.5 bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-60 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
              style={{ borderRadius: '0.25rem' }}
            >
              {submitting ? (
                <>
                  <Loader2 size={13} className="animate-spin" />
                  Enviando…
                </>
              ) : (
                'Enviar solicitud'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function InfoCell({
  label,
  value,
  sub,
}: {
  label: string
  value: string
  sub?: string
}) {
  return (
    <div
      className="bg-muted border border-border p-2.5"
      style={{ borderRadius: '0.25rem' }}
    >
      <div
        className="text-[10px] text-muted-foreground tracking-widest uppercase"
        style={{ fontFamily: "'JetBrains Mono', monospace" }}
      >
        {label}
      </div>
      <div
        className="text-sm text-foreground mt-0.5 truncate"
        style={{ fontFamily: "'DM Sans', sans-serif" }}
      >
        {value}
      </div>
      {sub && (
        <div
          className="text-[10px] text-muted-foreground mt-0.5"
          style={{ fontFamily: "'JetBrains Mono', monospace" }}
        >
          {sub}
        </div>
      )}
    </div>
  )
}
