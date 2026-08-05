import { useEffect, useState, type FormEvent } from 'react'
import {
  X,
  Package,
  Tag,
  Hash,
  Truck,
  BarChart3,
  DollarSign,
  Ruler,
  CircleCheck,
  Loader2,
  MapPin,
  Plus,
} from 'lucide-react'
import {
  productosStore,
  catalogosService,
  type Producto,
  type UpdateProductoInput,
} from '../store/productos'
import { useUnidadesMedida, unidadesMedidaStore } from '../store/unidades-medida'
import { useMarcas, marcasStore } from '../store/marcas'
import { useUbicaciones } from '../store/ubicaciones'
import { ModalCrearCatalogo } from './ModalCrearCatalogo'

type Props = {
  producto: Producto
  onClose: () => void
  onSaved?: (producto: Producto) => void
}

export function EditarProductoModal({ producto, onClose, onSaved }: Props) {
  const stockInicial = producto.stocks.reduce((acc, s) => acc + Number(s.cantidad), 0)
  const bodegaId = producto.stocks[0]?.bodegaId ?? producto.bodega?.id ?? null

  const [codigo, setCodigo] = useState(producto.codigo)
  const [nombre, setNombre] = useState(producto.nombre)
  const [descripcion, setDescripcion] = useState(producto.descripcion ?? '')
  const [categoriaId, setCategoriaId] = useState(producto.categoria.id)
  const [marcaId, setMarcaId] = useState(producto.marca?.id ?? '')
  const [precio, setPrecio] = useState(Number(producto.precio))
  const [stockMinimo, setStockMinimo] = useState(Number(producto.stockMinimo))
  const [stockMaximo, setStockMaximo] = useState(Number(producto.stockMaximo ?? 0))
  const [stockCantidad, setStockCantidad] = useState(stockInicial)
  const [unidadMedidaId, setUnidadMedidaId] = useState(producto.unidadMedida.id)
  const [activo, setActivo] = useState(producto.activo)
  const [ubicacionId, setUbicacionId] = useState<string | null>(null)

  const [categorias, setCategorias] = useState<Array<{ id: string; nombre: string }>>([])

  const [crearCategoria, setCrearCategoria] = useState(false)
  const [crearMarca, setCrearMarca] = useState(false)

  const unidadesState = useUnidadesMedida()
  const marcasState = useMarcas()
  const ubicacionesState = useUbicaciones(bodegaId)

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (unidadesState.status === 'idle') {
      void unidadesMedidaStore.cargar().catch(() => undefined)
    }
    if (bodegaId) {
      void marcasStore.cargar(bodegaId).catch(() => undefined)
      void catalogosService.categorias(bodegaId).then(setCategorias).catch(() => undefined)
    }
  }, [bodegaId])

  const unidades = unidadesState.status === 'listo' ? unidadesState.unidades : []
  const marcas = marcasState.status === 'listo' ? marcasState.marcas : []
  const ubicaciones =
    ubicacionesState.status === 'listo' ? ubicacionesState.ubicaciones : []

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    if (!codigo.trim() || !nombre.trim() || !categoriaId || !unidadMedidaId) {
      setError('Completá código, nombre, categoría y unidad.')
      return
    }
    setSubmitting(true)
    try {
      const input: UpdateProductoInput = {
        codigo: codigo.trim(),
        nombre: nombre.trim(),
        descripcion: descripcion.trim() || undefined,
        categoriaNombre: categorias.find((c) => c.id === categoriaId)?.nombre ?? '',
        marcaId: marcaId || undefined,
        unidadMedidaId,
        bodegaId: bodegaId ?? undefined,
        precio,
        stockMinimo,
        stockMaximo: stockMaximo > 0 ? stockMaximo : undefined,
        activo,
        stockCantidad: stockCantidad !== stockInicial ? stockCantidad : undefined,
        stockUbicacionId: ubicacionId ?? undefined,
      }
      const actualizado = await productosStore.actualizar(producto.id, input)
      onSaved?.(actualizado)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'No se pudo guardar el producto.'
      setError(msg)
    } finally {
      setSubmitting(false)
    }
  }

  const inputClass =
    'w-full px-3 py-2.5 bg-muted border border-border text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/60 transition-colors'

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
                Editar Producto
              </h2>
              <p
                className="mt-1 text-xs text-muted-foreground"
                style={{ fontFamily: "'DM Sans', sans-serif" }}
              >
                Cambiá los datos del producto
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
          <Section title="Identificación" icon={Tag}>
            <div className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Field label="Código (SKU)" required icon={Hash}>
                  <input
                    type="text"
                    value={codigo}
                    onChange={(e) => setCodigo(e.target.value)}
                    className={inputClass}
                  />
                </Field>
                <Field label="Nombre" required>
                  <input
                    type="text"
                    value={nombre}
                    onChange={(e) => setNombre(e.target.value)}
                    className={inputClass}
                  />
                </Field>
              </div>
              <Field label="Descripción">
                <textarea
                  value={descripcion}
                  onChange={(e) => setDescripcion(e.target.value)}
                  rows={2}
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
            </div>
          </Section>

          <Section title="Unidad y stock" icon={Ruler}>
            <div className="space-y-3">
              <Field label="Unidad base" required icon={Ruler}>
                <select
                  value={unidadMedidaId}
                  onChange={(e) => setUnidadMedidaId(e.target.value)}
                  className={inputClass}
                >
                  {unidades.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.nombre} ({u.abreviatura})
                    </option>
                  ))}
                </select>
              </Field>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Field label="Stock actual" icon={BarChart3}>
                  <input
                    type="number"
                    min={0}
                    step={producto.unidadMedida.permiteDecimales ? '0.001' : '1'}
                    value={stockCantidad}
                    onChange={(e) => setStockCantidad(Number(e.target.value))}
                    className={inputClass}
                  />
                </Field>
                <Field label="Stock mínimo" icon={BarChart3}>
                  <input
                    type="number"
                    min={0}
                    value={stockMinimo}
                    onChange={(e) => setStockMinimo(Number(e.target.value))}
                    className={inputClass}
                  />
                </Field>
              </div>
              {ubicaciones.length > 0 && (
                <Field label="Ubicación" icon={MapPin}>
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
              )}
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
                <Field label="Precio (COP)" icon={DollarSign}>
                  <input
                    type="number"
                    min={0}
                    value={precio}
                    onChange={(e) => setPrecio(Number(e.target.value))}
                    className={inputClass}
                  />
                </Field>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={activo}
                  onChange={(e) => setActivo(e.target.checked)}
                />
                Producto activo
              </label>
            </div>
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
                Guardando…
              </>
            ) : (
              <>
                <CircleCheck size={14} />
                Guardar
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
          bodegaId={bodegaId ?? undefined}
          onCreated={(cat) => {
            setCategorias((prev) =>
              prev.some((c) => c.id === cat.id)
                ? prev
                : [...prev, cat].sort((a, b) => a.nombre.localeCompare(b.nombre)),
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
          bodegaId={bodegaId ?? undefined}
          onCreated={(m) => {
            if (bodegaId) {
              void marcasStore.cargar(bodegaId).catch(() => undefined)
            }
            setMarcaId(m.id)
          }}
          onClose={() => setCrearMarca(false)}
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
