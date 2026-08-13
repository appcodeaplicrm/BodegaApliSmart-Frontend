import { useEffect, useRef, useState } from 'react'
import { Bell, Loader2 } from 'lucide-react'
import { api } from '../lib/api'

type NotificacionReciente = {
  accion: string
  modulo: string
  fecha: string
  ip: string
  dispositivo: string
}

/** Campana global con las 10 novedades más recientes del usuario. */
export function HeaderNotificationsButton() {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [items, setItems] = useState<NotificacionReciente[]>([])
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return

    const handlePointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false)
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }

    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [open])

  async function toggle() {
    const nextOpen = !open
    setOpen(nextOpen)
    if (!nextOpen) return

    setLoading(true)
    setError(null)
    try {
      const recientes = await api.get<NotificacionReciente[]>('/perfil/actividad?limit=10')
      setItems(recientes.slice(0, 10))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudieron cargar las notificaciones.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div ref={containerRef} className="relative shrink-0">
      <button
        type="button"
        onClick={() => void toggle()}
        title="Notificaciones"
        aria-label="Abrir notificaciones"
        aria-expanded={open}
        className="relative w-9 h-9 inline-flex items-center justify-center border border-border text-muted-foreground hover:text-foreground hover:border-foreground/30 hover:bg-muted transition-colors"
        style={{ borderRadius: '0.25rem' }}
      >
        <Bell size={15} />
        {items.length > 0 && (
          <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-primary" />
        )}
      </button>

      {open && (
        <div
          className="absolute right-0 top-full mt-2 z-50 w-[min(22rem,calc(100vw-1.5rem))] bg-card border border-border shadow-2xl overflow-hidden"
          style={{ borderRadius: '0.25rem' }}
        >
          <div className="px-4 py-3 border-b border-border">
            <div
              className="text-sm uppercase text-foreground"
              style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 200 }}
            >
              Notificaciones recientes
            </div>
            <div
              className="text-[9px] uppercase tracking-widest text-muted-foreground mt-0.5"
              style={{ fontFamily: "'JetBrains Mono', monospace" }}
            >
              Últimas 10 novedades de tu cuenta
            </div>
          </div>

          <div className="max-h-[26rem] overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center gap-2 py-10 text-xs text-muted-foreground">
                <Loader2 size={14} className="animate-spin" />
                Cargando…
              </div>
            ) : error ? (
              <div className="m-3 px-3 py-2 text-xs text-primary bg-primary/10 border border-primary/20">
                {error}
              </div>
            ) : items.length === 0 ? (
              <div className="px-4 py-10 text-center text-xs text-muted-foreground">
                No tienes notificaciones recientes.
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {items.map((item, index) => (
                  <li key={`${item.fecha}-${item.accion}-${index}`} className="px-4 py-3 hover:bg-muted/30">
                    <div className="flex items-start gap-3">
                      <span className="mt-1.5 w-2 h-2 rounded-full bg-primary shrink-0" />
                      <div className="min-w-0 flex-1">
                        <div className="text-xs text-foreground leading-snug">{item.accion}</div>
                        <div className="flex items-center justify-between gap-3 mt-1">
                          <span
                            className="text-[9px] uppercase tracking-wider text-muted-foreground truncate"
                            style={{ fontFamily: "'JetBrains Mono', monospace" }}
                          >
                            {item.modulo}
                          </span>
                          <time
                            dateTime={item.fecha}
                            className="text-[9px] text-muted-foreground whitespace-nowrap"
                            style={{ fontFamily: "'JetBrains Mono', monospace" }}
                          >
                            {formatFecha(item.fecha)}
                          </time>
                        </div>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function formatFecha(value: string): string {
  const fecha = new Date(value)
  if (Number.isNaN(fecha.getTime())) return '—'
  return fecha.toLocaleString('es-CO', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}
