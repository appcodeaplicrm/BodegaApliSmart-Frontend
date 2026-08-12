/**
 * Sección 2: Programados & Historial.
 *
 * El .md las describe como dos tablas apiladas. Acá las pongo en un
 * mismo scroll vertical con dos bloques diferenciados y un header
 * "Nuevo checklist" en el header de la sección.
 *
 * - Tabla Programados: barra de progreso coloreada por estado.
 * - Tabla Historial: búsqueda por técnico/plantilla/ID, columna ÍTEMS
 *   con fracción + mini barra, columna RESULTADO con 3 variantes, botón
 *   PDF por fila (descarga vía window.print() en `ChecklistPdf.tsx`).
 * - Footer del historial: contador + resumen por color.
 */
import { useState, useMemo, useEffect } from 'react'
import { Plus, Download, Search, Play, Lock, Calendar, CalendarDays, X, Eye } from 'lucide-react'
import type { CkAsignado, CkHistorialItem } from './types'
import { EjecutarChecklistModal } from './EjecutarChecklistModal'
import { CalendarioProgramadosModal } from './CalendarioProgramadosModal'
import { PdfRangeModal } from './PdfRangeModal'
import { historial as apiHistorial } from './api'
import { Modal } from '../Modal'

type Props = {
  asignaciones: CkAsignado[]
  historial: CkHistorialItem[]
  onNuevoChecklist: () => void
  /** Si false, oculta el botón "Nuevo checklist" (user solo-lectura). */
  canCreate: boolean
  /** Bodega activa. Se pasa al modal de ejecución para autorizar el back. */
  bodegaId: string
  /** Notificar al padre para que recargue programados/historial. */
  onChanged: () => Promise<void> | void
}

