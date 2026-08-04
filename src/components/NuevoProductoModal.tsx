import { useEffect, useRef, useState, type FormEvent } from 'react'
import {
  X,
  Package,
  Tag,
  Hash,
  Truck,
  BarChart3,
  DollarSign,
  Ruler,
  FileText,
  Loader2,
  Upload,
  Plus,
  MapPin,
} from 'lucide-react'
import {
  catalogosService,
  productosStore,
  uploadsService,
  type CreateProductoInput,
} from '../store/productos'
import { useUnidadesMedida, unidadesMedidaStore } from '../store/unidades-medida'
import { useMarcas, marcasStore } from '../store/marcas'
import { useUbicaciones } from '../store/ubicaciones'
import { useAuth } from '../store/auth'
import { ModalCrearCatalogo } from './ModalCrearCatalogo'

type DocUpload = {
  id: string
  tipo: 'FichaTecnica' | 'Certificacion' | 'Foto' | 'Manual' | 'Otro'
  nombre: string
  file: File
  uploading: boolean
  uploaded: boolean
  uploadedUrl?: string
  uploadedKey?: string
  uploadedSize?: number
  error?: string
}

const MAX_BYTES = 10 * 1024 * 1024
const ALLOWED_MIMES = new Set(['application/pdf', 'image/png', 'image/jpeg', 'image/webp'])

type Props = {
  bodegaId: string
  onClose: () => void
  onCreated?: (nombre: string) => void
}

