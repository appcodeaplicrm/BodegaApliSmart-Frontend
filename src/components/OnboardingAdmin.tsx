import { useState, type FormEvent } from 'react'
import { ArrowRight, Warehouse, MapPin } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { bodegasStore } from '../store/bodegas'
import { ApiError } from '../lib/api'
import { authStore } from '../store/auth'
import { MapaSelector } from './MapaSelector'

/**
 * Onboarding para el admin (o cualquier rol con `inventario.crear`).
 * Se muestra cuando el usuario no tiene bodegas asignadas.
 * Layout 2 columnas: copy a la izquierda, form a la derecha.
 */
export function OnboardingAdmin() {
  const navigate = useNavigate()
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
      await bodegasStore.crear({
        nombre: nombre.trim(),
        direccion: direccion.trim() || undefined,
      })
      // Refrescar la sesión para que el back devuelva el bodegaId nuevo.
      await authStore.bootstrap()
      navigate('/dashboard', { replace: true })
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
    <div className="h-screen w-screen bg-background flex overflow-hidden">
      {/* ─── Lado izquierdo: copy + branding ──────────────── */}
      <aside className="hidden lg:flex lg:w-1/2 relative border-r border-border p-12 flex-col justify-between overflow-hidden">
        {/* fondo decorativo */}
        <div
          className="absolute inset-0 opacity-[0.03] pointer-events-none"
          style={{
            backgroundImage:
              'linear-gradient(rgba(255,255,255,1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,1) 1px, transparent 1px)',
            backgroundSize: '40px 40px',
          }}
        />
        <div className="absolute top-[-80px] left-[-80px] w-72 h-72 rounded-full bg-primary opacity-10 blur-3xl pointer-events-none" />
        <div className="absolute bottom-[-60px] right-[-60px] w-56 h-56 rounded-full bg-secondary opacity-10 blur-3xl pointer-events-none" />

        <div className="relative z-10">
          <div
            className="text-foreground text-2xl tracking-wider"
            style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900 }}
          >
            WINERY SMART
          </div>
        </div>

        <div className="relative z-10 max-w-md">
          <div className="inline-flex w-16 h-16 bg-primary/15 items-center justify-center mb-6">
            <Warehouse size={28} className="text-primary" />
          </div>
          <h1
            className="text-5xl xl:text-6xl uppercase leading-none text-foreground"
            style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900 }}
          >
            Creá tu primera <span className="text-primary">bodega</span>
          </h1>
          <p
            className="mt-5 text-base text-muted-foreground leading-relaxed"
            style={{ fontFamily: "'DM Sans', sans-serif" }}
          >
            Para empezar a operar necesitás al menos una bodega. Después vas a
            poder crear más desde el módulo de bodegas.
          </p>

          <ul className="mt-8 space-y-3">
            <Bullet text="Definí un nombre que tu equipo reconozca fácil" />
            <Bullet text="Marcá la ubicación en el mapa para geolocalizar despachos" />
            <Bullet text="Podés agregar o cambiar bodegas cuando quieras" />
          </ul>
        </div>

        <div className="relative z-10">
          <div
            className="text-xs text-muted-foreground tracking-widest"
            style={{ fontFamily: "'JetBrains Mono', monospace" }}
          >
            powered by OpenStreetMap · Nominatim
          </div>
        </div>
      </aside>

      {/* ─── Lado derecho: form ───────────────────────────── */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 py-6 overflow-hidden">
        <div className="max-w-md w-full">
          {/* header mobile (solo cuando no hay aside) */}
          <div className="lg:hidden mb-8">
            <div
              className="text-foreground text-2xl tracking-wider mb-4"
              style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900 }}
            >
              WINERY SMART
            </div>
            <div className="inline-flex w-12 h-12 bg-primary/15 items-center justify-center mb-3">
              <Warehouse size={20} className="text-primary" />
            </div>
            <h1
              className="text-3xl uppercase text-foreground leading-none"
              style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900 }}
            >
              Creá tu primera <span className="text-primary">bodega</span>
            </h1>
            <p
              className="mt-2 text-sm text-muted-foreground"
              style={{ fontFamily: "'DM Sans', sans-serif" }}
            >
              Para empezar a operar necesitás al menos una bodega. Después vas
              a poder crear más desde el módulo de bodegas.
            </p>
          </div>

          <form
            onSubmit={handleSubmit}
            className="bg-card border border-border p-5 space-y-4"
            style={{ borderRadius: '0.25rem' }}
          >
            <div>
              <label
                htmlFor="nombre"
                className="flex items-center gap-1.5 text-xs text-muted-foreground tracking-widest uppercase mb-1.5"
                style={{ fontFamily: "'JetBrains Mono', monospace" }}
              >
                Nombre de la bodega
                <span className="text-primary">*</span>
              </label>
              <input
                id="nombre"
                type="text"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                placeholder="Ej: Bodega Central"
                className="w-full px-3 py-2.5 bg-muted border border-border text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/60 transition-colors"
                style={{ borderRadius: '0.25rem', fontFamily: "'DM Sans', sans-serif" }}
              />
            </div>

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
              <p
                className="text-xs text-primary bg-primary/10 border border-primary/20 px-3 py-2"
                style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  borderRadius: '0.25rem',
                }}
              >
                ⚠ {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full inline-flex items-center justify-center gap-2 py-3 bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
              style={{ borderRadius: '0.25rem' }}
            >
              {loading ? (
                'Creando…'
              ) : (
                <>
                  Crear bodega y entrar
                  <ArrowRight size={14} />
                </>
              )}
            </button>
          </form>
        </div>
      </main>
    </div>
  )
}

function Bullet({ text }: { text: string }) {
  return (
    <li
      className="flex items-start gap-2 text-sm text-muted-foreground"
      style={{ fontFamily: "'DM Sans', sans-serif" }}
    >
      <span className="mt-2 w-1 h-1 bg-secondary shrink-0" />
      <span>{text}</span>
    </li>
  )
}
