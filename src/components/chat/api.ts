/**
 * API client del módulo Chat.
 *
 * Wrapper sobre `api.get` / `api.post` / `api.delete` con tipos del
 * chat. La bodega activa se manda automáticamente en `X-Bodega-Id`
 * por el wrapper central de `lib/api.ts`.
 */

import { api } from '../../lib/api'
import { bodegaActivaStore } from '../../store/bodegaActiva'
import type {
  ChatConversacion,
  ChatMensaje,
  EnviarMensajeInput,
  ListarMensajesResult,
} from './types'

export async function listarConversaciones(): Promise<ChatConversacion[]> {
  return api.get<ChatConversacion[]>('/chat/conversaciones')
}

export async function abrirConversacion(
  otroUsuarioId: string,
): Promise<ChatConversacion> {
  return api.post<ChatConversacion>('/chat/conversaciones', { otroUsuarioId })
}

export async function getConversacion(id: string): Promise<ChatConversacion> {
  return api.get<ChatConversacion>(`/chat/conversaciones/${id}`)
}

export async function listarMensajes(
  conversacionId: string,
  before?: string,
  pageSize = 50,
): Promise<ListarMensajesResult> {
  const qs = new URLSearchParams()
  if (before) qs.set('before', before)
  qs.set('pageSize', String(pageSize))
  return api.get<ListarMensajesResult>(
    `/chat/conversaciones/${conversacionId}/mensajes?${qs.toString()}`,
  )
}

export async function enviarMensaje(
  conversacionId: string,
  input: EnviarMensajeInput,
): Promise<ChatMensaje> {
  return api.post<ChatMensaje>(
    `/chat/conversaciones/${conversacionId}/mensajes`,
    input,
  )
}

export async function marcarLeido(
  conversacionId: string,
  mensajeId?: string,
): Promise<{ ok: true; ultimoLeidoId: string | null }> {
  return api.post<{ ok: true; ultimoLeidoId: string | null }>(
    `/chat/conversaciones/${conversacionId}/leido`,
    mensajeId ? { mensajeId } : {},
  )
}

export async function toggleReaccion(
  mensajeId: string,
  emoji: string,
): Promise<{
  ok: true
  mensajeId: string
  reacciones: Array<{ emoji: string; count: number; usuarios: string[] }>
}> {
  return api.post(`/chat/mensajes/${mensajeId}/reacciones`, { emoji })
}

export async function eliminarMensaje(
  mensajeId: string,
): Promise<{ id: string; deletedAt: string }> {
  return api.delete(`/chat/mensajes/${mensajeId}`)
}

export type UploadResult = {
  key: string
  mimeType: string
  sizeBytes: number
  nombre: string | null
  url: string
}

/**
 * Sube una imagen al back y devuelve la metadata que después se
 * pasa en `enviarMensaje({ adjuntos: [...] })`.
 *
 * No usamos `api.post` porque ese wrapper manda JSON. Acá
 * necesitamos multipart/form-data.
 */
export async function uploadAdjunto(file: File): Promise<UploadResult> {
  const form = new FormData()
  form.append('file', file)
  // El endpoint está protegido por BodegaAccessGuard, que requiere
  // la bodega activa en el header `X-Bodega-Id` (mismo que el
  // wrapper `api.post` agrega automáticamente). Como acá usamos
  // `fetch` directo por el multipart, lo mandamos a mano.
  const bodegaId = bodegaActivaStore.getId()
  const res = await fetch('/api/chat/uploads', {
    method: 'POST',
    credentials: 'include',
    body: form,
    headers: bodegaId ? { 'X-Bodega-Id': bodegaId } : {},
  })
  if (!res.ok) {
    let msg = `Error ${res.status}`
    try {
      const data = await res.json()
      if (typeof data?.message === 'string') msg = data.message
      else if (Array.isArray(data?.message)) msg = data.message.join(', ')
    } catch {
      /* ignore */
    }
    throw new Error(msg)
  }
  return res.json()
}
