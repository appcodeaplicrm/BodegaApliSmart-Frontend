/**
 * Burbuja de mensaje individual del chat.
 *
 * Estructura:
 *  - Avatar del autor (opcional en la última agrupa)
 *  - Reply preview (si es reply a otro mensaje)
 *  - Contenido (texto)
 *  - Adjuntos (imágenes en grid)
 *  - Reacciones (chips clickeables)
 *  - Footer: hora + indicador "leído por ..."
 *
 * El componente NO maneja el WS — el padre (ConversacionPanel) le
 * pasa los handlers de click y el estado "escribiendo" del otro.
 */

import { useState } from 'react'
import { CheckCheck, MoreVertical, Reply, Smile, Trash2 } from 'lucide-react'
import { imageUrl } from '../../lib/apiBase'
import { EmojiPicker } from './EmojiPicker'
import type { ChatMensaje } from './types'

type Props = {
  mensaje: ChatMensaje
  /** Si es mensaje del usuario actual (se renderiza a la derecha). */
  esMio: boolean
  /** Si es el primer mensaje de un grupo (mostrar avatar). */
  mostrarAvatar: boolean
  /** Si es el último mensaje de un grupo (mostrar el menú de más
   *  opciones, no comprimir). */
  esUltimoDelGrupo: boolean
  /** Mostrar el nombre del autor (típico en grupos, no en 1-a-1
   *  con el otro, pero el back ya manda `autor.nombre` igual). */
  mostrarNombre?: boolean
  onReply?: (m: ChatMensaje) => void
  onDelete?: (m: ChatMensaje) => void
  onReact?: (m: ChatMensaje, emoji: string) => void
  /** Si está cargando una reacción o borrado (deshabilita botones). */
  loading?: boolean
}

