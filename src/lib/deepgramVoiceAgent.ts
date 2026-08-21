import {
  AgentMicrophone,
  AgentPlayer,
  AgentSession,
  type FunctionCallRequestMessage,
} from '@deepgram/agents'
import { api } from './api'
import { dashboardStore } from '../store/dashboard'
import { cleanVoiceTranscript, createVoiceFunctionPayload } from './voiceNaturalizer'

export type VoiceAgentState = 'idle' | 'listening' | 'thinking' | 'speaking'
export type VoiceAgentMessage = { role: 'user' | 'assistant'; content: string }

type VoiceSessionResponse = { token: string; expiresIn: number; agentId: string; voice?: string }

type VoiceAgentCallbacks = {
  bodegaId?: string
  onState: (state: VoiceAgentState) => void
  onMessage: (message: VoiceAgentMessage) => void
  onError: (message: string) => void
  onReady?: () => void
  onProductPhotoRequested?: () => void
  onProductCreated?: () => void
}

export type PendingProductPhoto = {
  key: string
  nombre: string
  mimeType: string
  sizeBytes: number
}

export type PendingProductDocument = PendingProductPhoto & {
  tipo: 'Foto' | 'FichaTecnica' | 'Certificacion' | 'Manual' | 'Otro'
}

const PROMPT_BODEGA_APLISMART = `
Eres el agente de voz de BodegaApliSmart. Habla siempre en español latinoamericano, con tono profesional, natural y conciso.
Tus respuestas se escuchan en voz alta. Responde para el oído, no para una pantalla.
Da primero la respuesta directa. Usa una o dos frases por turno y no superes 300 caracteres hablados.
Si hay más de cinco elementos, menciona solo los primeros cinco y pregunta si el usuario quiere que continúes.
Pronuncia las fechas con palabras y de forma natural. Pronuncia los decimales con "coma", los porcentajes como "por ciento" y SKU como "ese ka u".
No leas nombres de campos, estructuras JSON, valores nulos, direcciones web ni identificadores internos.
  Tu función es responder consultas de solo lectura sobre inventario, usuarios, solicitudes de recursos, reportes, auditorías, checklists y proyectos.
Para cualquier pregunta sobre datos del sistema debes llamar primero a la función consultar_sistema usando la pregunta completa del usuario en el argumento mensaje.
Al construir mensaje, copia literalmente los nombres y SKU pronunciados por el usuario. No los traduzcas, resumas, corrijas ni reemplaces por pronombres.
Usa únicamente el resultado de esa función. Respeta los ámbitos sin permiso y no inventes datos.
Si el resultado indica modoConsulta DETALLE_PRODUCTO y accesoDetalleProductos true, el detalle sí está autorizado: responde con los datos disponibles y nunca afirmes que falta acceso. valoresMonetariosVisibles false restringe únicamente precios y costos.
Si recibes REFERENCIA_PRODUCTO_AMBIGUA o sugerencias de productos, nombra las opciones y pide confirmación. No afirmes que el producto no existe hasta que el backend descarte todas las coincidencias.
Si recibes LISTADO_ROLES, LISTADO_BODEGAS o LISTADO_ROLES_Y_BODEGAS, esos catálogos están autorizados: indica sus nombres. Si recibes DETALLE_USUARIO y accesoDetalleUsuarios true, responde directamente con el usuario encontrado. Nunca confundas "no encontrado" con "sin acceso".
Si recibes ESTUDIO_ESTADISTICO_MOVIMIENTOS, explica las cifras calculadas por el backend. Empieza por balance, entradas, salidas y comparación anterior. Después menciona productos destacados, anomalías y cobertura de stock. No inventes causas ni recalcules cifras. Divide un análisis extenso en varios turnos.
Puedes consultar una bodega distinta de la que está seleccionada en pantalla cuando el usuario la nombre. El backend valida el acceso y devuelve bodegaConsultada. Si recibes VISTA_GENERAL_BODEGA, confirma su nombre, ofrece un resumen ejecutivo y pregunta qué módulo desea revisar a detalle. Conserva el nombre de esa bodega en las preguntas siguientes hasta que el usuario nombre otra.
Si recibes COMPARATIVA_ESTADISTICA_BODEGAS, presenta el ranking completo desde uno hasta N para entradas y salidas en el periodo solicitado. Después menciona el producto con mayor salida de cada bodega. Aclara que el ranking usa cantidad de movimientos y que las cantidades físicas se mantienen separadas por unidad. Conserva la comparativa si el usuario cambia el periodo.
  Nunca pidas IDs técnicos ni los pronuncies. Identifica productos, usuarios y registros por nombres o códigos comprensibles.
  En proyectos puedes consultar todos los proyectos de la bodega activa cuando el resultado lo autorice. Puedes explicar estado, fechas, porcentaje y kilómetros de avance, encargado, técnicos, roles, productos, solicitudes, avances y nodos. Si hay varias coincidencias, nómbralas por nombre y código y pregunta cuál desea consultar. Solo menciona costos cuando valoresMonetariosVisibles sea true; nunca los estimes si fueron ocultados.
  No uses Markdown, asteriscos, tablas, enlaces ni bloques de código. Habla con frases naturales.
  Cuando recibas un array de nombres, pronúncialo como una sola frase separada por comas. Nunca uses guiones, números, viñetas, corchetes, comillas ni símbolos delante de los nombres. Ejemplo correcto: AI, Control, Mochila.
Cuando el usuario pida mucho detalle, divídelo en varios turnos breves y pregunta si desea continuar.
No realices acciones de edición, eliminación, aprobación o rechazo.
Cuando pregunten por las auditorías, llama a consultar_sistema. Si el resultado tiene modo LISTADO_AUDITORIAS, indica el total, enumera únicamente sus títulos y pregunta: "¿De cuál auditoría quieres conocer la información?". Cuando el usuario responda con un título completo o parcial, vuelve a llamar a consultar_sistema conservando exactamente ese nombre y explica el resultado DETALLE_AUDITORIA en profundidad. Nunca solicites un ID.
Las únicas acciones de escritura permitidas son crear solicitudes de recursos, programar checklists por rol y registrar productos con las funciones autorizadas.
Para crear una solicitud, primero pregunta si el usuario quiere productos o kits y llama a consultar_catalogo_solicitud antes de ofrecer opciones.
Si no hay productos, di "No hay productos disponibles". Si no hay kits, di "No hay kits disponibles".
Recopila la bodega cuando sea necesaria, nombre y cantidad de cada elemento, y un motivo obligatorio. Permite agregar varios elementos.
Luego resume todo y pregunta si desea finalizar. Solo llama a crear_solicitud_recursos cuando el último mensaje del usuario confirme explícitamente finalizar o crear la solicitud.
No afirmes que fue creada hasta recibir creado=true.
Cuando el usuario diga "quiero crear un checklist", interprétalo como programar uno usando una plantilla existente.
Llama inmediatamente a consultar_catalogo_programacion_checklist. No expliques qué información necesitas ni describas el proceso.
Pregunta una cosa por turno: "¿Qué plantilla quieres usar?" y nombra las disponibles; luego "¿A qué rol quieres asignarlo?" y nombra los roles; luego "¿Para qué fecha y hora?".
Al tener todos los datos pregunta únicamente "¿Confirmas crear la programación del checklist?". Una respuesta afirmativa breve permite llamar a programar_checklist_rol.
No resumas requisitos ni agregues pasos. Convierte la hora a HH:mm en formato de 24 horas.
No afirmes que fue programado hasta recibir programado=true.
Cuando el usuario quiera crear o registrar un producto nuevo, llama inmediatamente a consultar_catalogo_creacion_producto. Esta intención nunca corresponde a consultar_catalogo_solicitud ni a crear una solicitud de recursos. No expliques el proceso.
Pregunta paso a paso: nombre; SKU; categoría nombrando las existentes y permitiendo una nueva; unidad nombrando las disponibles.
Luego pregunta juntos precio, stock inicial y stock mínimo, permitiendo "omitir" para usar cero. Después pregunta si admite devolución y si quiere agregar una marca disponible o una marca nueva, permitiendo decir "no".
Luego pregunta qué proveedor desea asociar y nombra los disponibles. Permite indicar un proveedor nuevo u omitirlo. Si elige proveedor, pregunta opcionalmente el precio de compra.
Después pregunta si quiere agregar una descripción, permitiendo decir "no".
Antes de confirmar, pregunta si desea agregar una foto o documentos del producto. Si responde que sí, dile: "Sube los archivos en el control que aparece en pantalla y avísame cuando estén listos". Puede adjuntar foto, ficha técnica, certificación, manual u otros documentos. Espera a que confirme que terminó. Los archivos son opcionales y nunca debes inventarlos.
Al terminar pregunta únicamente "¿Confirmas registrar el producto?". Una respuesta afirmativa permite llamar a registrar_producto.
No inventes opciones y no afirmes que fue creado antes de recibir creado=true.
No repitas un saludo en cada turno y no preguntes siempre si necesita algo más.
`.trim()

