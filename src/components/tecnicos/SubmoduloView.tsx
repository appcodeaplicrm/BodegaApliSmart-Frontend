import { Plus, Inbox } from 'lucide-react'
import type { Submodulo } from './tecnicos'
import { PageHeader } from '../PageHeader'

type SubmoduloViewProps = {
  sub: Submodulo
}

export function SubmoduloView({ sub }: SubmoduloViewProps) {
  return (
    <div className="flex-1 flex flex-col min-w-0 min-h-0">
      <PageHeader
        title={sub.label}
        subtitle="BodegaApliSmart · TÉCNICOS"
        actions={
          <button
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground text-xs font-medium hover:opacity-90 transition-opacity"
            style={{ borderRadius: '0.25rem' }}
          >
            <Plus size={13} />
            {sub.accion}
          </button>
        }
      />

      <div className="flex-1 overflow-y-auto p-8 space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {sub.kpis.map((k) => (
            <div
              key={k.label}
              className="bg-card border border-border p-4"
              style={{ borderRadius: '0.25rem' }}
            >
              <div
                className="text-[10px] text-muted-foreground tracking-widest uppercase"
                style={{ fontFamily: "'JetBrains Mono', monospace" }}
              >
                {k.label}
              </div>
              <div
                className={`text-3xl leading-none mt-1.5 ${k.accent}`}
                style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800 }}
              >
                {k.value}
              </div>
            </div>
          ))}
        </div>

        <div
          className="bg-card border border-border py-20 px-6 flex flex-col items-center justify-center text-center"
          style={{ borderRadius: '0.25rem' }}
        >
          <div className="w-14 h-14 bg-muted flex items-center justify-center mb-5">
            <Inbox size={24} className="text-muted-foreground" />
          </div>
          <h3
            className="text-xl uppercase text-foreground"
            style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800 }}
          >
            Sin registros
          </h3>
          <p
            className="mt-2 text-sm text-muted-foreground max-w-sm"
            style={{ fontFamily: "'DM Sans', sans-serif" }}
          >
            Aún no hay datos en {sub.label.toLowerCase()}. Crea el primer registro.
          </p>
        </div>
      </div>
    </div>
  )
}
