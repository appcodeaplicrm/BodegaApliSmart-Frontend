import { useEffect, useMemo, useState, useCallback } from 'react'
import {
  ClipboardList,
  Plus,
  Inbox,
  Loader2,
  Eye,
  XCircle,
  Send,
  Lock,
  ChevronRight,
  FileCheck2,
} from 'lucide-react'
import { useAuth } from '../store/auth'
import { useBodegaActiva } from '../store/bodegaActiva'
import {
  usePedidos,
  pedidosStore,
  type PedidoListItem,
  type EstadoPedido,
  type Pedido,
  type EstadoRevision,
} from '../store/pedidos'
import { CrearOrdenModal } from './CrearOrdenModal'
import { OrdenDetalleModal } from './OrdenDetalleModal'
import { AccionOrdenModal } from './AccionOrdenModal'
import { WizardAprobacion, itemsParaWizard } from './WizardAprobacion'
import { Pagination } from './Pagination'
import { PageHeader } from './PageHeader'
import { Modal } from './Modal'
import { ReporteUsoModal } from './ReporteUsoModal'

type TabKey = 'TODAS' | EstadoPedido

const tabs: { key: TabKey; label: string }[] = [
  { key: 'TODAS', label: 'Todas' },
  { key: 'Pendiente', label: 'Pendiente' },
  { key: 'AprobadoPorBodega', label: 'Aprobado (Bodega)' },
  { key: 'Entregado', label: 'Entregado' },
  { key: 'Cancelado', label: 'Cancelado' },
]

const DEFAULT_PAGE_SIZE = 10

/**
 * Pantalla "Mis Solicitudes" (vista del OPERADOR / TÉCNICO).
 *
 * Bandeja del operador: ve solo SUS solicitudes. NO tiene acceso a
 * "Despachos" (eso es del bodeguero/admin), así que acá es donde
 * confirma la "Revisión" cuando el bodeguero aprobó su pedido.
 *
 * Header de la tabla:
 *   Código | Productos | Motivo | Estado (bodega) | Revisión (por ti) | Enviada
 *
 * Acciones:
 *   - Pendiente + dueño       → "Cancelar"
 *   - AprobadoPorBodega + dueño → "Revisar" (abre wizard de técnico)
 *   - Cualquier otro estado   → "Ver"
 */
