import { useState, useRef, useEffect, type FormEvent } from 'react'
import { X, Plus, Loader2 } from 'lucide-react'
import { api, ApiError } from '../lib/api'

type Props = {
  /** Título del modal ("Crear categoría", "Crear marca", etc.) */
  titulo: string
  /** Label del campo de texto */
  label: string
  /** Placeholder del input */
  placeholder: string
  /** Endpoint del back al que hacer POST (devuelve el item creado) */
  endpoint: string
  /**
   * Bodega a la que se atará el item (scope multi-tenant).
   * Requerido para `/categorias` y `/marcas`. Opcional para `/proveedores`
   * (que sigue siendo global).
   */
  bodegaId?: string
  /** Callback con el item creado. Se usa para agregarlo al select. */
  onCreated: (item: { id: string; nombre: string }) => void
  /** Si hay un valor actual seleccionado, se lo pasamos para resaltarlo. */
  onClose: () => void
}

/**
 * Mini modal genérico para crear una entrada en cualquiera de los catálogos
 * (categorías, marcas, proveedores). El back hace upsert por nombre, así que
 * no hace falta pasarle más campos.
 */
export function ModalCrearCatalogo({
  titulo,
  label,
  placeholder,
  endpoint,
  bodegaId,
  onCreated,
  onClose,
}: Props) {
  const [nombre, setNombre] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    // Foco automático al abrir
    setTimeout(() => inputRef.current?.focus(), 50)
  }, [])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    if (!nombre.trim()) {
      setError('El nombre es obligatorio.')
      return
    }
    setSubmitting(true)
    try {
      // Usar el helper `api.post` (no fetch crudo) para que se manden
      // las cookies httpOnly Y se haga el auto-refresh del access token
      // si venció.
      const body: Record<string, string> = { nombre: nombre.trim() }
      // Todos los catálogos (categorías, marcas, proveedores) son per-bodega.
      if (bodegaId) {
        body.bodegaId = bodegaId
      } else if (endpoint === '/categorias' || endpoint === '/marcas' || endpoint === '/proveedores') {
        throw new Error('Falta bodegaId para crear el catálogo.')
      }
      const item = await api.post<{ id: string; nombre: string }>(endpoint, body)
      onCreated(item)
      onClose()
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? Array.isArray(err.payload)
            ? err.message
            : err.message
          : err instanceof Error
            ? err.message
            : 'No se pudo guardar.'
      setError(msg)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-[70] bg-background/80 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-card border border-border w-full max-w-sm"
        style={{ borderRadius: '0.25rem' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-primary/15 flex items-center justify-center">
              <Plus size={14} className="text-primary" />
            </div>
            <h3
              className="text-base uppercase text-foreground"
              style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900 }}
            >
              {titulo}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Cerrar"
          >
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-3">
          <div>
            <label
              className="text-xs text-muted-foreground tracking-widest uppercase mb-1.5 block"
              style={{ fontFamily: "'JetBrains Mono', monospace" }}
            >
              {label} *
            </label>
            <input
              ref={inputRef}
              type="text"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder={placeholder}
              className="w-full px-3 py-2.5 bg-muted border border-border text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/60 transition-colors"
              style={{ borderRadius: '0.25rem', fontFamily: "'DM Sans', sans-serif" }}
            />
          </div>

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
              className="flex-1 py-2.5 border border-border text-sm text-foreground hover:border-foreground/30 transition-colors disabled:opacity-50"
              style={{ borderRadius: '0.25rem' }}
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting}
              className="flex-1 py-2.5 bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-60 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
              style={{ borderRadius: '0.25rem' }}
            >
              {submitting ? (
                <>
                  <Loader2 size={13} className="animate-spin" />
                  Guardando…
                </>
              ) : (
                'Guardar'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
