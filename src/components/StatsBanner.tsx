const stats = [
  { value: '1.200+', label: 'bodegas operando' },
  { value: '18M', label: 'movimientos / mes' },
  { value: '99.9%', label: 'uptime garantizado' },
  { value: '24/7', label: 'soporte local' },
]

export function StatsBanner() {
  return (
    <section className="bg-primary py-16">
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          {stats.map((s) => (
            <div key={s.label}>
              <div
                className="text-5xl md:text-6xl text-primary-foreground leading-none"
                style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900 }}
              >
                {s.value}
              </div>
              <div
                className="mt-3 text-xs text-primary-foreground/80 uppercase tracking-widest"
                style={{ fontFamily: "'JetBrains Mono', monospace" }}
              >
                {s.label}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
