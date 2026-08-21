import { ArrowRight, ChevronRight } from 'lucide-react'

export function Hero() {
  return (
    <section className="pt-20 pb-16 sm:pb-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="relative grid md:grid-cols-[0.9fr_1.1fr] gap-8 md:gap-10 items-center">
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
            aria-hidden="true"
            className="pointer-events-none absolute -inset-[2%] z-0 hidden rounded-full blur-1xl md:block
              [background:radial-gradient(circle_at_85%_90%,rgba(255,92,0)_0%,rgba(255,30,0,0.1)_45%,rgba(116,78,34,0.10)_54%,rgba(36,36,36,0)_74%)]"
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
    <div className="relative isolate w-full overflow-visible aspect-[16/10] md:aspect-[4/3]">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute z-0 top-[-7%] bottom-[-17%] -left-[35%] -right-[5%] rounded-r-[999px] blur-1xl md:hidden
          [background:radial-gradient(ellipse_at_82%_72%,rgba(255,92,0,1)_0%,rgba(255,30,0,0.34)_30%,rgba(116,78,34,0.20)_55%,rgba(36,36,36,0)_78%)]
          "
      />
      <img
        src="/hero-warehouse-worker.png"
        alt="Operador de bodega transportando una caja"
        className="absolute z-10 block w-auto max-w-none object-contain object-bottom
          h-[138%] left-[50%] -bottom-11 -translate-x-1/2
          md:h-[120%] md:left-[43%] md:-bottom-[37px]"
        loading="eager"
        fetchPriority="high"
      />
    </div>
  )
}
