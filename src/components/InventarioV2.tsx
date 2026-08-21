/**
 * InventarioV2 — Rediseño según Guidelines-Inventario.md
 *
 * Layout: dos secciones en `p-6 space-y-8`:
 *   1. TABLA KITS     → filas colapsables con acordeón
 *   2. TABLA PRODUCTOS → tabla estándar con mini barra de stock
 *
 * Mantiene la integración con productosStore / kitsStore / bodegasStore
 * del Inventario original. El realtime sigue funcionando (los stores
 * emiten los mismos eventos).
 */
import { useEffect, useMemo, useState, useCallback, useRef } from 'react'
import {
  Boxes,
  Plus,
  Search,
  ChevronDown,
  ChevronRight,
  Edit3,
  MoreHorizontal,
  Tag as TagIcon,
  Layers,
  X,
} from 'lucide-react'
import { NuevoProductoModal } from './NuevoProductoModal'
import { ProductoDetalleModal } from './ProductoDetalleModal'
import { ModalCrearKit } from './ModalCrearKit'
import { Pagination } from './Pagination'
import { PageHeader } from './PageHeader'
import { SelectMobile } from './SelectMobile'
import { imageUrl } from '../lib/apiBase'
import { useProductos, productosStore, type Producto, type ProductoListItem } from '../store/productos'
import { useKits, kitsStore, type Kit } from '../store/kits'
import { useBodegaActiva } from '../store/bodegaActiva'
import { useAuth } from '../store/auth'
import { ValorBlur } from '../lib/valorBlur'

const DEFAULT_PAGE_SIZE = 10

type EstadoProducto = 'ok' | 'bajo' | 'agotado'

function estadoDeProducto(stock: number, minimo: number): EstadoProducto {
  if (stock === 0) return 'agotado'
  if (stock < minimo) return 'bajo'
  return 'ok'
}

function colorDeEstado(estado: EstadoProducto): {
  text: string
  dot: string
  bar: string
} {
  if (estado === 'ok') return { text: 'text-secondary', dot: 'bg-secondary', bar: '#ABF768' }
  if (estado === 'bajo') return { text: 'text-yellow-400', dot: 'bg-yellow-400', bar: '#facc15' }
  return { text: 'text-primary', dot: 'bg-primary', bar: '#E8593F' }
}

const formatPesos = (n: number) =>
  new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n)

