/**
 * Tab "Desglose de costos" del detalle del proyecto.
 *
 * Muestra una tabla consolidada: producto, cantidad total usada
 * (suma de iniciales + solicitudes entregadas), costo unitario,
 * subtotal, % que representa del costo total.
 *
 * "Cantidad total usada" = productos iniciales (cantidadAsignada) +
 * solicitudes entregadas (cantidadEntregada).
 *
 * Responsive: en mobile se ve una lista compacta (Producto / Cantidad /
 * Subtotal) y al click se abre un modal con el desglose completo.
 */
import { useMemo, useState } from 'react'
import { ChevronRight, FileText } from 'lucide-react'
import type { ProductoDelProyecto } from './types'
import { ValorBlur } from '../../lib/valorBlur'
import { Modal } from '../Modal'

function formatMoneyCop(n: number): string {
  return n.toLocaleString('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

type DesgloseRow = {
  productoId: string
  codigo: string
  nombre: string
  unidad: string
  cantidadInicial: number
  cantidadSolicitada: number
  cantidadTotal: number
  costoUnitario: number
  subtotal: number
  porcentaje: number
}

export function CostoDesgloseTab({
  productos,
}: {
  productos: ProductoDelProyecto[]
}) {
  const [detalleId, setDetalleId] = useState<string | null>(null)
  // La lista ya viene unificada (mezcla de iniciales + solicitudes
  // entregadas). Agrupamos por productoId para consolidar.
  const rows = useMemo<DesgloseRow[]>(() => {
    const map = new Map<string, DesgloseRow>()
    for (const p of productos) {
      const existing = map.get(p.producto.id)
      if (existing) {
        if (p.origen === 'inicial') {
          existing.cantidadInicial += p.cantidad
        } else {
          existing.cantidadSolicitada += p.cantidad
        }
        existing.cantidadTotal += p.cantidad
        existing.subtotal += p.subtotal
        // Tomamos el costo unitario más reciente (último p procesado
        // en el orden ascendente del back).
        existing.costoUnitario = p.costoUnitario
      } else {
        map.set(p.producto.id, {
          productoId: p.producto.id,
          codigo: p.producto.codigo,
          nombre: p.producto.nombre,
          unidad: p.producto.unidadMedida.abreviatura,
          cantidadInicial: p.origen === 'inicial' ? p.cantidad : 0,
          cantidadSolicitada: p.origen === 'solicitud' ? p.cantidad : 0,
          cantidadTotal: p.cantidad,
          costoUnitario: p.costoUnitario,
          subtotal: p.subtotal,
          porcentaje: 0,
        })
      }
    }
    const arr = Array.from(map.values())
    const total = arr.reduce((acc, r) => acc + r.subtotal, 0)
    return arr
      .map((r) => ({
        ...r,
        porcentaje: total > 0 ? (r.subtotal / total) * 100 : 0,
      }))
      .sort((a, b) => b.subtotal - a.subtotal)
  }, [productos])

  if (rows.length === 0) {
    return (
      <div className="py-16 px-6 flex flex-col items-center text-center">
        <p className="text-sm text-muted-foreground">
          Sin productos asignados todavía. El desglose se calcula sobre los
          productos iniciales y las solicitudes entregadas.
        </p>
      </div>
    )
  }

  const totalCosto = rows.reduce((acc, r) => acc + r.subtotal, 0)
  const rowDetalle = detalleId
    ? rows.find((r) => r.productoId === detalleId) ?? null
    : null

  return (
    <>
      {/* Desktop: tabla completa */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-sm min-w-[640px]">
          <thead className="bg-muted/40 border-b border-border">
            <tr className="text-left text-[10px] text-muted-foreground uppercase tracking-widest" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
              <th className="px-4 py-2.5">Producto</th>
              <th className="px-4 py-2.5 text-right">Cantidad</th>
              <th className="px-4 py-2.5 text-right">Costo unit.</th>
              <th className="px-4 py-2.5 text-right">Subtotal</th>
              <th className="px-4 py-2.5 text-right">% del total</th>
              <th className="px-4 py-2.5">Distribución</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr
                key={r.productoId}
                className="border-b border-border last:border-0 cursor-pointer hover:bg-muted/30"
                onClick={() => setDetalleId(r.productoId)}
              >
                <td className="px-4 py-3">
                  <div className="font-medium text-foreground">{r.nombre}</div>
                  <div
                    className="text-[10px] text-muted-foreground tracking-widest"
                    style={{ fontFamily: "'JetBrains Mono', monospace" }}
                  >
                    {r.codigo}
                  </div>
                </td>
                <td
                  className="px-4 py-3 text-right"
                  style={{ fontFamily: "'JetBrains Mono', monospace" }}
                >
                  {r.cantidadTotal.toFixed(2)} {r.unidad}
                  {(r.cantidadInicial > 0 || r.cantidadSolicitada > 0) && (
                    <div className="text-[10px] text-muted-foreground mt-0.5">
                      {r.cantidadInicial > 0 && (
                        <span>{r.cantidadInicial.toFixed(2)} inicial</span>
                      )}
                      {r.cantidadInicial > 0 && r.cantidadSolicitada > 0 && (
                        <span> · </span>
                      )}
                      {r.cantidadSolicitada > 0 && (
                        <span>{r.cantidadSolicitada.toFixed(2)} solicitado</span>
                      )}
                    </div>
                  )}
                </td>
                <td
                  className="px-4 py-3 text-right"
                  style={{ fontFamily: "'JetBrains Mono', monospace" }}
                >
                  <ValorBlur value={r.costoUnitario} render={() => formatMoneyCop(r.costoUnitario)} />
                </td>
                <td
                  className="px-4 py-3 text-right font-medium"
                  style={{ fontFamily: "'JetBrains Mono', monospace" }}
                >
                  <ValorBlur value={r.subtotal} render={() => formatMoneyCop(r.subtotal)} />
                </td>
                <td
                  className="px-4 py-3 text-right text-muted-foreground"
                  style={{ fontFamily: "'JetBrains Mono', monospace" }}
                >
                  {r.porcentaje.toFixed(1)}%
                </td>
                <td className="px-4 py-3 w-32">
                  <div
                    className="h-1.5 bg-muted overflow-hidden"
                    style={{ borderRadius: '0.125rem' }}
                  >
                    <div
                      className="h-full bg-secondary"
                      style={{ width: `${Math.min(100, r.porcentaje)}%` }}
                    />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-muted/40 border-t-2 border-border">
              <td
                colSpan={3}
                className="px-4 py-2.5 text-right text-[10px] uppercase tracking-widest text-muted-foreground"
                style={{ fontFamily: "'JetBrains Mono', monospace" }}
              >
                Total costo del proyecto
              </td>
              <td
                className="px-4 py-2.5 text-right"
                style={{ fontFamily: "'JetBrains Mono', monospace" }}
              >
                <ValorBlur value={totalCosto} render={() => formatMoneyCop(totalCosto)} />
              </td>
              <td colSpan={2} />
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Mobile: lista compacta. Click → modal con desglose completo */}
      <ul className="md:hidden divide-y divide-border">
        {rows.map((r) => (
          <li key={r.productoId}>
            <button
              type="button"
              onClick={() => setDetalleId(r.productoId)}
              className="w-full text-left px-4 py-3 hover:bg-muted/30 active:bg-muted/50 transition-colors flex items-center gap-3"
              aria-label={`Ver desglose de ${r.nombre}`}
            >
              <div className="flex-1 min-w-0">
                <div className="font-medium text-foreground truncate">
                  {r.nombre}
                </div>
                <div
                  className="text-[10px] text-muted-foreground tracking-widest truncate"
                  style={{ fontFamily: "'JetBrains Mono', monospace" }}
                >
                  {r.codigo} · {r.cantidadTotal.toFixed(2)} {r.unidad}
                </div>
              </div>
              <div
                className="text-right shrink-0 tabular-nums"
                style={{ fontFamily: "'JetBrains Mono', monospace" }}
              >
                <div className="text-sm text-foreground">
                  <ValorBlur value={r.subtotal} render={() => formatMoneyCop(r.subtotal)} />
                </div>
                <div className="text-[10px] text-muted-foreground">
                  {r.porcentaje.toFixed(1)}%
                </div>
              </div>
              <ChevronRight size={14} className="text-muted-foreground shrink-0" />
            </button>
          </li>
        ))}
        {/* Footer total (mobile): pegado abajo de la lista, como en ProductosTab */}
        <li className="bg-muted/40 px-4 py-2.5 flex items-center justify-between">
          <span
            className="text-[10px] uppercase tracking-widest text-muted-foreground"
            style={{ fontFamily: "'JetBrains Mono', monospace" }}
          >
            Total costo del proyecto
          </span>
          <span
            className="text-sm text-primary tabular-nums"
            style={{ fontFamily: "'JetBrains Mono', monospace" }}
          >
            <ValorBlur value={totalCosto} render={() => formatMoneyCop(totalCosto)} />
          </span>
        </li>
      </ul>

      {/* Modal: desglose completo del producto (mobile + desktop click) */}
      <Modal
        open={!!rowDetalle}
        onClose={() => setDetalleId(null)}
        title={rowDetalle?.nombre ?? 'Desglose'}
        description={rowDetalle ? `${rowDetalle.codigo} · ${rowDetalle.cantidadTotal.toFixed(2)} ${rowDetalle.unidad}` : undefined}
        icon={<FileText size={18} />}
        size="md"
      >
        {rowDetalle ? (
          <div className="p-5 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div
                  className="text-[10px] text-muted-foreground uppercase tracking-widest"
                  style={{ fontFamily: "'JetBrains Mono', monospace" }}
                >
                  Cantidad total
                </div>
                <div
                  className="text-base text-foreground mt-0.5 tabular-nums"
                  style={{ fontFamily: "'JetBrains Mono', monospace" }}
                >
                  {rowDetalle.cantidadTotal.toFixed(2)} {rowDetalle.unidad}
                </div>
              </div>
              <div>
                <div
                  className="text-[10px] text-muted-foreground uppercase tracking-widest"
                  style={{ fontFamily: "'JetBrains Mono', monospace" }}
                >
                  Costo unit.
                </div>
                <div
                  className="text-base text-foreground mt-0.5 tabular-nums"
                  style={{ fontFamily: "'JetBrains Mono', monospace" }}
                >
                  <ValorBlur
                    value={rowDetalle.costoUnitario}
                    render={() => formatMoneyCop(rowDetalle.costoUnitario)}
                  />
                </div>
              </div>
              <div>
                <div
                  className="text-[10px] text-muted-foreground uppercase tracking-widest"
                  style={{ fontFamily: "'JetBrains Mono', monospace" }}
                >
                  Subtotal
                </div>
                <div
                  className="text-base text-primary mt-0.5 tabular-nums"
                  style={{ fontFamily: "'JetBrains Mono', monospace" }}
                >
                  <ValorBlur
                    value={rowDetalle.subtotal}
                    render={() => formatMoneyCop(rowDetalle.subtotal)}
                  />
                </div>
              </div>
              <div>
                <div
                  className="text-[10px] text-muted-foreground uppercase tracking-widest"
                  style={{ fontFamily: "'JetBrains Mono', monospace" }}
                >
                  % del total
                </div>
                <div
                  className="text-base text-foreground mt-0.5 tabular-nums"
                  style={{ fontFamily: "'JetBrains Mono', monospace" }}
                >
                  {rowDetalle.porcentaje.toFixed(1)}%
                </div>
              </div>
              {rowDetalle.cantidadInicial > 0 && (
                <div>
                  <div
                    className="text-[10px] text-muted-foreground uppercase tracking-widest"
                    style={{ fontFamily: "'JetBrains Mono', monospace" }}
                  >
                    Inicial
                  </div>
                  <div
                    className="text-base text-foreground mt-0.5 tabular-nums"
                    style={{ fontFamily: "'JetBrains Mono', monospace" }}
                  >
                    {rowDetalle.cantidadInicial.toFixed(2)} {rowDetalle.unidad}
                  </div>
                </div>
              )}
              {rowDetalle.cantidadSolicitada > 0 && (
                <div>
                  <div
                    className="text-[10px] text-muted-foreground uppercase tracking-widest"
                    style={{ fontFamily: "'JetBrains Mono', monospace" }}
                  >
                    Solicitado a bodega
                  </div>
                  <div
                    className="text-base text-foreground mt-0.5 tabular-nums"
                    style={{ fontFamily: "'JetBrains Mono', monospace" }}
                  >
                    {rowDetalle.cantidadSolicitada.toFixed(2)} {rowDetalle.unidad}
                  </div>
                </div>
              )}
            </div>
            {/* Distribución (la barrita) */}
            <div>
              <div
                className="text-[10px] text-muted-foreground uppercase tracking-widest mb-1.5"
                style={{ fontFamily: "'JetBrains Mono', monospace" }}
              >
                Distribución
              </div>
              <div
                className="h-1.5 bg-muted overflow-hidden"
                style={{ borderRadius: '0.125rem' }}
              >
                <div
                  className="h-full bg-secondary"
                  style={{ width: `${Math.min(100, rowDetalle.porcentaje)}%` }}
                />
              </div>
            </div>
          </div>
        ) : null}
      </Modal>
    </>
  )
}
