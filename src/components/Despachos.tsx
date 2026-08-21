import { useEffect, useMemo, useState, useCallback } from 'react'
import { Truck, Inbox, Loader2, PackageOpen, ChevronRight, FolderKanban, Send } from 'lucide-react'
import { useAuth } from '../store/auth'
import { useBodegaActiva } from '../store/bodegaActiva'
import {
  usePedidos,
  pedidosStore,
  type PedidoListItem,
  type EstadoPedido,
  type EstadoRevision,
} from '../store/pedidos'
import {
  useSolicitudesProyecto,
  solicitudesProyectoStore,
} from '../store/solicitudesProyecto'
import { AccionOrdenModal } from './AccionOrdenModal'
import { OrdenDetalleModal } from './OrdenDetalleModal'
import { AccionSolicitudProyectoModal } from './AccionSolicitudProyectoModal'
import { Pagination } from './Pagination'
import { PageHeader } from './PageHeader'

/**
 * Pantalla Despachos (vista del BODEGUERO / ADMIN).
 *
 * Bandeja de entradas: el bodeguero ve TODAS las solicitudes de la
 * bodega y resuelve las Pendientes (aprobarlas con wizard → pasan a
 * AprobadoPorBodega; o cancelarlas).
 *
 * Header de la tabla (igual que Solicitudes):
 *   Código | Productos | Motivo | Estado (bodega) | Revisión (por ti) | Enviada
 *
 * Los técnicos/operadores NO entran a esta pantalla (la oculta el
 * sidebar: requiere permiso `despachos.ver`).
 */
const DEFAULT_PAGE_SIZE = 10

