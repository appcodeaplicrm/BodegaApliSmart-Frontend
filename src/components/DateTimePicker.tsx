/**
 * DateTimePicker — picker custom, mobile-friendly.
 *
 * Por qué NO usamos el picker nativo del browser:
 *  - En DESKTOP es inconsistente: el de fecha es lindo (calendario
 *    completo) pero el de hora es horrible (lista vertical minúscula
 *    de 1-12 / 00-59, casi imposible de tocar).
 *  - En MOBILE depende del OS (iOS rueda, Android grid/calendar)
 *    y rompe el look del app.
 *
 * Esta implementación es:
 *  - Custom UI 100% controlada por nosotros.
 *  - Touch targets de 44px en cada celda.
 *  - Misma data y comportamiento que el picker nativo.
 *  - 3 variantes:
 *      - `mode="date"`     → grid 7×6 con header de mes/año + ‹ ›
 *      - `mode="time"`     → dos columnas (hora 0-23 / minuto 0-59)
 *      - `mode="datetime"` → tabs Fecha | Hora, los dos pickers
 *
 * Reglas:
 *  - El componente renderiza su PROPIO modal con Portal.
 *  - El consumidor pasa `value` (YYYY-MM-DD o HH:mm) + `onChange`.
 *  - El botón de trigger (input) lo provee el consumidor.
 */
import { useState, useMemo, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { ChevronLeft, ChevronRight, X, Calendar, Clock } from 'lucide-react'

type Mode = 'date' | 'time' | 'datetime'

type DateTimePickerProps = {
  mode: Mode
  value: string
  onChange: (v: string) => void
  /** Texto que se muestra en el trigger button cuando value está vacío. */
  placeholder?: string
  /** label accesible del trigger. */
  label?: string
  /** Clases extra para el trigger button. */
  className?: string
}

const MONTHS_ES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]
const MONTHS_ES_SHORT = MONTHS_ES.map((m) => m.slice(0, 3))
const DAYS_ES = ['L', 'M', 'X', 'J', 'V', 'S', 'D'] // Lunes primero
const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'))
const MINUTES = ['00', '05', '10', '15', '20', '25', '30', '35', '40', '45', '50', '55']

// ─────── helpers ───────

function parseYmd(s: string): Date | null {
  if (!s) return null
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s)
  if (!m) return null
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
}

function formatYmd(d: Date): string {
  const y = d.getFullYear()
  const mo = String(d.getMonth() + 1).padStart(2, '0')
  const da = String(d.getDate()).padStart(2, '0')
  return `${y}-${mo}-${da}`
}

function formatDateLong(d: Date): string {
  // ej "Vie 7 de Agosto de 2026"
  const dayLabel = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'][d.getDay()]
  return `${dayLabel} ${d.getDate()} de ${MONTHS_ES[d.getMonth()]} de ${d.getFullYear()}`
}

function parseHm(s: string): { h: number; m: number } | null {
  if (!s) return null
  const m = /^(\d{2}):(\d{2})$/.exec(s)
  if (!m) return null
  return { h: Number(m[1]), m: Number(m[2]) }
}

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1)
}

