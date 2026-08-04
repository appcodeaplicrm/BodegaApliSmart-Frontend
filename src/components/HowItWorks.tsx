const steps = [
  {
    n: '01',
    title: 'conecta tu operación',
    desc: 'importa sku, clientes y proveedores desde excel o tu erp. los históricos quedan disponibles desde el primer día.',
  },
  {
    n: '02',
    title: 'mapea tu bodega',
    desc: 'define pasillos, racks y posiciones con la cámara del celular. el sistema sugiere la mejor distribución por rotación.',
  },
  {
    n: '03',
    title: 'opera con el equipo',
    desc: 'tu gente de bodega usa la app móvil para escanear y registrar. tú ves todo desde el panel web.',
  },
  {
    n: '04',
    title: 'decide con datos',
    desc: 'reportes automáticos de rotación, cobertura y mermas. alertas cuando un sku cae bajo el mínimo de seguridad.',
  },
]

export function HowItWorks() {
  return (
    <section id="how" className="py-24 bg-muted/20">
      <div className="max-w-7xl mx-auto px-6">
        <div className="mb-12">
          <div
            className="text-xs text-muted-foreground uppercase tracking-widest mb-3"
            style={{ fontFamily: "'JetBrains Mono', monospace" }}
          >
            — CÓMO FUNCIONA
          </div>
          <h2
            className="text-5xl md:text-6xl uppercase text-foreground leading-none"
            style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900 }}
          >
            operativo en <span className="text-secondary">4 pasos</span>
          </h2>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8">
          {steps.map((s) => (
            <div key={s.n} className="relative">
              <div
                className="text-6xl text-foreground/5 leading-none"
                style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900 }}
              >
                {s.n}
              </div>
              <div className="w-8 h-0.5 bg-primary my-4" />
              <h3
                className="text-2xl text-foreground uppercase leading-tight"
                style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800 }}
              >
                {s.title}
              </h3>
              <p
                className="mt-3 text-sm text-muted-foreground leading-relaxed"
                style={{ fontFamily: "'DM Sans', sans-serif" }}
              >
                {s.desc}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