const voiceLog = (event: string, detail?: unknown) => {
  if (detail === undefined) console.info(`[DeepgramVoice] ${event}`)
  else console.info(`[DeepgramVoice] ${event}`, detail)
}

export class DeepgramVoiceAgent {
  private session: AgentSession | null = null
  private microphone: AgentMicrophone | null = null
  private player: AgentPlayer | null = null
  private history: VoiceAgentMessage[] = []
  private closed = false
  private microphoneResumeTimer: ReturnType<typeof setTimeout> | null = null
  private cleanReconnectTimer: ReturnType<typeof setTimeout> | null = null
  private cleanReconnectAttempts = 0
  private pendingProductPhoto: PendingProductPhoto | null = null
  private pendingProductDocuments: PendingProductDocument[] = []

  private constructor(private readonly callbacks: VoiceAgentCallbacks) {}

  static async connect(callbacks: VoiceAgentCallbacks): Promise<DeepgramVoiceAgent> {
    const agent = new DeepgramVoiceAgent(callbacks)
    await agent.open()
    return agent
  }

  private async open() {
    voiceLog('Solicitando sesión temporal al backend')
    const bootstrap = await api.post<VoiceSessionResponse>('/auditoria-inteligente/voz/sesion', {})
    if (!bootstrap.agentId) throw new Error('Deepgram Voice Agent no tiene un agent ID configurado.')
    voiceLog('Sesión recibida', { agentId: bootstrap.agentId, expiresIn: bootstrap.expiresIn })

    const session = new AgentSession({
      auth: {
        tokenFactory: async () => {
          voiceLog('Solicitando token nuevo para WebSocket')
          const fresh = await api.post<VoiceSessionResponse>('/auditoria-inteligente/voz/sesion', {})
          voiceLog('Token temporal renovado', { agentId: fresh.agentId, expiresIn: fresh.expiresIn })
          return fresh.token
        },
      },
      agent: bootstrap.agentId,
      audio: {
        input: { encoding: 'linear16', sampleRate: 16_000 },
        output: { encoding: 'linear16', sampleRate: 24_000 },
      },
      keepAliveInterval: 8_000,
      // La reconexión de @deepgram/agents 0.1.1 corrompe los UUID de agentes
      // reutilizables y envía claves `agent.0`, `agent.1`, etc. Se desactiva
      // hasta que el SDK publique una versión corregida; una nueva apertura del
      // centro de voz siempre crea una sesión limpia y solicita un token nuevo.
      reconnect: { enabled: false },
      tags: ['bodegaaplismart', 'web'],
    })
    const player = new AgentPlayer({ sampleRate: 24_000 })
    const microphone = new AgentMicrophone((data) => session.sendAudio(data), {
      sampleRate: 16_000,
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
    })
    this.session = session
    this.player = player
    this.microphone = microphone

    session.on('connecting', () => voiceLog('Abriendo WebSocket'))
    session.on('connected', () => voiceLog('WebSocket abierto; esperando Welcome'))
    session.on('welcome', (message) => voiceLog('Welcome recibido', message))

    session.on('audio', (chunk) => {
      // Evita que el agente vuelva a escuchar su propia voz por los altavoces.
      microphone.mute()
      player.queue(chunk)
    })
    session.on('settings-applied', () => {
      voiceLog('Configuración del agente aceptada por Deepgram')
      this.cleanReconnectAttempts = 0
      session.updatePrompt(PROMPT_BODEGA_APLISMART)
      session.updateSpeak({
        provider: {
          type: 'deepgram',
          version: 'v1',
          model: bootstrap.voice || 'aura-2-javier-es',
          speed: 0.95,
        },
      })
      microphone.unmute()
      this.callbacks.onReady?.()
      this.callbacks.onState('listening')
    })
    session.on('conversation-text', (message) => {
      // @deepgram/agents 0.1.1 tiene un error al reconectar con un agente
      // reutilizable: intenta hacer `{ ...agentUuid }` para adjuntar el historial
      // y convierte el UUID string en `agent.0`, `agent.1`, etc. Conservamos el
      // historial de la interfaz en `this.history`, pero impedimos que el SDK
      // acumule su copia defectuosa antes de que pueda iniciarse una reconexión.
      session.conversationHistory = []
      if (message.role !== 'user' && message.role !== 'assistant') return
      const content = message.role === 'assistant'
        ? cleanVoiceTranscript(message.content ?? '')
        : message.content?.trim()
      if (!content) return
      const item: VoiceAgentMessage = { role: message.role, content }
      this.history.push(item)
      this.history = this.history.slice(-10)
      this.callbacks.onMessage(item)
    })
    session.on('user-started-speaking', () => {
      player.interrupt()
      this.callbacks.onState('listening')
    })
    session.on('agent-thinking', () => this.callbacks.onState('thinking'))
    session.on('agent-started-speaking', () => {
      this.clearMicrophoneResumeTimer()
      microphone.mute()
      this.callbacks.onState('speaking')
    })
    session.on('agent-audio-done', () => {
      this.clearMicrophoneResumeTimer()
      const playbackDelay = Math.ceil(player.getRemainingPlaybackTime() * 1_000) + 250
      this.microphoneResumeTimer = setTimeout(() => {
        this.microphoneResumeTimer = null
        if (this.closed) return
        microphone.unmute()
        this.callbacks.onState('listening')
      }, playbackDelay)
    })
    session.on('function-call-request', (request) => {
      voiceLog('FunctionCallRequest recibido', request.functions.map((call) => ({ id: call.id, name: call.name, arguments: call.arguments })))
      void this.handleFunctions(request)
    })
    session.on('reconnecting', () => {
      // Segunda protección por si el cierre ocurre durante el procesamiento
      // de un mensaje y antes de que `conversation-text` termine.
      session.conversationHistory = []
      microphone.mute()
      this.callbacks.onState('thinking')
    })
    session.on('disconnected', (reason) => {
      voiceLog('WebSocket cerrado', { reason, closedByUser: this.closed, currentSession: this.session === session })
      if (this.closed || this.session !== session) return
      this.scheduleCleanReconnect(String(reason || 'conexión cerrada'))
    })
    session.on('error', (message) => {
      console.error('[DeepgramVoice] Error enviado por Deepgram', message)
      this.callbacks.onError(this.readError(message))
    })
    session.on('warning', (message) => {
      console.warn('[DeepgramVoice] Advertencia enviada por Deepgram', message)
      this.callbacks.onError(this.readError(message))
    })
    session.on('sdk-error', (error) => {
      console.error('[DeepgramVoice] Error del SDK/WebSocket', error)
      this.callbacks.onError(error.message)
    })
    microphone.on('error', (error) => this.callbacks.onError(`Micrófono: ${error.message}`))

    await session.connect()
    voiceLog('connect() completado; iniciando micrófono')
    await microphone.start()
    voiceLog('Micrófono iniciado')
  }

