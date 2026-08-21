/**
 * Wrappers con JSX para mostrar / capturar valores monetarios
 * respetando el permiso `valores.ver`.
 *
 * **Comportamiento actual (post-cambio)**:
 * - `<ValorBlur value={n} />` para LECTURA (tablas, KPIs, cards).
 *   Si el user tiene permiso, formatea con `formatMoney`. Si NO, muestra
 *   `🔒 ***` (configurable via `fallback`).
 *
 * - `<ValorInputBlur value={n} onChange? />` para EDICIÓN (modales de
 *   crear/editar). Si el user tiene permiso, renderiza un input numérico
 *   editable. Si NO tiene permiso, **oculta el input** y muestra un
 *   span con `🔒 ***` — pero el `value` real sigue en el state del
 *   padre y se manda al back en el submit, así un bodeguero sin
 *   permiso puede registrar una compra sin ver el número.
 *
 * El back SIEMPRE devuelve los campos monetarios con el valor real
 * (no redactamos a `null`). El control de visibilidad es 100% del
 * front. Ver `common/redact-valores.interceptor.ts` (desactivado
 * por defecto, se puede reactivar borrando los `//`).
 *
 * Para más detalles del porqué de esta decisión, ver comentario en
 * `seed.ts` sobre el permiso `valores.ver`.
 */
import { usePuedeVerValores } from '../hooks/usePuedeVerValores'
import { formatMoney, VALOR_BLUR } from './format'

export function ValorBlur({
  value,
  render,
  fallback,
}: {
  value: number | null | undefined
  render?: (formatted: string) => React.ReactNode
  fallback?: React.ReactNode
}) {
  const puedeVer = usePuedeVerValores()
  if (!puedeVer) return <>{fallback ?? VALOR_BLUR}</>
  const formatted = formatMoney(value)
  return <>{render ? render(formatted) : formatted}</>
}

/**
 * Input de precio con visibilidad controlada por `valores.ver`.
 *
 * - **Con permiso**: renderiza un `<input type="number">` normal.
 *   El padre controla el `value` y recibe cambios via `onChange`.
 *
 * - **Sin permiso**: renderiza un `<span>` con `🔒 ***`. NO renderiza
 *   ningún input, por lo que el padre no recibe interacción del
 *   usuario en este campo. El value real (que el padre ya tiene en
 *   su state, producto del cálculo automático desde el producto)
 *   se manda al back en el submit. Esto permite que un bodeguero
 *   sin permiso pueda registrar una compra sin ver el número.
 *
 * Props:
 * - `value`: el valor numérico (real, no el redactado).
 * - `onChange`: callback opcional `(n: number | '') => void`. Solo se
 *   invoca si el user tiene permiso.
 * - `name`, `placeholder`, `className`, `disabled`: igual que un
 *   `<input>` estándar.
 * - `asCurrency` (opcional): si es `true`, el `<span>` oculto muestra
 *   el valor formateado con `formatMoney` en vez de `🔒 ***`. Útil
 *   cuando querés mostrar el número pero en un span en vez de input.
 *   Por default es `false` (oculta).
 */
export function ValorInputBlur({
  value,
  onChange,
  name,
  placeholder,
  className,
  disabled,
  asCurrency = false,
}: {
  value: number | string | null | undefined
  onChange?: (next: number | '') => void
  name?: string
  placeholder?: string
  className?: string
  disabled?: boolean
  /**
   * Si es `true` y el user NO tiene permiso, en vez de mostrar
   * `🔒 ***` muestra el valor formateado en un span (mismo visual
   * que `ValorBlur` pero con el shape de input). Útil para casos
   * donde querés "ocultar" la editabilidad pero mostrar el dato.
   */
  asCurrency?: boolean
}) {
  const puedeVer = usePuedeVerValores()
  if (!puedeVer) {
    // Sin permiso: NO renderizamos input. Mostramos un span con
    // `🔒 ***` (o el valor formateado si `asCurrency`).
    return (
      <span
        className={className}
        style={{ display: 'inline-block' }}
        title="No tienes permiso para editar valores monetarios."
        data-bloqueado="valores"
      >
        {asCurrency ? formatMoney(Number(value)) : VALOR_BLUR}
      </span>
    )
  }
  return (
    <input
      type="number"
      name={name}
      value={value ?? ''}
      placeholder={placeholder}
      disabled={disabled}
      className={className}
      onChange={(e) => {
        if (!onChange) return
        const raw = e.target.value
        onChange(raw === '' ? '' : Number(raw))
      }}
    />
  )
}
