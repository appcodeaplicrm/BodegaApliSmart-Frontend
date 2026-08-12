/**
 * Helpers para la política de devolución por producto (sección 21
 * del .md).
 *
 * La política se define una sola vez en `Producto.admiteDevolucion` y
 * se FOTOGRAFÍA en `EntregaItem.admiteDevolucion` al generar la
 * entrega. Cambios posteriores al producto no afectan entregas
 * históricas.
 *
 * Estos helpers calculan el resumen derivado de un conjunto de
 * `EntregaItem` (sin agregar un nuevo estado a `Pedido`):
 *   - Todos los items admiten devolución → "Admite devolución"
 *   - Ninguno admite → "No admite devolución"
 *   - Mixto → "Devolución parcial"
 *   - Hay items sin definir (no debería pasar post-migración) →
 *     "Pendiente de definir"
 */

export type ResumenDevolucion =
  | 'admite_devolucion'
  | 'no_admite_devolucion'
  | 'devolucion_parcial'
  | 'pendiente_definicion'

export type ItemParaResumen = {
  /** TRUE si el item fue saltado (no se entregó). NO cuenta. */
  saltado?: boolean
  admiteDevolucion: boolean
}

export function calcularResumenDevolucion(
  items: ItemParaResumen[],
): ResumenDevolucion {
  const entregados = items.filter((i) => !i.saltado)
  if (entregados.length === 0) return 'no_admite_devolucion'
  const retornables = entregados.filter((i) => i.admiteDevolucion).length
  if (retornables === 0) return 'no_admite_devolucion'
  if (retornables === entregados.length) return 'admite_devolucion'
  return 'devolucion_parcial'
}

export const RESUMEN_LABELS: Record<ResumenDevolucion, string> = {
  admite_devolucion: 'Admite devolución',
  no_admite_devolucion: 'No admite devolución',
  devolucion_parcial: 'Devolución parcial',
  pendiente_definicion: 'Pendiente de definir',
}

export const RESUMEN_COLORS: Record<ResumenDevolucion, string> = {
  // Verde lima = retornable, rojo = no retornable, ámbar = mixto.
  admite_devolucion: 'text-secondary border-secondary/30 bg-secondary/10',
  no_admite_devolucion: 'text-primary border-primary/30 bg-primary/10',
  devolucion_parcial: 'text-amber-400 border-amber-500/30 bg-amber-500/10',
  pendiente_definicion: 'text-muted-foreground border-border bg-muted/40',
}
