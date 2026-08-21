import { useEffect, useState } from 'react'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import {
  TrendingUp,
  RefreshCcw,
  ArrowDownToLine,
  ArrowUpFromLine,
  CheckCircle2,
  Clock,
  CircleAlert,
  AlertTriangle,
  Warehouse,
  Package,
  ShoppingCart,
  DollarSign,
  Inbox,
} from 'lucide-react'
import { useBodegaActiva } from '../store/bodegaActiva'
import { useDashboard, dashboardStore, type DashboardResumen } from '../store/dashboard'
import { HeaderNotificationsButton } from './HeaderNotificationsButton'
import { ValorBlur } from '../lib/valorBlur'

const COLORS = ['#E8593F', '#ABF768', '#F5F2EC', '#FFB86F', '#9D7EE8', '#5AC8FA']

export function DashboardView() {
  const activaId = useBodegaActiva()
  const dashState = useDashboard()

  // Extraemos solo lo que nos importa del estado para evitar loops infinitos:
  // el objeto dashState cambia de referencia en cada emit del store, pero
  // los valores escalares (status, bodegaId del resumen) no.
  const status = dashState.status
  const resumenBodegaId = dashState.status === 'listo' ? dashState.bodegaId : null
  const errorBodegaId = dashState.status === 'error' ? dashState.bodegaId : null

  // Cuando cambia la bodega activa, recargar el resumen
  useEffect(() => {
    if (!activaId) return
    const mismatched =
      (status === 'listo' && resumenBodegaId !== activaId) ||
      (status === 'error' && errorBodegaId !== activaId)
    if (status === 'idle' || mismatched) {
      void dashboardStore.cargar(activaId).catch(() => {
        /* el estado 'error' ya se seteó adentro */
      })
    }
  }, [activaId, status, resumenBodegaId, errorBodegaId])

  function handleRefresh() {
    if (activaId) void dashboardStore.refetch(activaId)
  }

  return (
    <div className="flex-1 flex flex-col min-w-0 min-h-0">
      {/* TOPBAR */}
      <header className="hidden lg:flex min-h-14 border-b border-border px-6 items-center justify-between shrink-0 gap-3 flex-wrap">
        <div className="min-w-0 flex-1">
          <h1
            className="text-2xl uppercase text-foreground leading-none"
            style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 500 }}
          >
            Dashboard
          </h1>
          <div
            className="text-[10px] text-muted-foreground uppercase tracking-widest mt-1 truncate"
            style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 500 }}
          >
            {dashState.status === 'listo'
              ? `${dashState.resumen.bodega.nombre} · RESUMEN GENERAL`
              : 'INICIO · RESUMEN GENERAL'}
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3 shrink-0 flex-wrap">
          <button
            type="button"
            onClick={handleRefresh}
            disabled={dashState.status === 'cargando' || !activaId}
            className="inline-flex items-center gap-1.5 min-h-[36px] px-3 py-1.5 border border-border text-xs text-foreground hover:border-foreground/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ borderRadius: '0.25rem', fontFamily: "'JetBrains Mono', monospace" }}
          >
            <RefreshCcw
              size={12}
              className={dashState.status === 'cargando' ? 'animate-spin' : ''}
            />
            ACTUALIZAR
          </button>
          <HeaderNotificationsButton />
        </div>
      </header>

      {/* CONTENIDO */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 min-h-0">
        {dashState.status === 'idle' || dashState.status === 'cargando' ? (
          <DashboardSkeleton />
        ) : dashState.status === 'error' ? (
          <DashboardError mensaje={dashState.mensaje} onRetry={handleRefresh} />
        ) : dashState.status === 'listo' ? (
          <DashboardContenido />
        ) : null}
      </div>
    </div>
  )
}

