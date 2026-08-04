import { useEffect, useMemo, useState, useCallback } from 'react'
import {
  Undo2,
  Inbox,
  Loader2,
  Eye,
  Plus,
  CheckCircle2,
  XCircle,
  Camera,
  Package,
  AlertCircle,
  Send,
} from 'lucide-react'
import { useAuth } from '../store/auth'
import { useBodegaActiva } from '../store/bodegaActiva'
import {
  useDevoluciones,
  devolucionesStore,
  type DevolucionListItem,
  type EstadoDevolucion,
  type PendientePorPedido,
} from '../store/devoluciones'
import { Pagination } from './Pagination'
import { CrearDevolucionModal } from './CrearDevolucionModal'
import { DevolucionDetalleModal } from './DevolucionDetalleModal'

type TabKey = 'TODAS' | EstadoDevolucion

const TODOS_LOS_TABS: { key: TabKey; label: string }[] = [
  { key: 'TODAS', label: 'Todas' },
  { key: 'pendiente', label: 'Pendiente' },
  { key: 'en_transito', label: 'En tránsito' },
  { key: 'recibida', label: 'Recibida' },
  { key: 'cancelada', label: 'Cancelada' },
]

/**
 * Devuelve las tabs que cada rol puede ver + el filtro base de estados
 * que la tabla debe aplicar sobre las devoluciones del back.
 *
 *   - Operador/técnico: solo `Pendiente` y `Recibida` (las suyas).
 *   - Bodeguero: solo `En tránsito` y `Recibida` (toda la bodega).
 *   - Admin: todos los estados (toda la bodega).
 */
function estadosParaRol(
  puedeRecibir: boolean,
  puedeCrear: boolean,
): {
  tabs: { key: TabKey; label: string }[]
  estadosVisibles: EstadoDevolucion[] | 'TODOS'
} {
  const esOperador = puedeCrear && !puedeRecibir
  const esAdmin = puedeCrear && puedeRecibir
  if (esAdmin) {
    return { tabs: TODOS_LOS_TABS, estadosVisibles: 'TODOS' }
  }
  if (esOperador) {
    return {
      tabs: [
        { key: 'TODAS', label: 'Todas' },
        { key: 'pendiente', label: 'Pendiente' },
        { key: 'recibida', label: 'Recibida' },
      ],
      estadosVisibles: ['pendiente', 'recibida'],
    }
  }
  // Bodeguero
  return {
    tabs: [
      { key: 'TODAS', label: 'Todas' },
      { key: 'en_transito', label: 'En tránsito' },
      { key: 'recibida', label: 'Recibida' },
    ],
    estadosVisibles: ['en_transito', 'recibida'],
  }
}

/**
 * Pantalla Devoluciones.
 *
 * - Técnico/operador: ve las suyas. Crea nuevas devoluciones.
 * - Bodeguero/admin: ve todas las de la bodega. Recibe las devoluciones
 *   (foto por producto) y las finaliza.
 *
 * Header de la tabla: Código | Pedido | Operador | Progreso | Estado | Acción
 */
const DEFAULT_PAGE_SIZE = 10

