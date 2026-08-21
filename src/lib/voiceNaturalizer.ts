const TECHNICAL_KEYS = /^(?:id|adminId|tenantId|usuarioId|bodegaId|productoId|proveedorId|categoriaId|marcaId|rolId|.*Key|mimeType|sizeBytes|deletedAt)$/i
const ISO_DATE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?Z$/
const MAX_ARRAY_ITEMS = 30
const MAX_STRING_LENGTH = 1_200

const dateFormatter = new Intl.DateTimeFormat('es-CO', {
  dateStyle: 'long',
  timeStyle: 'short',
  timeZone: 'America/Bogota',
})

const cleanText = (value: string) => value
  .replace(/https?:\/\/\S+/gi, 'enlace disponible en pantalla')
  .replace(/[*_`#<>\[\]{}|]/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const naturalizeString = (value: string) => {
  if (ISO_DATE.test(value)) {
    const date = new Date(value)
    if (!Number.isNaN(date.getTime())) return dateFormatter.format(date)
  }

  return cleanText(value).slice(0, MAX_STRING_LENGTH)
}

const naturalizeValue = (value: unknown, depth = 0): unknown => {
  if (value === null || value === undefined || depth > 8) return undefined
  if (typeof value === 'string') return naturalizeString(value)
  if (typeof value === 'number' || typeof value === 'boolean') return value

  if (Array.isArray(value)) {
    const items = value
      .slice(0, MAX_ARRAY_ITEMS)
      .map((item) => naturalizeValue(item, depth + 1))
      .filter((item) => item !== undefined)
    if (value.length > MAX_ARRAY_ITEMS) {
      items.push({ elementosAdicionalesDisponibles: value.length - MAX_ARRAY_ITEMS })
    }
    return items
  }

  if (typeof value === 'object') {
    const output: Record<string, unknown> = {}
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      if (TECHNICAL_KEYS.test(key)) continue
      const naturalized = naturalizeValue(item, depth + 1)
      if (naturalized !== undefined && naturalized !== '') output[key] = naturalized
    }
    return output
  }

  return undefined
}

/**
 * Proyecta la respuesta del backend a un contexto compacto para el LLM de voz.
 * La respuesta original no se modifica: solo esta copia viaja a Deepgram.
 */
export const createVoiceFunctionPayload = (value: unknown) => JSON.stringify({
  instruccionesDeVoz: 'Responde con lenguaje hablado natural. Da primero el resultado directo. Usa una o dos frases, sin superar 300 caracteres. Si hay más de cinco elementos, menciona solo los primeros cinco y pregunta si el usuario quiere continuar. No leas nombres de campos, JSON, símbolos ni identificadores técnicos.',
  datos: naturalizeValue(value),
})

export const cleanVoiceTranscript = (text: string) => cleanText(text)
  .replace(/(?:^\s*[-+•]\s+.+(?:\r?\n|$)){2,}/gm, (block) => block
    .split(/\r?\n/)
    .map((line) => line.replace(/^\s*[-+•]\s+/, '').trim())
    .filter(Boolean)
    .join(', '))
  .replace(/^\s*[-+•]\s+/gm, '')
  .replace(/^\s*\d+[.)]\s+/gm, '')
  .trim()
