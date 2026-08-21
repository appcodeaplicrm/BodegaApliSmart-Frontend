import { useEffect, useState, type FormEvent } from 'react'
import { Plus, Trash2, ClipboardList, Loader2, Package, Boxes } from 'lucide-react'
import { useAuth } from '../store/auth'
import { useBodegaActiva } from '../store/bodegaActiva'
import { useProductos, productosStore, type ProductoListItem } from '../store/productos'
import { useKits, kitsStore, type Kit } from '../store/kits'
import { useBodegas, bodegasStore } from '../store/bodegas'
import { api, ApiError } from '../lib/api'
import { Modal } from './Modal'
import { SelectMobile } from './SelectMobile'

type ItemKind = 'producto' | 'kit'

type BodegueroDisponible = { id: string; nombre: string; rol: string }

type ItemDraft = {
  uid: string
  kind: ItemKind
  productoId: string
  kitId: string
  cantidad: number
  unidadMedidaId: string
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
    unidadMedidaId: '',
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
  const [bodegueros, setBodegueros] = useState<BodegueroDisponible[]>([])
  const [bodegueroAsignadoId, setBodegueroAsignadoId] = useState('')
  const [bodeguerosLoading, setBodeguerosLoading] = useState(false)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // Cargar productos y kits de la bodega activa.
  // ⚠️ Antes (ago 2026) solo se disparaba cuando `status === 'idle'`,
  // pero eso dejaba un bug: si el user ya había cargado productos de
  // OTRA bodega antes (ej: entró a Inventario con bodega A, después
  // cambió a bodega B y abrió el modal de Solicitud), el store tenía
  // cache de A y el modal mostraba "no hay productos" en B aunque
  // B sí tuviera. Fix: recargar SIEMPRE que cambie el bodegaId, no
  // solo la primera vez.
  useEffect(() => {
    if (!bodegaId) return
    void productosStore
      .cargarPaginado({ bodegaId, page: 1, pageSize: 100 })
      .catch(() => undefined)
    void kitsStore.cargar(bodegaId).catch(() => undefined)
    // Solo dependemos de `bodegaId` (no del status), así forzamos
    // refetch cuando cambia la bodega activa.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bodegaId])

  useEffect(() => {
    if (!bodegaId) return
    setBodeguerosLoading(true)
    setBodegueroAsignadoId('')
    void api.get<BodegueroDisponible[]>(`/pedidos/bodegueros/disponibles?bodegaId=${encodeURIComponent(bodegaId)}`)
      .then((data) => {
        setBodegueros(data)
        if (data.length === 1) setBodegueroAsignadoId(data[0].id)
      })
      .catch((err) => {
        setBodegueros([])
        setError(err instanceof Error ? err.message : 'No se pudieron cargar los bodegueros.')
      })
      .finally(() => setBodeguerosLoading(false))
  }, [bodegaId])

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
    if (bodegueros.length === 0) {
      setError('No hay un bodeguero disponible para recibir la solicitud.')
      return
    }
    if (!bodegueroAsignadoId) {
      setError('Selecciona el bodeguero que recibirá la solicitud.')
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
        bodegueroAsignadoId,
        motivo: motivo.trim() || undefined,
        items: filled.map((it) => {
          if (it.kind === 'kit') {
            return { kitId: it.kitId, cantidad: it.cantidad }
          }
          return {
            productoId: it.productoId,
            cantidad: it.cantidad,
            unidadMedidaId: it.unidadMedidaId || undefined,
          }
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
    'w-full px-3 py-2.5 min-h-[44px] bg-muted border border-border text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/60 transition-colors'

  return (
    <Modal
      open
      onClose={onClose}
      title="Solicitud de Recursos"
      description={`${bodegaNombre} · ${operadorNombre} (${rol})`}
      icon={<ClipboardList size={16} className="text-primary" />}
      size="md"
      footer={
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="flex-1 min-h-[44px] py-2.5 border border-border text-sm text-foreground hover:border-foreground/30 transition-colors disabled:opacity-50"
            style={{ borderRadius: '0.25rem' }}
          >
            Cancelar
          </button>
          <button
            type="submit"
            form="crear-orden-form"
            disabled={submitting || bodeguerosLoading || !bodegueroAsignadoId}
            className="flex-1 min-h-[44px] py-2.5 bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-60 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
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
      }
    >
      <form id="crear-orden-form" onSubmit={handleSubmit} className="p-5 space-y-5">
        <div className="grid grid-cols-2 gap-3">
          <InfoCell label="Operador" value={operadorNombre} sub={rol} />
          <InfoCell label="Bodega" value={bodegaNombre} />
        </div>

        <div>
          <label className="block text-xs text-muted-foreground tracking-widest uppercase mb-1.5 font-mono">
            Bodeguero que recibirá la solicitud
          </label>
          <SelectMobile
            value={bodegueroAsignadoId}
            onChange={setBodegueroAsignadoId}
            options={bodegueros.map((bodeguero) => ({
              value: bodeguero.id,
              label: `${bodeguero.nombre} · ${bodeguero.rol}`,
            }))}
            placeholder={bodeguerosLoading ? 'Buscando bodegueros…' : 'Seleccionar bodeguero…'}
            disabled={bodeguerosLoading || bodegueros.length <= 1}
            label="Bodeguero"
            className="w-full"
          />
          {!bodeguerosLoading && bodegueros.length === 0 && (
            <p className="mt-1.5 text-[11px] text-primary font-mono">
              Esta bodega no tiene usuarios con permisos para ver y gestionar Despachos.
            </p>
          )}
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
              className="inline-flex items-center gap-1 min-h-[44px] px-2 text-xs text-primary hover:underline"
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
                <div className="grid grid-cols-[1.25rem_minmax(0,1fr)_5rem_2.75rem] items-center gap-2 sm:grid-cols-[1.25rem_auto_minmax(0,1fr)_5rem_2.75rem]">
                  <span
                    className="text-[10px] text-muted-foreground w-5 shrink-0"
                    style={{ fontFamily: "'JetBrains Mono', monospace" }}
                  >
                    {String(idx + 1).padStart(2, '0')}
                  </span>

                  {/* Toggle Producto / Kit */}
                  <div
                    className="flex border border-border flex-1 sm:flex-initial"
                    style={{ borderRadius: '0.25rem' }}
                  >
                    <button
                      type="button"
                      onClick={() =>
                        setItem(it.uid, { kind: 'producto', kitId: '', unidadMedidaId: '' })
                      }
                      className={`flex-1 sm:flex-initial px-2 py-1.5 min-h-[44px] text-[11px] inline-flex items-center justify-center gap-1 transition-colors ${
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
                        setItem(it.uid, { kind: 'kit', productoId: '', unidadMedidaId: '' })
                      }
                      className={`flex-1 sm:flex-initial px-2 py-1.5 min-h-[44px] text-[11px] inline-flex items-center justify-center gap-1 transition-colors ${
                        it.kind === 'kit'
                          ? 'bg-secondary/15 text-secondary'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                      style={{ fontFamily: "'JetBrains Mono', monospace" }}
                    >
                      <Boxes size={11} /> Kit
                    </button>
                  </div>

                  <input
                    type="number"
                    min={0.001}
                    step={0.001}
                    value={it.cantidad}
                    onChange={(e) => setItem(it.uid, { cantidad: Number(e.target.value) })}
                    className="col-start-3 row-start-1 min-h-[44px] w-20 border border-border bg-background px-2 py-1.5 text-center text-sm text-foreground outline-none focus:border-primary/60 sm:col-start-4"
                    style={{ borderRadius: '0.25rem', fontFamily: "'JetBrains Mono', monospace" }}
                  />
                  <button
                    type="button"
                    onClick={() => removeItem(it.uid)}
                    disabled={items.length === 1}
                    className="col-start-4 row-start-1 inline-flex min-h-[44px] min-w-[44px] items-center justify-center p-1.5 text-muted-foreground transition-colors hover:text-primary disabled:cursor-not-allowed disabled:opacity-30 sm:col-start-5"
                    aria-label="Eliminar ítem"
                  >
                    <Trash2 size={14} />
                  </button>
                {/* En móvil el selector ocupa la segunda fila completa.
                    En PC se ubica entre el tipo de recurso y la cantidad. */}
                <div className="col-span-4 col-start-1 row-start-2 min-w-0 sm:col-span-1 sm:col-start-3 sm:row-start-1">
                  {it.kind === 'producto' ? (
                    <SelectMobile
                      value={it.productoId}
                      onChange={(v) => {
                        const producto = productos.find((p) => p.id === v)
                        setItem(it.uid, {
                          productoId: v,
                          unidadMedidaId: producto?.unidadMedida.id ?? '',
                        })
                      }}
                      options={productos.map((p) => ({ value: p.id, label: p.nombre }))}
                      placeholder={
                        productosLoading ? 'Cargando productos…' : 'Seleccionar producto…'
                      }
                      disabled={productosLoading}
                      label="Producto"
                      className="w-full"
                    />
                  ) : (
                    <SelectMobile
                      value={it.kitId}
                      onChange={(v) => setItem(it.uid, { kitId: v })}
                      options={kits.map((k) => ({
                        value: k.id,
                        label: `${k.nombre} (${k.codigo})`,
                      }))}
                      placeholder={kitsLoading ? 'Cargando kits…' : 'Seleccionar kit…'}
                      disabled={kitsLoading}
                      label="Kit"
                      className="w-full"
                    />
                  )}
                </div>
                {it.kind === 'producto' && it.productoId && (() => {
                  const producto = productos.find((p) => p.id === it.productoId)
                  if (!producto) return null
                  const opciones = [
                    { id: producto.unidadMedida.id, label: producto.unidadMedida.abreviatura },
                    ...producto.conversiones
                      .filter((c) => c.unidadDestino.id === producto.unidadMedida.id)
                      .map((c) => ({
                        id: c.unidadOrigen.id,
                        label: `${c.unidadOrigen.abreviatura} (1 = ${Number(c.factorConversion)} ${producto.unidadMedida.abreviatura})`,
                      })),
                  ]
                  return (
                    <div className="mt-2 ml-7">
                      <SelectMobile
                        value={it.unidadMedidaId || producto.unidadMedida.id}
                        onChange={(v) => setItem(it.uid, { unidadMedidaId: v })}
                        options={opciones.map((o) => ({ value: o.id, label: o.label }))}
                        label="Presentación solicitada"
                        className="w-full"
                      />
                    </div>
                  )
                })()}
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
      </form>
    </Modal>
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
