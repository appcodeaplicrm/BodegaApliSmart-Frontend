import { useEffect, useMemo, useRef, useState } from 'react'
import { Camera, Clock3, FileCheck2, Loader2, MapPin, Plus, Trash2 } from 'lucide-react'
import { Modal } from './Modal'
import {
  pedidosStore,
  type EstadoReporteUso,
  type Pedido,
} from '../store/pedidos'
import { uploadsService } from '../store/productos'
import { useAuth } from '../store/auth'
import { imageUrl } from '../lib/apiBase'
import { MapaReporteUso, type PuntoReporteUso } from './MapaReporteUso'
import { useCapturaEvidencia } from '../hooks/useCapturaEvidencia'

type Geo = { latitud: number; longitud: number; precisionMetros: number }
type FotoPendiente = Geo & {
  id: string
  file: File
  preview: string
  capturadaAt: string
}
type SerialPendiente = {
  id: string
  entregaItemId: string
  productoId: string
  productoNombre: string
  serial: string
}

export function ReporteUsoModal({
  pedido,
  onClose,
  onCreated,
}: {
  pedido: Pedido
  onClose: () => void
  onCreated?: () => void
}) {
  const evidencia = useCapturaEvidencia()
  const auth = useAuth()
  const inputRef = useRef<HTMLInputElement | null>(null)
  const uploadInputRef = useRef<HTMLInputElement | null>(null)
  const [estado, setEstado] = useState<EstadoReporteUso | null>(null)
  const [descripcion, setDescripcion] = useState('')
  const [fotos, setFotos] = useState<FotoPendiente[]>([])
  const [seriales, setSeriales] = useState<SerialPendiente[]>([])
  const [cargando, setCargando] = useState(true)
  const [procesandoFoto, setProcesandoFoto] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const tecnicoNombre = auth.status === 'autenticado' ? auth.sesion.usuario.nombre : 'Técnico'
  const entregados = useMemo(() => pedido.items
    .flatMap((item) => item.entregaItems ?? [])
    .filter((item) => item.estado === 'en_tecnico'), [pedido.items])

  useEffect(() => {
    let mounted = true
    pedidosStore.obtenerReporteUso(pedido.id)
      .then((data) => { if (mounted) setEstado(data) })
      .catch((cause) => { if (mounted) setError(cause instanceof Error ? cause.message : 'No se pudo consultar el reporte.') })
      .finally(() => { if (mounted) setCargando(false) })
    return () => {
      mounted = false
      fotos.forEach((foto) => URL.revokeObjectURL(foto.preview))
    }
    // Las previews se liberan también al eliminar cada foto.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pedido.id])

  async function seleccionarFotos(files: FileList | null) {
    if (!files?.length) return
    setProcesandoFoto(true)
    setError(null)
    try {
      const geo = await obtenerUbicacion()
      const nuevas: FotoPendiente[] = []
      for (const original of Array.from(files).slice(0, Math.max(0, 20 - fotos.length))) {
        const capturadaAt = new Date().toISOString()
        const file = await sellarFoto(original, {
          tecnico: tecnicoNombre,
          codigo: pedido.codigo,
          capturadaAt,
          ...geo,
        })
        nuevas.push({
          id: crypto.randomUUID(),
          file,
          preview: URL.createObjectURL(file),
          capturadaAt,
          ...geo,
        })
      }
      setFotos((actuales) => [...actuales, ...nuevas])
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo preparar la fotografía.')
    } finally {
      setProcesandoFoto(false)
      if (inputRef.current) inputRef.current.value = ''
      if (uploadInputRef.current) uploadInputRef.current.value = ''
    }
  }

  function agregarSerial(entregaItemId: string) {
    const item = entregados.find((row) => row.id === entregaItemId)
    if (!item) return
    const existentes = seriales.filter((row) => row.entregaItemId === entregaItemId).length
    if (existentes >= Math.floor(Number(item.cantidad))) return
    setSeriales((actuales) => [...actuales, {
      id: crypto.randomUUID(),
      entregaItemId: item.id,
      productoId: item.productoId,
      productoNombre: item.producto.nombre,
      serial: '',
    }])
  }

  async function enviar() {
    if (!estado?.puedeSubir || guardando) return
    if (descripcion.trim().length < 10) {
      setError('Explica con un poco más de detalle dónde se utilizaron los recursos.')
      return
    }
    if (fotos.length === 0) {
      setError('Debes agregar al menos una fotografía con ubicación.')
      return
    }
    if (seriales.some((item) => !item.serial.trim())) {
      setError('Completa o elimina los campos de serial que estén vacíos.')
      return
    }
    setGuardando(true)
    setError(null)
    try {
      const evidencias = []
      for (const foto of fotos) {
        const form = new FormData()
        form.append('file', foto.file, foto.file.name)
        const uploaded = await uploadsService.subirBlob(form, {
          seccion: 'dispatches',
          bodegaId: pedido.bodegaId,
        })
        evidencias.push({
          fotoKey: uploaded.key,
          mimeType: uploaded.mimeType,
          latitud: foto.latitud,
          longitud: foto.longitud,
          precisionMetros: foto.precisionMetros,
          capturadaAt: foto.capturadaAt,
        })
      }
      const ubicacion = fotos[0]
      await pedidosStore.crearReporteUso(pedido.id, {
        descripcion: descripcion.trim(),
        evidencias,
        seriales: seriales.map((item) => ({
          entregaItemId: item.entregaItemId,
          productoId: item.productoId,
          serial: item.serial.trim(),
          latitud: ubicacion.latitud,
          longitud: ubicacion.longitud,
        })),
      })
      onCreated?.()
      onClose()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo enviar el reporte.')
    } finally {
      setGuardando(false)
    }
  }

  const reporte = estado?.reporte
  return (
    <Modal
      open
      onClose={onClose}
      title={reporte ? 'Reporte de uso' : 'Subir reporte'}
      description={`${pedido.codigo} · ${tecnicoNombre}`}
      icon={<FileCheck2 size={17} className="text-primary" />}
      size="xl"
      dismissOnOverlay={!guardando}
      footer={!reporte && !cargando ? (
        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
          <button type="button" onClick={onClose} disabled={guardando} className="min-h-[44px] px-4 border border-border text-sm">Cancelar</button>
          <button type="button" onClick={enviar} disabled={!estado?.puedeSubir || guardando || procesandoFoto} className="min-h-[44px] px-5 bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-50 inline-flex items-center justify-center gap-2">
            {guardando && <Loader2 size={15} className="animate-spin" />}
            Enviar reporte
          </button>
        </div>
      ) : undefined}
    >
      {cargando ? (
        <div className="p-8 flex justify-center"><Loader2 className="animate-spin text-primary" /></div>
      ) : reporte ? (
        <ReporteEnviado reporte={reporte} />
      ) : (
        <div className="p-4 sm:p-6 space-y-6">
          <div className={`border p-4 ${estado?.vencido ? 'border-destructive/50 bg-destructive/5' : 'border-primary/30 bg-primary/5'}`}>
            <div className="flex items-center gap-2 text-sm font-semibold"><Clock3 size={16} /> {estado?.vencido ? 'Plazo vencido' : 'Disponible hasta medianoche'}</div>
            <p className="mt-1 text-xs text-muted-foreground">Límite: {formatFecha(estado!.fechaLimite)} · Hora de Ecuador</p>
          </div>

          <label className="block">
            <span className="label-tech">¿Dónde y cómo se utilizaron los recursos?</span>
            <textarea
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              disabled={!estado?.puedeSubir}
              rows={5}
              maxLength={4000}
              placeholder="Describe el lugar, la actividad realizada y cualquier novedad relevante…"
              className="mt-2 w-full bg-[#242424] border border-[#454545] p-4 text-sm text-foreground placeholder:text-muted-foreground/60 resize-y outline-none transition-colors hover:border-[#565656] focus:border-primary focus:ring-1 focus:ring-primary/20 disabled:bg-muted/20 disabled:text-muted-foreground disabled:cursor-not-allowed"
              style={{ borderRadius: '0.25rem' }}
            />
          </label>

          <section>
            <div className="flex items-end justify-between gap-3 mb-3">
              <div><div className="label-tech">Evidencia fotográfica</div><p className="text-xs text-muted-foreground mt-1">Cada foto incluirá técnico, fecha, ubicación y solicitud.</p></div>
              <div className="flex gap-2">
                <button type="button" disabled={!estado?.puedeSubir || procesandoFoto || fotos.length >= 20} onClick={() => inputRef.current?.click()} className="min-h-[44px] px-3 border border-primary/40 text-primary text-xs inline-flex items-center gap-2 disabled:opacity-50">
                  {procesandoFoto ? <Loader2 size={15} className="animate-spin" /> : <Camera size={15} />} Tomar foto
                </button>
                {evidencia.puedeSubir && <button type="button" disabled={!estado?.puedeSubir || procesandoFoto || fotos.length >= 20} onClick={() => uploadInputRef.current?.click()} className="min-h-[44px] px-3 border border-border text-foreground text-xs inline-flex items-center gap-2 disabled:opacity-50">
                  Subir foto
                </button>}
              </div>
              <input ref={inputRef} type="file" accept="image/*" capture={evidencia.capture} multiple className="hidden" onChange={(e) => void seleccionarFotos(e.target.files)} />
              {evidencia.puedeSubir && <input ref={uploadInputRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => void seleccionarFotos(e.target.files)} />}
            </div>
            {fotos.length === 0 ? <div className="border border-dashed border-border p-8 text-center text-sm text-muted-foreground">Todavía no agregaste fotografías.</div> : (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">{fotos.map((foto) => <div key={foto.id} className="relative border border-border bg-muted"><img src={foto.preview} alt="Evidencia" className="w-full aspect-[4/3] object-cover" /><button type="button" onClick={() => { URL.revokeObjectURL(foto.preview); setFotos((rows) => rows.filter((row) => row.id !== foto.id)) }} className="absolute top-2 right-2 w-9 h-9 bg-background/90 text-destructive flex items-center justify-center"><Trash2 size={15} /></button><div className="p-2 text-[10px] text-muted-foreground flex items-center gap-1"><MapPin size={11} />{foto.latitud.toFixed(5)}, {foto.longitud.toFixed(5)}</div></div>)}</div>
            )}
          </section>

          <section className="space-y-3">
            <div><div className="label-tech">¿Este producto tiene serial?</div><p className="text-xs text-muted-foreground mt-1">Es opcional. Agrega uno por cada unidad serializada.</p></div>
            {entregados.map((item) => {
              const rows = seriales.filter((serial) => serial.entregaItemId === item.id)
              return <div key={item.id} className="border border-border p-3 sm:p-4"><div className="flex items-center justify-between gap-3"><div><div className="text-sm font-semibold">{item.producto.nombre}</div><div className="text-xs text-muted-foreground">{Number(item.cantidad)} unidad(es) entregadas</div></div><button type="button" disabled={!estado?.puedeSubir || rows.length >= Math.floor(Number(item.cantidad))} onClick={() => agregarSerial(item.id)} className="min-h-[40px] px-3 border border-border text-xs inline-flex items-center gap-1 disabled:opacity-40"><Plus size={13} /> Serial</button></div>{rows.length > 0 && <div className="mt-3 space-y-2">{rows.map((row, index) => <div key={row.id} className="flex gap-2"><input value={row.serial} onChange={(e) => setSeriales((actuales) => actuales.map((serial) => serial.id === row.id ? { ...serial, serial: e.target.value } : serial))} placeholder={`Serial ${index + 1}`} maxLength={150} className="flex-1 min-w-0 bg-[#242424] border border-[#454545] px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/60 outline-none transition-colors hover:border-[#565656] focus:border-primary focus:ring-1 focus:ring-primary/20" /><button type="button" aria-label="Eliminar serial" onClick={() => setSeriales((actuales) => actuales.filter((serial) => serial.id !== row.id))} className="w-10 border border-border text-destructive flex items-center justify-center"><Trash2 size={14} /></button></div>)}</div>}</div>
            })}
          </section>
          {error && <div className="border border-destructive/50 bg-destructive/5 p-3 text-sm text-destructive">{error}</div>}
        </div>
      )}
    </Modal>
  )
}

function ReporteEnviado({ reporte }: { reporte: NonNullable<EstadoReporteUso['reporte']> }) {
  const puntos: PuntoReporteUso[] = reporte.seriales
    .filter((item) => item.latitud != null && item.longitud != null)
    .map((item) => ({
      id: item.id,
      latitud: Number(item.latitud),
      longitud: Number(item.longitud),
      titulo: item.producto.nombre,
      detalle: `Serial: ${item.serial}`,
    }))
  if (puntos.length === 0) {
    puntos.push(...reporte.evidencias.map((foto, index) => ({
      id: foto.id,
      latitud: Number(foto.latitud),
      longitud: Number(foto.longitud),
      titulo: `Evidencia ${index + 1}`,
      detalle: formatFecha(foto.capturadaAt),
    })))
  }

  return (
    <div className="p-4 sm:p-5">
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.35fr)] gap-5 items-start">
        <div className="space-y-4 min-w-0">
          <div className="border border-primary/30 bg-primary/5 p-3">
            <div className="text-sm font-semibold text-primary">Reporte presentado</div>
            <div className="text-xs text-muted-foreground mt-1">{reporte.tecnico.nombre} · {formatFecha(reporte.enviadoAt)}</div>
          </div>

          <div className="border border-border bg-[#292929] p-3">
            <div className="label-tech">Detalle de uso</div>
            <p className="mt-2 text-sm leading-relaxed whitespace-pre-wrap text-foreground/90">{reporte.descripcion}</p>
          </div>

          {reporte.seriales.length > 0 && (
            <div>
              <div className="label-tech mb-2">Activos serializados</div>
              <div className="divide-y divide-border border border-border">
                {reporte.seriales.map((item) => (
                  <div key={item.id} className="p-2.5 flex justify-between gap-3 text-sm bg-[#292929]">
                    <span className="truncate">{item.producto.nombre}</span>
                    <span className="font-mono text-primary shrink-0">{item.serial}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div>
            <div className="label-tech mb-2">Evidencias · {reporte.evidencias.length}</div>
            <div className="grid grid-cols-2 gap-2">
              {reporte.evidencias.map((foto) => (
                <a key={foto.id} href={imageUrl(foto.imageUrl) ?? '#'} target="_blank" rel="noreferrer" className="group border border-border block bg-[#292929] overflow-hidden">
                  <img src={imageUrl(foto.imageUrl) ?? ''} alt="Evidencia del reporte" className="w-full aspect-[4/3] object-cover group-hover:scale-[1.02] transition-transform" />
                  <div className="p-2 text-[10px] text-muted-foreground truncate">{formatFecha(foto.capturadaAt)}</div>
                </a>
              ))}
            </div>
          </div>
        </div>

        <div className="min-w-0 lg:sticky lg:top-0">
          <div className="flex items-center justify-between gap-3 mb-2">
            <div className="label-tech">Ubicación de los recursos</div>
            <span className="text-[10px] text-muted-foreground">{puntos.length} punto(s)</span>
          </div>
          <MapaReporteUso puntos={puntos} />
          <p className="mt-2 text-[10px] text-muted-foreground">Selecciona un punto para ver el producto, serial y coordenadas registradas.</p>
        </div>
      </div>
    </div>
  )
}

function obtenerUbicacion(): Promise<Geo> {
  if (!navigator.geolocation) return Promise.reject(new Error('Este dispositivo no permite obtener ubicación.'))
  return new Promise((resolve, reject) => navigator.geolocation.getCurrentPosition(
    (position) => resolve({ latitud: position.coords.latitude, longitud: position.coords.longitude, precisionMetros: position.coords.accuracy }),
    () => reject(new Error('Activa el permiso de ubicación para agregar evidencia.')),
    { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
  ))
}

async function sellarFoto(file: File, data: Geo & { tecnico: string; codigo: string; capturadaAt: string }): Promise<File> {
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, 1920 / Math.max(bitmap.width, bitmap.height))
  const width = Math.round(bitmap.width * scale)
  const height = Math.round(bitmap.height * scale)
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(bitmap, 0, 0, width, height)
  bitmap.close()
  const fontSize = Math.max(18, Math.round(width * 0.022))
  const padding = Math.round(fontSize * 0.75)
  const lines = [data.tecnico, `${data.codigo} · ${formatFecha(data.capturadaAt)}`, `${data.latitud.toFixed(6)}, ${data.longitud.toFixed(6)} · ±${Math.round(data.precisionMetros)} m`]
  const boxHeight = padding * 2 + lines.length * fontSize * 1.35
  const gradient = ctx.createLinearGradient(0, height - boxHeight * 1.7, 0, height)
  gradient.addColorStop(0, 'rgba(0,0,0,0)')
  gradient.addColorStop(1, 'rgba(0,0,0,.88)')
  ctx.fillStyle = gradient
  ctx.fillRect(0, height - boxHeight * 1.7, width, boxHeight * 1.7)
  ctx.fillStyle = '#fff'
  ctx.textBaseline = 'top'
  lines.forEach((line, index) => {
    ctx.font = `${index === 0 ? 700 : 500} ${fontSize}px system-ui, sans-serif`
    ctx.fillText(line, padding, height - boxHeight + padding + index * fontSize * 1.35)
  })
  const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((result) => result ? resolve(result) : reject(new Error('No se pudo procesar la imagen.')), 'image/jpeg', .88))
  return new File([blob], `evidencia-${Date.now()}.jpg`, { type: 'image/jpeg' })
}

function formatFecha(value: string) {
  return new Date(value).toLocaleString('es-EC', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'America/Guayaquil' })
}
