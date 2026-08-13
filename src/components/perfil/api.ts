/**
 * API del módulo Perfil.
 *
 * Helpers para hablar con `/perfil/foto` (subir/eliminar/consultar la
 * foto personal del user). Usamos `fetch` directo (no `api.post`) para:
 *   - mandar `FormData` sin que el cliente central setee `Content-Type`
 *     ni muestre el toast genérico de "POST".
 *   - tener control del header `X-Bodega-Id` (el cliente central lo agrega
 *     si hay bodega activa, pero para foto no aplica, así que lo omitimos
 *     explícitamente).
 */
import { api } from '../../lib/api'

export type MiFoto = { key: string | null; url: string | null }

/**
 * Sube la foto del user autenticado.
 * Devuelve la key y la URL pública.
 */
export async function subirFoto(file: File): Promise<MiFoto> {
  const form = new FormData()
  form.append('file', file)
  const res = await fetch('/api/perfil/foto', {
    method: 'POST',
    credentials: 'include',
    body: form,
  })
  const text = await res.text()
  if (!res.ok) {
    const msg = parseApiMessage(text) || `Error subiendo la foto (${res.status})`
    throw new Error(msg)
  }
  return text ? JSON.parse(text) : { key: null, url: null }
}

/** Devuelve la foto del user autenticado. Null si no tiene. */
export async function getMiFoto(): Promise<MiFoto> {
  return api.get<MiFoto>('/perfil/foto')
}

/** Elimina la foto del user autenticado. */
export async function eliminarFoto(): Promise<{ ok: true }> {
  return api.delete<{ ok: true }>('/perfil/foto')
}

/** Helper: extrae el `message` del JSON de error del back, o devuelve null. */
function parseApiMessage(text: string): string | null {
  try {
    const obj = JSON.parse(text) as { message?: string | string[] }
    if (Array.isArray(obj.message)) return obj.message.join(', ')
    if (typeof obj.message === 'string') return obj.message
  } catch {
    /* ignore */
  }
  return null
}