// Devuelve los 42 días (6 semanas) que se muestran en el grid.
// Semana empieza en lunes.
function monthGridDays(monthAnchor: Date): Date[] {
  const first = startOfMonth(monthAnchor)
  const dow = (first.getDay() + 6) % 7 // 0 = lunes
  const start = new Date(first)
  start.setDate(first.getDate() - dow)
  const days: Date[] = []
  for (let i = 0; i < 42; i++) {
    const d = new Date(start)
    d.setDate(start.getDate() + i)
    days.push(d)
  }
  return days
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

// ─────── trigger button ───────

export function DateTimePicker({ mode, value, onChange, placeholder, label, className }: DateTimePickerProps) {
  const [open, setOpen] = useState(false)
  const Icon = mode === 'time' ? Clock : Calendar

  // Texto que se muestra en el botón (lo que el user ve como valor)
  const display = useMemo(() => {
    if (mode === 'date' || mode === 'datetime') {
      const d = parseYmd(value)
      if (d) return d.toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric' })
    }
    if (mode === 'time' || mode === 'datetime') {
      return value || ''
    }
    return ''
  }, [mode, value])

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={label}
        className={[
          'min-h-[44px] w-full bg-background border border-border px-3 text-sm text-left text-foreground hover:border-foreground/30 focus:border-primary/60 focus:outline-none transition-colors flex items-center gap-2',
          className ?? '',
        ].join(' ')}
        style={{ borderRadius: '0.25rem' }}
      >
        <Icon size={14} className="text-muted-foreground shrink-0" />
        <span className={display ? 'text-foreground' : 'text-muted-foreground'}>
          {display || placeholder || 'Seleccionar…'}
        </span>
      </button>
      {open && (
        <DateTimePickerModal
          mode={mode}
          value={value}
          onChange={(v) => onChange(v)}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  )
}

// ─────── modal ───────

function DateTimePickerModal({
  mode,
  value,
  onChange,
  onClose,
}: {
  mode: Mode
  value: string
  onChange: (v: string) => void
  onClose: () => void
}) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    setMounted(true)
  }, [])

  // Modo activo: si mode='datetime' arrancamos en 'date' y desde
  // ahí el user puede pasar a 'time' tocando la pestaña.
  const [activeTab, setActiveTab] = useState<'date' | 'time'>(
    mode === 'time' ? 'time' : 'date',
  )

  // Estado interno del picker.
  // - Para date: monthAnchor = primer día del mes que se está viendo.
  // - Para time: hora y minuto en draft (se aplican al cerrar).
  const initialDate = parseYmd(value) ?? new Date()
  const initialHm = parseHm(value) ?? { h: 8, m: 0 }

  const [monthAnchor, setMonthAnchor] = useState<Date>(startOfMonth(initialDate))
  const [draftH, setDraftH] = useState<number>(initialHm.h)
  const [draftM, setDraftM] = useState<number>(initialHm.m)

  // Cierra con Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  if (!mounted) return null

  // Aceptar = aplicar cambios y cerrar.
  const handleAccept = () => {
    if (mode === 'date') {
      onChange(formatYmd(initialDate))
    } else if (mode === 'time') {
      onChange(
        `${String(draftH).padStart(2, '0')}:${String(draftM).padStart(2, '0')}`,
      )
    } else {
      // datetime: el día siempre es initialDate (porque el user pudo
      // navegar el calendario); la hora es draftH/draftM.
      // Si el user tocó la pestaña Time, aceptamos con la fecha
      // actual del calendario (puede ser distinta a value).
      onChange(
        `${formatYmd(initialDate)}T${String(draftH).padStart(2, '0')}:${String(draftM).padStart(2, '0')}`,
      )
    }
    onClose()
  }

  const showTabs = mode === 'datetime'
  const isTimeMode = activeTab === 'time' || mode === 'time'

  return createPortal(
    <div
      className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        className="bg-card border border-border w-full sm:max-w-md flex flex-col max-h-[100dvh] sm:max-h-[92dvh] overflow-hidden rounded-t-2xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-2 p-4 border-b border-border shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <Calendar size={16} className="text-primary shrink-0" />
            <h2
              className="text-base uppercase text-foreground truncate"
              style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900 }}
            >
              {mode === 'date' && 'Elegir fecha'}
              {mode === 'time' && 'Elegir hora'}
              {mode === 'datetime' && 'Elegir fecha y hora'}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="min-w-[44px] min-h-[44px] -mr-2 flex items-center justify-center text-muted-foreground hover:text-foreground"
          >
            <X size={18} />
          </button>
        </div>

        {/* Tabs (solo datetime) */}
        {showTabs && (
          <div className="flex border-b border-border shrink-0">
            <TabBtn active={activeTab === 'date'} onClick={() => setActiveTab('date')} icon={<Calendar size={13} />}>
              Fecha
            </TabBtn>
            <TabBtn active={activeTab === 'time'} onClick={() => setActiveTab('time')} icon={<Clock size={13} />}>
              Hora
            </TabBtn>
          </div>
        )}

        {/* Body scrolleable */}
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-4">
          {isTimeMode ? (
            <TimePicker
              hour={draftH}
              minute={draftM}
              onHourChange={setDraftH}
              onMinuteChange={setDraftM}
            />
          ) : (
            <DatePicker
              monthAnchor={monthAnchor}
              selected={initialDate}
              onSelect={(d) => {
                // Cambiamos la fecha "seleccionada" navegando el mes
                // si hace falta.
                if (d.getMonth() !== monthAnchor.getMonth() || d.getFullYear() !== monthAnchor.getFullYear()) {
                  setMonthAnchor(startOfMonth(d))
                }
                // Para mantener consistencia con `value`, aceptamos
                // inmediatamente al tocar un día y cerramos si no
                // estamos en modo datetime.
                onChange(formatYmd(d))
                if (mode === 'date') onClose()
                else setActiveTab('time') // si es datetime, saltamos a hora
              }}
              onMonthChange={(delta) => {
                const next = new Date(monthAnchor)
                next.setMonth(monthAnchor.getMonth() + delta)
                setMonthAnchor(next)
              }}
              onToday={() => {
                const today = new Date()
                setMonthAnchor(startOfMonth(today))
                onChange(formatYmd(today))
                if (mode === 'date') onClose()
                else setActiveTab('time')
              }}
            />
          )}
        </div>

        {/* Footer: solo en time/datetime (en date ya cerramos al tocar) */}
        {isTimeMode && (
          <div className="p-4 border-t border-border shrink-0 bg-card flex items-center gap-2"
            style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}>
            <div className="flex-1 min-w-0 text-sm text-muted-foreground">
              <span
                className="text-foreground font-semibold tabular-nums"
                style={{ fontFamily: "'JetBrains Mono', monospace" }}
              >
                {String(draftH).padStart(2, '0')}:{String(draftM).padStart(2, '0')}
              </span>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="min-h-[44px] px-4 text-sm border border-border text-foreground hover:border-foreground/30 transition-colors"
              style={{ borderRadius: '0.25rem' }}
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleAccept}
              className="min-h-[44px] px-4 text-sm bg-primary text-primary-foreground font-semibold hover:opacity-90 transition-opacity"
              style={{ borderRadius: '0.25rem' }}
            >
              Aceptar
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body,
  )
}