// ──────────────────────────────────────────────────────────
//  Loading / Error / Contenido
// ──────────────────────────────────────────────────────────

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="h-20 bg-muted border border-border animate-pulse"
            style={{ borderRadius: '0.25rem' }}
          />
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 h-72 bg-muted border border-border animate-pulse" style={{ borderRadius: '0.25rem' }} />
        <div className="h-72 bg-muted border border-border animate-pulse" style={{ borderRadius: '0.25rem' }} />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="h-64 bg-muted border border-border animate-pulse" style={{ borderRadius: '0.25rem' }} />
        <div className="h-64 bg-muted border border-border animate-pulse" style={{ borderRadius: '0.25rem' }} />
        <div className="h-64 bg-muted border border-border animate-pulse" style={{ borderRadius: '0.25rem' }} />
      </div>
    </div>
  )
}

function DashboardError({ mensaje, onRetry }: { mensaje: string; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-4">
      <div className="inline-flex w-14 h-14 bg-primary/15 items-center justify-center">
        <CircleAlert size={24} className="text-primary" />
      </div>
      <div className="text-center max-w-md">
        <h2
          className="text-2xl uppercase text-foreground"
          style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900 }}
        >
          No se pudo cargar el dashboard
        </h2>
        <p
          className="mt-2 text-sm text-muted-foreground"
          style={{ fontFamily: "'DM Sans', sans-serif" }}
        >
          {mensaje}
        </p>
      </div>
      <button
        type="button"
        onClick={onRetry}
        className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors"
        style={{ borderRadius: '0.25rem' }}
      >
        <RefreshCcw size={13} />
        Reintentar
      </button>
    </div>
  )
}

