import { useEffect, useRef, useState, type FormEvent } from 'react'
import {
  AlertTriangle,
  CircleAlert,
  CircleCheck,
  Package,
  RefreshCcw,
  Loader2,
  Filter,
  Camera,
  Upload,
  X,
  History,
  Eye,
} from 'lucide-react'
import { alertasStore, useAlertas, type AlertaStock, type NivelAlerta } from '../store/alertas'
import { useBodegaActiva } from '../store/bodegaActiva'
import { useAuth } from '../store/auth'
import { PageHeader } from './PageHeader'
import { Portal } from './Portal'
import { imageUrl } from '../lib/apiBase'
import { useCapturaEvidencia } from '../hooks/useCapturaEvidencia'

export function Alertas() {
  const auth = useAuth()
  const activaId = useBodegaActiva()
  const state = useAlertas()
  const [filtro, setFiltro] = useState<'todas' | NivelAlerta | 'historial'>('todas')
  const [atendiendoId, setAtendiendoId] = useState<string | null>(null)
  const [alertaAAtender, setAlertaAAtender] = useState<AlertaStock | null>(null)
  const [historial, setHistorial] = useState<AlertaStock[]>([])
  const [cargandoHistorial, setCargandoHistorial] = useState(false)
  const [detalleHistorial, setDetalleHistorial] = useState<AlertaStock | null>(null)

  const puedeEditar =
    auth.status === 'autenticado' && auth.sesion.permisos.includes('alertas.editar')
  const puedeVerHistorial =
    auth.status === 'autenticado' && auth.sesion.permisos.includes('alertas.historial.ver')

  // Cargar cuando cambia la bodega activa
  useEffect(() => {
    if (!activaId) return
    const mismatched =
      (state.status === 'listo' && state.bodegaId !== activaId) ||
      (state.status === 'error' && state.bodegaId !== activaId)
    if (state.status === 'idle' || mismatched) {
      void alertasStore.cargar(activaId).catch(() => undefined)
    }
  }, [activaId, state])

  const alertas = state.status === 'listo' ? state.alertas : []
  const visibles = filtro === 'todas'
    ? alertas
    : filtro === 'historial'
      ? []
      : alertas.filter((a) => a.nivel === filtro)

  const counts = {
    todas: alertas.length,
    critica: alertas.filter((a) => a.nivel === 'Critica').length,
    advertencia: alertas.filter((a) => a.nivel === 'Advertencia').length,
  }

  async function handleAtender(a: AlertaStock, cantidad: number, evidencia: File) {
    if (!activaId) throw new Error('Selecciona una bodega antes de atender la alerta.')
    setAtendiendoId(a.id)
    try {
      await alertasStore.atenderConPedido(a.id, activaId, cantidad, evidencia)
      setAlertaAAtender(null)
    } finally {
      setAtendiendoId(null)
    }
  }

  function handleRefresh() {
    if (!activaId) return
    if (filtro === 'historial') void cargarHistorial(activaId)
    else void alertasStore.refetch(activaId)
  }

  async function cargarHistorial(bodegaId = activaId) {
    if (!bodegaId || !puedeVerHistorial) return
    setCargandoHistorial(true)
    try {
      setHistorial(await alertasStore.cargarHistorial(bodegaId))
      setFiltro('historial')
    } finally {
      setCargandoHistorial(false)
    }
  }

  return (
    <div className="flex-1 flex flex-col min-w-0 min-h-0">
      <PageHeader
        title="Alertas"
        subtitle="BodegaApliSmart · STOCK BAJO Y SIN STOCK"
        actions={
          <button
            type="button"
            onClick={handleRefresh}
            disabled={state.status === 'cargando' || !activaId}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-border text-xs text-foreground hover:border-foreground/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ borderRadius: '0.25rem' }}
            aria-label="Refrescar"
          >
            <RefreshCcw
              size={13}
              className={state.status === 'cargando' ? 'animate-spin' : ''}
            />
          </button>
        }
      />

      <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 space-y-6">

        {/* KPIs */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <KpiCard
            icon={AlertTriangle}
            label="Total activas"
            value={counts.todas.toLocaleString('es-CO')}
            color="text-primary"
          />
          <KpiCard
            icon={CircleAlert}
            label="Críticas"
            value={counts.critica.toLocaleString('es-CO')}
            color="text-primary"
          />
          <KpiCard
            icon={AlertTriangle}
            label="Advertencias"
            value={counts.advertencia.toLocaleString('es-CO')}
            color="text-amber-400"
          />
        </div>

        {/* Filtros */}
        <div className="flex flex-wrap items-center gap-2">
          <Filter
            size={14}
            className="text-muted-foreground"
          />
          <FilterChip
            label="Todas"
            active={filtro === 'todas'}
            onClick={() => setFiltro('todas')}
            count={counts.todas}
          />
          <FilterChip
            label="Críticas"
            active={filtro === 'Critica'}
            onClick={() => setFiltro('Critica')}
            count={counts.critica}
            color="primary"
          />
          <FilterChip
            label="Advertencias"
            active={filtro === 'Advertencia'}
            onClick={() => setFiltro('Advertencia')}
            count={counts.advertencia}
            color="amber"
          />
          {puedeVerHistorial && (
            <FilterChip
              label="Historial"
              active={filtro === 'historial'}
              onClick={() => void cargarHistorial()}
              count={historial.length}
              color="history"
            />
          )}
        </div>

        {/* Lista */}
        {filtro === 'historial' ? (
          cargandoHistorial ? (
            <div className="bg-card border border-border py-20 flex justify-center"><Loader2 size={24} className="animate-spin text-secondary" /></div>
          ) : historial.length === 0 ? (
            <div className="bg-card border border-border py-20 text-center text-sm text-muted-foreground">No hay alertas atendidas con evidencia.</div>
          ) : (
            <ul className="space-y-2">
              {historial.map((alerta) => (
                <HistorialAlertaCard key={alerta.id} alerta={alerta} onDetalle={() => setDetalleHistorial(alerta)} />
              ))}
            </ul>
          )
        ) : state.status === 'cargando' && alertas.length === 0 ? (
          <div
            className="bg-card border border-border py-20 px-6 flex flex-col items-center justify-center text-center"
            style={{ borderRadius: '0.25rem' }}
          >
            <Loader2 size={24} className="text-primary animate-spin" />
            <p
              className="mt-3 text-sm text-muted-foreground"
              style={{ fontFamily: "'JetBrains Mono', monospace" }}
            >
              Cargando alertas…
            </p>
          </div>
        ) : state.status === 'error' ? (
          <div
            className="bg-card border border-primary/30 py-12 px-6 flex flex-col items-center text-center"
            style={{ borderRadius: '0.25rem' }}
          >
            <AlertTriangle size={24} className="text-primary" />
            <p className="mt-3 text-sm text-foreground">{state.mensaje}</p>
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
        ) : visibles.length === 0 ? (
          <div
            className="bg-card border border-secondary/30 py-20 px-6 flex flex-col items-center justify-center text-center"
            style={{ borderRadius: '0.25rem' }}
          >
            <div className="w-14 h-14 bg-secondary/15 flex items-center justify-center mb-5">
              <CircleCheck size={24} className="text-secondary" />
            </div>
            <h3
              className="text-xl uppercase text-foreground"
              style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800 }}
            >
              {alertas.length === 0
                ? 'Sin alertas activas'
                : 'No hay alertas en este filtro'}
            </h3>
            <p
              className="mt-2 text-sm text-muted-foreground max-w-sm"
              style={{ fontFamily: "'DM Sans', sans-serif" }}
            >
              {alertas.length === 0
                ? 'Todo el stock está por encima del mínimo en esta bodega.'
                : 'Probá con otro filtro o atendé las que aparecen.'}
            </p>
          </div>
        ) : (
          <ul className="space-y-2">
            {visibles.map((a) => (
              <AlertaCard
                key={a.id}
                alerta={a}
                puedeEditar={puedeEditar}
                atendiendo={atendiendoId === a.id}
                onAtender={() => setAlertaAAtender(a)}
              />
            ))}
          </ul>
        )}
      </div>
      {alertaAAtender && (
        <AtenderAlertaModal
          alerta={alertaAAtender}
          guardando={atendiendoId === alertaAAtender.id}
          onClose={() => !atendiendoId && setAlertaAAtender(null)}
          onConfirm={(cantidad, evidencia) => handleAtender(alertaAAtender, cantidad, evidencia)}
        />
      )}
      {detalleHistorial && (
        <DetalleHistorialModal alerta={detalleHistorial} onClose={() => setDetalleHistorial(null)} />
      )}
    </div>
  )
}