export function Devoluciones() {
  const auth = useAuth()
  const bodegaId = useBodegaActiva()
  const devState = useDevoluciones()

  const [open, setOpen] = useState(false)
  const [pedidoPreseleccionado, setPedidoPreseleccionado] = useState<string | null>(null)
  const [detalle, setDetalle] = useState<DevolucionListItem | null>(null)
  const [tab, setTab] = useState<TabKey>('TODAS')
  const [pendientes, setPendientes] = useState<PendientePorPedido[]>([])

  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE)

  const cargarDevs = useCallback(() => {
    if (!bodegaId) return
    void devolucionesStore
      .cargarPaginado({ bodegaId, page, pageSize })
      .catch(() => undefined)
  }, [bodegaId, page, pageSize])

  // Carga inicial cuando cambia la bodega activa
  useEffect(() => {
    if (!bodegaId) return
    setPage(1)
    void devolucionesStore
      .cargarPaginado({ bodegaId, page: 1, pageSize })
      .catch(() => undefined)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bodegaId, pageSize])

  // Cuando cambia la página, refetch
  useEffect(() => {
    if (!bodegaId) return
    if (devState.status === 'idle') return
    cargarDevs()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page])

  const permisosUsuario = new Set<string>(
    auth.status === 'autenticado' ? auth.sesion.permisos : [],
  )
  /**
   * Puede RECIBIR devoluciones (rol bodeguero / técnico). Ve TODAS las
   * devoluciones de la bodega y procesa las que están en `en_transito`.
   */
  const puedeRecibir = permisosUsuario.has('tecnicos.devoluciones.editar')
  /**
   * Puede CREAR devoluciones. Ve solo las suyas. El admin tiene este
   * permiso, así que también puede crear (aunque también puede recibir).
   */
  const puedeCrear = permisosUsuario.has('tecnicos.devoluciones.crear')
  /** Compat: si el usuario es SOLO bodeguero (no crea, no ve "Mis Devoluciones"). */
  const esSoloBodeguero = puedeRecibir && !puedeCrear

  const usuarioId = auth.status === 'autenticado' ? auth.sesion.usuario.id : null
  const usuarioNombre = auth.status === 'autenticado' ? auth.sesion.usuario.nombre : '—'
  const usuarioRol = auth.status === 'autenticado' ? auth.sesion.usuario.rol : '—'

  /**
   * Banner de "Pendientes de devolución":
   *   - Operador/técnico (`puedeCrear && !puedeRecibir`): ve SOLO sus items
   *     pendientes. Texto: "Tenés productos pendientes de devolver".
   *   - Admin (`puedeCrear && puedeRecibir`): ve TODOS los pendientes de
   *     la bodega (con el nombre del operador en cada item). Texto:
   *     "Productos pendientes de devolver (toda la bodega)".
   *   - Bodeguero puro (`puedeRecibir && !puedeCrear`): él RECIBE, no devuelve.
   *     No le mostramos este banner; ve la lista de devoluciones en
   *     `en_transito` en la tabla principal.
   */
  const esOperador = puedeCrear && !puedeRecibir
  const esAdmin = puedeCrear && puedeRecibir
  const mostrarBannerPendientes = esOperador || esAdmin
  const operadorParaFiltro = esOperador ? (usuarioId ?? undefined) : undefined

  // Cargar pendientes solo si el banner se va a mostrar.
  // - Si es operador, filtramos por su `usuarioId` (defensa en profundidad).
  // - Si es admin, dejamos que el back traiga todos los pendientes de la bodega.
  useEffect(() => {
    if (!mostrarBannerPendientes) {
      setPendientes([])
      return
    }
    devolucionesStore
      .cargarPendientes(operadorParaFiltro)
      .then((lista) =>
        setPendientes(
          esOperador && usuarioId
            ? lista.filter((p) => p.operadorId === usuarioId)
            : lista,
        ),
      )
      .catch(() => setPendientes([]))
  }, [mostrarBannerPendientes, operadorParaFiltro, usuarioId, esOperador, devState.status])

  const todas = devState.status === 'listo' ? devState.devoluciones : []
  const total = devState.status === 'listo' ? devState.total : 0
  const totalPages = devState.status === 'listo' ? devState.totalPages : 0

  // Tabs y filtro base por estado dependen del rol.
  //   - Operador: solo `pendiente` + `recibida` y filtrado por `operadorId`.
  //   - Bodeguero: solo `en_transito` + `recibida` y ve toda la bodega.
  //   - Admin: todos los estados y ve toda la bodega.
  const { tabs, estadosVisibles } = estadosParaRol(puedeRecibir, puedeCrear)

  // Si la tab actual no aplica para el rol (ej: era admin en 'cancelada'
  // y pasó a ser operador), la reseteamos a 'TODAS' para evitar tabs
  // huérfanas que muestren lista vacía.
  useEffect(() => {
    if (tab !== 'TODAS' && !tabs.some((t) => t.key === tab)) {
      setTab('TODAS')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabs])

  const visibles = useMemo(() => {
    let lista = todas
    // Filtro por operador (solo aplica a operador puro; el admin ve TODO)
    if (esOperador) {
      lista = lista.filter((d) => d.operadorId === usuarioId)
    }
    // Filtro base por estado (si no es admin, acotamos a los estados del rol)
    if (estadosVisibles !== 'TODOS') {
      lista = lista.filter((d) => estadosVisibles.includes(d.estadoNombre))
    }
    return lista
  }, [todas, esOperador, usuarioId, estadosVisibles])

  const filtradas = useMemo(
    () => (tab === 'TODAS' ? visibles : visibles.filter((d) => d.estadoNombre === tab)),
    [visibles, tab],
  )

  function recargar() {
    cargarDevs()
  }

  const titulo =
    esSoloBodeguero
      ? 'Bandeja de Devoluciones'
      : puedeRecibir && puedeCrear
        ? 'Devoluciones'
        : 'Mis Devoluciones'
  const subtitulo = esSoloBodeguero
    ? `Recibí las devoluciones que llegan a la bodega`
    : puedeRecibir && puedeCrear
      ? `Devoluciones que enviaste o recibiste — ${usuarioNombre}`
      : `Devoluciones que enviaste — ${usuarioNombre}`

  return (
    <>
      <div className="flex-1 flex flex-col min-w-0 min-h-0 overflow-y-auto">
        <div className="p-8 space-y-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 bg-muted flex items-center justify-center shrink-0 mt-1">
                <Undo2 size={20} className="text-primary" />
              </div>
              <div>
                <h1
                  className="text-4xl uppercase text-foreground leading-none"
                  style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900 }}
                >
                  {titulo}
                </h1>
                <p
                  className="mt-1 text-sm text-muted-foreground"
                  style={{ fontFamily: "'DM Sans', sans-serif" }}
                >
                  {subtitulo}
                </p>
                <div
                  className="mt-1 text-[10px] text-muted-foreground tracking-widest uppercase"
                  style={{ fontFamily: "'JetBrains Mono', monospace" }}
                >
                  Rol: {usuarioRol}
                </div>
              </div>
            </div>

            {puedeCrear && (
              <button
                onClick={() => setOpen(true)}
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity"
                style={{ borderRadius: '0.25rem' }}
              >
                <Plus size={16} />
                Nueva Devolución
              </button>
            )}
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <StatTile label="Total" value={String(visibles.length)} accent="text-foreground" />
            <StatTile
              label="Pendientes"
              value={String(visibles.filter((d) => d.estadoNombre === 'pendiente').length)}
              accent="text-primary"
            />
            <StatTile
              label="En tránsito"
              value={String(visibles.filter((d) => d.estadoNombre === 'en_transito').length)}
              accent="text-amber-500"
            />
            <StatTile
              label="Recibidas"
              value={String(visibles.filter((d) => d.estadoNombre === 'recibida').length)}
              accent="text-secondary"
            />
            <StatTile
              label="Canceladas"
              value={String(visibles.filter((d) => d.estadoNombre === 'cancelada').length)}
              accent="text-muted-foreground"
            />
          </div>

          {/* Banner de pendientes de devolución
              - Operador: solo los suyos
              - Admin: todos los de la bodega (con nombre del operador) */}
          {mostrarBannerPendientes && pendientes.length > 0 && (
            <div
              className="bg-primary/5 border border-primary/20 p-4"
              style={{ borderRadius: '0.25rem' }}
            >
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <AlertCircle size={16} className="text-primary" />
                <span
                  className="text-sm font-semibold text-foreground"
                  style={{ fontFamily: "'DM Sans', sans-serif" }}
                >
                  {esAdmin
                    ? 'Productos pendientes de devolver en la bodega'
                    : 'Tenés productos pendientes de devolver'}
                </span>
                <span
                  className="text-[10px] text-muted-foreground"
                  style={{ fontFamily: "'JetBrains Mono', monospace" }}
                >
                  {pendientes.length}{' '}
                  {pendientes.length === 1 ? 'pedido' : 'pedidos'} ·{' '}
                  {pendientes.reduce((acc, p) => acc + p.items.length, 0)}{' '}
                  ítems
                </span>
              </div>
              <ul
                className="divide-y divide-border border border-border bg-card"
                style={{ borderRadius: '0.25rem' }}
              >
                {pendientes.map((p) => (
                  <li key={p.pedidoId} className="p-3 flex items-center gap-3 flex-wrap">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Package size={14} className="text-muted-foreground" />
                        <span
                          className="text-sm text-primary"
                          style={{
                            fontFamily: "'JetBrains Mono', monospace",
                            fontWeight: 500,
                          }}
                        >
                          {p.pedidoCodigo}
                        </span>
                        <span
                          className="text-[10px] text-muted-foreground"
                          style={{ fontFamily: "'JetBrains Mono', monospace" }}
                        >
                          {p.items.length}{' '}
                          {p.items.length === 1 ? 'item pendiente' : 'ítems pendientes'}
                        </span>
                        {/* Nombre del operador:
                            - Admin: SIEMPRE lo ve (necesita saber de quién es
                              cada pedido, especialmente cuando varios
                              operadores comparten la bodega).
                            - Operador/técnico: solo lo ve cuando es DISTINTO al
                              suyo (no le sirve ver su propio nombre en cada item). */}
                        {p.operadorNombre && (esAdmin || p.operadorId !== usuarioId) && (
                          <span
                            className="text-[10px] px-1.5 py-0.5 border border-muted-foreground/30 text-muted-foreground bg-muted/40"
                            style={{
                              fontFamily: "'JetBrains Mono', monospace",
                              borderRadius: '0.15rem',
                            }}
                            title="Operador que creó el pedido"
                          >
                            {p.operadorNombre}
                          </span>
                        )}
                      </div>
                      <div
                        className="text-[10px] text-muted-foreground mt-0.5 truncate"
                        style={{ fontFamily: "'JetBrains Mono', monospace" }}
                      >
                        {p.items
                          .slice(0, 4)
                          .map((it) =>
                            it.kitNombre
                              ? `${it.productoNombre} (kit) ×${it.disponible}`
                              : `${it.productoNombre} ×${it.disponible}`,
                          )
                          .join(', ')}
                        {p.items.length > 4 && ` +${p.items.length - 4} más`}
                      </div>
                    </div>
                    {puedeCrear && (
                      <button
                        onClick={() => {
                          setPedidoPreseleccionado(p.pedidoId)
                          setOpen(true)
                        }}
                        className="inline-flex items-center gap-1 px-3 py-1.5 bg-primary text-primary-foreground text-xs hover:bg-primary/90 transition-colors"
                        style={{ borderRadius: '0.25rem' }}
                      >
                        <Plus size={12} /> Devolver
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Tabs */}
          <div className="border-b border-border">
            <div className="flex items-center gap-6 overflow-x-auto">
              {tabs.map((t) => {
                const isActive = tab === t.key
                return (
                  <button
                    key={t.key}
                    onClick={() => setTab(t.key)}
                    className={`relative py-3 text-sm transition-colors whitespace-nowrap ${
                      isActive
                        ? 'text-primary'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                    style={{ fontFamily: "'DM Sans', sans-serif" }}
                  >
                    {t.label}
                    {isActive && (
                      <span className="absolute -bottom-px left-0 right-0 h-0.5 bg-primary" />
                    )}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Tabla */}
          <div
            className="bg-card border border-border overflow-hidden"
            style={{ borderRadius: '0.25rem' }}
          >
            {devState.status === 'cargando' || devState.status === 'idle' ? (
              <div className="py-20 px-6 flex flex-col items-center justify-center text-center">
                <Loader2 size={24} className="text-muted-foreground animate-spin" />
                <p
                  className="mt-3 text-sm text-muted-foreground"
                  style={{ fontFamily: "'DM Sans', sans-serif" }}
                >
                  Cargando devoluciones…
                </p>
              </div>
            ) : devState.status === 'error' ? (
              <div className="py-20 px-6 flex flex-col items-center justify-center text-center">
                <p
                  className="text-sm text-primary"
                  style={{ fontFamily: "'JetBrains Mono', monospace" }}
                >
                  ⚠ {devState.mensaje}
                </p>
                <button
                  onClick={recargar}
                  className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 border border-border text-xs text-foreground hover:border-primary/40 transition-colors"
                  style={{ borderRadius: '0.25rem' }}
                >
                  Reintentar
                </button>
              </div>
            ) : filtradas.length === 0 ? (
              <div className="py-20 px-6 flex flex-col items-center justify-center text-center">
                <div className="w-14 h-14 bg-muted flex items-center justify-center mb-5">
                  <Inbox size={24} className="text-muted-foreground" />
                </div>
                <h3
                  className="text-xl uppercase text-foreground"
                  style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800 }}
                >
                  {tab === 'TODAS' ? 'Sin devoluciones' : 'Nada en este estado'}
                </h3>
                <p
                  className="mt-2 text-sm text-muted-foreground max-w-sm"
                  style={{ fontFamily: "'DM Sans', sans-serif" }}
                >
                  {tab === 'TODAS'
                    ? esSoloBodeguero
                      ? 'No hay devoluciones pendientes en la bodega.'
                      : puedeCrear
                        ? 'Cuando envíes una devolución, aparecerá acá.'
                        : 'No tenés devoluciones todavía.'
                    : `No hay devoluciones en estado ${tab}.`}
                </p>
                {tab === 'TODAS' && puedeCrear && (
                  <button
                    onClick={() => setOpen(true)}
                    className="mt-5 inline-flex items-center gap-2 px-4 py-2 border border-border text-sm text-foreground hover:border-foreground/30 transition-colors"
                    style={{ borderRadius: '0.25rem' }}
                  >
                    <Plus size={14} />
                    Crear la primera
                  </button>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr
                      className="border-b border-border bg-muted/30"
                      style={{ fontFamily: "'JetBrains Mono', monospace" }}
                    >
                      <Th>Código</Th>
                      <Th>Pedido</Th>
                      <Th>Operador</Th>
                      <Th>Progreso</Th>
                      <Th>Estado</Th>
                      <Th>Enviada</Th>
                      <Th className="text-right">Acción</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtradas.map((d) => (
                      <tr
                        key={d.id}
                        onClick={() => setDetalle(d)}
                        className="border-b border-border last:border-b-0 hover:bg-muted/30 cursor-pointer transition-colors"
                      >
                        <Td>
                          <span
                            className="text-primary"
                            style={{
                              fontFamily: "'JetBrains Mono', monospace",
                              fontWeight: 500,
                            }}
                          >
                            {d.codigo}
                          </span>
                        </Td>
                        <Td>
                          <div className="flex items-center gap-2">
                            <Package size={13} className="text-muted-foreground" />
                            <span
                              className="text-sm text-foreground"
                              style={{ fontFamily: "'JetBrains Mono', monospace" }}
                            >
                              {d.pedidoCodigo ?? '—'}
                            </span>
                          </div>
                          <div
                            className="text-[10px] text-muted-foreground"
                            style={{ fontFamily: "'JetBrains Mono', monospace" }}
                          >
                            {d.itemsCount} {d.itemsCount === 1 ? 'item' : 'ítems'}
                          </div>
                        </Td>
                        <Td>
                          <span className="text-sm text-foreground">
                            {d.operadorNombre ?? '—'}
                          </span>
                        </Td>
                        <Td>
                          <ProgresoBar d={d} />
                        </Td>
                        <Td>
                          <EstadoBadge estado={d.estadoNombre} />
                        </Td>
                        <Td>
                          <span
                            className="text-xs text-muted-foreground"
                            style={{ fontFamily: "'JetBrains Mono', monospace" }}
                          >
                            {d.createdAtLabel}
                          </span>
                        </Td>
                        <Td>
                          <div
                            className="flex justify-end"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <AccionDevolucion
                              devolucion={d}
                              puedeRecibir={puedeRecibir}
                              onVer={() => setDetalle(d)}
                            />
                          </div>
                        </Td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
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
              disabled={devState.status === 'cargando'}
            />
          </div>
        </div>
      </div>

      {open && (
        <CrearDevolucionModal
          pedidoInicialId={pedidoPreseleccionado}
          onClose={() => {
            setOpen(false)
            setPedidoPreseleccionado(null)
          }}
          onCreated={(dev) => {
            // Refrescar la lista y abrir el detalle, donde el técnico
            // puede ver la devolución y abrir el wizard "Enviar".
            recargar()
            setDetalle({
              id: dev.id,
              codigo: dev.codigo,
              motivo: dev.motivo,
              estadoNombre: dev.estado,
              createdAt: new Date(dev.createdAt).getTime(),
              createdAtLabel: new Date(dev.createdAt).toLocaleString('es-CO', {
                dateStyle: 'short',
                timeStyle: 'short',
              }),
              operadorId: dev.operadorId,
              operadorNombre: dev.operador?.nombre ?? null,
              bodegaId: dev.bodegaId,
              pedidoId: dev.pedidoId,
              pedidoCodigo: dev.pedido?.codigo ?? null,
              itemsCount: dev.items.length,
              progreso: {
                recibidos: 0,
                rechazados: 0,
                pendientes: dev.items.length,
                total: dev.items.length,
              },
              recibidaAt: null,
              recibidaAtLabel: null,
              recibidaPorNombre: null,
              canceladaAt: null,
              canceladaAtLabel: null,
              motivoCancelacion: null,
            })
          }}
        />
      )}
      {detalle && (
        <DevolucionDetalleModal devolucion={detalle} onClose={() => setDetalle(null)} />
      )}
    </>
  )
}

function AccionDevolucion({
  devolucion,
  puedeRecibir,
  onVer,
}: {
  devolucion: DevolucionListItem
  puedeRecibir: boolean
  onVer: () => void
}) {
  // Bodeguero: la devolución está en tránsito → puede recibir
  if (puedeRecibir && devolucion.estadoNombre === 'en_transito') {
    return (
      <button
        onClick={onVer}
        className="inline-flex items-center gap-1 px-3 py-1.5 bg-primary text-primary-foreground text-xs hover:bg-primary/90 transition-colors"
        style={{ borderRadius: '0.25rem' }}
      >
        <Camera size={13} />
        Recibir
      </button>
    )
  }
  return (
    <button
      onClick={onVer}
      className="inline-flex items-center gap-1 px-3 py-1.5 border border-border text-xs text-foreground hover:border-foreground/30 transition-colors"
      style={{ borderRadius: '0.25rem' }}
    >
      <Eye size={13} />
      Ver
    </button>
  )
}

function ProgresoBar({ d }: { d: DevolucionListItem }) {
  const { recibidos, rechazados, total } = d.progreso
  const completados = recibidos + rechazados
  const porcentaje = total > 0 ? Math.round((completados / total) * 100) : 0
  return (
    <div className="flex items-center gap-2">
      <div
        className="w-24 h-1.5 bg-muted overflow-hidden"
        style={{ borderRadius: '0.15rem' }}
      >
        <div
          className={`h-full ${
            d.estadoNombre === 'recibida' ? 'bg-secondary' : 'bg-primary'
          }`}
          style={{ width: `${porcentaje}%` }}
        />
      </div>
      <span
        className="text-[10px] text-muted-foreground"
        style={{ fontFamily: "'JetBrains Mono', monospace" }}
      >
        {completados}/{total}
      </span>
    </div>
  )
}

function Th({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <th
      className={`px-4 py-3 text-[10px] text-muted-foreground tracking-widest uppercase font-normal ${
        className ?? 'text-left'
      }`}
    >
      {children}
    </th>
  )
}

function Td({ children }: { children: React.ReactNode }) {
  return <td className="px-4 py-3 align-top">{children}</td>
}

function StatTile({
  label,
  value,
  accent,
}: {
  label: string
  value: string
  accent: string
}) {
  return (
    <div
      className="bg-card border border-border p-3"
      style={{ borderRadius: '0.25rem' }}
    >
      <div
        className="text-[10px] text-muted-foreground tracking-widest uppercase"
        style={{ fontFamily: "'JetBrains Mono', monospace" }}
      >
        {label}
      </div>
      <div
        className={`text-2xl leading-none mt-1.5 ${accent}`}
        style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800 }}
      >
        {value}
      </div>
    </div>
  )
}

function EstadoBadge({ estado }: { estado: EstadoDevolucion }) {
  if (estado === 'pendiente') {
    return (
      <span
        className="inline-flex items-center px-2 py-0.5 text-[10px] border border-primary/40 text-primary bg-primary/10"
        style={{
          borderRadius: '0.15rem',
          fontFamily: "'JetBrains Mono', monospace",
          fontWeight: 500,
        }}
      >
        PENDIENTE
      </span>
    )
  }
  if (estado === 'en_transito') {
    return (
      <span
        className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] border border-amber-500/40 text-amber-500 bg-amber-500/10"
        style={{
          borderRadius: '0.15rem',
          fontFamily: "'JetBrains Mono', monospace",
          fontWeight: 500,
        }}
      >
        <Send size={10} />
        EN TRÁNSITO
      </span>
    )
  }
  if (estado === 'recibida') {
    return (
      <span
        className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] border border-secondary/40 text-secondary bg-secondary/10"
        style={{
          borderRadius: '0.15rem',
          fontFamily: "'JetBrains Mono', monospace",
          fontWeight: 500,
        }}
      >
        <CheckCircle2 size={10} />
        RECIBIDA
      </span>
    )
  }
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] border border-muted text-muted-foreground bg-muted/30"
      style={{
        borderRadius: '0.15rem',
        fontFamily: "'JetBrains Mono', monospace",
        fontWeight: 500,
      }}
    >
      <XCircle size={10} />
      CANCELADA
    </span>
  )
}
