import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { ArrowRight, ChevronRight, ScanBarcode } from 'lucide-react'

const chartData = [
  { day: 'Lun', entradas: 320, salidas: 240 },
  { day: 'Mar', entradas: 410, salidas: 290 },
  { day: 'Mié', entradas: 380, salidas: 360 },
  { day: 'Jue', entradas: 520, salidas: 410 },
  { day: 'Vie', entradas: 480, salidas: 450 },
  { day: 'Sáb', entradas: 610, salidas: 520 },
  { day: 'Dom', entradas: 390, salidas: 310 },
]

export function Hero() {
  return (
    <section className="pt-20 pb-24">
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid md:grid-cols-2 gap-12 items-center">
          <div>
            <h1
              className="text-6xl md:text-8xl uppercase leading-none text-foreground"
              style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900 }}
            >
              controla tu
              <br />
              <span className="text-primary">bodega</span> como
              <br />
              un <span className="text-secondary">operador</span>
            </h1>

            <p
              className="mt-3 text-base text-muted-foreground max-w-md leading-relaxed"
              style={{ fontFamily: "'DM Sans', sans-serif" }}
            >
              stockpro centraliza entradas, salidas, picking e inventario en una sola plataforma
              diseñada para operaciones de logística y supply chain en latinoamérica.
            </p>

            <div className="mt-4 flex flex-col sm:flex-row gap-3">
              <button className="group inline-flex items-center justify-center gap-2 px-6 py-3 bg-primary text-primary-foreground text-sm font-medium">
                Empezar prueba gratis
                <ArrowRight
                  size={16}
                  className="group-hover:translate-x-0.5 transition-transform"
                />
              </button>
              <button className="group inline-flex items-center justify-center gap-2 px-6 py-3 border border-border text-foreground text-sm font-medium hover:border-foreground/40 transition-colors">
                Ver demo en vivo
                <ChevronRight
                  size={16}
                  className="group-hover:translate-x-0.5 transition-transform"
                />
              </button>
            </div>

            <div className="mt-6 pt-4 border-t border-border grid grid-cols-3 gap-6">
              <Metric value="98.7%" label="precisión" />
              <Metric value="2.4x" label="más rápido" />
              <Metric value="24/7" label="operación" />
            </div>
          </div>

          <DashboardCard />
        </div>
      </div>
    </section>
  )
}

function Metric({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <div
        className="text-2xl text-foreground"
        style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800 }}
      >
        {value}
      </div>
      <div
        className="text-xs text-muted-foreground uppercase tracking-widest mt-1"
        style={{ fontFamily: "'JetBrains Mono', monospace" }}
      >
        {label}
      </div>
    </div>
  )
}

function DashboardCard() {
  return (
    <div className="relative bg-card border border-border p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <div
            className="text-xs text-muted-foreground uppercase tracking-widest"
            style={{ fontFamily: "'JetBrains Mono', monospace" }}
          >
            flujo semanal
          </div>
          <div
            className="text-xl text-foreground mt-1"
            style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800 }}
          >
            movimiento de stock
          </div>
        </div>
        <div
          className="text-xs text-secondary px-2 py-1 border border-secondary/40"
          style={{ fontFamily: "'JetBrains Mono', monospace" }}
        >
          +18.4%
        </div>
      </div>

      <div className="h-48">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 5, right: 5, bottom: 5, left: 0 }}>
            <defs>
              <linearGradient id="ent" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#E8593F" stopOpacity={0.5} />
                <stop offset="100%" stopColor="#E8593F" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="sal" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#ABF768" stopOpacity={0.4} />
                <stop offset="100%" stopColor="#ABF768" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis
              dataKey="day"
              stroke="#888880"
              tick={{ fontSize: 10, fontFamily: "'JetBrains Mono', monospace" }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis hide />
            <Tooltip
              contentStyle={{
                background: '#2E2E2E',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 4,
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 12,
              }}
              labelStyle={{ color: '#F5F2EC' }}
            />
            <Area
              type="monotone"
              dataKey="entradas"
              stroke="#E8593F"
              strokeWidth={2}
              fill="url(#ent)"
            />
            <Area
              type="monotone"
              dataKey="salidas"
              stroke="#ABF768"
              strokeWidth={2}
              fill="url(#sal)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2 pt-4 border-t border-border">
        <Kpi label="entradas" value="3.110" color="text-primary" />
        <Kpi label="salidas" value="2.580" color="text-secondary" />
        <Kpi label="neto" value="+530" color="text-foreground" />
      </div>

      <div className="absolute -bottom-3 -left-3 bg-secondary text-secondary-foreground px-3 py-1.5 text-xs flex items-center gap-1.5">
        <ScanBarcode size={12} />
        <span style={{ fontFamily: "'JetBrains Mono', monospace" }}>SCAN EN VIVO</span>
      </div>
    </div>
  )
}

function Kpi({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div>
      <div className={`text-lg ${color}`} style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800 }}>
        {value}
      </div>
      <div
        className="text-[10px] text-muted-foreground uppercase tracking-widest"
        style={{ fontFamily: "'JetBrains Mono', monospace" }}
      >
        {label}
      </div>
    </div>
  )
}
