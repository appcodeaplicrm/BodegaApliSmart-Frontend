import type { ReactNode } from 'react'

/**
 * PageHeader — Header estándar para todas las pantallas autenticadas.
 *
 * Mismo estilo que el header de Dashboard: altura fija `h-14`, título
 * `text-2xl` en Barlow Condensed, subtítulo `text-[10px] tracking-widest`
 * en JetBrains Mono, y slot derecho para acciones (botones, selects).
 *
 * Uso:
 *   <PageHeader
 *     title="INVENTARIO"
 *     subtitle="STOCKPRO · PANEL CENTRAL"
 *     actions={<SearchInput ... />}
 *   />
 */
type Props = {
  /** Título principal (se renderiza en MAYÚSCULAS). */
  title: string
  /** Subtítulo (se renderiza en mayúsculas automáticas por el CSS). */
  subtitle?: string
  /** Slot derecho: botones, selects, etc. */
  actions?: ReactNode
}

export function PageHeader({ title, subtitle, actions }: Props) {
  return (
    <header className="h-14 border-b border-border px-6 flex items-center justify-between shrink-0 gap-3">
      <div className="min-w-0">
        <h1
          className="text-2xl uppercase text-foreground leading-none"
          style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900 }}
        >
          {title}
        </h1>
        {subtitle && (
          <div
            className="text-[10px] text-muted-foreground uppercase tracking-widest mt-1"
            style={{ fontFamily: "'JetBrains Mono', monospace" }}
          >
            {subtitle}
          </div>
        )}
      </div>
      {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
    </header>
  )
}
