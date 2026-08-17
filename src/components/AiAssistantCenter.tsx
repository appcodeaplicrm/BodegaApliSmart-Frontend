import { useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Bot, CheckCircle2, ImagePlus, Loader2, MessageSquare, Mic, MicOff, Send, ShieldAlert, Sparkles, X } from 'lucide-react'
import { api, ApiError } from '../lib/api'
import { useBodegaActiva } from '../store/bodegaActiva'
import type { DashboardResumen } from '../store/dashboard'
import { authStore } from '../store/auth'
import { DeepgramVoiceAgent } from '../lib/deepgramVoiceAgent'
import { uploadsService, type UploadResult } from '../store/productos'

type AuditoriaResumen = NonNullable<DashboardResumen['auditoriaInteligente']>
type ChatMessage = { role: 'user' | 'assistant'; content: string }
type ProductDocumentUpload = UploadResult & { tipo: 'FichaTecnica' | 'Certificacion' | 'Manual' | 'Otro' }
type Hallazgo = {
  id: string
  titulo: string
  descripcion: string
  severidad: 'BAJA' | 'MEDIA' | 'ALTA' | 'CRITICA'
  estado: string
  resumenIa?: string | null
  recomendacionesIa?: string[] | null
  ocurrencias: number
  ultimaDeteccion: string
}

type ResumenApi = {
  total: number
  porSeveridad: { BAJA: number; MEDIA: number; ALTA: number; CRITICA: number }
}

type SpeechResultEventLike = {
  resultIndex: number
  results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }>
}
type SpeechRecognitionLike = {
  lang: string
  continuous: boolean
  interimResults: boolean
  onresult: ((event: SpeechResultEventLike) => void) | null
  onerror: ((event: { error: string }) => void) | null
  onend: (() => void) | null
  start(): void
  stop(): void
  abort(): void
}
type SpeechRecognitionConstructor = new () => SpeechRecognitionLike

function speechRecognitionConstructor(): SpeechRecognitionConstructor | null {
  if (typeof window === 'undefined') return null
  const speechWindow = window as typeof window & {
    SpeechRecognition?: SpeechRecognitionConstructor
    webkitSpeechRecognition?: SpeechRecognitionConstructor
  }
  return speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition ?? null
}

export function GlobalAiAssistant() {
  const bodegaId = useBodegaActiva()
  const [auditoria, setAuditoria] = useState<AuditoriaResumen | null>(null)
  const puedeVer = authStore.tienePermisos(['auditoria.ver'])

  useEffect(() => {
    if (!puedeVer || !bodegaId) { setAuditoria(null); return }
    let active = true
    const cargar = () => {
      api.get<ResumenApi>(`/auditoria-inteligente/resumen?bodegaId=${encodeURIComponent(bodegaId)}`)
        .then((resumen) => {
          if (!active) return
          setAuditoria({
            total: resumen.total,
            criticas: resumen.porSeveridad.CRITICA,
            altas: resumen.porSeveridad.ALTA,
            recientes: [],
          })
        })
        .catch(() => { if (active) setAuditoria(null) })
    }
    cargar()
    const timer = window.setInterval(cargar, 60_000)
    return () => { active = false; window.clearInterval(timer) }
  }, [bodegaId, puedeVer])

  return auditoria ? <AiAssistantCenter auditoria={auditoria}/> : null
}

export function AiAssistantCenter({ auditoria }: { auditoria: AuditoriaResumen }) {
  const [open, setOpen] = useState(false)
  return <>
    <button type="button" onClick={() => setOpen(true)} aria-label="Abrir asistente de IA" className="fixed z-40 right-4 sm:right-6 bottom-16 sm:bottom-6 h-14 px-0 sm:px-5 w-14 sm:w-auto rounded-full border border-secondary/45 bg-card hover:bg-secondary/10 shadow-[0_12px_35px_rgba(0,0,0,0.45)] flex items-center justify-center gap-2.5 text-secondary transition-all hover:-translate-y-0.5">
      <Bot size={21}/><span className="hidden sm:inline text-xs font-semibold">Asistente IA</span>
    </button>
    {open && <AiCenterModal auditoria={auditoria} onClose={() => setOpen(false)}/>} 
  </>
}