export function NuevoProductoModal({ bodegaId, onClose, onCreated }: Props) {
  const auth = useAuth()
  const puedeEditar =
    auth.status === 'autenticado' && auth.sesion.permisos.includes('inventario.crear')

  const [codigo, setCodigo] = useState('')
  const [nombre, setNombre] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [categoriaId, setCategoriaId] = useState('')
  const [proveedorId, setProveedorId] = useState('')
  const [marcaId, setMarcaId] = useState('')
  const [precio, setPrecio] = useState(0)
  const [stockMinimo, setStockMinimo] = useState(10)
  const [stockMaximo, setStockMaximo] = useState(0)
  const [stockInicial, setStockInicial] = useState(0)
  const [stockInicialUnidadId, setStockInicialUnidadId] = useState<string | null>(null)
  const [unidadMedidaId, setUnidadMedidaId] = useState<string | null>(null)
  const [ubicacionId, setUbicacionId] = useState<string | null>(null)

  const [categorias, setCategorias] = useState<Array<{ id: string; nombre: string }>>([])
  const [proveedores, setProveedores] = useState<
    Array<{ id: string; nombre: string; ruc: string | null }>
  >([])
  // Marc las manejamos en local para que cuando el modal "+ Crear" las agregue,
  // el `<select>` las vea inmediatamente (el `marcasStore` es externo al componente
  // y dispararía un re-render asíncrono; con local garantizamos sincronía).
  const [marcasLocal, setMarcasLocal] = useState<Array<{ id: string; nombre: string }>>([])

  // Modales de creación rápida de catálogos
  const [crearCategoria, setCrearCategoria] = useState(false)
  const [crearMarca, setCrearMarca] = useState(false)
  const [crearProveedor, setCrearProveedor] = useState(false)

  const unidadesState = useUnidadesMedida()
  const marcasState = useMarcas()
  const ubicacionesState = useUbicaciones(bodegaId)

  const [docs, setDocs] = useState<DocUpload[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const fichaRef = useRef<HTMLInputElement>(null)
  const certRef = useRef<HTMLInputElement>(null)
  const manualRef = useRef<HTMLInputElement>(null)
  const fotoRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (unidadesState.status === 'idle') {
      void unidadesMedidaStore.cargar().catch(() => undefined)
    }
    if (bodegaId) {
      void marcasStore.cargar(bodegaId).catch(() => undefined)
      void catalogosService.categorias(bodegaId).then(setCategorias).catch(() => undefined)
      void catalogosService.proveedores(bodegaId).then(setProveedores).catch(() => undefined)
    }
  }, [bodegaId])

  // Sembrar la lista local de marcas cuando el store termine de cargar.
  // Usamos una clave `seeded` para no pisar los nuevos ingresos del usuario.
  useEffect(() => {
    if (marcasState.status === 'listo' && marcasLocal.length === 0) {
      setMarcasLocal(marcasState.marcas.map((m) => ({ id: m.id, nombre: m.nombre })))
    }
  }, [marcasState, marcasLocal.length])

  // Auto-setear la primera unidad como default para el stock inicial
  useEffect(() => {
    if (!stockInicialUnidadId && unidadesState.status === 'listo' && unidadesState.unidades.length) {
      setStockInicialUnidadId(unidadesState.unidades[0].id)
      if (!unidadMedidaId) setUnidadMedidaId(unidadesState.unidades[0].id)
    }
  }, [stockInicialUnidadId, unidadMedidaId, unidadesState])

  function pickFile(
    tipo: DocUpload['tipo'],
    e: React.ChangeEvent<HTMLInputElement>,
  ) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    if (file.size > MAX_BYTES) {
      setError(`El archivo "${file.name}" excede 10MB.`)
      return
    }
    if (!ALLOWED_MIMES.has(file.type)) {
      setError(`"${file.name}": solo PDF, PNG, JPG o WEBP.`)
      return
    }
    setError('')
    const id = `tmp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
    setDocs((prev) => [...prev, { id, tipo, nombre: file.name, file, uploading: false, uploaded: false }])
  }

  function removeDoc(id: string) {
    setDocs((prev) => prev.filter((d) => d.id !== id))
  }

  async function uploadOne(d: DocUpload): Promise<DocUpload> {
    if (d.uploaded) return d
    setDocs((prev) => prev.map((x) => (x.id === d.id ? { ...x, uploading: true, error: undefined } : x)))
    try {
      const res = await uploadsService.subir(d.file, {
        seccion: 'products',
        bodegaId,
      })
      return {
        ...d,
        uploading: false,
        uploaded: true,
        uploadedUrl: res.url,
        uploadedKey: res.key,
        uploadedSize: res.sizeBytes,
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error al subir el archivo.'
      return { ...d, uploading: false, error: msg }
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    if (!codigo.trim()) {
      setError('Indicá el código (SKU) del producto.')
      return
    }
    if (!nombre.trim()) {
      setError('El nombre del producto es obligatorio.')
      return
    }
    if (!categoriaId) {
      setError('Elegí una categoría (o creá una con el botón +).')
      return
    }
    if (!unidadMedidaId) {
      setError('Elegí la unidad de medida base del producto.')
      return
    }
    if (!puedeEditar) {
      setError('No tenés permiso para crear productos.')
      return
    }

    setSubmitting(true)
    try {
      // 1) Subir archivos
      const uploaded = await Promise.all(docs.map(uploadOne))
      const failed = uploaded.find((d) => !d.uploaded || d.error)
      if (failed) {
        setError(`No se pudo subir "${failed.nombre}". Reintentá o quitalo.`)
        setDocs(uploaded as DocUpload[])
        setSubmitting(false)
        return
      }
      setDocs(uploaded as DocUpload[])

      // 2) Crear producto
      const input: CreateProductoInput = {
        codigo: codigo.trim(),
        nombre: nombre.trim(),
        descripcion: descripcion.trim() || undefined,
        // El back espera el NOMBRE de la categoría (la upsert por nombre),
        // así que resolvemos del array local.
        categoriaNombre:
          categorias.find((c) => c.id === categoriaId)?.nombre ?? '',
        marcaId: marcaId || undefined,
        unidadMedidaId,
        bodegaId,
        ubicacionId: ubicacionId || undefined,
        precio: precio > 0 ? precio : undefined,
        stockMinimo: stockMinimo > 0 ? stockMinimo : undefined,
        stockMaximo: stockMaximo > 0 ? stockMaximo : undefined,
        stockInicial: stockInicial > 0 ? stockInicial : undefined,
        stockInicialUnidadId:
          stockInicial > 0 ? stockInicialUnidadId ?? unidadMedidaId : undefined,
        proveedores: proveedorId ? [{ proveedorId, precioCompra: 0 }] : undefined,
      }
      const producto = await productosStore.crear(input)

      // 3) Subir documentos
      for (const d of uploaded) {
        if (d.uploaded && d.uploadedUrl && d.uploadedSize != null) {
          try {
            await uploadsService.agregarDocumento(producto.id, {
              tipo: d.tipo,
              nombre: d.nombre,
              url: d.uploadedUrl,
              key: d.uploadedKey,
              mimeType: d.file.type,
              sizeBytes: d.uploadedSize,
            })
          } catch (err) {
            console.warn('No se pudo asociar doc:', err)
          }
        }
      }

      onCreated?.(producto.nombre)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'No se pudo crear el producto.'
      setError(msg)
    } finally {
      setSubmitting(false)
    }
  }

  const inputClass =
    'w-full px-3 py-2.5 bg-muted border border-border text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/60 transition-colors'

  const unidades = unidadesState.status === 'listo' ? unidadesState.unidades : []
  const marcas = marcasLocal
  const ubicaciones =
    ubicacionesState.status === 'listo' ? ubicacionesState.ubicaciones : []

  return (
    <div
      className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-card border border-border w-full max-w-2xl max-h-[92vh] flex flex-col"
        style={{ borderRadius: '0.25rem' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-5 border-b border-border shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-primary/15 flex items-center justify-center">
              <Package size={18} className="text-primary" />
            </div>
            <div>
              <h2
                className="text-xl uppercase text-foreground leading-none"
                style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900 }}
              >
                Nuevo Producto
              </h2>
              <p
                className="mt-1 text-xs text-muted-foreground"
                style={{ fontFamily: "'DM Sans', sans-serif" }}
              >
                Indicá código, nombre y unidad base
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Cerrar"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* ─── Identificación ─── */}
          <Section title="Identificación" icon={Tag}>
            <div className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Field label="Código (SKU)" required icon={Hash}>
                  <input
                    type="text"
                    value={codigo}
                    onChange={(e) => setCodigo(e.target.value)}
                    placeholder="Ej: SKU-2024-001"
                    className={inputClass}
                  />
                </Field>
                <Field label="Nombre" required>
                  <input
                    type="text"
                    value={nombre}
                    onChange={(e) => setNombre(e.target.value)}
                    placeholder="Ej: Cable HDMI 4K UHD 3m"
                    className={inputClass}
                  />
                </Field>
              </div>
              <Field label="Descripción">
                <textarea
                  value={descripcion}
                  onChange={(e) => setDescripcion(e.target.value)}
                  rows={2}
                  placeholder="Material, dimensiones, modelo, especificaciones…"
                  className={`${inputClass} resize-none`}
                />
              </Field>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Field label="Categoría" required icon={Tag}>
                  <div className="flex gap-2">
                    <select
                      value={categoriaId}
                      onChange={(e) => setCategoriaId(e.target.value)}
                      className={`${inputClass} flex-1`}
                    >
                      <option value="" disabled>
                        Elegí una categoría…
                      </option>
                      {categorias.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.nombre}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => setCrearCategoria(true)}
                      className="inline-flex items-center gap-1 px-3 py-2.5 border border-border bg-muted text-foreground hover:border-primary/40 hover:text-primary transition-colors shrink-0 text-xs"
                      style={{
                        borderRadius: '0.25rem',
                        fontFamily: "'JetBrains Mono', monospace",
                      }}
                      title="Crear nueva categoría"
                    >
                      <Plus size={12} /> Crear
                    </button>
                  </div>
                </Field>
                <Field label="Marca" icon={Truck}>
                  <div className="flex gap-2">
                    <select
                      value={marcaId}
                      onChange={(e) => setMarcaId(e.target.value)}
                      className={`${inputClass} flex-1`}
                    >
                      <option value="">Sin marca</option>
                      {marcas.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.nombre}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => setCrearMarca(true)}
                      className="inline-flex items-center gap-1 px-3 py-2.5 border border-border bg-muted text-foreground hover:border-primary/40 hover:text-primary transition-colors shrink-0 text-xs"
                      style={{
                        borderRadius: '0.25rem',
                        fontFamily: "'JetBrains Mono', monospace",
                      }}
                      title="Crear nueva marca"
                    >
                      <Plus size={12} /> Crear
                    </button>
                  </div>
                </Field>
              </div>
              <Field label="Proveedor (opcional)" icon={Truck}>
                <div className="flex gap-2">
                  <select
                    value={proveedorId}
                    onChange={(e) => setProveedorId(e.target.value)}
                    className={`${inputClass} flex-1`}
                  >
                    <option value="">Sin proveedor</option>
                    {proveedores.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.nombre}
                        {p.ruc ? ` (RUC ${p.ruc})` : ''}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => setCrearProveedor(true)}
                    className="inline-flex items-center gap-1 px-3 py-2.5 border border-border bg-muted text-foreground hover:border-primary/40 hover:text-primary transition-colors shrink-0 text-xs"
                    style={{
                      borderRadius: '0.25rem',
                      fontFamily: "'JetBrains Mono', monospace",
                    }}
                    title="Crear nuevo proveedor"
                  >
                    <Plus size={12} /> Crear
                  </button>
                </div>
              </Field>
            </div>
          </Section>

          {/* ─── Unidad y stock ─── */}
          <Section title="Unidad de medida y stock" icon={Ruler}>
            <div className="space-y-3">
              <Field label="Unidad base" required icon={Ruler}>
                <select
                  value={unidadMedidaId ?? ''}
                  onChange={(e) => setUnidadMedidaId(e.target.value)}
                  className={inputClass}
                >
                  <option value="" disabled>
                    Elegí la unidad base…
                  </option>
                  {unidades.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.nombre} ({u.abreviatura})
                      {u.permiteDecimales ? ' · decimales' : ''}
                    </option>
                  ))}
                </select>
                <p
                  className="text-[10px] text-muted-foreground mt-1"
                  style={{ fontFamily: "'JetBrains Mono', monospace" }}
                >
                  El stock se almacena siempre en esta unidad. Si cargás en otra unidad, va a convertir.
                </p>
              </Field>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Field label="Stock inicial" icon={BarChart3}>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      min={0}
                      step={unidades.find((u) => u.id === stockInicialUnidadId)?.permiteDecimales ? '0.001' : '1'}
                      value={stockInicial}
                      onChange={(e) => setStockInicial(Number(e.target.value))}
                      className={inputClass}
                    />
                    <select
                      value={stockInicialUnidadId ?? ''}
                      onChange={(e) => setStockInicialUnidadId(e.target.value)}
                      className={`${inputClass} w-32`}
                    >
                      {unidades.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.abreviatura}
                        </option>
                      ))}
                    </select>
                  </div>
                </Field>
                <Field label="Stock mínimo (alerta)" icon={BarChart3}>
                  <input
                    type="number"
                    min={0}
                    value={stockMinimo}
                    onChange={(e) => setStockMinimo(Number(e.target.value))}
                    className={inputClass}
                  />
                </Field>
              </div>

              <Field label="Ubicación (opcional)" icon={MapPin}>
                <select
                  value={ubicacionId ?? ''}
                  onChange={(e) => setUbicacionId(e.target.value || null)}
                  className={inputClass}
                >
                  <option value="">Sin ubicación específica</option>
                  {ubicaciones.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.nombre}
                    </option>
                  ))}
                </select>
              </Field>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Field label="Stock máximo (opcional)" icon={BarChart3}>
                  <input
                    type="number"
                    min={0}
                    value={stockMaximo}
                    onChange={(e) => setStockMaximo(Number(e.target.value))}
                    className={inputClass}
                  />
                </Field>
                <Field label="Precio unitario (COP)" icon={DollarSign}>
                  <input
                    type="number"
                    min={0}
                    value={precio}
                    onChange={(e) => setPrecio(Number(e.target.value))}
                    className={inputClass}
                  />
                </Field>
              </div>
            </div>
          </Section>

          {/* ─── Documentos ─── */}
          <Section title="Documentos" icon={FileText}>
            <p
              className="text-xs text-muted-foreground mb-3"
              style={{ fontFamily: "'DM Sans', sans-serif" }}
            >
              PDF, JPG, PNG, WEBP · máx 10MB.
            </p>
            <div className="grid grid-cols-2 gap-2">
              <DocButton
                icon={<FileText size={14} className="text-primary" />}
                label="Ficha Técnica"
                onClick={() => fichaRef.current?.click()}
              />
              <DocButton
                icon={<Plus size={14} className="text-secondary" />}
                label="Certificación"
                onClick={() => certRef.current?.click()}
              />
              <DocButton
                icon={<FileText size={14} className="text-muted-foreground" />}
                label="Manual"
                onClick={() => manualRef.current?.click()}
              />
              <DocButton
                icon={<Upload size={14} className="text-muted-foreground" />}
                label="Foto"
                onClick={() => fotoRef.current?.click()}
              />
            </div>

            {docs.length > 0 && (
              <ul className="mt-3 space-y-2">
                {docs.map((d) => (
                  <li
                    key={d.id}
                    className="flex items-center gap-3 p-2 bg-muted/40 border border-border"
                    style={{ borderRadius: '0.25rem' }}
                  >
                    <div className="w-7 h-7 bg-card flex items-center justify-center shrink-0">
                      {d.uploading ? (
                        <Loader2 size={12} className="text-muted-foreground animate-spin" />
                      ) : d.uploaded ? (
                        <Upload size={12} className="text-secondary" />
                      ) : (
                        <FileText size={12} className="text-muted-foreground" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div
                        className="text-xs text-foreground truncate"
                        style={{ fontFamily: "'DM Sans', sans-serif" }}
                      >
                        {d.nombre}
                      </div>
                      <div
                        className="text-[10px] text-muted-foreground"
                        style={{ fontFamily: "'JetBrains Mono', monospace" }}
                      >
                        {d.tipo} ·{' '}
                        {d.uploading ? 'subiendo…' : d.error ? d.error : `${(d.file.size / 1024).toFixed(0)} KB`}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeDoc(d.id)}
                      className="text-muted-foreground hover:text-primary transition-colors p-1"
                      aria-label="Quitar"
                    >
                      <X size={13} />
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <input
              ref={fichaRef}
              type="file"
              accept=".pdf,image/png,image/jpeg,image/webp"
              onChange={(e) => pickFile('FichaTecnica', e)}
              className="hidden"
            />
            <input
              ref={certRef}
              type="file"
              accept=".pdf,image/png,image/jpeg,image/webp"
              onChange={(e) => pickFile('Certificacion', e)}
              className="hidden"
            />
            <input
              ref={manualRef}
              type="file"
              accept=".pdf,image/png,image/jpeg,image/webp"
              onChange={(e) => pickFile('Manual', e)}
              className="hidden"
            />
            <input
              ref={fotoRef}
              type="file"
              accept=".pdf,image/png,image/jpeg,image/webp"
              onChange={(e) => pickFile('Foto', e)}
              className="hidden"
            />
          </Section>

          {error && (
            <p
              className="text-xs text-primary bg-primary/10 border border-primary/20 px-3 py-2"
              style={{ fontFamily: "'JetBrains Mono', monospace", borderRadius: '0.25rem' }}
            >
              ⚠ {error}
            </p>
          )}
        </form>

        <div className="p-4 border-t border-border flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 inline-flex items-center justify-center gap-2 py-2.5 border border-border text-sm text-foreground hover:border-foreground/30 transition-colors"
            style={{ borderRadius: '0.25rem' }}
          >
            <X size={14} />
            Cancelar
          </button>
          <button
            type="button"
            onClick={(e) => handleSubmit(e as unknown as FormEvent)}
            disabled={submitting}
            className="flex-1 inline-flex items-center justify-center gap-2 py-2.5 bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            style={{ borderRadius: '0.25rem' }}
          >
            {submitting ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                Creando…
              </>
            ) : (
              <>
                <Package size={14} />
                Crear Producto
              </>
            )}
          </button>
        </div>
      </div>

      {crearCategoria && (
        <ModalCrearCatalogo
          titulo="Crear categoría"
          label="Nombre de la categoría"
          placeholder="Ej: Ferretería, Eléctrico…"
          endpoint="/categorias"
          bodegaId={bodegaId}
          onCreated={(cat) => {
            setCategorias((prev) =>
              prev.some((c) => c.id === cat.id) ? prev : [...prev, cat].sort((a, b) => a.nombre.localeCompare(b.nombre)),
            )
            setCategoriaId(cat.id)
          }}
          onClose={() => setCrearCategoria(false)}
        />
      )}

      {crearMarca && (
        <ModalCrearCatalogo
          titulo="Crear marca"
          label="Nombre de la marca"
          placeholder="Ej: Bosch, Stanley…"
          endpoint="/marcas"
          bodegaId={bodegaId}
          onCreated={(m) => {
            // Empujar la nueva marca al estado local para que el `<select>`
            // la muestre inmediatamente y `setMarcaId` tenga sentido.
            setMarcasLocal((prev) =>
              prev.some((x) => x.id === m.id) ? prev : [...prev, m].sort((a, b) => a.nombre.localeCompare(b.nombre)),
            )
            // Mantener el store en sync por si se reabre el modal.
            void marcasStore.cargar(bodegaId).catch(() => undefined)
            setMarcaId(m.id)
          }}
          onClose={() => setCrearMarca(false)}
        />
      )}

      {crearProveedor && (
        <ModalCrearCatalogo
          titulo="Crear proveedor"
          label="Nombre del proveedor"
          placeholder="Ej: Distribuidora XYZ…"
          endpoint="/proveedores"
          bodegaId={bodegaId}
          onCreated={(p) => {
            setProveedores((prev) =>
              prev.some((x) => x.id === p.id) ? prev : [...prev, { ...p, ruc: null }].sort((a, b) => a.nombre.localeCompare(b.nombre)),
            )
            setProveedorId(p.id)
          }}
          onClose={() => setCrearProveedor(false)}
        />
      )}
    </div>
  )
}

function Section({
  title,
  icon: Icon,
  children,
}: {
  title: string
  icon: typeof Tag
  children: React.ReactNode
}) {
  return (
    <div
      className="bg-muted/30 border border-border p-4"
      style={{ borderRadius: '0.25rem' }}
    >
      <div className="flex items-center gap-2 mb-3">
        <div className="w-6 h-6 bg-primary/10 flex items-center justify-center">
          <Icon size={13} className="text-primary" />
        </div>
        <h3
          className="text-sm uppercase text-foreground tracking-wider"
          style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800 }}
        >
          {title}
        </h3>
      </div>
      {children}
    </div>
  )
}

function Field({
  label,
  required,
  icon: Icon,
  children,
}: {
  label: string
  required?: boolean
  icon?: typeof Tag
  children: React.ReactNode
}) {
  return (
    <div>
      <label
        className="flex items-center gap-1.5 text-xs text-muted-foreground tracking-widest uppercase mb-1.5"
        style={{ fontFamily: "'JetBrains Mono', monospace" }}
      >
        {Icon && <Icon size={11} />}
        {label}
        {required && <span className="text-primary">*</span>}
      </label>
      {children}
    </div>
  )
}

function DocButton({
  icon,
  label,
  onClick,
}: {
  icon: React.ReactNode
  label: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-2 px-3 py-2 bg-card border border-border text-xs text-foreground hover:border-primary/40 transition-colors"
      style={{ borderRadius: '0.25rem', fontFamily: "'DM Sans', sans-serif" }}
    >
      {icon}
      + {label}
    </button>
  )
}
