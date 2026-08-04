import {
  Package,
  BarChart3,
  Truck,
  ScanBarcode,
  ShieldCheck,
  Boxes,
  ArrowRight,
} from 'lucide-react'

const features = [
  {
    icon: Package,
    tag: 'RECEPCIÓN',
    title: 'control de entradas',
    desc: 'registra recepciones contra orden de compra con escaneo de código de barras y validación de lotes.',
  },
  {
    icon: BarChart3,
    tag: 'TRACKING',
    title: 'métricas en vivo',
    desc: 'rotación de stock, días de inventario y cobertura calculados en tiempo real sobre tu operación.',
  },
  {
    icon: Truck,
    tag: 'DESPACHO',
    title: 'picking y packing',
    desc: 'rutas optimizadas para preparar pedidos, con verificación por serie y confirmación al cargar.',
  },
  {
    icon: ScanBarcode,
    tag: 'IDENTIDAD',
    title: 'códigos y series',
    desc: 'lector bluetooth, cámara del celular o terminal industrial — todo sincroniza contra el mismo sku.',
  },
  {
    icon: ShieldCheck,
    tag: 'AUDITORÍA',
    title: 'trazabilidad total',
    desc: 'cada movimiento queda firmado por usuario, hora y ubicación. historial completo por 24 meses.',
  },
  {
    icon: Boxes,
    tag: 'UBICACIONES',
    title: 'mapa de bodega',
    desc: 'visualiza pasillo, rack, nivel y posición. reasigna ubicaciones sin tocar la base manualmente.',
  },
]

export function Features() {
  return (
    <section id="features" className="py-24">
      <div className="max-w-7xl mx-auto px-6">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6 mb-12">
          <div>
            <div
              className="text-xs text-muted-foreground uppercase tracking-widest mb-3"
              style={{ fontFamily: "'JetBrains Mono', monospace" }}
            >
              — FUNCIONALIDADES
            </div>
            <h2
              className="text-5xl md:text-6xl uppercase text-foreground leading-none"
              style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900 }}
            >
              todo lo que tu <span className="text-primary">bodega</span> necesita
            </h2>
          </div>
          <p
            className="text-sm text-muted-foreground max-w-sm leading-relaxed"
            style={{ fontFamily: "'DM Sans', sans-serif" }}
          >
            módulos independientes que conectan entre sí. activa solo los que tu operación usa hoy y
            suma el resto cuando escales.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {features.map((f) => {
            const Icon = f.icon
            return (
              <div
                key={f.tag}
                className="group bg-card border border-border p-6 hover:border-primary/40 transition-all"
              >
                <div className="w-10 h-10 bg-muted flex items-center justify-center group-hover:text-primary transition-colors">
                  <Icon size={20} className="text-foreground group-hover:text-primary transition-colors" />
                </div>

                <div
                  className="mt-5 text-xs text-muted-foreground uppercase tracking-widest"
                  style={{ fontFamily: "'JetBrains Mono', monospace" }}
                >
                  {f.tag}
                </div>

                <h3
                  className="mt-2 text-2xl text-foreground uppercase leading-tight"
                  style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800 }}
                >
                  {f.title}
                </h3>

                <p
                  className="mt-3 text-sm text-muted-foreground leading-relaxed"
                  style={{ fontFamily: "'DM Sans', sans-serif" }}
                >
                  {f.desc}
                </p>

                <div
                  className="mt-5 flex items-center gap-1 text-sm text-primary opacity-0 group-hover:opacity-100 transition-opacity"
                  style={{ fontFamily: "'JetBrains Mono', monospace" }}
                >
                  Saber más
                  <ArrowRight size={14} />
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