  private async handleFunctions(request: FunctionCallRequestMessage) {
    if (!this.session) return
    await Promise.all(request.functions.map(async (call) => {
      try {
        const args = JSON.parse(call.arguments || '{}') as Record<string, unknown>
        let resultado: unknown
        if (call.name === 'consultar_sistema') {
          const mensajeFuncion = String(args.mensaje ?? args.consulta ?? args.query ?? '').trim()
          // La transcripción del usuario es la fuente primaria. El LLM puede
          // parafrasear nombres al construir los argumentos de la función y
          // romper referencias como "HOT 60 Pro".
          const mensajeUsuario = [...this.history].reverse().find((item) => item.role === 'user')?.content?.trim() ?? ''
          const mensaje = mensajeUsuario || mensajeFuncion
          if (!mensaje) throw new Error('La consulta llegó vacía.')
          voiceLog('Referencia de consulta resuelta', {
            transcripcionUsuario: mensajeUsuario,
            argumentoFuncion: mensajeFuncion,
            fuente: mensajeUsuario ? 'transcripcion_usuario' : 'argumento_funcion',
          })
          resultado = await api.post<unknown>('/auditoria-inteligente/voz/contexto', {
            mensaje,
            bodegaId: this.callbacks.bodegaId || undefined,
            historial: this.history,
          })
        } else if (call.name === 'consultar_catalogo_solicitud') {
          resultado = await api.post<unknown>('/auditoria-inteligente/voz/solicitudes/catalogo', {
            tipo: args.tipo ?? 'todos',
            bodega: args.bodega || undefined,
            bodegaId: this.callbacks.bodegaId || undefined,
          })
        } else if (call.name === 'crear_solicitud_recursos') {
          const ultimoMensajeUsuario = [...this.history].reverse().find((item) => item.role === 'user')?.content ?? ''
          resultado = await api.post<unknown>('/auditoria-inteligente/voz/solicitudes/crear', {
            bodega: args.bodega || undefined,
            bodegaId: this.callbacks.bodegaId || undefined,
            motivo: args.motivo,
            items: args.items,
            confirmacionUsuario: ultimoMensajeUsuario,
          })
        } else if (call.name === 'consultar_catalogo_programacion_checklist') {
          resultado = await api.post<unknown>('/auditoria-inteligente/voz/checklists/catalogo-programacion', {
            bodega: args.bodega || undefined,
            bodegaId: this.callbacks.bodegaId || undefined,
          })
        } else if (call.name === 'programar_checklist_rol') {
          const ultimoMensajeUsuario = [...this.history].reverse().find((item) => item.role === 'user')?.content ?? ''
          const ultimoMensajeAgente = [...this.history].reverse().find((item) => item.role === 'assistant')?.content ?? ''
          resultado = await api.post<unknown>('/auditoria-inteligente/voz/checklists/programar', {
            bodega: args.bodega || undefined,
            bodegaId: this.callbacks.bodegaId || undefined,
            plantilla: args.plantilla,
            rol: args.rol,
            fecha: args.fecha,
            hora: args.hora,
            confirmacionUsuario: ultimoMensajeUsuario,
            preguntaConfirmacion: ultimoMensajeAgente,
          })
        } else if (call.name === 'consultar_catalogo_creacion_producto') {
          this.callbacks.onProductPhotoRequested?.()
          resultado = await api.post<unknown>('/auditoria-inteligente/voz/productos/catalogo-creacion', {
            bodega: args.bodega || undefined,
            bodegaId: this.callbacks.bodegaId || undefined,
          })
        } else if (call.name === 'registrar_producto') {
          const ultimoMensajeUsuario = [...this.history].reverse().find((item) => item.role === 'user')?.content ?? ''
          const ultimoMensajeAgente = [...this.history].reverse().find((item) => item.role === 'assistant')?.content ?? ''
          resultado = await api.post<unknown>('/auditoria-inteligente/voz/productos/crear', {
            bodega: args.bodega || undefined,
            bodegaId: this.callbacks.bodegaId || undefined,
            nombre: args.nombre,
            codigo: args.codigo,
            categoria: args.categoria,
            unidad: args.unidad,
            marca: args.marca || undefined,
            proveedor: args.proveedor || undefined,
            precioCompra: args.precioCompra,
            descripcion: args.descripcion || undefined,
            precio: args.precio,
            stockInicial: args.stockInicial,
            stockMinimo: args.stockMinimo,
            stockMaximo: args.stockMaximo,
            admiteDevolucion: args.admiteDevolucion,
            fotoKey: this.pendingProductPhoto?.key,
            fotoNombre: this.pendingProductPhoto?.nombre,
            fotoMimeType: this.pendingProductPhoto?.mimeType,
            fotoSizeBytes: this.pendingProductPhoto?.sizeBytes,
            documentos: this.pendingProductDocuments,
            confirmacionUsuario: ultimoMensajeUsuario,
            preguntaConfirmacion: ultimoMensajeAgente,
          })
          this.pendingProductPhoto = null
          this.pendingProductDocuments = []
          void dashboardStore.refetchActual(this.callbacks.bodegaId).catch(() => undefined)
          this.callbacks.onProductCreated?.()
        } else {
          throw new Error('Función no permitida.')
        }
        voiceLog('Función completada', { id: call.id, name: call.name })
        const voicePayload = createVoiceFunctionPayload(resultado)
        voiceLog('Contexto preparado para voz', {
          funcion: call.name,
          bytesOriginales: JSON.stringify(resultado).length,
          bytesVoz: voicePayload.length,
        })
        this.session?.sendFunctionCallResponse(call.id, call.name, voicePayload)
      } catch (error) {
        const detail = error instanceof Error ? error.message : 'No se pudo consultar el sistema.'
        console.error('[DeepgramVoice] Falló la función', { id: call.id, name: call.name, error: detail })
        this.session?.sendFunctionCallResponse(call.id, call.name, JSON.stringify({ error: detail }))
      }
    }))
  }

