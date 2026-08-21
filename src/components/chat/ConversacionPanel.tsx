/**
 * Panel de la conversación activa (lado derecho de ChatView).
 *
 * Muestra:
 *  - Header con el nombre del otro usuario + estado "escribiendo..."
 *  - Lista de mensajes (con paginación scroll-up)
 *  - Indicador "está escribiendo..." del otro
 *  - Input con: adjuntar imagen, emoji picker, reply preview, send
 *
 * El panel se monta solo cuando hay una conversación seleccionada.
 * Se suscribe a eventos WS (mensajes / leído / escribiendo /
 * reacción) y se une a la room de la conv al abrir.
 */

import {
  ChangeEvent,
  KeyboardEvent,
  RefObject,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react'
import { ArrowLeft, Loader2, Paperclip, Reply, Send, X, Image as ImageIcon } from 'lucide-react'
import { imageUrl } from '../../lib/apiBase'
import { MensajeBurbuja } from './MensajeBurbuja'
import { EmojiPicker } from './EmojiPicker'
import {
  chatDejoDeEscribir,
  chatEscribiendo,
  chatSalir,
  chatUnirse,
  useChatWsEvent,
} from './useChatSocket'
import {
  enviarMensaje,
  listarMensajes,
  marcarLeido,
  toggleReaccion,
  eliminarMensaje as apiEliminarMensaje,
  uploadAdjunto,
} from './api'
import { useAuth } from '../../store/auth'
import type { ChatMensaje } from './types'

type Props = {
  conversacionId: string
  otroUsuario: { id: string; nombre: string; fotoKey: string | null }
  onBack?: () => void // mobile: volver a la lista de conversaciones
  /** Mostrar el input de "nuevo chat" inline (no aplica acá, queda
   *  como placeholder). */
}

const PAGE_SIZE = 50

export function ConversacionPanel({
  conversacionId,
  otroUsuario,
  onBack,
}: Props) {
  const auth = useAuth()
  const miUserId = auth.status === 'autenticado' ? auth.sesion.usuario.id : ''

  // ─── Estado de mensajes ───
  const [mensajes, setMensajes] = useState<ChatMensaje[]>([])
  const [loadingMsgs, setLoadingMsgs] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(false)
  const [oldestId, setOldestId] = useState<string | null>(null)
  const [loadingMore, setLoadingMore] = useState(false)

  // ─── Estado de UI: input + reply + upload ───
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [replyTo, setReplyTo] = useState<ChatMensaje | null>(null)
  const [adjuntosLocales, setAdjuntosLocales] = useState<
    Array<{
      key: string
      mimeType: string
      sizeBytes: number
      ancho?: number
      alto?: number
      nombre?: string
      previewUrl: string // blob: para preview local
    }>
  >([])

  // ─── Estado "escribiendo" del otro ───
  const [otroEscribiendo, setOtroEscribiendo] = useState(false)
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ─── Refs ───
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const inputRef = useRef<HTMLTextAreaElement | null>(null)
  const lastSentTypingRef = useRef<number>(0)

  // ───────────────────────────────────────────────────────────
  //  Carga inicial: trae los últimos N mensajes
  // ───────────────────────────────────────────────────────────
  const cargarInicial = useCallback(async () => {
    if (!conversacionId) return
    setLoadingMsgs(true)
    setError(null)
    try {
      const res = await listarMensajes(conversacionId, undefined, PAGE_SIZE)
      setMensajes(res.data)
      setHasMore(!!res.meta.nextBeforeId)
      setOldestId(res.meta.nextBeforeId)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron cargar los mensajes.')
    } finally {
      setLoadingMsgs(false)
    }
  }, [conversacionId])

  useEffect(() => {
    void cargarInicial()
  }, [cargarInicial])

  // ───────────────────────────────────────────────────────────
  //  Unirse / salir de la room WS
  // ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (!conversacionId) return
    chatUnirse(conversacionId)
    return () => {
      chatSalir(conversacionId)
    }
  }, [conversacionId])

  // ───────────────────────────────────────────────────────────
  //  Auto-scroll al fondo cuando entran mensajes nuevos
  // ───────────────────────────────────────────────────────────
  const stickToBottomRef = useRef(true)
  const onScroll = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight
    stickToBottomRef.current = distFromBottom < 80
    // Si scrolleamos cerca del tope, cargar más viejos.
    if (el.scrollTop < 60 && hasMore && !loadingMore) {
      void cargarMasViejos()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasMore, loadingMore, oldestId])

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    if (stickToBottomRef.current) {
      // Scroll al fondo en el siguiente frame (esperar que el DOM
      // actualice con el nuevo mensaje).
      requestAnimationFrame(() => {
        el.scrollTop = el.scrollHeight
      })
    }
  }, [mensajes.length])

  const cargarMasViejos = useCallback(async () => {
    if (!hasMore || !oldestId || loadingMore) return
    setLoadingMore(true)
    // Guardar el scroll relativo: vamos a hacer append al inicio
    // (los más viejos), así que después de cargar tenemos que
    // mantener el mismo mensaje visible.
    const el = scrollRef.current
    const prevScrollHeight = el?.scrollHeight ?? 0
    const prevScrollTop = el?.scrollTop ?? 0
    try {
      const res = await listarMensajes(conversacionId, oldestId, PAGE_SIZE)
      setMensajes((prev) => [...res.data, ...prev])
      setHasMore(!!res.meta.nextBeforeId)
      setOldestId(res.meta.nextBeforeId)
      // Restaurar scroll: el nuevo contenido se agregó arriba, así
      // que la distancia al fondo es la misma. Recalculamos.
      requestAnimationFrame(() => {
        if (!el) return
        const newHeight = el.scrollHeight
        el.scrollTop = prevScrollTop + (newHeight - prevScrollHeight)
      })
    } catch {
      /* fail silently */
    } finally {
      setLoadingMore(false)
    }
  }, [conversacionId, hasMore, oldestId, loadingMore])

  // ───────────────────────────────────────────────────────────
  //  Marcar como leído (con debounce)
  //  ───────────────────────────────────────────────────────────
  //  Si llegan N mensajes del otro seguidos, no queremos
  //  mandar N POSTs a /leido (uno solo basta). Consolidamos
  //  con un debounce de 800ms: el último mensaje visto es el
  //  que manda.
  const marcarLeidoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const scheduleMarcarLeido = useCallback(() => {
    if (marcarLeidoTimerRef.current) clearTimeout(marcarLeidoTimerRef.current)
    marcarLeidoTimerRef.current = setTimeout(() => {
      marcarLeidoTimerRef.current = null
      if (mensajesRef.current.length === 0) return
      const last = mensajesRef.current[mensajesRef.current.length - 1]
      if (!last) return
      if (last.autorId === miUserIdRef.current) return
      if (!stickToBottomRef.current) return
      void marcarLeido(conversacionId, last.id).catch(() => {})
    }, 800)
  }, [conversacionId])
  useEffect(() => {
    return () => {
      if (marcarLeidoTimerRef.current) clearTimeout(marcarLeidoTimerRef.current)
    }
  }, [])

  // Refs para acceder al estado actual dentro del callback del
  // timer (los callbacks se crean una vez y pueden quedar
  // "viejos" si usamos closures con el state directo).
  const mensajesRef = useRef<ChatMensaje[]>([])
  const miUserIdRef = useRef<string>('')
  useEffect(() => {
    mensajesRef.current = mensajes
    miUserIdRef.current = miUserId
  })

  useEffect(() => {
    if (loadingMsgs || mensajes.length === 0) return
    scheduleMarcarLeido()
  }, [mensajes, loadingMsgs, scheduleMarcarLeido])

  // ───────────────────────────────────────────────────────────
  //  WS: mensaje nuevo
  // ───────────────────────────────────────────────────────────
  useChatWsEvent<{ payload: ChatMensaje }>(
    'realtime:chat.mensaje-nuevo',
    (ev) => {
      const m = ev.payload
      if (m.conversacionId !== conversacionId) return
      setMensajes((prev) => {
        if (prev.some((x) => x.id === m.id)) return prev
        return [...prev, m]
      })
      // El marcarLeido lo dispara el useEffect de arriba
      // (consolidado con debounce, evita flood de POSTs).
    },
  )

  // ───────────────────────────────────────────────────────────
  //  WS: mensaje eliminado
  // ───────────────────────────────────────────────────────────
  useChatWsEvent<{ payload: { id: string; conversacionId: string } }>(
    'realtime:chat.mensaje-eliminado',
    (ev) => {
      if (ev.payload.conversacionId !== conversacionId) return
      setMensajes((prev) =>
        prev.map((m) =>
          m.id === ev.payload.id
            ? { ...m, deletedAt: new Date().toISOString(), contenido: null }
            : m,
        ),
      )
    },
  )

  // ───────────────────────────────────────────────────────────
  //  WS: leído actualizado
  // ───────────────────────────────────────────────────────────
  useChatWsEvent<{
    payload: { conversacionId: string; usuarioId: string; ultimoLeidoId: string | null }
  }>('realtime:chat.leido-actualizado', (ev) => {
    if (ev.payload.conversacionId !== conversacionId) return
    setMensajes((prev) =>
      prev.map((m) => {
        // Si el user marcó leído hasta m.id (o más), lo agregamos
        // a `leidoPor` si no estaba.
        if (!ev.payload.ultimoLeidoId) return m
        // ¿El último leído del user es >= este mensaje?
        // Como no tenemos un orden explícito en `leidoPor`, usamos
        // el createdAt para comparar.
        // (Más simple: si m.id === ultimoLeidoId o el user ya está,
        //  no tocamos. Si NO está y m.createdAt <= la del último leído,
        //  lo agregamos.)
        // Para V1, simplificamos: solo actualizamos si m.id ===
        // ultimoLeidoId.
        if (m.id === ev.payload.ultimoLeidoId) {
          if (m.leidoPor.some((l) => l.usuarioId === ev.payload.usuarioId)) return m
          return {
            ...m,
            leidoPor: [
              ...m.leidoPor,
              {
                usuarioId: ev.payload.usuarioId,
                nombre: '...',
                ultimoLeidoId: ev.payload.ultimoLeidoId,
                updatedAt: new Date().toISOString(),
              },
            ],
          }
        }
        return m
      }),
    )
  })

  // ───────────────────────────────────────────────────────────
  //  WS: reacción cambiada
  // ───────────────────────────────────────────────────────────
  useChatWsEvent<{
    payload: {
      mensajeId: string
      conversacionId: string
      reacciones: Array<{ emoji: string; count: number; usuarios: string[] }>
    }
  }>('realtime:chat.reaccion-cambiada', (ev) => {
    if (ev.payload.conversacionId !== conversacionId) return
    setMensajes((prev) =>
      prev.map((m) =>
        m.id === ev.payload.mensajeId
          ? { ...m, reacciones: ev.payload.reacciones }
          : m,
      ),
    )
  })

  // ───────────────────────────────────────────────────────────
  //  WS: escribiendo
  // ───────────────────────────────────────────────────────────
  useChatWsEvent<{
    conversacionId: string
    usuarioId: string
    timestamp: string
  }>('chat:escribiendo', (ev) => {
    if (ev.conversacionId !== conversacionId) return
    if (ev.usuarioId === miUserId) return
    setOtroEscribiendo(true)
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current)
    typingTimeoutRef.current = setTimeout(() => setOtroEscribiendo(false), 4000)
  })
  useChatWsEvent<{
    conversacionId: string
    usuarioId: string
    timestamp: string
  }>('chat:dejo-de-escribir', (ev) => {
    if (ev.conversacionId !== conversacionId) return
    if (ev.usuarioId === miUserId) return
    setOtroEscribiendo(false)
  })

  // ───────────────────────────────────────────────────────────
  //  Handlers de input
  // ───────────────────────────────────────────────────────────
  const onInputChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value)
    // Emitir "escribiendo" con throttling (cada 3s máx).
    const now = Date.now()
    if (now - lastSentTypingRef.current > 3000 && e.target.value.length > 0) {
      lastSentTypingRef.current = now
      chatEscribiendo(conversacionId)
    }
  }

  const handleEnviar = async () => {
    const text = input.trim()
    if (!text && adjuntosLocales.length === 0) return
    if (sending || uploading) return
    setSending(true)
    chatDejoDeEscribir(conversacionId)
    try {
      const payload: Parameters<typeof enviarMensaje>[1] = {}
      if (text) payload.contenido = text
      if (replyTo) payload.replyToId = replyTo.id
      if (adjuntosLocales.length > 0) {
        payload.adjuntos = adjuntosLocales.map((a) => ({
          key: a.key,
          mimeType: a.mimeType,
          sizeBytes: a.sizeBytes,
          ancho: a.ancho,
          alto: a.alto,
          nombre: a.nombre,
        }))
      }
      const enviado = await enviarMensaje(conversacionId, payload)
      setMensajes((actuales) => actuales.some((mensaje) => mensaje.id === enviado.id)
        ? actuales
        : [...actuales, enviado])
      setInput('')
      setReplyTo(null)
      // Limpiar previews (URLs blob:).
      adjuntosLocales.forEach((a) => URL.revokeObjectURL(a.previewUrl))
      setAdjuntosLocales([])
      stickToBottomRef.current = true
    } catch (err) {
      // eslint-disable-next-line no-alert
      alert(err instanceof Error ? err.message : 'No se pudo enviar el mensaje.')
    } finally {
      setSending(false)
      inputRef.current?.focus()
    }
  }

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      void handleEnviar()
    }
    if (e.key === 'Escape' && replyTo) {
      setReplyTo(null)
    }
  }

  const onAdjuntarClick = () => {
    fileInputRef.current?.click()
  }

  const onFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = '' // reset para poder elegir el mismo
    if (!file) return
    if (!file.type.startsWith('image/')) {
      // eslint-disable-next-line no-alert
      alert('Solo se permiten imágenes.')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      // eslint-disable-next-line no-alert
      alert('La imagen no puede pesar más de 5MB.')
      return
    }
    setUploading(true)
    try {
      // Sacar ancho/alto con un Image.
      const dims = await new Promise<{ w: number; h: number }>((res) => {
        const img = new window.Image()
        img.onload = () => res({ w: img.width, h: img.height })
        img.onerror = () => res({ w: 0, h: 0 })
        img.src = URL.createObjectURL(file)
      })
      const previewUrl = URL.createObjectURL(file)
      const upRes = await uploadAdjunto(file)
      setAdjuntosLocales((prev) => [
        ...prev,
        {
          key: upRes.key,
          mimeType: upRes.mimeType,
          sizeBytes: upRes.sizeBytes,
          ancho: dims.w || undefined,
          alto: dims.h || undefined,
          nombre: upRes.nombre ?? file.name,
          previewUrl,
        },
      ])
    } catch (err) {
      // eslint-disable-next-line no-alert
      alert(err instanceof Error ? err.message : 'No se pudo subir la imagen.')
    } finally {
      setUploading(false)
    }
  }

  const quitarAdjunto = (idx: number) => {
    setAdjuntosLocales((prev) => {
      const nuevo = [...prev]
      const removed = nuevo.splice(idx, 1)[0]
      if (removed) URL.revokeObjectURL(removed.previewUrl)
      return nuevo
    })
  }

  // ───────────────────────────────────────────────────────────
  //  Acciones sobre mensajes
  // ───────────────────────────────────────────────────────────
  const onReplyClick = (m: ChatMensaje) => {
    setReplyTo(m)
    inputRef.current?.focus()
  }

  const onDeleteClick = async (m: ChatMensaje) => {
    if (!confirm('¿Eliminar este mensaje?')) return
    try {
      await apiEliminarMensaje(m.id)
      // El WS va a actualizar el mensaje.
    } catch (err) {
      // eslint-disable-next-line no-alert
      alert(err instanceof Error ? err.message : 'No se pudo eliminar.')
    }
  }

  const onReactClick = async (m: ChatMensaje, emoji: string) => {
    try {
      await toggleReaccion(m.id, emoji)
      // El WS actualiza las reacciones.
    } catch {
      /* ignore */
    }
  }

  // ───────────────────────────────────────────────────────────
  //  Render
  // ───────────────────────────────────────────────────────────
  return (
    <div className="flex-1 flex flex-col min-h-0 min-w-0">
      {/* Header */}
      <div
        className="flex items-center gap-3 px-4 py-3 border-b border-border bg-card"
        style={{ minHeight: 60 }}
      >
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="md:hidden inline-flex items-center justify-center w-8 h-8 hover:bg-muted/60"
            style={{ borderRadius: '0.25rem' }}
            aria-label="Volver"
          >
            <ArrowLeft size={16} />
          </button>
        )}
        <div className="w-9 h-9 rounded-full bg-secondary/30 inline-flex items-center justify-center text-sm font-semibold text-foreground/80 shrink-0">
          {otroUsuario.nombre?.[0]?.toUpperCase() ?? '?'}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-foreground truncate">
            {otroUsuario.nombre}
          </div>
          <div
            className="text-[10px] text-muted-foreground truncate"
            style={{ fontFamily: "'JetBrains Mono', monospace" }}
          >
            en línea
          </div>
        </div>
      </div>

      {/* Mensajes */}
      <div
        ref={scrollRef}
        onScroll={onScroll}
        className="flex-1 overflow-y-auto px-3 sm:px-4 py-3 space-y-1.5"
      >
        {loadingMore && (
          <div className="flex justify-center py-2">
            <Loader2 size={14} className="animate-spin text-muted-foreground" />
          </div>
        )}
        {loadingMsgs ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 size={20} className="animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <div className="text-center text-sm text-destructive py-8">
            {error}
          </div>
        ) : mensajes.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground gap-1">
            <ImageIcon size={28} className="opacity-40" />
            <p className="text-sm">Empezá la conversación con un saludo 👋</p>
          </div>
        ) : (
          mensajes.map((m, idx) => {
            const prev = mensajes[idx - 1]
            const esMio = m.autorId === miUserId
            // Mostrar avatar solo si el anterior es de otro user o
            // pasaron > 5min entre mensajes.
            const mostrarAvatar =
              !esMio &&
              (!prev || prev.autorId !== m.autorId || idx === 0 ||
                new Date(m.createdAt).getTime() - new Date(prev.createdAt).getTime() > 5 * 60 * 1000)
            const esUltimoDelGrupo =
              idx === mensajes.length - 1 ||
              mensajes[idx + 1].autorId !== m.autorId
            return (
              <MensajeBurbuja
                key={m.id}
                mensaje={m}
                esMio={esMio}
                mostrarAvatar={mostrarAvatar}
                esUltimoDelGrupo={esUltimoDelGrupo}
                onReply={onReplyClick}
                onDelete={onDeleteClick}
                onReact={onReactClick}
              />
            )
          })
        )}
      </div>

      {/* Indicador "está escribiendo..." del otro */}
      {otroEscribiendo && (
        <div className="px-4 pt-1 pb-2 flex items-end gap-2" aria-live="polite">
          <div className="w-7 h-7 rounded-full bg-secondary/25 inline-flex items-center justify-center text-[10px] font-semibold text-foreground/75 shrink-0">
            {otroUsuario.nombre?.[0]?.toUpperCase() ?? '?'}
          </div>
          <div className="min-w-0">
            <div
              className="chat-typing-bubble relative inline-flex items-center gap-1.5 h-9 px-4 bg-muted border border-border"
              aria-label={`${otroUsuario.nombre} está escribiendo`}
            >
              <span className="chat-typing-dot" />
              <span className="chat-typing-dot" />
              <span className="chat-typing-dot" />
            </div>
          </div>
        </div>
      )}

      {/* Reply preview (arriba del input) */}
      {replyTo && (
        <div
          className="mx-3 mb-1 flex items-center gap-2 px-3 py-1.5 bg-muted/40 border-l-2 border-primary text-xs"
          style={{ borderRadius: '0.25rem' }}
        >
          <Reply size={12} className="text-primary shrink-0" />
          <div className="flex-1 min-w-0">
            <div
              className="text-[10px] uppercase tracking-widest text-muted-foreground"
              style={{ fontFamily: "'JetBrains Mono', monospace" }}
            >
              Respondiendo a {replyTo.autor.nombre}
            </div>
            <div className="truncate">
              {replyTo.deletedAt
                ? '[Mensaje eliminado]'
                : replyTo.contenido
                  ? replyTo.contenido
                  : '📷 Imagen'}
            </div>
          </div>
          <button
            type="button"
            onClick={() => setReplyTo(null)}
            className="inline-flex items-center justify-center w-6 h-6 hover:bg-muted"
            style={{ borderRadius: '0.25rem' }}
            aria-label="Cancelar reply"
          >
            <X size={12} />
          </button>
        </div>
      )}

      {/* Adjuntos pendientes (preview antes de enviar) */}
      {adjuntosLocales.length > 0 && (
        <div className="mx-3 mb-1 flex flex-wrap gap-1.5 p-2 bg-muted/30 border border-border" style={{ borderRadius: '0.25rem' }}>
          {adjuntosLocales.map((a, idx) => (
            <div
              key={a.previewUrl}
              className="relative w-16 h-16 bg-muted overflow-hidden"
              style={{ borderRadius: '0.25rem' }}
            >
              <img
                src={a.previewUrl}
                alt={a.nombre ?? 'adjunto'}
                className="w-full h-full object-cover"
              />
              <button
                type="button"
                onClick={() => quitarAdjunto(idx)}
                className="absolute top-0 right-0 inline-flex items-center justify-center w-5 h-5 bg-black/60 text-white"
                aria-label="Quitar adjunto"
              >
                <X size={10} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="px-3 py-2 border-t border-border bg-card flex items-end gap-2">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={onFileChange}
        />
        <button
          type="button"
          onClick={onAdjuntarClick}
          disabled={uploading || sending}
          className="inline-flex items-center justify-center w-8 h-8 text-muted-foreground hover:text-foreground disabled:opacity-50 transition-colors shrink-0"
          style={{ borderRadius: '0.25rem' }}
          aria-label="Adjuntar imagen"
          title="Adjuntar imagen"
        >
          {uploading ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <Paperclip size={16} />
          )}
        </button>
        <EmojiPicker onEmoji={(e) => setInput((v) => v + e)} />
        <textarea
          ref={inputRef}
          value={input}
          onChange={onInputChange}
          onKeyDown={onKeyDown}
          placeholder="Escribí un mensaje..."
          rows={1}
          className="flex-1 resize-none bg-muted/40 border border-border px-3 py-2 text-sm focus:outline-none focus:border-primary"
          style={{ borderRadius: '0.375rem', maxHeight: 120 }}
          onInput={(e) => {
            // auto-resize
            const el = e.currentTarget
            el.style.height = 'auto'
            el.style.height = `${Math.min(120, el.scrollHeight)}px`
          }}
        />
        <button
          type="button"
          onClick={handleEnviar}
          disabled={sending || uploading || (!input.trim() && adjuntosLocales.length === 0)}
          className="inline-flex items-center justify-center w-9 h-9 bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50 transition-opacity shrink-0"
          style={{ borderRadius: '0.375rem' }}
          aria-label="Enviar"
        >
          {sending ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <Send size={16} />
          )}
        </button>
      </div>
    </div>
  )
}
