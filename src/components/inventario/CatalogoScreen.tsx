/**
 * CatalogoScreen — pantalla genérica de CRUD para los catálogos de
 * inventario (Categorías, Marcas, Proveedores).
 *
 * Es reutilizable: las 3 vistas pasan la config (endpoint, etiqueta,
 * icono) y este componente se encarga de la lista, búsqueda, modal
 * de crear/editar, confirmar eliminar, manejo de errores, toasts.
 *
 * Diseño:
 *  - Header con título + contador + botón "Nuevo"
 *  - Input de búsqueda full-width (filtra en cliente, instantáneo)
 *  - Lista de cards/filas: nombre + (opcional) subtexto (RUC en proveedores)
 *  - Cada item tiene botones "Editar" y "Eliminar" (Eliminar con confirm)
 *  - Modal de crear/editar inline (no navega)
 *
 * Endpoints esperados:
 *   GET    /<endpoint>?bodegaId=X      → Item[]
 *   POST   /<endpoint>                  { nombre, bodegaId? } → Item
 *   PATCH  /<endpoint>/:id              { nombre } → Item
 *   DELETE /<endpoint>/:id              204 No Content
 *
 * Categorías y Marcas son per-bodega (mandan bodegaId en POST).
 * Proveedores es global (no manda bodegaId).
 * Eso lo decide el caller pasando `requiereBodega: true|false`.
 */
import { useState, useEffect, useMemo } from 'react'
import { Plus, Search, Pencil, Trash2, Tag, X, Loader2 } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { api, ApiError } from '../../lib/api'
import { useBodegaActiva } from '../../store/bodegaActiva'
import { Modal } from '../Modal'
import { PageHeader } from '../PageHeader'

type Item = { id: string; nombre: string; ruc?: string | null }

export type CatalogoConfig = {
  /** Identificador de la pantalla, ej: 'categorias', 'marcas', 'proveedores' */
  key: 'categorias' | 'marcas' | 'proveedores' | 'ubicaciones'
  /** Título que se muestra en el header */
  titulo: string
  /** Endpoint base (sin slash inicial) */
  endpoint: string
  /** Etiqueta singular ("la categoría", "la marca", "el proveedor") */
  labelSingular: string
  /** Placeholder del input de nombre */
  placeholderNombre: string
  /** Icono de Lucide para el header y el item */
  icon: LucideIcon
  /** Si requiere bodegaId para listar/crear (true para categorías y marcas) */
  requiereBodega: boolean
  /** Etiqueta del campo extra (solo proveedores: "RUC") */
  campoExtra?: { key: 'ruc'; label: string; placeholder: string }
}

