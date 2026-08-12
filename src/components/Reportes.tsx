import { Link, useSearchParams } from 'react-router-dom'
import { useEffect, useMemo, useState } from 'react'
import {
  BarChart3,
  ArrowDownToLine,
  ArrowUpFromLine,
  Copy,
  Inbox,
  Loader2,
  TrendingUp,
  TrendingDown,
  DollarSign,
  BarChart2,
} from 'lucide-react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { useAuth } from '../store/auth'
import { PageHeader } from './PageHeader'
import { bodegaActivaStore } from '../store/bodegaActiva'
import { productosStore } from '../store/productos'
import {
  reportesApi,
  defaultRango,
  fmtFechaCorta,
  fmtMoneda,
  fmtNumero,
  type KardexResponse,
  type ReporteItem,
  type ReporteResponse,
  type ResumenResponse,
} from './reportes/api'

// ───────────────────────────────────────────────────────────────────
//  Tipos y submódulos
// ───────────────────────────────────────────────────────────────────

type SubKey = 'entradas' | 'salidas' | 'kardex' | 'resumen'

const SUBMODULOS: {
  key: SubKey
  label: string
  descripcion: string
  icon: typeof ArrowDownToLine
  permiso: string
}[] = [
  {
    key: 'resumen',
    label: 'Resumen',
    descripcion: 'KPIs y top productos del período.',
    icon: BarChart3,
    permiso: 'reportes.ver',
  },
  {
    key: 'entradas',
    label: 'Entradas',
    descripcion: 'Historial de ingresos de mercadería al sistema.',
    icon: ArrowDownToLine,
    permiso: 'reportes.entradas.ver',
  },
  {
    key: 'salidas',
    label: 'Salidas',
    descripcion: 'Historial de salidas y despachos.',
    icon: ArrowUpFromLine,
    permiso: 'reportes.salidas.ver',
  },
  {
    key: 'kardex',
    label: 'Kardex',
    descripcion: 'Movimientos consolidados por producto y bodega.',
    icon: Copy,
    permiso: 'reportes.kardex.ver',
  },
]

// ───────────────────────────────────────────────────────────────────
//  Componente público: <Reportes subKey />
// ───────────────────────────────────────────────────────────────────

