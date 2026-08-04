import { useEffect, useMemo, useState, useCallback } from 'react'
import { Truck, Inbox, Loader2, PackageOpen } from 'lucide-react'
import { useAuth } from '../store/auth'
import { useBodegaActiva } from '../store/bodegaActiva'
import {
  usePedidos,
  pedidosStore,
  type PedidoListItem,
  type EstadoPedido,
  type EstadoRevision,
} from '../store/pedidos'
import { AccionOrdenModal } from './AccionOrdenModal'
import { OrdenDetalleModal } from './OrdenDetalleModal'
import { Pagination } from './Pagination'

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
    <>
      <div className="flex-1 flex flex-col min-w-0 min-h-0 overflow-y-auto">
        <div className="p-8 space-y-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 bg-muted flex items-center justify-center shrink-0 mt-1">
                <Truck size={20} className="text-primary" />
              </div>
              <div>
                <h1
                  className="text-4xl uppercase text-foreground leading-none"
                  style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900 }}
                >
                  Despachos
                </h1>
                <p
                  className="mt-1 text-sm text-muted-foreground"
                  style={{ fontFamily: "'DM Sans', sans-serif" }}
                >
                  Bandeja de entradas — resolvé las solicitudes de la bodega
                </p>
                <div
                  className="mt-1 text-[10px] text-muted-foreground tracking-widest uppercase"
                  style={{ fontFamily: "'JetBrains Mono', monospace" }}
                >
                  Rol: {usuarioRol} · {usuarioNombre}
                </div>
              </div>
            </div>
          </div>

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
        <OrdenDetalleModal pedido={detalle} onClose={() => setDetalle(null)} />
      )}
    </>
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
    <div className="overflow-x-auto">
      <table className="w-full">
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