// ─────── tabs ───────

function TabBtn({
  active,
  onClick,
  children,
  icon,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
  icon?: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'flex-1 min-h-[44px] inline-flex items-center justify-center gap-1.5 text-xs font-medium transition-colors',
        active
          ? 'text-foreground border-b-2 border-primary'
          : 'text-muted-foreground border-b-2 border-transparent hover:text-foreground',
      ].join(' ')}
    >
      {icon}
      {children}
    </button>
  )
}

// ─────── date picker ───────

function DatePicker({
  monthAnchor,
  selected,
  onSelect,
  onMonthChange,
  onToday,
}: {
  monthAnchor: Date
  selected: Date
  onSelect: (d: Date) => void
  onMonthChange: (delta: number) => void
  onToday: () => void
}) {
  const days = useMemo(() => monthGridDays(monthAnchor), [monthAnchor])
  const today = useMemo(() => new Date(), [])
  const monthName = MONTHS_ES[monthAnchor.getMonth()]
  const year = monthAnchor.getFullYear()

  return (
    <div>
      {/* Header con ‹ mes › */}
      <div className="flex items-center justify-between mb-3">
        <button
          type="button"
          onClick={() => onMonthChange(-1)}
          aria-label="Mes anterior"
          className="min-w-[44px] min-h-[44px] flex items-center justify-center text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft size={18} />
        </button>
        <div
          className="text-sm font-semibold text-foreground"
          style={{ fontFamily: "'Barlow Condensed', sans-serif" }}
        >
          {monthName} {year}
        </div>
        <button
          type="button"
          onClick={() => onMonthChange(1)}
          aria-label="Mes siguiente"
          className="min-w-[44px] min-h-[44px] flex items-center justify-center text-muted-foreground hover:text-foreground"
        >
          <ChevronRight size={18} />
        </button>
      </div>

      {/* Header días de la semana */}
      <div className="grid grid-cols-7 gap-1 mb-1">
        {DAYS_ES.map((d) => (
          <div
            key={d}
            className="h-8 flex items-center justify-center text-[10px] text-muted-foreground tracking-widest"
            style={{ fontFamily: "'JetBrains Mono', monospace" }}
          >
            {d}
          </div>
        ))}
      </div>

      {/* Grid 7×6 */}
      <div className="grid grid-cols-7 gap-1">
        {days.map((d) => {
          const isCurrentMonth = d.getMonth() === monthAnchor.getMonth()
          const isSelected = isSameDay(d, selected)
          const isToday = isSameDay(d, today)
          return (
            <button
              key={d.toISOString()}
              type="button"
              onClick={() => onSelect(d)}
              className={[
                'min-h-[44px] min-w-[44px] text-sm rounded-md transition-colors flex items-center justify-center',
                isSelected
                  ? 'bg-primary text-primary-foreground font-semibold'
                  : isToday
                    ? 'bg-primary/15 text-primary border border-primary/30'
                    : isCurrentMonth
                      ? 'text-foreground hover:bg-muted'
                      : 'text-muted-foreground/50 hover:bg-muted/50',
              ].join(' ')}
              style={{ borderRadius: '0.375rem' }}
            >
              {d.getDate()}
            </button>
          )
        })}
      </div>

      {/* Footer: Hoy / selected */}
      <div className="mt-4 flex items-center justify-between text-xs">
        <button
          type="button"
          onClick={onToday}
          className="text-primary hover:underline"
        >
          Hoy
        </button>
        <span className="text-muted-foreground">{formatDateLong(selected)}</span>
      </div>
    </div>
  )
}