function DashboardContenido() {
  const dash = useDashboard()
  const [vistaValor, setVistaValor] = useState<'dia' | 'mes' | 'anio'>('dia')
  if (dash.status !== 'listo') return null
  const r = dash.resumen
  const valorSalidas = vistaValor === 'dia'
    ? (r.valorSalidasPorDia ?? [])
    : vistaValor === 'mes'
      ? (r.valorSalidasPorMes ?? [])
      : (r.valorSalidasPorAnio ?? [])
  const subtituloValor = vistaValor === 'dia'
    ? 'Últimos 30 días'
    : vistaValor === 'mes'
      ? 'Últimos 12 meses'
      : 'Últimos 5 años'

  return (
    <>
      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <Kpi
          icon={Package}
          color="sky"
          label="Productos"
          value={r.kpis.totalProductos.toLocaleString('es-CO')}
          sub={`${r.kpis.stockTotal.toLocaleString('es-CO')} unidades en stock`}
        />
        <Kpi
          icon={DollarSign}
          color="emerald"
          label="Valor stock"
          value={<ValorBlur value={r.kpis.valorInventario} render={() => formatPesos(r.kpis.valorInventario)} />}
          sub="precio unitario × cantidad"
        />
        <Kpi
          icon={AlertTriangle}
          color="amber"
          label="Stock bajo"
          value={r.kpis.stockBajo.toLocaleString('es-CO')}
          sub="alertas activas"
        />
        <Kpi
          icon={Clock}
          color="violet"
          label="Órdenes pend."
          value={r.kpis.ordenesPendientes.toLocaleString('es-CO')}
          sub={`${r.ordenesPorEstado.aprobado} aprobadas`}
        />
        <Kpi
          icon={ArrowUpFromLine}
          color="primary"
          label="Salidas hoy"
          value={r.kpis.salidasHoy.toLocaleString('es-CO')}
          sub="movimientos del día"
        />
        <Kpi
          icon={ArrowDownToLine}
          color="secondary"
          label="Entradas hoy"
          value={r.kpis.entradasHoy.toLocaleString('es-CO')}
          sub="movimientos del día"
        />
      </div>

      {/* Valor consumido por salidas no retornables */}
      <div className="bg-card border border-border p-5 sm:p-6" style={{ borderRadius: '0.25rem' }}>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <SectionHeader
            title="Valor consumido por salidas"
            subtitle={`${subtituloValor} · excluye productos que admiten devolución`}
          />
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex border border-border p-1">
              {(['dia', 'mes', 'anio'] as const).map((vista) => (
                <button
                  key={vista}
                  type="button"
                  onClick={() => setVistaValor(vista)}
                  className={`px-3 py-1.5 text-[10px] uppercase transition-colors ${vistaValor === vista ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                  style={{ fontFamily: "'JetBrains Mono', monospace" }}
                >
                  {vista === 'dia' ? 'Días' : vista === 'mes' ? 'Meses' : 'Años'}
                </button>
              ))}
            </div>
            <div className="shrink-0 sm:min-w-36 sm:text-right">
              <div className="text-[9px] uppercase tracking-[0.18em] text-muted-foreground" style={{ fontFamily: "'JetBrains Mono', monospace" }}>Total del periodo</div>
              <div className="mt-1 text-xl text-primary" style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800 }}>
                <ValorBlur
                  value={valorSalidas.reduce((total, periodo) => total + periodo.total, 0)}
                  render={() => formatPesosPreciso(valorSalidas.reduce((total, periodo) => total + periodo.total, 0))}
                />
              </div>
            </div>
          </div>
        </div>
        <div className="mt-5 h-72 sm:h-80">
          {valorSalidas.some((dia) => dia.total > 0) ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={valorSalidas.map((periodo) => ({ ...periodo, fechaCorta: formatPeriodoValor(periodo.fecha, vistaValor) }))}
                margin={{ top: 8, right: 8, left: 4, bottom: 0 }}
                barCategoryGap={-2}
                barGap={0}
              >
                <CartesianGrid stroke="#2b2925" strokeDasharray="3 3" vertical={false}/>
                <XAxis dataKey="fechaCorta" stroke="#9C9C9C" fontSize={9} interval="preserveStartEnd" tickLine={false}/>
                <YAxis stroke="#9C9C9C" fontSize={9} tickLine={false} tickFormatter={(value) => formatValorEje(Number(value))}/>
                <Tooltip content={<ValorSalidasTooltip/>} cursor={{ fill: 'rgba(232, 114, 12, 0.06)' }}/>
                <Bar
                  dataKey="total"
                  name="Valor consumido"
                  fill="#e8720c"
                  background={<ValorPixelBackground />}
                  shape={<ValorPixelShape />}
                />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <EmptyState icon={ArrowUpFromLine} mensaje={`Sin consumo valorizado en los ${subtituloValor.toLowerCase()}`} sub="Las salidas de productos no retornables aparecerán aquí"/>
          )}
        </div>
      </div>

      {/* Charts principales */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-card border border-border p-5" style={{ borderRadius: '0.25rem' }}>
          <SectionHeader
            title="Actividad por día"
            subtitle={`Últimos 7 días · ${formatFechaCorta(r.rango.desde)} → ${formatFechaCorta(r.rango.hasta)}`}
          />
          <div className="h-64 mt-4">
            {r.actividadPorDia.some((d) => d.entradas > 0 || d.salidas > 0) ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={r.actividadPorDia.map((d) => ({
                  ...d,
                  fechaCorta: formatFechaCorta(d.fecha),
                }))}>
                  <defs>
                    <linearGradient id="colorEntradas" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#ABF768" stopOpacity={0.5} />
                      <stop offset="100%" stopColor="#ABF768" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorSalidas" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#E8593F" stopOpacity={0.5} />
                      <stop offset="100%" stopColor="#E8593F" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="#3A3A3A" strokeDasharray="3 3" />
                  <XAxis dataKey="fechaCorta" stroke="#9C9C9C" fontSize={10} />
                  <YAxis stroke="#9C9C9C" fontSize={10} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#2E2E2E',
                      border: '1px solid #3A3A3A',
                      borderRadius: '0.25rem',
                      fontSize: '12px',
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="entradas"
                    stroke="#ABF768"
                    fill="url(#colorEntradas)"
                    name="Entradas"
                  />
                  <Area
                    type="monotone"
                    dataKey="salidas"
                    stroke="#E8593F"
                    fill="url(#colorSalidas)"
                    name="Salidas"
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <EmptyState
                icon={Inbox}
                mensaje="Sin movimientos en los últimos 7 días"
                sub="Empezá a registrar entradas y salidas para ver actividad"
              />
            )}
          </div>
        </div>

        <div className="bg-card border border-border p-5" style={{ borderRadius: '0.25rem' }}>
          <SectionHeader title="Stock por unidad" subtitle="No se suman entre unidades distintas" />
          <div className="h-64 mt-4">
            {r.stockPorUnidad.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={r.stockPorUnidad} layout="vertical" margin={{ left: 0 }}>
                  <CartesianGrid stroke="#3A3A3A" strokeDasharray="3 3" />
                  <XAxis type="number" stroke="#9C9C9C" fontSize={10} />
                  <YAxis
                    dataKey="unidad"
                    type="category"
                    stroke="#9C9C9C"
                    fontSize={10}
                    width={80}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#2E2E2E',
                      border: '1px solid #3A3A3A',
                      borderRadius: '0.25rem',
                      fontSize: '12px',
                    }}
                  />
                  <Bar dataKey="total" radius={[0, 2, 2, 0]}>
                    {r.stockPorUnidad.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <EmptyState
                icon={Package}
                mensaje="Sin stock registrado"
                sub="Cuando asignes stock a productos, aparece acá"
              />
            )}
          </div>
        </div>
      </div>

      {/* Tablas */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Top productos */}
        <div className="bg-card border border-border p-5" style={{ borderRadius: '0.25rem' }}>
          <SectionHeader
            title="Top productos"
            subtitle="Por cantidad en stock"
          />
          {r.topProductos.length > 0 ? (
            <ul className="mt-4 space-y-2">
              {r.topProductos.map((p, i) => (
                <li
                  key={p.id}
                  className="flex items-center justify-between gap-3 px-3 py-2 bg-muted/50 border border-border"
                  style={{ borderRadius: '0.25rem' }}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className="w-5 h-5 bg-primary/15 text-primary text-[10px] font-bold flex items-center justify-center shrink-0"
                      style={{ borderRadius: '0.125rem', fontFamily: "'JetBrains Mono', monospace" }}
                    >
                      {i + 1}
                    </span>
                    <div className="min-w-0">
                      <div className="text-sm text-foreground truncate">{p.nombre}</div>
                      <div
                        className="text-[10px] text-muted-foreground"
                        style={{ fontFamily: "'JetBrains Mono', monospace" }}
                      >
                        {p.codigo}
                      </div>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-sm font-semibold text-foreground">
                      {p.cantidad.toLocaleString('es-CO')}
                    </div>
                    {p.movimientos > 0 && (
                      <div
                        className="text-[9px] text-muted-foreground"
                        style={{ fontFamily: "'JetBrains Mono', monospace" }}
                      >
                        {p.movimientos} movs
                      </div>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState icon={Package} mensaje="Sin productos en stock" />
          )}
        </div>

        {/* Alertas */}
        <div className="bg-card border border-border p-5" style={{ borderRadius: '0.25rem' }}>
          <SectionHeader
            title="Alertas de stock"
            subtitle={`${r.alertasStock.length} activas`}
          />
          {r.alertasStock.length > 0 ? (
            <ul className="mt-4 space-y-2">
              {r.alertasStock.slice(0, 5).map((a) => (
                <li
                  key={a.id}
                  className="flex items-center justify-between gap-3 px-3 py-2 border border-border"
                  style={{ borderRadius: '0.25rem' }}
                >
                  <div className="min-w-0 flex-1">
                    <div className="text-sm text-foreground truncate">{a.producto}</div>
                    <div
                      className="text-[10px] text-muted-foreground"
                      style={{ fontFamily: "'JetBrains Mono', monospace" }}
                    >
                      stock {a.stock} / mín {a.minimo}
                    </div>
                  </div>
                  <span
                    className={`text-[9px] uppercase tracking-widest px-2 py-0.5 ${
                      a.nivel === 'Critica'
                        ? 'bg-primary/15 text-primary border border-primary/30'
                        : 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                    }`}
                    style={{ borderRadius: '0.125rem', fontFamily: "'JetBrains Mono', monospace" }}
                  >
                    {a.nivel}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState
              icon={CheckCircle2}
              mensaje="Sin alertas activas"
              sub="Todo el stock está por encima del mínimo"
            />
          )}
        </div>

        {/* Últimos movimientos */}
        <div className="bg-card border border-border p-5" style={{ borderRadius: '0.25rem' }}>
          <SectionHeader title="Últimos movimientos" subtitle="Los más recientes" />
          {r.ultimosMovimientos.length > 0 ? (
            <ul className="mt-4 space-y-2">
              {r.ultimosMovimientos.slice(0, 6).map((m) => (
                <li
                  key={m.id}
                  className="flex items-center gap-2 px-3 py-2 border border-border"
                  style={{ borderRadius: '0.25rem' }}
                >
                  <MovimientoIcon tipo={m.tipo} signo={m.signo} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-foreground truncate">{m.producto}</div>
                    <div
                      className="text-[10px] text-muted-foreground"
                      style={{ fontFamily: "'JetBrains Mono', monospace" }}
                    >
                      {m.usuario} · {m.hora}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div
                      className={`text-sm font-semibold ${
                        m.signo === 'E' ? 'text-secondary' : 'text-primary'
                      }`}
                    >
                      {m.signo === 'E' ? '+' : '−'}
                      {m.cantidad}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState
              icon={ShoppingCart}
              mensaje="Sin movimientos todavía"
              sub="Cuando registres entradas o salidas, aparecen acá"
            />
          )}
        </div>
      </div>

      {/* Footer con info de la bodega */}
      <div
        className="flex items-center justify-between gap-3 px-4 py-3 bg-muted/40 border border-border text-xs text-muted-foreground"
        style={{ borderRadius: '0.25rem', fontFamily: "'JetBrains Mono', monospace" }}
      >
        <div className="flex items-center gap-2">
          <Warehouse size={12} className="text-primary" />
          <span>
            {r.bodega.nombre}
            {r.bodega.direccion ? ` · ${r.bodega.direccion}` : ''}
          </span>
        </div>
      </div>
    </>
  )
}

// ──────────────────────────────────────────────────────────
//  Sub-componentes
// ──────────────────────────────────────────────────────────

type KpiColor = 'sky' | 'emerald' | 'amber' | 'violet' | 'primary' | 'secondary'

const kpiColorClass: Record<KpiColor, string> = {
  sky: 'text-sky-400',
  emerald: 'text-emerald-400',
  amber: 'text-amber-400',
  violet: 'text-violet-400',
  primary: 'text-primary',
  secondary: 'text-secondary',
}

function Kpi({
  icon: Icon,
  color,
  label,
  value,
  sub,
}: {
  icon: typeof Package
  color: KpiColor
  label: string
  value: React.ReactNode
  sub?: string
}) {
  return (
    <div className="bg-card border border-border p-4" style={{ borderRadius: '0.25rem' }}>
      <div className="flex items-center justify-between">
        <div
          className="text-[10px] text-muted-foreground uppercase tracking-widest"
          style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 500 }}
        >
          {label}
        </div>
        <Icon size={14} className={kpiColorClass[color]} />
      </div>
      <div
        className="text-2xl text-foreground mt-1 leading-none"
        style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900 }}
      >
        {value}
      </div>
      {sub && (
        <div
          className="text-[10px] text-muted-foreground mt-1.5"
          style={{ fontFamily: "'DM Sans', sans-serif" }}
        >
          {sub}
        </div>
      )}
    </div>
  )
}

function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div>
      <h3
        className="text-base uppercase text-foreground leading-none"
        style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900 }}
      >
        {title}
      </h3>
      {subtitle && (
        <div
          className="text-[10px] text-muted-foreground uppercase tracking-widest mt-1"
          style={{ fontFamily: "'JetBrains Mono', monospace" }}
        >
          {subtitle}
        </div>
      )}
    </div>
  )
}

function MovimientoIcon({ tipo, signo }: { tipo: string; signo: string }) {
  if (signo === 'E' || esEntrada(tipo)) {
    return (
      <div className="w-7 h-7 bg-secondary/15 flex items-center justify-center shrink-0">
        <ArrowDownToLine size={12} className="text-secondary" />
      </div>
    )
  }
  if (signo === 'S' || esSalida(tipo)) {
    return (
      <div className="w-7 h-7 bg-primary/15 flex items-center justify-center shrink-0">
        <ArrowUpFromLine size={12} className="text-primary" />
      </div>
    )
  }
  return (
    <div className="w-7 h-7 bg-violet-500/15 flex items-center justify-center shrink-0">
      <TrendingUp size={12} className="text-violet-400" />
    </div>
  )
}

function esEntrada(tipo: string) {
  const t = tipo.toLowerCase()
  return t.includes('entrada') || t.includes('compra') || t.includes('devolución')
}
function esSalida(tipo: string) {
  return tipo.toLowerCase().includes('salida')
}

function EmptyState({
  icon: Icon,
  mensaje,
  sub,
}: {
  icon: typeof Package
  mensaje: string
  sub?: string
}) {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center px-4 py-6">
      <Icon size={20} className="text-muted-foreground/50 mb-2" />
      <p className="text-xs text-muted-foreground">{mensaje}</p>
      {sub && (
        <p
          className="text-[10px] text-muted-foreground/70 mt-1"
          style={{ fontFamily: "'DM Sans', sans-serif" }}
        >
          {sub}
        </p>
      )}
    </div>
  )
}

type ValorSalidaDia = DashboardResumen['valorSalidasPorDia'][number]

type PixelShapeProps = {
  x?: number
  y?: number
  width?: number
  height?: number
  fill?: string
  columnas?: number
}

function obtenerMetricaPixel(width: number, columnas: number) {
  const separacion = 2
  const bloque = Math.max(3, (width - separacion * (columnas - 1)) / columnas)
  const ancho = columnas * bloque + (columnas - 1) * separacion
  return { bloque, separacion, paso: bloque + separacion, inicioX: (width - ancho) / 2 }
}

function ValorPixelBackground({
  x = 0,
  y = 0,
  width = 0,
  height = 0,
  columnas,
}: PixelShapeProps) {
  if (height <= 0 || width <= 0) return null
  const columnasEfectivas = columnas ?? Math.max(1, Math.round((width + 2) / 15))
  const metrica = obtenerMetricaPixel(width, columnasEfectivas)
  const filas = Math.floor(height / metrica.paso)

  return (
    <g opacity={0.3}>
      {Array.from({ length: filas }, (_, fila) =>
        Array.from({ length: columnasEfectivas }, (_, columna) => (
          <rect
            key={`${fila}-${columna}`}
            x={x + metrica.inicioX + columna * metrica.paso}
            y={y + height - (fila + 1) * metrica.paso}
            width={metrica.bloque}
            height={metrica.bloque}
            rx={0.8}
            fill="#45413a"
          />
        )),
      )}
    </g>
  )
}

function ValorPixelShape({
  x = 0,
  y = 0,
  width = 0,
  height = 0,
  fill = '#e8720c',
  columnas,
}: PixelShapeProps) {
  if (height <= 0 || width <= 0) return null
  const columnasEfectivas = columnas ?? Math.max(1, Math.round((width + 2) / 15))
  const metrica = obtenerMetricaPixel(width, columnasEfectivas)
  const filasBase = Math.max(1, Math.floor(height / metrica.paso))
  const baseY = y + height

  return (
    <g>
      {Array.from({ length: columnasEfectivas }, (_, columna) => {
        const filas = filasBase
        return Array.from({ length: filas }, (_, fila) => (
          <rect
            key={`${fila}-${columna}`}
            x={x + metrica.inicioX + columna * metrica.paso}
            y={baseY - (fila + 1) * metrica.paso}
            width={metrica.bloque}
            height={metrica.bloque}
            rx={0.8}
            fill={fill}
          />
        ))
      })}
    </g>
  )
}

function ValorSalidasTooltip({
  active,
  payload,
}: {
  active?: boolean
  payload?: Array<{ payload: ValorSalidaDia & { fechaCorta?: string } }>
}) {
  if (!active || !payload?.length) return null

  const dia = payload[0].payload
  return (
    <div className="min-w-[230px] max-w-[320px] rounded-md border border-[#45413a] bg-[#17140f] p-3 shadow-2xl">
      <div className="text-[9px] uppercase tracking-[0.16em] text-muted-foreground" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
        {formatFechaLarga(dia.fecha)}
      </div>
      <div className="mt-1 text-lg text-primary" style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900 }}>
        <ValorBlur value={dia.total} render={() => formatPesosPreciso(dia.total)} />
      </div>
      <div className="mt-3 max-h-52 space-y-2 overflow-y-auto pr-1">
        {dia.detalles.map((detalle) => (
          <div key={detalle.codigo} className="flex items-start justify-between gap-4 border-t border-border/70 pt-2">
            <div className="min-w-0">
              <div className="truncate text-xs text-foreground">{detalle.producto}</div>
              <div className="mt-0.5 text-[9px] text-muted-foreground">
                {detalle.cantidad.toLocaleString('es-CO', { maximumFractionDigits: 3 })} {detalle.unidad}
              </div>
            </div>
            <div className="shrink-0 text-xs font-semibold text-foreground">
              <ValorBlur value={detalle.valor} render={() => formatPesosPreciso(detalle.valor)} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ──────────────────────────────────────────────────────────
//  Helpers
// ──────────────────────────────────────────────────────────

function formatPesos(n: number): string {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(n)
}

function formatPesosPreciso(n: number): string {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n)
}

function formatValorEje(n: number): string {
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toLocaleString('es-CO', { maximumFractionDigits: 1 })}M`
  if (Math.abs(n) >= 1_000) return `$${(n / 1_000).toLocaleString('es-CO', { maximumFractionDigits: 1 })}k`
  return `$${n.toLocaleString('es-CO', { maximumFractionDigits: 0 })}`
}

function formatFechaLarga(iso: string): string {
  if (/^\d{4}$/.test(iso)) return `Año ${iso}`
  if (/^\d{4}-\d{2}$/.test(iso)) {
    const [anio, mes] = iso.split('-').map(Number)
    return new Date(anio, mes - 1, 1).toLocaleDateString('es-CO', { month: 'long', year: 'numeric' })
  }
  return new Date(`${iso}T00:00:00`).toLocaleDateString('es-CO', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })
}

function formatPeriodoValor(periodo: string, vista: 'dia' | 'mes' | 'anio'): string {
  if (vista === 'anio') return periodo
  if (vista === 'mes') {
    const [anio, mes] = periodo.split('-').map(Number)
    return new Date(anio, mes - 1, 1).toLocaleDateString('es-CO', { month: 'short', year: '2-digit' })
  }
  return formatFechaCorta(periodo)
}

function formatFechaCorta(iso: string): string {
  // 'YYYY-MM-DD' → 'DD MMM' (es-CO)
  const d = new Date(iso + 'T00:00:00')
  return d.toLocaleDateString('es-CO', { day: '2-digit', month: 'short' })
}
