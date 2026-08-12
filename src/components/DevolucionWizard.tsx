import { useEffect, useRef, useState } from 'react'
import {
  X,
  CheckCircle2,
  XCircle,
  Loader2,
  Camera,
  ImageIcon,
  RefreshCcw,
  CameraIcon,
  ArrowRight,
  ArrowLeft,
  Check,
  Undo2,
} from 'lucide-react'
import { uploadsService } from '../store/productos'
import { devolucionesStore, type Devolucion } from '../store/devoluciones'
import { ApiError } from '../lib/api'
import { Modal } from './Modal'

type Step = {
  devolucionItemId: string
  productoNombre: string
  productoCodigo: string
  cantidad: number
}

type WizardRol = 'operador' | 'bodeguero'

type Props = {
  devolucion: Devolucion
  rol: WizardRol
  onClose: () => void
  onResolved: () => void
}

function buildSteps(d: Devolucion, rol: WizardRol): Step[] {
  // Operador: procesa los items en `pendiente` (los que todavía no tomó foto).
  // Bodeguero: procesa los items en `en_transito` (los que el operador ya marcó).
  const estadoObjetivo = rol === 'operador' ? 'pendiente' : 'en_transito'
  return d.items
    .filter((it) => it.estado === estadoObjetivo)
    .map((it) => ({
      devolucionItemId: it.id,
      productoNombre: it.producto.nombre,
      productoCodigo: it.producto.codigo,
      cantidad: Number(it.cantidad),
    }))
}

/**
 * Wizard de devolución.
 *
 * - `rol='operador'`: el técnico toma foto de cada item que devuelve
 *   y luego finaliza. La devolución pasa a `en_transito` y queda lista
 *   para que el bodeguero la reciba.
 * - `rol='bodeguero'`: el bodeguero toma foto de cada item recibido y
 *   luego finaliza. La devolución pasa a `recibida` y el stock se suma
 *   al inventario.
 *
 * Mismo patrón que el wizard de aprobación de pedidos: foto por item
 * o rechazo con motivo.
 */
