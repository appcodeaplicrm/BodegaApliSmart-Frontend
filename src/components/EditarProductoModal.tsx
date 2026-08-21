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
  RotateCcw,
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
import { Modal } from './Modal'
import { ValorInputBlur } from '../lib/valorBlur'

type Props = {
  producto: Producto
  onClose: () => void
  onSaved?: (producto: Producto) => void
}

export function EditarProductoModal({ producto, onClose, onSaved }: Props) {
  const presentacionActual = producto.conversiones.find((c) => c.unidadDestino.id === producto.unidadMedida.id)
  const factorPresentacionActual = Number(presentacionActual?.factorConversion ?? 1)
  const stockInicialBase = producto.stocks.reduce((acc, s) => acc + Number(s.cantidad), 0)
  const stockInicial = stockInicialBase / factorPresentacionActual
  const bodegaId = producto.stocks[0]?.bodegaId ?? producto.bodega?.id ?? null

  const [codigo, setCodigo] = useState(producto.codigo)
  const [nombre, setNombre] = useState(producto.nombre)
  const [descripcion, setDescripcion] = useState(producto.descripcion ?? '')
  const [categoriaId, setCategoriaId] = useState(producto.categoria.id)
  const [marcaId, setMarcaId] = useState(producto.marca?.id ?? '')
  const [precio, setPrecio] = useState(Number(producto.precio))
  const [stockMinimo, setStockMinimo] = useState(Number(producto.stockMinimo) / factorPresentacionActual)
  const [stockMaximo, setStockMaximo] = useState(Number(producto.stockMaximo ?? 0) / factorPresentacionActual)
  const [stockCantidad, setStockCantidad] = useState(stockInicial)
  const [unidadMedidaId, setUnidadMedidaId] = useState(producto.unidadMedida.id)
  const [unidadPresentacionId, setUnidadPresentacionId] = useState(presentacionActual?.unidadOrigen.id ?? producto.unidadMedida.id)
  const [cantidadContenido, setCantidadContenido] = useState(Number(presentacionActual?.factorConversion ?? 1))
  const [activo, setActivo] = useState(producto.activo)
  // Política de devolución (sección 21 del .md). Editar este flag
  // afecta SOLO las próximas entregas (cada EntregaItem tiene su
  // propia fotografía histórica).
  const [admiteDevolucion, setAdmiteDevolucion] = useState(
    producto.admiteDevolucion,
  )
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
    if (unidadPresentacionId !== unidadMedidaId && cantidadContenido <= 0) {
      setError('Indicá cuánto contiene cada presentación del producto.')
      return
    }
    setSubmitting(true)
    try {
      const input: UpdateProductoInput = {
        ...(() => {
          const factor = unidadPresentacionId !== unidadMedidaId ? cantidadContenido : 1
          return {
            stockMinimo: stockMinimo * factor,
            stockMaximo: stockMaximo > 0 ? stockMaximo * factor : undefined,
            stockCantidad: stockCantidad !== stockInicial ? stockCantidad * factor : undefined,
          }
        })(),
        codigo: codigo.trim(),
        nombre: nombre.trim(),
        descripcion: descripcion.trim() || undefined,
        categoriaNombre: categorias.find((c) => c.id === categoriaId)?.nombre ?? '',
        marcaId: marcaId || undefined,
        unidadMedidaId,
        unidadPresentacionId,
        cantidadContenido: unidadPresentacionId !== unidadMedidaId ? cantidadContenido : undefined,
        bodegaId: bodegaId ?? undefined,
        precio,
        activo,
        // Política de devolución (sección 21).
        admiteDevolucion,
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
    'w-full px-3 py-2.5 min-h-[44px] bg-muted border border-border text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/60 transition-colors'

  return (
    <>
      <Modal
        open
        onClose={onClose}
        title="Editar Producto"
        description="Cambiá los datos del producto"
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
              form="editar-producto-form"
              disabled={submitting}
              className="flex-1 inline-flex items-center justify-center gap-2 min-h-[44px] py-2.5 bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
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
        }
      >
        <form
          id="editar-producto-form"
          onSubmit={handleSubmit}
          className="p-5 space-y-5"
        >
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
            </div>
          </Section>

          {/* Política de devolución (sección 21 del .md) — vive
              acá arriba porque su edición es simple y bloquea el
              formulario si no se confirma (es un cambio de regla de
              negocio). */}
          <Section title="Política de devolución" icon={RotateCcw}>
            <Field
              label="¿Admite devolución?"
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
                    {admiteDevolucion
                      ? 'Admite devolución'
                      : 'No admite devolución'}
                  </div>
                </div>
              </label>
            </Field>
          </Section>

          <Section title="Unidad y stock" icon={Ruler}>
            <div className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Field label="Presentación en inventario" required icon={Ruler}>
                <select
                  value={unidadPresentacionId}
                  onChange={(e) => setUnidadPresentacionId(e.target.value)}
                  className={inputClass}
                >
                  {unidades.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.nombre} ({u.abreviatura})
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Unidad del contenido" required icon={Ruler}>
                <select value={unidadMedidaId} onChange={(e) => setUnidadMedidaId(e.target.value)} className={inputClass}>
                  {unidades.map((u) => <option key={u.id} value={u.id}>{u.nombre} ({u.abreviatura})</option>)}
                </select>
              </Field>
              </div>
              {unidadPresentacionId !== unidadMedidaId && (
                <Field label={`Contenido por ${unidades.find((u) => u.id === unidadPresentacionId)?.nombre ?? 'presentación'}`} required icon={Ruler}>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground shrink-0">1 {unidades.find((u) => u.id === unidadPresentacionId)?.abreviatura} =</span>
                    <input type="number" min="0" step="any" value={cantidadContenido} onChange={(e) => setCantidadContenido(Number(e.target.value))} className={inputClass} />
                    <span className="text-sm text-muted-foreground shrink-0">{unidades.find((u) => u.id === unidadMedidaId)?.abreviatura}</span>
                  </div>
                </Field>
              )}
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
                <Field label="Ubicación dentro de bodega" icon={MapPin}>
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
                  <ValorInputBlur
                    value={precio}
                    onChange={(v) => setPrecio(v === '' ? 0 : v)}
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
      </Modal>

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
