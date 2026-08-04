import { useState, type FormEvent } from 'react'
import { X, Warehouse, MapPin, ArrowRight, CircleAlert } from 'lucide-react'
import { bodegasStore } from '../store/bodegas'
import { ApiError } from '../lib/api'
import { MapaSelector } from './MapaSelector'

type AgregarBodegaModalProps = {
  onClose: () => void
  /** Se llama con la bodega recién creada (id + nombre). */
  onCreated?: (bodega: { id: string; nombre: string }) => void
}

/**
 * Modal para crear una bodega nueva desde el sidebar (o desde donde
 * lo invoquemos). Mismo shape de form que el `OnboardingAdmin`, pero
 * con un layout modal: header con título, form con nombre + mapa, footer
 * con cancelar/crear.
 */
export function AgregarBodegaModal({ onClose, onCreated }: AgregarBodegaModalProps) {
  const [nombre, setNombre] = useState('')
  const [direccion, setDireccion] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    if (nombre.trim().length < 2) {
      setError('El nombre de la bodega debe tener al menos 2 caracteres.')
      return
    }
    setLoading(true)
    try {
      const creada = await bodegasStore.crear({
        nombre: nombre.trim(),
        direccion: direccion.trim() || undefined,
      })
      onCreated?.({ id: creada.id, nombre: creada.nombre })
      onClose()
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 409) {
          setError('Ya existe una bodega con ese nombre.')
        } else {
          setError(err.message)
        }
      } else {
        setError('No se pudo conectar con el servidor.')
      }
    } finally {
      setLoading(false)
    }
  }

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
        {/* HEADER */}
        <div className="flex items-center justify-between p-5 border-b border-border shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-primary/15 flex items-center justify-center">
              <Warehouse size={16} className="text-primary" />
            </div>
            <div>
              <h2
                className="text-xl uppercase text-foreground leading-none"
                style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900 }}
              >
                Agregar bodega
              </h2>
              <p
                className="mt-1 text-xs text-muted-foreground"
                style={{ fontFamily: "'DM Sans', sans-serif" }}
              >
                Definí un nombre y marcá la ubicación en el mapa
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={loading}
            className="text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
          >
            <X size={18} />
          </button>
        </div>

        {/* FORM */}
        <form
          onSubmit={handleSubmit}
          className="flex-1 overflow-y-auto"
        >
          <div className="p-5 space-y-4">
            {/* NOMBRE */}
            <div>
              <label
                htmlFor="nombre-bodega"
                className="flex items-center gap-1.5 text-xs text-muted-foreground tracking-widest uppercase mb-1.5"
                style={{ fontFamily: "'JetBrains Mono', monospace" }}
              >
                Nombre de la bodega
                <span className="text-primary">*</span>
              </label>
              <input
                id="nombre-bodega"
                type="text"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                placeholder="Ej: Bodega Central"
                autoFocus
                disabled={loading}
                className="w-full px-3 py-2.5 bg-muted border border-border text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/60 transition-colors disabled:opacity-50"
                style={{ borderRadius: '0.25rem', fontFamily: "'DM Sans', sans-serif" }}
              />
            </div>

            {/* MAPA */}
            <div>
              <label
                className="flex items-center gap-1.5 text-xs text-muted-foreground tracking-widest uppercase mb-1.5"
                style={{ fontFamily: "'JetBrains Mono', monospace" }}
              >
                <MapPin size={11} />
                Ubicación
                <span className="text-muted-foreground/60 normal-case tracking-normal ml-1">
                  (opcional)
                </span>
              </label>
              <p
                className="text-xs text-muted-foreground mb-2"
                style={{ fontFamily: "'DM Sans', sans-serif" }}
              >
                Buscá la dirección o hacé click directamente en el mapa.
              </p>
              <MapaSelector value={direccion} onChange={(d) => setDireccion(d)} />
            </div>

            {error && (
              <div
                className="flex items-start gap-2 text-xs text-primary bg-primary/10 border border-primary/20 px-3 py-2"
                style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  borderRadius: '0.25rem',
                }}
              >
                <CircleAlert size={13} className="mt-0.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}
          </div>

          {/* FOOTER */}
          <div className="p-4 border-t border-border flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="flex-1 py-2.5 border border-border text-sm text-foreground hover:border-foreground/30 transition-colors disabled:opacity-50"
              style={{ borderRadius: '0.25rem' }}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-2.5 bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50 inline-flex items-center justify-center gap-2"
              style={{ borderRadius: '0.25rem' }}
            >
              {loading ? (
                <>
                  <span
                    className="w-3.5 h-3.5 border-2 border-primary-foreground/40 border-t-primary-foreground rounded-full animate-spin"
                    aria-hidden
                  />
                  Creando…
                </>
              ) : (
                <>
                  Crear bodega
                  <ArrowRight size={14} />
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