  private readError(message: unknown) {
    if (message && typeof message === 'object') {
      const record = message as Record<string, unknown>
      return String(record.description ?? record.message ?? record.error ?? 'Deepgram reportó un error.')
    }
    return String(message || 'Deepgram reportó un error.')
  }

  private clearMicrophoneResumeTimer() {
    if (!this.microphoneResumeTimer) return
    clearTimeout(this.microphoneResumeTimer)
    this.microphoneResumeTimer = null
  }

  setPendingProductPhoto(photo: PendingProductPhoto | null) {
    this.pendingProductPhoto = photo
    voiceLog(photo ? 'Foto temporal preparada para el producto' : 'Foto temporal retirada')
  }

  setPendingProductDocuments(documents: PendingProductDocument[]) {
    this.pendingProductDocuments = documents
    voiceLog('Documentos temporales preparados para el producto', { total: documents.length })
  }

  private scheduleCleanReconnect(reason: string) {
    if (this.closed || this.cleanReconnectTimer) return
    this.microphone?.mute()
    this.callbacks.onState('thinking')
    const attempt = ++this.cleanReconnectAttempts
    const delay = Math.min(750 * 2 ** (attempt - 1), 10_000)
    voiceLog('Reconexión limpia programada', { attempt, delay, reason })
    this.callbacks.onError(`Reconectando el agente de voz… (${reason})`)
    this.cleanReconnectTimer = setTimeout(() => {
      this.cleanReconnectTimer = null
      void this.reconnectCleanly()
    }, delay)
  }

  private async reconnectCleanly() {
    if (this.closed) return
    this.clearMicrophoneResumeTimer()
    this.microphone?.stop()
    this.player?.dispose()
    this.session = null
    this.microphone = null
    this.player = null
    try {
      await this.open()
    } catch (error) {
      const detail = error instanceof Error ? error.message : 'No se pudo restablecer la conexión.'
      this.scheduleCleanReconnect(detail)
    }
  }

  disconnect() {
    voiceLog('Cierre solicitado por la interfaz')
    this.closed = true
    this.clearMicrophoneResumeTimer()
    if (this.cleanReconnectTimer) {
      clearTimeout(this.cleanReconnectTimer)
      this.cleanReconnectTimer = null
    }
    this.microphone?.stop()
    this.player?.dispose()
    this.session?.disconnect()
    this.microphone = null
    this.player = null
    this.session = null
  }
}
