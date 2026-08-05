import { useEffect, useState, useCallback } from 'react'
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Plus,
  Loader2,
  RefreshCcw,
  TrendingUp,
  X,
  ChevronDown,
  AlertTriangle,
  Calendar,
} from 'lucide-react'
import { useMovimientos, movimientosStore, type Movimiento } from '../store/movimientos'
import { Pagination } from './Pagination'
import { useProductos, productosStore, type ProductoListItem } from '../store/productos'
import { useUnidadesMedida, unidadesMedidaStore, type UnidadMedida } from '../store/unidades-medida'
import { PageHeader } from './PageHeader'
import { useBodegaActiva } from '../store/bodegaActiva'
import { useAuth } from '../store/auth'

const TIPOS_FILTRO = [
  { value: 'todos', label: 'Todos' },
  { value: 'entrada', label: 'Entradas' },
  { value: 'salida', label: 'Salidas' },
] as const
type TipoFiltro = (typeof TIPOS_FILTRO)[number]['value']

const DEFAULT_PAGE_SIZE = 10

export function Movimientos() {
  const auth = useAuth()
  const activaId = useBodegaActiva()
  const movState = useMovimientos()
  const prodState = useProductos()
  const unidadesState = useUnidadesMedida()

  const puedeEditar =
    auth.status === 'autenticado' && auth.sesion.permisos.includes('inventario.editar')

  const [openNuevo, setOpenNuevo] = useState(false)
  const [filtroTipo, setFiltroTipo] = useState<TipoFiltro>('todos')
  const [filtroProducto, setFiltroProducto] = useState<string>('todos')
  const [toast, setToast] = useState<string | null>(null)

  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE)

  const cargarMovs = useCallback(() => {
    if (!activaId) return
    void movimientosStore
      .cargarPaginado({ bodegaId: activaId, page, pageSize })
      .catch(() => undefined)
  }, [activaId, page, pageSize])

  // Cargar catálogos
  useEffect(() => {
    if (unidadesState.status === 'idle') {
      void unidadesMedidaStore.cargar().catch(() => undefined)
    }
  }, [])

  // Carga inicial cuando cambia la bodega activa
  useEffect(() => {
    if (!activaId) return
    setPage(1)
    void movimientosStore
      .cargarPaginado({ bodegaId: activaId, page: 1, pageSize })
      .catch(() => undefined)
    if (prodState.status === 'idle') {
      void productosStore.cargarPaginado({ bodegaId: activaId, page: 1, pageSize: 100 })
        .catch(() => undefined)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activaId, pageSize])

  // Cuando cambia la página, refetch
  useEffect(() => {
    if (!activaId) return
    if (movState.status === 'idle') return
    cargarMovs()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page])

  const movimientos = movState.status === 'listo' ? movState.movimientos : []
  const total = movState.status === 'listo' ? movState.total : 0
  const totalPages = movState.status === 'listo' ? movState.totalPages : 0
  const productos = prodState.status === 'listo' ? prodState.productos : []
  const unidades = unidadesState.status === 'listo' ? unidadesState.unidades : []

  const visibles = movimientos.filter((m) => {
    if (filtroProducto !== 'todos' && m.producto.id !== filtroProducto) return false
    if (filtroTipo === 'entrada' && !esEntrada(m.tipoMovimiento.signo)) return false
    if (filtroTipo === 'salida' && m.tipoMovimiento.signo !== 'S') return false
    return true
  })

  async function handleRefresh() {
    cargarMovs()
  }

  function handleCreado() {
    setOpenNuevo(false)
    setToast('Movimiento registrado')
    setTimeout(() => setToast(null), 3000)
    cargarMovs()
  }

  return (
    <div className="flex-1 flex flex-col min-w-0 min-h-0">
      <PageHeader
        title="Movimientos"
        subtitle="STOCKPRO · ENTRADAS, SALIDAS Y AJUSTES"
        actions={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleRefresh}
              disabled={movState.status === 'cargando' || !activaId}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 border border-border text-xs text-foreground hover:border-foreground/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ borderRadius: '0.25rem' }}
              aria-label="Refrescar"
            >
              <RefreshCcw
                size={13}
                className={movState.status === 'cargando' ? 'animate-spin' : ''}
              />
            </button>
            <button
              type="button"
              onClick={() => setOpenNuevo(true)}
              disabled={!activaId || !puedeEditar}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground text-xs font-medium hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ borderRadius: '0.25rem' }}
            >
              <Plus size={13} />
              Nuevo Movimiento
            </button>
          </div>
        }
      />

      <div className="flex-1 overflow-y-auto p-8 space-y-6">
        <div className="space-y-6">
        {/* Filtros */}
        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <select
              value={filtroProducto}
              onChange={(e) => setFiltroProducto(e.target.value)}
              className="w-full pl-3 pr-9 py-2.5 bg-card border border-border text-sm text-foreground outline-none focus:border-primary/60 transition-colors appearance-none"
              style={{ borderRadius: '0.25rem' }}
            >
              <option value="todos">Todos los productos</option>
              {productos.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre} ({p.codigo})
                </option>
              ))}
            </select>
            <ChevronDown
              size={14}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
            />
          </div>
          <div className="flex border border-border" style={{ borderRadius: '0.25rem' }}>
            {TIPOS_FILTRO.map((t) => (
              <button
                key={t.value}
                type="button"
                onClick={() => setFiltroTipo(t.value)}
                className={`px-4 py-2.5 text-sm transition-colors ${
                  filtroTipo === t.value
                    ? 'bg-primary/15 text-primary'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
                style={{ fontFamily: "'JetBrains Mono', monospace" }}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Lista */}
        {movState.status === 'cargando' && movimientos.length === 0 ? (
          <div
            className="bg-card border border-border py-20 px-6 flex flex-col items-center justify-center text-center"
            style={{ borderRadius: '0.25rem' }}
          >
            <Loader2 size={24} className="text-primary animate-spin" />
            <p
              className="mt-3 text-sm text-muted-foreground"
              style={{ fontFamily: "'JetBrains Mono', monospace" }}
            >
              Cargando movimientos…
            </p>
          </div>
        ) : movState.status === 'error' ? (
          <div
            className="bg-card border border-primary/30 py-12 px-6 flex flex-col items-center text-center"
            style={{ borderRadius: '0.25rem' }}
          >
            <AlertTriangle size={24} className="text-primary" />
            <p className="mt-3 text-sm text-foreground">{movState.mensaje}</p>
          </div>
        ) : visibles.length === 0 ? (
          <div
            className="bg-card border border-border py-20 px-6 flex flex-col items-center justify-center text-center"
            style={{ borderRadius: '0.25rem' }}
          >
            <div className="w-14 h-14 bg-muted flex items-center justify-center mb-5">
              <TrendingUp size={24} className="text-muted-foreground" />
            </div>
            <h3
              className="text-xl uppercase text-foreground"
              style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800 }}
            >
              {movimientos.length === 0
                ? 'Sin movimientos todavía'
                : 'No hay movimientos en este filtro'}
            </h3>
            <p
              className="mt-2 text-sm text-muted-foreground max-w-sm"
              style={{ fontFamily: "'DM Sans', sans-serif" }}
            >
              Cuando registres entradas o salidas, aparecen acá.
            </p>
          </div>
        ) : (
          <>
            <ul className="space-y-2">
              {visibles.map((m) => (
                <MovimientoRow key={m.id} m={m} />
              ))}
            </ul>
            <Pagination
              page={page}
              totalPages={totalPages}
              total={total}
              pageSize={pageSize}
              onChange={setPage}
              onPageSizeChange={(s) => {
                setPageSize(s)
                setPage(1)
              }}
              disabled={movState.status === 'cargando'}
            />
          </>
        )}
      </div>

      {openNuevo && activaId && (
        <NuevoMovimientoModal
          bodegaId={activaId}
          productos={productos}
          unidades={unidades}
          onClose={() => setOpenNuevo(false)}
          onCreated={handleCreado}
        />
      )}

      {toast && (
        <div
          className="fixed bottom-4 right-4 z-50 bg-card border border-secondary/40 px-4 py-2 text-xs text-secondary shadow-lg"
          style={{ borderRadius: '0.25rem', fontFamily: "'JetBrains Mono', monospace" }}
        >
          ✓ {toast}
        </div>
      )}
    </div>
    </div>
  )
}

function esEntrada(signo: string) {
  return signo === 'E'
}

function MovimientoRow({ m }: { m: Movimiento }) {
  const fecha = new Date(m.fecha)
  const fechaStr = fecha.toLocaleDateString('es-CO', { day: '2-digit', month: 'short' })
  const horaStr = fecha.toLocaleTimeString('es-CO', {
    hour: '2-digit',
    minute: '2-digit',
  })

  const esEnt = m.tipoMovimiento.signo === 'E'
  const Icon = esEnt ? ArrowDownToLine : m.tipoMovimiento.signo === 'S' ? ArrowUpFromLine : TrendingUp
  const colorClass = esEnt
    ? 'text-secondary border-secondary/30 bg-secondary/5'
    : m.tipoMovimiento.signo === 'S'
      ? 'text-primary border-primary/30 bg-primary/5'
      : 'text-muted-foreground border-border bg-muted/30'

  return (
    <li
      className="bg-card border border-border p-4"
      style={{ borderRadius: '0.25rem' }}
    >
      <div className="flex items-start gap-3">
        <div
          className={`w-10 h-10 flex items-center justify-center shrink-0 ${colorClass.split(' ')[2]}`}
          style={{ borderRadius: '0.25rem' }}
        >
          <Icon size={16} className={esEnt ? 'text-secondary' : 'text-primary'} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 flex-wrap">
            <div className="min-w-0">
              <div
                className="text-sm text-foreground"
                style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800 }}
              >
                {m.producto.nombre}
              </div>
              <div
                className="text-[10px] text-muted-foreground flex items-center gap-2 mt-0.5"
                style={{ fontFamily: "'JetBrains Mono', monospace" }}
              >
                <span>{m.producto.codigo}</span>
                <span>·</span>
                <span>{m.usuario.nombre}</span>
                <span>·</span>
                <Calendar size={10} />
                <span>
                  {fechaStr} {horaStr}
                </span>
              </div>
            </div>

            <div className="text-right shrink-0">
              <div
                className={`text-base font-semibold ${esEnt ? 'text-secondary' : 'text-primary'}`}
                style={{ fontFamily: "'Barlow Condensed', sans-serif" }}
              >
                {esEnt ? '+' : '−'}
                {Number(m.cantidad).toLocaleString('es-CO')} {m.producto.unidadMedida.abreviatura}
              </div>
              {Number(m.cantidad) !== Number(m.cantidadBase) && (
                <div
                  className="text-[10px] text-muted-foreground"
                  style={{ fontFamily: "'JetBrains Mono', monospace" }}
                >
                  = {Number(m.cantidadBase).toLocaleString('es-CO')} base
                </div>
              )}
              <span
                className={`text-[9px] uppercase tracking-widest px-1.5 py-0.5 border inline-block mt-1 ${colorClass}`}
                style={{
                  borderRadius: '0.125rem',
                  fontFamily: "'JetBrains Mono', monospace",
                }}
              >
                {m.tipoMovimiento.nombre}
              </span>
            </div>
          </div>

          {m.observacion && (
            <p
              className="mt-2 text-xs text-muted-foreground"
              style={{ fontFamily: "'DM Sans', sans-serif" }}
            >
              {m.observacion}
            </p>
          )}
        </div>
      </div>
    </li>
  )
}

/* ─── Modal para crear movimiento ──────────────────────────── */

type ModalProps = {
  bodegaId: string
  productos: ProductoListItem[]
  unidades: UnidadMedida[]
  onClose: () => void
  onCreated: () => void
}

function NuevoMovimientoModal({ bodegaId, productos, onClose, onCreated }: ModalProps) {
  const [productoId, setProductoId] = useState<string>('')
  const [tipoMovimientoNombre, setTipoMovimientoNombre] = useState<string>('Entrada')
  const [cantidad, setCantidad] = useState(0)
  const [unidadId, setUnidadId] = useState<string>('')
  const [observacion, setObservacion] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [tiposMovimiento, setTiposMovimiento] = useState<Array<{ id: string; nombre: string; signo: string }>>([])

  // Conversiones del producto seleccionado (para permitir cargar en otra
  // unidad y que el back la convierta a la base).
  const [conversiones, setConversiones] = useState<
    Array<{ id: string; factorConversion: number; unidadOrigen: { id: string; nombre: string; abreviatura: string }; unidadDestino: { id: string; nombre: string; abreviatura: string } }>
  >([])

  useEffect(() => {
    void movimientosStore
      .tipos()
      .then(setTiposMovimiento)
      .catch(() => undefined)
  }, [])

  // Cuando cambia el producto: cargar sus conversiones y autosetear la
  // unidad al campo `unidadMedidaId` del producto (la base).
  useEffect(() => {
    if (!productoId) {
      setConversiones([])
      setUnidadId('')
      return
    }
    const prod = productos.find((p) => p.id === productoId)
    if (prod) {
      setUnidadId(prod.unidadMedida.id)
    }
    void productosStore
      .listarConversiones(productoId)
      .then(setConversiones)
      .catch(() => setConversiones([]))
  }, [productoId, productos])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!productoId) return setError('Elegí un producto.')
    if (!unidadId) return setError('Elegí la unidad.')
    if (cantidad <= 0) return setError('La cantidad tiene que ser mayor a 0.')
    const tipo = tiposMovimiento.find((t) => t.nombre === tipoMovimientoNombre)
    if (!tipo) return setError('Tipo de movimiento inválido.')

    setSubmitting(true)
    try {
      const input: Parameters<typeof movimientosStore.crear>[0] = {
        productoId,
        tipoMovimientoId: tipo.id,
        cantidad,
        unidadMedidaId: unidadId,
        observacion: observacion.trim() || undefined,
      }
      if (tipo.signo === 'E') input.bodegaDestinoId = bodegaId
      else if (tipo.signo === 'S') input.bodegaOrigenId = bodegaId
      await movimientosStore.crear(input)
      onCreated()
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'No se pudo registrar el movimiento.'
      setError(msg)
    } finally {
      setSubmitting(false)
    }
  }

  const inputClass =
    'w-full px-3 py-2.5 bg-muted border border-border text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/60 transition-colors'

  // Producto seleccionado (para mostrar la unidad y armar el listado de
  // unidades disponibles en el campo de cantidad).
  const productoSel = productos.find((p) => p.id === productoId) || null

  /**
   * Opciones de unidad para el input de cantidad.
   *
   *  - Si el producto no tiene conversiones registradas, solo se puede
   *    cargar en la unidad base (campo como label, no editable).
   *  - Si tiene conversiones, el campo es un `<select>` con la unidad
   *    base + las unidades de origen que tengan factor de conversión
   *    válido hacia la base.
   */
  const unidadesDisponibles: Array<{ id: string; abreviatura: string; nombre: string }> = []
  if (productoSel) {
    unidadesDisponibles.push({
      id: productoSel.unidadMedida.id,
      abreviatura: productoSel.unidadMedida.abreviatura,
      nombre: productoSel.unidadMedida.nombre,
    })
    for (const c of conversiones) {
      // Solo agregamos unidades que conviertan HACIA la base de este producto.
      if (c.unidadDestino.id === productoSel.unidadMedida.id) {
        // Evitar duplicar la unidad base (puede estar como origen→destino
        // con factor 1 también).
        if (!unidadesDisponibles.some((u) => u.id === c.unidadOrigen.id)) {
          unidadesDisponibles.push({
            id: c.unidadOrigen.id,
            abreviatura: c.unidadOrigen.abreviatura,
            nombre: c.unidadOrigen.nombre,
          })
        }
      }
    }
  }
  const tieneConversiones = unidadesDisponibles.length > 1
  const unidadSeleccionada = unidadesDisponibles.find((u) => u.id === unidadId)
  const unidadDistintaDeBase =
    productoSel && unidadId && unidadId !== productoSel.unidadMedida.id

  return (
    <div
      className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-card border border-border w-full max-w-lg max-h-[92vh] flex flex-col"
        style={{ borderRadius: '0.25rem' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-5 border-b border-border shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-primary/15 flex items-center justify-center">
              <Plus size={18} className="text-primary" />
            </div>
            <div>
              <h2
                className="text-xl uppercase text-foreground leading-none"
                style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900 }}
              >
                Nuevo Movimiento
              </h2>
              <p
                className="mt-1 text-xs text-muted-foreground"
                style={{ fontFamily: "'DM Sans', sans-serif" }}
              >
                Registrá una entrada, salida o ajuste
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
          <div>
            <label
              className="text-xs text-muted-foreground tracking-widest uppercase mb-1.5 block"
              style={{ fontFamily: "'JetBrains Mono', monospace" }}
            >
              Producto *
            </label>
            <select
              value={productoId}
              onChange={(e) => setProductoId(e.target.value)}
              className={inputClass}
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
          </div>

          <div>
            <label
              className="text-xs text-muted-foreground tracking-widest uppercase mb-1.5 block"
              style={{ fontFamily: "'JetBrains Mono', monospace" }}
            >
              Tipo de movimiento *
            </label>
            <div className="grid grid-cols-2 gap-2">
              {['Entrada', 'Salida', 'Ajuste', 'Compra'].map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTipoMovimientoNombre(t)}
                  className={`px-3 py-2 border text-sm transition-colors ${
                    tipoMovimientoNombre === t
                      ? t === 'Entrada' || t === 'Compra'
                        ? 'border-secondary/40 bg-secondary/10 text-secondary'
                        : t === 'Salida'
                          ? 'border-primary/40 bg-primary/10 text-primary'
                          : 'border-foreground/30 bg-foreground/5 text-foreground'
                      : 'border-border text-muted-foreground hover:text-foreground'
                  }`}
                  style={{ borderRadius: '0.25rem', fontFamily: "'DM Sans', sans-serif" }}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label
              className="text-xs text-muted-foreground tracking-widest uppercase mb-1.5 block"
              style={{ fontFamily: "'JetBrains Mono', monospace" }}
            >
              Cantidad *
            </label>
            <div className="flex gap-2">
              <input
                type="number"
                min={0}
                step="0.001"
                value={cantidad}
                onChange={(e) => setCantidad(Number(e.target.value))}
                className={inputClass}
                disabled={!productoSel}
                placeholder={productoSel ? '0' : 'Elegí un producto primero'}
              />
              {productoSel && tieneConversiones ? (
                <select
                  value={unidadId}
                  onChange={(e) => setUnidadId(e.target.value)}
                  className={`${inputClass} w-36`}
                  title="Unidad en la que cargás la cantidad"
                >
                  {unidadesDisponibles.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.abreviatura}
                    </option>
                  ))}
                </select>
              ) : productoSel ? (
                <div
                  className="w-36 px-3 py-2.5 bg-muted border border-border text-sm text-foreground flex items-center justify-between"
                  style={{ borderRadius: '0.25rem' }}
                  title="La unidad base del producto"
                >
                  <span
                    className="text-foreground"
                    style={{ fontFamily: "'JetBrains Mono', monospace" }}
                  >
                    {productoSel.unidadMedida.abreviatura}
                  </span>
                  <span
                    className="text-[10px] text-muted-foreground"
                    style={{ fontFamily: "'JetBrains Mono', monospace" }}
                  >
                    BASE
                  </span>
                </div>
              ) : (
                <div
                  className="w-36 px-3 py-2.5 bg-muted border border-border text-sm text-muted-foreground"
                  style={{ borderRadius: '0.25rem' }}
                >
                  —
                </div>
              )}
            </div>
            {productoSel && !tieneConversiones && (
              <p
                className="text-[10px] text-muted-foreground mt-1"
                style={{ fontFamily: "'JetBrains Mono', monospace" }}
              >
                Unidad base: {productoSel.unidadMedida.nombre} ({productoSel.unidadMedida.abreviatura}). Si querés
                registrar en otra unidad, agregá una conversión en el producto.
              </p>
            )}
            {unidadDistintaDeBase && unidadSeleccionada && conversiones.length > 0 && (
              <ConversionPreview
                producto={productoSel}
                cantidad={cantidad}
                unidadOrigenId={unidadId}
                conversiones={conversiones}
              />
            )}
          </div>

          <div>
            <label
              className="text-xs text-muted-foreground tracking-widest uppercase mb-1.5 block"
              style={{ fontFamily: "'JetBrains Mono', monospace" }}
            >
              Observación (opcional)
            </label>
            <textarea
              value={observacion}
              onChange={(e) => setObservacion(e.target.value)}
              rows={2}
              placeholder="Ej: Compra a proveedor X, rotura, etc."
              className={`${inputClass} resize-none`}
            />
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
                Registrando…
              </>
            ) : (
              <>
                <Plus size={14} />
                Registrar
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

/* ─── Preview de conversión a la unidad base ─────────────────── */

type ConversionPreviewProps = {
  producto: ProductoListItem
  cantidad: number
  unidadOrigenId: string
  conversiones: Array<{
    id: string
    factorConversion: number
    unidadOrigen: { id: string; abreviatura: string; nombre: string }
    unidadDestino: { id: string; abreviatura: string; nombre: string }
  }>
}

function ConversionPreview({
  producto,
  cantidad,
  unidadOrigenId,
  conversiones,
}: ConversionPreviewProps) {
  // Buscar el factor de conversión. Aceptamos origen→base o base→origen
  // (en este último caso el factor es el inverso).
  let factor: number | null = null
  let origen: { abreviatura: string; nombre: string } | null = null
  for (const c of conversiones) {
    if (c.unidadOrigen.id === unidadOrigenId && c.unidadDestino.id === producto.unidadMedida.id) {
      factor = c.factorConversion
      origen = c.unidadOrigen
      break
    }
    if (c.unidadDestino.id === unidadOrigenId && c.unidadOrigen.id === producto.unidadMedida.id) {
      factor = c.factorConversion ? 1 / c.factorConversion : null
      origen = c.unidadDestino
      break
    }
  }
  if (factor == null) return null
  const base = cantidad * factor
  return (
    <p
      className="text-[10px] text-secondary mt-1"
      style={{ fontFamily: "'JetBrains Mono', monospace" }}
    >
      ✓ {cantidad} {origen?.abreviatura} = {base.toLocaleString('es-CO', { maximumFractionDigits: 3 })}{' '}
      {producto.unidadMedida.abreviatura} (factor {factor})
    </p>
  )
}
