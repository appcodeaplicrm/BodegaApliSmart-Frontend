/**
 * Modal de calendario semanal para visualizar los checklists programados.
 *
 * Layout:
 *  - Header: título + nav de semana (anterior / "Semana actual" / siguiente) + cerrar.
 *  - Body: grid de 7 días × N horas. Cada bloque es un checklist.
 *  - Click en un bloque: cierra este modal y notifica al padre con
 *    el `asignacionId` para que abra el modal de ejecución.
 *  - Click en el número de día del header: filtra la lista de
 *    "Programados" del padre (notifica con el día YYYY-MM-DD).
 *
 * Reglas:
 *  - Solo lectura. No se puede arrastrar ni crear desde acá.
 *  - Color del bloque:
 *      - pendiente: lima (border-secondary)
 *      - completado: secondary (verde/lleno)
 *      - vencido: primary (naranja)
 *  - Si dos bloques se solapan en el mismo día/hora, los apilamos
 *    verticalmente con un offset (estilo Google Calendar).
 */
import { useEffect, useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, X, Loader2 } from 'lucide-react'
import { listarAsignacionesRango } from './api'
import { Modal } from './Modal'
import type { CkAsignado } from './types'

type Props = {
  bodegaId: string
  onClose: () => void
  /** Click en un bloque: abrimos el modal de ejecución. */
  onOpenAsignacion: (asignacionId: string) => void
  /** Click en el número del día: filtra la lista de Programados por día. */
  onGoToDay: (yyyyMmDd: string) => void
}

/** Horas que mostramos en el eje vertical (6am a 22pm = 17 filas). */
const HORAS = Array.from({ length: 17 }, (_, i) => i + 6) // [6, 7, ..., 22]

/** Lunes como inicio de semana. */
function startOfWeek(d: Date): Date {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  const dow = x.getDay() // 0=domingo, 1=lunes, ...
  const diff = (dow + 6) % 7 // distancia al lunes
  x.setDate(x.getDate() - diff)
  return x
}

