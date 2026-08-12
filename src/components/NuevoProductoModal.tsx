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
  RotateCcw,
  CheckCircle2,
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
import { Modal } from './Modal'

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
  // Política de devolución (Sprint 3 — sección 21 del .md).
  // Default FALSE: producto consumible o no retornable. El bodeguero
  // debe activarlo explícitamente para herramientas / cascos / etc.
  const [admiteDevolucion, setAdmiteDevolucion] = useState(false)
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

  /**
   * Sincronizar la unidad del Stock Inicial con la Unidad Base.
   *
   * Reglas:
   *  - Si el usuario cambia la Unidad Base y la unidad del Stock Inicial
   *    todavía coincide con la unidad base ANTERIOR (o sea, nunca fue
   *    personalizada), se actualiza a la nueva.
   *  - Si el usuario había elegido una unidad distinta para el Stock
   *    Inicial, NO se toca (respeta la decisión — probablemente está
   *    cargando "5 rollos" que se convierten a metros).
   *  - El stock inicial ya fue modificado (no es 0) → tampoco se toca
   *    (asumimos que el usuario ya empezó a cargar y respetamos).
   *
   * Usa una ref para recordar cuál era la unidad base anterior y así
   * poder comparar sin disparar el effect en cada render.
   */
  const prevUnidadMedidaIdRef = useRef<string | null>(null)
  useEffect(() => {
    const prev = prevUnidadMedidaIdRef.current
    // Primer render: solo registrar la unidad actual sin hacer nada
    if (prev === null) {
      prevUnidadMedidaIdRef.current = unidadMedidaId
      return
    }
    // Si no cambió, no hacer nada
    if (prev === unidadMedidaId) return
    // Si la unidad del stock inicial coincide con la VIEJA unidad base
    // (o sea, no fue personalizada), sincronizar a la nueva.
    if (
      stockInicialUnidadId === prev &&
      stockInicial === 0
    ) {
      setStockInicialUnidadId(unidadMedidaId)
    }
    prevUnidadMedidaIdRef.current = unidadMedidaId
  }, [unidadMedidaId, stockInicialUnidadId, stockInicial])

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
        // Política de devolución.
        admiteDevolucion,
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
    'w-full px-3 py-2.5 min-h-[44px] bg-muted border border-border text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/60 transition-colors'

  const unidades = unidadesState.status === 'listo' ? unidadesState.unidades : []
  const marcas = marcasLocal
  const ubicaciones =
    ubicacionesState.status === 'listo' ? ubicacionesState.ubicaciones : []

  return (
    <>
      <Modal
        open
        onClose={onClose}
        title="Nuevo Producto"
        description="Indicá código, nombre y unidad base"
        icon={<Package size={16} className="text-primary" />}
        size="lg"
        footer={
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 inline-flex items-center justify-center gap-2 min-h-[44px] py-2.5 border border-border text-sm text-foreground hover:border-foreground/30 transition-colors"
              style={{ borderRadius: '0.25rem' }}
            >
              <X size={14} />
              Cancelar
            </button>
            <button
              type="submit"
              form="nuevo-producto-form"
              disabled={submitting}
              className="flex-1 inline-flex items-center justify-center gap-2 min-h-[44px] py-2.5 bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
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
        }
      >
        <form
          id="nuevo-producto-form"
          onSubmit={handleSubmit}
          className="p-5 space-y-5"
        >
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
                      className="inline-flex items-center gap-1 min-h-[44px] px-3 py-2.5 border border-border bg-muted text-foreground hover:border-primary/40 hover:text-primary transition-colors shrink-0 text-xs"
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
                      className="inline-flex items-center gap-1 min-h-[44px] px-3 py-2.5 border border-border bg-muted text-foreground hover:border-primary/40 hover:text-primary transition-colors shrink-0 text-xs"
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
                    className="inline-flex items-center gap-1 min-h-[44px] px-3 py-2.5 border border-border bg-muted text-foreground hover:border-primary/40 hover:text-primary transition-colors shrink-0 text-xs"
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

              {/* Política de devolución (Sprint 3 — sección 21 del .md).
                  El bodeguero define una sola vez si el producto debe
                  devolverse después de su uso. Default FALSE (consumible
                  o no retornable: tornillos, cinta, lubricante). */}
              <Field
                label="Política de devolución"
                icon={RotateCcw}
                hint={
                  admiteDevolucion
                    ? 'El técnico deberá devolver este producto después de su uso.'
                    : 'Este producto se considera consumible o no retornable.'
                }
              >
                <label className="flex items-center gap-3 cursor-pointer select-none min-h-[44px]">
                  <button
                    type="button"
                    role="switch"
                    aria-checked={admiteDevolucion}
                    onClick={() => setAdmiteDevolucion((v) => !v)}
                    className={`relative inline-flex h-6 w-11 shrink-0 items-center transition-colors ${
                      admiteDevolucion ? 'bg-secondary' : 'bg-muted'
                    }`}
                    style={{ borderRadius: '0.25rem' }}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform bg-foreground transition-transform ${
                        admiteDevolucion ? 'translate-x-6' : 'translate-x-1'
                      }`}
                      style={{ borderRadius: '0.15rem' }}
                    />
                  </button>
                  <div className="text-sm">
                    <div
                      className="text-foreground font-semibold"
                      style={{ fontFamily: "'Barlow Condensed', sans-serif" }}
                    >
                      {admiteDevolucion ? 'Admite devolución' : 'No admite devolución'}
                    </div>
                  </div>
                </label>
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

              <Field label="Ubicación dentro de bodega (opcional)" icon={MapPin}>
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
                count={docs.filter((d) => d.tipo === 'FichaTecnica').length}
                onClick={() => fichaRef.current?.click()}
              />
              <DocButton
                icon={<Plus size={14} className="text-secondary" />}
                label="Certificación"
                count={docs.filter((d) => d.tipo === 'Certificacion').length}
                onClick={() => certRef.current?.click()}
              />
              <DocButton
                icon={<FileText size={14} className="text-muted-foreground" />}
                label="Manual"
                count={docs.filter((d) => d.tipo === 'Manual').length}
                onClick={() => manualRef.current?.click()}
              />
              <DocButton
                icon={<Upload size={14} className="text-muted-foreground" />}
                label="Foto"
                count={docs.filter((d) => d.tipo === 'Foto').length}
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
                      className="text-muted-foreground hover:text-primary transition-colors min-w-[44px] min-h-[44px] p-1 inline-flex items-center justify-center"
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
      </Modal>

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
    </>
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
  hint,
  children,
}: {
  label: string
  required?: boolean
  icon?: typeof Tag
  hint?: string
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
        {hint && <span className="ml-auto normal-case tracking-normal">{hint}</span>}
      </label>
      {children}
    </div>
  )
}

function DocButton({
  icon,
  label,
  count,
  onClick,
}: {
  icon: React.ReactNode
  label: string
  /** Cuántos archivos de este tipo ya están cargados. Si > 0, se muestra en verde con check. */
  count: number
  onClick: () => void
}) {
  const hasFile = count > 0
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        hasFile
          ? 'inline-flex items-center justify-between gap-2 min-h-[44px] px-3 py-2 bg-emerald-500/15 border border-emerald-500/50 text-xs text-emerald-500 hover:border-emerald-500 transition-colors'
          : 'inline-flex items-center gap-2 min-h-[44px] px-3 py-2 bg-card border border-border text-xs text-foreground hover:border-primary/40 transition-colors'
      }
      style={{ borderRadius: '0.25rem', fontFamily: "'DM Sans', sans-serif" }}
      title={hasFile ? `${count} archivo(s) cargado(s)` : `Agregar ${label.toLowerCase()}`}
    >
      <span className="inline-flex items-center gap-2">
        {icon}
        {hasFile ? label : `+ ${label}`}
      </span>
      {hasFile && (
        <span className="inline-flex items-center gap-1">
          <CheckCircle2 size={14} className="text-emerald-500" />
          {count > 1 && (
            <span
              className="text-[10px] font-bold"
              style={{ fontFamily: "'JetBrains Mono', monospace" }}
            >
              {count}
            </span>
          )}
        </span>
      )}
    </button>
  )
}