export function DevolucionWizard({ devolucion, rol, onClose, onResolved }: Props) {
  const [stepIdx, setStepIdx] = useState(0)
  const [photoUrl, setPhotoUrl] = useState<string | null>(null)
  const [photoBlob, setPhotoBlob] = useState<Blob | null>(null)
  const [uploading, setUploading] = useState(false)
  const [finalizing, setFinalizing] = useState(false)
  const [error, setError] = useState('')
  const [cameraOn, setCameraOn] = useState(false)
  const [showReject, setShowReject] = useState(false)
  const [motivoRechazo, setMotivoRechazo] = useState('')
  const [rejecting, setRejecting] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const steps = buildSteps(devolucion, rol)
  const current = steps[stepIdx]
  const isLast = stepIdx === steps.length - 1
  const isFirst = stepIdx === 0

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop())
    }
  }, [])

  async function startCamera() {
    setError('')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
        audio: false,
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }
      setCameraOn(true)
    } catch {
      setError('No se pudo acceder a la cámara. Probá subir un archivo.')
      setCameraOn(false)
    }
  }

  function stopCamera() {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    setCameraOn(false)
  }

  function capture() {
    if (!videoRef.current) return
    const v = videoRef.current
    const canvas = document.createElement('canvas')
    canvas.width = v.videoWidth
    canvas.height = v.videoHeight
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.drawImage(v, 0, 0)
    canvas.toBlob((blob) => {
      if (blob) {
        setPhotoBlob(blob)
        setPhotoUrl(canvas.toDataURL('image/jpeg', 0.85))
      }
      stopCamera()
    }, 'image/jpeg', 0.85)
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setError('El archivo debe ser una imagen.')
      return
    }
    setError('')
    setPhotoBlob(file)
    const reader = new FileReader()
    reader.onload = () => {
      setPhotoUrl(reader.result as string)
    }
    reader.readAsDataURL(file)
  }

  function resetPhoto() {
    setPhotoUrl(null)
    setPhotoBlob(null)
    if (fileRef.current) fileRef.current.value = ''
  }

  async function uploadAndSave(): Promise<boolean> {
    if (!photoBlob) return false
    setUploading(true)
    setError('')
    try {
      const fd = new FormData()
      fd.append('file', photoBlob, `${rol}-${current.devolucionItemId}.jpg`)
      // Sección: 'returns' tanto para el operador como para el bodeguero.
      // Las dos fotos (operador y bodeguero) van a la misma carpeta del tenant.
      const up = await uploadsService.subirBlob(fd, {
        seccion: 'returns',
        bodegaId: devolucion.bodegaId,
      })
      if (rol === 'operador') {
        await devolucionesStore.fotoOperador(
          devolucion.id,
          current.devolucionItemId,
          { url: up.url, key: up.key },
        )
      } else {
        await devolucionesStore.fotoRecibido(
          devolucion.id,
          current.devolucionItemId,
          { url: up.url, key: up.key },
        )
      }
      return true
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'No se pudo subir la foto.'
      setError(msg)
      return false
    } finally {
      setUploading(false)
    }
  }

  async function handleSiguiente() {
    const ok = await uploadAndSave()
    if (!ok) return
    if (isLast) {
      await finalizar()
    } else {
      resetPhoto()
      setStepIdx((i) => i + 1)
    }
  }

  async function handleRechazar() {
    if (!motivoRechazo.trim()) {
      setError('Indicá el motivo del rechazo.')
      return
    }
    setRejecting(true)
    setError('')
    try {
      await devolucionesStore.rechazarItem(
        devolucion.id,
        current.devolucionItemId,
        motivoRechazo.trim(),
      )
      if (isLast) {
        await finalizar()
      } else {
        resetPhoto()
        setMotivoRechazo('')
        setShowReject(false)
        setStepIdx((i) => i + 1)
      }
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'No se pudo rechazar el item.'
      setError(msg)
    } finally {
      setRejecting(false)
    }
  }

  async function finalizar() {
    setFinalizing(true)
    setError('')
    try {
      if (rol === 'operador') {
        await devolucionesStore.finalizarOperador(devolucion.id)
      } else {
        await devolucionesStore.finalizar(devolucion.id)
      }
      onResolved()
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'No se pudo finalizar.'
      setError(msg)
    } finally {
      setFinalizing(false)
    }
  }

  if (!current) {
    return (
      <Modal
        open
        onClose={onClose}
        title="Sin items pendientes"
        description={devolucion.codigo}
        icon={<Undo2 size={16} className="text-primary" />}
        size="sm"
        footer={
          <div className="flex justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-3 min-h-[44px] py-2.5 border border-border text-sm"
              style={{ borderRadius: '0.25rem' }}
            >
              Cerrar
            </button>
          </div>
        }
      >
        <p className="p-5 text-foreground">
          No hay items pendientes para procesar.
        </p>
      </Modal>
    )
  }

  const rolLabel = rol === 'operador' ? 'Operador' : 'Bodega'
  const wizardTitle = rol === 'operador' ? 'Enviar devolución' : 'Recibir devolución'
  const wizardSubtitle =
    rol === 'operador'
      ? 'Foto de cada item antes de enviar al bodeguero'
      : 'Foto de cada item recibido del operador'

  return (
    <Modal
      open
      onClose={onClose}
      title={wizardTitle}
      description={`${devolucion.codigo} · ${rolLabel}`}
      icon={<Camera size={16} className="text-primary" />}
      size="lg"
      footer={
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setStepIdx((i) => Math.max(0, i - 1))}
            disabled={isFirst || uploading || finalizing || rejecting}
            className="inline-flex items-center gap-1 min-h-[44px] px-3 py-2.5 border border-border text-sm hover:border-foreground/30 disabled:opacity-30 disabled:cursor-not-allowed"
            style={{ borderRadius: '0.25rem' }}
          >
            <ArrowLeft size={14} /> Anterior
          </button>

          {/* Rechazo solo para bodeguero (operador no rechaza sus propios items) */}
          {rol === 'bodeguero' && !showReject && (
            <button
              type="button"
              onClick={() => setShowReject(true)}
              disabled={uploading || finalizing || rejecting}
              className="inline-flex items-center gap-1 min-h-[44px] px-3 py-2.5 border border-border bg-muted text-foreground text-sm hover:border-primary/40 hover:text-primary disabled:opacity-50"
              style={{ borderRadius: '0.25rem' }}
              title="Rechazar este producto"
            >
              <XCircle size={14} /> Rechazar
            </button>
          )}

          <div className="flex-1" />

          <button
            type="button"
            onClick={handleSiguiente}
            disabled={!photoUrl || uploading || finalizing || rejecting}
            className="inline-flex items-center gap-2 min-h-[44px] px-4 py-2.5 bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ borderRadius: '0.25rem' }}
          >
            {uploading ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                Subiendo…
              </>
            ) : finalizing ? (
              <>
                <Loader2 size={14} className="animate-spin" /> Finalizando…
              </>
            ) : (
              <>
                <CheckCircle2 size={14} />
                {isLast ? 'Finalizar' : 'Siguiente'} <ArrowRight size={14} />
              </>
            )}
          </button>
        </div>
      }
    >
      <div className="p-5 space-y-4">
        <p
          className="text-xs text-muted-foreground -mt-1"
          style={{ fontFamily: "'DM Sans', sans-serif" }}
        >
          {wizardSubtitle}
        </p>

        {/* Stepper */}
        <div className="-mx-1">
          <div className="flex items-center justify-between mb-2">
            {steps.map((_it, idx) => {
              const done = idx < stepIdx
              const currentIdx = idx === stepIdx
              return (
                <div key={idx} className="flex-1 flex items-center">
                  <div className="flex flex-col items-center">
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold border-2 ${
                        done
                          ? 'bg-primary border-primary text-primary-foreground'
                          : currentIdx
                            ? 'bg-primary/15 border-primary text-primary'
                            : 'bg-muted border-border text-muted-foreground'
                      }`}
                      style={{ fontFamily: "'JetBrains Mono', monospace" }}
                    >
                      {done ? <Check size={14} /> : String(idx + 1).padStart(2, '0')}
                    </div>
                  </div>
                  {idx < steps.length - 1 && (
                    <div
                      className={`flex-1 h-0.5 mx-1 ${done ? 'bg-primary' : 'bg-border'}`}
                    />
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* Body */}
        <div
          className="bg-muted/40 border border-border p-3"
          style={{ borderRadius: '0.25rem' }}
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <div
                className="text-[10px] text-muted-foreground tracking-widest uppercase"
                style={{ fontFamily: "'JetBrains Mono', monospace" }}
              >
                {rol === 'operador' ? 'Item a devolver' : 'Item recibido'}
              </div>
              <div
                className="text-lg text-foreground mt-0.5"
                style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800 }}
              >
                {current.productoNombre}
              </div>
              <div
                className="text-[10px] text-muted-foreground"
                style={{ fontFamily: "'JetBrains Mono', monospace" }}
              >
                SKU {current.productoCodigo}
              </div>
            </div>
            <div className="text-right">
              <div
                className="text-[10px] text-muted-foreground tracking-widest uppercase"
                style={{ fontFamily: "'JetBrains Mono', monospace" }}
              >
                Cantidad
              </div>
              <div
                className="text-xl text-primary"
                style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 700 }}
              >
                ×{current.cantidad}
              </div>
            </div>
          </div>
        </div>

        {/* Cámara / preview */}
        {cameraOn ? (
          <div
            className="relative w-full aspect-video bg-muted border border-border overflow-hidden flex items-center justify-center"
            style={{ borderRadius: '0.25rem' }}
          >
            <video
              ref={videoRef}
              className="w-full h-full object-cover"
              playsInline
              muted
            />
          </div>
        ) : photoUrl ? (
          <div
            className="w-full flex items-center gap-2 py-2.5 px-3 border border-secondary/40 bg-secondary/5 text-secondary"
            style={{ borderRadius: '0.25rem', fontFamily: "'JetBrains Mono', monospace" }}
          >
            <CheckCircle2 size={16} className="shrink-0" />
            <span className="text-xs font-medium">Imagen subida</span>
          </div>
        ) : (
          <div
            className="w-full flex items-center gap-2 py-2.5 px-3 border border-border bg-muted text-muted-foreground"
            style={{ borderRadius: '0.25rem', fontFamily: "'JetBrains Mono', monospace" }}
          >
            <ImageIcon size={16} className="shrink-0" />
            <span className="text-xs font-medium">Sin imagen</span>
          </div>
        )}

        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleFile}
          className="hidden"
        />
        <div className="flex flex-wrap items-center gap-2">
          {!cameraOn && !photoUrl && (
            <>
              <button
                type="button"
                onClick={startCamera}
                className="inline-flex items-center gap-2 min-h-[44px] px-3 py-2 border border-border text-sm hover:border-foreground/30"
                style={{ borderRadius: '0.25rem' }}
              >
                <CameraIcon size={14} /> Abrir cámara
              </button>
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="inline-flex items-center gap-2 min-h-[44px] px-3 py-2 border border-border text-sm hover:border-foreground/30"
                style={{ borderRadius: '0.25rem' }}
              >
                <Camera size={14} /> Subir foto
              </button>
            </>
          )}
          {cameraOn && (
            <>
              <button
                type="button"
                onClick={capture}
                className="inline-flex items-center gap-2 min-h-[44px] px-3 py-2 bg-primary text-primary-foreground text-sm"
                style={{ borderRadius: '0.25rem' }}
              >
                <Camera size={14} /> Capturar
              </button>
              <button
                type="button"
                onClick={stopCamera}
                className="inline-flex items-center gap-2 min-h-[44px] px-3 py-2 border border-border text-sm"
                style={{ borderRadius: '0.25rem' }}
              >
                <X size={14} /> Cancelar cámara
              </button>
            </>
          )}
          {photoUrl && !cameraOn && (
            <button
              type="button"
              onClick={resetPhoto}
              className="inline-flex items-center gap-2 min-h-[44px] px-3 py-2 border border-border text-sm"
              style={{ borderRadius: '0.25rem' }}
            >
              <RefreshCcw size={14} /> Tomar otra
            </button>
          )}
        </div>

        {/* Rechazo (con motivo) - solo bodeguero */}
        {showReject && (
          <div
            className="bg-muted border border-border p-3 space-y-2"
            style={{ borderRadius: '0.25rem' }}
          >
            <label
              className="text-[10px] text-muted-foreground tracking-widest uppercase"
              style={{ fontFamily: "'JetBrains Mono', monospace" }}
            >
              Motivo del rechazo
            </label>
            <textarea
              value={motivoRechazo}
              onChange={(e) => setMotivoRechazo(e.target.value)}
              rows={2}
              placeholder="Ej: producto dañado, no coincide con la solicitud…"
              className="w-full min-h-[44px] px-3 py-2 bg-card border border-border text-sm outline-none focus:border-primary/60 resize-none"
              style={{ borderRadius: '0.25rem', fontFamily: "'DM Sans', sans-serif" }}
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowReject(false)
                  setMotivoRechazo('')
                }}
                className="min-h-[44px] px-3 py-1.5 border border-border text-xs"
                style={{ borderRadius: '0.25rem' }}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleRechazar}
                disabled={rejecting}
                className="inline-flex items-center gap-1 min-h-[44px] px-3 py-1.5 bg-primary text-primary-foreground text-xs font-semibold disabled:opacity-60"
                style={{ borderRadius: '0.25rem' }}
              >
                {rejecting ? <Loader2 size={12} className="animate-spin" /> : null}
                Confirmar rechazo
              </button>
            </div>
          </div>
        )}

        {error && (
          <p
            className="text-xs text-primary bg-primary/10 border border-primary/20 px-3 py-2"
            style={{ fontFamily: "'JetBrains Mono', monospace", borderRadius: '0.25rem' }}
          >
            ⚠ {error}
          </p>
        )}
      </div>
    </Modal>
  )
}
