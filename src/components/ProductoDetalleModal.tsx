import { useEffect, useState } from 'react'
import {
  X,
  Package,
  Tag,
  MapPin,
  Truck,
  BarChart3,
  DollarSign,
  Ruler,
  FileText,
  Image as ImageIcon,
  CircleCheck,
  Loader2,
  ExternalLink,
  Download,
  Pencil,
  Trash2,
} from 'lucide-react'
import { productosStore, uploadsService, type Producto } from '../store/productos'
import { EditarProductoModal } from './EditarProductoModal'
import { useAuth } from '../store/auth'
import { imageUrl } from '../lib/apiBase'

type Props = {
  producto: Producto
  onClose: () => void
  onDeleted?: () => void
}

const formatPesos = (n: number | string) =>
  new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(typeof n === 'string' ? Number(n) : n)

export function ProductoDetalleModal({ producto, onClose, onDeleted }: Props) {
  const [full, setFull] = useState<Producto | null>(null)
  const [loading, setLoading] = useState(true)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const auth = useAuth()
  const puedeEditar =
    auth.status === 'autenticado' && auth.sesion.permisos.includes('inventario.editar')
  const puedeEliminar =
    auth.status === 'autenticado' && auth.sesion.permisos.includes('inventario.eliminar')

  useEffect(() => {
    let cancelado = false
    setLoading(true)
    void productosStore
      .findOne(producto.id)
      .then((p) => {
        if (!cancelado) setFull(p)
      })
      .catch(() => {
        if (!cancelado) setFull(producto as unknown as Producto)
      })
      .finally(() => {
        if (!cancelado) setLoading(false)
      })
    return () => {
      cancelado = true
    }
  }, [producto.id])

  async function handleEliminarDoc(docId: string) {
    if (!full) return
    if (!confirm('¿Eliminar este documento?')) return
    setDeletingId(docId)
    try {
      await uploadsService.eliminarDocumento(full.id, docId)
      setFull({
        ...full,
        documentos: full.documentos.filter((d) => d.id !== docId),
      })
    } catch (err) {
      alert(err instanceof Error ? err.message : 'No se pudo eliminar.')
    } finally {
      setDeletingId(null)
    }
  }

  async function handleEliminarProducto() {
    if (!full) return
    setDeleting(true)
    try {
      await productosStore.eliminar(full.id)
      onDeleted?.()
      onClose()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'No se pudo eliminar el producto.')
    } finally {
      setDeleting(false)
      setConfirmDelete(false)
    }
  }

  function handleSaved(actualizado: Producto) {
    setFull(actualizado)
    setEditing(false)
  }

  const p = full ?? (producto as unknown as Producto)
  const stockTotal = p.stocks.reduce((acc, s) => acc + Number(s.cantidad), 0)
  const minimo = Number(p.stockMinimo)
  const bajo = stockTotal <= minimo
  const proveedores = p.proveedores ?? []

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
        <div className="flex items-start justify-between gap-3 p-5 border-b border-border shrink-0">
          <div className="flex items-start gap-3 min-w-0 flex-1">
            <div className="w-10 h-10 bg-primary/15 flex items-center justify-center shrink-0">
              <Package size={20} className="text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <h2
                className="text-2xl uppercase text-foreground leading-none truncate"
                style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900 }}
              >
                {p.nombre}
              </h2>
              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                <span
                  className="text-[10px] text-muted-foreground"
                  style={{ fontFamily: "'JetBrains Mono', monospace" }}
                >
                  {p.codigo}
                </span>
                <span
                  className={`text-[9px] uppercase tracking-widest px-2 py-0.5 border ${
                    p.activo
                      ? 'text-secondary border-secondary/30'
                      : 'text-primary border-primary/30'
                  }`}
                  style={{
                    borderRadius: '0.125rem',
                    fontFamily: "'JetBrains Mono', monospace",
                  }}
                >
                  {p.activo ? 'Activo' : 'Inactivo'}
                </span>
                {bajo && (
                  <span
                    className="text-[9px] uppercase tracking-widest px-2 py-0.5 border border-amber-500/30 text-amber-400"
                    style={{ borderRadius: '0.125rem', fontFamily: "'JetBrains Mono', monospace" }}
                  >
                    {stockTotal === 0 ? 'Sin stock' : 'Stock bajo'}
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {puedeEditar && (
              <button
                type="button"
                onClick={() => setEditing(true)}
                className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                aria-label="Editar producto"
                title="Editar"
              >
                <Pencil size={15} />
              </button>
            )}
            {puedeEliminar && (
              <button
                type="button"
                onClick={() => setConfirmDelete(true)}
                className="p-2 text-muted-foreground hover:text-primary hover:bg-muted transition-colors"
                aria-label="Eliminar producto"
                title="Eliminar"
              >
                <Trash2 size={15} />
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              aria-label="Cerrar"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {loading && !full ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 size={20} className="text-primary animate-spin" />
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <Info label="Categoría" value={p.categoria.nombre} icon={Tag} />
                <Info
                  label="Marca"
                  value={p.marca?.nombre ?? 'Sin marca'}
                  icon={Truck}
                />
                <Info
                  label="Unidad"
                  value={`${p.unidadMedida.nombre} (${p.unidadMedida.abreviatura})`}
                  icon={Ruler}
                />
                <Info
                  label="Stock"
                  value={`${stockTotal.toLocaleString('es-CO')} (mín ${minimo})`}
                  icon={BarChart3}
                  accent={bajo ? 'text-amber-400' : 'text-secondary'}
                />
                {p.stockMaximo != null && (
                  <Info
                    label="Stock máx."
                    value={Number(p.stockMaximo).toLocaleString('es-CO')}
                    icon={BarChart3}
                  />
                )}
                <Info
                  label="Precio"
                  value={formatPesos(p.precio)}
                  icon={DollarSign}
                />
              </div>

              {p.bodega && (
                <div
                  className="flex items-center gap-2 text-xs text-muted-foreground px-3 py-2 bg-muted/40 border border-border"
                  style={{ borderRadius: '0.25rem', fontFamily: "'JetBrains Mono', monospace" }}
                >
                  <MapPin size={12} className="text-primary" />
                  Bodega: {p.bodega.nombre}
                </div>
              )}

              {p.descripcion && (
                <div>
                  <div
                    className="text-[10px] text-muted-foreground uppercase tracking-widest mb-1.5"
                    style={{ fontFamily: "'JetBrains Mono', monospace" }}
                  >
                    Descripción
                  </div>
                  <p
                    className="text-sm text-foreground whitespace-pre-wrap"
                    style={{ fontFamily: "'DM Sans', sans-serif" }}
                  >
                    {p.descripcion}
                  </p>
                </div>
              )}

              {/* Conversiones */}
              {p.conversiones && p.conversiones.length > 0 && (
                <div>
                  <div
                    className="text-[10px] text-muted-foreground uppercase tracking-widest mb-2"
                    style={{ fontFamily: "'JetBrains Mono', monospace" }}
                  >
                    Conversiones de unidad
                  </div>
                  <ul className="space-y-1">
                    {p.conversiones.map((c) => (
                      <li
                        key={c.id}
                        className="flex items-center justify-between text-xs bg-muted/40 border border-border px-3 py-1.5"
                        style={{ borderRadius: '0.25rem' }}
                      >
                        <span style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                          1 {c.unidadOrigen.abreviatura} = {c.factorConversion}{' '}
                          {c.unidadDestino.abreviatura}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Proveedores */}
              {proveedores.length > 0 && (
                <div>
                  <div
                    className="text-[10px] text-muted-foreground uppercase tracking-widest mb-2"
                    style={{ fontFamily: "'JetBrains Mono', monospace" }}
                  >
                    Proveedores
                  </div>
                  <ul className="space-y-1">
                    {proveedores.map((pp) => (
                      <li
                        key={pp.proveedor.id}
                        className="flex items-center justify-between text-xs bg-muted/40 border border-border px-3 py-1.5"
                        style={{ borderRadius: '0.25rem' }}
                      >
                        <span>
                          {pp.proveedor.nombre}
                          {pp.proveedor.ruc ? ` · RUC ${pp.proveedor.ruc}` : ''}
                        </span>
                        <span
                          className="text-muted-foreground"
                          style={{ fontFamily: "'JetBrains Mono', monospace" }}
                        >
                          {formatPesos(pp.precioCompra)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Documentos */}
              <div>
                <div
                  className="flex items-center justify-between mb-2"
                  style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800 }}
                >
                  <div className="text-sm uppercase text-foreground tracking-wider">
                    Documentos
                  </div>
                  <div
                    className="text-[10px] text-muted-foreground"
                    style={{ fontFamily: "'JetBrains Mono', monospace" }}
                  >
                    {p.documentos.length} archivo{p.documentos.length === 1 ? '' : 's'}
                  </div>
                </div>

                {p.documentos.length === 0 ? (
                  <div
                    className="bg-muted/30 border border-border py-6 px-3 text-center text-xs text-muted-foreground"
                    style={{ borderRadius: '0.25rem' }}
                  >
                    Este producto no tiene documentos asociados.
                  </div>
                ) : (
                  <ul className="space-y-2">
                    {p.documentos.map((d) => (
                      <li
                        key={d.id}
                        className="flex items-center gap-3 p-3 bg-muted/30 border border-border"
                        style={{ borderRadius: '0.25rem' }}
                      >
                        <div className="w-9 h-9 bg-card flex items-center justify-center shrink-0 overflow-hidden">
                          {d.mimeType.startsWith('image/') ? (
                            (() => {
                              const src = imageUrl(d.imageUrl ?? d.url)
                              return src ? (
                                <img
                                  src={src}
                                  alt={d.nombre}
                                  className="w-full h-full object-cover"
                                  loading="lazy"
                                />
                              ) : (
                                <ImageIcon size={16} className="text-secondary" />
                              )
                            })()
                          ) : (
                            <FileText size={16} className="text-primary" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div
                            className="text-sm text-foreground truncate"
                            style={{ fontFamily: "'DM Sans', sans-serif", fontWeight: 500 }}
                          >
                            {d.nombre}
                          </div>
                          <div
                            className="text-[10px] text-muted-foreground"
                            style={{ fontFamily: "'JetBrains Mono', monospace" }}
                          >
                            {d.tipo} · {(d.sizeBytes / 1024).toFixed(0)} KB
                          </div>
                        </div>
                        <a
                          href={imageUrl(d.imageUrl ?? d.url) ?? '#'}
                          target="_blank"
                          rel="noreferrer"
                          className="p-1.5 text-muted-foreground hover:text-foreground transition-colors"
                          aria-label="Abrir en pestaña nueva"
                        >
                          <ExternalLink size={14} />
                        </a>
                        <a
                          href={imageUrl(d.imageUrl ?? d.url) ?? '#'}
                          download={d.nombre}
                          className="p-1.5 text-muted-foreground hover:text-foreground transition-colors"
                          aria-label="Descargar"
                        >
                          <Download size={14} />
                        </a>
                        <button
                          type="button"
                          onClick={() => handleEliminarDoc(d.id)}
                          disabled={deletingId === d.id}
                          className="p-1.5 text-muted-foreground hover:text-primary transition-colors disabled:opacity-50"
                          aria-label="Eliminar"
                        >
                          {deletingId === d.id ? (
                            <Loader2 size={14} className="animate-spin" />
                          ) : (
                            <X size={14} />
                          )}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </>
          )}
        </div>

        <div className="p-4 border-t border-border flex items-center justify-end shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center gap-2 px-4 py-2 border border-border text-sm text-foreground hover:border-foreground/30 transition-colors"
            style={{ borderRadius: '0.25rem' }}
          >
            <CircleCheck size={14} />
            Cerrar
          </button>
        </div>
      </div>

      {editing && full && (
        <EditarProductoModal
          producto={full}
          onClose={() => setEditing(false)}
          onSaved={handleSaved}
        />
      )}

      {confirmDelete && (
        <div
          className="fixed inset-0 z-[60] bg-background/80 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => !deleting && setConfirmDelete(false)}
        >
          <div
            className="bg-card border border-border w-full max-w-sm p-5 space-y-4"
            style={{ borderRadius: '0.25rem' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-primary/15 flex items-center justify-center shrink-0">
                <Trash2 size={18} className="text-primary" />
              </div>
              <div>
                <h3
                  className="text-lg uppercase text-foreground"
                  style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900 }}
                >
                  ¿Eliminar producto?
                </h3>
                <p
                  className="text-xs text-muted-foreground mt-0.5"
                  style={{ fontFamily: "'DM Sans', sans-serif" }}
                >
                  Se va a borrar "{p.nombre}" junto con su stock, alertas y documentos. No se puede deshacer.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setConfirmDelete(false)}
                disabled={deleting}
                className="flex-1 py-2.5 border border-border text-sm text-foreground hover:border-foreground/30 transition-colors disabled:opacity-50"
                style={{ borderRadius: '0.25rem' }}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleEliminarProducto}
                disabled={deleting}
                className="flex-1 py-2.5 bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-60 inline-flex items-center justify-center gap-2"
                style={{ borderRadius: '0.25rem' }}
              >
                {deleting ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    Eliminando…
                  </>
                ) : (
                  <>
                    <Trash2 size={14} />
                    Sí, eliminar
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function Info({
  label,
  value,
  icon: Icon,
  accent,
}: {
  label: string
  value: string
  icon: typeof Package
  accent?: string
}) {
  return (
    <div className="bg-muted/30 border border-border p-3" style={{ borderRadius: '0.25rem' }}>
      <div
        className="flex items-center gap-1.5 text-[10px] text-muted-foreground uppercase tracking-widest mb-1"
        style={{ fontFamily: "'JetBrains Mono', monospace" }}
      >
        <Icon size={11} />
        {label}
      </div>
      <div
        className={`text-sm font-semibold ${accent ?? 'text-foreground'}`}
        style={{ fontFamily: "'DM Sans', sans-serif" }}
      >
        {value}
      </div>
    </div>
  )
}
