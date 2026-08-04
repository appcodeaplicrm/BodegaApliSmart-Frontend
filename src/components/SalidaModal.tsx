import { useState, useRef, type FormEvent } from 'react'
import {
  X,
  LogOut,
  Camera,
  ImageIcon,
} from 'lucide-react'

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
  const [producto, setProducto] = useState('')
  const [cantidad, setCantidad] = useState(1)
  const [tecnico, setTecnico] = useState('')
  const [motivo, setMotivo] = useState('')
  const [foto, setFoto] = useState<string | null>(null)
  const [error, setError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

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
    <div
      className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-card border border-border w-full max-w-md max-h-[90vh] overflow-y-auto"
        style={{ borderRadius: '0.25rem' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-5 border-b border-border">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-primary/15 flex items-center justify-center">
              <LogOut size={14} className="text-primary" />
            </div>
            <h2
              className="text-lg uppercase text-foreground"
              style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800 }}
            >
              Salida de Mercadería
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Cerrar"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <Field label="Producto">
            <select
              value={producto}
              onChange={(e) => setProducto(e.target.value)}
              className="w-full px-3 py-2.5 bg-muted border border-border text-sm text-foreground outline-none focus:border-primary/60 transition-colors"
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
              className="w-full px-3 py-2.5 bg-muted border border-border text-sm text-foreground outline-none focus:border-primary/60 transition-colors"
              style={{ borderRadius: '0.25rem', fontFamily: "'DM Sans', sans-serif" }}
            />
          </Field>

          <Field label="Técnico que Recibe" required>
            <select
              value={tecnico}
              onChange={(e) => setTecnico(e.target.value)}
              className="w-full px-3 py-2.5 bg-muted border border-border text-sm text-foreground outline-none focus:border-primary/60 transition-colors"
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
              className="w-full px-3 py-2.5 bg-muted border border-border text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/60 transition-colors"
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
              onChange={handleFile}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="w-full h-24 border border-dashed border-border bg-muted hover:border-primary/40 transition-colors flex flex-col items-center justify-center gap-1 text-muted-foreground hover:text-foreground overflow-hidden"
              style={{ borderRadius: '0.25rem' }}
            >
              {foto ? (
                <img
                  src={foto}
                  alt="preview"
                  className="w-full h-full object-cover"
                />
              ) : (
                <>
                  <ImageIcon size={18} />
                  <span
                    className="text-xs"
                    style={{ fontFamily: "'JetBrains Mono', monospace" }}
                  >
                    Subir foto
                  </span>
                </>
              )}
            </button>
            {foto && (
              <button
                type="button"
                onClick={() => {
                  setFoto(null)
                  if (fileRef.current) fileRef.current.value = ''
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
            className="w-full inline-flex items-center justify-center gap-2 py-3 bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors"
            style={{ borderRadius: '0.25rem' }}
          >
            <LogOut size={14} />
            Registrar Salida
          </button>
        </form>
      </div>
    </div>
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
