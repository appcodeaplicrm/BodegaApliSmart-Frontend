/**
 * Modal de selección de rango de fechas para el PDF del checklist.
 *
 * El user abre este modal antes de imprimir un PDF histórico. Elige
 * DESDE y HASTA, y al confirmar le pedimos al back `pdfData(id, bodega,
 * desde, hasta)`. El back devuelve un `CkPdfData` con TODAS las
 * ejecuciones del mismo (plantillaId, usuarioId) en ese rango,
 * agrupadas por día en `dias[]`. El front renderiza 1 PDF por cada
 * bloque de 5 días.
 *
 * Si la asignación origen NO tiene ejecuciones en el rango, el back
 * tira 404 — mostramos un mensaje claro.
 *
 * UX:
 *  - `mode="date"` del DateTimePicker.
 *  - Defaults razonables: desde = (hoy - 7), hasta = hoy.
 *  - Validación: desde <= hasta, y el rango <= 90 días (mismo límite
 *    que el back).
 *  - Botón "Generar PDF" en el footer (sticky, con `Modal` reusable).
 */

import { useState, useMemo, useEffect } from 'react'
import { Calendar, FileDown, AlertTriangle } from 'lucide-react'
import { Modal } from '../Modal'
import { DateTimePicker } from '../DateTimePicker'
import { descargarPdf } from './ChecklistPdf'
import { pdfData } from './api'

type Props = {
  open: boolean
  onClose: () => void
  /** ID de la asignación desde donde se originó el PDF. */
  asignacionId: string
  /** Bodega activa (para que el back filtre por scope). */
  bodegaId: string
}

const MAX_DAYS = 90

/**
 * Devuelve YYYY-MM-DD de hoy, en la zona horaria local del cliente.
 */
function todayYmd(): string {
  const d = new Date()
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, '0'),
    String(d.getDate()).padStart(2, '0'),
  ].join('-')
}

/**
 * Devuelve YYYY-MM-DD de `n` días antes de hoy.
 */
function daysAgoYmd(n: number): string {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, '0'),
    String(d.getDate()).padStart(2, '0'),
  ].join('-')
}

/**
 * Compara dos YMD.
 */
function cmpYmd(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0
}

/**
 * Calcula la cantidad de días entre dos YMD (inclusivo).
 */
function daysBetween(desde: string, hasta: string): number {
  const a = new Date(desde + 'T00:00:00')
  const b = new Date(hasta + 'T00:00:00')
  return Math.round((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24)) + 1
}

export function PdfRangeModal({ open, onClose, asignacionId, bodegaId }: Props) {
  // Defaults: última semana.
  const [desde, setDesde] = useState<string>(daysAgoYmd(7))
  const [hasta, setHasta] = useState<string>(todayYmd())
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Resetear cada vez que se abre.
  useEffect(() => {
    if (open) {
      setDesde(daysAgoYmd(7))
      setHasta(todayYmd())
      setError(null)
    }
  }, [open])

  const validacion = useMemo(() => {
    if (!desde || !hasta) return 'Elegí las dos fechas.'
    if (cmpYmd(desde, hasta) > 0) return 'La fecha "Desde" debe ser anterior a "Hasta".'
    const dias = daysBetween(desde, hasta)
    if (dias > MAX_DAYS) return `El rango máximo es de ${MAX_DAYS} días.`
    return null
  }, [desde, hasta])

  const diasDelRango = useMemo(() => {
    if (!desde || !hasta || cmpYmd(desde, hasta) > 0) return 0
    return daysBetween(desde, hasta)
  }, [desde, hasta])

  const paginasEstimadas = Math.ceil(diasDelRango / 5)

  const handleSubmit = async () => {
    if (validacion) return
    setLoading(true)
    setError(null)
    try {
      // Verifico que la asignación tenga data en el rango antes de
      // cerrar el modal. Si falla (404: no hay ejecuciones), el
      // user ve el error.
      const data = await pdfData(asignacionId, bodegaId, { desde, hasta })
      onClose()
      // Damos un pequeño delay para que el modal termine de cerrarse
      // antes de que se dispare el print() y aparezcan los overlays.
      setTimeout(() => {
        descargarPdf(data).catch(
          (e) => {
            // eslint-disable-next-line no-console
            console.error('descargarPdf error:', e)
          },
        )
      }, 200)
    } catch (e) {
      const msg = (e as Error).message ?? 'Error al generar el PDF.'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Generar PDF del checklist"
      icon={<Calendar size={16} />}
      size="md"
      footer={
        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="min-h-[44px] px-4 text-sm border border-border text-foreground hover:border-foreground/30 transition-colors disabled:opacity-50"
            style={{ borderRadius: '0.25rem' }}
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!!validacion || loading}
            className="min-h-[44px] inline-flex items-center gap-2 px-4 text-sm bg-primary text-white font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
            style={{ borderRadius: '0.25rem' }}
          >
            <FileDown size={14} />
            {loading ? 'Generando…' : 'Generar PDF'}
          </button>
        </div>
      }
    >
      <div className="p-5 space-y-4">
        {/* Intro */}
        <p className="text-sm text-muted-foreground">
          Elegí el rango de fechas para incluir en el PDF. Se generará 1 hoja por cada
          bloque de 5 días con la inspección de cada día en su propia columna.
        </p>

        {/* Pickers */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <div
              className="text-[10px] text-muted-foreground tracking-widest mb-1"
              style={{ fontFamily: "'JetBrains Mono', monospace" }}
            >
              DESDE
            </div>
            <DateTimePicker
              mode="date"
              value={desde}
              onChange={setDesde}
              placeholder="dd/mm/aaaa"
              label="Fecha desde"
            />
          </div>
          <div>
            <div
              className="text-[10px] text-muted-foreground tracking-widest mb-1"
              style={{ fontFamily: "'JetBrains Mono', monospace" }}
            >
              HASTA
            </div>
            <DateTimePicker
              mode="date"
              value={hasta}
              onChange={setHasta}
              placeholder="dd/mm/aaaa"
              label="Fecha hasta"
            />
          </div>
        </div>

        {/* Resumen del rango */}
        {!validacion && diasDelRango > 0 && (
          <div
            className="text-xs text-foreground bg-muted/50 border border-border px-3 py-2"
            style={{ borderRadius: '0.25rem', fontFamily: "'JetBrains Mono', monospace" }}
          >
            Rango: {diasDelRango} día(s) · {paginasEstimadas} hoja(s) en el PDF
            {paginasEstimadas > 1 ? ' (se imprimirán una por una)' : ''}
          </div>
        )}

        {/* Validación */}
        {validacion && (
          <div
            className="text-xs text-foreground bg-primary/10 border border-primary/30 px-3 py-2 flex items-center gap-2"
            style={{ borderRadius: '0.25rem' }}
          >
            <AlertTriangle size={12} className="shrink-0" />
            {validacion}
          </div>
        )}

        {/* Error del back */}
        {error && (
          <div
            className="text-xs text-primary bg-primary/10 border border-primary/30 px-3 py-2"
            style={{ borderRadius: '0.25rem' }}
          >
            {error}
          </div>
        )}
      </div>
    </Modal>
  )
}