function toYmd(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function addDays(d: Date, n: number): Date {
  const x = new Date(d)
  x.setDate(x.getDate() + n)
  return x
}

const DAY_LABELS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
const HOUR_HEIGHT_PX = 36 // altura de cada fila de hora

export function CalendarioProgramadosModal({
  bodegaId,
  onClose,
  onOpenAsignacion,
  onGoToDay,
}: Props) {
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()))
  const [rows, setRows] = useState<CkAsignado[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const weekEnd = useMemo(() => addDays(weekStart, 6), [weekStart])
  const days = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart],
  )

  useEffect(() => {
    if (!bodegaId) return
    let cancel = false
    setLoading(true)
    setError(null)
    listarAsignacionesRango(toYmd(weekStart), toYmd(weekEnd), bodegaId)
      .then((list) => {
        if (!cancel) setRows(list)
      })
      .catch((e) => {
        if (!cancel) setError((e as Error).message ?? 'Error al cargar el calendario.')
      })
      .finally(() => {
        if (!cancel) setLoading(false)
      })
    return () => {
      cancel = true
    }
  }, [weekStart, weekEnd, bodegaId])

  // Agrupamos por día (YYYY-MM-DD) y ordenamos por hora.
  const porDia = useMemo(() => {
    const map = new Map<string, CkAsignado[]>()
    for (const r of rows) {
      const ymd = toYmd(new Date(r.fechaLimite))
      if (!map.has(ymd)) map.set(ymd, [])
      map.get(ymd)!.push(r)
    }
    // Orden por hora dentro de cada día.
    for (const list of map.values()) {
      list.sort((a, b) => new Date(a.fechaLimite).getTime() - new Date(b.fechaLimite).getTime())
    }
    return map
  }, [rows])

  return (
    <Modal zIndex={100} full>
      <div
        className="bg-card border border-border shadow-2xl w-full h-full flex flex-col"
        style={{ borderRadius: 0 }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-border">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setWeekStart((w) => addDays(w, -7))}
              className="inline-flex items-center justify-center w-8 h-8 border border-border hover:border-primary/40"
              style={{ borderRadius: '0.25rem' }}
              title="Semana anterior"
            >
              <ChevronLeft size={14} />
            </button>
            <button
              onClick={() => setWeekStart(startOfWeek(new Date()))}
              className="px-3 py-1.5 text-xs border border-border hover:border-primary/40"
              style={{ borderRadius: '0.25rem' }}
            >
              Semana actual
            </button>
            <button
              onClick={() => setWeekStart((w) => addDays(w, 7))}
              className="inline-flex items-center justify-center w-8 h-8 border border-border hover:border-primary/40"
              style={{ borderRadius: '0.25rem' }}
              title="Semana siguiente"
            >
              <ChevronRight size={14} />
            </button>
            <span
              className="ml-3 text-sm text-foreground"
              style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700 }}
            >
              {weekStart.toLocaleDateString('es-CO', { day: '2-digit', month: 'short' })} —{' '}
              {weekEnd.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })}
            </span>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X size={16} />
          </button>
        </div>

        {/* Body: grid de 7 días */}
        <div className="flex-1 overflow-auto">
          {loading ? (
            <div className="flex items-center justify-center py-20 text-muted-foreground text-sm gap-2">
              <Loader2 size={14} className="animate-spin" />
              Cargando calendario…
            </div>
          ) : error ? (
            <div className="flex items-center justify-center py-20 text-primary text-sm">
              {error}
            </div>
          ) : (
            <WeekGrid
              days={days}
              porDia={porDia}
              onOpenAsignacion={onOpenAsignacion}
              onGoToDay={onGoToDay}
            />
          )}
        </div>

        {/* Footer / leyenda */}
        <div className="px-5 py-2 border-t border-border flex items-center gap-4 text-[10px] text-muted-foreground"
          style={{ fontFamily: "'JetBrains Mono', monospace" }}>
          <span className="inline-flex items-center gap-1">
            <span className="inline-block w-2 h-2 rounded-sm" style={{ background: '#ABF768' }} />
            Pendiente
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="inline-block w-2 h-2 rounded-sm" style={{ background: '#6B7B47' }} />
            Completado
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="inline-block w-2 h-2 rounded-sm" style={{ background: '#E8593F' }} />
            Vencido
          </span>
        </div>
      </div>
    </Modal>
  )
}

// ─────────── Grid ───────────

function WeekGrid({
  days,
  porDia,
  onOpenAsignacion,
  onGoToDay,
}: {
  days: Date[]
  porDia: Map<string, CkAsignado[]>
  onOpenAsignacion: (id: string) => void
  onGoToDay: (ymd: string) => void
}) {
  const todayYmd = toYmd(new Date())

  return (
    <div
      className="grid min-w-[860px]"
      style={{ gridTemplateColumns: '64px repeat(7, minmax(0, 1fr))' }}
    >
      {/* Esquina vacía */}
      <div className="bg-background border-b border-r border-border sticky left-0 z-10" />

      {/* Headers de día */}
      {days.map((d, i) => {
        const ymd = toYmd(d)
        const isToday = ymd === todayYmd
        return (
          <div
            key={ymd}
            className={[
              'bg-background border-b border-r border-border px-2 py-1.5 text-center',
              isToday ? 'bg-primary/5' : '',
            ].join(' ')}
          >
            <div
              className="text-[9px] text-muted-foreground tracking-widest"
              style={{ fontFamily: "'JetBrains Mono', monospace" }}
            >
              {DAY_LABELS[i]}
            </div>
            <button
              onClick={() => onGoToDay(ymd)}
              className={[
                'inline-flex items-center justify-center w-7 h-7 mt-0.5 text-sm',
                isToday
                  ? 'bg-primary text-primary-foreground rounded-full'
                  : 'text-foreground hover:text-primary',
              ].join(' ')}
              style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700 }}
              title={`Ir a ${d.toLocaleDateString('es-CO')}`}
            >
              {d.getDate()}
            </button>
          </div>
        )
      })}

      {/* Columna de horas (sticky izq) */}
      <div
        className="bg-background border-r border-border sticky left-0 z-10"
        style={{ height: `${HORAS.length * HOUR_HEIGHT_PX}px` }}
      >
        {HORAS.map((h) => (
          <div
            key={h}
            className="text-[10px] text-muted-foreground text-right pr-2 -mt-1.5"
            style={{
              height: `${HOUR_HEIGHT_PX}px`,
              fontFamily: "'JetBrains Mono', monospace",
            }}
          >
            {String(h).padStart(2, '0')}:00
          </div>
        ))}
      </div>

      {/* Columnas de días */}
      {days.map((d) => {
        const ymd = toYmd(d)
        const items = porDia.get(ymd) ?? []
        const isToday = ymd === todayYmd
        return (
          <DayColumn
            key={ymd}
            ymd={ymd}
            items={items}
            isToday={isToday}
            onOpenAsignacion={onOpenAsignacion}
          />
        )
      })}
    </div>
  )
}

