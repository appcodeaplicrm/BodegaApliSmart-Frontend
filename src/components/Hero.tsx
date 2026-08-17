import { ArrowRight, ChevronRight } from 'lucide-react'

// Tamaño y posición libre del operador.
// - `height`: cambia el tamaño de la imagen.
// - `left`: mueve horizontalmente.
// - `bottom`: mueve verticalmente.
const HERO_WORKER_STYLE = {
  height: '120%',
  left: '43%',
  bottom: '-37px',
  transform: 'translateX(-50%)',
}

export function Hero() {
  return (
    <section className="pt-20 pb-16 sm:pb-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="grid md:grid-cols-[0.9fr_1.1fr] gap-8 md:gap-10 items-center">
          <div>
            <h1
              className="text-6xl sm:text-7xl md:text-8xl lg:text-8xl uppercase leading-[0.95] text-foreground break-words"
              style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900 }}
            >
              controla tu
              <br />
              <span className="text-primary">bodega</span> como
              <br />
              un <span className="text-secondary">operador</span>
            </h1>

            <p
              className="mt-4 sm:mt-3 text-base text-muted-foreground max-w-md leading-relaxed"
              style={{ fontFamily: "'DM Sans', sans-serif" }}
            >
              BodegaApliSmart centraliza entradas, salidas, picking e inventario en una sola plataforma
              diseñada para operaciones de logística y supply chain en latinoamérica.
            </p>

            <div className="mt-6 flex flex-col sm:flex-row gap-3">
              <button className="group min-h-[44px] inline-flex items-center justify-center gap-2 px-6 py-3 bg-primary text-primary-foreground text-sm font-medium">
                Empezar prueba gratis
                <ArrowRight
                  size={16}
                  className="group-hover:translate-x-0.5 transition-transform"
                />
              </button>
              <button className="group min-h-[44px] inline-flex items-center justify-center gap-2 px-6 py-3 border border-border text-foreground text-sm font-medium hover:border-foreground/40 transition-colors">
                Ver demo en vivo
                <ChevronRight
                  size={16}
                  className="group-hover:translate-x-0.5 transition-transform"
                />
              </button>
            </div>

            <div className="mt-6 pt-4 border-t border-border grid grid-cols-3 gap-3 sm:gap-6">
              <Metric value="98.7%" label="precisión" />
              <Metric value="2.4x" label="más rápido" />
              <Metric value="24/7" label="operación" />
            </div>
          </div>
          <div
            className="pointer-events-none absolute inset-[10%] z-0 rounded-full blur-1xl"
            style={{
              background:
                'radial-gradient(circle at 85% 90%, rgba(255, 92, 0) 0%, rgba(255, 30, 0,0.1) 45%, rgba(116,78,34,0.10) 54%, rgba(36,36,36,0) 74%)',
            }}
          />
          <HeroImage />
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

function HeroImage() {
  return (
    <div className="relative w-full overflow-visible aspect-[4/3]">
      <img
        src="/hero-warehouse-worker.png"
        alt="Operador de bodega transportando una caja"
        className="absolute z-10 block w-auto max-w-none object-contain object-bottom"
        style={HERO_WORKER_STYLE}
        loading="eager"
        fetchPriority="high"
      />
    </div>
  )
}