export function Despachos() {
  const auth = useAuth()
  const bodegaId = useBodegaActiva()
  const pedidosState = usePedidos()

  const [accion, setAccion] = useState<PedidoListItem | null>(null)
  const [detalle, setDetalle] = useState<PedidoListItem | null>(null)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE)

  // ── Solicitudes de proyectos (PSB-YYYY-NNNN) ─────────────
  // Las solicitudes que los técnicos generan desde un proyecto
  // también se gestionan acá. El bodeguero las ve, las aprueba y
  // las entrega desde el mismo panel de Despachos.
  const [tab, setTab] = useState<'pedidos' | 'proyectos'>('pedidos')
  const solicitudesState = useSolicitudesProyecto()
  const [solAccionId, setSolAccionId] = useState<string | null>(null)
  const [solPage, setSolPage] = useState(1)
  const [solPageSize, setSolPageSize] = useState(DEFAULT_PAGE_SIZE)
  const [solEstadoFiltro, setSolEstadoFiltro] = useState<
    '' | 'pendiente' | 'aprobada' | 'rechazada' | 'entregada'
  >('')

  const cargarSolicitudes = useCallback(() => {
    if (!bodegaId) return
    void solicitudesProyectoStore
      .cargarPaginado({
        bodegaId,
        page: solPage,
        pageSize: solPageSize,
        estado: solEstadoFiltro || undefined,
      })
      .catch(() => undefined)
  }, [bodegaId, solPage, solPageSize, solEstadoFiltro])

  useEffect(() => {
    if (tab !== 'proyectos') return
    setSolPage(1)
    void solicitudesProyectoStore
      .cargarPaginado({
        bodegaId: bodegaId ?? undefined,
        page: 1,
        pageSize: solPageSize,
        estado: solEstadoFiltro || undefined,
      })
      .catch(() => undefined)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, bodegaId, solPageSize, solEstadoFiltro])

  useEffect(() => {
    if (tab !== 'proyectos') return
    if (solicitudesState.status === 'idle') return
    cargarSolicitudes()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [solPage])

  // Realtime: cuando llega un evento `realtime:solicitud-bodega`
  // (creada o estado-cambiado) del proyecto, refrescamos la lista
  // del bodeguero. Filtramos por bodegaId para no refrescar si el
  // evento es de OTRA bodega del tenant.
  useEffect(() => {
    if (typeof window === 'undefined' || !bodegaId) return
    const onSolicitud = (ev: Event) => {
      const detail = (ev as CustomEvent<{ bodegaId: string | null }>).detail
      if (!detail) return
      // Si el evento trae `bodegaId` y no es la activa, lo ignoramos.
      if (detail.bodegaId && detail.bodegaId !== bodegaId) return
      // Si el tab activo no es 'proyectos', igual refrescamos en
      // background (cuando el user cambie de tab ya estará actualizado).
      if (tab === 'proyectos') {
        cargarSolicitudes()
      } else {
        void solicitudesProyectoStore
          .cargarPaginado({
            bodegaId: bodegaId ?? undefined,
            page: 1,
            pageSize: solPageSize,
            estado: solEstadoFiltro || undefined,
          })
          .catch(() => undefined)
      }
    }
    window.addEventListener('realtime:solicitud-bodega', onSolicitud)
    return () => {
      window.removeEventListener('realtime:solicitud-bodega', onSolicitud)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bodegaId, tab, solPageSize, solEstadoFiltro])

  const cargar = useCallback(() => {
    if (!bodegaId) return
    void pedidosStore
      .cargarPaginado({ bodegaId, page, pageSize })
      .catch(() => undefined)
  }, [bodegaId, page, pageSize])

  // Carga inicial cuando cambia la bodega activa
  useEffect(() => {
    if (!bodegaId) return
    setPage(1)
    void pedidosStore
      .cargarPaginado({ bodegaId, page: 1, pageSize })
      .catch(() => undefined)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bodegaId, pageSize])

  // Cuando cambia la página, refetch
  useEffect(() => {
    if (!bodegaId) return
    if (pedidosState.status === 'idle') return
    cargar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page])

  const todos = pedidosState.status === 'listo' ? pedidosState.pedidos : []
  const total = pedidosState.status === 'listo' ? pedidosState.total : 0
  const totalPages = pedidosState.status === 'listo' ? pedidosState.totalPages : 0
  const usuarioNombre = auth.status === 'autenticado' ? auth.sesion.usuario.nombre : '—'
  const usuarioRol = auth.status === 'autenticado' ? auth.sesion.usuario.rol : '—'

  const pendientes = useMemo(
    () => todos.filter((p) => p.estadoNombre === 'Pendiente'),
    [todos],
  )
  const aprobadasPorBodega = useMemo(
    () => todos.filter((p) => p.estadoNombre === 'AprobadoPorBodega'),
    [todos],
  )
  const entregadas = useMemo(
    () => todos.filter((p) => p.estadoNombre === 'Entregado'),
    [todos],
  )
  const canceladas = useMemo(
    () => todos.filter((p) => p.estadoNombre === 'Cancelado'),
    [todos],
  )

  // "Aprobadas hoy" filtra por aprobadaAt del día actual.
  const aprobadasHoy = entregadas.filter((p) => {
    if (!p.aprobadaAt) return false
    const fecha = new Date(p.aprobadaAt)
    const ahora = new Date()
    return (
      fecha.getFullYear() === ahora.getFullYear() &&
      fecha.getMonth() === ahora.getMonth() &&
      fecha.getDate() === ahora.getDate()
    )
  })

  function recargar() {
    cargar()
  }

  return (
    <div className="flex-1 flex flex-col min-w-0 min-h-0">
      <PageHeader
        title="Despachos"
        subtitle={`BodegaApliSmart · ${usuarioRol.toUpperCase()} · ${usuarioNombre}`}
      />

      <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 space-y-4 sm:space-y-6">
        <div className="space-y-6">
          {/* Tabs */}
          <div className="inline-flex items-center gap-1 p-1 bg-muted border border-border w-fit" style={{ borderRadius: '0.375rem' }}>
            <button
              type="button"
              onClick={() => setTab('pedidos')}
              className={[
                'inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors',
                tab === 'pedidos'
                  ? 'bg-card text-foreground border border-border shadow-sm'
                  : 'text-muted-foreground hover:text-foreground',
              ].join(' ')}
              style={{ borderRadius: '0.25rem' }}
            >
              <PackageOpen size={13} />
              Solicitudes generales
            </button>
            <button
              type="button"
              onClick={() => setTab('proyectos')}
              className={[
                'inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors',
                tab === 'proyectos'
                  ? 'bg-card text-foreground border border-border shadow-sm'
                  : 'text-muted-foreground hover:text-foreground',
              ].join(' ')}
              style={{ borderRadius: '0.25rem' }}
            >
              <FolderKanban size={13} />
              Solicitudes de proyectos
            </button>
          </div>

          {tab === 'pedidos' ? (
            <>
          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatTile
              label="Pendientes"
              value={String(pendientes.length)}
              accent="text-primary"
            />
            <StatTile
              label="Por revisar técnico"
              value={String(aprobadasPorBodega.length)}
              accent="text-secondary"
            />
            <StatTile
              label="Entregadas hoy"
              value={String(aprobadasHoy.length)}
              accent="text-foreground"
            />
            <StatTile
              label="Canceladas"
              value={String(canceladas.length)}
              accent="text-muted-foreground"
            />
          </div>

          {pedidosState.status === 'cargando' || pedidosState.status === 'idle' ? (
            <div className="bg-card border border-border p-10 flex flex-col items-center justify-center text-center">
              <Loader2 size={22} className="text-muted-foreground animate-spin" />
              <p
                className="mt-3 text-sm text-muted-foreground"
                style={{ fontFamily: "'DM Sans', sans-serif" }}
              >
                Cargando despachos…
              </p>
            </div>
          ) : pedidosState.status === 'error' ? (
            <div className="bg-card border border-border p-10 flex flex-col items-center justify-center text-center">
              <p
                className="text-sm text-primary"
                style={{ fontFamily: "'JetBrains Mono', monospace" }}
              >
                ⚠ {pedidosState.mensaje}
              </p>
              <button
                onClick={recargar}
                className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 border border-border text-xs text-foreground hover:border-primary/40 transition-colors"
                style={{ borderRadius: '0.25rem' }}
              >
                Reintentar
              </button>
            </div>
          ) : (
            <>
              <Section
                title="Pendientes de aprobación"
                badge={`${pendientes.length} sin resolver`}
              >
                {pendientes.length === 0 ? (
                  <EmptyState message="No hay solicitudes pendientes. Cuando un operador cree una, aparecerá acá." />
                ) : (
                  <TablaDespachos
                    rows={pendientes}
                    onAccion={(p) => setAccion(p)}
                    onVer={(p) => setDetalle(p)}
                  />
                )}
              </Section>

              <Section
                title="Aprobadas por bodega (esperando técnico)"
                badge={`${aprobadasPorBodega.length}`}
                subtitle="El técnico debe revisarlas desde 'Mis solicitudes'"
              >
                {aprobadasPorBodega.length === 0 ? (
                  <EmptyState
                    message="Todavía no aprobaste ninguna solicitud."
                    muted
                  />
                ) : (
                  <TablaDespachos
                    rows={aprobadasPorBodega}
                    onVer={(p) => setDetalle(p)}
                  />
                )}
              </Section>

              <Section
                title="Historial reciente"
                badge={`${entregadas.length + canceladas.length}`}
                subtitle="Entregadas y canceladas"
              >
                {entregadas.length + canceladas.length === 0 ? (
                  <EmptyState message="Aún no hay solicitudes resueltas." muted />
                ) : (
                  <TablaDespachos
                    rows={[...entregadas, ...canceladas].sort((a, b) => {
                      const ta =
                        a.aprobadaAt
                          ? new Date(a.aprobadaAt).getTime()
                          : a.canceladaAt
                            ? new Date(a.canceladaAt).getTime()
                            : 0
                      const tb =
                        b.aprobadaAt
                          ? new Date(b.aprobadaAt).getTime()
                          : b.canceladaAt
                            ? new Date(b.canceladaAt).getTime()
                            : 0
                      return tb - ta
                    })}
                    onVer={(p) => setDetalle(p)}
                  />
                )}
              </Section>
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
                disabled={false}
              />
            </>
          )}
            </>
          ) : (
            /* ── Tab: Solicitudes de proyectos (PSB-YYYY-NNNN) ─ */
            <SolicitudesDeProyectosTab
              state={solicitudesState}
              estadoFiltro={solEstadoFiltro}
              onEstadoFiltroChange={(v) => {
                setSolEstadoFiltro(v)
                setSolPage(1)
              }}
              onAccion={(id) => setSolAccionId(id)}
              onRecargar={cargarSolicitudes}
            >
              {solicitudesState.status === 'listo' && (
                <Pagination
                  page={solPage}
                  totalPages={solicitudesState.totalPages}
                  total={solicitudesState.total}
                  pageSize={solPageSize}
                  onChange={setSolPage}
                  onPageSizeChange={(s) => {
                    setSolPageSize(s)
                    setSolPage(1)
                  }}
                  disabled={false}
                />
              )}
            </SolicitudesDeProyectosTab>
          )}
        </div>
      </div>

      {accion && (
        <AccionOrdenModal
          pedido={accion}
          onClose={() => setAccion(null)}
          onResolved={recargar}
        />
      )}
      {detalle && (
        <OrdenDetalleModal
          pedido={detalle}
          onClose={() => setDetalle(null)}
          onResolver={() => {
            const p = detalle
            setDetalle(null)
            setAccion(p)
          }}
        />
      )}
      {solAccionId && (
        <AccionSolicitudProyectoModal
          open
          solicitudId={solAccionId}
          onClose={() => setSolAccionId(null)}
          onResolved={() => {
            cargarSolicitudes()
          }}
        />
      )}
    </div>
  )
}

function TablaDespachos({
  rows,
  onAccion,
  onVer,
}: {
  rows: PedidoListItem[]
  onAccion?: (p: PedidoListItem) => void
  onVer: (p: PedidoListItem) => void
}) {
  return (
    <>
      {/* MOBILE: lista compacta (Código / Estado / Revisión) → tap = modal detalle.
          La acción contextual (Resolver / Ver) está en el footer del modal,
          no inline en la fila, para mantenerla limpia. */}
      <ul className="sm:hidden divide-y divide-border">
        {rows.map((o) => (
          <li key={o.id}>
            <button
              type="button"
              onClick={() => onVer(o)}
              className="w-full text-left px-4 py-3.5 hover:bg-muted/30 active:bg-muted/50 transition-colors flex items-center gap-3 min-h-[60px]"
            >
              <div className="min-w-0 flex-1">
                <div
                  className="text-sm text-primary truncate"
                  style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 500 }}
                >
                  {o.codigo}
                </div>
                <div className="mt-1.5 flex items-center gap-2 flex-wrap">
                  <EstadoBadge estado={o.estadoNombre} />
                  <RevisionBadge estado={o.revisionEstado} />
                </div>
              </div>
              <ChevronRight size={18} className="text-muted-foreground shrink-0" />
            </button>
          </li>
        ))}
      </ul>

      {/* DESKTOP: tabla completa intacta */}
      <div className="hidden sm:block overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr
              className="border-b border-border bg-muted/30"
              style={{ fontFamily: "'JetBrains Mono', monospace" }}
            >
              <Th>Código</Th>
              <Th>Productos</Th>
              <Th>Motivo</Th>
              <Th>Estado</Th>
              <Th>Revisión</Th>
              <Th>Enviada</Th>
              <Th className="text-right">Acción</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((o) => (
              <tr
                key={o.id}
                onClick={() => onVer(o)}
                className="border-b border-border last:border-b-0 hover:bg-muted/30 cursor-pointer transition-colors"
              >
                <Td>
                  <span
                    className="text-primary"
                    style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 500 }}
                  >
                    {o.codigo}
                  </span>
                </Td>
                <Td>
                  <div className="text-sm text-foreground">
                    {o.items.length === 1 ? '1 ítem' : `${o.items.length} ítems`}
                  </div>
                </Td>
                <Td>
                  <span className="text-sm text-muted-foreground">{o.motivo || '—'}</span>
                </Td>
                <Td>
                  <EstadoBadge estado={o.estadoNombre} />
                </Td>
                <Td>
                  <RevisionBadge estado={o.revisionEstado} />
                </Td>
                <Td>
                  <span
                    className="text-xs text-muted-foreground"
                    style={{ fontFamily: "'JetBrains Mono', monospace" }}
                  >
                    {o.createdAtLabel}
                  </span>
                </Td>
                <Td>
                  <div className="flex justify-end" onClick={(e) => e.stopPropagation()}>
                    {onAccion ? (
                      <button
                        onClick={() => onAccion(o)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 bg-primary text-primary-foreground text-xs hover:bg-primary/90 transition-colors"
                        style={{ borderRadius: '0.25rem' }}
                      >
                        <PackageOpen size={13} />
                        Resolver
                      </button>
                    ) : (
                      <button
                        onClick={() => onVer(o)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 border border-border text-xs text-foreground hover:border-foreground/30 transition-colors"
                        style={{ borderRadius: '0.25rem' }}
                      >
                        Ver
                      </button>
                    )}
                  </div>
                </Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}

function Section({
  title,
  badge,
  subtitle,
  children,
}: {
  title: string
  badge?: string
  subtitle?: string
  children: React.ReactNode
}) {
  return (
    <div
      className="bg-card border border-border"
      style={{ borderRadius: '0.25rem' }}
    >
      <div className="flex items-center justify-between p-4 border-b border-border">
        <h2
          className="text-lg uppercase text-foreground"
          style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800 }}
        >
          {title}
        </h2>
        <div className="flex items-center gap-3">
          {subtitle && (
            <span
              className="text-[10px] text-muted-foreground tracking-widest uppercase"
              style={{ fontFamily: "'JetBrains Mono', monospace" }}
            >
              {subtitle}
            </span>
          )}
          {badge && (
            <span
              className="text-[10px] px-2 py-0.5 border border-border text-foreground bg-muted"
              style={{
                borderRadius: '0.15rem',
                fontFamily: "'JetBrains Mono', monospace",
                fontWeight: 500,
              }}
            >
              {badge}
            </span>
          )}
        </div>
      </div>
      {children}
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

function EstadoBadge({ estado }: { estado: EstadoPedido }) {
  const style =
    estado === 'Pendiente'
      ? 'border-primary/40 text-primary bg-primary/10'
      : estado === 'AprobadoPorBodega'
        ? 'border-secondary/40 text-secondary bg-secondary/10'
        : estado === 'Entregado'
          ? 'border-foreground/30 text-foreground bg-muted/40'
          : 'border-muted text-muted-foreground bg-muted/30'
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 text-[10px] border ${style}`}
      style={{
        borderRadius: '0.15rem',
        fontFamily: "'JetBrains Mono', monospace",
        fontWeight: 500,
        letterSpacing: '0.05em',
      }}
    >
      {estado === 'AprobadoPorBodega' ? 'APROBADO (BODEGA)' : estado.toUpperCase()}
    </span>
  )
}

function RevisionBadge({ estado }: { estado: EstadoRevision | undefined }) {
  if (!estado || estado === 'no_aplica') {
    return (
      <span
        className="inline-flex items-center px-2 py-0.5 text-[10px] text-muted-foreground"
        style={{ fontFamily: "'JetBrains Mono', monospace" }}
      >
        —
      </span>
    )
  }
  if (estado === 'pendiente') {
    return (
      <span
        className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] border border-primary/40 text-primary bg-primary/10"
        style={{
          borderRadius: '0.15rem',
          fontFamily: "'JetBrains Mono', monospace",
          fontWeight: 500,
        }}
      >
        <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
        PENDIENTE
      </span>
    )
  }
  if (estado === 'aprobado') {
    return (
      <span
        className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] border border-secondary/40 text-secondary bg-secondary/10"
        style={{
          borderRadius: '0.15rem',
          fontFamily: "'JetBrains Mono', monospace",
          fontWeight: 500,
        }}
      >
        APROBADO
      </span>
    )
  }
  if (estado === 'mixto') {
    return (
      <span
        className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] border border-amber-500/40 text-amber-500 bg-amber-500/10"
        style={{
          borderRadius: '0.15rem',
          fontFamily: "'JetBrains Mono', monospace",
          fontWeight: 500,
        }}
      >
        PARCIAL
      </span>
    )
  }
  if (estado === 'saltado') {
    return (
      <span
        className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] border border-muted-foreground/40 text-muted-foreground bg-muted/30"
        style={{
          borderRadius: '0.15rem',
          fontFamily: "'JetBrains Mono', monospace",
          fontWeight: 500,
        }}
      >
        SALTADO
      </span>
    )
  }
  return null
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

function EmptyState({ message, muted }: { message: string; muted?: boolean }) {
  return (
    <div className="py-16 px-6 flex flex-col items-center justify-center text-center">
      <div className="w-12 h-12 bg-muted flex items-center justify-center mb-4">
        <Inbox size={20} className="text-muted-foreground" />
      </div>
      <p
        className={`text-sm max-w-sm ${muted ? 'text-muted-foreground' : 'text-foreground'}`}
        style={{ fontFamily: "'DM Sans', sans-serif" }}
      >
        {message}
      </p>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
//  SolicitudesDeProyectosTab
//
//  Lista las solicitudes a bodega generadas desde un proyecto
//  (PSB-YYYY-NNNN). Mismo panel que las Solicitudes generales
//  pero con su propio filtro de estado y su propio modal de acción.
// ─────────────────────────────────────────────────────────────

import type { SolicitudListItem as SolListItem } from './proyectos/types'

type SolicitudesState =
  | { status: 'idle' }
  | { status: 'cargando' }
  | {
      status: 'listo'
      solicitudes: SolListItem[]
      total: number
      page: number
      pageSize: number
      totalPages: number
    }
  | { status: 'error'; mensaje: string }

function SolicitudesDeProyectosTab({
  state,
  estadoFiltro,
  onEstadoFiltroChange,
  onAccion,
  onRecargar,
  children,
}: {
  state: SolicitudesState
  estadoFiltro: '' | 'pendiente' | 'aprobada' | 'rechazada' | 'entregada'
  onEstadoFiltroChange: (v: '' | 'pendiente' | 'aprobada' | 'rechazada' | 'entregada') => void
  onAccion: (id: string) => void
  onRecargar: () => void
  children: React.ReactNode
}) {
  return (
    <div className="space-y-4">
      {/* Filtros */}
      <div className="flex items-center gap-2 flex-wrap">
        <span
          className="text-[10px] text-muted-foreground tracking-widest uppercase"
          style={{ fontFamily: "'JetBrains Mono', monospace" }}
        >
          Estado:
        </span>
        {(
          [
            { v: '', label: 'Todos' },
            { v: 'pendiente', label: 'Pendiente' },
            { v: 'aprobada', label: 'Aprobada' },
            { v: 'entregada', label: 'Entregada' },
            { v: 'rechazada', label: 'Rechazada' },
          ] as const
        ).map((opt) => {
          const activo = estadoFiltro === opt.v
          return (
            <button
              key={opt.v}
              type="button"
              onClick={() => onEstadoFiltroChange(opt.v)}
              className={[
                'px-2.5 py-1 text-[10px] uppercase tracking-wider border transition-colors',
                activo
                  ? 'bg-foreground text-background border-foreground'
                  : 'bg-background text-muted-foreground border-border hover:border-foreground/40',
              ].join(' ')}
              style={{ borderRadius: '0.15rem', fontFamily: "'JetBrains Mono', monospace" }}
            >
              {opt.label}
            </button>
          )
        })}
      </div>

      {state.status === 'cargando' || state.status === 'idle' ? (
        <div className="bg-card border border-border p-10 flex flex-col items-center justify-center text-center">
          <Loader2 size={22} className="text-muted-foreground animate-spin" />
          <p
            className="mt-3 text-sm text-muted-foreground"
            style={{ fontFamily: "'DM Sans', sans-serif" }}
          >
            Cargando solicitudes de proyectos…
          </p>
        </div>
      ) : state.status === 'error' ? (
        <div className="bg-card border border-border p-10 flex flex-col items-center justify-center text-center">
          <p
            className="text-sm text-primary"
            style={{ fontFamily: "'JetBrains Mono', monospace" }}
          >
            ⚠ {state.mensaje}
          </p>
          <button
            onClick={onRecargar}
            className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 border border-border text-xs text-foreground hover:border-primary/40 transition-colors"
            style={{ borderRadius: '0.25rem' }}
          >
            Reintentar
          </button>
        </div>
      ) : state.solicitudes.length === 0 ? (
        <div className="bg-card border border-border p-10 flex flex-col items-center justify-center text-center">
          <div className="w-12 h-12 bg-muted flex items-center justify-center mb-4">
            <Inbox size={20} className="text-muted-foreground" />
          </div>
          <p
            className="text-sm max-w-md text-muted-foreground"
            style={{ fontFamily: "'DM Sans', sans-serif" }}
          >
            No hay solicitudes a bodega generadas desde proyectos.
            Cuando un técnico pida productos a bodega desde un proyecto,
            aparecerán acá.
          </p>
        </div>
      ) : (
        <>
          <div
            className="bg-card border border-border overflow-hidden"
            style={{ borderRadius: '0.25rem' }}
          >
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead>
                  <tr
                    className="border-b border-border bg-muted/30"
                    style={{ fontFamily: "'JetBrains Mono', monospace" }}
                  >
                    <th className="px-4 py-3 text-[10px] text-muted-foreground tracking-widest uppercase font-normal text-left">
                      Código
                    </th>
                    <th className="px-4 py-3 text-[10px] text-muted-foreground tracking-widest uppercase font-normal text-left">
                      Proyecto
                    </th>
                    <th className="px-4 py-3 text-[10px] text-muted-foreground tracking-widest uppercase font-normal text-left">
                      Solicitado por
                    </th>
                    <th className="px-4 py-3 text-[10px] text-muted-foreground tracking-widest uppercase font-normal text-left">
                      Estado
                    </th>
                    <th className="px-4 py-3 text-[10px] text-muted-foreground tracking-widest uppercase font-normal text-right">
                      Items
                    </th>
                    <th className="px-4 py-3 text-[10px] text-muted-foreground tracking-widest uppercase font-normal text-left">
                      Fecha
                    </th>
                    <th className="px-4 py-3 text-[10px] text-muted-foreground tracking-widest uppercase font-normal text-right">
                      Acción
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {state.solicitudes.map((s) => (
                    <tr
                      key={s.id}
                      className="border-b border-border last:border-b-0 hover:bg-muted/30 transition-colors"
                    >
                      <td className="px-4 py-3">
                        <span
                          className="text-primary"
                          style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 500 }}
                        >
                          {s.codigo}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-foreground">
                          {s.proyecto.nombreProyecto}
                        </div>
                        <div
                          className="text-[10px] text-muted-foreground tracking-widest"
                          style={{ fontFamily: "'JetBrains Mono', monospace" }}
                        >
                          {s.proyecto.codigo}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {s.solicitadoPor.nombre}
                      </td>
                      <td className="px-4 py-3">
                        <SolEstadoBadge estado={s.estado} />
                      </td>
                      <td className="px-4 py-3 text-right text-muted-foreground" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                        {s.totalItems}
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                        {new Date(s.fechaSolicitud).toLocaleString('es-CO', {
                          dateStyle: 'short',
                          timeStyle: 'short',
                        })}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => onAccion(s.id)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 bg-primary text-primary-foreground text-xs hover:bg-primary/90 transition-colors"
                          style={{ borderRadius: '0.25rem' }}
                        >
                          <PackageOpen size={13} />
                          Resolver
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile */}
            <ul className="sm:hidden divide-y divide-border">
              {state.solicitudes.map((s) => (
                <li key={s.id}>
                  <button
                    type="button"
                    onClick={() => onAccion(s.id)}
                    className="w-full text-left px-4 py-3.5 hover:bg-muted/30 active:bg-muted/50 transition-colors flex items-center gap-3 min-h-[60px]"
                  >
                    <div className="min-w-0 flex-1">
                      <div
                        className="text-sm text-primary truncate"
                        style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 500 }}
                      >
                        {s.codigo}
                      </div>
                      <div className="text-xs text-foreground truncate mt-0.5">
                        {s.proyecto.nombreProyecto}
                      </div>
                      <div className="mt-1.5">
                        <SolEstadoBadge estado={s.estado} />
                      </div>
                    </div>
                    <ChevronRight size={18} className="text-muted-foreground shrink-0" />
                  </button>
                </li>
              ))}
            </ul>
          </div>
          {children}
        </>
      )}
    </div>
  )
}

function SolEstadoBadge({ estado }: { estado: 'pendiente' | 'aprobada' | 'rechazada' | 'entregada' }) {
  const map: Record<typeof estado, { color: string; label: string }> = {
    pendiente: { color: '#eab308', label: 'PENDIENTE' },
    aprobada: { color: '#3b82f6', label: 'APROBADA' },
    rechazada: { color: '#ef4444', label: 'RECHAZADA' },
    entregada: { color: '#22c55e', label: 'ENTREGADA' },
  }
  const m = map[estado]
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 text-[10px] text-white"
      style={{
        backgroundColor: m.color,
        borderRadius: '0.15rem',
        fontFamily: "'JetBrains Mono', monospace",
        fontWeight: 500,
        letterSpacing: '0.05em',
      }}
    >
      {m.label}
    </span>
  )
}
