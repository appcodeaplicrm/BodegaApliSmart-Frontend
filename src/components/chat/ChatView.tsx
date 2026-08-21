/**
 * Vista principal del chat interno 1-a-1.
 *
 * Layout (estilo Slack / Discord / WhatsApp Web):
 *  - Izquierda: lista de conversaciones del usuario en la bodega
 *    activa, con búsqueda, badge de no-leídos y orden por
 *    actividad.
 *  - Derecha: panel de la conversación seleccionada (mensajes,
 *    input, etc).
 *
 * En mobile:
 *  - Sin conversación seleccionada → solo la lista.
 *  - Con conversación seleccionada → fullscreen en el panel, con
 *    botón "Volver" en el header.
 *
 * Sin permisos: cualquier user activo de la bodega puede ver y
 * chatear con cualquier otro user de la misma bodega.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Inbox, MessageCirclePlus, Search } from 'lucide-react'
import { Loader2 } from 'lucide-react'
import { useLocation } from 'react-router-dom'
import { PageHeader } from '../PageHeader'
import { Modal } from '../Modal'
import { useAuth } from '../../store/auth'
import { useBodegaActiva } from '../../store/bodegaActiva'
import { imageUrl } from '../../lib/apiBase'
import { api } from '../../lib/api'
import { abrirConversacion, listarConversaciones } from './api'
import { useChatWsEvent } from './useChatSocket'
import { ConversacionPanel } from './ConversacionPanel'
import type { ChatConversacion } from './types'

function formatUltimo(ts: string | null): string {
  if (!ts) return ''
  const d = new Date(ts)
  const hoy = new Date()
  const diffH = (hoy.getTime() - d.getTime()) / (1000 * 60 * 60)
  if (diffH < 24 && d.getDate() === hoy.getDate()) {
    return d.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })
  }
  if (diffH < 48) return 'ayer'
  if (diffH < 24 * 7) {
    return d.toLocaleDateString('es-CO', { weekday: 'short' })
  }
  return d.toLocaleDateString('es-CO', { day: '2-digit', month: 'short' })
}

function ChatAvatar({ fotoUrl, nombre }: { fotoUrl: string | null; nombre: string }) {
  const [fallo, setFallo] = useState(false)
  const inicial = nombre?.[0]?.toUpperCase() ?? '?'

  useEffect(() => {
    setFallo(false)
  }, [fotoUrl])

  if (!fotoUrl || fallo) {
    return (
      <div className="w-10 h-10 rounded-full bg-secondary/30 inline-flex items-center justify-center text-sm font-semibold text-foreground/80">
        {inicial}
      </div>
    )
  }

  return (
    <img
      src={fotoUrl}
      alt={nombre}
      className="w-10 h-10 rounded-full object-cover bg-secondary/30"
      onError={() => setFallo(true)}
    />
  )
}

export function ChatView() {
  const auth = useAuth()
  const bodegaId = useBodegaActiva()
  const location = useLocation()
  const miUserId = auth.status === 'autenticado' ? auth.sesion.usuario.id : ''

  // ─── Estado: lista de conversaciones + seleccionada ───
  const [convs, setConvs] = useState<ChatConversacion[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [activeId, setActiveId] = useState<string | null>(null)
  const [nuevoChatOpen, setNuevoChatOpen] = useState(false)

  const cargar = useCallback(async () => {
    if (!bodegaId) return
    setLoading(true)
    setError(null)
    try {
      const data = await listarConversaciones()
      setConvs(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron cargar las conversaciones.')
    } finally {
      setLoading(false)
    }
  }, [bodegaId])

  useEffect(() => {
    void cargar()
  }, [cargar])

  // ─── WS: refetch del sidebar consolidado con debounce ───
  // Si nos llegan N eventos seguidos (ej. un user manda 5
  // mensajes en 2s), refetchear por cada uno satura al back
  // (429 ThrottlerException) y genera muchos toasts. Consolidamos:
  // un solo refetch 600ms después del último evento.
  const refetchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const scheduleRefetch = useCallback(() => {
    if (refetchTimerRef.current) clearTimeout(refetchTimerRef.current)
    refetchTimerRef.current = setTimeout(() => {
      refetchTimerRef.current = null
      void cargar()
    }, 600)
  }, [cargar])
  useEffect(() => {
    return () => {
      if (refetchTimerRef.current) clearTimeout(refetchTimerRef.current)
    }
  }, [])

  useChatWsEvent<{ payload: { conversacionId: string; autorId?: string } }>(
    'realtime:chat.mensaje-nuevo',
    () => {
      scheduleRefetch()
    },
  )
  useChatWsEvent('realtime:chat.mensaje-eliminado', () => {
    scheduleRefetch()
  })
  // Las lecturas y reacciones se aplican dentro del panel activo.
  // No cambian el orden ni el contenido resumido del sidebar, por lo
  // que refetchearlo aquí provoca tráfico innecesario y puede crear un
  // ciclo lectura -> socket -> GET -> lectura.

  // ─── Filtro de búsqueda ───
  const convsFiltradas = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return convs
    return convs.filter(
      (c) =>
        c.otroUsuario.nombre.toLowerCase().includes(term) ||
        c.otroUsuario.email.toLowerCase().includes(term),
    )
  }, [convs, search])

  // Total de no-leídos para el badge del sidebar (si querés
  // mostrarlo en PageHeader, en una próxima iteración).
  const totalNoLeidos = useMemo(
    () => convs.reduce((acc, c) => acc + c.noLeidos, 0),
    [convs],
  )

  // La conversación activa.
  const convActiva = activeId ? convs.find((c) => c.id === activeId) : null

  // Permite abrir una conversación concreta desde la campana global.
  useEffect(() => {
    const conversacionSolicitada = new URLSearchParams(location.search).get('conversacion')
    if (!conversacionSolicitada || loading) return
    if (convs.some((conversacion) => conversacion.id === conversacionSolicitada)) {
      setActiveId(conversacionSolicitada)
    }
  }, [convs, loading, location.search])

  // En mobile, si hay conv activa, mostramos solo el panel (la
  // lista queda oculta).
  const mobileFullscreenPanel = !!convActiva

  return (
    <div className="flex-1 flex flex-col min-w-0 min-h-0 h-full">
      {/* Header desktop: solo si no estamos en fullscreen mobile. */}
      <div className={mobileFullscreenPanel ? 'hidden md:block' : ''}>
        <PageHeader
          title="Chat interno"
          subtitle={
            totalNoLeidos > 0
              ? `${totalNoLeidos} mensaje${totalNoLeidos === 1 ? '' : 's'} sin leer`
              : `${convs.length} conversación${convs.length === 1 ? '' : 'es'}`
          }
          actions={
            <button
              onClick={() => setNuevoChatOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground text-xs font-medium hover:opacity-90 transition-opacity"
              style={{ borderRadius: '0.25rem' }}
            >
              <MessageCirclePlus size={13} />
              Nuevo chat
            </button>
          }
        />
      </div>

      <div className="flex-1 flex min-h-0 min-w-0 overflow-hidden">
        {/* ─── Lista de conversaciones (sidebar interno) ─── */}
        <aside
          className={[
            'w-full md:w-80 lg:w-96 border-r border-border bg-card flex flex-col min-h-0 h-full',
            mobileFullscreenPanel ? 'hidden md:flex' : 'flex',
          ].join(' ')}
        >
          {/* Buscador */}
          <div className="p-3 border-b border-border">
            <div className="relative">
              <Search
                size={14}
                className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
              />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por nombre o email..."
                className="w-full pl-8 pr-3 py-1.5 text-sm bg-muted/40 border border-border focus:outline-none focus:border-primary"
                style={{ borderRadius: '0.25rem' }}
              />
            </div>
          </div>

          {/* Lista */}
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 size={18} className="animate-spin text-muted-foreground" />
              </div>
            ) : error ? (
              <div className="p-4 text-sm text-destructive text-center">{error}</div>
            ) : convsFiltradas.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 px-4 text-center text-muted-foreground">
                <Inbox size={28} className="mb-2 opacity-50" />
                {search ? (
                  <p className="text-sm">No hay coincidencias para "{search}"</p>
                ) : (
                  <>
                    <p className="text-sm">No tenés chats todavía.</p>
                    <button
                      onClick={() => setNuevoChatOpen(true)}
                      className="mt-2 text-xs text-primary hover:underline"
                    >
                      Empezá uno nuevo
                    </button>
                  </>
                )}
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {convsFiltradas.map((c) => {
                  const fotoUrl = imageUrl(c.otroUsuario.fotoKey)
                  const isActive = c.id === activeId
                  return (
                    <li key={c.id}>
                      <button
                        type="button"
                        onClick={() => setActiveId(c.id)}
                        className={[
                          'w-full text-left px-3 py-2.5 hover:bg-muted/40 transition-colors flex items-center gap-2.5',
                          isActive ? 'bg-muted/60' : '',
                        ].join(' ')}
                      >
                        {/* Avatar */}
                        <div className="relative shrink-0">
                          <ChatAvatar fotoUrl={fotoUrl} nombre={c.otroUsuario.nombre} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <div className="font-medium text-foreground text-sm truncate">
                              {c.otroUsuario.nombre}
                            </div>
                            <div
                              className="text-[10px] text-muted-foreground shrink-0"
                              style={{ fontFamily: "'JetBrains Mono', monospace" }}
                            >
                              {formatUltimo(c.ultimoMensajeAt)}
                            </div>
                          </div>
                          <div className="flex items-center justify-between gap-2">
                            <div className="text-xs text-muted-foreground truncate">
                              {c.ultimoMensajeId
                                ? 'Último mensaje...'
                                : 'Sin mensajes aún'}
                            </div>
                            {c.noLeidos > 0 && (
                              <span
                                className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 text-[10px] font-semibold bg-primary text-primary-foreground"
                                style={{ borderRadius: '0.625rem' }}
                              >
                                {c.noLeidos > 99 ? '99+' : c.noLeidos}
                              </span>
                            )}
                          </div>
                        </div>
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>

          {/* Botón "Nuevo chat" en mobile (al final de la lista). */}
          <div className="md:hidden p-3 border-t border-border">
            <button
              onClick={() => setNuevoChatOpen(true)}
              className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity"
              style={{ borderRadius: '0.25rem' }}
            >
              <MessageCirclePlus size={14} />
              Nuevo chat
            </button>
          </div>
        </aside>

        {/* ─── Panel de la conversación activa ─── */}
        <main
          className={[
            'flex-1 flex flex-col min-w-0 min-h-0 h-full',
            mobileFullscreenPanel ? 'flex' : 'hidden md:flex',
          ].join(' ')}
        >
          {convActiva ? (
            <ConversacionPanel
              conversacionId={convActiva.id}
              otroUsuario={convActiva.otroUsuario}
              onBack={() => setActiveId(null)}
            />
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center text-muted-foreground gap-2 p-6">
              <MessageCirclePlus size={36} className="opacity-30" />
              <p className="text-sm">
                Seleccioná una conversación o iniciá una nueva.
              </p>
              <button
                onClick={() => setNuevoChatOpen(true)}
                className="md:hidden mt-1 inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground text-xs font-medium"
                style={{ borderRadius: '0.25rem' }}
              >
                <MessageCirclePlus size={13} />
                Nuevo chat
              </button>
            </div>
          )}
        </main>
      </div>

      {/* Modal: nuevo chat. */}
      <NuevoChatModal
        open={nuevoChatOpen}
        onClose={() => setNuevoChatOpen(false)}
        miUserId={miUserId}
        onSelect={async (otroUsuarioId, otroUsuario) => {
          try {
            const conv = await abrirConversacion(otroUsuarioId)
            setConvs((prev) => {
              if (prev.some((c) => c.id === conv.id)) {
                return prev.map((c) => (c.id === conv.id ? conv : c))
              }
              return [conv, ...prev]
            })
            setActiveId(conv.id)
            setNuevoChatOpen(false)
          } catch (err) {
            // eslint-disable-next-line no-alert
            alert(err instanceof Error ? err.message : 'No se pudo abrir el chat.')
          }
        }}
      />
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
//  NuevoChatModal: lista de usuarios de la misma bodega para
//  elegir con quién chatear.
// ─────────────────────────────────────────────────────────────

type UsuarioSimple = {
  id: string
  nombre: string
  email: string
  fotoKey: string | null
}

function NuevoChatModal({
  open,
  onClose,
  miUserId,
  onSelect,
}: {
  open: boolean
  onClose: () => void
  miUserId: string
  onSelect: (otroUsuarioId: string, otroUsuario: UsuarioSimple) => void
}) {
  const [usuarios, setUsuarios] = useState<UsuarioSimple[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setLoading(true)
    setError(null)
    setSearch('')
    api
      .get<UsuarioSimple[]>('/chat/usuarios')
      .then((data) => {
        setUsuarios(data ?? [])
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'No se pudo cargar la lista.')
      })
      .finally(() => setLoading(false))
  }, [open])

  const filtrados = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return usuarios
    return usuarios.filter(
      (u) =>
        u.nombre.toLowerCase().includes(term) || u.email.toLowerCase().includes(term),
    )
  }, [usuarios, search])

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Nuevo chat"
      description="Elegí con quién querés hablar"
      icon={<MessageCirclePlus size={18} />}
      size="md"
    >
      <div className="p-5 space-y-3">
        <div className="relative">
          <Search
            size={14}
            className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
          />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nombre o email..."
            className="w-full pl-8 pr-3 py-1.5 text-sm bg-muted/40 border border-border focus:outline-none focus:border-primary"
            style={{ borderRadius: '0.25rem' }}
          />
        </div>
        <div className="max-h-80 overflow-y-auto border border-border" style={{ borderRadius: '0.25rem' }}>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 size={18} className="animate-spin text-muted-foreground" />
            </div>
          ) : error ? (
            <div className="p-4 text-sm text-destructive text-center">{error}</div>
          ) : filtrados.length === 0 ? (
            <div className="p-4 text-sm text-muted-foreground text-center">
              {search ? 'No hay coincidencias' : 'No hay otros usuarios en la bodega.'}
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {filtrados.map((u) => {
                const inicial = u.nombre?.[0]?.toUpperCase() ?? '?'
                const fotoUrl = imageUrl(u.fotoKey)
                return (
                  <li key={u.id}>
                    <button
                      type="button"
                      disabled={busyId === u.id}
                      onClick={() => {
                        setBusyId(u.id)
                        onSelect(u.id, u)
                      }}
                      className="w-full text-left px-3 py-2 hover:bg-muted/40 disabled:opacity-50 transition-colors flex items-center gap-2.5"
                    >
                      {fotoUrl ? (
                        <img
                          src={fotoUrl}
                          alt={u.nombre}
                          className="w-8 h-8 rounded-full object-cover bg-secondary/30"
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-secondary/30 inline-flex items-center justify-center text-xs font-semibold text-foreground/80 shrink-0">
                          {inicial}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-foreground truncate">
                          {u.nombre}
                        </div>
                        <div className="text-[10px] text-muted-foreground truncate">
                          {u.email}
                        </div>
                      </div>
                      {busyId === u.id && (
                        <Loader2 size={14} className="animate-spin text-muted-foreground" />
                      )}
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </div>
    </Modal>
  )
}