export function Reportes({ subKey }: { subKey: string }) {
  const sub = SUBMODULOS.find((s) => s.key === subKey)

  if (!sub) {
    return (
      <div className="flex-1 flex items-center justify-center p-12">
        <p className="text-muted-foreground">Reporte "{subKey}" no encontrado.</p>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col min-w-0 min-h-0">
      <PageHeader title={sub.label} subtitle="STOCKPRO · REPORTES" />
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 space-y-6">
        {sub.key === 'resumen' && <ResumenView />}
        {sub.key === 'entradas' && <EntradasSalidasView tipo="entradas" />}
        {sub.key === 'salidas' && <EntradasSalidasView tipo="salidas" />}
        {sub.key === 'kardex' && <KardexView />}
      </div>
    </div>
  )
}

// ───────────────────────────────────────────────────────────────────
//  Filtro de rango (compartido)
// ───────────────────────────────────────────────────────────────────

function RangoFiltro({
  desde,
  hasta,
  onChange,
}: {
  desde: string
  hasta: string
  onChange: (d: string, h: string) => void
}) {
  return (
    <div className="flex flex-wrap items-end gap-3 bg-card border border-border p-3"
      style={{ borderRadius: '0.25rem' }}
    >
      <div className="flex flex-col">
        <label
          className="text-[10px] text-muted-foreground tracking-widest mb-1"
          style={{ fontFamily: "'JetBrains Mono', monospace" }}
        >
          DESDE
        </label>
        <input
          type="date"
          value={desde}
          onChange={(e) => onChange(e.target.value, hasta)}
          className="bg-background border border-border px-2 py-1.5 text-sm text-foreground focus:border-primary/50 outline-none"
          style={{ borderRadius: '0.25rem' }}
        />
      </div>
      <div className="flex flex-col">
        <label
          className="text-[10px] text-muted-foreground tracking-widest mb-1"
          style={{ fontFamily: "'JetBrains Mono', monospace" }}
        >
          HASTA
        </label>
        <input
          type="date"
          value={hasta}
          onChange={(e) => onChange(desde, e.target.value)}
          className="bg-background border border-border px-2 py-1.5 text-sm text-foreground focus:border-primary/50 outline-none"
          style={{ borderRadius: '0.25rem' }}
        />
      </div>
      <div className="flex flex-wrap gap-1.5 ml-auto">
        <BotonPreset label="7 días" dias={7} onChange={onChange} />
        <BotonPreset label="30 días" dias={30} onChange={onChange} />
        <BotonPreset label="90 días" dias={90} onChange={onChange} />
        <BotonPreset label="Año" dias={365} onChange={onChange} />
      </div>
    </div>
  )
}

function BotonPreset({
  label,
  dias,
  onChange,
}: {
  label: string
  dias: number
  onChange: (d: string, h: string) => void
}) {
  return (
    <button
      onClick={() => {
        const hoy = new Date()
        const desde = new Date(hoy.getTime() - dias * 24 * 60 * 60 * 1000)
        onChange(desde.toISOString().slice(0, 10), hoy.toISOString().slice(0, 10))
      }}
      className="px-2.5 py-1.5 text-[10px] border border-border text-muted-foreground hover:border-primary/40 hover:text-foreground transition-colors"
      style={{ borderRadius: '0.25rem', fontFamily: "'JetBrains Mono', monospace" }}
    >
      {label}
    </button>
  )
}

// ───────────────────────────────────────────────────────────────────
//  Vista: Resumen (KPIs + top productos + stock valorizado)
// ───────────────────────────────────────────────────────────────────

function ResumenView() {
  const [searchParams] = useSearchParams()
  const initial = useMemo(() => {
    const d = searchParams.get('desde')
    const h = searchParams.get('hasta')
    if (d && h) return { desde: d, hasta: h }
    return defaultRango()
  }, [])
  const [desde, setDesde] = useState(initial.desde)
  const [hasta, setHasta] = useState(initial.hasta)
  const [data, setData] = useState<ResumenResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancel = false
    setLoading(true)
    setError(null)
    reportesApi
      .resumen(desde, hasta)
      .then((d) => {
        if (!cancel) setData(d)
      })
      .catch((e) => {
        if (!cancel) setError((e as Error).message)
      })
      .finally(() => {
        if (!cancel) setLoading(false)
      })
    return () => {
      cancel = true
    }
  }, [desde, hasta])

  return (
    <>
      <RangoFiltro desde={desde} hasta={hasta} onChange={(d, h) => { setDesde(d); setHasta(h) }} />
      {loading ? (
        <div className="flex items-center justify-center p-12 text-muted-foreground text-sm gap-2">
          <Loader2 size={14} className="animate-spin" />
          Cargando resumen…
        </div>
      ) : error ? (
        <div className="bg-card border border-primary/40 p-4 text-sm text-primary"
          style={{ borderRadius: '0.25rem' }}
        >
          {error}
        </div>
      ) : data ? (
        <>
          <KpisGrid kpis={data.kpis} />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <TopProductosCard
              titulo="Top 10 productos más movidos"
              items={data.topProductos}
            />
            <TopValorizadosCard
              titulo="Top 10 stock valorizado"
              items={data.topProductosValorizados}
            />
          </div>
        </>
      ) : null}
    </>
  )
}