function AtenderAlertaModal({
  alerta,
  guardando,
  onClose,
  onConfirm,
}: {
  alerta: AlertaStock
  guardando: boolean
  onClose: () => void
  onConfirm: (cantidad: number, evidencia: File) => Promise<void>
}) {
  const politicaEvidencia = useCapturaEvidencia()
  const [cantidad, setCantidad] = useState('')
  const proveedorAsignado = alerta.producto.proveedores?.[0]?.proveedor ?? null
  const proveedorId = proveedorAsignado?.id ?? ''
  const [evidencia, setEvidencia] = useState<File | null>(null)
  const cameraInputRef = useRef<HTMLInputElement | null>(null)
  const uploadInputRef = useRef<HTMLInputElement | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [preview, setPreview] = useState<string | null>(null)

  useEffect(() => {
    if (!evidencia) {
      setPreview(null)
      return
    }
    if (!proveedorId) {
      setError('El producto no tiene un proveedor asociado.')
      return
    }
    const url = URL.createObjectURL(evidencia)
    setPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [evidencia])

  useEffect(() => {
    const cerrar = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !guardando) onClose()
    }
    window.addEventListener('keydown', cerrar)
    return () => window.removeEventListener('keydown', cerrar)
  }, [guardando, onClose])

  async function submit(event: FormEvent) {
    event.preventDefault()
    const valor = Number(cantidad)
    if (!Number.isFinite(valor) || valor <= 0) {
      setError('Ingresa una cantidad mayor que cero.')
      return
    }
    if (!evidencia) {
      setError('La foto del pedido al proveedor es obligatoria.')
      return
    }
    setError(null)
    try {
      await onConfirm(valor, evidencia)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo registrar la atención.')
    }
  }

  return (
    <Portal>
      <div
        className="fixed inset-0 z-[100] flex items-end justify-center bg-black/75 backdrop-blur-sm sm:items-center sm:p-4"
        onMouseDown={(event) => event.target === event.currentTarget && !guardando && onClose()}
      >
        <form
          onSubmit={submit}
          className="flex max-h-[94dvh] w-full flex-col overflow-hidden rounded-t-xl border-t border-border bg-card shadow-2xl sm:max-w-xl sm:rounded-none sm:border"
        >
          <div className="flex items-start justify-between border-b border-border p-5 sm:p-6">
            <div>
              <div className="text-[9px] uppercase tracking-[0.18em] text-secondary" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                Reposición de inventario
              </div>
              <h2 className="mt-1 text-2xl uppercase text-foreground" style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900 }}>
                Atender alerta
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">Registra el pedido realizado al proveedor.</p>
            </div>
            <button type="button" onClick={onClose} disabled={guardando} className="p-2 text-muted-foreground hover:text-foreground disabled:opacity-40" aria-label="Cerrar">
              <X size={18} />
            </button>
          </div>

          <div className="space-y-5 overflow-y-auto p-5 sm:p-6">
            <div className="border border-border bg-muted/30 p-4">
              <div className="text-[9px] uppercase tracking-widest text-muted-foreground">Producto</div>
              <div className="mt-1 text-lg font-semibold text-foreground">{alerta.producto.nombre}</div>
              <div className="mt-1 text-xs text-muted-foreground">SKU {alerta.producto.codigo} · {alerta.mensaje}</div>
            </div>

            <label className="block">
              <span className="text-[10px] uppercase tracking-widest text-muted-foreground" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                Unidades solicitadas al proveedor
              </span>
              <input
                type="number"
                min="0.001"
                step="0.001"
                value={cantidad}
                onChange={(event) => setCantidad(event.target.value)}
                placeholder="Ej: 100"
                disabled={guardando}
                className="mt-2 h-11 w-full border border-border bg-background px-3 text-foreground outline-none transition-colors focus:border-secondary disabled:opacity-60"
                autoFocus
              />
            </label>

            <label className="block">
              <span className="text-[10px] uppercase tracking-widest text-muted-foreground" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                Proveedor
              </span>
              {proveedorAsignado ? (
                <div className="mt-2 flex min-h-11 items-center justify-between gap-3 border border-border bg-muted/30 px-3 py-2.5">
                  <div>
                    <div className="text-sm font-medium text-foreground">{proveedorAsignado.nombre}</div>
                    {proveedorAsignado.ruc && <div className="mt-0.5 text-[10px] text-muted-foreground">RUC {proveedorAsignado.ruc}</div>}
                  </div>
                  <span className="shrink-0 text-[9px] uppercase tracking-widest text-secondary">Asignado</span>
                </div>
              ) : (
                <div className="mt-2 border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-400">
                  Este producto no tiene proveedores asociados. Asígnale uno desde su ficha antes de atender la alerta.
                </div>
              )}
            </label>

            <div>
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                Evidencia del pedido · obligatoria
              </div>
              <div className="mt-2 flex min-h-44 flex-col items-center justify-center overflow-hidden border border-dashed border-border bg-background text-center">
                {preview ? (
                  <img src={preview} alt="Evidencia seleccionada" className="max-h-64 w-full object-contain" />
                ) : (
                  <div className="p-8">
                    <div className="mx-auto flex h-11 w-11 items-center justify-center bg-secondary/15 text-secondary"><Camera size={20} /></div>
                    <div className="mt-3 text-sm font-medium text-foreground">Evidencia del pedido</div>
                    <div className="mt-1 text-xs text-muted-foreground">PNG, JPG o WEBP · máximo 10 MB</div>
                  </div>
                )}
              </div>
              <div className="mt-2 flex gap-2">
                <button type="button" disabled={guardando} onClick={() => cameraInputRef.current?.click()} className="min-h-[44px] flex-1 border border-border text-sm inline-flex items-center justify-center gap-2"><Camera size={14} />Tomar foto</button>
                {politicaEvidencia.puedeSubir && <button type="button" disabled={guardando} onClick={() => uploadInputRef.current?.click()} className="min-h-[44px] flex-1 border border-border text-sm inline-flex items-center justify-center gap-2"><Upload size={14} />Subir foto</button>}
                <input
                  ref={cameraInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  capture="environment"
                  className="hidden"
                  disabled={guardando}
                  onChange={(event) => setEvidencia(event.target.files?.[0] ?? null)}
                />
                {politicaEvidencia.puedeSubir && <input ref={uploadInputRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" disabled={guardando} onChange={(event) => setEvidencia(event.target.files?.[0] ?? null)} />}
              </div>
              {evidencia && <div className="mt-2 truncate text-xs text-muted-foreground">{evidencia.name}</div>}
            </div>

            {error && <div className="border border-primary/40 bg-primary/10 p-3 text-sm text-primary">{error}</div>}
          </div>

          <div className="flex shrink-0 gap-3 border-t border-border bg-card p-4 sm:justify-end sm:p-5">
            <button type="button" onClick={onClose} disabled={guardando} className="flex-1 border border-border px-4 py-2.5 text-sm text-foreground disabled:opacity-50 sm:flex-none">
              Cancelar
            </button>
            <button
              type="submit"
              disabled={guardando || !evidencia || !proveedorId || Number(cantidad) <= 0}
              className="inline-flex flex-1 items-center justify-center gap-2 bg-secondary px-4 py-2.5 text-sm font-semibold text-secondary-foreground disabled:cursor-not-allowed disabled:opacity-45 sm:flex-none"
            >
              {guardando ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />}
              {guardando ? 'Registrando…' : 'Confirmar pedido'}
            </button>
          </div>
        </form>
      </div>
    </Portal>
  )
}

function HistorialAlertaCard({ alerta, onDetalle }: { alerta: AlertaStock; onDetalle: () => void }) {
  const fecha = alerta.atendidaAt
    ? new Date(alerta.atendidaAt).toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' })
    : 'Sin fecha registrada'
  return (
    <li className="flex flex-col gap-4 border border-border bg-card p-4 sm:flex-row sm:items-center">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center bg-sky-500/15 text-sky-400"><History size={18} /></div>
      <div className="min-w-0 flex-1">
        <div className="font-semibold text-foreground">{alerta.producto.nombre}</div>
        <div className="mt-1 text-xs text-muted-foreground">
          {alerta.proveedorPedidoNombre ?? 'Proveedor no registrado'} · {Number(alerta.cantidadSolicitada ?? 0).toLocaleString('es-CO', { maximumFractionDigits: 3 })} unidades
        </div>
        <div className="mt-1 text-[10px] text-muted-foreground" style={{ fontFamily: "'JetBrains Mono', monospace" }}>{fecha}</div>
      </div>
      <button type="button" onClick={onDetalle} className="inline-flex items-center justify-center gap-2 border border-border px-3 py-2 text-xs text-foreground hover:border-sky-500/50 hover:text-sky-400">
        <Eye size={13} /> Ver detalle
      </button>
    </li>
  )
}

function DetalleHistorialModal({ alerta, onClose }: { alerta: AlertaStock; onClose: () => void }) {
  const evidenciaUrl = imageUrl(alerta.evidenciaPedidoKey)
  return (
    <Portal>
      <div className="fixed inset-0 z-[110] flex items-end justify-center bg-black/80 backdrop-blur-sm sm:items-center sm:p-4" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
        <div className="flex max-h-[94dvh] w-full flex-col overflow-hidden rounded-t-xl border-t border-border bg-card shadow-2xl sm:max-w-2xl sm:rounded-none sm:border">
          <div className="flex items-start justify-between border-b border-border p-5">
            <div>
              <div className="text-[9px] uppercase tracking-widest text-sky-400">Alerta atendida</div>
              <h2 className="mt-1 text-2xl uppercase text-foreground" style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900 }}>Detalle de reposición</h2>
            </div>
            <button type="button" onClick={onClose} className="p-2 text-muted-foreground hover:text-foreground"><X size={18} /></button>
          </div>
          <div className="grid gap-5 overflow-y-auto p-5 sm:grid-cols-2 sm:p-6">
            <div className="space-y-4">
              <DetalleDato label="Producto" valor={alerta.producto.nombre} />
              <DetalleDato label="SKU" valor={alerta.producto.codigo} />
              <DetalleDato label="Proveedor" valor={alerta.proveedorPedidoNombre ?? 'No registrado'} />
              <DetalleDato label="Cantidad solicitada" valor={`${Number(alerta.cantidadSolicitada ?? 0).toLocaleString('es-CO', { maximumFractionDigits: 3 })} unidades`} />
              <DetalleDato label="Bodega" valor={alerta.bodega.nombre} />
              <DetalleDato label="Fecha de atención" valor={alerta.atendidaAt ? new Date(alerta.atendidaAt).toLocaleString('es-CO', { dateStyle: 'long', timeStyle: 'short' }) : 'No registrada'} />
            </div>
            <div>
              <div className="text-[9px] uppercase tracking-widest text-muted-foreground">Evidencia del pedido</div>
              {evidenciaUrl ? (
                <a href={evidenciaUrl} target="_blank" rel="noreferrer" className="mt-2 block overflow-hidden border border-border bg-background">
                  <img src={evidenciaUrl} alt="Evidencia del pedido al proveedor" className="max-h-96 w-full object-contain" />
                </a>
              ) : (
                <div className="mt-2 border border-border p-8 text-center text-sm text-muted-foreground">Sin evidencia disponible</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </Portal>
  )
}

function DetalleDato({ label, valor }: { label: string; valor: string }) {
  return <div><div className="text-[9px] uppercase tracking-widest text-muted-foreground">{label}</div><div className="mt-1 text-sm text-foreground">{valor}</div></div>
}

function KpiCard({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: typeof AlertTriangle
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

function FilterChip({
  label,
  active,
  onClick,
  count,
  color = 'default',
}: {
  label: string
  active: boolean
  onClick: () => void
  count: number
  color?: 'default' | 'primary' | 'amber' | 'history'
}) {
  const colorClass =
    color === 'primary'
      ? 'border-primary/40 bg-primary/10 text-primary'
      : color === 'amber'
        ? 'border-amber-500/40 bg-amber-500/10 text-amber-400'
        : color === 'history'
          ? 'border-sky-500/40 bg-sky-500/10 text-sky-400'
        : active
          ? 'border-foreground/30 bg-foreground/5 text-foreground'
          : 'border-border text-muted-foreground hover:text-foreground'

  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex min-w-0 items-center justify-center gap-1 border px-2 py-2 text-[10px] transition-colors sm:gap-2 sm:px-3 sm:py-1.5 sm:text-xs ${colorClass}`}
      style={{ borderRadius: '0.25rem', fontFamily: "'JetBrains Mono', monospace" }}
    >
      {label}
      <span className="shrink-0 text-[9px] opacity-70 sm:text-[10px]">{count}</span>
    </button>
  )
}

function AlertaCard({
  alerta,
  puedeEditar,
  atendiendo,
  onAtender,
}: {
  alerta: AlertaStock
  puedeEditar: boolean
  atendiendo: boolean
  onAtender: () => void
}) {
  const fecha = new Date(alerta.createdAt).toLocaleDateString('es-CO', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })

  return (
    <li
      className="bg-card border border-border p-4"
      style={{ borderRadius: '0.25rem' }}
    >
      <div className="flex items-start gap-4">
        <div
          className={`w-10 h-10 flex items-center justify-center shrink-0 ${
            alerta.nivel === 'Critica' ? 'bg-primary/15' : 'bg-amber-500/15'
          }`}
          style={{ borderRadius: '0.25rem' }}
        >
          {alerta.nivel === 'Critica' ? (
            <CircleAlert size={18} className="text-primary" />
          ) : (
            <AlertTriangle size={18} className="text-amber-400" />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 flex-wrap">
            <div className="min-w-0">
              <div
                className="text-sm text-foreground"
                style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800 }}
              >
                {alerta.producto.nombre}
              </div>
              <div
                className="text-[10px] text-muted-foreground flex items-center gap-2 mt-0.5"
                style={{ fontFamily: "'JetBrains Mono', monospace" }}
              >
                <Package size={10} />
                {alerta.producto.codigo ?? 'sin código'}
                <span>·</span>
                {fecha}
              </div>
            </div>

            <span
              className={`text-[9px] uppercase tracking-widest px-2 py-0.5 border shrink-0 ${
                alerta.nivel === 'Critica'
                  ? 'text-primary border-primary/30 bg-primary/5'
                  : 'text-amber-400 border-amber-500/30 bg-amber-500/5'
              }`}
              style={{ borderRadius: '0.125rem', fontFamily: "'JetBrains Mono', monospace" }}
            >
              {alerta.nivel}
            </span>
          </div>

          <p
            className="mt-2 text-sm text-foreground"
            style={{ fontFamily: "'DM Sans', sans-serif" }}
          >
            {alerta.mensaje}
          </p>
        </div>

        {puedeEditar && (
          <button
            type="button"
            onClick={onAtender}
            disabled={atendiendo}
            className="inline-flex items-center gap-2 px-3 py-2 bg-secondary text-secondary-foreground text-xs font-semibold hover:bg-secondary/90 transition-colors disabled:opacity-60 disabled:cursor-not-allowed shrink-0"
            style={{ borderRadius: '0.25rem' }}
          >
            {atendiendo ? (
              <>
                <Loader2 size={13} className="animate-spin" />
                Atendiendo
              </>
            ) : (
              <>
                <CircleCheck size={13} />
                Atender
              </>
            )}
          </button>
        )}
      </div>
    </li>
  )
}