// ─────── time picker ───────

function TimePicker({
  hour,
  minute,
  onHourChange,
  onMinuteChange,
}: {
  hour: number
  minute: number
  onHourChange: (h: number) => void
  onMinuteChange: (m: number) => void
}) {
  const hourColRef = useRef<HTMLDivElement | null>(null)
  const minuteColRef = useRef<HTMLDivElement | null>(null)

  // Auto-scroll a la hora/minuto seleccionado al abrir.
  useEffect(() => {
    if (hourColRef.current) {
      const btn = hourColRef.current.querySelector<HTMLElement>(`[data-h="${hour}"]`)
      btn?.scrollIntoView({ block: 'center' })
    }
    if (minuteColRef.current) {
      const btn = minuteColRef.current.querySelector<HTMLElement>(`[data-m="${minute}"]`)
      btn?.scrollIntoView({ block: 'center' })
    }
  }, [hour, minute])

  return (
    <div>
      {/* Display grande HH:MM */}
      <div className="text-center mb-4">
        <div
          className="text-5xl text-foreground tabular-nums tracking-tight"
          style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800 }}
        >
          {String(hour).padStart(2, '0')}:{String(minute).padStart(2, '0')}
        </div>
      </div>

      {/* Dos columnas: horas 0-23 / minutos cada 5 */}
      <div className="grid grid-cols-2 gap-2">
        {/* Columna horas */}
        <div
          ref={hourColRef}
          className="max-h-[260px] overflow-y-auto overscroll-contain border border-border"
          style={{ borderRadius: '0.375rem' }}
        >
          {HOURS.map((h) => {
            const selected = Number(h) === hour
            return (
              <button
                key={h}
                type="button"
                data-h={h}
                onClick={() => onHourChange(Number(h))}
                className={[
                  'w-full min-h-[44px] px-3 text-sm tabular-nums transition-colors',
                  selected
                    ? 'bg-primary text-primary-foreground font-semibold'
                    : 'text-foreground hover:bg-muted',
                ].join(' ')}
              >
                {h}
              </button>
            )
          })}
        </div>
        {/* Columna minutos (cada 5) */}
        <div
          ref={minuteColRef}
          className="max-h-[260px] overflow-y-auto overscroll-contain border border-border"
          style={{ borderRadius: '0.375rem' }}
        >
          {MINUTES.map((m) => {
            const selected = Number(m) === minute
            return (
              <button
                key={m}
                type="button"
                data-m={m}
                onClick={() => onMinuteChange(Number(m))}
                className={[
                  'w-full min-h-[44px] px-3 text-sm tabular-nums transition-colors',
                  selected
                    ? 'bg-primary text-primary-foreground font-semibold'
                    : 'text-foreground hover:bg-muted',
                ].join(' ')}
              >
                {m}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