function DayColumn({
  items,
  isToday,
  onOpenAsignacion,
}: {
  ymd: string
  items: CkAsignado[]
  isToday: boolean
  onOpenAsignacion: (id: string) => void
}) {
  // Layout del calendario:
  //  1) Cada asignación se proyecta a un SLOT con su `startMin`/`endMin`.
  //  2) AGRUPAMOS por (plantillaId + startMin) → si 3 técnicos tienen
  //     que correr "Herramientas" a las 9:00, se ve UN SOLO bloque con
  //     contador "(3)". Esto evita el "20 cuadritos" de la imagen.
  //  3) Después aplicamos el algoritmo de columnas (greedy) sobre los
  //     grupos: si hay 2 plantillas distintas a la misma hora, las
  //     apilamos side-by-side.
  const apilados = useMemo(() => {
    type Slot = {
      startMin: number
      endMin: number
      plantillaId: string
      plantillaNombre: string
      count: number
      asignaciones: CkAsignado[]
      col: number
    }

    function getStartMin(r: CkAsignado): number {
      if (r.plantillaHoraSugerida) {
        const d = new Date(r.plantillaHoraSugerida)
        return d.getUTCHours() * 60 + d.getUTCMinutes()
      }
      const dt = new Date(r.fechaLimite)
      return dt.getHours() * 60 + dt.getMinutes()
    }

    // 1) Construimos los slots base (1 por asignación).
    const allSlots = items.map((r) => {
      const startMin = getStartMin(r)
      return {
        startMin,
        endMin: startMin + 30,
        plantillaId: r.plantillaId,
        plantillaNombre: r.plantilla,
        count: 1,
        asignaciones: [r],
        col: 0,
      }
    })

    // 2) Agrupamos por (plantillaId, startMin).
    const groupMap = new Map<string, Slot>()
    for (const s of allSlots) {
      const key = `${s.plantillaId}|${s.startMin}`
      const existing = groupMap.get(key)
      if (existing) {
        existing.count += 1
        existing.asignaciones.push(s.asignaciones[0])
      } else {
        groupMap.set(key, { ...s, asignaciones: [...s.asignaciones] })
      }
    }
    const slots = Array.from(groupMap.values())

    // 3) Layout en columnas: ordenamos por startMin y asignamos columna
    //    al primer slot que no se solape.
    slots.sort((a, b) => a.startMin - b.startMin)
    const colGroups: Slot[][] = []
    for (const s of slots) {
      let placed = false
      for (const g of colGroups) {
        const last = g[g.length - 1]
        if (last.endMin <= s.startMin) {
          g.push(s)
          s.col = colGroups.indexOf(g)
          placed = true
          break
        }
      }
      if (!placed) {
        s.col = colGroups.length
        colGroups.push([s])
      }
    }
    const totalCols = Math.max(1, colGroups.length)
    return slots.map((s) => ({ ...s, totalCols }))
  }, [items])

  return (
    <div
      className={[
        'relative border-r border-border',
        isToday ? 'bg-primary/5' : 'bg-background',
      ].join(' ')}
      style={{ height: `${HORAS.length * HOUR_HEIGHT_PX}px` }}
    >
      {/* Líneas horizontales por hora */}
      {HORAS.map((_, idx) => (
        <div
          key={idx}
          className="absolute left-0 right-0 border-t border-border/40"
          style={{ top: `${idx * HOUR_HEIGHT_PX}px` }}
        />
      ))}

      {/* Bloques de checklists (agrupados por plantilla + hora) */}
      {apilados.map((s) => {
        const top = (s.startMin - HORAS[0] * 60) * (HOUR_HEIGHT_PX / 60)
        const height = Math.max(
          HOUR_HEIGHT_PX * 0.5,
          (s.endMin - s.startMin) * (HOUR_HEIGHT_PX / 60),
        )
        const widthPct = 100 / s.totalCols
        const leftPct = s.col * widthPct
        // Color del bloque: si TODAS las asignaciones del grupo están
        // en el mismo estado, usamos ese. Si hay mezcla, mostramos el
        // "más urgente" (vencido > pendiente > completado).
        const estados = s.asignaciones.map((a) => a.estado)
        let estadoGrupo: 'pendiente' | 'completado' | 'vencido' = 'pendiente'
        if (estados.every((e) => e === 'completado')) estadoGrupo = 'completado'
        else if (estados.some((e) => e === 'vencido')) estadoGrupo = 'vencido'
        else if (estados.every((e) => e !== 'completado')) estadoGrupo = 'pendiente'

        // La hora que se muestra: usamos la hora del grupo (la de la
        // plantilla, que ya está normalizada a HH:mm en el back).
        const hh = String(Math.floor(s.startMin / 60)).padStart(2, '0')
        const mm = String(s.startMin % 60).padStart(2, '0')

        // Tooltip: muestra los técnicos si son pocos, o un resumen si
        // son muchos.
        const tooltip =
          s.count === 1
            ? `${s.plantillaNombre} — ${s.asignaciones[0].tecnico} (${s.asignaciones[0].estado})`
            : `${s.plantillaNombre} × ${s.count}\n${s.asignaciones
                .slice(0, 5)
                .map((a) => `· ${a.tecnico} (${a.estado})`)
                .join('\n')}${s.asignaciones.length > 5 ? `\n… y ${s.asignaciones.length - 5} más` : ''}`

        return (
          <button
            key={`${s.plantillaId}-${s.startMin}`}
            onClick={() => {
              // Si solo hay 1, abrimos directamente. Si hay varias,
              // abrimos la primera (la lista de Programados muestra
              // todas las de ese día, así que el detalle se ve allá).
              onOpenAsignacion(s.asignaciones[0].id)
            }}
            className={[
              'absolute px-1.5 py-1 text-[10px] border-l-2 text-left overflow-hidden hover:brightness-110 transition',
              estadoClass(estadoGrupo),
            ].join(' ')}
            style={{
              top: `${top}px`,
              height: `${height}px`,
              left: `calc(${leftPct}% + 2px)`,
              width: `calc(${widthPct}% - 4px)`,
              borderRadius: '0.2rem',
            }}
            title={tooltip}
          >
            <div
              className="font-semibold truncate"
              style={{ fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: 0.2 }}
            >
              {s.plantillaNombre}
              {s.count > 1 && (
                <span
                  className="ml-1 px-1 rounded-sm bg-foreground/15 text-foreground/90"
                  style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9 }}
                >
                  ×{s.count}
                </span>
              )}
            </div>
            <div
              className="text-foreground/60"
              style={{ fontFamily: "'JetBrains Mono', monospace" }}
            >
              {hh}:{mm}
            </div>
          </button>
        )
      })}
    </div>
  )
}

function estadoClass(estado: CkAsignado['estado']): string {
  if (estado === 'completado') return 'bg-secondary/15 border-secondary/40 text-foreground'
  if (estado === 'vencido') return 'bg-primary/15 border-primary/40 text-foreground'
  return 'bg-yellow-400/15 border-yellow-400/40 text-foreground'
}
