import { Lock, ArrowLeft } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

/**
 * Pantalla que se muestra cuando el usuario no tiene permiso para acceder
 * a una sección. Incluye link de vuelta al dashboard.
 */
export function Forbidden() {
  const navigate = useNavigate()
  return (
    <div className="flex-1 flex items-center justify-center p-12 bg-background">
      <div className="text-center max-w-md">
        <div className="inline-flex w-14 h-14 bg-primary/15 items-center justify-center mb-5">
          <Lock size={24} className="text-primary" />
        </div>
        <h2
          className="text-3xl uppercase text-foreground leading-none"
          style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900 }}
        >
          Sin permisos
        </h2>
        <p
          className="mt-3 text-sm text-muted-foreground"
          style={{ fontFamily: "'DM Sans', sans-serif" }}
        >
          No tenés permiso para acceder a esta sección. Si creés que es un
          error, contactá al administrador.
        </p>
        <button
          onClick={() => navigate('/dashboard')}
          className="mt-6 inline-flex items-center gap-2 px-4 py-2 border border-border text-sm text-foreground hover:border-foreground/30 transition-colors"
          style={{ borderRadius: '0.25rem' }}
        >
          <ArrowLeft size={14} />
          Volver al dashboard
        </button>
      </div>
    </div>
  )
}