function AiCenterModal({ auditoria, onClose }: { auditoria: AuditoriaResumen; onClose: () => void }) {
  const bodegaId = useBodegaActiva()
  const [tab, setTab] = useState<'chat' | 'voz' | 'auditorias'>('voz')
  const [hallazgos, setHallazgos] = useState<Hallazgo[]>([])
  const [auditsLoaded, setAuditsLoaded] = useState(false)
  const [loadingAudits, setLoadingAudits] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([{ role: 'assistant', content: 'Hola. Puedo ayudarte a interpretar las auditorías y responder preguntas sobre los hallazgos detectados.' }])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [listening, setListening] = useState(false)
  const [interim, setInterim] = useState('')
  const [voiceMode, setVoiceMode] = useState(false)
  const [agentState, setAgentState] = useState<'idle' | 'listening' | 'thinking' | 'speaking'>('idle')
  const [showProductPhoto, setShowProductPhoto] = useState(false)
  const [productPhoto, setProductPhoto] = useState<UploadResult | null>(null)
  const [uploadingProductPhoto, setUploadingProductPhoto] = useState(false)
  const [productDocuments, setProductDocuments] = useState<ProductDocumentUpload[]>([])
  const [productDocumentType, setProductDocumentType] = useState<ProductDocumentUpload['tipo']>('FichaTecnica')
  const [uploadingProductDocuments, setUploadingProductDocuments] = useState(false)
  const endRef = useRef<HTMLDivElement>(null)
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null)
  const voiceModeRef = useRef(false)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const audioUrlRef = useRef<string | null>(null)
  const deepgramAgentRef = useRef<DeepgramVoiceAgent | null>(null)
  const usingDeepgramRef = useRef(false)
  const speechSupported = Boolean(speechRecognitionConstructor())

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      voiceModeRef.current = false
      deepgramAgentRef.current?.disconnect()
      deepgramAgentRef.current = null
      recognitionRef.current?.abort()
      stopAudio()
      onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages, sending])
  useEffect(() => () => {
    voiceModeRef.current = false
    deepgramAgentRef.current?.disconnect()
    deepgramAgentRef.current = null
    recognitionRef.current?.abort()
    window.speechSynthesis?.cancel()
    audioRef.current?.pause()
    if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current)
  }, [])
  useEffect(() => {
    voiceModeRef.current = true
    setVoiceMode(true)
    let cancelled = false
    void DeepgramVoiceAgent.connect({
      bodegaId: bodegaId || undefined,
      onState: (state) => { if (!cancelled) setAgentState(state) },
      onMessage: (message) => {
        if (cancelled) return
        setMessages((items) => [...items, message])
        if (message.role === 'user') setInput(message.content)
        else setInput('')
      },
      onError: (message) => { if (!cancelled) setError(message) },
      onReady: () => { if (!cancelled) setError(null) },
      onProductPhotoRequested: () => { if (!cancelled) setShowProductPhoto(true) },
      onProductCreated: () => {
        if (cancelled) return
        setShowProductPhoto(false)
        setProductPhoto(null)
        setProductDocuments([])
      },
    }).then((agent) => {
      if (cancelled) { agent.disconnect(); return }
      usingDeepgramRef.current = true
      deepgramAgentRef.current = agent
    }).catch((reason) => {
      if (cancelled) return
      usingDeepgramRef.current = false
      const detail = reason instanceof Error ? reason.message : 'Voice Agent no está disponible.'
      setError(`${detail} Se usará el modo de voz de respaldo.`)
      if (speechSupported) window.setTimeout(startListening, 250)
    })
    return () => {
      cancelled = true
      usingDeepgramRef.current = false
      deepgramAgentRef.current?.disconnect()
      deepgramAgentRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  useEffect(() => {
    if (tab !== 'auditorias' || auditsLoaded || loadingAudits) return
    setLoadingAudits(true)
    const query = bodegaId ? `?bodegaId=${encodeURIComponent(bodegaId)}` : ''
    api.get<Hallazgo[]>(`/auditoria-inteligente/hallazgos${query}`).then((items) => {
      setHallazgos(items.filter((item) => item.estado === 'Pendiente' || item.estado === 'EnRevision'))
      setAuditsLoaded(true)
    }).catch((e) => setError(e instanceof ApiError ? e.message : 'No se pudieron cargar las auditorías.')).finally(() => setLoadingAudits(false))
  }, [tab, bodegaId, auditsLoaded, loadingAudits])

  function stopAudio() {
    audioRef.current?.pause()
    audioRef.current = null
    if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current)
    audioUrlRef.current = null
    window.speechSynthesis?.cancel()
    setAgentState('idle')
  }

  async function handleProductPhoto(file?: File) {
    if (!file || !bodegaId || uploadingProductPhoto) return
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setError('La foto debe estar en formato JPG, PNG o WEBP.')
      return
    }
    setUploadingProductPhoto(true)
    setError(null)
    try {
      const uploaded = await uploadsService.subir(file, { seccion: 'products', bodegaId })
      setProductPhoto(uploaded)
      deepgramAgentRef.current?.setPendingProductPhoto({
        key: uploaded.key,
        nombre: uploaded.nombre || file.name,
        mimeType: uploaded.mimeType || file.type,
        sizeBytes: uploaded.sizeBytes || file.size,
      })
    } catch (reason) {
      setError(reason instanceof ApiError ? reason.message : 'No se pudo subir la foto del producto.')
    } finally {
      setUploadingProductPhoto(false)
    }
  }

  async function handleProductDocuments(files?: FileList | null) {
    if (!files?.length || !bodegaId || uploadingProductDocuments) return
    const selected = Array.from(files)
    const invalid = selected.find((file) => !['application/pdf', 'image/jpeg', 'image/png', 'image/webp'].includes(file.type))
    if (invalid) {
      setError(`El archivo ${invalid.name} debe ser PDF, JPG, PNG o WEBP.`)
      return
    }
    setUploadingProductDocuments(true)
    setError(null)
    try {
      const uploaded = await Promise.all(selected.map((file) => uploadsService.subir(file, { seccion: 'products', bodegaId })))
      const nuevos = uploaded.map((item) => ({ ...item, tipo: productDocumentType }))
      const next = [...productDocuments, ...nuevos]
      setProductDocuments(next)
      deepgramAgentRef.current?.setPendingProductDocuments(next.map((item) => ({
        tipo: item.tipo,
        key: item.key,
        nombre: item.nombre,
        mimeType: item.mimeType,
        sizeBytes: item.sizeBytes,
      })))
    } catch (reason) {
      setError(reason instanceof ApiError ? reason.message : 'No se pudieron subir los documentos del producto.')
    } finally {
      setUploadingProductDocuments(false)
    }
  }

  function speakWithBrowser(text: string, continueListening: boolean) {
    if (!voiceModeRef.current || !('speechSynthesis' in window)) return
    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = 'es-ES'
    utterance.rate = 1
    const voices = window.speechSynthesis.getVoices()
    utterance.voice = voices.find((voice) => voice.lang.toLowerCase().startsWith('es')) ?? null
    utterance.onend = () => { if (continueListening && voiceModeRef.current) startListening() }
    utterance.onstart = () => setAgentState('speaking')
    window.speechSynthesis.speak(utterance)
  }

  async function speak(text: string, continueListening: boolean) {
    if (!voiceModeRef.current) return
    stopAudio()
    try {
      const response = await fetch('/api/auditoria-inteligente/voz', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', Accept: 'audio/mpeg' },
        body: JSON.stringify({ texto: text }),
      })
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const audio = new Audio(url)
      audioRef.current = audio
      audioUrlRef.current = url
      audio.onplay = () => setAgentState('speaking')
      audio.onended = () => {
        stopAudio()
        if (continueListening && voiceModeRef.current) startListening()
      }
      audio.onerror = () => {
        stopAudio()
        speakWithBrowser(text, continueListening)
      }
      await audio.play()
    } catch {
      stopAudio()
      speakWithBrowser(text, continueListening)
    }
  }

  async function send(contentOverride?: string, fromVoice = false) {
    const content = (contentOverride ?? input).trim()
    if (!content || sending) return
    const previous = messages.slice(1).slice(-10)
    setMessages((items) => [...items, { role: 'user', content }]); setInput(''); setSending(true); setError(null)
    setAgentState('thinking')
    try {
      const result = await api.post<{ respuesta: string }>('/auditoria-inteligente/chat', { mensaje: content, bodegaId: bodegaId || undefined, historial: previous })
      setMessages((items) => [...items, { role: 'assistant', content: result.respuesta }])
      void speak(result.respuesta, fromVoice)
    } catch (e) {
      setAgentState('idle')
      setError(e instanceof ApiError ? e.message : 'No se pudo consultar al asistente.')
      if (fromVoice && voiceModeRef.current) window.setTimeout(startListening, 600)
    }
    finally { setSending(false) }
  }

  function startListening() {
    if (usingDeepgramRef.current) return
    const Recognition = speechRecognitionConstructor()
    if (!Recognition || listening || sending) return
    stopAudio()
    const recognition = new Recognition()
    recognition.lang = 'es-ES'
    recognition.continuous = false
    recognition.interimResults = true
    let submitted = false
    recognition.onresult = (event) => {
      let partial = ''
      let finalText = ''
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript
        if (event.results[i].isFinal) finalText += transcript
        else partial += transcript
      }
      setInterim(partial)
      if (finalText.trim()) {
        submitted = true
        const question = finalText.trim()
        setInput(question)
        setInterim('')
        recognition.stop()
        void send(question, true)
      }
    }
    recognition.onerror = (event) => {
      if (!['aborted', 'no-speech'].includes(event.error)) setError(`No se pudo escuchar el micrófono: ${event.error}.`)
      setListening(false)
    }
    recognition.onend = () => {
      setListening(false)
      recognitionRef.current = null
      if (!submitted && voiceModeRef.current) {
        setAgentState('idle')
        window.setTimeout(startListening, 500)
      }
    }
    recognitionRef.current = recognition
    setError(null)
    setListening(true)
    setAgentState('listening')
    recognition.start()
  }

  function stopListening() {
    recognitionRef.current?.stop()
    setListening(false)
    setInterim('')
    setAgentState('idle')
  }

  function toggleVoiceMode() {
    const next = !voiceModeRef.current
    voiceModeRef.current = next
    setVoiceMode(next)
    if (next) {
      window.setTimeout(startListening, 0)
    } else {
      stopAudio()
      stopListening()
    }
  }

  function closeModal() {
    voiceModeRef.current = false
    setVoiceMode(false)
    usingDeepgramRef.current = false
    deepgramAgentRef.current?.disconnect()
    deepgramAgentRef.current = null
    recognitionRef.current?.abort()
    stopAudio()
    onClose()
  }

  return createPortal(<div className="fixed inset-0 z-[100] bg-black/75 backdrop-blur-sm" onMouseDown={(e) => e.target === e.currentTarget && closeModal()}>
    <section role="dialog" aria-modal="true" aria-label="Asistente de IA" className="w-screen h-[100dvh] bg-card shadow-2xl flex flex-col overflow-hidden">
      <button type="button" onClick={closeModal} aria-label="Cerrar asistente" className="absolute top-4 right-4 z-30 w-11 h-11 rounded-full grid place-items-center border border-white/10 bg-black/30 text-white/60 hover:text-white hover:bg-black/50 backdrop-blur"><X size={19}/></button>
      <nav className="hidden"><Tab active={tab === 'chat'} onClick={() => setTab('chat')} icon={<MessageSquare size={14}/>} label="Chat"/><Tab active={tab === 'voz'} onClick={() => setTab('voz')} icon={<Mic size={14}/>} label="Voz"/><Tab active={tab === 'auditorias'} onClick={() => setTab('auditorias')} icon={<ShieldAlert size={14}/>} label="Auditorías" badge={auditoria.total}/></nav>
      {tab === 'chat' ? <>
        <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-5 space-y-3">{messages.map((message, index) => <div key={index} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}><div className={`max-w-[88%] sm:max-w-[78%] px-3.5 py-3 text-sm leading-relaxed whitespace-pre-wrap ${message.role === 'user' ? 'bg-primary text-primary-foreground' : 'border border-border bg-background/45 text-foreground'}`}>{message.content}</div></div>)}{sending && <div className="inline-flex items-center gap-2 border border-border bg-background/45 px-3 py-2 text-xs text-muted-foreground"><Loader2 size={13} className="animate-spin"/>Analizando…</div>}<div ref={endRef}/></div>
        {error && <div className="mx-4 mb-2 border border-red-500/30 bg-red-500/10 text-red-300 px-3 py-2 text-xs">{error}</div>}
        <form className="shrink-0 border-t border-border p-3 sm:p-4 flex gap-2" onSubmit={(e) => { e.preventDefault(); void send() }}><button type="button" onClick={listening ? stopListening : startListening} disabled={!speechSupported || sending} title={speechSupported ? (listening ? 'Detener escucha' : 'Hablar con el asistente') : 'El navegador no admite reconocimiento de voz'} className={`w-12 shrink-0 grid place-items-center border disabled:opacity-35 ${listening ? 'border-primary bg-primary/15 text-primary animate-pulse' : 'border-border bg-background text-muted-foreground hover:text-secondary hover:border-secondary/40'}`}>{listening ? <MicOff size={18}/> : <Mic size={18}/>}</button><textarea value={interim || input} onChange={(e) => { setInterim(''); setInput(e.target.value) }} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void send() } }} rows={2} maxLength={3000} readOnly={listening} placeholder={listening ? 'Escuchando…' : 'Pregunta por un producto, stock, precio o movimiento…'} className="flex-1 resize-none border border-border bg-background text-foreground placeholder:text-muted-foreground px-3 py-2.5 text-sm outline-none focus:border-secondary/60 focus:ring-1 focus:ring-secondary/20"/><button type="submit" disabled={!input.trim() || sending || listening} className="btn-primary self-stretch px-4 disabled:opacity-40"><Send size={15}/><span className="hidden sm:inline">Enviar</span></button></form>
      </> : tab === 'voz' ? <VoiceExperience state={agentState} active={voiceMode} transcript={interim || input} lastMessage={messages[messages.length - 1]} error={error} showProductPhoto={showProductPhoto} productPhoto={productPhoto} uploadingProductPhoto={uploadingProductPhoto} onProductPhoto={handleProductPhoto} productDocuments={productDocuments} productDocumentType={productDocumentType} onProductDocumentType={setProductDocumentType} uploadingProductDocuments={uploadingProductDocuments} onProductDocuments={handleProductDocuments}/> : <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-5">{error && <div className="mb-3 border border-red-500/30 bg-red-500/10 text-red-300 px-3 py-2 text-xs">{error}</div>}{loadingAudits ? <div className="h-full grid place-items-center text-muted-foreground"><Loader2 className="animate-spin"/></div> : hallazgos.length === 0 ? <div className="h-full grid place-items-center text-center"><div><Sparkles className="mx-auto text-secondary mb-3"/><h3 className="font-heading text-lg">SIN AUDITORÍAS ACTIVAS</h3><p className="text-xs text-muted-foreground mt-1">No hay situaciones pendientes de revisión.</p></div></div> : <div className="space-y-3">{hallazgos.map((item, index) => <article key={item.id} className="border border-border bg-background/30 p-4"><div className="flex items-start gap-3"><span className="w-7 h-7 shrink-0 grid place-items-center border border-primary/30 bg-primary/10 text-primary text-[10px] font-mono">+{index + 1}</span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h3 className="font-medium text-sm">{item.titulo}</h3><span className="text-[8px] font-mono border border-border px-1.5 py-0.5">{item.severidad}</span></div><p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">{item.resumenIa || item.descripcion}</p>{item.recomendacionesIa?.length ? <ul className="mt-3 space-y-1 text-[11px] text-muted-foreground">{item.recomendacionesIa.map((r, i) => <li key={i}>• {r}</li>)}</ul> : null}</div></div></article>)}</div>}</div>}
    </section>
  </div>, document.body)
}

