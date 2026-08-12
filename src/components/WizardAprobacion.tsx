import { useEffect, useRef, useState, type FormEvent } from 'react'
import {
  X,
  Camera,
  CheckCircle2,
  ImageIcon,
  RefreshCcw,
  Loader2,
  CameraIcon,
  ArrowRight,
  ArrowLeft,
  Check,
  Inbox,
} from 'lucide-react'
import type { PedidoListItem, EntregaItem } from '../store/pedidos'
import { api, ApiError } from '../lib/api'
import { uploadsService } from '../store/productos'
import { Modal } from './Modal'

type Props = {
  pedido: PedidoListItem
  /** 'bodega' = bodeguero procesa; 'tecnico' = técnico procesa */
  rol: 'bodega' | 'tecnico'
  /** Items del pedido con sus EntregaItem (los que necesitan acción del rol). */
  items: Array<{
    detalleId: string
    entregaItemId: string
    productoNombre: string
    productoCodigo: string
    cantidad: number
    /** Si el item es parte de un kit, el nombre del kit. */
    kitNombre?: string
  }>
  onClose: () => void
  onResolved: () => void
}

/**
 * Wizard de aprobación de un pedido.
 *
 * Para CADA producto concreto del pedido (los EntregaItem), el usuario
 * debe tomar una foto de evidencia con la cámara o subir un archivo.
 * No hay opción de "Saltar" — el stock se valida en el back al crear
 * la solicitud, así que cuando llega al wizard ya está garantizado
 * que hay stock para todos los productos. (Más adelante, con sockets,
 * el back rechazará en tiempo real las solicitudes a productos que
 * otros técnicos ya se llevaron.)
 *
 * Solo puede pasar al siguiente step después de completar el actual.
 * Al terminar todos los steps, se finaliza el wizard y el pedido pasa
 * de estado (AprobadoPorBodega → Entregado, pasando por el técnico).
 */