export function ProgramadosHistorial({
  asignaciones,
  historial,
  onNuevoChecklist,
  canCreate,
  bodegaId,
  onChanged,
}: Props) {
  const [asignacionAbiertaId, setAsignacionAbiertaId] = useState<string | null>(null)
  const [showCalendario, setShowCalendario] = useState(false)
  /**
   * Filtro de la lista "Programados":
   *  - Por defecto: HOY. La lista solo muestra los del día actual.
   *  - El user puede cambiar el filtro abriendo el calendario y
   *    clickeando otro día. NO hay forma de "ver todos" desde la
   *    lista: si querés ver la semana completa, usás el calendario.
   *  - El chip arriba del header muestra qué día está activo. El
   *    "X" del chip vuelve al día de hoy.
   */
  const todayYmd = (() => {
    const d = new Date()
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${day}`
  })()
  const [filtroDia, setFiltroDia] = useState<string | null>(todayYmd)

  const handleClose = async () => {
    setAsignacionAbiertaId(null)
    await onChanged()
  }

  const handleGoToDay = (ymd: string) => {
    // Al hacer click en un día del calendario, ese día se vuelve
    // el filtro activo. El user puede navegar día por día.
    setFiltroDia(ymd)
    setShowCalendario(false)
  }

  const handleGoToToday = () => {
    // El botón "Ir a hoy" vuelve al día actual. Es la única forma
    // de "resetear" el filtro (no hay "ver todos").
    const d = new Date()
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    setFiltroDia(`${y}-${m}-${day}`)
  }

  const handleOpenFromCalendario = (asignacionId: string) => {
    setShowCalendario(false)
    setAsignacionAbiertaId(asignacionId)
  }

  // Filtramos programados por día si hay filtro activo.
  // Por defecto `filtroDia` es `null`, así que el primer render
  // muestra TODOS los programados. Si el user clickea un día en el
  // calendario, se filtra a ese día.
  const programadosFiltrados = useMemo(() => {
    if (!filtroDia) return asignaciones
    return asignaciones.filter((a) => {
      const ymd = new Date(a.fechaLimite).toISOString().slice(0, 10)
      return ymd === filtroDia
    })
  }, [asignaciones, filtroDia])

  // Label legible del día activo (para el chip). `null` cuando no
  // hay filtro (se muestra "(todos)" en su lugar).
  const filtroDiaLabel = filtroDia
    ? new Date(filtroDia + 'T12:00:00').toLocaleDateString('es-CO', {
        day: '2-digit',
        month: 'short',
        weekday: 'short',
      })
    : null

  return (
    <div className="space-y-4 sm:space-y-6 lg:space-y-8">
      {/* Programados */}
      <section>
        <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <h3
              className="text-sm uppercase text-foreground tracking-widest"
              style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800 }}
            >
              Programados
            </h3>
            {filtroDiaLabel && (
              <span
                className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] bg-primary/10 text-primary border border-primary/20"
                style={{ borderRadius: '0.25rem', fontFamily: "'JetBrains Mono', monospace" }}
              >
                {filtroDiaLabel}
                {filtroDia !== todayYmd && (
                  <button
                    onClick={handleGoToToday}
                    className="hover:text-foreground"
                    title="Volver al día de hoy"
                  >
                    <X size={10} />
                  </button>
                )}
              </span>
            )}
          </div>
          <div className="hidden sm:flex items-center gap-2">
            {filtroDia !== todayYmd && (
              <button
                onClick={handleGoToToday}
                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs border border-border hover:border-primary/40"
                style={{ borderRadius: '0.25rem' }}
                title="Volver al día de hoy"
              >
                Ir a hoy
              </button>
            )}
            <button
              onClick={() => setShowCalendario(true)}
              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs border border-border hover:border-primary/40"
              style={{ borderRadius: '0.25rem' }}
              title="Ver en calendario (elegir otro día)"
            >
              <CalendarDays size={11} /> Calendario
            </button>
            {canCreate && (
              <button
                onClick={onNuevoChecklist}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs bg-primary text-white font-semibold hover:opacity-90 transition-opacity"
                style={{ borderRadius: '0.25rem' }}
              >
                <Plus size={12} /> Nuevo checklist
              </button>
            )}
          </div>
        </div>
        {/* Mobile: fila de acciones full-width (Calendario + Nuevo checklist) */}
        <div className="sm:hidden mb-3 flex items-center gap-2">
          <button
            onClick={() => setShowCalendario(true)}
            className="flex-1 min-h-[40px] inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5 text-xs border border-border hover:border-primary/40"
            style={{ borderRadius: '0.25rem' }}
          >
            <CalendarDays size={12} /> Calendario
          </button>
          {canCreate && (
            <button
              onClick={onNuevoChecklist}
              className="flex-1 min-h-[40px] inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5 text-xs bg-primary text-white font-semibold hover:opacity-90 transition-opacity"
              style={{ borderRadius: '0.25rem' }}
            >
              <Plus size={12} /> Nuevo
            </button>
          )}
        </div>
        <ProgramadosTable
          rows={programadosFiltrados}
          onOpen={(id) => setAsignacionAbiertaId(id)}
          canExecute={filtroDia === todayYmd}
          filtroDia={filtroDia}
          todayYmd={todayYmd}
        />
      </section>

      {/* Historial */}
      <section>
        <h3
          className="text-sm uppercase text-foreground tracking-widest mb-3"
          style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800 }}
        >
          Historial
        </h3>
        <HistorialTable rows={historial} bodegaId={bodegaId} />
      </section>

      {/* Modal de ejecución */}
      {asignacionAbiertaId && (
        <EjecutarChecklistModal
          asignacionId={asignacionAbiertaId}
          bodegaId={bodegaId}
          onClose={handleClose}
          onChanged={onChanged}
          readOnly={filtroDia !== todayYmd}
        />
      )}

      {/* Modal de calendario semanal */}
      {showCalendario && (
        <CalendarioProgramadosModal
          bodegaId={bodegaId}
          onClose={() => setShowCalendario(false)}
          onOpenAsignacion={handleOpenFromCalendario}
          onGoToDay={handleGoToDay}
        />
      )}
    </div>
  )
}

// ─────────── Programados ───────────

function ProgramadosTable({
  rows,
  onOpen,
  canExecute,
  filtroDia,
  todayYmd,
}: {
  rows: CkAsignado[]
  onOpen: (id: string) => void
  /**
   * Si es true, las filas pendientes/vencidas muestran el botón
   * "Ejecutar" y el click abre el wizard en modo editable. Si es
   * false (estamos viendo otro día que no es hoy), el botón es
   * "Ver" y el wizard se abre en modo read-only.
   */
  canExecute: boolean
  /** Día actualmente filtrado, para el label del modal de detalle. */
  filtroDia: string | null
  /** YMD de hoy (para mostrar hint "no es hoy"). */
  todayYmd: string
}) {
  const [detalle, setDetalle] = useState<CkAsignado | null>(null)

  if (rows.length === 0) {
    return <Empty msg="No hay checklists programados." />
  }

  const isOtherDay = filtroDia !== null && filtroDia !== todayYmd

  return (
    <>
      {/* Mobile: lista compacta — solo Plantilla, Técnico, Estado.
          Tap en la fila abre el modal de detalle. */}
      <div className="sm:hidden bg-card border border-border divide-y divide-border/40"
        style={{ borderRadius: '0.25rem' }}>
        {rows.map((r) => (
          <button
            key={r.id}
            type="button"
            onClick={() => setDetalle(r)}
            className="w-full text-left px-4 py-3 hover:bg-muted/30 active:bg-muted/50 transition-colors min-h-[64px] flex items-center gap-3"
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span
                  className="text-sm font-semibold text-foreground truncate"
                  style={{ fontFamily: "'Barlow Condensed', sans-serif" }}
                >
                  {r.plantilla}
                </span>
                <span
                  className="text-[10px] text-muted-foreground"
                  style={{ fontFamily: "'JetBrains Mono', monospace" }}
                >
                  {r.id.slice(0, 8).toUpperCase()}
                </span>
              </div>
              <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
                <div className="w-5 h-5 rounded-full bg-muted flex items-center justify-center text-[9px] text-muted-foreground"
                  style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                  {initials(r.tecnico)}
                </div>
                <span className="truncate">{r.tecnico}</span>
              </div>
            </div>
            <EstadoBadge estado={r.estado} />
          </button>
        ))}
      </div>

      {/* Desktop: tabla completa */}
      <div className="hidden sm:block bg-card border border-border overflow-hidden" style={{ borderRadius: '0.25rem' }}>
        <table className="w-full text-xs">
          <thead>
            <tr className="text-[10px] text-muted-foreground tracking-widest border-b border-border"
              style={{ fontFamily: "'JetBrains Mono', monospace" }}>
              <th className="text-left px-3 py-2">ID</th>
              <th className="text-left px-3 py-2">PLANTILLA</th>
              <th className="text-left px-3 py-2">TÉCNICO</th>
              <th className="text-left px-3 py-2">ROL</th>
              <th className="text-left px-3 py-2">FECHA LÍMITE</th>
              <th className="text-left px-3 py-2">PROGRESO</th>
              <th className="text-left px-3 py-2">ESTADO</th>
              <th className="text-right px-3 py-2">ACCIÓN</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const cerrado = r.estado === 'completado'
              const ejecutable = !cerrado && canExecute
              return (
                <tr
                  key={r.id}
                  className="border-b border-border/40 last:border-b-0 hover:bg-muted/30 cursor-pointer transition-colors"
                  onClick={() => setDetalle(r)}
                  title={
                    cerrado
                      ? 'Ver resultado'
                      : ejecutable
                        ? 'Ejecutar checklist'
                        : 'Solo lectura (no es el día de hoy)'
                  }
                >
                  <td className="px-3 py-2 font-mono text-[10px] text-muted-foreground">
                    {r.id.slice(0, 8).toUpperCase()}
                  </td>
                  <td className="px-3 py-2 text-foreground">{r.plantilla}</td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-[10px] text-muted-foreground"
                        style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                        {initials(r.tecnico)}
                      </div>
                      <span className="text-foreground">{r.tecnico}</span>
                    </div>
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">{r.rol}</td>
                  <td className="px-3 py-2 text-foreground">{r.fecha}</td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <div className="w-16 h-1.5 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${r.progreso}%`,
                            background: progressColor(r.estado, r.progreso),
                          }}
                        />
                      </div>
                      <span className="text-[10px] text-muted-foreground"
                        style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                        {r.progreso}%
                      </span>
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <EstadoBadge estado={r.estado} />
                  </td>
                  <td className="px-3 py-2 text-right">
                    {cerrado ? (
                      <span
                        className="inline-flex items-center gap-1 px-2 py-1 text-[10px] text-muted-foreground border border-border"
                        style={{ borderRadius: '0.25rem' }}
                      >
                        <Lock size={11} /> Ver
                      </span>
                    ) : ejecutable ? (
                      <span
                        className="inline-flex items-center gap-1 px-2 py-1 text-[10px] bg-primary/15 text-primary border border-primary/20"
                        style={{ borderRadius: '0.25rem' }}
                      >
                        <Play size={11} /> Ejecutar
                      </span>
                    ) : (
                      <span
                        className="inline-flex items-center gap-1 px-2 py-1 text-[10px] text-muted-foreground border border-border"
                        style={{ borderRadius: '0.25rem' }}
                      >
                        <Eye size={11} /> Ver
                      </span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Modal de detalle: muestra toda la info + acción contextual.
          En mobile, lo abrimos al tocar la fila.
          En desktop, también se abre al click (mejor UX que el tooltip). */}
      {detalle && (
        <ProgramadoDetalleModal
          row={detalle}
          isOtherDay={isOtherDay}
          onClose={() => setDetalle(null)}
          onEjecutarVer={() => {
            const id = detalle.id
            setDetalle(null)
            onOpen(id)
          }}
        />
      )}
    </>
  )
}

