import { useEffect, useRef, useState } from 'react'
import { Bell, BellRing, Loader2, MessageCircle } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { api } from '../lib/api'
import { useChatNotificationSound } from '../hooks/useChatNotificationSound'
import { useRealtimeEvent } from '../hooks/useRealtimeEvent'
import { activarPush, pushDisponible, sincronizarPushSiPermitido } from '../lib/pushNotifications'

type Notificacion = {
  id: string
  tipo: string
  titulo: string
  mensaje: string
  ruta: string | null
  leidaAt: string | null
  createdAt: string
}

type NotificacionesResponse = { items: Notificacion[]; noLeidas: number }
let ultimaNotificacionConSonido: string | null = null

/** Campana global: conserva mensajes de chat y novedades operativas. */
export function HeaderNotificationsButton() {
  const navigate = useNavigate()
  const { play: reproducirSonido } = useChatNotificationSound()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [items, setItems] = useState<Notificacion[]>([])
  const [noLeidas, setNoLeidas] = useState(0)
  const [activandoPush, setActivandoPush] = useState(false)
  const [pushActivo, setPushActivo] = useState(
    () => typeof Notification !== 'undefined' && Notification.permission === 'granted',
  )
  const containerRef = useRef<HTMLDivElement>(null)

  useRealtimeEvent<Notificacion>('notificacion.creada', (evento) => {
    const notificacion = evento.payload
    if (!notificacion?.id) return
    setItems((actuales) => [notificacion, ...actuales.filter((item) => item.id !== notificacion.id)].slice(0, 10))
    setNoLeidas((actual) => actual + 1)
    if (ultimaNotificacionConSonido !== notificacion.id) {
      ultimaNotificacionConSonido = notificacion.id
      reproducirSonido()
    }
  })

  useEffect(() => {
    void sincronizarPushSiPermitido().catch(() => undefined)
    void api.get<NotificacionesResponse>('/notificaciones?limit=10').then((response) => {
      setItems(response.items)
      setNoLeidas(response.noLeidas)
    }).catch(() => undefined)
  }, [])

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

  async function cargar() {
    setLoading(true)
    setError(null)
    try {
      const response = await api.get<NotificacionesResponse>('/notificaciones?limit=10')
      setItems(response.items)
      setNoLeidas(response.noLeidas)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudieron cargar las notificaciones.')
    } finally {
      setLoading(false)
    }
  }

  async function toggle() {
    const nextOpen = !open
    setOpen(nextOpen)
    if (nextOpen) await cargar()
  }

  async function abrirNotificacion(item: Notificacion) {
    if (!item.leidaAt) {
      await api.patch(`/notificaciones/${item.id}/leer`).catch(() => undefined)
      setItems((actuales) => actuales.map((actual) => actual.id === item.id
        ? { ...actual, leidaAt: new Date().toISOString() }
        : actual))
      setNoLeidas((actual) => Math.max(0, actual - 1))
    }
    setOpen(false)
    if (item.ruta) navigate(item.ruta)
  }

  async function marcarTodas() {
    await api.patch('/notificaciones/leer-todas')
    setItems((actuales) => actuales.map((item) => ({ ...item, leidaAt: item.leidaAt ?? new Date().toISOString() })))
    setNoLeidas(0)
  }

  async function habilitarPush() {
    setActivandoPush(true)
    setError(null)
    try {
      await activarPush()
      setPushActivo(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo activar Push.')
    } finally {
      setActivandoPush(false)
    }
  }

  return (
    <div ref={containerRef} className="relative shrink-0">
      <button
        type="button"
        onClick={() => void toggle()}
        title="Notificaciones"
        aria-label={`Abrir notificaciones${noLeidas ? `, ${noLeidas} sin leer` : ''}`}
        aria-expanded={open}
        className="relative w-9 h-9 inline-flex items-center justify-center border border-border text-muted-foreground hover:text-foreground hover:border-foreground/30 hover:bg-muted transition-colors"
        style={{ borderRadius: '0.25rem' }}
      >
        <Bell size={15} />
        {noLeidas > 0 && (
          <span className="absolute -top-1.5 -right-1.5 min-w-4 h-4 px-1 rounded-full bg-primary text-primary-foreground text-[9px] font-bold inline-flex items-center justify-center">
            {noLeidas > 99 ? '99+' : noLeidas}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 z-50 w-[min(23rem,calc(100vw-1.5rem))] bg-card border border-border shadow-2xl overflow-hidden rounded">
          <div className="px-4 py-3 border-b border-border flex items-start justify-between gap-3">
            <div>
              <div className="text-sm uppercase text-foreground font-heading font-light">Notificaciones recientes</div>
              <div className="text-[9px] uppercase tracking-widest text-muted-foreground mt-0.5 font-mono">Mensajes y actividad de tu cuenta</div>
            </div>
            {noLeidas > 0 && (
              <button type="button" onClick={() => void marcarTodas()} className="text-[9px] text-secondary hover:underline whitespace-nowrap">Marcar leídas</button>
            )}
          </div>

          {!pushActivo && pushDisponible() && (
            <button
              type="button"
              disabled={activandoPush}
              onClick={() => void habilitarPush()}
              className="w-full px-4 py-2.5 border-b border-border flex items-center gap-2 text-[10px] text-secondary hover:bg-secondary/5 disabled:opacity-50"
            >
              {activandoPush ? <Loader2 size={12} className="animate-spin" /> : <BellRing size={12} />}
              Activar notificaciones en este dispositivo
            </button>
          )}

          <div className="max-h-[26rem] overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center gap-2 py-10 text-xs text-muted-foreground"><Loader2 size={14} className="animate-spin" /> Cargando…</div>
            ) : error ? (
              <div className="m-3 px-3 py-2 text-xs text-primary bg-primary/10 border border-primary/20">{error}</div>
            ) : items.length === 0 ? (
              <div className="px-4 py-10 text-center text-xs text-muted-foreground">No tienes notificaciones recientes.</div>
            ) : (
              <ul className="divide-y divide-border">
                {items.map((item) => {
                  const esChat = item.tipo === 'CHAT_MENSAJE'
                  return (
                    <li key={item.id}>
                      <button type="button" onClick={() => void abrirNotificacion(item)} className="w-full px-4 py-3 text-left hover:bg-muted/40 transition-colors">
                        <div className="flex items-start gap-3">
                          <span className={`mt-0.5 w-7 h-7 shrink-0 rounded-full inline-flex items-center justify-center ${esChat ? 'bg-secondary/15 text-secondary' : 'bg-primary/10 text-primary'}`}>
                            {esChat ? <MessageCircle size={13} /> : <Bell size={13} />}
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-start gap-2">
                              <div className="text-xs text-foreground leading-snug flex-1">{item.titulo}</div>
                              {!item.leidaAt && <span className="mt-1 w-1.5 h-1.5 rounded-full bg-primary shrink-0" />}
                            </div>
                            <p className="text-[10px] text-muted-foreground mt-1 line-clamp-2">{item.mensaje}</p>
                            <div className="flex items-center justify-between gap-3 mt-1.5">
                              <span className="text-[9px] uppercase tracking-wider text-muted-foreground font-mono">{esChat ? 'Chat' : item.tipo.split('_').join(' ')}</span>
                              <time dateTime={item.createdAt} className="text-[9px] text-muted-foreground whitespace-nowrap font-mono">{formatFecha(item.createdAt)}</time>
                            </div>
                          </div>
                        </div>
                      </button>
                    </li>
                  )
                })}
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
  return fecha.toLocaleString('es-CO', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}
