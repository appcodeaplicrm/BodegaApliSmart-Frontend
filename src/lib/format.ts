/**
 * Helpers globales de formato (puros, sin JSX).
 *
 * - `formatMoney(n)`: formatea con COP, 2 decimales, separador de
 *   miles con `.` (es-CO). No depende del permiso. Lo usan lugares
 *   donde NO se necesita el blur (ej: el `ValorBlur` para mostrar el
 *   valor real cuando el user SÍ tiene permiso).
 *
 * Los wrappers con JSX viven en `./valorBlur.tsx` (separados para
 * que este archivo sea `.ts` puro y fácil de importar desde
 * contextos no-React, ej: `apiMessages.ts`).
 *
 * Los componentes que muestran valores respetando el permiso
 * `valores.ver` están en `valorBlur.tsx`:
 *   - `<ValorBlur value={n} />` para lectura (tablas, KPIs).
 *   - `<ValorInputBlur value={n} onChange />` para inputs de edición.
 */
export const PERMISO_VALORES_VER = 'valores.ver' as const

/** Formatea un número como moneda COP con 2 decimales. */
export function formatMoney(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return '—'
  return value.toLocaleString('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

/** Texto canónico del "blur" cuando el user no tiene permiso. */
export const VALOR_BLUR = '🔒 ***'