function formatHora(iso: string): string {
  return new Date(iso).toLocaleTimeString('es-CO', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function MensajeBurbuja({
  mensaje: m,
  esMio,
  mostrarAvatar,
  esUltimoDelGrupo,
  mostrarNombre,
  onReply,
  onDelete,
  onReact,
  loading,
}: Props) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [imgFull, setImgFull] = useState<string | null>(null)

  const inicial = (m.autor.nombre?.[0] ?? '?').toUpperCase()
  const esEliminado = !!m.deletedAt

  // Mi mensaje: a la derecha, fondo primary. Otro: a la izquierda,
  // fondo muted.
  const alignClass = esMio ? 'items-end' : 'items-start'
  const bubbleClass = esMio
    ? 'bg-primary text-primary-foreground'
    : 'bg-muted text-foreground'

  return (
    <div
      className={`flex gap-2 ${esMio ? 'flex-row-reverse' : 'flex-row'} ${alignClass} group relative`}
    >
      {/* Avatar (o espacio reservado para mantener el indent). */}
      <div className="w-8 shrink-0">
        {mostrarAvatar && !esMio && (
          <div
            className="w-8 h-8 rounded-full bg-secondary/30 inline-flex items-center justify-center text-xs font-semibold text-foreground/80"
            title={m.autor.nombre}
          >
            {inicial}
          </div>
        )}
      </div>

      <div className={`max-w-[75%] sm:max-w-[60%] flex flex-col ${alignClass}`}>
        {/* Nombre del autor (opcional). */}
        {mostrarNombre && !esMio && !esEliminado && (
          <div
            className="text-[10px] uppercase tracking-widest text-muted-foreground px-2 mb-0.5"
            style={{ fontFamily: "'JetBrains Mono', monospace" }}
          >
            {m.autor.nombre}
          </div>
        )}

        {/* Reply preview (si el mensaje es reply a otro). */}
        {m.replyTo && (
          <div
            className={[
              'px-2.5 py-1.5 mb-1 text-[11px] border-l-2',
              esMio
                ? 'border-primary-foreground/60 bg-primary-foreground/10 text-primary-foreground/80'
                : 'border-primary bg-primary/5 text-muted-foreground',
            ].join(' ')}
            style={{ borderRadius: '0.25rem' }}
          >
            <div
              className="font-semibold truncate"
              style={{ fontFamily: "'JetBrains Mono', monospace" }}
            >
              {m.deletedAt ? 'Mensaje eliminado' : 'Respondiendo a:'}
            </div>
            <div className="truncate opacity-80">
              {m.replyTo.deletedAt
                ? '[Mensaje eliminado]'
                : m.replyTo.contenido
                  ? m.replyTo.contenido
                  : m.replyTo.tieneAdjunto
                    ? '📷 Imagen'
                    : '...'}
            </div>
          </div>
        )}

        {/* Burbuja. */}
        <div
          className={[
            'px-3 py-2 relative',
            bubbleClass,
            esEliminado ? 'opacity-60 italic' : '',
          ].join(' ')}
          style={{ borderRadius: '0.5rem' }}
        >
          {esEliminado ? (
            <span className="text-xs">Mensaje eliminado</span>
          ) : (
            <>
              {m.contenido && (
                <p className="text-sm whitespace-pre-wrap break-words">
                  {m.contenido}
                </p>
              )}
              {m.adjuntos.length > 0 && (
                <div
                  className={[
                    'grid gap-1',
                    m.adjuntos.length === 1
                      ? 'grid-cols-1'
                      : m.adjuntos.length === 2
                        ? 'grid-cols-2'
                        : 'grid-cols-2 sm:grid-cols-3',
                    m.contenido ? 'mt-1.5' : '',
                  ].join(' ')}
                >
                  {m.adjuntos.map((a) => {
                    const url = imageUrl(a.url)
                    if (!url) return null
                    return (
                      <button
                        key={a.id}
                        type="button"
                        onClick={() => setImgFull(url)}
                        className="block overflow-hidden bg-black/10"
                        style={{ borderRadius: '0.25rem' }}
                        aria-label="Ver imagen adjunta"
                      >
                        <img
                          src={url}
                          alt={a.nombre ?? 'adjunto'}
                          loading="lazy"
                          className="w-full h-auto max-h-64 object-cover"
                        />
                      </button>
                    )
                  })}
                </div>
              )}
            </>
          )}

          {/* Footer dentro de la burbuja: hora + leído. */}
          <div
            className={[
              'flex items-center gap-1 mt-1 text-[10px]',
              esMio ? 'text-primary-foreground/70' : 'text-muted-foreground',
            ].join(' ')}
            style={{ fontFamily: "'JetBrains Mono', monospace" }}
          >
            <span>{formatHora(m.createdAt)}</span>
            {esMio && !esEliminado && (
              <>
                {m.leidoPor.some((l) => l.usuarioId !== m.autorId) ? (
                  <span title="Leído" className="inline-flex items-center">
                    <CheckCheck size={11} />
                  </span>
                ) : (
                  <span title="Enviado" className="inline-flex items-center">
                    <CheckCheck size={11} className="opacity-50" />
                  </span>
                )}
              </>
            )}
          </div>
        </div>

        {/* Reacciones (chips). */}
        {m.reacciones.length > 0 && (
          <div
            className={[
              'flex flex-wrap gap-1 mt-1',
              esMio ? 'justify-end' : 'justify-start',
            ].join(' ')}
          >
            {m.reacciones.map((r) => {
              const yoReaccion = r.usuarios.includes(m.autorId) // truco: usamos el autor del mensaje; en el padre el helper real usa el user actual
              return (
                <button
                  key={r.emoji}
                  type="button"
                  disabled={loading}
                  onClick={() => onReact?.(m, r.emoji)}
                  className={[
                    'inline-flex items-center gap-1 px-1.5 py-0.5 text-[11px] border transition-colors',
                    'bg-card hover:bg-muted/60',
                    yoReaccion ? 'border-primary' : 'border-border',
                  ].join(' ')}
                  style={{ borderRadius: '0.75rem' }}
                  title={`${r.count} ${r.count === 1 ? 'reacción' : 'reacciones'}`}
                >
                  <span>{r.emoji}</span>
                  <span
                    className="text-foreground/80"
                    style={{ fontFamily: "'JetBrains Mono', monospace" }}
                  >
                    {r.count}
                  </span>
                </button>
              )
            })}
          </div>
        )}

        {/* Acciones flotantes (reacción rápida + reply + borrar). */}
        {!esEliminado && (esUltimoDelGrupo || menuOpen) && (
          <div
            className={[
              'absolute -top-3 flex items-center gap-0.5 bg-card border border-border shadow-sm px-1 py-0.5',
              esMio ? 'right-2' : 'left-2',
              menuOpen ? 'z-10' : 'opacity-0 group-hover:opacity-100 transition-opacity',
            ].join(' ')}
            style={{ borderRadius: '0.375rem' }}
          >
            <EmojiPicker
              size="sm"
              onEmoji={(e) => onReact?.(m, e)}
            >
              <span
                className="inline-flex items-center justify-center w-7 h-7 hover:bg-muted/60 transition-colors"
                style={{ borderRadius: '0.25rem' }}
                aria-label="Reaccionar"
              >
                <Smile size={14} />
              </span>
            </EmojiPicker>
            {onReply && (
              <button
                type="button"
                onClick={() => onReply(m)}
                className="inline-flex items-center justify-center w-7 h-7 hover:bg-muted/60 transition-colors"
                style={{ borderRadius: '0.25rem' }}
                aria-label="Responder"
              >
                <Reply size={14} />
              </button>
            )}
            {esMio && onDelete && (
              <button
                type="button"
                onClick={() => onDelete(m)}
                disabled={loading}
                className="inline-flex items-center justify-center w-7 h-7 text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-50"
                style={{ borderRadius: '0.25rem' }}
                aria-label="Eliminar"
              >
                <Trash2 size={14} />
              </button>
            )}
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              className="inline-flex items-center justify-center w-7 h-7 hover:bg-muted/60 transition-colors md:hidden"
              style={{ borderRadius: '0.25rem' }}
              aria-label="Más opciones"
            >
              <MoreVertical size={14} />
            </button>
          </div>
        )}
      </div>

      {/* Modal fullscreen para una imagen adjunta. */}
      {imgFull && (
        <div
          className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-4"
          onClick={() => setImgFull(null)}
          role="dialog"
        >
          <img
            src={imgFull}
            alt="Adjunto"
            className="max-w-full max-h-full object-contain"
          />
        </div>
      )}
    </div>
  )
}
