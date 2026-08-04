import { useNavigate } from 'react-router-dom'
import { Clock, LogOut, Warehouse } from 'lucide-react'
import { authStore } from '../store/auth'
import { useAuth } from '../store/auth'

/**
 * Pantalla que se muestra a usuarios no-admin que aún no tienen bodega asignada.
 * Les decimos que esperen a que un admin los asigne. No hay form.
 */
export function WaitingForBodega() {
  const auth = useAuth()
  const navigate = useNavigate()
  const usuario = auth.status === 'autenticado' ? auth.sesion.usuario : null

  async function handleLogout() {
    await authStore.logout()
    navigate('/', { replace: true })
  }

  return (
    <div className="h-screen w-screen bg-background flex items-center justify-center p-6">
      <div className="w-full max-w-md text-center">
        <div className="inline-flex w-14 h-14 bg-secondary/15 items-center justify-center mb-5">
          <Clock size={24} className="text-secondary" />
        </div>
        <h1
          className="text-3xl uppercase text-foreground leading-none"
          style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900 }}
        >
          Esperá a ser asignado
        </h1>
        <p
          className="mt-3 text-sm text-muted-foreground"
          style={{ fontFamily: "'DM Sans', sans-serif" }}
        >
          Tu usuario todavía no está asociado a ninguna bodega. Un administrador
          va a asignarte una y vas a poder entrar al sistema automáticamente.
        </p>

        <div
          className="mt-6 inline-flex items-center gap-2 bg-card border border-border px-4 py-2"
          style={{ borderRadius: '0.25rem' }}
        >
          <Warehouse size={14} className="text-muted-foreground" />
          <span
            className="text-xs text-muted-foreground"
            style={{ fontFamily: "'JetBrains Mono', monospace" }}
          >
            {usuario?.email}
          </span>
        </div>

        <div className="mt-8">
          <button
            onClick={handleLogout}
            className="inline-flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
            style={{ fontFamily: "'JetBrains Mono', monospace" }}
          >
            <LogOut size={12} />
            CERRAR SESIÓN
          </button>
        </div>
      </div>
    </div>
  )
}