export function CatalogoScreen({ config }: { config: CatalogoConfig }) {
  const Icon = config.icon
  const bodegaId = useBodegaActiva()

  const [items, setItems] = useState<Item[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [modal, setModal] = useState<{ open: boolean; item: Item | null }>({
    open: false,
    item: null,
  })
  const [confirmDelete, setConfirmDelete] = useState<Item | null>(null)

  // Carga inicial (y recarga cuando cambia la bodega)
  useEffect(() => {
    void cargar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bodegaId, config.key])

  async function cargar() {
    setLoading(true)
    setError('')
    try {
      const params = new URLSearchParams()
      if (config.requiereBodega && bodegaId) params.set('bodegaId', bodegaId)
      const qs = params.toString()
      const data = await api.get<Item[]>(
        `/${config.endpoint}${qs ? `?${qs}` : ''}`,
      )
      setItems(data)
    } catch (err) {
      const msg =
        err instanceof ApiError ? err.message : 'No se pudo cargar la lista.'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  const filtrados = useMemo(() => {
    if (!query.trim()) return items
    const q = query.toLowerCase()
    return items.filter(
      (i) =>
        i.nombre.toLowerCase().includes(q) ||
        (i.ruc ?? '').toLowerCase().includes(q),
    )
  }, [items, query])

  async function onSave(nombre: string, extra: Record<string, string>) {
    const body: Record<string, string> = { nombre: nombre.trim() }
    if (config.campoExtra && extra.ruc) body.ruc = extra.ruc.trim()
    if (config.requiereBodega) {
      if (!bodegaId) throw new Error('Sin bodega activa.')
      body.bodegaId = bodegaId
    }
    if (modal.item) {
      const updated = await api.patch<Item>(
        `/${config.endpoint}/${modal.item.id}`,
        body,
      )
      setItems((prev) => prev.map((i) => (i.id === updated.id ? updated : i)))
    } else {
      const created = await api.post<Item>(`/${config.endpoint}`, body)
      setItems((prev) => [created, ...prev])
    }
    setModal({ open: false, item: null })
  }

  async function onEliminar() {
    if (!confirmDelete) return
    await api.delete<void>(`/${config.endpoint}/${confirmDelete.id}`)
    setItems((prev) => prev.filter((i) => i.id !== confirmDelete.id))
    setConfirmDelete(null)
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      <PageHeader
        title={config.titulo}
        subtitle="BodegaApliSmart · INVENTARIO"
        actions={
          <button
            type="button"
            onClick={() => setModal({ open: true, item: null })}
            className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-3 py-2 text-xs font-semibold hover:bg-primary/90 transition-colors shrink-0"
            style={{ borderRadius: '0.25rem' }}
          >
            <Plus size={14} />
            Nueva {config.labelSingular}
          </button>
        }
      />

      <div className="flex flex-col flex-1 min-h-0 p-4 sm:p-6">

      {/* ── Búsqueda ───────────────────────────────────── */}
      <div className="relative mb-3">
        <Search
          size={14}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
        />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={`Buscar ${config.labelSingular}…`}
          autoComplete="off"
          className="w-full pl-9 pr-3 py-2.5 bg-muted border border-border text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/60 transition-colors"
          style={{ borderRadius: '0.25rem' }}
        />
      </div>

      {/* ── Contador ───────────────────────────────────── */}
      <div
        className="text-[10px] text-muted-foreground uppercase tracking-widest mb-2"
        style={{ fontFamily: "'JetBrains Mono', monospace" }}
      >
        {loading
          ? 'Cargando…'
          : `${filtrados.length} de ${items.length} ${
              items.length === 1 ? config.labelSingular : config.titulo.toLowerCase()
            }`}
      </div>

      {/* ── Lista ──────────────────────────────────────── */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        {error ? (
          <div className="bg-primary/10 border border-primary/30 px-4 py-3 text-sm text-primary" style={{ borderRadius: '0.25rem' }}>
            ⚠ {error}
          </div>
        ) : loading ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                className="bg-card border border-border h-16 animate-pulse"
                style={{ borderRadius: '0.25rem' }}
              />
            ))}
          </div>
        ) : filtrados.length === 0 ? (
          <div className="bg-card border border-border px-4 py-8 text-center" style={{ borderRadius: '0.25rem' }}>
            <Tag size={20} className="text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-foreground mb-1">
              {query
                ? `No hay coincidencias para "${query}".`
                : `Todavía no hay ${config.titulo.toLowerCase()}.`}
            </p>
            {!query && (
              <p className="text-xs text-muted-foreground">
                Creá la primera con el botón de arriba.
              </p>
            )}
          </div>
        ) : (
          <ul className="space-y-1.5">
            {filtrados.map((item) => (
              <li
                key={item.id}
                className="bg-card border border-border px-3 py-2.5 flex items-center gap-3 group hover:border-primary/30 transition-colors"
                style={{ borderRadius: '0.25rem' }}
              >
                <Icon
                  size={16}
                  className="text-muted-foreground group-hover:text-primary transition-colors shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <div
                    className="text-sm font-semibold text-foreground truncate"
                    style={{ fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: '0.01em' }}
                  >
                    {item.nombre}
                  </div>
                  {item.ruc && (
                    <div
                      className="text-[10px] text-muted-foreground"
                      style={{ fontFamily: "'JetBrains Mono', monospace" }}
                    >
                      RUC: {item.ruc}
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setModal({ open: true, item })}
                  className="shrink-0 inline-flex items-center justify-center min-w-[36px] min-h-[36px] sm:min-w-0 sm:min-h-0 sm:w-9 sm:h-9 text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                  style={{ borderRadius: '0.25rem' }}
                  title={`Editar ${config.labelSingular}`}
                  aria-label={`Editar ${item.nombre}`}
                >
                  <Pencil size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmDelete(item)}
                  className="shrink-0 inline-flex items-center justify-center min-w-[36px] min-h-[36px] sm:min-w-0 sm:min-h-0 sm:w-9 sm:h-9 text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                  style={{ borderRadius: '0.25rem' }}
                  title={`Eliminar ${config.labelSingular}`}
                  aria-label={`Eliminar ${item.nombre}`}
                >
                  <Trash2 size={14} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* ── Modal crear / editar ────────────────────────── */}
      <CatalogoFormModal
        open={modal.open}
        item={modal.item}
        config={config}
        onClose={() => setModal({ open: false, item: null })}
        onSave={onSave}
      />

      {/* ── Modal confirmar eliminar ───────────────────── */}
      <Modal
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        title={`Eliminar ${config.labelSingular}`}
        size="sm"
        icon={<Trash2 size={16} className="text-primary" />}
      >
        {confirmDelete && (
          <div className="p-4 sm:p-5">
            <p className="text-sm text-foreground mb-1">
              ¿Eliminar <strong>{confirmDelete.nombre}</strong>?
            </p>
            <p className="text-xs text-muted-foreground mb-4">
              Esta acción no se puede deshacer. Los productos que ya usan
              esta {config.labelSingular} no se verán afectados.
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setConfirmDelete(null)}
                className="flex-1 py-2.5 border border-border text-sm text-foreground hover:border-foreground/30 transition-colors"
                style={{ borderRadius: '0.25rem' }}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => void onEliminar()}
                className="flex-1 py-2.5 bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors inline-flex items-center justify-center gap-2"
                style={{ borderRadius: '0.25rem' }}
              >
                <Trash2 size={13} />
                Eliminar
              </button>
            </div>
          </div>
        )}
      </Modal>
      </div>
    </div>
  )
}

/**
 * Modal de crear / editar. Reutiliza el Modal base con los estilos
 * de la app. Maneja el estado del formulario y los errores.
 */
function CatalogoFormModal({
  open,
  item,
  config,
  onClose,
  onSave,
}: {
  open: boolean
  item: Item | null
  config: CatalogoConfig
  onClose: () => void
  onSave: (nombre: string, extra: Record<string, string>) => Promise<void>
}) {
  const [nombre, setNombre] = useState(item?.nombre ?? '')
  const [ruc, setRuc] = useState(item?.ruc ?? '')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // Reset cuando abre/cierra/cambia el item
  useEffect(() => {
    if (open) {
      setNombre(item?.nombre ?? '')
      setRuc(item?.ruc ?? '')
      setError('')
    }
  }, [open, item])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!nombre.trim()) {
      setError('El nombre es obligatorio.')
      return
    }
    setSubmitting(true)
    try {
      await onSave(nombre, { ruc })
    } catch (err) {
      const msg =
        err instanceof ApiError ? err.message : 'No se pudo guardar.'
      setError(msg)
    } finally {
      setSubmitting(false)
    }
  }

  const esEdicion = !!item
  const Icon = config.icon

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={esEdicion ? `Editar ${config.labelSingular}` : `Nueva ${config.labelSingular}`}
      size="sm"
      icon={<Icon size={16} className="text-primary" />}
    >
      <form onSubmit={handleSubmit} className="p-4 sm:p-5 space-y-3">
        <div>
          <label
            htmlFor="catalogo-nombre"
            className="text-[10px] text-muted-foreground tracking-widest uppercase mb-1.5 block"
            style={{ fontFamily: "'JetBrains Mono', monospace" }}
          >
            Nombre *
          </label>
          <input
            id="catalogo-nombre"
            type="text"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder={config.placeholderNombre}
            autoComplete="off"
            autoFocus
            className="w-full px-3 py-2.5 bg-muted border border-border text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/60 transition-colors"
            style={{ borderRadius: '0.25rem', fontFamily: "'DM Sans', sans-serif" }}
          />
        </div>

        {config.campoExtra && (
          <div>
            <label
              htmlFor="catalogo-ruc"
              className="text-[10px] text-muted-foreground tracking-widest uppercase mb-1.5 block"
              style={{ fontFamily: "'JetBrains Mono', monospace" }}
            >
              {config.campoExtra.label}
            </label>
            <input
              id="catalogo-ruc"
              type="text"
              value={ruc}
              onChange={(e) => setRuc(e.target.value)}
              placeholder={config.campoExtra.placeholder}
              autoComplete="off"
              className="w-full px-3 py-2.5 bg-muted border border-border text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/60 transition-colors"
              style={{ borderRadius: '0.25rem', fontFamily: "'DM Sans', sans-serif" }}
            />
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

        <div className="flex items-center gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="flex-1 py-2.5 border border-border text-sm text-foreground hover:border-foreground/30 transition-colors disabled:opacity-50 inline-flex items-center justify-center gap-2"
            style={{ borderRadius: '0.25rem' }}
          >
            <X size={13} />
            Cancelar
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="flex-1 py-2.5 bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-60 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
            style={{ borderRadius: '0.25rem' }}
          >
            {submitting ? (
              <>
                <Loader2 size={13} className="animate-spin" />
                Guardando…
              </>
            ) : esEdicion ? (
              'Guardar cambios'
            ) : (
              'Crear'
            )}
          </button>
        </div>
      </form>
    </Modal>
  )
}
