import { useState, type ReactNode } from 'react'
import { ChevronDown, Check } from 'lucide-react'
import { Modal } from './Modal'

/**
 * SelectMobile — Select responsive.
 *
 * Comportamiento:
 *  - mobile (<sm): se renderiza como un botón con look de select.
 *    Al tap, abre un `Modal` con la lista de opciones. Cero dependencia
 *    del dropdown nativo del navegador (que en iOS/Android suele verse
 *    mal y ocupar media pantalla con un overlay del sistema).
 *  - desktop (sm+): renderiza un `<select>` HTML nativo. Más rápido,
 *    accesible por teclado, integrado con el form del navegador.
 *
 * Props: mismas que un `<select>` estándar (`value`, `onChange`,
 * `options`, `placeholder`, `disabled`, `id`, `aria-label`).
 *
 * `options` puede ser:
 *  - `string[]`: para listas planas.
 *  - `{ value: string; label: string }[]`: para value distinto del label.
 */
export type SelectOption = string | { value: string; label: string }

function normalize(opts: SelectOption[]): { value: string; label: string }[] {
  return opts.map((o) => (typeof o === 'string' ? { value: o, label: o } : o))
}

type Props = {
  value: string
  onChange: (value: string) => void
  options: SelectOption[]
  /** Etiqueta corta que se muestra en el botón cuando el valor no
   *  coincide con ninguna label (ej: el placeholder). */
  placeholder?: string
  /** Prefix que se muestra en el botón (ej: "Categoría: "). */
  prefix?: string
  disabled?: boolean
  id?: string
  'aria-label'?: string
  className?: string
  /** Label visible arriba del select (en mobile aparece como title del modal). */
  label?: string
}

export function SelectMobile({
  value,
  onChange,
  options,
  placeholder,
  prefix,
  disabled,
  id,
  'aria-label': ariaLabel,
  className = '',
  label,
}: Props) {
  const [open, setOpen] = useState(false)
  const norm = normalize(options)
  const selected = norm.find((o) => o.value === value)
  const displayText = selected?.label ?? placeholder ?? 'Seleccionar…'

  // Detect mobile: el componente switch nativo (`<select>`) se renderiza
  // SIEMPRE, pero en mobile lo ocultamos visualmente y dejamos solo el
  // botón custom. El `<select>` real se usa para la accesibilidad
  // (lectores de pantalla) y como fallback del form.
  return (
    <>
      {/* MOBILE: botón custom que abre el Modal */}
      <button
        type="button"
        onClick={() => !disabled && setOpen(true)}
        disabled={disabled}
        aria-label={ariaLabel}
        className={[
          'sm:hidden',
          'w-full min-h-[44px] px-3 bg-muted border border-border',
          'text-sm text-foreground outline-none focus:border-primary/60',
          'flex items-center justify-between gap-2 text-left',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          className,
        ].join(' ')}
        style={{ borderRadius: '0.25rem', fontFamily: "'DM Sans', sans-serif" }}
      >
        <span className="truncate">
          {prefix && <span className="text-muted-foreground">{prefix}</span>}
          {displayText}
        </span>
        <ChevronDown size={14} className="text-muted-foreground shrink-0" />
      </button>

      {/* DESKTOP: select nativo, oculto en mobile */}
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        aria-label={ariaLabel}
        className={[
          'hidden sm:block',
          'px-3 py-1.5 min-h-[36px] sm:min-h-[32px]',
          'bg-muted border border-border text-xs text-foreground',
          'outline-none focus:border-primary/60',
          'disabled:opacity-50',
          className,
        ].join(' ')}
        style={{ borderRadius: '0.25rem', fontFamily: "'JetBrains Mono', monospace" }}
      >
        {placeholder && (
          <option value="" disabled hidden>
            {placeholder}
          </option>
        )}
        {norm.map((o) => (
          <option key={o.value} value={o.value}>
            {prefix ? `${prefix}${o.label}` : o.label}
          </option>
        ))}
      </select>

      {/* MOBILE: Modal con la lista de opciones */}
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={label ?? ariaLabel ?? 'Seleccionar'}
        size="sm"
      >
        <ul className="py-1 max-h-[60dvh] overflow-y-auto">
          {norm.length === 0 ? (
            <li className="px-4 py-6 text-center text-sm text-muted-foreground">
              Sin opciones
            </li>
          ) : (
            norm.map((o) => {
              const isActive = o.value === value
              return (
                <li key={o.value}>
                  <button
                    type="button"
                    onClick={() => {
                      onChange(o.value)
                      setOpen(false)
                    }}
                    className={[
                      'w-full min-h-[48px] flex items-center gap-3 px-4 py-3',
                      'text-left transition-colors border-b border-border last:border-b-0',
                      isActive
                        ? 'bg-primary/10 text-foreground'
                        : 'text-foreground hover:bg-muted active:bg-muted',
                    ].join(' ')}
                  >
                    <span className="flex-1 text-sm">
                      {prefix && (
                        <span className="text-muted-foreground mr-1">{prefix}</span>
                      )}
                      {o.label}
                    </span>
                    {isActive && <Check size={18} className="text-primary shrink-0" />}
                  </button>
                </li>
              )
            })
          )}
        </ul>
      </Modal>
    </>
  )
}

/**
 * Helper: usar como children en vez de options cuando se necesita un
 * render custom. Por ahora el componente acepta solo el array.
 * Dejado para uso futuro si necesitamos items con iconos.
 */
export type { Props as SelectMobileProps }
export function SelectMobileIcon({
  icon,
  ...rest
}: Props & { icon: ReactNode }) {
  return (
    <div className="relative">
      {icon}
      <div className="absolute inset-0">
        <SelectMobile {...rest} />
      </div>
    </div>
  )
}
