/**
 * Modal para tomar una foto con la webcam (getUserMedia).
 *
 * - Pide permiso y muestra el preview en vivo.
 * - El user hace click en "Capturar" → el frame actual del <video>
 *   se vuelca a un <canvas> y se devuelve como Blob al padre.
 * - El padre se encarga de subirlo al storage.
 *
 * UX: si el user no tiene cámara o el browser no soporta getUserMedia,
 * mostramos un mensaje claro y un input file de fallback para que
 * pueda elegir una foto ya existente.
 */
import { useEffect, useRef, useState } from 'react'
import { Camera, X, RefreshCw, Upload, AlertCircle } from 'lucide-react'
import { Modal } from './Modal'

type Props = {
  /** Se muestra en el header del modal. */
  label?: string
  /** Cerrar el modal sin capturar nada. */
  onClose: () => void
  /** Devuelve el Blob capturado. El padre lo sube al storage. */
  onCapture: (blob: Blob) => void
}

export function TomarFotoModal({ label, onClose, onCapture }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [ready, setReady] = useState(false)
  const [captured, setCaptured] = useState<string | null>(null) // dataURL preview
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Inicializar la cámara al montar.
  useEffect(() => {
    let cancel = false
    async function init() {
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          setError('Tu navegador no soporta captura de cámara.')
          return
        }
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        })
        if (cancel) {
          stream.getTracks().forEach((t) => t.stop())
          return
        }
        streamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          await videoRef.current.play()
        }
        setReady(true)
      } catch (e) {
        if (cancel) return
        const msg = (e as Error).message ?? 'Error desconocido'
        if (msg.includes('Permission') || msg.includes('NotAllowed')) {
          setError('Necesitamos permiso para usar la cámara. Habilítalo e intenta de nuevo.')
        } else if (msg.includes('NotFound') || msg.includes('DevicesNotFound')) {
          setError('No se encontró ninguna cámara. Usa "Subir foto" como alternativa.')
        } else {
          setError(`No se pudo abrir la cámara: ${msg}`)
        }
      }
    }
    void init()

    return () => {
      cancel = true
      const s = streamRef.current
      if (s) s.getTracks().forEach((t) => t.stop())
    }
  }, [])

  const handleCapture = () => {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas) return
    const w = video.videoWidth || 640
    const h = video.videoHeight || 480
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.drawImage(video, 0, 0, w, h)
    // Preview rápido
    setCaptured(canvas.toDataURL('image/jpeg', 0.8))
  }

  const handleConfirm = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    canvas.toBlob(
      (blob) => {
        if (blob) onCapture(blob)
      },
      'image/jpeg',
      0.8,
    )
  }

  const handleRetake = () => {
    setCaptured(null)
  }

  const handleFileFallback = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (f) onCapture(f)
  }

  return (
    <Modal zIndex={110} full>
      <div
        className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-lg flex flex-col"
        style={{ borderRadius: '0.5rem' }}
      >
        <div className="flex items-center justify-between px-5 py-3 border-b border-border">
          <div className="flex items-center gap-2">
            <Camera size={14} className="text-primary" />
            <h3
              className="text-base uppercase text-foreground"
              style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800 }}
            >
              Tomar foto
              {label && <span className="ml-2 text-muted-foreground normal-case text-xs">{label}</span>}
            </h3>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X size={16} />
          </button>
        </div>

        <div className="p-4">
          {error ? (
            <div className="flex flex-col items-center justify-center gap-3 py-6">
              <AlertCircle size={28} className="text-primary" />
              <p className="text-sm text-muted-foreground text-center max-w-sm">{error}</p>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs border border-border hover:border-primary/40"
                style={{ borderRadius: '0.25rem' }}
              >
                <Upload size={12} /> Subir foto
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileFallback}
              />
            </div>
          ) : (
            <>
              {/* Preview en vivo o capturada */}
              <div className="relative bg-black rounded-md overflow-hidden" style={{ aspectRatio: '4/3' }}>
                {captured ? (
                  <img
                    src={captured}
                    alt="captura"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover"
                  />
                )}
                <canvas ref={canvasRef} className="hidden" />
              </div>

              {!ready && !error && (
                <p className="text-[11px] text-muted-foreground text-center mt-2">
                  Iniciando cámara…
                </p>
              )}
            </>
          )}
        </div>

        {/* Footer con acciones */}
        {!error && (
          <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-border">
            {captured ? (
              <>
                <button
                  onClick={handleRetake}
                  className="inline-flex items-center gap-1 px-3 py-1.5 text-xs border border-border hover:border-primary/40"
                  style={{ borderRadius: '0.25rem' }}
                >
                  <RefreshCw size={12} /> Repetir
                </button>
                <button
                  onClick={handleConfirm}
                  className="inline-flex items-center gap-1 px-3 py-1.5 text-xs bg-primary text-primary-foreground hover:opacity-90"
                  style={{ borderRadius: '0.25rem' }}
                >
                  <Camera size={12} /> Usar esta foto
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex items-center gap-1 px-3 py-1.5 text-xs border border-border hover:border-primary/40"
                  style={{ borderRadius: '0.25rem' }}
                  title="Elegir una imagen ya guardada"
                >
                  <Upload size={12} /> Subir foto
                </button>
                <button
                  onClick={handleCapture}
                  disabled={!ready}
                  className="inline-flex items-center gap-1 px-3 py-1.5 text-xs bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50"
                  style={{ borderRadius: '0.25rem' }}
                >
                  <Camera size={12} /> Capturar
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleFileFallback}
                />
              </>
            )}
          </div>
        )}
      </div>
    </Modal>
  )
}
