const plans = [
  {
    name: 'inicial',
    price: 49,
    desc: 'para bodegas que están digitalizando sus primeras operaciones.',
    features: [
      'hasta 2 usuarios',
      '1.000 sku activos',
      'app móvil incluida',
      'soporte por email',
      'reportes básicos',
    ],
    cta: 'Empezar',
    highlight: false,
  },
  {
    name: 'pro',
    price: 149,
    desc: 'la opción más elegida por operadores logísticos en crecimiento.',
    features: [
      'hasta 15 usuarios',
      'sku ilimitados',
      'mapa de bodega 3d',
      'integración con erp',
      'soporte 24/7',
      'auditoría firmada',
    ],
    cta: 'Prueba 14 días',
    highlight: true,
  },
  {
    name: 'enterprise',
    price: null,
    desc: 'multi-bodega, rpa personalizado y sla dedicado.',
    features: [
      'usuarios ilimitados',
      'multi-sede',
      'api dedicada',
      'gerente de cuenta',
      'capacitación on-site',
      'sla 99.9%',
    ],
    cta: 'Hablar con ventas',
    highlight: false,
  },
]

export function Pricing() {
  return (
    <section id="pricing" className="py-24">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center mb-12">
          <div
            className="text-xs text-muted-foreground uppercase tracking-widest mb-3"
            style={{ fontFamily: "'JetBrains Mono', monospace" }}
          >
            — PRECIOS
          </div>
          <h2
            className="text-5xl md:text-6xl uppercase text-foreground leading-none"
            style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900 }}
          >
            planes que <span className="text-primary">crecen contigo</span>
          </h2>
          <p
            className="mt-4 text-sm text-muted-foreground max-w-xl mx-auto"
            style={{ fontFamily: "'DM Sans', sans-serif" }}
          >
            sin contratos forzosos, sin letra chica. cancelas cuando quieras y te quedas con tus
            datos exportados.
          </p>
        </div>

        <div className="grid sm:grid-cols-3 gap-6">
          {plans.map((p) => (
            <div
              key={p.name}
              className={`relative bg-card border ${
                p.highlight ? 'border-secondary' : 'border-border'
              } p-6 flex flex-col`}
            >
              {p.highlight && (
                <>
                  <div className="absolute top-0 inset-x-0 h-0.5 bg-secondary" />
                  <div
                    className="absolute -top-3 left-1/2 -translate-x-1/2 bg-secondary text-secondary-foreground px-3 py-1 text-xs"
                    style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 500 }}
                  >
                    POPULAR
                  </div>
                </>
              )}

              <h3
                className="text-2xl text-foreground uppercase"
                style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800 }}
              >
                {p.name}
              </h3>

              <p
                className="mt-2 text-sm text-muted-foreground leading-relaxed"
                style={{ fontFamily: "'DM Sans', sans-serif" }}
              >
                {p.desc}
              </p>

              <div className="mt-6 flex items-baseline gap-1">
                {p.price !== null ? (
                  <>
                    <span
                      className="text-5xl text-foreground"
                      style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900 }}
                    >
                      ${p.price}
                    </span>
                    <span
                      className="text-sm text-muted-foreground"
                      style={{ fontFamily: "'JetBrains Mono', monospace" }}
                    >
                      /mes
                    </span>
                  </>
                ) : (
                  <span
                    className="text-4xl text-foreground"
                    style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800 }}
                  >
                    a medida
                  </span>
                )}
              </div>

              <ul className="mt-6 space-y-3 flex-1">
                {p.features.map((f) => (
                  <li
                    key={f}
                    className="flex items-start gap-2 text-sm text-foreground"
                    style={{ fontFamily: "'DM Sans', sans-serif" }}
                  >
                    <span className="text-secondary mt-0.5">✓</span>
                    <span>{f}</span>
                  </li>
                ))}
              </ul>

              <button
                className={`mt-8 w-full py-3 text-sm font-medium ${
                  p.highlight
                    ? 'bg-secondary text-secondary-foreground hover:opacity-90'
                    : 'border border-border text-foreground hover:border-foreground/40'
                } transition-all`}
              >
                {p.cta}
              </button>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