function VoiceExperience({ state, active, transcript, lastMessage, error, showProductPhoto, productPhoto, uploadingProductPhoto, onProductPhoto, productDocuments, productDocumentType, onProductDocumentType, uploadingProductDocuments, onProductDocuments }: {
  state: 'idle' | 'listening' | 'thinking' | 'speaking'
  active: boolean
  transcript: string
  lastMessage?: ChatMessage
  error: string | null
  showProductPhoto: boolean
  productPhoto: UploadResult | null
  uploadingProductPhoto: boolean
  onProductPhoto: (file?: File) => void | Promise<void>
  productDocuments: ProductDocumentUpload[]
  productDocumentType: ProductDocumentUpload['tipo']
  onProductDocumentType: (tipo: ProductDocumentUpload['tipo']) => void
  uploadingProductDocuments: boolean
  onProductDocuments: (files?: FileList | null) => void | Promise<void>
}) {
  const labels = {
    idle: active ? 'Listo para escucharte' : 'Inicia una conversación por voz',
    listening: 'Escuchando…',
    thinking: 'Consultando tu inventario…',
    speaking: 'Javier está hablando…',
  }
  const detail = transcript || (lastMessage?.content ?? 'Pregunta por productos, stock, precios o movimientos.')
  const detailLimpio = detail
    .replace(/\*\*/g, '')
    .replace(/\s+(?=(?:Usuario|Estado|Fecha de registro|Último acceso|Ultimo acceso|Rol principal|Rol|Bodega asignada|Bodegas asignadas|Nombre|Total|Resumen|Evidencia|Recomendaciones):)/gi, '\n')
    .trim()
  const lineasDetalle = detailLimpio.split('\n').filter(Boolean)
  return <div className="relative flex-1 min-h-0 overflow-y-auto lg:overflow-hidden bg-[#090b0c] px-5 sm:px-8 lg:px-12 py-8">
    <style>{`
      @keyframes ai-orb-breathe { 0%,100% { transform: scale(.96); filter: saturate(.9); } 50% { transform: scale(1.045); filter: saturate(1.2); } }
      @keyframes ai-orb-spin { to { transform: rotate(360deg); } }
      @keyframes ai-orb-wave { 0%,100% { transform: scale(.92); opacity: .28; } 50% { transform: scale(1.12); opacity: .7; } }
      .ai-voice-orb { animation: ai-orb-breathe 4.8s ease-in-out infinite; }
      .ai-voice-ring { animation: ai-orb-spin 9s linear infinite; }
      .ai-voice-ring-alt { animation: ai-orb-spin 7s linear infinite reverse; }
      .ai-voice-wave { animation: ai-orb-wave 2.4s ease-in-out infinite; }
      .ai-voice-speaking .ai-voice-orb { animation-duration: 1.15s; }
      .ai-voice-speaking .ai-voice-wave { animation-duration: .85s; }
      .ai-voice-listening .ai-voice-orb { animation-duration: 2s; }
      .ai-voice-thinking .ai-voice-ring { animation-duration: 2.8s; }
    `}</style>
    <div className="relative z-10 mx-auto grid min-h-full w-full max-w-7xl grid-cols-1 items-center gap-8 lg:grid-cols-[minmax(0,1.2fr)_minmax(360px,.8fr)] lg:gap-14">
      <section className="order-2 min-w-0 lg:order-1 lg:max-h-[calc(100dvh-8rem)] lg:overflow-y-auto lg:pr-4">
        <div className="eyebrow text-secondary mb-3">RESPUESTA DEL ASISTENTE</div>
        <h3 className="font-heading text-2xl sm:text-3xl text-foreground mb-5">{transcript ? 'Esto es lo que estoy escuchando' : 'Información encontrada'}</h3>
        <div className="border border-white/10 bg-white/[0.035] p-5 sm:p-7 shadow-[0_18px_55px_rgba(0,0,0,.22)]">
          <div className="space-y-3 text-sm sm:text-base leading-7 text-foreground/90 break-words">
            {lineasDetalle.map((linea, index) => {
              const campo = linea.match(/^([^:]{1,40}):\s*(.*)$/)
              return campo
                ? <p key={index} className="grid gap-1 sm:grid-cols-[minmax(130px,180px)_1fr] sm:gap-5"><span className="font-mono text-[11px] uppercase tracking-wider text-secondary">{campo[1]}</span><span>{campo[2]}</span></p>
                : <p key={index} className="whitespace-pre-wrap">{linea}</p>
            })}
          </div>
        </div>
        {showProductPhoto && <div className="mt-4 border border-secondary/25 bg-secondary/[0.045] p-4 sm:p-5">
          <div className="flex items-start gap-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center border border-secondary/30 bg-secondary/10 text-secondary"><ImagePlus size={18}/></div>
            <div className="min-w-0 flex-1">
              <div className="font-heading text-lg text-foreground">FOTO DEL PRODUCTO <span className="font-sans text-xs font-normal text-muted-foreground">(OPCIONAL)</span></div>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">Sube una imagen JPG, PNG o WEBP. Cuando termine, dile al agente: “La foto ya está lista”.</p>
              <label className={`mt-3 inline-flex min-h-10 cursor-pointer items-center gap-2 border px-4 text-xs font-semibold transition-colors ${productPhoto ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300' : 'border-secondary/40 bg-secondary/10 text-secondary hover:bg-secondary/15'} ${uploadingProductPhoto ? 'pointer-events-none opacity-60' : ''}`}>
                {uploadingProductPhoto ? <Loader2 size={15} className="animate-spin"/> : productPhoto ? <CheckCircle2 size={15}/> : <ImagePlus size={15}/>}
                {uploadingProductPhoto ? 'SUBIENDO FOTO…' : productPhoto ? 'FOTO LISTA · CAMBIAR' : 'SELECCIONAR FOTO'}
                <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" disabled={uploadingProductPhoto} onChange={(event) => { void onProductPhoto(event.target.files?.[0]); event.currentTarget.value = '' }}/>
              </label>
              {productPhoto && <div className="mt-2 truncate font-mono text-[10px] text-emerald-300/80">{productPhoto.nombre}</div>}
              <div className="my-4 border-t border-white/10"/>
              <div className="font-heading text-base text-foreground">DOCUMENTOS DEL PRODUCTO</div>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">Selecciona el tipo y adjunta uno o varios archivos PDF o imágenes.</p>
              <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                <select value={productDocumentType} onChange={(event) => onProductDocumentType(event.target.value as ProductDocumentUpload['tipo'])} className="min-h-10 border border-white/15 bg-[#111415] px-3 text-xs text-foreground outline-none focus:border-secondary/50">
                  <option value="FichaTecnica">Ficha técnica</option>
                  <option value="Certificacion">Certificación</option>
                  <option value="Manual">Manual</option>
                  <option value="Otro">Otro documento</option>
                </select>
                <label className={`inline-flex min-h-10 cursor-pointer items-center justify-center gap-2 border border-secondary/40 bg-secondary/10 px-4 text-xs font-semibold text-secondary hover:bg-secondary/15 ${uploadingProductDocuments ? 'pointer-events-none opacity-60' : ''}`}>
                  {uploadingProductDocuments ? <Loader2 size={15} className="animate-spin"/> : <ImagePlus size={15}/>}
                  {uploadingProductDocuments ? 'SUBIENDO…' : 'AGREGAR DOCUMENTOS'}
                  <input type="file" multiple accept="application/pdf,image/jpeg,image/png,image/webp" className="sr-only" disabled={uploadingProductDocuments} onChange={(event) => { void onProductDocuments(event.target.files); event.currentTarget.value = '' }}/>
                </label>
              </div>
              {productDocuments.length > 0 && <div className="mt-3 space-y-1.5">
                {productDocuments.map((documento, index) => <div key={`${documento.key}-${index}`} className="flex min-w-0 items-center gap-2 border border-emerald-500/20 bg-emerald-500/[0.06] px-2.5 py-2 text-[10px] text-emerald-300">
                  <CheckCircle2 size={12} className="shrink-0"/><span className="shrink-0 font-mono uppercase">{documento.tipo}</span><span className="truncate text-emerald-200/75">{documento.nombre}</span>
                </div>)}
              </div>}
            </div>
          </div>
        </div>}
        {error && <div className="mt-4 border border-red-500/30 bg-red-500/10 text-red-300 px-3 py-2 text-xs">{error}</div>}
      </section>
      <section className={`order-1 min-w-0 text-center lg:order-2 ai-voice-${state}`}>
        <div className="relative w-56 h-56 sm:w-64 sm:h-64 lg:w-72 lg:h-72 mx-auto mb-7">
          <div className="ai-voice-wave absolute inset-2 rounded-full bg-secondary/10 blur-2xl"/>
          <div className="ai-voice-ring absolute inset-3 rounded-[45%_55%_52%_48%/52%_44%_56%_48%] border-2 border-fuchsia-500/75 shadow-[0_0_25px_rgba(217,70,239,.25)]"/>
          <div className="ai-voice-ring-alt absolute inset-5 rounded-[54%_46%_44%_56%/45%_58%_42%_55%] border-2 border-cyan-400/80 shadow-[0_0_24px_rgba(34,211,238,.2)]"/>
          <div className="ai-voice-orb absolute inset-8 rounded-[48%_52%_55%_45%/52%_45%_55%_48%] bg-[radial-gradient(circle_at_35%_28%,rgba(255,255,255,.85),rgba(171,247,104,.72)_20%,rgba(34,211,238,.65)_55%,rgba(37,45,52,.9)_100%)] shadow-[inset_-30px_-35px_55px_rgba(13,25,35,.52),0_0_55px_rgba(34,211,238,.22)]"/>
        </div>
        <div className="eyebrow text-secondary mb-2">AURA 2 · JAVIER · LATINOAMÉRICA</div>
        <h3 className="font-heading text-2xl sm:text-3xl text-foreground">{labels[state]}</h3>
        <p className="mt-3 mx-auto max-w-sm text-xs sm:text-sm leading-relaxed text-muted-foreground">{state === 'listening' ? 'Habla con naturalidad. Estoy procesando tu consulta en tiempo real.' : 'Asistente operativo de BodegaApliSmart.'}</p>
      </section>
    </div>
    <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_76%_48%,rgba(34,211,238,.07),transparent_38%)]"/>
  </div>
}

function Tab({ active, onClick, icon, label, badge }: { active: boolean; onClick: () => void; icon: ReactNode; label: string; badge?: number }) {
  return <button type="button" onClick={onClick} className={`h-12 flex items-center justify-center gap-2 text-xs font-medium border-b-2 transition-colors ${active ? 'border-secondary text-secondary bg-secondary/[0.04]' : 'border-transparent text-muted-foreground hover:text-foreground'}`}>{icon}{label}{Boolean(badge) && <span className="px-1.5 py-0.5 bg-primary text-primary-foreground text-[9px] font-mono">+{badge}</span>}</button>
}