export function InventarioV2() {
  const auth = useAuth()
  const activaId = useBodegaActiva()
  const prodState = useProductos()
  const kitsState = useKits()

  // Estado de la UI
  const [search, setSearch] = useState('')
  const [catFilter, setCatFilter] = useState('Todas')
  const [estadoFilter, setEstadoFilter] = useState<'Todos' | EstadoProducto>('Todos')
  const [openKits, setOpenKits] = useState<Record<string, boolean>>({})
  const [openNuevo, setOpenNuevo] = useState(false)
  const [openKit, setOpenKit] = useState(false)
  const [productoDetalle, setProductoDetalle] = useState<Producto | null>(null)

  const abrirProducto = async (producto: ProductoListItem) => {
    const detalle = await productosStore.findOne(producto.id)
    setProductoDetalle(detalle)
  }
  const [prodMenu, setProdMenu] = useState<string | null>(null)

  const [page, setPage] = useState(1)
  const [pageSize] = useState(DEFAULT_PAGE_SIZE)

  const puedeCrearKits =
    auth.status === 'autenticado' && auth.sesion.permisos.includes('kits.crear')
  const puedeCrearProductos =
    auth.status === 'autenticado' && auth.sesion.permisos.includes('inventario.crear')
  const puedeEditarProductos =
    auth.status === 'autenticado' && auth.sesion.permisos.includes('inventario.editar')
  const puedeEliminarProductos =
    auth.status === 'autenticado' && auth.sesion.permisos.includes('inventario.eliminar')

  // ── Carga de productos con debounce ───────────────────────────
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

  // Cargar kits cuando cambia la bodega (o al montar si no hay).
  useEffect(() => {
    if (!activaId) return
    void kitsStore.cargar(activaId).catch(() => undefined)
  }, [activaId])

  // Cerrar el menú contextual al hacer click afuera
  const menuRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!prodMenu) return
    function handle(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setProdMenu(null)
      }
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [prodMenu])

  // ── Datos derivados ──────────────────────────────────────────
  const productos = prodState.status === 'listo' ? prodState.productos : []
  const total = prodState.status === 'listo' ? prodState.total : 0
  const totalPages = prodState.status === 'listo' ? prodState.totalPages : 0

  // Categorías dinámicas (de los productos cargados)
  const categorias = useMemo(() => {
    const set = new Set<string>()
    productos.forEach((p) => set.add(p.categoria.nombre))
    return ['Todas', ...Array.from(set).sort()]
  }, [productos])

  // Filtro local de productos (los filtros de search y paginación los
  // hace el back; acá solo filtramos por categoría y estado).
  const productosFiltrados = useMemo(() => {
    return productos.filter((p) => {
      const estado = estadoDeProducto(
        p.stocks[0]?.cantidad ?? 0,
        p.stockMinimo,
      )
      const matchCat = catFilter === 'Todas' || p.categoria.nombre === catFilter
      const matchEstado = estadoFilter === 'Todos' || estado === estadoFilter
      return matchCat && matchEstado
    })
  }, [productos, catFilter, estadoFilter])

  // Resumen de estados (sobre TODOS los productos, no solo filtrados)
  const resumenEstados = useMemo(() => {
    const r = { ok: 0, bajo: 0, agotado: 0 }
    productos.forEach((p) => {
      const estado = estadoDeProducto(
        p.stocks[0]?.cantidad ?? 0,
        p.stockMinimo,
      )
      r[estado]++
    })
    return r
  }, [productos])

  // ── Handlers ─────────────────────────────────────────────────
  function toggleKit(id: string) {
    setOpenKits((p) => ({ ...p, [id]: !p[id] }))
  }

  // ── Render ───────────────────────────────────────────────────
  const kits = kitsState.status === 'listo' ? kitsState.kits : []

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="Inventario"
        subtitle="BodegaApliSmart · PANEL CENTRAL"
      />

      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 sm:space-y-8">
      {/* ═══════════════════════════════════════════════════════════
          TABLA KITS
          ═══════════════════════════════════════════════════════════ */}
      <section>
        {/* Section header
            Mobile: 2 filas (título / controles). El search ocupa full-width
            y el botón "Nuevo kit" baja a su propia fila. */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          <div className="flex items-center gap-2.5 min-w-0">
            <Layers size={15} className="text-primary shrink-0" />
            <h2
              className="text-lg uppercase text-foreground leading-none"
              style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900 }}
            >
              Tabla Kits
            </h2>
            <span
              className="text-xs text-muted-foreground border border-border px-2 py-0.5"
              style={{
                borderRadius: '0.25rem',
                fontFamily: "'JetBrains Mono', monospace",
              }}
            >
              {kits.length} kits
            </span>
          </div>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
            <div className="relative flex-1 sm:flex-initial">
              <Search
                size={13}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
              />
              <input
                type="text"
                placeholder="Buscar kit…"
                className="w-full sm:w-56 pl-8 pr-3 py-1.5 min-h-[36px] bg-muted border border-border text-xs text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/60"
                style={{ borderRadius: '0.25rem' }}
              />
            </div>
            {puedeCrearKits && (
              <button
                onClick={() => setOpenKit(true)}
                className="inline-flex items-center justify-center gap-1.5 min-h-[36px] px-3 py-1.5 bg-primary text-primary-foreground text-xs font-medium hover:opacity-90 transition-opacity shrink-0"
                style={{ borderRadius: '0.25rem' }}
              >
                <Plus size={13} />
                Nuevo kit
              </button>
            )}
          </div>
        </div>

        {/* Lista de kit-rows */}
        {kitsState.status === 'cargando' || kitsState.status === 'idle' ? (
          <div className="border border-border bg-card p-8 text-center text-sm text-muted-foreground" style={{ borderRadius: '0.25rem' }}>
            Cargando kits…
          </div>
        ) : kits.length === 0 ? (
          <div className="border border-border bg-card p-8 text-center text-sm text-muted-foreground" style={{ borderRadius: '0.25rem' }}>
            No hay kits registrados. {puedeCrearKits && 'Creá el primero con "Nuevo kit".'}
          </div>
        ) : (
          <div
            className="border border-border bg-card overflow-hidden divide-y divide-border"
            style={{ borderRadius: '0.25rem' }}
          >
            {kits.map((kit) => (
              <KitRow
                key={kit.id}
                kit={kit}
                isOpen={!!openKits[kit.id]}
                onToggle={() => toggleKit(kit.id)}
              />
            ))}
          </div>
        )}
      </section>

      {/* ═══════════════════════════════════════════════════════════
          TABLA PRODUCTOS
          ═══════════════════════════════════════════════════════════ */}
      <section>
        {/* Section header
            Mobile: 2 filas. Fila 1: título. Fila 2: grilla 2-col con
            search + 2 selects + botón "Nuevo producto" full-width. */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          <div className="flex items-center gap-2.5 min-w-0">
            <TagIcon size={15} className="text-secondary shrink-0" />
            <h2
              className="text-lg uppercase text-foreground leading-none"
              style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900 }}
            >
              Tabla Productos
            </h2>
            <span
              className="text-xs text-muted-foreground border border-border px-2 py-0.5"
              style={{
                borderRadius: '0.25rem',
                fontFamily: "'JetBrains Mono', monospace",
              }}
            >
              {total} resultados
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-[1fr_auto_auto_auto] gap-2 w-full sm:w-auto sm:items-center">
            {/* Búsqueda por SKU o nombre */}
            <div className="relative col-span-1 sm:col-span-2 lg:col-span-1">
              <Search
                size={13}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
              />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="SKU o producto…"
                className="w-full pl-8 pr-3 py-1.5 min-h-[36px] bg-muted border border-border text-xs text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/60"
                style={{ borderRadius: '0.25rem' }}
              />
            </div>
            {/* Filtro categoría */}
            <SelectMobile
              value={catFilter}
              onChange={(v) => setCatFilter(v)}
              options={categorias}
              prefix="Categoría: "
              placeholder="Seleccionar…"
              label="Filtrar por categoría"
              aria-label="Categoría"
            />
            {/* Filtro estado */}
            <SelectMobile
              value={estadoFilter}
              onChange={(v) => setEstadoFilter(v as 'Todos' | EstadoProducto)}
              options={['Todos', 'ok', 'bajo', 'agotado']}
              prefix="Estado: "
              label="Filtrar por estado"
              aria-label="Estado"
            />
            {puedeCrearProductos && (
              <button
                onClick={() => setOpenNuevo(true)}
                className="inline-flex items-center justify-center gap-1.5 min-h-[36px] px-3 py-1.5 bg-primary text-primary-foreground text-xs font-medium hover:opacity-90 transition-opacity shrink-0"
                style={{ borderRadius: '0.25rem' }}
              >
                <Plus size={13} />
                Nuevo producto
              </button>
            )}
          </div>
        </div>

        {/* Tabla */}
        {prodState.status === 'cargando' || prodState.status === 'idle' ? (
          <div className="border border-border bg-card p-8 text-center text-sm text-muted-foreground" style={{ borderRadius: '0.25rem' }}>
            Cargando productos…
          </div>
        ) : productos.length === 0 ? (
          <div className="border border-border bg-card p-8 text-center text-sm text-muted-foreground" style={{ borderRadius: '0.25rem' }}>
            No hay productos en esta bodega.
          </div>
        ) : (
          <div
            className="border border-border bg-card overflow-hidden"
            style={{ borderRadius: '0.25rem' }}
          >
            {/* Header de columnas — SOLO desktop (sm+). En mobile la
                fila tiene su layout propio sin header (es self-evident
                por el tap que abre el detalle). */}
            <div
              className="hidden sm:grid items-center px-5 py-3 bg-muted/40 border-b border-border text-[10px] text-muted-foreground uppercase tracking-widest"
              style={{
                gridTemplateColumns:
                  '40px 95px 1.4fr 0.9fr 90px 60px 70px 95px 90px 32px',
                gap: '16px',
                fontFamily: "'JetBrains Mono', monospace",
              }}
            >
              <div></div>
              <div>SKU</div>
              <div>Producto</div>
              <div>Categoría</div>
              <div>Stock</div>
              <div>Mínimo</div>
              <div>Unidad</div>
              <div>Precio</div>
              <div>Estado</div>
              <div></div>
            </div>

            {/* Filas */}
            <div className="divide-y divide-border">
              {productosFiltrados.map((p) => {
                const stock = p.stocks[0]?.cantidad ?? 0
                const estado = estadoDeProducto(stock, p.stockMinimo)
                const c = colorDeEstado(estado)
                const stockPct = Math.min(
                  100,
                  p.stockMinimo > 0
                    ? Math.round((stock / p.stockMinimo) * 100)
                    : 100,
                )
                return (
                  <ProductoFila
                    key={p.id}
                    p={p}
                    stock={stock}
                    estado={estado}
                    c={c}
                    stockPct={stockPct}
                    onDetalle={() => void abrirProducto(p)}
                    menuOpen={prodMenu === p.id}
                    onMenuToggle={() =>
                      setProdMenu(prodMenu === p.id ? null : p.id)
                    }
                    menuRef={prodMenu === p.id ? menuRef : undefined}
                    onMenuEdit={() => {
                      void abrirProducto(p)
                      setProdMenu(null)
                    }}
                    onMenuDelete={() => {
                      if (confirm(`¿Eliminar "${p.nombre}"?`)) {
                        void productosStore.eliminar(p.id).then(() => cargar())
                      }
                      setProdMenu(null)
                    }}
                    puedeEditar={puedeEditarProductos}
                    puedeEliminar={puedeEliminarProductos}
                    formatPesos={formatPesos}
                  />
                )
              })}
            </div>

            {/* Footer: 3 filas en mobile, 3 columnas en desktop.
                Fila 1: "Mostrando X-Y de Z" (full-width, alineado izquierda).
                Fila 2: paginación centrada (full-width).
                Fila 3: chips de resumen (wrap). */}
            <div
              className="flex flex-col gap-2 sm:grid sm:grid-cols-3 sm:items-center sm:gap-3 px-4 sm:px-5 py-3 bg-muted/30 border-t border-border text-xs text-muted-foreground"
              style={{ fontFamily: "'JetBrains Mono', monospace" }}
            >
              {/* Contador (fila 1 en mobile, izq en desktop) */}
              <span>
                {(() => {
                  if (total === 0) return 'Sin resultados'
                  const desde = (page - 1) * pageSize + 1
                  const hasta = Math.min(page * pageSize, total)
                  return `Mostrando ${desde}-${hasta} de ${total}`
                })()}
              </span>

              {/* Paginación centrada (fila 2 en mobile, centro en desktop) */}
              <div className="flex justify-center sm:justify-center">
                {total > 0 && (
                  <Pagination
                    page={page}
                    totalPages={totalPages}
                    total={total}
                    pageSize={pageSize}
                    onChange={setPage}
                    showRange={false}
                    embedded
                  />
                )}
              </div>

              {/* Chips de resumen (fila 3 en mobile wrap, derecha en desktop) */}
              <div className="flex items-center flex-wrap gap-x-3 gap-y-1 sm:justify-end">
                <span className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-secondary" />
                  {resumenEstados.ok} OK
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-yellow-400" />
                  {resumenEstados.bajo} Bajo
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                  {resumenEstados.agotado} Agotados
                </span>
              </div>
            </div>
          </div>
        )}
      </section>
      </div>

      {/* Modales */}
      {openNuevo && activaId && (
        <NuevoProductoModal
          bodegaId={activaId}
          onClose={() => setOpenNuevo(false)}
          onCreated={() => {
            setOpenNuevo(false)
            cargar()
          }}
        />
      )}
      {openKit && activaId && (
        <ModalCrearKit
          bodegaId={activaId}
          onClose={() => setOpenKit(false)}
          onCreated={() => {
            // El back no emite kit.creado por realtime. La store ya
            // inserta el kit arriba del array (kitsStore.crear hace
            // push local), pero por las dudas forzamos un cargar()
            // para que la disponibilidad (stock) venga fresca del back.
            void kitsStore.cargar(activaId).catch(() => undefined)
          }}
        />
      )}
      {productoDetalle && (
        <ProductoDetalleModal
          producto={productoDetalle}
          onClose={() => setProductoDetalle(null)}
          onDeleted={() => {
            // El back ya emite producto.eliminado y el RealtimeProvider
            // hace recargarSilencioso(), pero si el socket está
            // reconectando podemos quedarnos con la fila vieja. Forzamos
            // un cargar() acá como red de seguridad.
            setProductoDetalle(null)
            cargar()
          }}
          onUpdated={(actualizado) => {
            // Reflejo el cambio en el modal (precio, nombre, etc.) sin
            // cerrarlo, y refresco la grilla del padre.
            setProductoDetalle(actualizado)
            cargar()
          }}
        />
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════
// Subcomponente: ProductoFila
// Layout responsive:
//  - mobile (<sm): 4 columnas (Producto | Stock | Precio | Estado) + chevron.
//    Toda la fila es tocable → abre ProductoDetalleModal.
//  - desktop (sm+): grilla completa de 10 cols con menú de acciones.
// ═══════════════════════════════════════════════════════════

type EstadoColor = ReturnType<typeof colorDeEstado>

function ProductoFila({
  p,
  stock,
  estado,
  c,
  stockPct,
  onDetalle,
  menuOpen,
  onMenuToggle,
  menuRef,
  onMenuEdit,
  onMenuDelete,
  puedeEditar,
  puedeEliminar,
  formatPesos,
}: {
  p: ProductoListItem
  stock: number
  estado: EstadoProducto
  c: EstadoColor
  stockPct: number
  onDetalle: () => void
  menuOpen: boolean
  onMenuToggle: () => void
  menuRef: React.RefObject<HTMLDivElement> | undefined
  onMenuEdit: () => void
  onMenuDelete: () => void
  puedeEditar: boolean
  puedeEliminar: boolean
  formatPesos: (n: number) => string
}) {
  const presentacion = p.conversiones?.find((conversion) => conversion.unidadDestino.id === p.unidadMedida.id)
  const stockPresentacion = presentacion ? stock / Number(presentacion.factorConversion) : null
  return (
    <>
      {/* ─── MOBILE: 4 columnas + chevron, toda la fila es el trigger ─── */}
      <button
        type="button"
        onClick={onDetalle}
        className="sm:hidden w-full text-left flex items-center gap-3 px-4 py-3 hover:bg-muted/30 active:bg-muted/50 transition-colors min-h-[64px]"
      >
        {/* Foto miniatura */}
        {imageUrl(p.fotoUrl) ? (
          <img
            src={imageUrl(p.fotoUrl) ?? ''}
            alt={p.nombre}
            className="w-10 h-10 object-cover border border-border shrink-0"
            style={{ borderRadius: '0.25rem' }}
          />
        ) : (
          <div
            className="w-10 h-10 bg-muted border border-border flex items-center justify-center shrink-0"
            style={{ borderRadius: '0.25rem' }}
          >
            <Boxes size={14} className="text-muted-foreground" />
          </div>
        )}

        {/* Producto (flex-1) */}
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-foreground truncate">
            {p.nombre}
          </div>
          <div
            className="text-[10px] text-muted-foreground mt-0.5 truncate"
            style={{ fontFamily: "'JetBrains Mono', monospace" }}
          >
            {p.codigo} · {p.categoria.nombre}
          </div>
        </div>

        {/* Stock + Precio (col derecha, 2 líneas) */}
        <div className="text-right shrink-0">
          <div
            className="text-sm font-semibold"
            style={{ fontFamily: "'JetBrains Mono', monospace", color: c.text }}
          >
            {stockPresentacion == null ? stock : `${stockPresentacion.toLocaleString('es-EC', { maximumFractionDigits: 3 })} ${presentacion?.unidadOrigen.abreviatura}`}
          </div>
          <div
            className="text-[10px] text-muted-foreground"
            style={{ fontFamily: "'JetBrains Mono', monospace" }}
          >
            <ValorBlur value={p.precio} />
          </div>
        </div>

        {/* Estado pill */}
        <span className="shrink-0 flex items-center gap-1.5">
          <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />
          <span
            className={c.text}
            style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '9px' }}
          >
            {estado === 'ok' ? 'OK' : estado === 'bajo' ? 'BAJO' : 'AGOT.'}
          </span>
        </span>

        <ChevronRight size={14} className="text-muted-foreground shrink-0" />
      </button>

      {/* ─── DESKTOP: grilla completa con menú de acciones ─── */}
      <div
        className="hidden sm:grid items-center px-5 py-3 hover:bg-muted/30 transition-colors text-xs"
        style={{
          gridTemplateColumns:
            '40px 105px 1fr 1.2fr 90px 60px 70px 95px 90px 32px',
          gap: '16px',
        }}
      >
        {/* Foto (miniatura 32x32, sin header) */}
        {imageUrl(p.fotoUrl) ? (
          <img
            src={imageUrl(p.fotoUrl) ?? ''}
            alt={p.nombre}
            className="w-8 h-8 object-cover border border-border"
            style={{ borderRadius: '0.25rem' }}
          />
        ) : (
          <div
            className="w-8 h-8 bg-muted border border-border flex items-center justify-center"
            style={{ borderRadius: '0.25rem' }}
          >
            <Boxes size={12} className="text-muted-foreground" />
          </div>
        )}
        {/* SKU */}
        <span
          className="text-muted-foreground truncate"
          style={{ fontFamily: "'JetBrains Mono', monospace" }}
        >
          {p.codigo}
        </span>
        {/* Producto */}
        <button
          onClick={onDetalle}
          className="text-foreground font-medium text-left hover:text-primary transition-colors truncate"
        >
          {p.nombre}
        </button>
        {/* Categoría */}
        <span
          className="inline-flex items-center text-xs text-foreground border border-border px-2 py-0.5 w-fit truncate"
          style={{ borderRadius: '0.25rem' }}
          title={p.categoria.nombre}
        >
          {p.categoria.nombre}
        </span>
        {/* Stock + mini barra */}
        <div className="flex items-center gap-2">
          <span className={`text-xs font-medium ${c.text}`} title={presentacion ? `${stock} ${p.unidadMedida.abreviatura} en total` : undefined}>
            {stockPresentacion == null ? stock : stockPresentacion.toLocaleString('es-EC', { maximumFractionDigits: 3 })}
          </span>
          <div className="w-10 h-1 rounded-full bg-muted overflow-hidden shrink-0">
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${stockPct}%`, background: c.bar }}
            />
          </div>
        </div>
        {/* Mínimo */}
        <span
          className="text-muted-foreground"
          style={{ fontFamily: "'JetBrains Mono', monospace" }}
        >
          {presentacion ? (Number(p.stockMinimo) / Number(presentacion.factorConversion)).toLocaleString('es-EC', { maximumFractionDigits: 3 }) : p.stockMinimo}
        </span>
        {/* Unidad */}
        <span
          className="text-muted-foreground"
          style={{ fontFamily: "'JetBrains Mono', monospace" }}
        >
          {presentacion?.unidadOrigen.abreviatura ?? p.unidadMedida.abreviatura}
        </span>
        {/* Precio */}
        <span style={{ fontFamily: "'JetBrains Mono', monospace" }}>
          <ValorBlur value={p.precio} />
        </span>
        {/* Estado */}
        <span className="flex items-center gap-1.5">
          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${c.dot}`} />
          <span
            className={c.text}
            style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '9px' }}
          >
            {estado === 'ok' ? 'OK' : estado === 'bajo' ? 'Bajo' : 'Agotado'}
          </span>
        </span>
        {/* Acciones */}
        <div className="relative flex justify-end" ref={menuRef}>
          <button
            onClick={(e) => {
              e.stopPropagation()
              onMenuToggle()
            }}
            className="p-2 min-w-[32px] min-h-[32px] text-muted-foreground hover:text-foreground hover:bg-muted transition-colors inline-flex items-center justify-center"
            style={{ borderRadius: '0.25rem' }}
            title="Más opciones"
            aria-label="Más opciones"
          >
            <MoreHorizontal size={14} />
          </button>
          {menuOpen && (
            <div
              className="absolute right-0 top-9 z-50 bg-card border border-border shadow-xl py-1 w-40"
              style={{ borderRadius: '0.25rem' }}
            >
              {puedeEditar && (
                <button
                  onClick={onMenuEdit}
                  className="w-full flex items-center gap-2 px-3 py-2 text-xs text-foreground hover:bg-muted transition-colors"
                >
                  <Edit3 size={12} className="text-muted-foreground" />
                  Editar
                </button>
              )}
              {puedeEliminar && (
                <button
                  onClick={onMenuDelete}
                  className="w-full flex items-center gap-2 px-3 py-2 text-xs text-primary hover:bg-primary/10 transition-colors"
                >
                  <X size={12} className="text-primary" />
                  Eliminar
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  )
}

// ═══════════════════════════════════════════════════════════
// Subcomponente: KitRow
// ═══════════════════════════════════════════════════════════

function KitRow({
  kit,
  isOpen,
  onToggle,
}: {
  kit: Kit
  isOpen: boolean
  onToggle: () => void
}) {
  // Estado del kit: lo calcula el back según el stock de sus productos
  // en la bodega del kit. Si no viene (caso legacy), asumimos 'disponible'.
  const estado: 'disponible' | 'parcial' | 'agotado' =
    kit.disponibilidad?.estado ?? 'disponible'

  // Formatear fecha: ISO → dd/mm/aa
  const fecha = new Date(kit.createdAt)
  const fechaLabel = `${String(fecha.getDate()).padStart(2, '0')}/${String(
    fecha.getMonth() + 1,
  ).padStart(2, '0')}/${String(fecha.getFullYear()).slice(-2)}`

  return (
    <div>
      {/* Fila colapsada */}
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3 px-5 py-3.5 hover:bg-muted/40 transition-colors text-left"
      >
        <div
          className={`transition-transform duration-300 ${
            isOpen ? 'rotate-0' : '-rotate-90'
          }`}
        >
          <ChevronDown size={14} className="text-muted-foreground" />
        </div>
        <span className="text-sm font-medium text-foreground flex-1 truncate">
          {kit.nombre}
        </span>
        <span
          className="text-[10px] text-muted-foreground"
          style={{ fontFamily: "'JetBrains Mono', monospace" }}
        >
          {kit.codigo}
        </span>
        <EstadoKitBadge estado={estado} />
        <span
          className="text-xs text-muted-foreground w-20 text-right"
          style={{ fontFamily: "'JetBrains Mono', monospace" }}
        >
          {fechaLabel}
        </span>
      </button>

      {/* Fila expandida (acordeón) */}
      <div
        style={{
          display: 'grid',
          gridTemplateRows: isOpen ? '1fr' : '0fr',
          transition: 'grid-template-rows 260ms cubic-bezier(0.4,0,0.2,1)',
        }}
      >
        <div className="overflow-hidden">
          <div className="bg-muted/30 border-t border-border/60">
            {/* Header de columnas */}
            <div
              className="grid px-5 py-2 border-b border-border/40 text-[9px] text-muted-foreground uppercase tracking-widest"
              style={{
                gridTemplateColumns: '1fr 90px 120px 90px',
                fontFamily: "'JetBrains Mono', monospace",
              }}
            >
              <div>Componente</div>
              <div>Cantidad</div>
              <div>Stock actual</div>
              <div>Unidad</div>
            </div>
            {/* Filas de componentes */}
            {kit.items.length === 0 ? (
              <div className="px-5 py-3 text-xs text-muted-foreground">
                Este kit no tiene componentes.
              </div>
            ) : (
              kit.items.map((item, idx) => {
                // Si el back mandó info de disponibilidad, la usamos
                // para mostrar el stock real del producto.
                const stockInfo = kit.disponibilidad?.items.find(
                  (d) => d.productoId === item.productoId,
                )
                const stock = stockInfo?.stock
                const enProblema =
                  stockInfo != null && stockInfo.stock < stockInfo.stockMinimo
                return (
                  <div
                    key={item.id}
                    className={`grid items-center px-5 py-2.5 ${
                      idx === kit.items.length - 1
                        ? ''
                        : 'border-b border-border/30'
                    } hover:bg-muted/40 transition-colors`}
                    style={{
                      gridTemplateColumns: '1fr 90px 120px 90px',
                    }}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="w-px h-4 bg-border shrink-0" />
                      <span className="text-xs text-foreground truncate">
                        {item.producto.nombre}
                      </span>
                    </div>
                    <span
                      className="text-xs font-medium text-foreground"
                      style={{ fontFamily: "'JetBrains Mono', monospace" }}
                    >
                      {item.cantidad}
                    </span>
                    <span
                      className={`text-xs ${
                        enProblema
                          ? 'text-primary font-semibold'
                          : 'text-foreground'
                      }`}
                      style={{ fontFamily: "'JetBrains Mono', monospace" }}
                      title={
                        stock != null
                          ? `Stock: ${stock} / Mínimo: ${stockInfo?.stockMinimo ?? 0}`
                          : ''
                      }
                    >
                      {stock != null ? stock : '—'}
                    </span>
                    <span
                      className="text-xs text-muted-foreground"
                      style={{ fontFamily: "'JetBrains Mono', monospace" }}
                    >
                      {item.producto.unidadMedida?.abreviatura ??
                        stockInfo?.unidad ??
                        '—'}
                    </span>
                  </div>
                )
              })
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function EstadoKitBadge({
  estado,
}: {
  estado: 'disponible' | 'parcial' | 'agotado'
}) {
  const cls =
    estado === 'disponible'
      ? 'bg-secondary/15 text-secondary border border-secondary/20'
      : estado === 'parcial'
        ? 'bg-yellow-400/15 text-yellow-400 border border-yellow-400/20'
        : 'bg-primary/15 text-primary border border-primary/20'
  const label =
    estado === 'disponible' ? 'Disponible' : estado === 'parcial' ? 'Parcial' : 'Agotado'
  return (
    <span
      className={`text-[9px] px-1.5 py-0.5 ${cls}`}
      style={{
        borderRadius: '0.15rem',
        fontFamily: "'JetBrains Mono', monospace",
        fontWeight: 500,
      }}
    >
      {label}
    </span>
  )
}
