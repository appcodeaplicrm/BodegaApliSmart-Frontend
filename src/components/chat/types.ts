/**
 * Tipos del módulo Chat interno 1-a-1 (front).
 *
 * Matchean la respuesta del back (ver `chat.service.ts#decorateMensaje`).
 * Los Decimal/number ya vienen casteados en el back.
 */

export type ChatUsuarioResumen = {
  id: string
  nombre: string
  email: string
  fotoKey: string | null
}

export type ChatConversacion = {
  id: string
  bodegaId: string
  otroUsuario: ChatUsuarioResumen
  ultimoMensajeId: string | null
  ultimoMensajeAt: string | null
  /** Cantidad de mensajes NO leídos por el user actual. */
  noLeidos: number
  createdAt: string
}

export type ChatAdjunto = {
  id: string
  key: string
  url: string
  mimeType: string
  sizeBytes: number
  ancho: number | null
  alto: number | null
  nombre: string | null
}

export type ChatReaccion = {
  emoji: string
  count: number
  /** IDs de los users que la pusieron. */
  usuarios: string[]
}

export type ChatLeidoPor = {
  usuarioId: string
  nombre: string
  ultimoLeidoId: string | null
  updatedAt: string
}

export type ChatReplyPreview = {
  id: string
  contenido: string | null
  autorId: string
  deletedAt: string | null
  tieneAdjunto: boolean
  mimeType: string | null
}

export type ChatMensaje = {
  id: string
  conversacionId: string
  bodegaId: string
  autorId: string
  autor: ChatUsuarioResumen
  contenido: string | null
  deletedAt: string | null
  replyTo: ChatReplyPreview | null
  adjuntos: ChatAdjunto[]
  reacciones: ChatReaccion[]
  leidoPor: ChatLeidoPor[]
  createdAt: string
  updatedAt: string
}

export type ListarMensajesResult = {
  data: ChatMensaje[]
  meta: {
    nextBeforeId: string | null
    count: number
  }
}

export type AdjuntoMetadata = {
  key: string
  mimeType: string
  sizeBytes: number
  ancho?: number
  alto?: number
  nombre?: string
}

export type EnviarMensajeInput = {
  contenido?: string
  replyToId?: string
  adjuntos?: AdjuntoMetadata[]
}

/**
 * Evento del WebSocket `chat:escribiendo`. NO se persiste, solo
 * efímero.
 */
export type EscribiendoEvent = {
  conversacionId: string
  usuarioId: string
  timestamp: string
}
