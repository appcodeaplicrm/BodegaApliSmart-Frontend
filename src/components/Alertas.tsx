import { useEffect, useState } from 'react'
import {
  AlertTriangle,
  CircleAlert,
  CircleCheck,
  Package,
  RefreshCcw,
  Loader2,
  Filter,
} from 'lucide-react'
import { alertasStore, useAlertas, type AlertaStock, type NivelAlerta } from '../store/alertas'
import { useBodegaActiva } from '../store/bodegaActiva'
import { useAuth } from '../store/auth'
import { PageHeader } from './PageHeader'

export function Alertas() {
  const auth = useAuth()
  const activaId = useBodegaActiva()
  const state = useAlertas()
  const [filtro, setFiltro] = useState<'todas' | NivelAlerta>('todas')
  const [atendiendoId, setAtendiendoId] = useState<string | null>(null)

  const puedeEditar =
    auth.status === 'autenticado' && auth.sesion.permisos.includes('inventario.editar')

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
  const visibles = filtro === 'todas' ? alertas : alertas.filter((a) => a.nivel === filtro)

  const counts = {
    todas: alertas.length,
    critica: alertas.filter((a) => a.nivel === 'Critica').length,
    advertencia: alertas.filter((a) => a.nivel === 'Advertencia').length,
  }

  async function handleAtender(a: AlertaStock) {
    setAtendiendoId(a.id)
    try {
      await alertasStore.atender(a.id, true)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'No se pudo atender la alerta.')
    } finally {
      setAtendiendoId(null)
    }
  }

  function handleRefresh() {
    if (activaId) void alertasStore.cargar(activaId)
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

      <div className="flex-1 overflow-y-auto p-8 space-y-6">

        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
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
        <div className="flex items-center gap-2 flex-wrap">
          <Filter
            size={14}
            className="text-muted-foreground"
            style={{ marginRight: '4px' }}
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
        </div>

        {/* Lista */}
        {state.status === 'cargando' && alertas.length === 0 ? (
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
                onAtender={() => handleAtender(a)}
              />
            ))}
          </ul>
        )}
      </div>
    </div>
  )
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
  color?: 'default' | 'primary' | 'amber'
}) {
  const colorClass =
    color === 'primary'
      ? 'border-primary/40 bg-primary/10 text-primary'
      : color === 'amber'
        ? 'border-amber-500/40 bg-amber-500/10 text-amber-400'
        : active
          ? 'border-foreground/30 bg-foreground/5 text-foreground'
          : 'border-border text-muted-foreground hover:text-foreground'

  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-2 px-3 py-1.5 border text-xs transition-colors ${colorClass}`}
      style={{ borderRadius: '0.25rem', fontFamily: "'JetBrains Mono', monospace" }}
    >
      {label}
      <span className="text-[10px] opacity-70">{count}</span>
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