export function Ordenes() {
  const auth = useAuth()
  const bodegaId = useBodegaActiva()
  const pedidosState = usePedidos()

  const [open, setOpen] = useState(false)
  const [detalle, setDetalle] = useState<PedidoListItem | null>(null)
  const [tab, setTab] = useState<TabKey>('TODAS')

  // Modales
  const [accionCancel, setAccionCancel] = useState<PedidoListItem | null>(null)
  const [wizardTecnico, setWizardTecnico] = useState<PedidoListItem | null>(null)
  const [pedidoCompletoTecnico, setPedidoCompletoTecnico] = useState<Pedido | null>(null)
  const [cargandoTecnico, setCargandoTecnico] = useState(false)
  const [reportePedido, setReportePedido] = useState<Pedido | null>(null)
  const [cargandoReporte, setCargandoReporte] = useState(false)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE)

  const usuarioId = auth.status === 'autenticado' ? auth.sesion.usuario.id : null
  const usuarioNombre = auth.status === 'autenticado' ? auth.sesion.usuario.nombre : '—'
  const usuarioRol = auth.status === 'autenticado' ? auth.sesion.usuario.rol : '—'

  const abrirReporte = useCallback(async (pedido: PedidoListItem) => {
    setCargandoReporte(true)
    try {
      setReportePedido(await pedidosStore.findOne(pedido.id))
    } finally {
      setCargandoReporte(false)
    }
  }, [])

  const cargar = useCallback(() => {
    if (!bodegaId || !usuarioId) return
    void pedidosStore
      .cargarPaginado({
        bodegaId,
        // El back filtra por operadorId para que la paginación traiga
        // solo los pedidos del usuario actual (importante con paginación
        // porque un filtro local sobre la página actual podría ocultar
        // pedidos en otras páginas).
        operadorId: usuarioId,
        page,
        pageSize,
      })
      .catch(() => undefined)
  }, [bodegaId, usuarioId, page, pageSize])

  // Carga inicial cuando cambia la bodega activa, el usuario o el pageSize
  useEffect(() => {
    if (!bodegaId || !usuarioId) return
    setPage(1)
    void pedidosStore
      .cargarPaginado({
        bodegaId,
        operadorId: usuarioId,
        page: 1,
        pageSize,
      })
      .catch(() => undefined)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bodegaId, usuarioId, pageSize])

  // Cuando cambia la página, refetch
  useEffect(() => {
    if (!bodegaId || !usuarioId) return
    if (pedidosState.status === 'idle') return
    cargar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page])

  // Reset a página 1 cuando cambia el tab (los counts cambian)
  useEffect(() => {
    setPage(1)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab])

  const todas = pedidosState.status === 'listo' ? pedidosState.pedidos : []
  const total = pedidosState.status === 'listo' ? pedidosState.total : 0
  const totalPages = pedidosState.status === 'listo' ? pedidosState.totalPages : 0

  /**
   * Como el back ya filtra por `operadorId` en la query, `todas` viene
   * solo con los pedidos del usuario actual. El filtro por `tab` se
   * aplica localmente sobre la página actual (es un subset, no afecta
   * la paginación).
   */
  const filtradas = useMemo(
    () => (tab === 'TODAS' ? todas : todas.filter((o) => o.estadoNombre === tab)),
    [todas, tab],
  )

  function recargar() {
    cargar()
  }

  async function abrirWizardTecnico(p: PedidoListItem) {
    setCargandoTecnico(true)
    try {
      const full = await pedidosStore.findOne(p.id)
      setPedidoCompletoTecnico(full)
      setWizardTecnico(p)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'No se pudo cargar el pedido.'
      console.error(msg)
    } finally {
      setCargandoTecnico(false)
    }
  }

  function cerrarWizardTecnico() {
    setWizardTecnico(null)
    setPedidoCompletoTecnico(null)
  }

  return (
    <div className="flex-1 flex flex-col min-w-0 min-h-0">
      <PageHeader
        title="Mis Solicitudes"
        subtitle={`BodegaApliSmart · ${usuarioRol.toUpperCase()}`}
        actions={
          <button
            onClick={() => setOpen(true)}
            className="hidden lg:inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground text-xs font-medium hover:opacity-90 transition-opacity"
            style={{ borderRadius: '0.25rem' }}
          >
            <Plus size={13} />
            Nueva Solicitud
          </button>
        }
      />

      <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 space-y-4 sm:space-y-6">

          {/* Stats — usan `total` del back (que ya filtra por operador)
              y cuentan los estados sobre la página actual. */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatTile label="Total" value={String(total)} accent="text-foreground" />
            <StatTile
              label="Pendientes"
              value={String(todas.filter((o) => o.estadoNombre === 'Pendiente').length)}
              accent="text-primary"
            />
            <StatTile
              label="Por revisar"
              value={String(
                todas.filter((o) => o.estadoNombre === 'AprobadoPorBodega').length,
              )}
              accent="text-secondary"
            />
            <StatTile
              label="Entregadas"
              value={String(todas.filter((o) => o.estadoNombre === 'Entregado').length)}
              accent="text-foreground"
            />
          </div>

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

          {/* Mobile: botón "+ Nueva Solicitud" full-width (el header no se ve en mobile) */}
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="lg:hidden w-full min-h-[44px] inline-flex items-center justify-center gap-2 bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 active:opacity-80 transition-opacity"
            style={{ borderRadius: '0.25rem' }}
          >
            <Plus size={16} />
            Nueva Solicitud
          </button>

          {/* Tabla */}
          <div
            className="bg-card border border-border overflow-hidden"
            style={{ borderRadius: '0.25rem' }}
          >
            {pedidosState.status === 'cargando' || pedidosState.status === 'idle' ? (
              <div className="py-20 px-6 flex flex-col items-center justify-center text-center">
                <Loader2 size={24} className="text-muted-foreground animate-spin" />
                <p
                  className="mt-3 text-sm text-muted-foreground"
                  style={{ fontFamily: "'DM Sans', sans-serif" }}
                >
                  Cargando solicitudes…
                </p>
              </div>
            ) : pedidosState.status === 'error' ? (
              <div className="py-20 px-6 flex flex-col items-center justify-center text-center">
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
            ) : filtradas.length === 0 ? (
              <div className="py-20 px-6 flex flex-col items-center justify-center text-center">
                <div className="w-14 h-14 bg-muted flex items-center justify-center mb-5">
                  <Inbox size={24} className="text-muted-foreground" />
                </div>
                <h3
                  className="text-xl uppercase text-foreground"
                  style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800 }}
                >
                  {tab === 'TODAS' ? 'Sin solicitudes' : 'Nada en este estado'}
                </h3>
                <p
                  className="mt-2 text-sm text-muted-foreground max-w-sm"
                  style={{ fontFamily: "'DM Sans', sans-serif" }}
                >
                  {tab === 'TODAS'
                    ? 'Cuando envíes una solicitud, aparecerá acá.'
                    : `No tenés solicitudes en estado ${tab.toLowerCase()}.`}
                </p>
                {tab === 'TODAS' && (
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
              <>
                {/* MOBILE: lista compacta (Código / Estado / Revisión) → tap = modal detalle */}
                <ul className="sm:hidden divide-y divide-border">
                  {filtradas.map((o) => (
                    <li key={o.id}>
                      <button
                        type="button"
                        onClick={() => setDetalle(o)}
                        className="w-full text-left px-4 py-3.5 hover:bg-muted/30 active:bg-muted/50 transition-colors flex items-center gap-3 min-h-[60px]"
                      >
                        <div className="min-w-0 flex-1">
                          <div
                            className="text-sm text-primary truncate"
                            style={{
                              fontFamily: "'JetBrains Mono', monospace",
                              fontWeight: 500,
                            }}
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
                      {filtradas.map((o) => (
                        <tr
                          key={o.id}
                          onClick={() => setDetalle(o)}
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
                              {o.codigo}
                            </span>
                          </Td>
                          <Td>
                            <div className="text-sm text-foreground">
                              {o.items.length === 1 ? '1 ítem' : `${o.items.length} ítems`}
                            </div>
                          </Td>
                          <Td>
                            <span className="text-sm text-muted-foreground">
                              {o.motivo || '—'}
                            </span>
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
                            <div
                              className="flex justify-end"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <AccionOperador
                                pedido={o}
                                onRevisarTecnico={() => abrirWizardTecnico(o)}
                                onCancelar={() => setAccionCancel(o)}
                                onVer={() => setDetalle(o)}
                                onReporte={() => void abrirReporte(o)}
                              />
                            </div>
                          </Td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
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
              disabled={pedidosState.status === 'cargando'}
            />
          </div>
        </div>

      {open && <CrearOrdenModal onClose={() => setOpen(false)} onCreated={recargar} />}
      {detalle && (
        <OrdenDetalleModal
          pedido={detalle}
          onClose={() => setDetalle(null)}
          onRevisarTecnico={() => {
            setDetalle(null)
            void abrirWizardTecnico(detalle)
          }}
          onCancelar={() => {
            setAccionCancel(detalle)
          }}
        />
      )}

      {accionCancel && (
        <AccionOrdenModal
          pedido={accionCancel}
          onClose={() => setAccionCancel(null)}
          onResolved={recargar}
          soloCancelar
        />
      )}

      {wizardTecnico && pedidoCompletoTecnico && (
        <WizardTecnicoModal
          pedido={wizardTecnico}
          pedidoCompleto={pedidoCompletoTecnico}
          onClose={cerrarWizardTecnico}
          onResolved={() => {
            cerrarWizardTecnico()
            recargar()
          }}
        />
      )}

      {cargandoTecnico && (
        <Modal open onClose={() => {}} title="Cargando" size="sm" dismissOnOverlay={false}>
          <div className="p-6 flex items-center gap-3">
            <Loader2 size={20} className="text-primary animate-spin" />
            <span className="text-foreground">Cargando pedido…</span>
          </div>
        </Modal>
      )}
      {cargandoReporte && (
        <Modal open onClose={() => {}} title="Cargando reporte" size="sm" dismissOnOverlay={false}>
          <div className="p-6 flex items-center gap-3"><Loader2 size={20} className="text-primary animate-spin" /><span>Cargando solicitud…</span></div>
        </Modal>
      )}
      {reportePedido && (
        <ReporteUsoModal
          pedido={reportePedido}
          onClose={() => setReportePedido(null)}
          onCreated={() => void pedidosStore.recargarSilencioso()}
        />
      )}
    </div>
  )
}

function WizardTecnicoModal({
  pedido,
  pedidoCompleto,
  onClose,
  onResolved,
}: {
  pedido: PedidoListItem
  pedidoCompleto: Pedido
  onClose: () => void
  onResolved: () => void
}) {
  const steps = itemsParaWizard(pedidoCompleto, 'tecnico')
  if (steps.length === 0) {
    return (
      <Modal
        open
        onClose={onClose}
        title="Sin items para revisar"
        description={pedido.codigo}
        size="sm"
        footer={
          <div className="flex justify-end">
            <button
              type="button"
              onClick={onClose}
              className="min-h-[44px] px-3 py-2 border border-border text-sm"
              style={{ borderRadius: '0.25rem' }}
            >
              Cerrar
            </button>
          </div>
        }
      >
        <div className="p-5 text-sm text-foreground">
          No hay items pendientes para revisar en este pedido.
        </div>
      </Modal>
    )
  }
  return (
    <WizardAprobacion
      pedido={pedido}
      rol="tecnico"
      items={steps}
      onClose={onClose}
      onResolved={onResolved}
    />
  )
}

function AccionOperador({
  pedido,
  onRevisarTecnico,
  onCancelar,
  onVer,
  onReporte,
}: {
  pedido: PedidoListItem
  onRevisarTecnico: () => void
  onCancelar: () => void
  onVer: () => void
  onReporte: () => void
}) {
  const estado = pedido.estadoNombre

  if (estado === 'AprobadoPorBodega') {
    return (
      <button
        onClick={onRevisarTecnico}
        className="inline-flex items-center gap-1 px-3 py-1.5 bg-secondary text-secondary-foreground text-xs hover:opacity-90 transition-opacity"
        style={{ borderRadius: '0.25rem' }}
      >
        <Send size={13} />
        Revisar
      </button>
    )
  }
  if (estado === 'Pendiente') {
    return (
      <button
        onClick={onCancelar}
        className="inline-flex items-center gap-1 px-3 py-1.5 border border-border text-xs text-foreground hover:border-primary/40 hover:text-primary transition-colors"
        style={{ borderRadius: '0.25rem' }}
      >
        <XCircle size={13} />
        Cancelar
      </button>
    )
  }
  if (estado === 'Entregado' || estado === 'Cancelado') {
    if (estado === 'Entregado') {
      return (
        <button
          onClick={onReporte}
          className="inline-flex items-center gap-1 px-3 py-1.5 border border-primary/50 text-xs text-primary hover:bg-primary/5 transition-colors"
          style={{ borderRadius: '0.25rem' }}
        >
          <FileCheck2 size={13} />
          {pedido.reporteUso ? 'Ver reporte' : 'Subir reporte'}
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
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-1 text-[10px] text-muted-foreground"
      style={{ fontFamily: "'JetBrains Mono', monospace" }}
    >
      <Lock size={11} />
      —
    </span>
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
        APROBADO (POR TI)
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