// ─────── Detalle del programado (modal mobile + click-info desktop) ───────

function ProgramadoDetalleModal({
  row,
  isOtherDay,
  onClose,
  onEjecutarVer,
}: {
  row: CkAsignado
  /** Si es true, la fila es de otro día → no se puede ejecutar, solo ver. */
  isOtherDay: boolean
  onClose: () => void
  onEjecutarVer: () => void
}) {
  const cerrado = row.estado === 'completado'
  const ejecutable = !cerrado && !isOtherDay
  const accionLabel = cerrado
    ? 'Ver resultado'
    : ejecutable
      ? 'Ejecutar checklist'
      : 'Ver detalle'
  const accionIcon = cerrado || !ejecutable ? Eye : Play
  const AccionIcon = accionIcon

  return (
    <Modal
      open
      onClose={onClose}
      title={row.plantilla}
      icon={
        <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center text-[11px] text-muted-foreground"
          style={{ fontFamily: "'JetBrains Mono', monospace" }}>
          {initials(row.tecnico)}
        </div>
      }
      size="md"
      footer={
        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] px-4 text-sm border border-border text-foreground hover:border-foreground/30 transition-colors"
            style={{ borderRadius: '0.25rem' }}
          >
            Cerrar
          </button>
          <button
            type="button"
            onClick={onEjecutarVer}
            className="min-h-[44px] inline-flex items-center gap-2 px-4 text-sm bg-primary text-white font-semibold hover:opacity-90 transition-opacity"
            style={{ borderRadius: '0.25rem' }}
          >
            <AccionIcon size={14} />
            {accionLabel}
          </button>
        </div>
      }
    >
      <div className="p-5 space-y-3">
        {/* Plantilla + ID */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-0.5">
              <span
                className="text-[10px] text-muted-foreground tracking-widest"
                style={{ fontFamily: "'JetBrains Mono', monospace" }}
              >
                {row.id.slice(0, 8).toUpperCase()}
              </span>
            </div>
            <h3
              className="text-base uppercase text-foreground"
              style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800 }}
            >
              {row.plantilla}
            </h3>
          </div>
          <EstadoBadge estado={row.estado} />
        </div>

        {/* Datos en filas 2-col */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
          <DetalleRow label="Técnico" value={row.tecnico} />
          <DetalleRow label="Rol" value={row.rol} />
          <DetalleRow label="Fecha límite" value={row.fecha} />
          <DetalleRow label="Progreso" value={`${row.progreso}%`} />
        </div>

        {/* Barra de progreso */}
        <div>
          <div className="w-full h-1.5 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full"
              style={{
                width: `${row.progreso}%`,
                background: progressColor(row.estado, row.progreso),
              }}
            />
          </div>
        </div>

        {/* Hint si es de otro día */}
        {isOtherDay && !cerrado && (
          <div className="text-[11px] text-muted-foreground bg-muted/50 border border-border px-3 py-2 flex items-center gap-2"
            style={{ borderRadius: '0.25rem' }}>
            <Eye size={12} className="shrink-0" />
            Este checklist es de otro día. Solo se puede ejecutar el día de hoy.
          </div>
        )}
      </div>
    </Modal>
  )
}

function DetalleRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div
        className="text-[10px] text-muted-foreground tracking-widest mb-0.5"
        style={{ fontFamily: "'JetBrains Mono', monospace" }}
      >
        {label.toUpperCase()}
      </div>
      <div className="text-sm text-foreground">{value}</div>
    </div>
  )
}

// ─────── Detalle del historial (modal mobile + click-info desktop) ───────

function HistorialDetalleModal({
  row,
  onClose,
  onDownload,
}: {
  row: CkHistorialItem
  onClose: () => void
  onDownload: () => void
}) {
  return (
    <Modal
      open
      onClose={onClose}
      title={row.plantilla}
      icon={
        <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center text-[11px] text-muted-foreground"
          style={{ fontFamily: "'JetBrains Mono', monospace" }}>
          {initials(row.tecnico)}
        </div>
      }
      size="md"
      footer={
        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] px-4 text-sm border border-border text-foreground hover:border-foreground/30 transition-colors"
            style={{ borderRadius: '0.25rem' }}
          >
            Cerrar
          </button>
          <button
            type="button"
            onClick={onDownload}
            className="min-h-[44px] inline-flex items-center gap-2 px-4 text-sm bg-primary text-white font-semibold hover:opacity-90 transition-opacity"
            style={{ borderRadius: '0.25rem' }}
          >
            <Download size={14} />
            Descargar PDF
          </button>
        </div>
      }
    >
      <div className="p-5 space-y-3">
        {/* Plantilla + ID + resultado */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-0.5">
              <span
                className="text-[10px] text-muted-foreground tracking-widest"
                style={{ fontFamily: "'JetBrains Mono', monospace" }}
              >
                {row.id.slice(0, 8).toUpperCase()}
              </span>
            </div>
            <h3
              className="text-base uppercase text-foreground"
              style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800 }}
            >
              {row.plantilla}
            </h3>
          </div>
          <ResultadoBadge resultado={row.resultado} />
        </div>

        {/* Datos en filas 2-col */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
          <DetalleRow label="Técnico" value={row.tecnico} />
          <DetalleRow label="Rol" value={row.rol} />
          <DetalleRow label="Fecha" value={row.fecha} />
          <DetalleRow label="Duración" value={row.duracion} />
        </div>

        {/* Ítems con mini barra */}
        <div>
          <div
            className="text-[10px] text-muted-foreground tracking-widest mb-1"
            style={{ fontFamily: "'JetBrains Mono', monospace" }}
          >
            ÍTEMS ({row.ok}/{row.total})
          </div>
          <div className="flex items-center gap-2">
            <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${row.total > 0 ? (row.ok / row.total) * 100 : 0}%`,
                  background: '#ABF768',
                }}
              />
            </div>
            <span className="text-xs text-muted-foreground tabular-nums"
              style={{ fontFamily: "'JetBrains Mono', monospace" }}>
              {row.total > 0 ? Math.round((row.ok / row.total) * 100) : 0}%
            </span>
          </div>
        </div>
      </div>
    </Modal>
  )
}

// ─────────── Historial ───────────

function HistorialTable({ rows, bodegaId }: { rows: CkHistorialItem[]; bodegaId: string }) {
  const [search, setSearch] = useState('')
  const [detalle, setDetalle] = useState<CkHistorialItem | null>(null)
  /**
   * ID de la asignación para la cual se está abriendo el modal de
   * rango de fechas del PDF. Cuando es null, el modal está cerrado.
   */
  const [pdfRange, setPdfRange] = useState<
    | { asignacionId: string }
    | null
  >(null)

  // Descarga del PDF con manejo de errores. Lo extraemos para
  // reutilizarlo desde la fila desktop y desde el modal de detalle.
  // AHORA solo dispara el modal de rango; la descarga real la hace
  // el PdfRangeModal tras elegir las fechas.
  const handleOpenPdfRange = (asignacionId: string) => {
    setPdfRange({ asignacionId })
  }
  /**
   * Filtro por fecha:
   *  - `fechaFiltro` = el día que el user eligió (YYYY-MM-DD)
   *  - Si está seteado, sobreescribimos `rows` con el resultado de
   *    un fetch al back con `?fecha=YYYY-MM-DD`. Mientras carga,
   *    mostramos el estado de loading en el contador de resultados.
   *  - Si está null, usamos las `rows` que recibimos del padre (que
   *    son el historial completo cargado al inicio).
   */
  const [fechaFiltro, setFechaFiltro] = useState<string | null>(null)
  const [filasPorFecha, setFilasPorFecha] = useState<CkHistorialItem[] | null>(null)
  const [loadingFecha, setLoadingFecha] = useState(false)
  const [errorFecha, setErrorFecha] = useState<string | null>(null)

  // Cada vez que cambia el filtro de fecha, fetch al back.
  useEffect(() => {
    if (!fechaFiltro) {
      setFilasPorFecha(null)
      setErrorFecha(null)
      return
    }
    let cancel = false
    setLoadingFecha(true)
    setErrorFecha(null)
    apiHistorial(bodegaId, fechaFiltro)
      .then((list) => {
        if (!cancel) setFilasPorFecha(list)
      })
      .catch((e) => {
        if (!cancel) setErrorFecha((e as Error).message ?? 'Error al filtrar')
      })
      .finally(() => {
        if (!cancel) setLoadingFecha(false)
      })
    return () => {
      cancel = true
    }
  }, [fechaFiltro, bodegaId])

  // Las filas que se muestran: si hay filtro de fecha, las del fetch;
  // si no, las del padre.
  const baseRows = fechaFiltro ? filasPorFecha ?? [] : rows

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return baseRows
    return baseRows.filter(
      (r) =>
        r.tecnico.toLowerCase().includes(q) ||
        r.plantilla.toLowerCase().includes(q) ||
        r.id.toLowerCase().includes(q),
    )
  }, [baseRows, search])

  const resumen = useMemo(() => {
    const r = { aprobado: 0, observaciones: 0, rechazado: 0 }
    for (const it of filtered) r[it.resultado]++
    return r
  }, [filtered])

  if (rows.length === 0) {
    return <Empty msg="Aún no hay ejecuciones registradas en el historial." />
  }

  // Label legible para el chip de fecha seleccionada.
  const fechaLabel = fechaFiltro
    ? new Date(fechaFiltro + 'T12:00:00').toLocaleDateString('es-CO', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      })
    : null

  return (
    <div className="space-y-3">
      {/* Buscador + filtro de fecha */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative max-w-sm flex-1 min-w-[220px]">
          <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por técnico, plantilla o ID…"
            className="w-full bg-background border border-border pl-8 pr-3 py-1.5 text-xs focus:border-primary/50 outline-none"
            style={{ borderRadius: '0.25rem' }}
          />
        </div>

        {/* Datepicker */}
        <div className="relative inline-flex items-center">
          <Calendar
            size={12}
            className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
          />
          <input
            type="date"
            value={fechaFiltro ?? ''}
            max={new Date().toISOString().slice(0, 10)}
            onChange={(e) => setFechaFiltro(e.target.value || null)}
            style={{ colorScheme: 'dark' }}
            className="bg-background border border-border pl-8 pr-2 py-1.5 text-xs focus:border-primary/50 outline-none"
            onClick={(e) => e.currentTarget.showPicker?.()}
            title="Filtrar por día"
          />
        </div>

        {fechaLabel && (
          <span
            className="inline-flex items-center gap-1 px-2 py-1 text-[10px] bg-primary/10 text-primary border border-primary/20"
            style={{ borderRadius: '0.25rem', fontFamily: "'JetBrains Mono', monospace" }}
          >
            {fechaLabel}
            <button
              onClick={() => setFechaFiltro(null)}
              className="hover:text-foreground"
              title="Quitar filtro de fecha"
            >
              <X size={10} />
            </button>
          </span>
        )}

        {loadingFecha && (
          <span className="text-[10px] text-muted-foreground" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
            Cargando…
          </span>
        )}
        {errorFecha && (
          <span className="text-[10px] text-primary">{errorFecha}</span>
        )}
      </div>

      {/* Mobile: lista compacta — solo Plantilla, Técnico, Fecha, Resultado.
          Tap en la fila abre el modal de detalle con toda la info + botón PDF. */}
      <div className="sm:hidden bg-card border border-border divide-y divide-border/40"
        style={{ borderRadius: '0.25rem' }}>
        {filtered.map((r) => (
          <button
            key={r.id}
            type="button"
            onClick={() => setDetalle(r)}
            className="w-full text-left px-4 py-3 hover:bg-muted/30 active:bg-muted/50 transition-colors min-h-[68px] flex items-center gap-3"
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span
                  className="text-sm font-semibold text-foreground truncate"
                  style={{ fontFamily: "'Barlow Condensed', sans-serif" }}
                >
                  {r.plantilla}
                </span>
                <span
                  className="text-[10px] text-muted-foreground"
                  style={{ fontFamily: "'JetBrains Mono', monospace" }}
                >
                  {r.id.slice(0, 8).toUpperCase()}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2 mt-0.5">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground min-w-0">
                  <div className="w-5 h-5 rounded-full bg-muted flex items-center justify-center text-[9px] text-muted-foreground shrink-0"
                    style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                    {initials(r.tecnico)}
                  </div>
                  <span className="truncate">{r.tecnico}</span>
                </div>
                <span
                  className="text-[10px] text-muted-foreground shrink-0"
                  style={{ fontFamily: "'JetBrains Mono', monospace" }}
                >
                  {r.fecha}
                </span>
              </div>
            </div>
            <ResultadoBadge resultado={r.resultado} />
          </button>
        ))}
      </div>

      {/* Desktop: tabla completa */}
      <div className="hidden sm:block bg-card border border-border overflow-hidden" style={{ borderRadius: '0.25rem' }}>
        <table className="w-full text-xs">
          <thead>
            <tr className="text-[10px] text-muted-foreground tracking-widest border-b border-border"
              style={{ fontFamily: "'JetBrains Mono', monospace" }}>
              <th className="text-left px-3 py-2">ID</th>
              <th className="text-left px-3 py-2">PLANTILLA</th>
              <th className="text-left px-3 py-2">TÉCNICO</th>
              <th className="text-left px-3 py-2">ROL</th>
              <th className="text-left px-3 py-2">FECHA</th>
              <th className="text-left px-3 py-2">DURACIÓN</th>
              <th className="text-left px-3 py-2">ÍTEMS</th>
              <th className="text-left px-3 py-2">RESULTADO</th>
              <th className="text-right px-3 py-2">PDF</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr
                key={r.id}
                className="border-b border-border/40 last:border-b-0 hover:bg-muted/30 cursor-pointer transition-colors"
                onClick={() => setDetalle(r)}
                title="Ver detalle del checklist"
              >
                <td className="px-3 py-2 font-mono text-[10px] text-muted-foreground">
                  {r.id.slice(0, 8).toUpperCase()}
                </td>
                <td className="px-3 py-2 text-foreground">{r.plantilla}</td>
                <td className="px-3 py-2 text-foreground">{r.tecnico}</td>
                <td className="px-3 py-2 text-muted-foreground">{r.rol}</td>
                <td className="px-3 py-2 text-foreground">{r.fecha}</td>
                <td className="px-3 py-2 text-muted-foreground">{r.duracion}</td>
                <td className="px-3 py-2">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[10px] text-muted-foreground">
                      {r.ok}/{r.total}
                    </span>
                    <div className="w-10 h-1 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${r.total > 0 ? (r.ok / r.total) * 100 : 0}%`,
                          background: '#ABF768',
                        }}
                      />
                    </div>
                  </div>
                </td>
                <td className="px-3 py-2">
                  <ResultadoBadge resultado={r.resultado} />
                </td>
                <td className="px-3 py-2 text-right">
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      handleOpenPdfRange(r.id)
                    }}
                    className="inline-flex items-center gap-1 px-2 py-1 text-[10px] border border-border hover:border-primary/40"
                    style={{ borderRadius: '0.25rem' }}
                    title="Generar PDF"
                  >
                    <Download size={11} /> PDF
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal de detalle del historial */}
      {detalle && (
        <HistorialDetalleModal
          row={detalle}
          onClose={() => setDetalle(null)}
          onDownload={() => handleOpenPdfRange(detalle.id)}
        />
      )}

      {/* Modal de rango de fechas para el PDF */}
      {pdfRange && (
        <PdfRangeModal
          open
          asignacionId={pdfRange.asignacionId}
          bodegaId={bodegaId}
          onClose={() => setPdfRange(null)}
        />
      )}

      {/* Footer resumen */}
      <div className="flex items-center justify-between text-[10px] text-muted-foreground px-1"
        style={{ fontFamily: "'JetBrains Mono', monospace" }}>
        <div>
          {filtered.length} resultado(s)
          {fechaFiltro && baseRows.length === 0 && !loadingFecha && (
            <span className="ml-2 text-muted-foreground">— sin ejecuciones ese día</span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <span><span className="inline-block w-2 h-2 rounded-full mr-1" style={{ background: '#ABF768' }} />Aprobados: {resumen.aprobado}</span>
          <span><span className="inline-block w-2 h-2 rounded-full mr-1" style={{ background: '#facc15' }} />Con obs.: {resumen.observaciones}</span>
          <span><span className="inline-block w-2 h-2 rounded-full mr-1" style={{ background: '#E8593F' }} />Rechazados: {resumen.rechazado}</span>
        </div>
      </div>
    </div>
  )
}

