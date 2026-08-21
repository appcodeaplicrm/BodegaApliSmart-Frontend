import { useState, useRef, type FormEvent } from 'react'
import {
  LogOut,
  Camera,
  ImageIcon,
} from 'lucide-react'
import { Modal } from './Modal'
import { useCapturaEvidencia } from '../hooks/useCapturaEvidencia'

export type Salida = {
  id: string
  producto: string
  cantidad: number
  tecnico: string
  motivo: string
  foto: string | null
  fecha: string
}

type SalidaModalProps = {
  onClose: () => void
  onSubmit: (salida: Salida) => void
}

const productos = [
  { value: '', label: 'Seleccionar producto…' },
  { value: 'p1', label: 'Botellón 20L' },
  { value: 'p2', label: 'Caja de botellas 750ml' },
  { value: 'p3', label: 'Tapas metálicas' },
  { value: 'p4', label: 'Etiquetas personalizadas' },
  { value: 'p5', label: 'Cajas de cartón 6u' },
]

const tecnicos = [
  { value: '', label: 'Seleccionar técnico…' },
  { value: 't1', label: 'Carlos Méndez' },
  { value: 't2', label: 'Ana Ramírez' },
  { value: 't3', label: 'Luis Orozco' },
]

export function SalidaModal({ onClose, onSubmit }: SalidaModalProps) {
  const evidencia = useCapturaEvidencia()
  const [producto, setProducto] = useState('')
  const [cantidad, setCantidad] = useState(1)
  const [tecnico, setTecnico] = useState('')
  const [motivo, setMotivo] = useState('')
  const [foto, setFoto] = useState<string | null>(null)
  const [error, setError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)
  const uploadRef = useRef<HTMLInputElement>(null)

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setError('El archivo debe ser una imagen.')
      return
    }
    const reader = new FileReader()
    reader.onload = () => setFoto(reader.result as string)
    reader.readAsDataURL(file)
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    if (!producto) {
      setError('Selecciona un producto.')
      return
    }
    if (!cantidad || cantidad < 1) {
      setError('La cantidad debe ser mayor a 0.')
      return
    }
    if (!tecnico) {
      setError('Selecciona un técnico que recibe.')
      return
    }
    const productoLabel = productos.find((p) => p.value === producto)?.label ?? producto
    const tecnicoLabel = tecnicos.find((t) => t.value === tecnico)?.label ?? tecnico
    onSubmit({
      id: `d-${Date.now()}`,
      producto: productoLabel,
      cantidad,
      tecnico: tecnicoLabel,
      motivo,
      foto,
      fecha: new Date().toLocaleString('es-CO', {
        dateStyle: 'short',
        timeStyle: 'short',
      }),
    })
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Salida de Mercadería"
      icon={<LogOut size={16} className="text-primary" />}
      size="sm"
    >
      <form onSubmit={handleSubmit} className="p-5 space-y-4">
        <Field label="Producto">
          <select
            value={producto}
            onChange={(e) => setProducto(e.target.value)}
            className="w-full px-3 py-2.5 min-h-[44px] bg-muted border border-border text-sm text-foreground outline-none focus:border-primary/60 transition-colors"
            style={{ borderRadius: '0.25rem', fontFamily: "'DM Sans', sans-serif" }}
          >
            {productos.map((p) => (
              <option key={p.value} value={p.value} disabled={p.value === ''}>
                {p.label}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Cantidad a Retirar">
          <input
            type="number"
            min={1}
            value={cantidad}
            onChange={(e) => setCantidad(Number(e.target.value))}
            className="w-full px-3 py-2.5 min-h-[44px] bg-muted border border-border text-sm text-foreground outline-none focus:border-primary/60 transition-colors"
            style={{ borderRadius: '0.25rem', fontFamily: "'DM Sans', sans-serif" }}
          />
        </Field>

        <Field label="Técnico que Recibe" required>
          <select
            value={tecnico}
            onChange={(e) => setTecnico(e.target.value)}
            className="w-full px-3 py-2.5 min-h-[44px] bg-muted border border-border text-sm text-foreground outline-none focus:border-primary/60 transition-colors"
            style={{ borderRadius: '0.25rem', fontFamily: "'DM Sans', sans-serif" }}
          >
            {tecnicos.map((t) => (
              <option key={t.value} value={t.value} disabled={t.value === ''}>
                {t.label}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Motivo / Referencia">
          <input
            type="text"
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            placeholder="Ej: Venta #456, Traspaso, etc."
            className="w-full px-3 py-2.5 min-h-[44px] bg-muted border border-border text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/60 transition-colors"
            style={{ borderRadius: '0.25rem', fontFamily: "'DM Sans', sans-serif" }}
          />
        </Field>

        <div>
          <div
            className="flex items-center gap-1.5 text-xs text-muted-foreground tracking-widest uppercase mb-1.5"
            style={{ fontFamily: "'JetBrains Mono', monospace" }}
          >
            <Camera size={12} />
            Foto de Evidencia (Opcional)
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            capture={evidencia.capture}
            onChange={handleFile}
            className="hidden"
          />
          {evidencia.puedeSubir && <input
            ref={uploadRef}
            type="file"
            accept="image/*"
            onChange={handleFile}
            className="hidden"
          />}
          {foto ? (
            <div className="w-full h-24 border border-border bg-muted overflow-hidden" style={{ borderRadius: '0.25rem' }}>
              <img
                src={foto}
                alt="preview"
                className="w-full h-full object-cover"
              />
            </div>
          ) : <div className="flex gap-2">
            <button type="button" onClick={() => fileRef.current?.click()} className="flex-1 min-h-[44px] border border-border bg-muted text-xs inline-flex items-center justify-center gap-2"><Camera size={14} />Tomar foto</button>
            {evidencia.puedeSubir && <button type="button" onClick={() => uploadRef.current?.click()} className="flex-1 min-h-[44px] border border-border bg-muted text-xs inline-flex items-center justify-center gap-2"><ImageIcon size={14} />Subir foto</button>}
          </div>}
          {foto && (
            <button
              type="button"
              onClick={() => {
                setFoto(null)
                if (fileRef.current) fileRef.current.value = ''
                if (uploadRef.current) uploadRef.current.value = ''
              }}
              className="mt-1.5 text-[10px] text-muted-foreground hover:text-foreground underline"
              style={{ fontFamily: "'JetBrains Mono', monospace" }}
            >
              Quitar foto
            </button>
          )}
        </div>

        {error && (
          <p
            className="text-xs text-primary bg-primary/10 border border-primary/20 px-3 py-2"
            style={{ fontFamily: "'JetBrains Mono', monospace", borderRadius: '0.25rem' }}
          >
            ⚠ {error}
          </p>
        )}

        <button
          type="submit"
          className="w-full min-h-[44px] inline-flex items-center justify-center gap-2 py-3 bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors"
          style={{ borderRadius: '0.25rem' }}
        >
          <LogOut size={14} />
          Registrar Salida
        </button>
      </form>
    </Modal>
  )
}

function Field({
  label,
  required,
  children,
}: {
  label: string
  required?: boolean
  children: React.ReactNode
}) {
  return (
    <div>
      <label
        className="block text-xs text-muted-foreground tracking-widest uppercase mb-1.5"
        style={{ fontFamily: "'JetBrains Mono', monospace" }}
      >
        {label} {required && <span className="text-primary">*</span>}
      </label>
      {children}
    </div>
  )
}