function KpisGrid({ kpis }: { kpis: ResumenResponse['kpis'] }) {
  const cards: { label: string; value: string; icon: typeof TrendingUp; tone: 'good' | 'bad' | 'neutral' }[] = [
    {
      label: 'Total entradas',
      value: fmtNumero(kpis.totalEntradas, 0),
      icon: TrendingUp,
      tone: 'good',
    },
    {
      label: 'Total salidas',
      value: fmtNumero(kpis.totalSalidas, 0),
      icon: TrendingDown,
      tone: 'bad',
    },
    {
      label: 'Variación neta',
      value: fmtNumero(kpis.variacionNeta, 0),
      icon: BarChart2,
      tone: kpis.variacionNeta >= 0 ? 'good' : 'bad',
    },
    {
      label: 'Valor del stock',
      value: fmtMoneda(kpis.valorStock),
      icon: DollarSign,
      tone: 'neutral',
    },
  ]
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {cards.map((c) => {
        const Icon = c.icon
        const colorClass =
          c.tone === 'good'
            ? 'text-secondary border-secondary/30'
            : c.tone === 'bad'
              ? 'text-primary border-primary/30'
              : 'text-muted-foreground border-border'
        return (
          <div
            key={c.label}
            className="bg-card border border-border p-4 flex flex-col gap-2"
            style={{ borderRadius: '0.25rem' }}
          >
            <div className="flex items-center justify-between">
              <span
                className="text-[10px] text-muted-foreground tracking-widest"
                style={{ fontFamily: "'JetBrains Mono', monospace" }}
              >
                {c.label.toUpperCase()}
              </span>
              <Icon size={14} className={colorClass.split(' ')[0]} />
            </div>
            <p
              className={['text-2xl', colorClass.split(' ')[0]].join(' ')}
              style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800 }}
            >
              {c.value}
            </p>
          </div>
        )
      })}
    </div>
  )
}

