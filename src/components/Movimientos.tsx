import { useEffect, useState, useCallback, useRef } from 'react'
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
  Trash2,
  Camera,
  Receipt,
  Truck,
} from 'lucide-react'
import { useMovimientos, movimientosStore, type Movimiento } from '../store/movimientos'
import { Pagination } from './Pagination'
import {
  useProductos,
  productosStore,
  type ProductoListItem,
  uploadsService,
} from '../store/productos'
import { useUnidadesMedida, unidadesMedidaStore, type UnidadMedida } from '../store/unidades-medida'
import { PageHeader } from './PageHeader'
import { useBodegaActiva } from '../store/bodegaActiva'
import { useAuth } from '../store/auth'
import { api } from '../lib/api'
import { Modal } from './Modal'
import { Modal as LegacyModal } from './checklist/Modal'
import { SelectMobile } from './SelectMobile'
import { imageUrl } from '../lib/apiBase'
import { comprasStore, type CompraDetalle } from '../store/compras'
import { Eye, FileText, Image as ImageIcon } from 'lucide-react'

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
  const [detalle, setDetalle] = useState<Movimiento | null>(null)

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
    setFiltroProducto('todos')
    void movimientosStore
      .cargarPaginado({ bodegaId: activaId, page: 1, pageSize })
      .catch(() => undefined)
    // SIEMPRE recargamos los productos cuando cambia la bodega activa.
    // Antes solo se hacía en el primer mount (`status === 'idle'`),
    // lo que dejaba el dropdown con productos de OTRA bodega al
    // cambiar la activa — bug cross-tenant.
    void productosStore
      .cargarPaginado({ bodegaId: activaId, page: 1, pageSize: 100 })
      .catch(() => undefined)
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

  // Una compra genera un movimiento de inventario por cada producto. En el
  // historial se presenta como una sola operación para no duplicar tarjetas.
  const movimientosAgrupados = visibles.reduce<
    Array<{ movimiento: Movimiento; movimientosCompra: Movimiento[] }>
  >((grupos, movimiento) => {
    const compraId = movimiento.compra?.id
    if (!compraId) {
      grupos.push({ movimiento, movimientosCompra: [movimiento] })
      return grupos
    }

    const compraExistente = grupos.find(
      (grupo) => grupo.movimiento.compra?.id === compraId,
    )
    if (compraExistente) {
      compraExistente.movimientosCompra.push(movimiento)
    } else {
      grupos.push({ movimiento, movimientosCompra: [movimiento] })
    }
    return grupos
  }, [])

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
        subtitle="BodegaApliSmart · ENTRADAS, SALIDAS Y AJUSTES"
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
              Nueva Compra
            </button>
          </div>
        }
      />

      <div className="flex items-center gap-2 border-b border-border px-6 py-3 lg:hidden">
        <button
          type="button"
          onClick={handleRefresh}
          disabled={movState.status === 'cargando' || !activaId}
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center border border-border text-foreground transition-colors hover:border-foreground/30 disabled:cursor-not-allowed disabled:opacity-50"
          style={{ borderRadius: '0.25rem' }}
          aria-label="Refrescar movimientos"
        >
          <RefreshCcw
            size={14}
            className={movState.status === 'cargando' ? 'animate-spin' : ''}
          />
        </button>
        <button
          type="button"
          onClick={() => setOpenNuevo(true)}
          disabled={!activaId || !puedeEditar}
          className="inline-flex h-9 min-w-0 flex-1 items-center justify-center gap-2 bg-primary px-3 text-xs font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          style={{ borderRadius: '0.25rem' }}
        >
          <Plus size={14} />
          Nueva Compra
        </button>
      </div>

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
              {movimientosAgrupados.map(({ movimiento, movimientosCompra }) => (
                <MovimientoRow
                  key={movimiento.compra?.id ?? movimiento.id}
                  m={movimiento}
                  movimientosCompra={movimientosCompra}
                  onVerDetalle={setDetalle}
                />
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

      {detalle && (
        <MovimientoDetalleModal m={detalle} onClose={() => setDetalle(null)} />
      )}
      </div>
    </div>
  )
}

function esEntrada(signo: string) {
  return signo === 'E'
}

function MovimientoRow({
  m,
  movimientosCompra,
  onVerDetalle,
}: {
  m: Movimiento
  movimientosCompra: Movimiento[]
  onVerDetalle: (m: Movimiento) => void
}) {
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

  const esCompraMov = m.tipoMovimiento.nombre === 'Compra' || !!m.compra?.id
  const cantidadProductosCompra = movimientosCompra.length
  const nombresProductosCompra = movimientosCompra.map((movimiento) => movimiento.producto.nombre)

  return (
    <li
      className="bg-card border border-border p-3 sm:p-4 cursor-pointer hover:border-foreground/30 transition-colors"
      style={{ borderRadius: '0.25rem' }}
      onClick={() => onVerDetalle(m)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onVerDetalle(m)
        }
      }}
    >
      <div className="flex items-start gap-3">
        <div
          className={`w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center shrink-0 ${colorClass.split(' ')[2]}`}
          style={{ borderRadius: '0.25rem' }}
        >
          <Icon size={15} className={esEnt ? 'text-secondary' : 'text-primary'} />
        </div>

        <div className="flex-1 min-w-0">
          {/* Header: nombre a la izquierda, badge de tipo a la derecha */}
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <div
                className="text-sm sm:text-base text-foreground leading-tight truncate"
                style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800 }}
              >
                {esCompraMov && m.compra?.codigo
                  ? `Compra ${m.compra.codigo}`
                  : m.producto.nombre}
              </div>
              <div
                className="text-[10px] text-muted-foreground flex items-center gap-1 sm:gap-2 mt-0.5 flex-wrap"
                style={{ fontFamily: "'JetBrains Mono', monospace" }}
              >
                <span>
                  {esCompraMov
                    ? `${cantidadProductosCompra} ${cantidadProductosCompra === 1 ? 'producto' : 'productos'}`
                    : m.producto.codigo}
                </span>
                <span>·</span>
                <span>{m.usuario.nombre}</span>
                <span>·</span>
                <Calendar size={10} />
                <span>
                  {fechaStr} {horaStr}
                </span>
              </div>
            </div>
            <span
              className={`shrink-0 text-[9px] uppercase tracking-widest px-1.5 py-0.5 border ${colorClass}`}
              style={{
                borderRadius: '0.125rem',
                fontFamily: "'JetBrains Mono', monospace",
              }}
            >
              {m.tipoMovimiento.nombre}
            </span>
          </div>

          {/* Cantidad + acción: una fila dedicada (en mobile ocupa todo el ancho) */}
          <div className="mt-2.5 flex items-end justify-between gap-2">
            <div className="min-w-0">
              <div
                className={`text-lg sm:text-xl font-semibold leading-none ${esEnt ? 'text-secondary' : 'text-primary'}`}
                style={{ fontFamily: "'Barlow Condensed', sans-serif" }}
              >
                {esCompraMov ? (
                  <>
                    {cantidadProductosCompra}{' '}
                    <span className="text-xs sm:text-sm text-muted-foreground font-normal">
                      {cantidadProductosCompra === 1 ? 'producto comprado' : 'productos comprados'}
                    </span>
                  </>
                ) : (
                  <>
                    {esEnt ? '+' : '−'}
                    {Number(m.cantidad).toLocaleString('es-CO')}{' '}
                    <span className="text-xs sm:text-sm text-muted-foreground font-normal">
                      {m.producto.unidadMedida.abreviatura}
                    </span>
                  </>
                )}
              </div>
              {!esCompraMov && Number(m.cantidad) !== Number(m.cantidadBase) && (
                <div
                  className="text-[10px] text-muted-foreground mt-0.5"
                  style={{ fontFamily: "'JetBrains Mono', monospace" }}
                >
                  = {Number(m.cantidadBase).toLocaleString('es-CO')} base
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                onVerDetalle(m)
              }}
              className="shrink-0 inline-flex items-center gap-1.5 min-h-[36px] px-3 text-xs text-muted-foreground hover:text-primary hover:border-primary/30 border border-border transition-colors"
              style={{ borderRadius: '0.25rem' }}
              title="Ver detalle de la transacción"
              aria-label="Ver detalle"
            >
              <Eye size={13} />
              <span className="hidden sm:inline">Detalle</span>
            </button>
          </div>

          {esCompraMov && (
            <p
              className="mt-2 text-xs text-muted-foreground line-clamp-2"
              style={{ fontFamily: "'DM Sans', sans-serif" }}
            >
              {nombresProductosCompra.join(' · ')}
            </p>
          )}

          {m.observacion && !esCompraMov && (
            <p
              className="mt-2 text-xs text-muted-foreground line-clamp-2"
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
  return (
    <Modal
      open
      onClose={onClose}
      title="Nueva Compra"
      description="Ingresá productos con proveedor, factura y fotos de evidencia"
      icon={<Plus size={18} className="text-primary" />}
      size="lg"
      dismissOnOverlay={false}
    >
        <div className="space-y-4 p-4 sm:p-5">
          <CompraForm
            bodegaId={bodegaId}
            productos={productos}
            onClose={onClose}
            onCreated={onCreated}
          />
        </div>
    </Modal>
  )
}

/**
 * Form para Entrada / Salida / Ajuste (1 producto, 1 cantidad).
 * Es el comportamiento legacy del modal: pide un producto, una
 * cantidad, una unidad (con conversiones si las hay), y una
 * observación opcional.
 */
function MovimientoSimpleForm({
  bodegaId,
  productos,
  tiposMovimiento,
  tipoMovimientoNombre,
  onClose,
  onCreated,
}: {
  bodegaId: string
  productos: ProductoListItem[]
  tiposMovimiento: Array<{ id: string; nombre: string; signo: string }>
  tipoMovimientoNombre: string
  onClose: () => void
  onCreated: () => void
}) {
  const [productoId, setProductoId] = useState<string>('')
  const [cantidad, setCantidad] = useState(0)
  const [unidadId, setUnidadId] = useState<string>('')
  const [observacion, setObservacion] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [conversiones, setConversiones] = useState<
    Array<{ id: string; factorConversion: number; unidadOrigen: { id: string; nombre: string; abreviatura: string }; unidadDestino: { id: string; nombre: string; abreviatura: string } }>
  >([])

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

  async function handleSubmit() {
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

  const productoSel = productos.find((p) => p.id === productoId) || null

  const unidadesDisponibles: Array<{ id: string; abreviatura: string; nombre: string }> = []
  if (productoSel) {
    unidadesDisponibles.push({
      id: productoSel.unidadMedida.id,
      abreviatura: productoSel.unidadMedida.abreviatura,
      nombre: productoSel.unidadMedida.nombre,
    })
    for (const c of conversiones) {
      if (c.unidadDestino.id === productoSel.unidadMedida.id) {
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
    <>
      <form
        id="movimiento-simple-form"
        onSubmit={(e) => {
          e.preventDefault()
          void handleSubmit()
        }}
        className="space-y-4"
      >
        <div>
          <label
            className="text-xs text-muted-foreground tracking-widest uppercase mb-1.5 block"
            style={{ fontFamily: "'JetBrains Mono', monospace" }}
          >
            Producto *
          </label>
          <SelectMobile
            value={productoId}
            onChange={setProductoId}
            options={productos.map((p) => ({
              value: p.id,
              label: `${p.nombre} (${p.codigo}) · ${p.unidadMedida.abreviatura}`,
            }))}
            placeholder="Elegí un producto…"
            label="Seleccionar producto"
            aria-label="Producto"
            className={inputClass}
          />
        </div>

        <div>
          <label
            className="text-xs text-muted-foreground tracking-widest uppercase mb-1.5 block"
            style={{ fontFamily: "'JetBrains Mono', monospace" }}
          >
            Cantidad *
          </label>
          <div className="grid grid-cols-[minmax(0,1fr)_minmax(5.5rem,0.55fr)] gap-2 sm:grid-cols-[minmax(0,1fr)_9rem]">
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
                className={inputClass}
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
                className="flex min-w-0 items-center justify-between border border-border bg-muted px-3 py-2.5 text-sm text-foreground"
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
                className="min-w-0 border border-border bg-muted px-3 py-2.5 text-sm text-muted-foreground"
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

      <div className="sticky bottom-0 z-10 -mx-4 -mb-4 grid grid-cols-2 gap-2 border-t border-border bg-card p-4 sm:-mx-5 sm:-mb-5 sm:gap-3">
        <button
          type="button"
          onClick={onClose}
          className="inline-flex min-w-0 items-center justify-center gap-2 border border-border py-2.5 text-xs text-foreground transition-colors hover:border-foreground/30 sm:text-sm"
          style={{ borderRadius: '0.25rem' }}
        >
          <X size={14} />
          Cancelar
        </button>
        <button
          type="submit"
          form="movimiento-simple-form"
          disabled={submitting}
          className="inline-flex min-w-0 items-center justify-center gap-2 bg-primary py-2.5 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60 sm:text-sm"
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
    </>
  )
}

/**
 * Form de COMPRA (multi-item con proveedor, factura y fotos).
 *
 * Flujo:
 *   1. Elegir proveedor (opcional, se puede crear inline).
 *   2. Número de factura (texto libre).
 *   3. Agregar productos al carrito (uno a la vez):
 *      - Producto + cantidad + unidad (con conversiones).
 *      - Foto de evidencia del producto (1, opcional pero recomendado).
 *   4. Observación general.
 *   5. Subir 1+ fotos de la factura.
 *   6. Registrar.
 *
 * Al confirmar, sube todas las fotos a /uploads y luego manda
 * POST /compras con el body completo.
 */
type CompraItemForm = {
  id: string
  productoId: string
  cantidad: number
  unidadMedidaId: string
  precioUnitario?: number
  fotoFile: File | null
  fotoPreview: string | null
  fotoKey?: string
  fotoUrl?: string
  conversiones: Array<{
    id: string
    factorConversion: number
    unidadOrigen: { id: string; nombre: string; abreviatura: string }
    unidadDestino: { id: string; nombre: string; abreviatura: string }
  }>
}

function CompraForm({
  bodegaId,
  productos,
  onClose,
  onCreated,
}: {
  bodegaId: string
  productos: ProductoListItem[]
  onClose: () => void
  onCreated: () => void
}) {
  // Header de la compra
  const [proveedorId, setProveedorId] = useState('')
  const [proveedores, setProveedores] = useState<
    Array<{ id: string; nombre: string; ruc?: string | null }>
  >([])
  const [numeroFactura, setNumeroFactura] = useState('')
  const [observacion, setObservacion] = useState('')
  const [showNuevoProveedor, setShowNuevoProveedor] = useState(false)
  const [nuevoProveedorNombre, setNuevoProveedorNombre] = useState('')
  const [guardandoProveedor, setGuardandoProveedor] = useState(false)

  // Carrito de items
  const [items, setItems] = useState<CompraItemForm[]>([])
  // Fotos de la factura (N, opcional)
  const [facturaFiles, setFacturaFiles] = useState<File[]>([])
  const [facturaPreview, setFacturaPreview] = useState<string[]>([])

  // Estado de submit
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // Ref al input file de fotos de factura
  const facturaFileInputRef = useRef<HTMLInputElement | null>(null)

  // Cargar proveedores
  useEffect(() => {
    void api
      .get<Array<{ id: string; nombre: string; ruc?: string | null }>>(
        `/proveedores?bodegaId=${encodeURIComponent(bodegaId)}`,
      )
      .then((r) => setProveedores(r || []))
      .catch(() => setProveedores([]))
  }, [bodegaId])

  const productosDisponibles = proveedorId
    ? productos.filter((producto) =>
        producto.proveedorIds?.includes(proveedorId),
      )
    : productos

  function handleProveedorChange(nuevoProveedorId: string) {
    setProveedorId(nuevoProveedorId)
    if (!nuevoProveedorId) return

    const permitidos = new Set(
      productos
        .filter((producto) =>
          producto.proveedorIds?.includes(nuevoProveedorId),
        )
        .map((producto) => producto.id),
    )
    const habiaIncompatibles = items.some(
      (item) => item.productoId && !permitidos.has(item.productoId),
    )
    if (habiaIncompatibles) {
      setItems((prev) => prev.map((item) =>
        item.productoId && !permitidos.has(item.productoId)
          ? {
              ...item,
              productoId: '',
              cantidad: 0,
              unidadMedidaId: '',
              precioUnitario: undefined,
              fotoFile: null,
              fotoPreview: null,
              conversiones: [],
            }
          : item,
      ))
      setError('Se limpiaron los productos que no pertenecen al proveedor seleccionado.')
    }
  }

  async function handleCrearProveedor() {
    if (!nuevoProveedorNombre.trim()) return
    setGuardandoProveedor(true)
    try {
      const r = await api.post<{ id: string; nombre: string }>('/proveedores', {
        nombre: nuevoProveedorNombre.trim(),
        bodegaId,
      })
      setProveedores((prev) => [...prev, r])
      handleProveedorChange(r.id)
      setShowNuevoProveedor(false)
      setNuevoProveedorNombre('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo crear el proveedor.')
    } finally {
      setGuardandoProveedor(false)
    }
  }

  function agregarItem() {
    setItems((prev) => [
      ...prev,
      {
        id: `tmp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        productoId: '',
        cantidad: 0,
        unidadMedidaId: '',
        precioUnitario: undefined,
        fotoFile: null,
        fotoPreview: null,
        fotoKey: undefined,
        fotoUrl: undefined,
        conversiones: [],
      },
    ])
  }

  function actualizarItem(id: string, patch: Partial<CompraItemForm>) {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)))
  }

  function eliminarItem(id: string) {
    setItems((prev) => prev.filter((it) => it.id !== id))
  }

  async function onProductoChange(itemId: string, productoId: string) {
    const prod = productos.find((p) => p.id === productoId)
    if (!prod) {
      actualizarItem(itemId, {
        productoId,
        unidadMedidaId: '',
        conversiones: [],
      })
      return
    }
    let convs: CompraItemForm['conversiones'] = []
    try {
      convs = await productosStore.listarConversiones(productoId)
    } catch {
      convs = []
    }
    actualizarItem(itemId, {
      productoId,
      unidadMedidaId: prod.unidadMedida.id,
      precioUnitario: Number(prod.precio),
      conversiones: convs,
    })
  }

  function onItemFotoChange(itemId: string, file: File | null) {
    if (!file) {
      actualizarItem(itemId, { fotoFile: null, fotoPreview: null })
      return
    }
    const url = URL.createObjectURL(file)
    actualizarItem(itemId, { fotoFile: file, fotoPreview: url })
  }

  function onFacturaFilesChange(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) {
      setFacturaFiles([])
      setFacturaPreview([])
      return
    }
    const files = Array.from(fileList)
    setFacturaFiles(files)
    setFacturaPreview(files.map((f) => URL.createObjectURL(f)))
  }

  function removeFacturaFoto(idx: number) {
    setFacturaFiles((prev) => prev.filter((_, i) => i !== idx))
    setFacturaPreview((prev) => prev.filter((_, i) => i !== idx))
  }

  async function handleSubmit() {
    setError('')
    if (items.length === 0) {
      setError('Agregá al menos un producto a la compra.')
      return
    }
    if (!proveedorId) {
      setError('Elegí el proveedor de la compra.')
      return
    }
    for (const it of items) {
      if (!it.productoId) {
        setError('Todos los items deben tener un producto.')
        return
      }
      if (it.cantidad <= 0) {
        setError('La cantidad debe ser mayor a 0.')
        return
      }
      if (!it.unidadMedidaId) {
        setError('Elegí la unidad de cada producto.')
        return
      }
      if ((it.precioUnitario ?? 0) <= 0) {
        setError('Todos los productos deben tener un precio válido en su ficha.')
        return
      }
      if (!it.fotoFile) {
        setError('Cada producto necesita su foto de evidencia.')
        return
      }
    }
    if (facturaFiles.length === 0) {
      setError('Tomá al menos una foto de la factura.')
      return
    }

    setSubmitting(true)
    try {
      // 1) Subir fotos de items (1 por item) si las hay.
      const itemsConFoto = await Promise.all(
        items.map(async (it) => {
          if (!it.fotoFile) {
            return {
              productoId: it.productoId,
              cantidad: it.cantidad,
              unidadMedidaId: it.unidadMedidaId,
              precioUnitario: it.precioUnitario,
            }
          }
          const res = await uploadsService.subir(it.fotoFile, {
            seccion: 'documents',
            bodegaId,
          })
          return {
            productoId: it.productoId,
            cantidad: it.cantidad,
            unidadMedidaId: it.unidadMedidaId,
            precioUnitario: it.precioUnitario,
            foto: {
              url: res.url,
              key: res.key,
              mimeType: res.mimeType,
              sizeBytes: res.sizeBytes,
            },
          }
        }),
      )

      // 2) Subir fotos de factura si las hay.
      const facturaRef = await Promise.all(
        facturaFiles.map(async (f) => {
          const res = await uploadsService.subir(f, {
            seccion: 'documents',
            bodegaId,
          })
          return {
            url: res.url,
            key: res.key,
            mimeType: res.mimeType,
            sizeBytes: res.sizeBytes,
          }
        }),
      )

      // 3) Mandar la compra
      await api.post('/compras', {
        bodegaId,
        proveedorId,
        numeroFactura: numeroFactura.trim() || undefined,
        observacion: observacion.trim() || undefined,
        items: itemsConFoto,
        facturaFotos: facturaRef.length > 0 ? facturaRef : undefined,
      })
      onCreated()
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'No se pudo registrar la compra.'
      setError(msg)
    } finally {
      setSubmitting(false)
    }
  }

  const totalEstimado = items.reduce(
    (acc, it) => acc + (it.precioUnitario ?? 0) * it.cantidad,
    0,
  )
  const formularioCompleto = Boolean(proveedorId) &&
    items.length > 0 &&
    items.every((item) =>
      Boolean(item.productoId) &&
      item.cantidad > 0 &&
      Boolean(item.unidadMedidaId) &&
      (item.precioUnitario ?? 0) > 0 &&
      Boolean(item.fotoFile),
    ) &&
    facturaFiles.length > 0

  return (
    <>
      <form
        id="movimiento-compra-form"
        onSubmit={(e) => {
          e.preventDefault()
          void handleSubmit()
        }}
        className="space-y-4"
      >
        {/* Header: proveedor + factura */}
        <div
          className="bg-muted/30 border border-border p-4 space-y-3"
          style={{ borderRadius: '0.25rem' }}
        >
          <div className="flex items-center gap-2 mb-1">
            <Truck size={13} className="text-primary" />
            <span
              className="text-[10px] uppercase tracking-widest text-muted-foreground"
              style={{ fontFamily: "'JetBrains Mono', monospace" }}
            >
              Datos del proveedor
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label
                className="text-xs text-muted-foreground tracking-widest uppercase mb-1.5 block"
                style={{ fontFamily: "'JetBrains Mono', monospace" }}
              >
                Proveedor *
              </label>
              <div className="flex gap-2">
                <SelectMobile
                  value={proveedorId}
                  onChange={handleProveedorChange}
                  options={[
                    { value: '', label: 'Elegí un proveedor…' },
                    ...proveedores.map((p) => ({
                      value: p.id,
                      label: `${p.nombre}${p.ruc ? ` · ${p.ruc}` : ''}`,
                    })),
                  ]}
                  label="Seleccionar proveedor"
                  aria-label="Proveedor"
                  className="flex-1 px-3 py-2.5 bg-muted border border-border text-sm text-foreground"
                />
                <button
                  type="button"
                  onClick={() => setShowNuevoProveedor((s) => !s)}
                  className="min-h-[44px] px-3 py-2 border border-border bg-muted text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors"
                  style={{ borderRadius: '0.25rem' }}
                  title="Crear proveedor nuevo"
                >
                  <Plus size={14} />
                </button>
              </div>
              {showNuevoProveedor && (
                <div className="mt-2 flex gap-2">
                  <input
                    type="text"
                    value={nuevoProveedorNombre}
                    onChange={(e) => setNuevoProveedorNombre(e.target.value)}
                    placeholder="Nombre del proveedor…"
                    className="flex-1 px-3 py-2 bg-muted border border-border text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/60 transition-colors"
                    style={{ borderRadius: '0.25rem' }}
                    disabled={guardandoProveedor}
                  />
                  <button
                    type="button"
                    onClick={handleCrearProveedor}
                    disabled={!nuevoProveedorNombre.trim() || guardandoProveedor}
                    className="min-h-[44px] px-3 py-2 bg-secondary text-secondary-foreground text-sm font-semibold hover:bg-secondary/90 transition-colors disabled:opacity-50"
                    style={{ borderRadius: '0.25rem' }}
                  >
                    {guardandoProveedor ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      'Crear'
                    )}
                  </button>
                </div>
              )}
              {proveedorId && productosDisponibles.length === 0 && (
                <div className="mt-2 border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-400">
                  Este proveedor no tiene productos asociados. Relaciona los productos desde su ficha antes de registrar la compra.
                </div>
              )}
            </div>
            <div>
              <label
                className="text-xs text-muted-foreground tracking-widest uppercase mb-1.5 block"
                style={{ fontFamily: "'JetBrains Mono', monospace" }}
              >
                Nº de factura (opcional)
              </label>
              <input
                type="text"
                value={numeroFactura}
                onChange={(e) => setNumeroFactura(e.target.value)}
                placeholder="Ej: F-0001-12345"
                className="w-full px-3 py-2.5 bg-muted border border-border text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/60 transition-colors"
                style={{ borderRadius: '0.25rem' }}
              />
            </div>
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
              placeholder="Notas de la compra: lote, condiciones de pago, etc."
              className="w-full px-3 py-2 bg-muted border border-border text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/60 transition-colors resize-none"
              style={{ borderRadius: '0.25rem' }}
            />
          </div>
        </div>

        {/* Carrito de items */}
        <div className="space-y-2">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <span
                className="text-[10px] uppercase tracking-widest text-muted-foreground"
                style={{ fontFamily: "'JetBrains Mono', monospace" }}
              >
                Productos de la compra
              </span>
              {items.length > 0 && (
                <span
                  className="text-[10px] text-primary"
                  style={{ fontFamily: "'JetBrains Mono', monospace" }}
                >
                  · {items.length} {items.length === 1 ? 'item' : 'items'}
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={agregarItem}
              disabled={!proveedorId || productosDisponibles.length === 0}
              className="inline-flex min-h-[44px] w-full items-center justify-center gap-1.5 border border-border bg-muted px-3 py-2 text-sm text-foreground transition-colors hover:border-primary/40 hover:text-primary disabled:cursor-not-allowed disabled:opacity-45 sm:w-auto"
              style={{ borderRadius: '0.25rem' }}
            >
              <Plus size={14} />
              Agregar producto
            </button>
          </div>

          {items.length === 0 ? (
            <div
              className="text-center py-8 text-sm text-muted-foreground border border-dashed border-border"
              style={{ borderRadius: '0.25rem' }}
            >
              Aún no agregaste productos. Tocá "Agregar producto" para empezar.
            </div>
          ) : (
            <ul className="space-y-2">
              {items.map((it, idx) => {
                const prod = productos.find((p) => p.id === it.productoId)
                const unidades: Array<{ id: string; abreviatura: string }> = []
                if (prod) {
                  unidades.push({
                    id: prod.unidadMedida.id,
                    abreviatura: prod.unidadMedida.abreviatura,
                  })
                  for (const c of it.conversiones ?? []) {
                    if (c.unidadDestino.id === prod.unidadMedida.id) {
                      if (!unidades.some((u) => u.id === c.unidadOrigen.id)) {
                        unidades.push({
                          id: c.unidadOrigen.id,
                          abreviatura: c.unidadOrigen.abreviatura,
                        })
                      }
                    }
                  }
                }
                return (
                  <li
                    key={it.id}
                    className="bg-muted/30 border border-border p-3 space-y-2"
                    style={{ borderRadius: '0.25rem' }}
                  >
                    <div className="flex items-start gap-2">
                      <span
                        className="text-[10px] text-muted-foreground mt-2.5 shrink-0"
                        style={{ fontFamily: "'JetBrains Mono', monospace" }}
                      >
                        #{idx + 1}
                      </span>
                      <div className="flex-1 min-w-0 space-y-2">
                        <div className="grid grid-cols-12 gap-2">
                          <div className="col-span-12 md:col-span-6">
                            <SelectMobile
                              value={it.productoId}
                              onChange={(value) => void onProductoChange(it.id, value)}
                              options={productosDisponibles.map((p) => ({
                                value: p.id,
                                label: `${p.nombre} (${p.codigo}) · ${p.unidadMedida.abreviatura}`,
                              }))}
                              placeholder="Elegí un producto…"
                              label={`Seleccionar producto ${idx + 1}`}
                              aria-label={`Producto ${idx + 1}`}
                              className="w-full px-3 py-2.5 bg-muted border border-border text-sm text-foreground"
                            />
                          </div>
                          <div className="col-span-6 md:col-span-2">
                            <input
                              type="number"
                              min={0}
                              step="0.001"
                              value={it.cantidad || ''}
                              onChange={(e) =>
                                actualizarItem(it.id, {
                                  cantidad: Number(e.target.value),
                                })
                              }
                              placeholder="Cant."
                              className="w-full px-3 py-2.5 bg-muted border border-border text-sm text-foreground"
                              style={{ borderRadius: '0.25rem' }}
                              disabled={!prod}
                            />
                          </div>
                          <div className="col-span-6 md:col-span-2">
                            <select
                              value={it.unidadMedidaId}
                              onChange={(e) =>
                                actualizarItem(it.id, { unidadMedidaId: e.target.value })
                              }
                              className="w-full px-3 py-2.5 bg-muted border border-border text-sm text-foreground"
                              style={{ borderRadius: '0.25rem' }}
                              disabled={!prod}
                            >
                              {unidades.map((u) => (
                                <option key={u.id} value={u.id}>
                                  {u.abreviatura}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div className="col-span-12 md:col-span-2">
                            <input
                              type="number"
                              min={0}
                              step="0.01"
                              value={it.precioUnitario ?? ''}
                              onChange={(e) =>
                                actualizarItem(it.id, {
                                  precioUnitario: e.target.value
                                    ? Number(e.target.value)
                                    : undefined,
                                })
                              }
                              placeholder="Precio"
                              className="w-full px-3 py-2.5 bg-muted/50 border border-border text-sm text-foreground cursor-not-allowed"
                              style={{ borderRadius: '0.25rem' }}
                              disabled
                            />
                          </div>
                        </div>
                        {prod && (
                          <div className="flex justify-end text-[10px] text-muted-foreground" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                            {it.cantidad.toLocaleString('es-CO', { maximumFractionDigits: 3 })} × {(it.precioUnitario ?? 0).toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            <span className="ml-2 font-semibold text-foreground">
                              = {((it.precioUnitario ?? 0) * it.cantidad).toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                          </div>
                        )}
                        {prod && (it.precioUnitario ?? 0) <= 0 && (
                          <div className="text-[10px] text-amber-400">
                            Configura un precio mayor que cero en la ficha del producto.
                          </div>
                        )}
                        <FotoItemRow item={it} onChange={onItemFotoChange} />
                      </div>
                      <button
                        type="button"
                        onClick={() => eliminarItem(it.id)}
                        className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center text-muted-foreground hover:text-primary transition-colors"
                        title="Quitar este producto"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}

          {items.length > 0 && (
            <div
              className="flex items-center justify-between text-xs text-muted-foreground px-1"
              style={{ fontFamily: "'JetBrains Mono', monospace" }}
            >
              <span>Total de la factura:</span>
              <span className="text-foreground font-semibold">
                {totalEstimado.toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
          )}
        </div>

        {/* Fotos de la factura */}
        <div className="space-y-2">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <Receipt size={13} className="text-primary" />
              <span
                className="text-[10px] uppercase tracking-widest text-muted-foreground"
                style={{ fontFamily: "'JetBrains Mono', monospace" }}
              >
                Fotos de la factura (obligatoria)
              </span>
              {facturaFiles.length > 0 && (
                <span
                  className="text-[10px] text-primary"
                  style={{ fontFamily: "'JetBrains Mono', monospace" }}
                >
                  · {facturaFiles.length} {facturaFiles.length === 1 ? 'foto' : 'fotos'}
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={() => facturaFileInputRef.current?.click()}
              className="inline-flex min-h-[44px] w-full items-center justify-center gap-1.5 border border-border bg-muted px-3 py-2 text-sm text-foreground transition-colors hover:border-primary/40 hover:text-primary sm:w-auto"
              style={{ borderRadius: '0.25rem' }}
            >
              <Camera size={14} />
              {facturaFiles.length === 0 ? 'Tomar foto' : 'Tomar otra'}
            </button>
            <input
              ref={facturaFileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              multiple
              className="hidden"
              onChange={(e) => onFacturaFilesChange(e.target.files)}
            />
          </div>
          {facturaPreview.length > 0 && (
            <ul className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {facturaPreview.map((src, idx) => (
                <li
                  key={idx}
                  className="relative aspect-square bg-muted border border-border overflow-hidden"
                  style={{ borderRadius: '0.25rem' }}
                >
                  <img
                    src={src}
                    alt={`Factura ${idx + 1}`}
                    className="w-full h-full object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => removeFacturaFoto(idx)}
                    className="absolute top-1 right-1 w-7 h-7 inline-flex items-center justify-center bg-card/90 border border-border text-primary hover:text-foreground"
                    style={{ borderRadius: '0.25rem' }}
                    title="Quitar"
                  >
                    <X size={12} />
                  </button>
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

      <div className="sticky bottom-0 z-10 -mx-4 -mb-4 grid grid-cols-2 gap-2 border-t border-border bg-card p-4 sm:-mx-5 sm:-mb-5 sm:gap-3">
        <button
          type="button"
          onClick={onClose}
          disabled={submitting}
          className="inline-flex min-w-0 items-center justify-center gap-2 border border-border py-2.5 text-xs text-foreground transition-colors hover:border-foreground/30 sm:text-sm"
          style={{ borderRadius: '0.25rem' }}
        >
          <X size={14} />
          Cancelar
        </button>
        <button
          type="submit"
          form="movimiento-compra-form"
          disabled={submitting || !formularioCompleto}
          className="inline-flex min-w-0 items-center justify-center gap-2 bg-primary px-2 py-2.5 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60 sm:text-sm"
          style={{ borderRadius: '0.25rem' }}
        >
          {submitting ? (
            <>
              <Loader2 size={14} className="animate-spin" />
              Registrando compra…
            </>
          ) : (
            <>
              <Plus size={14} />
              Registrar compra
            </>
          )}
        </button>
      </div>
    </>
  )
}

/** Sub-componente: input de foto por item (1 foto de evidencia). */
function FotoItemRow({
  item,
  onChange,
}: {
  item: CompraItemForm
  onChange: (itemId: string, file: File | null) => void
}) {
  const inputRef = useRef<HTMLInputElement | null>(null)
  return (
    <div className="flex items-center gap-2">
      {item.fotoPreview ? (
        <div
          className="relative w-14 h-14 bg-muted border border-border overflow-hidden shrink-0"
          style={{ borderRadius: '0.25rem' }}
        >
          <img
            src={item.fotoPreview}
            alt="Foto"
            className="w-full h-full object-cover"
          />
          <button
            type="button"
            onClick={() => onChange(item.id, null)}
            className="absolute -top-1 -right-1 w-5 h-5 inline-flex items-center justify-center bg-card border border-border text-primary"
            style={{ borderRadius: '999px' }}
            title="Quitar foto"
          >
            <X size={10} />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="inline-flex items-center gap-1.5 min-h-[44px] px-2.5 py-1.5 border border-dashed border-border text-xs text-muted-foreground hover:border-primary/40 hover:text-foreground transition-colors"
          style={{ borderRadius: '0.25rem' }}
          disabled={!item.productoId}
        >
          <Camera size={12} />
          Tomar foto
        </button>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0] ?? null
          onChange(item.id, f)
          e.target.value = ''
        }}
      />
      <span
        className="text-[10px] text-muted-foreground"
        style={{ fontFamily: "'JetBrains Mono', monospace" }}
      >
        1 foto del producto (obligatoria)
      </span>
    </div>
  )
}

/* ─── Modal de detalle de transacción ────────────────────────── */

/**
 * Modal de detalle de UNA transacción.
 *
 * Comportamiento:
 *  - Si `m.tipoMovimiento.nombre === 'Compra'` (o `m.compra` existe),
 *    consume `GET /compras/:id` y muestra el detalle completo:
 *    header (código, fecha, bodega, proveedor, factura, observacion),
 *    lista de items con foto de evidencia, galería de fotos de la
 *    factura, y los movimientos de stock generados.
 *  - Si es cualquier otro tipo (Entrada/Salida/Ajuste), muestra el
 *    detalle del Movimiento legacy (producto, cantidad, conversión
 *    si la hubo, stock anterior/nuevo, observación, usuario).
 *
 * Toda la información se trae en un único fetch (compra) o se arma
 * a partir del Movimiento (legacy). Las imágenes se resuelven con
 * `imageUrl()` para soportar dev/prod.
 */
function MovimientoDetalleModal({ m, onClose }: { m: Movimiento; onClose: () => void }) {
  const esCompraMov = m.tipoMovimiento.nombre === 'Compra' || !!m.compra?.id
  const compraId = m.compra?.id ?? null

  return (
    <LegacyModal zIndex={100} full>
      <div
        className="bg-card border border-border w-full sm:max-w-3xl flex flex-col sm:my-auto sm:max-h-[90vh] sm:mx-4 sm:my-4"
        style={{ borderRadius: '0.25rem' }}
        onClick={(e) => e.stopPropagation()}
      >
        <DetalleHeader m={m} onClose={onClose} />
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
          {esCompraMov && compraId ? (
            <DetalleCompra compraId={compraId} />
          ) : (
            <DetalleMovimientoLegacy m={m} />
          )}
        </div>
        <div className="p-3 sm:p-4 border-t border-border flex justify-end shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center justify-center gap-2 min-w-[120px] py-2.5 border border-border text-sm text-foreground hover:border-foreground/30 transition-colors"
            style={{ borderRadius: '0.25rem' }}
          >
            <X size={14} />
            Cerrar
          </button>
        </div>
      </div>
    </LegacyModal>
  )
}

function DetalleHeader({ m, onClose }: { m: Movimiento; onClose: () => void }) {
  const fecha = new Date(m.fecha)
  const fechaStr = fecha.toLocaleDateString('es-CO', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  })
  const horaStr = fecha.toLocaleTimeString('es-CO', {
    hour: '2-digit',
    minute: '2-digit',
  })
  const esEnt = m.tipoMovimiento.signo === 'E'
  return (
    <div className="p-4 sm:p-5 border-b border-border shrink-0">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div
            className="w-9 h-9 bg-primary/15 flex items-center justify-center shrink-0"
            style={{ borderRadius: '0.25rem' }}
          >
            <Receipt size={18} className="text-primary" />
          </div>
          <div className="min-w-0 flex-1">
            <h2
              className="text-lg sm:text-xl uppercase text-foreground leading-none break-words"
              style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900 }}
            >
              {m.tipoMovimiento.nombre} · {m.producto.nombre}
            </h2>
            <p
              className="mt-1 text-xs text-muted-foreground break-words"
              style={{ fontFamily: "'DM Sans', sans-serif" }}
            >
              {fechaStr} {horaStr} · {m.usuario.nombre}
              {m.compra?.codigo ? ` · ${m.compra.codigo}` : ''}
            </p>
          </div>
        </div>
        <span
          className={`hidden sm:inline-block shrink-0 text-[9px] uppercase tracking-widest px-2 py-1 border ${
            esEnt
              ? 'text-secondary border-secondary/30 bg-secondary/5'
              : 'text-primary border-primary/30 bg-primary/5'
          }`}
          style={{
            borderRadius: '0.125rem',
            fontFamily: "'JetBrains Mono', monospace",
          }}
        >
          {esEnt ? 'Entrada' : 'Salida'}
        </span>
        <button
          type="button"
          onClick={onClose}
          className="shrink-0 inline-flex items-center justify-center min-w-[36px] min-h-[36px] text-muted-foreground hover:text-foreground hover:border-foreground/30 border border-border transition-colors"
          style={{ borderRadius: '0.25rem' }}
          aria-label="Cerrar"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  )
}

/**
 * Detalle del movimiento legacy (Entrada / Salida / Ajuste).
 * Muestra: producto, cantidad, conversión, stock, observación.
 */
function DetalleMovimientoLegacy({ m }: { m: Movimiento }) {
  const esEnt = m.tipoMovimiento.signo === 'E'
  return (
    <div className="space-y-4">
      <DetalleProductoCard m={m} />
      <DetalleGrid>
        <DetalleItem label="Cantidad">
          <span
            className={esEnt ? 'text-secondary' : 'text-primary'}
            style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800 }}
          >
            {esEnt ? '+' : '−'}
            {Number(m.cantidad).toLocaleString('es-CO')} {m.producto.unidadMedida.abreviatura}
          </span>
        </DetalleItem>
        <DetalleItem label="Convertido a base">
          {Number(m.cantidadBase).toLocaleString('es-CO', { maximumFractionDigits: 3 })}{' '}
          {m.producto.unidadMedida.abreviatura}
        </DetalleItem>
        <DetalleItem label="Stock anterior">
          {Number(m.stockAnterior).toLocaleString('es-CO')}
        </DetalleItem>
        <DetalleItem label="Stock nuevo">
          <span className="text-foreground font-semibold">
            {Number(m.stockNuevo).toLocaleString('es-CO')}
          </span>
        </DetalleItem>
        <DetalleItem label="Bodega origen">
          {m.bodegaOrigen ? m.bodegaOrigen.nombre : <span className="text-muted-foreground">—</span>}
        </DetalleItem>
        <DetalleItem label="Bodega destino">
          {m.bodegaDestino ? m.bodegaDestino.nombre : <span className="text-muted-foreground">—</span>}
        </DetalleItem>
      </DetalleGrid>
      {m.observacion && (
        <DetalleSeccion titulo="Observación">
          <p
            className="text-sm text-foreground"
            style={{ fontFamily: "'DM Sans', sans-serif" }}
          >
            {m.observacion}
          </p>
        </DetalleSeccion>
      )}
    </div>
  )
}

/**
 * Detalle de COMPRA. Trae el detalle completo desde
 * `GET /compras/:id` (incluye items, fotos de evidencia,
 * fotos de factura, proveedor, factura, movimientos de
 * stock generados).
 */
function DetalleCompra({ compraId }: { compraId: string }) {
  const [data, setData] = useState<CompraDetalle | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [fotoFactura, setFotoFactura] = useState<{ url: string; mimeType: string } | null>(null)

  useEffect(() => {
    let alive = true
    setLoading(true)
    setError(null)
    void comprasStore
      .obtener(compraId)
      .then((c) => {
        if (alive) setData(c)
      })
      .catch((err) => {
        if (alive) {
          setError(err instanceof Error ? err.message : 'No se pudo cargar la compra.')
        }
      })
      .finally(() => {
        if (alive) setLoading(false)
      })
    return () => {
      alive = false
    }
  }, [compraId])

  if (loading) {
    return (
      <div className="py-12 flex flex-col items-center justify-center text-center">
        <Loader2 size={22} className="text-primary animate-spin" />
        <p
          className="mt-3 text-sm text-muted-foreground"
          style={{ fontFamily: "'JetBrains Mono', monospace" }}
        >
          Cargando detalle de la compra…
        </p>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div
        className="bg-card border border-primary/30 py-8 px-6 text-center"
        style={{ borderRadius: '0.25rem' }}
      >
        <AlertTriangle size={22} className="text-primary mx-auto" />
        <p
          className="mt-3 text-sm text-foreground"
          style={{ fontFamily: "'DM Sans', sans-serif" }}
        >
          {error ?? 'No se encontró la compra.'}
        </p>
      </div>
    )
  }

  const fechaCreada = new Date(data.createdAt)
  const fechaCreadaStr = fechaCreada.toLocaleDateString('es-CO', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  })
  const horaCreadaStr = fechaCreada.toLocaleTimeString('es-CO', {
    hour: '2-digit',
    minute: '2-digit',
  })

  return (
    <div className="space-y-4">
      {/* Header de la compra */}
      <div
        className="bg-muted/30 border border-border p-4 space-y-3"
        style={{ borderRadius: '0.25rem' }}
      >
        <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <FileText size={13} className="text-primary shrink-0" />
            <span
              className="text-[10px] uppercase tracking-widest text-muted-foreground shrink-0"
              style={{ fontFamily: "'JetBrains Mono', monospace" }}
            >
              Compra
            </span>
            <span
              className="text-sm text-foreground truncate"
              style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800 }}
            >
              {data.codigo}
            </span>
          </div>
          <span
            className="sm:ml-auto text-[10px] text-muted-foreground"
            style={{ fontFamily: "'JetBrains Mono', monospace" }}
          >
            {fechaCreadaStr} {horaCreadaStr}
          </span>
        </div>
        <DetalleGrid>
          <DetalleItem label="Bodega">{data.bodega.nombre}</DetalleItem>
          <DetalleItem label="Proveedor">
            {data.proveedor ? (
              <>
                {data.proveedor.nombre}
                {data.proveedor.ruc ? (
                  <span
                    className="text-muted-foreground ml-1"
                    style={{ fontFamily: "'JetBrains Mono', monospace" }}
                  >
                    · {data.proveedor.ruc}
                  </span>
                ) : null}
              </>
            ) : (
              <span className="text-muted-foreground">Sin proveedor</span>
            )}
          </DetalleItem>
          <DetalleItem label="Nº de factura">
            {data.numeroFactura ?? <span className="text-muted-foreground">—</span>}
          </DetalleItem>
          <DetalleItem label="Total de la factura">
            <span className="text-foreground font-semibold">
              {Number(data.total).toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </DetalleItem>
        </DetalleGrid>
        {data.observacion && (
          <div>
            <p
              className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1"
              style={{ fontFamily: "'JetBrains Mono', monospace" }}
            >
              Observación
            </p>
            <p
              className="text-sm text-foreground"
              style={{ fontFamily: "'DM Sans', sans-serif" }}
            >
              {data.observacion}
            </p>
          </div>
        )}
      </div>

      {/* Productos de la compra */}
      <DetalleSeccion
        titulo={`Productos (${data.items.length})`}
        action={
          <span
            className="text-[10px] text-muted-foreground"
            style={{ fontFamily: "'JetBrains Mono', monospace" }}
          >
            {data.items.length} {data.items.length === 1 ? 'item' : 'items'} · {data.movimientos.length}{' '}
            movimientos de stock
          </span>
        }
      >
        <ul className="space-y-2">
          {data.items.map((it) => {
            const fotoUrl = imageUrl(it.foto?.url)
            return (
              <li
                key={it.id}
                className="bg-muted/30 border border-border p-3 flex items-start gap-3"
                style={{ borderRadius: '0.25rem' }}
              >
                <div
                  className="w-16 h-16 bg-muted border border-border overflow-hidden shrink-0 flex items-center justify-center"
                  style={{ borderRadius: '0.25rem' }}
                >
                  {fotoUrl ? (
                    <img
                      src={fotoUrl}
                      alt={it.producto.nombre}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <ImageIcon size={18} className="text-muted-foreground" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div
                    className="text-sm text-foreground"
                    style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800 }}
                  >
                    {it.producto.nombre}
                  </div>
                  <div
                    className="text-[10px] text-muted-foreground"
                    style={{ fontFamily: "'JetBrains Mono', monospace" }}
                  >
                    {it.producto.codigo}
                  </div>
                  <div className="mt-1 flex items-center gap-3 flex-wrap">
                    <span
                      className="text-sm text-secondary font-semibold"
                      style={{ fontFamily: "'Barlow Condensed', sans-serif" }}
                    >
                      +{Number(it.cantidad).toLocaleString('es-CO')}{' '}
                      {it.producto.unidadMedida.abreviatura}
                    </span>
                    {Number(it.cantidad) !== Number(it.cantidadBase) && (
                      <span
                        className="text-[10px] text-muted-foreground"
                        style={{ fontFamily: "'JetBrains Mono', monospace" }}
                      >
                        = {Number(it.cantidadBase).toLocaleString('es-CO', {
                          maximumFractionDigits: 3,
                        })}{' '}
                        {it.producto.unidadMedida.abreviatura} base
                      </span>
                    )}
                    {it.precioUnitario != null && Number(it.precioUnitario) > 0 && (
                      <span
                        className="text-[10px] text-muted-foreground"
                        style={{ fontFamily: "'JetBrains Mono', monospace" }}
                      >
                        · {Number(it.precioUnitario).toLocaleString('es-CO', {
                          maximumFractionDigits: 2,
                        })}{' '}
                        c/u
                      </span>
                    )}
                    {it.precioUnitario != null && (
                      <span className="text-[10px] font-semibold text-foreground" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                        Subtotal: {(Number(it.precioUnitario) * Number(it.cantidad)).toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    )}
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      </DetalleSeccion>

      {/* Fotos de la factura */}
      {data.facturaFotos.length > 0 && (
        <DetalleSeccion
          titulo={`Fotos de la factura (${data.facturaFotos.length})`}
          action={
            <span
              className="text-[10px] text-muted-foreground"
              style={{ fontFamily: "'JetBrains Mono', monospace" }}
            >
              Tocá una para ver en grande
            </span>
          }
        >
          <ul className="grid grid-cols-3 sm:grid-cols-4 gap-2">
            {data.facturaFotos.map((f) => {
              const src = imageUrl(f.url)
              return (
                <li key={f.id}>
                  <button
                    type="button"
                    onClick={() => src && setFotoFactura({ url: src, mimeType: f.mimeType })}
                    className="block w-full aspect-square bg-muted border border-border overflow-hidden hover:border-primary/40 transition-colors"
                    style={{ borderRadius: '0.25rem' }}
                    title="Ver en grande"
                  >
                    {src ? (
                      <img
                        src={src}
                        alt={`Factura ${f.orden + 1}`}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <ImageIcon size={18} className="text-muted-foreground m-auto" />
                    )}
                  </button>
                </li>
              )
            })}
          </ul>
        </DetalleSeccion>
      )}

      {/* Movimientos de stock generados */}
      <DetalleSeccion titulo={`Movimientos de stock (${data.movimientos.length})`}>
        <ul className="space-y-1">
          {data.movimientos.map((mv) => {
            const it = data.items.find((x) => x.productoId === mv.productoId)
            return (
              <li
                key={mv.id}
                className="flex items-center justify-between text-xs px-3 py-2 bg-muted/30 border border-border"
                style={{ borderRadius: '0.25rem', fontFamily: "'JetBrains Mono', monospace" }}
              >
                <span className="text-foreground truncate">
                  {it?.producto?.nombre ?? mv.productoId}
                </span>
                <span className="text-muted-foreground shrink-0 ml-2">
                  <span className="text-secondary">+{Number(mv.cantidadBase).toLocaleString('es-CO')}</span>
                  {' · '}
                  stock {Number(mv.stockAnterior).toLocaleString('es-CO')} →{' '}
                  <span className="text-foreground font-semibold">
                    {Number(mv.stockNuevo).toLocaleString('es-CO')}
                  </span>
                </span>
              </li>
            )
          })}
        </ul>
      </DetalleSeccion>

      {/* Lightbox de la foto de factura */}
      {fotoFactura && (
        <div
          className="fixed inset-0 z-[120] bg-black/80 flex items-center justify-center p-4"
          onClick={() => setFotoFactura(null)}
        >
          <button
            type="button"
            onClick={() => setFotoFactura(null)}
            className="absolute top-4 right-4 w-10 h-10 inline-flex items-center justify-center bg-card/90 border border-border text-foreground"
            style={{ borderRadius: '0.25rem' }}
            aria-label="Cerrar"
          >
            <X size={18} />
          </button>
          <img
            src={fotoFactura.url}
            alt="Factura"
            className="max-w-full max-h-full object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  )
}

/* Sub-componentes chicos de layout para el detalle */
function DetalleGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 gap-3">{children}</div>
}

function DetalleItem({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <p
        className="text-[10px] uppercase tracking-widest text-muted-foreground mb-0.5"
        style={{ fontFamily: "'JetBrains Mono', monospace" }}
      >
        {label}
      </p>
      <div
        className="text-sm text-foreground break-words"
        style={{ fontFamily: "'DM Sans', sans-serif" }}
      >
        {children}
      </div>
    </div>
  )
}

function DetalleSeccion({
  titulo,
  action,
  children,
}: {
  titulo: string
  action?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <h3
          className="text-xs uppercase tracking-widest text-muted-foreground"
          style={{ fontFamily: "'JetBrains Mono', monospace" }}
        >
          {titulo}
        </h3>
        {action}
      </div>
      {children}
    </div>
  )
}

function DetalleProductoCard({ m }: { m: Movimiento }) {
  return (
    <div
      className="bg-muted/30 border border-border p-4 flex items-center gap-3"
      style={{ borderRadius: '0.25rem' }}
    >
      <div
        className="w-10 h-10 bg-primary/15 flex items-center justify-center"
        style={{ borderRadius: '0.25rem' }}
      >
        <Receipt size={18} className="text-primary" />
      </div>
      <div className="min-w-0">
        <div
          className="text-sm text-foreground"
          style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800 }}
        >
          {m.producto.nombre}
        </div>
        <div
          className="text-[10px] text-muted-foreground"
          style={{ fontFamily: "'JetBrains Mono', monospace" }}
        >
          {m.producto.codigo} · {m.producto.unidadMedida.abreviatura}
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
