import { TrendingUp, ArrowRight } from 'lucide-react'

export function CTAFinal() {
  return (
    <section className="py-24">
      <div className="max-w-3xl mx-auto px-6 text-center">
        <div className="inline-flex w-14 h-14 bg-muted items-center justify-center">
          <TrendingUp size={24} className="text-primary" />
        </div>

        <h2
          className="mt-6 text-5xl md:text-6xl uppercase text-foreground leading-none"
          style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900 }}
        >
          lleva tu bodega al <span className="text-secondary">siguiente nivel</span>
        </h2>

        <p
          className="mt-4 text-sm text-muted-foreground max-w-lg mx-auto"
          style={{ fontFamily: "'DM Sans', sans-serif" }}
        >
          14 días de prueba sin tarjeta. importa tu inventario, conecta tu equipo y decide con
          datos reales de tu operación.
        </p>

        <form
          onSubmit={(e) => e.preventDefault()}
          className="mt-8 flex flex-col sm:flex-row gap-3 max-w-md mx-auto"
        >
          <input
            type="email"
            placeholder="tu correo corporativo"
            className="flex-1 bg-muted border border-border px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
            style={{ fontFamily: "'DM Sans', sans-serif" }}
          />
          <button
            type="submit"
            className="group inline-flex items-center justify-center gap-2 px-6 py-3 bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity"
          >
            Empezar ahora
            <ArrowRight
              size={16}
              className="group-hover:translate-x-0.5 transition-transform"
            />
          </button>
        </form>
      </div>
    </section>
  )
}
