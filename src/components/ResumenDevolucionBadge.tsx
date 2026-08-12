/**
 * ResumenDevolucionBadge — Pill que muestra el resumen derivado de la
 * política de devolución de un pedido. No es un estado del pedido,
 * se calcula a partir de los `EntregaItem` (sección 21 del .md).
 */

import {
  RESUMEN_COLORS,
  RESUMEN_LABELS,
  type ResumenDevolucion,
} from '../lib/politicaDevolucion'
import { RotateCcw, X, AlertTriangle, Check, Hourglass } from 'lucide-react'

type Props = {
  resumen: ResumenDevolucion
  className?: string
}

const ICON: Record<ResumenDevolucion, typeof Check> = {
  admite_devolucion: Check,
  no_admite_devolucion: X,
  devolucion_parcial: RotateCcw,
  pendiente_definicion: Hourglass,
}

export function ResumenDevolucionBadge({ resumen, className }: Props) {
  const Icon = ICON[resumen]
  return (
    <span
      className={`inline-flex items-center gap-1.5 text-[10px] uppercase tracking-widest px-2 py-0.5 border ${
        RESUMEN_COLORS[resumen]
      } ${className ?? ''}`}
      style={{
        borderRadius: '0.15rem',
        fontFamily: "'JetBrains Mono', monospace",
      }}
    >
      <Icon size={10} />
      {RESUMEN_LABELS[resumen]}
    </span>
  )
}
