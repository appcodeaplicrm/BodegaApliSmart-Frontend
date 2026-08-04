import { useEffect, useMemo, useState, useCallback } from 'react'
import {
  Boxes,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  DollarSign,
  TrendingUp,
  Plus,
  Search,
  SlidersHorizontal,
  Package,
  ChevronDown,
  Loader2,
  FileText,
  RefreshCcw,
} from 'lucide-react'
import { NuevoProductoModal } from './NuevoProductoModal'
import { ProductoDetalleModal } from './ProductoDetalleModal'
import { ModalCrearKit } from './ModalCrearKit'
import { Pagination } from './Pagination'
import { useProductos, productosStore, type ProductoListItem } from '../store/productos'
import { useKits, kitsStore, type Kit } from '../store/kits'
import { useBodegaActiva } from '../store/bodegaActiva'
import { useAuth } from '../store/auth'

const tabs = ['Todos', 'Materiales', 'Herramientas', 'Stock Bajo', 'Sin Stock', 'Defectuosos'] as const
type Tab = (typeof tabs)[number]

const formatPesos = (n: number) =>
  new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(n)

const DEFAULT_PAGE_SIZE = 10

export function Inventario() {
  const auth = useAuth()
  const activaId = useBodegaActiva()
  const prodState = useProductos()
  const kitsState = useKits()

  const [activeTab, setActiveTab] = useState<Tab>('Todos')
  const [search, setSearch] = useState('')
  const [openNuevo, setOpenNuevo] = useState(false)
  const [openKit, setOpenKit] = useState(false)
  const [productoDetalle, setProductoDetalle] = useState<ProductoListItem | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE)

  const puedeCrearKits =
    auth.status === 'autenticado' && auth.sesion.permisos.includes('kits.crear')
  const puedeCrearProductos =
    auth.status === 'autenticado' && auth.sesion.permisos.includes('inventario.crear')

  /**
   * Carga la página actual con el filtro de búsqueda aplicado.
   * Usa un debounce de 300ms cuando cambia `search` para no martillar
   * el back con cada tecla.
   */
  const cargar = useCallback(
    (override?: { page?: number; buscar?: string }) => {
      if (!activaId) return
      const nextPage = override?.page ?? page
      const nextBuscar = override?.buscar !== undefined ? override.buscar : search
      void productosStore
        .cargarPaginado({
          bodegaId: activaId,
          buscar: nextBuscar || undefined,
          page: nextPage,
          pageSize,
        })
        .catch(() => undefined)
    },
    [activaId, page, pageSize, search],
  )

  // Carga inicial cuando cambia la bodega activa
  useEffect(() => {
    if (!activaId) return
    setPage(1)
    void productosStore
      .cargarPaginado({ bodegaId: activaId, page: 1, pageSize })
      .catch(() => undefined)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activaId, pageSize])

  // Debounce del search → reset a page 1
  useEffect(() => {
    if (!activaId) return
    const t = setTimeout(() => {
      setPage(1)
      void productosStore
        .cargarPaginado({
          bodegaId: activaId,
          buscar: search || undefined,
          page: 1,
          pageSize,
        })
        .catch(() => undefined)
    }, 300)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search])

  // Cuando cambia la página, refetch
  useEffect(() => {
    if (!activaId) return
    if (prodState.status === 'idle') return
    void productosStore
      .cargarPaginado({
        bodegaId: activaId,
        buscar: search || undefined,
        page,
        pageSize,
      })
      .catch(() => undefined)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page])

  useEffect(() => {
    if (!activaId) return
    if (kitsState.status === 'idle') {
      void kitsStore.cargar(activaId).catch(() => undefined)
    }
  }, [activaId, kitsState.status])

  const productos = prodState.status === 'listo' ? prodState.productos : []
  const total = prodState.status === 'listo' ? prodState.total : 0
  const totalPages = prodState.status === 'listo' ? prodState.totalPages : 0

  const filtrados = useMemo(() => {
    return productos.filter((p) => {
      if (activeTab === 'Stock Bajo' && !Number(p.stocks.reduce((s, st) => s + Number(st.cantidad), 0))) return false
      if (activeTab === 'Sin Stock' && Number(p.stocks.reduce((s, st) => s + Number(st.cantidad), 0)) > 0) return false
      if (search) {
        const q = search.toLowerCase()
        const blob = `${p.nombre} ${p.codigo} ${p.categoria.nombre} ${p.marca?.nombre ?? ''} ${p.unidadMedida.nombre}`.toLowerCase()
        if (!blob.includes(q)) return false
      }
      return true
    })
  }, [productos, activeTab, search])

  const kpis = useMemo(() => {
    const total = productos.length
    const disp = productos.filter((p) => p.activo).length
    const sinStock = productos.filter((p) => Number(p.stocks.reduce((s, st) => s + Number(st.cantidad), 0)) === 0).length
    const stockTotal = productos.reduce(
      (acc, p) => acc + Number(p.stocks.reduce((s, st) => s + Number(st.cantidad), 0)),
      0,
    )
    const valor = productos.reduce((acc, p) => {
      const precio = Number(p.precio)
      const cant = Number(p.stocks.reduce((s, st) => s + Number(st.cantidad), 0))
      return acc + precio * cant
    }, 0)
    return { total, disp, sinStock, stockTotal, valor }
  }, [productos])

  async function handleCreado(nombre: string) {
    setOpenNuevo(false)
    setToast(`Producto "${nombre}" creado correctamente`)
    cargar()
    setTimeout(() => setToast(null), 3500)
  }

  function handleKitCreado(k: Kit) {
    setOpenKit(false)
    setToast(`Kit "${k.nombre}" creado correctamente`)
    setTimeout(() => setToast(null), 3500)
  }

  function handleRefresh() {
    if (activaId) {
      cargar()
      void kitsStore.cargar(activaId)
    }
  }

  return (
    <div className="flex-1 flex flex-col min-w-0 min-h-0 overflow-y-auto">
      <div className="p-8 space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 bg-muted flex items-center justify-center shrink-0 mt-1">
              <Boxes size={20} className="text-primary" />
            </div>
            <div>
              <h1
                className="text-4xl uppercase text-foreground leading-none"
                style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900 }}
              >
                Inventario
              </h1>
              <p
                className="mt-1 text-sm text-muted-foreground"
                style={{ fontFamily: "'DM Sans', sans-serif" }}
              >
                Materiales, herramientas, stock y valor de tu bodega
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleRefresh}
              disabled={prodState.status === 'cargando' || !activaId}
              className="inline-flex items-center gap-1.5 px-3 py-2.5 border border-border text-sm text-foreground hover:border-foreground/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ borderRadius: '0.25rem' }}
              aria-label="Refrescar"
            >
              <RefreshCcw
                size={14}
                className={prodState.status === 'cargando' ? 'animate-spin' : ''}
              />
            </button>
            {puedeCrearKits && (
              <button
                type="button"
                onClick={() => setOpenKit(true)}
                disabled={!activaId}
                title="Crear un kit (agrupador de productos) para usar en solicitudes"
                className="inline-flex items-center gap-2 px-4 py-2.5 border border-border bg-muted text-foreground text-sm font-medium hover:border-primary/40 hover:text-primary transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ borderRadius: '0.25rem' }}
              >
                <Plus size={16} />
                Crear Kit
              </button>
            )}
            {puedeCrearProductos && (
              <button
                type="button"
                onClick={() => setOpenNuevo(true)}
                disabled={!activaId}
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ borderRadius: '0.25rem' }}
              >
                <Plus size={16} />
                Nuevo Producto
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          <KpiCard
            icon={Boxes}
            label="Total Productos"
            value={kpis.total.toLocaleString('es-CO')}
            color="text-primary"
          />
          <KpiCard
            icon={CheckCircle2}
            label="Activos"
            value={kpis.disp.toLocaleString('es-CO')}
            color="text-secondary"
          />
          <KpiCard
            icon={XCircle}
            label="Sin Stock"
            value={kpis.sinStock.toLocaleString('es-CO')}
            color="text-primary"
          />
          <KpiCard
            icon={DollarSign}
            label="Valor Total"
            value={formatPesos(kpis.valor)}
            color="text-secondary"
          />
          <KpiCard
            icon={TrendingUp}
            label="Unidades (base)"
            value={kpis.stockTotal.toLocaleString('es-CO')}
            color="text-foreground"
          />
        </div>

        {/* ─── Kits de la bodega ─── */}
        <KitsSeccion
          kitsState={kitsState}
          onCrear={() => setOpenKit(true)}
          onRefresh={() => activaId && void kitsStore.cargar(activaId)}
          puedeCrear={puedeCrearKits}
        />

        <div className="border-b border-border">
          <div className="flex items-center gap-6 overflow-x-auto">
            {tabs.map((tab) => {
              const isActive = activeTab === tab
              return (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveTab(tab)}
                  className={`relative py-3 text-sm transition-colors whitespace-nowrap ${
                    isActive
                      ? 'text-primary'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                  style={{ fontFamily: "'DM Sans', sans-serif" }}
                >
                  {tab}
                  {isActive && (
                    <span className="absolute -bottom-px left-0 right-0 h-0.5 bg-primary" />
                  )}
                </button>
              )
            })}
          </div>
        </div>

        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search
              size={15}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
            />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nombre, código, categoría o unidad..."
              className="w-full pl-9 pr-4 py-2.5 bg-card border border-border text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/60 transition-colors"
              style={{ borderRadius: '0.25rem', fontFamily: "'DM Sans', sans-serif" }}
            />
          </div>

          <button
            type="button"
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-card border border-border text-sm text-foreground hover:border-foreground/30 transition-colors"
            style={{ borderRadius: '0.25rem' }}
          >
            <SlidersHorizontal size={14} className="text-muted-foreground" />
            Todos los estados
            <ChevronDown size={14} className="text-muted-foreground" />
          </button>
        </div>

        {prodState.status === 'cargando' && productos.length === 0 ? (
          <div
            className="bg-card border border-border py-20 px-6 flex flex-col items-center justify-center text-center"
            style={{ borderRadius: '0.25rem' }}
          >
            <Loader2 size={24} className="text-primary animate-spin" />
            <p
              className="mt-3 text-sm text-muted-foreground"
              style={{ fontFamily: "'JetBrains Mono', monospace" }}
            >
              Cargando inventario…
            </p>
          </div>
        ) : prodState.status === 'error' ? (
          <div
            className="bg-card border border-primary/30 py-12 px-6 flex flex-col items-center text-center"
            style={{ borderRadius: '0.25rem' }}
          >
            <AlertTriangle size={24} className="text-primary" />
            <p className="mt-3 text-sm text-foreground">{prodState.mensaje}</p>
            <button
              type="button"
              onClick={handleRefresh}
              className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors"
              style={{ borderRadius: '0.25rem' }}
            >
              <RefreshCcw size={13} />
              Reintentar
            </button>
          </div>
        ) : filtrados.length === 0 ? (
          <div
            className="bg-card border border-border py-20 px-6 flex flex-col items-center justify-center text-center"
            style={{ borderRadius: '0.25rem' }}
          >
            <div className="w-14 h-14 bg-muted flex items-center justify-center mb-5">
              <Package size={24} className="text-muted-foreground" />
            </div>
            <h3
              className="text-xl uppercase text-foreground"
              style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800 }}
            >
              {productos.length === 0
                ? 'No hay productos en esta bodega'
                : 'No hay productos en esta vista'}
            </h3>
            <p
              className="mt-2 text-sm text-muted-foreground max-w-sm"
              style={{ fontFamily: "'DM Sans', sans-serif" }}
            >
              {productos.length === 0
                ? 'Empezá creando tu primer producto para esta bodega.'
                : 'Probá cambiando los filtros o la búsqueda.'}
            </p>
            {productos.length === 0 && (
              <button
                type="button"
                onClick={() => setOpenNuevo(true)}
                className="mt-5 inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors"
                style={{ borderRadius: '0.25rem' }}
              >
                <Plus size={14} />
                Crear primer producto
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {filtrados.map((p) => (
                <ProductoCard
                  key={p.id}
                  producto={p}
                  onClick={() => setProductoDetalle(p)}
                />
              ))}
            </div>
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
              disabled={prodState.status === 'cargando'}
            />
          </>
        )}
      </div>

      {openNuevo && activaId && (
        <NuevoProductoModal
          bodegaId={activaId}
          onClose={() => setOpenNuevo(false)}
          onCreated={(nombre) => handleCreado(nombre)}
        />
      )}

      {openKit && activaId && (
        <ModalCrearKit
          bodegaId={activaId}
          onClose={() => setOpenKit(false)}
          onCreated={handleKitCreado}
        />
      )}

      {productoDetalle && (
        <ProductoDetalleModal
          producto={
            (productoDetalle as unknown as import('../store/productos').Producto)
          }
          onClose={() => setProductoDetalle(null)}
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
  )
}

function KpiCard({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: typeof Boxes
  label: string
  value: string
  color: string
}) {
  return (
    <div
      className="bg-card border border-border p-4 flex items-center gap-3"
      style={{ borderRadius: '0.25rem' }}
    >
      <div className="w-9 h-9 bg-muted flex items-center justify-center shrink-0">
        <Icon size={16} className={color} />
      </div>
      <div className="min-w-0">
        <div
          className="text-[10px] text-muted-foreground uppercase tracking-widest leading-tight"
          style={{ fontFamily: "'JetBrains Mono', monospace" }}
        >
          {label}
        </div>
        <div
          className="text-2xl text-foreground leading-tight mt-0.5"
          style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800 }}
        >
          {value}
        </div>
      </div>
    </div>
  )
}

function ProductoCard({
  producto,
  onClick,
}: {
  producto: ProductoListItem
  onClick: () => void
}) {
  const cantidad = producto.stocks.reduce(
    (acc, s) => acc + Number(s.cantidad),
    0,
  )
  const minimo = Number(producto.stockMinimo)
  const sinStock = cantidad === 0
  const bajo = cantidad > 0 && cantidad <= minimo
  const badge = sinStock
    ? { label: 'Sin stock', cls: 'text-primary border-primary/30 bg-primary/5' }
    : bajo
      ? { label: 'Stock bajo', cls: 'text-amber-400 border-amber-500/30 bg-amber-500/5' }
      : { label: 'OK', cls: 'text-secondary border-secondary/30 bg-secondary/5' }

  return (
    <button
      type="button"
      onClick={onClick}
      className="bg-card border border-border p-4 text-left hover:border-primary/40 transition-colors"
      style={{ borderRadius: '0.25rem' }}
    >
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="min-w-0 flex-1">
          <div
            className="text-base text-foreground truncate"
            style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800 }}
          >
            {producto.nombre}
          </div>
          <div
            className="text-[10px] text-muted-foreground"
            style={{ fontFamily: "'JetBrains Mono', monospace" }}
          >
            {producto.codigo}
          </div>
        </div>
        <span
          className={`text-[9px] uppercase tracking-widest px-2 py-0.5 border shrink-0 ${badge.cls}`}
          style={{ borderRadius: '0.125rem', fontFamily: "'JetBrains Mono', monospace" }}
        >
          {badge.label}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs mb-3">
        <div>
          <div
            className="text-[9px] text-muted-foreground uppercase tracking-widest"
            style={{ fontFamily: "'JetBrains Mono', monospace" }}
          >
            Categoría
          </div>
          <div className="text-foreground truncate">{producto.categoria.nombre}</div>
        </div>
        <div>
          <div
            className="text-[9px] text-muted-foreground uppercase tracking-widest"
            style={{ fontFamily: "'JetBrains Mono', monospace" }}
          >
            Unidad
          </div>
          <div className="text-foreground">
            {producto.unidadMedida.nombre}{' '}
            <span className="text-muted-foreground text-[10px]">
              ({producto.unidadMedida.abreviatura})
            </span>
          </div>
        </div>
        <div>
          <div
            className="text-[9px] text-muted-foreground uppercase tracking-widest"
            style={{ fontFamily: "'JetBrains Mono', monospace" }}
          >
            Stock
          </div>
          <div className="text-foreground">
            {cantidad.toLocaleString('es-CO')}{' '}
            <span className="text-muted-foreground">/ mín {minimo}</span>
          </div>
        </div>
        <div>
          <div
            className="text-[9px] text-muted-foreground uppercase tracking-widest"
            style={{ fontFamily: "'JetBrains Mono', monospace" }}
          >
            Precio
          </div>
          <div className="text-foreground">{formatPesos(Number(producto.precio))}</div>
        </div>
      </div>

      <div
        className="flex items-center justify-between text-[10px] text-muted-foreground pt-2 border-t border-border"
        style={{ fontFamily: "'JetBrains Mono', monospace" }}
      >
        <span>{producto.marca?.nombre ?? 'Sin marca'}</span>
        <span className="inline-flex items-center gap-1">
          {producto._count?.documentos > 0 ? (
            <>
              <FileText size={10} />
              {producto._count.documentos}
            </>
          ) : (
            <span>—</span>
          )}
        </span>
      </div>
    </button>
  )
}

/* ─── Sección de Kits ────────────────────────────────────── */

type KitsSeccionProps = {
  kitsState: ReturnType<typeof useKits>
  onCrear: () => void
  onRefresh: () => void
  puedeCrear: boolean
}

function KitsSeccion({ kitsState, onCrear, onRefresh, puedeCrear }: KitsSeccionProps) {
  // (onRefresh queda por si después agregamos botones individuales)
  void onRefresh
  if (kitsState.status === 'idle' || kitsState.status === 'cargando') return null
  if (kitsState.status === 'error') return null
  const kits = kitsState.kits
  if (kits.length === 0) return null

  return (
    <div className="bg-card border border-border p-4" style={{ borderRadius: '0.25rem' }}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 bg-primary/10 flex items-center justify-center">
            <Package size={13} className="text-primary" />
          </div>
          <h3
            className="text-sm uppercase text-foreground tracking-wider"
            style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800 }}
          >
            Kits de la bodega ({kits.length})
          </h3>
        </div>
        {puedeCrear && (
          <button
            type="button"
            onClick={onCrear}
            className="inline-flex items-center gap-1 px-3 py-1.5 border border-border text-xs text-foreground hover:border-primary/40 hover:text-primary transition-colors"
            style={{ borderRadius: '0.25rem', fontFamily: "'JetBrains Mono', monospace" }}
          >
            <Plus size={12} /> Crear Kit
          </button>
        )}
      </div>

      <ul className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
        {kits.map((k) => (
          <li
            key={k.id}
            className="bg-muted/30 border border-border p-3"
            style={{ borderRadius: '0.25rem' }}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div
                  className="text-sm text-foreground"
                  style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800 }}
                >
                  {k.nombre}
                </div>
                <div
                  className="text-[10px] text-muted-foreground"
                  style={{ fontFamily: "'JetBrains Mono', monospace" }}
                >
                  {k.codigo} · {k.items.length}{' '}
                  {k.items.length === 1 ? 'producto' : 'productos'}
                </div>
                {k.descripcion && (
                  <p
                    className="mt-1 text-[11px] text-muted-foreground line-clamp-2"
                    style={{ fontFamily: "'DM Sans', sans-serif" }}
                  >
                    {k.descripcion}
                  </p>
                )}
              </div>
            </div>
            {k.items.length > 0 && (
              <ul
                className="mt-2 pt-2 border-t border-border space-y-0.5"
                style={{ fontFamily: "'JetBrains Mono', monospace" }}
              >
                {k.items.slice(0, 3).map((it) => (
                  <li
                    key={it.id}
                    className="text-[10px] text-muted-foreground flex items-center justify-between"
                  >
                    <span className="truncate">· {it.producto.nombre}</span>
                    <span className="text-foreground">×{it.cantidad}</span>
                  </li>
                ))}
                {k.items.length > 3 && (
                  <li className="text-[10px] text-muted-foreground">+ {k.items.length - 3} más…</li>
                )}
              </ul>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}