// ─────────── badges ───────────

function EstadoBadge({ estado }: { estado: CkAsignado['estado'] }) {
  const map = {
    pendiente: 'bg-muted text-muted-foreground border-border',
    completado: 'bg-secondary/15 text-secondary border-secondary/20',
    vencido: 'bg-primary/15 text-primary border-primary/20',
  } as const
  const label = { pendiente: 'PENDIENTE', completado: 'COMPLETADO', vencido: 'VENCIDO' }[estado]
  return (
    <span
      className={`px-2 py-0.5 text-[10px] border ${map[estado]}`}
      style={{ borderRadius: '0.25rem', fontFamily: "'JetBrains Mono', monospace" }}
    >
      {label}
    </span>
  )
}

function ResultadoBadge({ resultado }: { resultado: CkHistorialItem['resultado'] }) {
  const map = {
    aprobado: 'bg-secondary/15 text-secondary border-secondary/20',
    observaciones: 'bg-yellow-400/15 text-yellow-400 border-yellow-400/20',
    rechazado: 'bg-primary/15 text-primary border-primary/20',
  } as const
  const label = { aprobado: 'Aprobado', observaciones: 'Con obs.', rechazado: 'Rechazado' }[resultado]
  return (
    <span
      className={`px-2 py-0.5 text-[10px] border ${map[resultado]}`}
      style={{ borderRadius: '0.25rem' }}
    >
      {label}
    </span>
  )
}

// ─────────── helpers ───────────

function initials(nombre: string): string {
  return nombre
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('')
}

function progressColor(estado: CkAsignado['estado'], progreso: number): string {
  if (estado === 'vencido') return '#E8593F'
  if (progreso >= 100) return '#ABF768'
  return '#facc15'
}

function Empty({ msg }: { msg: string }) {
  return (
    <div className="bg-card border border-border py-10 px-6 text-center text-xs text-muted-foreground"
      style={{ borderRadius: '0.25rem' }}>
      {msg}
    </div>
  )
}
