const clients = [
  'LOGÍSTICA ANDINA',
  'CARGO PACÍFICO',
  'DISTRIBUIDORA EL MUELLE',
  'TRANSPORTE SUR',
  'ALMACENES RIONEGRO',
  'GRUPO BODEGA CENTRAL',
  'EXPRESS CARGO',
  'OPERADOR LOGÍSTICO ZONA FRANCA',
]

export function ClientTicker() {
  const row = (
    <div className="flex items-center gap-12 px-6 shrink-0">
      {clients.map((name) => (
        <span
          key={name}
          className="text-sm text-foreground/80 tracking-widest uppercase whitespace-nowrap"
          style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700 }}
        >
          {name}
          <span className="text-primary mx-12">◆</span>
        </span>
      ))}
    </div>
  )

  return (
    <section className="border-y border-border bg-muted/30 py-5 overflow-hidden">
      <div className="flex animate-marquee w-max">
        {row}
        {row}
      </div>
    </section>
  )
}