function TopProductosCard({
  titulo,
  items,
}: {
  titulo: string
  items: ResumenResponse['topProductos']
}) {
  return (
    <div className="bg-card border border-border p-4" style={{ borderRadius: '0.25rem' }}>
      <h3
        className="text-sm uppercase text-foreground mb-3"
        style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800 }}
      >
        {titulo}
      </h3>
      {items.length === 0 ? (
        <p className="text-xs text-muted-foreground py-6 text-center">Sin datos en el período.</p>
      ) : (
        <div className="space-y-2">
          {items.slice(0, 10).map((p) => (
            <div
              key={p.id}
              className="flex items-center justify-between gap-2 text-sm py-1.5 border-b border-border/40 last:border-0"
            >
              <div className="min-w-0 flex-1">
                <p className="text-foreground truncate">{p.nombre}</p>
                <p
                  className="text-[10px] text-muted-foreground"
                  style={{ fontFamily: "'JetBrains Mono', monospace" }}
                >
                  {p.codigo}
                </p>
              </div>
              <div className="text-right shrink-0">
                <p
                  className="text-foreground tabular-nums"
                  style={{ fontFamily: "'JetBrains Mono', monospace" }}
                >
                  {fmtNumero(p.cantidad, 0)}
                </p>
                <p className="text-[10px] text-muted-foreground">
                  E: {fmtNumero(p.entradas, 0)} · S: {fmtNumero(p.salidas, 0)}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function TopValorizadosCard({
  titulo,
  items,
}: {
  titulo: string
  items: ResumenResponse['topProductosValorizados']
}) {
  return (
    <div className="bg-card border border-border p-4" style={{ borderRadius: '0.25rem' }}>
      <h3
        className="text-sm uppercase text-foreground mb-3"
        style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800 }}
      >
        {titulo}
      </h3>
      {items.length === 0 ? (
        <p className="text-xs text-muted-foreground py-6 text-center">Sin stock valorizado.</p>
      ) : (
        <div className="space-y-2">
          {items.slice(0, 10).map((p) => (
            <div
              key={p.id}
              className="flex items-center justify-between gap-2 text-sm py-1.5 border-b border-border/40 last:border-0"
            >
              <div className="min-w-0 flex-1">
                <p className="text-foreground truncate">{p.nombre}</p>
                <p
                  className="text-[10px] text-muted-foreground"
                  style={{ fontFamily: "'JetBrains Mono', monospace" }}
                >
                  {p.codigo} · {fmtNumero(p.cantidad, 0)} und
                </p>
              </div>
              <p
                className="text-secondary tabular-nums shrink-0"
                style={{ fontFamily: "'JetBrains Mono', monospace" }}
              >
                {fmtMoneda(p.valorizado)}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ───────────────────────────────────────────────────────────────────
//  Vista: Entradas / Salidas (compartida, parametrizada)
// ───────────────────────────────────────────────────────────────────

const COLORES_GRAFICO = ['#E8593F', '#ABF768', '#3B82F6', '#A855F7', '#F59E0B', '#06B6D4', '#EC4899', '#10B981']

function EntradasSalidasView({ tipo }: { tipo: 'entradas' | 'salidas' }) {
  const initial = useMemo(() => defaultRango(), [])
  const [desde, setDesde] = useState(initial.desde)
  const [hasta, setHasta] = useState(initial.hasta)
  const [data, setData] = useState<ReporteResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancel = false
    setLoading(true)
    setError(null)
    const fn = tipo === 'entradas' ? reportesApi.entradas : reportesApi.salidas
    fn(desde, hasta)
      .then((d) => {
        if (!cancel) setData(d)
      })
      .catch((e) => {
        if (!cancel) setError((e as Error).message)
      })
      .finally(() => {
        if (!cancel) setLoading(false)
      })
    return () => {
      cancel = true
    }
  }, [desde, hasta, tipo])

  const dataGrafico = useMemo(() => {
    if (!data) return []
    return data.porTipo.map((t, i) => ({
      name: t.tipo,
      cantidad: Number(t.cantidad.toFixed(2)),
      fill: COLORES_GRAFICO[i % COLORES_GRAFICO.length],
    }))
  }, [data])

  return (
    <>
      <RangoFiltro desde={desde} hasta={hasta} onChange={(d, h) => { setDesde(d); setHasta(h) }} />
      {loading ? (
        <div className="flex items-center justify-center p-12 text-muted-foreground text-sm gap-2">
          <Loader2 size={14} className="animate-spin" />
          Cargando {tipo}…
        </div>
      ) : error ? (
        <div className="bg-card border border-primary/40 p-4 text-sm text-primary"
          style={{ borderRadius: '0.25rem' }}
        >
          {error}
        </div>
      ) : data ? (
        <>
          <TotalesStrip data={data} />
          {data.porTipo.length > 0 && (
            <div className="bg-card border border-border p-4" style={{ borderRadius: '0.25rem' }}>
              <h3
                className="text-sm uppercase text-foreground mb-3"
                style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800 }}
              >
                {tipo === 'entradas' ? 'Entradas por tipo' : 'Salidas por motivo'}
              </h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dataGrafico} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <CartesianGrid stroke="#333" strokeDasharray="3 3" />
                    <XAxis dataKey="name" stroke="#888" fontSize={11} />
                    <YAxis stroke="#888" fontSize={11} />
                    <Tooltip
                      contentStyle={{
                        background: '#2E2E2E',
                        border: '1px solid #333',
                        borderRadius: '0.25rem',
                        fontSize: 12,
                      }}
                      cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                      formatter={(v: number) => fmtNumero(v, 0)}
                    />
                    <Bar dataKey="cantidad" radius={[4, 4, 0, 0]}>
                      {dataGrafico.map((d, i) => (
                        <Cell key={i} fill={d.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
          <MovimientosTable items={data.items} />
        </>
      ) : null}
    </>
  )
}

function TotalesStrip({ data }: { data: ReporteResponse }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      <KpiSimple label="Items" value={fmtNumero(data.totalItems, 0)} />
      <KpiSimple label="Cantidad total" value={fmtNumero(data.totalCantidad, 0)} />
      <KpiSimple label="Costo total" value={fmtMoneda(data.totalCosto)} />
    </div>
  )
}

function KpiSimple({ label, value }: { label: string; value: string }) {
  return (
    <div
      className="bg-card border border-border p-3"
      style={{ borderRadius: '0.25rem' }}
    >
      <p
        className="text-[10px] text-muted-foreground tracking-widest"
        style={{ fontFamily: "'JetBrains Mono', monospace" }}
      >
        {label.toUpperCase()}
      </p>
      <p
        className="text-xl text-foreground mt-1 tabular-nums"
        style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800 }}
      >
        {value}
      </p>
    </div>
  )
}

function MovimientosTable({ items }: { items: ReporteItem[] }) {
  if (items.length === 0) {
    return (
      <div
        className="bg-card border border-border py-16 flex flex-col items-center justify-center"
        style={{ borderRadius: '0.25rem' }}
      >
        <Inbox size={24} className="text-muted-foreground mb-2" />
        <p className="text-sm text-muted-foreground">No hay movimientos en el período.</p>
      </div>
    )
  }
  return (
    <div className="bg-card border border-border overflow-hidden" style={{ borderRadius: '0.25rem' }}>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr
              className="border-b border-border text-muted-foreground"
              style={{ fontFamily: "'JetBrains Mono', monospace" }}
            >
              <th className="text-left py-2 px-3 text-[10px] tracking-widest">FECHA</th>
              <th className="text-left py-2 px-3 text-[10px] tracking-widest">TIPO</th>
              <th className="text-left py-2 px-3 text-[10px] tracking-widest">PRODUCTO</th>
              <th className="text-right py-2 px-3 text-[10px] tracking-widest">CANTIDAD</th>
              <th className="text-right py-2 px-3 text-[10px] tracking-widest hidden md:table-cell">COSTO UNIT.</th>
              <th className="text-right py-2 px-3 text-[10px] tracking-widest hidden md:table-cell">COSTO TOTAL</th>
              <th className="text-left py-2 px-3 text-[10px] tracking-widest hidden lg:table-cell">USUARIO</th>
              <th className="text-left py-2 px-3 text-[10px] tracking-widest hidden lg:table-cell">DOC SOPORTE</th>
            </tr>
          </thead>
          <tbody>
            {items.map((it) => (
              <tr
                key={it.id}
                className="border-b border-border/40 last:border-0 hover:bg-muted/30"
              >
                <td
                  className="py-2 px-3 text-foreground whitespace-nowrap"
                  style={{ fontFamily: "'JetBrains Mono', monospace" }}
                >
                  {fmtFechaCorta(it.fecha)}
                </td>
                <td className="py-2 px-3 text-foreground">{it.tipoNombre}</td>
                <td className="py-2 px-3 text-foreground min-w-0">
                  <p className="truncate max-w-xs">{it.producto.nombre}</p>
                  <p
                    className="text-[10px] text-muted-foreground"
                    style={{ fontFamily: "'JetBrains Mono', monospace" }}
                  >
                    {it.producto.codigo}
                  </p>
                </td>
                <td
                  className="py-2 px-3 text-right text-foreground whitespace-nowrap tabular-nums"
                  style={{ fontFamily: "'JetBrains Mono', monospace" }}
                >
                  {fmtNumero(it.cantidadBase, 2)} {it.unidad}
                </td>
                <td
                  className="py-2 px-3 text-right text-muted-foreground whitespace-nowrap hidden md:table-cell"
                  style={{ fontFamily: "'JetBrains Mono', monospace" }}
                >
                  {it.costoUnitario != null ? fmtMoneda(it.costoUnitario) : '—'}
                </td>
                <td
                  className="py-2 px-3 text-right text-secondary whitespace-nowrap hidden md:table-cell"
                  style={{ fontFamily: "'JetBrains Mono', monospace" }}
                >
                  {it.costoTotal != null ? fmtMoneda(it.costoTotal) : '—'}
                </td>
                <td className="py-2 px-3 text-muted-foreground text-xs hidden lg:table-cell">
                  {it.usuario}
                </td>
                <td className="py-2 px-3 text-xs text-muted-foreground hidden lg:table-cell">
                  {it.compra ? (
                    <span title={it.compra.proveedor ?? ''}>
                      {it.compra.codigo}
                      {it.compra.numeroFactura ? ` · ${it.compra.numeroFactura}` : ''}
                    </span>
                  ) : (
                    '—'
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ───────────────────────────────────────────────────────────────────
//  Vista: Kardex por producto
// ───────────────────────────────────────────────────────────────────

function KardexView() {
  const initial = useMemo(() => defaultRango(), [])
  const [desde, setDesde] = useState(initial.desde)
  const [hasta, setHasta] = useState(initial.hasta)
  const [productoId, setProductoId] = useState<string | null>(null)
  const [productos, setProductos] = useState<{ id: string; codigo: string; nombre: string }[]>([])
  const [data, setData] = useState<KardexResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Cargar productos del tenant (usamos el store global; si el catálogo
  // ya está cacheado, no hace falta re-fetch).
  useEffect(() => {
    let cancel = false
    const bodegaId = bodegaActivaStore.getId() ?? undefined
    const cargar = async () => {
      try {
        // Pedimos página 1 con 100 items. Para más, paginar.
        const res = await productosStore.fetchPaginado({
          bodegaId,
          buscar: '',
          categoriaId: undefined,
          marcaId: undefined,
          page: 1,
          pageSize: 100,
        })
        if (cancel) return
        const lista = (res.data ?? []).map((p) => ({
          id: p.id,
          codigo: p.codigo,
          nombre: p.nombre,
        }))
        setProductos(lista)
        if (lista.length > 0) setProductoId((curr) => curr ?? lista[0].id)
      } catch {
        // No-op: si falla, simplemente no precargamos
      }
    }
    void cargar()
    return () => {
      cancel = true
    }
  }, [])

  // Cargar Kardex cuando cambia producto o rango
  useEffect(() => {
    if (!productoId) return
    let cancel = false
    setLoading(true)
    setError(null)
    reportesApi
      .kardex(productoId, desde, hasta)
      .then((d) => {
        if (!cancel) setData(d)
      })
      .catch((e) => {
        if (!cancel) setError((e as Error).message)
      })
      .finally(() => {
        if (!cancel) setLoading(false)
      })
    return () => {
      cancel = true
    }
  }, [productoId, desde, hasta])

  const dataGrafico = useMemo(() => {
    if (!data) return []
    // Para la línea de stock en el tiempo, agregamos "saldoInicial"
    // como punto de partida (fecha 0) y luego cada línea con su saldo.
    const puntos: { fecha: string; saldo: number; idx: number }[] = []
    if (data.lineas.length > 0) {
      puntos.push({
        fecha: 'Inicio',
        saldo: data.saldoInicial,
        idx: 0,
      })
    }
    data.lineas.forEach((l, i) => {
      puntos.push({
        fecha: fmtFechaCorta(l.fecha),
        saldo: l.saldo,
        idx: i + 1,
      })
    })
    return puntos
  }, [data])

  return (
    <>
      <RangoFiltro desde={desde} hasta={hasta} onChange={(d, h) => { setDesde(d); setHasta(h) }} />
      <div className="bg-card border border-border p-3" style={{ borderRadius: '0.25rem' }}>
        <label
          className="text-[10px] text-muted-foreground tracking-widest mb-1 block"
          style={{ fontFamily: "'JetBrains Mono', monospace" }}
        >
          PRODUCTO
        </label>
        <select
          value={productoId ?? ''}
          onChange={(e) => setProductoId(e.target.value || null)}
          className="w-full bg-background border border-border px-2 py-1.5 text-sm text-foreground focus:border-primary/50 outline-none"
          style={{ borderRadius: '0.25rem' }}
        >
          <option value="">Selecciona un producto…</option>
          {productos.map((p) => (
            <option key={p.id} value={p.id}>
              {p.codigo} · {p.nombre}
            </option>
          ))}
        </select>
      </div>
      {loading ? (
        <div className="flex items-center justify-center p-12 text-muted-foreground text-sm gap-2">
          <Loader2 size={14} className="animate-spin" />
          Cargando Kardex…
        </div>
      ) : error ? (
        <div className="bg-card border border-primary/40 p-4 text-sm text-primary"
          style={{ borderRadius: '0.25rem' }}
        >
          {error}
        </div>
      ) : data ? (
        <>
          <ProductoKardexHeader data={data} />
          {data.lineas.length > 0 && (
            <div className="bg-card border border-border p-4" style={{ borderRadius: '0.25rem' }}>
              <h3
                className="text-sm uppercase text-foreground mb-3"
                style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800 }}
              >
                Evolución del stock
              </h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={dataGrafico} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <CartesianGrid stroke="#333" strokeDasharray="3 3" />
                    <XAxis dataKey="fecha" stroke="#888" fontSize={10} />
                    <YAxis stroke="#888" fontSize={11} />
                    <Tooltip
                      contentStyle={{
                        background: '#2E2E2E',
                        border: '1px solid #333',
                        borderRadius: '0.25rem',
                        fontSize: 12,
                      }}
                      formatter={(v: number) => fmtNumero(v, 2)}
                    />
                    <Line
                      type="monotone"
                      dataKey="saldo"
                      stroke="#ABF768"
                      strokeWidth={2}
                      dot={{ r: 3, fill: '#ABF768' }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
          <KardexTable data={data} />
        </>
      ) : null}
    </>
  )
}

function ProductoKardexHeader({ data }: { data: KardexResponse }) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      <KpiSimple
        label="Saldo inicial"
        value={`${fmtNumero(data.saldoInicial, 2)} ${data.producto.unidad}`}
      />
      <KpiSimple
        label="Saldo final"
        value={`${fmtNumero(data.saldoFinal, 2)} ${data.producto.unidad}`}
      />
      <KpiSimple
        label="Costo prom. final"
        value={fmtMoneda(data.costoPromedioFinal)}
      />
      <KpiSimple
        label="Stock valorizado"
        value={fmtMoneda(data.saldoFinalValorizado)}
      />
    </div>
  )
}

function KardexTable({ data }: { data: KardexResponse }) {
  if (data.lineas.length === 0) {
    return (
      <div
        className="bg-card border border-border py-16 flex flex-col items-center justify-center"
        style={{ borderRadius: '0.25rem' }}
      >
        <Inbox size={24} className="text-muted-foreground mb-2" />
        <p className="text-sm text-muted-foreground">Sin movimientos en el período.</p>
      </div>
    )
  }
  return (
    <div className="bg-card border border-border overflow-hidden" style={{ borderRadius: '0.25rem' }}>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr
              className="border-b border-border text-muted-foreground"
              style={{ fontFamily: "'JetBrains Mono', monospace" }}
            >
              <th className="text-left py-2 px-3 text-[10px] tracking-widest">FECHA</th>
              <th className="text-left py-2 px-3 text-[10px] tracking-widest">TIPO</th>
              <th className="text-right py-2 px-3 text-[10px] tracking-widest">CANTIDAD</th>
              <th className="text-right py-2 px-3 text-[10px] tracking-widest hidden md:table-cell">COSTO</th>
              <th className="text-right py-2 px-3 text-[10px] tracking-widest">SALDO</th>
              <th className="text-right py-2 px-3 text-[10px] tracking-widest hidden md:table-cell">VALORIZADO</th>
              <th className="text-left py-2 px-3 text-[10px] tracking-widest hidden lg:table-cell">USUARIO</th>
              <th className="text-left py-2 px-3 text-[10px] tracking-widest hidden lg:table-cell">DOC</th>
            </tr>
          </thead>
          <tbody>
            {/* Saldo inicial */}
            <tr className="border-b border-border/40 bg-muted/20">
              <td
                className="py-2 px-3 text-muted-foreground italic"
                style={{ fontFamily: "'JetBrains Mono', monospace" }}
              >
                Saldo inicial
              </td>
              <td
                className="py-2 px-3 text-muted-foreground italic"
                colSpan={2}
              >
                —
              </td>
              <td
                className="py-2 px-3 text-right text-muted-foreground tabular-nums"
                style={{ fontFamily: "'JetBrains Mono', monospace" }}
              >
                {fmtNumero(data.saldoInicial, 2)} {data.producto.unidad}
              </td>
              <td
                className="py-2 px-3 text-right text-muted-foreground hidden md:table-cell"
                style={{ fontFamily: "'JetBrains Mono', monospace" }}
              >
                {fmtMoneda(data.costoPromedioInicial)}
              </td>
              <td
                className="py-2 px-3 text-right text-muted-foreground hidden md:table-cell"
                style={{ fontFamily: "'JetBrains Mono', monospace" }}
              >
                {fmtMoneda(data.saldoInicialValorizado)}
              </td>
              <td colSpan={2} className="hidden lg:table-cell" />
            </tr>
            {data.lineas.map((l) => (
              <tr
                key={l.id}
                className="border-b border-border/40 last:border-0 hover:bg-muted/30"
              >
                <td
                  className="py-2 px-3 text-foreground whitespace-nowrap"
                  style={{ fontFamily: "'JetBrains Mono', monospace" }}
                >
                  {fmtFechaCorta(l.fecha)}
                </td>
                <td
                  className={[
                    'py-2 px-3',
                    l.esEntrada ? 'text-secondary' : 'text-primary',
                  ].join(' ')}
                >
                  {l.esEntrada ? '+ ' : '− '}
                  {l.tipoNombre}
                </td>
                <td
                  className="py-2 px-3 text-right text-foreground whitespace-nowrap tabular-nums"
                  style={{ fontFamily: "'JetBrains Mono', monospace" }}
                >
                  {fmtNumero(l.cantidadBase, 2)} {l.unidadAbreviatura}
                </td>
                <td
                  className="py-2 px-3 text-right text-muted-foreground whitespace-nowrap hidden md:table-cell"
                  style={{ fontFamily: "'JetBrains Mono', monospace" }}
                >
                  {l.costoUnitario != null ? fmtMoneda(l.costoUnitario) : '—'}
                </td>
                <td
                  className="py-2 px-3 text-right text-foreground whitespace-nowrap tabular-nums"
                  style={{ fontFamily: "'JetBrains Mono', monospace" }}
                >
                  {fmtNumero(l.saldo, 2)}
                </td>
                <td
                  className="py-2 px-3 text-right text-secondary whitespace-nowrap hidden md:table-cell"
                  style={{ fontFamily: "'JetBrains Mono', monospace" }}
                >
                  {fmtMoneda(l.saldoValorizado)}
                </td>
                <td className="py-2 px-3 text-muted-foreground text-xs hidden lg:table-cell">
                  {l.usuario}
                </td>
                <td className="py-2 px-3 text-xs text-muted-foreground hidden lg:table-cell">
                  {l.compra ? (
                    <span title={l.compra.proveedor ?? ''}>
                      {l.compra.codigo}
                      {l.compra.numeroFactura ? ` · ${l.compra.numeroFactura}` : ''}
                    </span>
                  ) : (
                    '—'
                  )}
                </td>
              </tr>
            ))}
            {/* Saldo final */}
            <tr className="border-t-2 border-border bg-muted/30">
              <td
                className="py-2 px-3 text-foreground font-semibold"
                style={{ fontFamily: "'JetBrains Mono', monospace" }}
              >
                Saldo final
              </td>
              <td colSpan={2} />
              <td
                className="py-2 px-3 text-right text-foreground font-semibold tabular-nums"
                style={{ fontFamily: "'JetBrains Mono', monospace" }}
              >
                {fmtNumero(data.saldoFinal, 2)} {data.producto.unidad}
              </td>
              <td
                className="py-2 px-3 text-right text-foreground font-semibold hidden md:table-cell"
                style={{ fontFamily: "'JetBrains Mono', monospace" }}
              >
                {fmtMoneda(data.costoPromedioFinal)}
              </td>
              <td
                className="py-2 px-3 text-right text-secondary font-semibold hidden md:table-cell"
                style={{ fontFamily: "'JetBrains Mono', monospace" }}
              >
                {fmtMoneda(data.saldoFinalValorizado)}
              </td>
              <td colSpan={2} className="hidden lg:table-cell" />
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ───────────────────────────────────────────────────────────────────
//  Índice: ReportesIndex (cards clickeables)
// ───────────────────────────────────────────────────────────────────

/** Índice de Reportes. Cards clickeables a cada sub-módulo. */
export function ReportesIndex() {
  const auth = useAuth()
  const permisosUsuario = new Set(
    auth.status === 'autenticado' ? auth.sesion.permisos : [],
  )
  const visibles = SUBMODULOS.filter((s) => permisosUsuario.has(s.permiso))

  return (
    <div className="flex-1 flex flex-col min-w-0 min-h-0">
      <PageHeader
        title="Reportes"
        subtitle="STOCKPRO · REPORTES DISPONIBLES"
      />

      <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {visibles.map((sub) => {
            const Icon = sub.icon
            return (
              <Link
                key={sub.key}
                to={`/reportes/${sub.key}`}
                className="group bg-card border border-border p-5 hover:border-primary/40 transition-colors"
                style={{ borderRadius: '0.25rem' }}
              >
                <div className="w-10 h-10 bg-primary/15 flex items-center justify-center mb-4 group-hover:bg-primary/25 transition-colors">
                  <Icon size={18} className="text-primary" />
                </div>
                <h3
                  className="text-lg uppercase text-foreground"
                  style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800 }}
                >
                  {sub.label}
                </h3>
                <p
                  className="mt-1 text-xs text-muted-foreground"
                  style={{ fontFamily: "'DM Sans', sans-serif" }}
                >
                  {sub.descripcion}
                </p>
              </Link>
            )
          })}
        </div>
      </div>
    </div>
  )
}