export function WizardAprobacion({ pedido, rol, items, onClose, onResolved }: Props) {
  const [stepIdx, setStepIdx] = useState(0)
  const [photoUrl, setPhotoUrl] = useState<string | null>(null)
  const [photoBlob, setPhotoBlob] = useState<Blob | null>(null)
  const [uploading, setUploading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [finalizing, setFinalizing] = useState(false)
  const [error, setError] = useState('')
  const [cameraOn, setCameraOn] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const current = items[stepIdx]
  const isLast = stepIdx === items.length - 1
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
      fd.append('file', photoBlob, `evidencia-${current.entregaItemId}.jpg`)
      // Sección: 'dispatches' para el bodeguero, 'returns' para el técnico
      // (más natural que 'dispatches' para los dos). Mantengo 'dispatches'
      // para los dos por ahora y vemos si lo separamos.
      const seccion = 'dispatches'
      const up = await uploadsService.subirBlob(fd, {
        seccion,
        bodegaId: pedido.bodegaId,
      })
      // Guardamos la URL + key en el EntregaItem via el endpoint del wizard
      const path = rol === 'bodega' ? '/foto-bodeguero' : '/foto-tecnico'
      await api.patch(`/pedidos/${encodeURIComponent(pedido.id)}${path}`, {
        entregaItemId: current.entregaItemId,
        fotoUrl: up.url,
        fotoKey: up.key,
      })
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

  async function handleTakePhoto(e: FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    const ok = await uploadAndSave()
    setSubmitting(false)
    if (ok) {
      // Avanzamos al siguiente step (o finalizamos si es el último)
      if (isLast) {
        await finalizarWizard()
      } else {
        resetPhoto()
        setStepIdx((i) => i + 1)
      }
    }
  }

  async function finalizarWizard() {
    setFinalizing(true)
    setError('')
    try {
      const path = rol === 'bodega' ? '/finalizar-bodega' : '/finalizar-tecnico'
      await api.patch(`/pedidos/${encodeURIComponent(pedido.id)}${path}`, {})
      onResolved()
      onClose()
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'No se pudo finalizar el wizard.'
      setError(msg)
    } finally {
      setFinalizing(false)
    }
  }

  async function goBack() {
    if (isFirst) return
    resetPhoto()
    setError('')
    setStepIdx((i) => i - 1)
  }

  // ─── Render ────────────────────────────────────────────
  if (!current) {
    return (
      <Modal
        open
        onClose={onClose}
        title="Sin items para procesar"
        description={pedido.codigo}
        icon={<Inbox size={16} className="text-primary" />}
        size="sm"
      >
        <p className="p-5 text-foreground">No hay items para procesar.</p>
      </Modal>
    )
  }

  const rolLabel = rol === 'bodega' ? 'Bodega' : 'Técnico'

  return (
    <Modal
      open
      onClose={onClose}
      title="Wizard de aprobación"
      description={`${pedido.codigo} · ${rolLabel}`}
      icon={<Camera size={16} className="text-primary" />}
      size="lg"
      footer={
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={goBack}
            disabled={isFirst || submitting || finalizing}
            className="inline-flex items-center gap-1 min-h-[44px] px-3 py-2.5 border border-border text-sm hover:border-foreground/30 disabled:opacity-30 disabled:cursor-not-allowed"
            style={{ borderRadius: '0.25rem' }}
          >
            <ArrowLeft size={14} /> Anterior
          </button>

          <div className="flex-1" />

          <button
            type="button"
            onClick={handleTakePhoto}
            disabled={!photoUrl || submitting || uploading || finalizing}
            className="inline-flex items-center gap-2 min-h-[44px] px-4 py-2.5 bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ borderRadius: '0.25rem' }}
          >
            {submitting || uploading ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                {uploading ? 'Subiendo…' : 'Guardando…'}
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
          Foto por producto o saltear si no hay stock
        </p>

        {/* Stepper / progress bar (como en la captura) */}
        <div className="-mx-1">
          <div className="flex items-center justify-between mb-2">
            {items.map((_it, idx) => {
              const done = idx < stepIdx
              const isCurrent = idx === stepIdx
              return (
                <div key={idx} className="flex-1 flex items-center">
                  <div className="flex flex-col items-center">
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold border-2 ${
                        done
                          ? 'bg-primary border-primary text-primary-foreground'
                          : isCurrent
                            ? 'bg-primary/15 border-primary text-primary'
                            : 'bg-muted border-border text-muted-foreground'
                      }`}
                      style={{ fontFamily: "'JetBrains Mono', monospace" }}
                    >
                      {done ? <Check size={14} /> : String(idx + 1).padStart(2, '0')}
                    </div>
                    <div
                      className={`mt-1 text-[10px] tracking-widest uppercase ${
                        done || isCurrent ? 'text-foreground' : 'text-muted-foreground'
                      }`}
                      style={{ fontFamily: "'JetBrains Mono', monospace" }}
                    >
                      {done ? 'Listo' : isCurrent ? 'Actual' : 'Pendiente'}
                    </div>
                  </div>
                  {idx < items.length - 1 && (
                    <div
                      className={`flex-1 h-0.5 mx-1 ${
                        done ? 'bg-primary' : 'bg-border'
                      }`}
                    />
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* Body: el step actual */}
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
                {current.kitNombre ? `Parte de: ${current.kitNombre}` : 'Producto'}
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
        <div>
          <label
            className="text-xs text-muted-foreground tracking-widest uppercase mb-1.5 block"
            style={{ fontFamily: "'JetBrains Mono', monospace" }}
          >
            Foto de evidencia {rolLabel}
          </label>
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
          ) : (
            <div
              className={`w-full flex items-center gap-2 py-2.5 px-3 border ${
                photoUrl
                  ? 'border-secondary/40 bg-secondary/5 text-secondary'
                  : 'border-border bg-muted text-muted-foreground'
              }`}
              style={{ borderRadius: '0.25rem', fontFamily: "'JetBrains Mono', monospace" }}
            >
              {photoUrl ? (
                <CheckCircle2 size={16} className="shrink-0" />
              ) : (
                <ImageIcon size={16} className="shrink-0" />
              )}
              <span className="text-xs font-medium">
                {photoUrl ? 'Imagen subida' : 'Sin imagen'}
              </span>
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
          <div className="flex flex-wrap items-center gap-2 mt-2">
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
        </div>

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

// Helper: arma la lista de "pasos" a partir de un pedido con detalle
// completo (no solo el PedidoListItem resumido). El padre hace el findOne
// y nos pasa los EntregaItem ya armados.
export function itemsParaWizard(
  pedidoDetalle: {
    items: Array<{
      entregaItems?: EntregaItem[]
      producto?: { id: string; codigo: string; nombre: string } | null
      kit?: {
        codigo: string
        nombre: string
        items: Array<{ cantidad: number; producto: { id: string; codigo: string; nombre: string } }>
      } | null
    }>
  },
  rol: 'bodega' | 'tecnico',
): Array<{
  detalleId: string
  entregaItemId: string
  productoNombre: string
  productoCodigo: string
  cantidad: number
  kitNombre?: string
}> {
  type Step = {
    detalleId: string
    entregaItemId: string
    productoNombre: string
    productoCodigo: string
    cantidad: number
    kitNombre?: string
  }
  const steps: Step[] = []
  for (const it of pedidoDetalle.items) {
    if (!it.entregaItems || it.entregaItems.length === 0) continue
    if (it.producto) {
      // Producto suelto: 1 EntregaItem
      const ei = it.entregaItems[0]
      // Para bodega: solo los que están en 'pendiente' (aún no procesados)
      // Para técnico: solo los que están en 'en_bodega' (bodeguero ya los procesó)
      if (rol === 'bodega' && ei.estado !== 'pendiente') continue
      if (rol === 'tecnico' && ei.estado !== 'en_bodega') continue
      steps.push({
        detalleId: it.entregaItems[0].detalleId,
        entregaItemId: ei.id,
        productoNombre: it.producto.nombre,
        productoCodigo: it.producto.codigo,
        cantidad: Number(ei.cantidad),
      })
    } else if (it.kit) {
      // Kit: N EntregaItem, uno por producto del kit
      for (const ei of it.entregaItems) {
        if (rol === 'bodega' && ei.estado !== 'pendiente') continue
        if (rol === 'tecnico' && ei.estado !== 'en_bodega') continue
        steps.push({
          detalleId: ei.detalleId,
          entregaItemId: ei.id,
          productoNombre: ei.producto.nombre,
          productoCodigo: ei.producto.codigo,
          cantidad: Number(ei.cantidad),
          kitNombre: it.kit.nombre,
        })
      }
    }
  }
  return steps
}
