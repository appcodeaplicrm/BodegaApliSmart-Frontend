import { useEffect, useState, type ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import { Menu } from 'lucide-react'
import { Sidebar } from './Sidebar'
import { HeaderNotificationsButton } from './HeaderNotificationsButton'
import { GlobalAiAssistant } from './AiAssistantCenter'

/**
 * AppLayout — wrapper compartido por todas las vistas autenticadas.
 *
 * Responsive:
 *  - En desktop (>=lg) el Sidebar vive como columna fija a la izquierda.
 *  - En móvil (<lg) el Sidebar se renderiza como drawer superpuesto.
 *    Un header sticky arriba del <main> muestra el título del módulo
 *    y un botón hamburguesa para abrir el drawer. El drawer se cierra
 *    al cambiar de ruta, al pulsar Escape, o al tocar el backdrop.
 *
 * Pasa `active` y `subKey` al Sidebar sacándolos del pathname.
 */
export function AppLayout({
  onExit,
  children,
}: {
  onExit: () => void
  children: ReactNode
}) {
  const location = useLocation()
  const [mobileOpen, setMobileOpen] = useState(false)

  // Parsea el path: /inventario → active='inventario', /admin/tenants → active='admin', subKey='tenants'
  const segments = location.pathname.split('/').filter(Boolean)
  const active = segments[0] ?? 'dashboard'
  const subKey = segments[1]

  // Cierra el drawer con Escape. El Sidebar también escucha cambios de
  // ruta, pero acá blindamos el caso de Escape sin navegación.
  useEffect(() => {
    if (!mobileOpen) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setMobileOpen(false)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [mobileOpen])

  // Cuando el drawer está abierto, bloqueamos el scroll del body para
  // que el usuario no scrollee el contenido detrás del backdrop.
  useEffect(() => {
    if (!mobileOpen) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [mobileOpen])

  return (
    <div className="authenticated-app h-dvh bg-background text-foreground flex overflow-hidden supports-[min-height:100dvh]:min-h-dvh">
      <Sidebar
        active={active}
        subKey={subKey}
        onLogout={onExit}
        mobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
      />

      <div className="flex-1 min-w-0 min-h-0 flex flex-col">
        {/* Header móvil: solo se ve en <lg. Muestra el nombre del módulo
            y el toggle del drawer. En desktop cada vista pone su propio
            PageHeader sin que haya doble header. */}
        <header
          className="lg:hidden h-12 shrink-0 border-b border-border bg-card flex items-center gap-2 px-3 sticky top-0 z-30"
          style={{ paddingTop: 'env(safe-area-inset-top)' }}
        >
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            aria-label="Abrir menú"
            className="min-h-[44px] min-w-[44px] flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            style={{ borderRadius: '0.25rem' }}
          >
            <Menu size={18} />
          </button>
          <span
            className="text-sm uppercase tracking-wider text-foreground truncate"
            style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800 }}
          >
            {prettyTitle(active, subKey)}
          </span>
          <div className="ml-auto">
            <HeaderNotificationsButton />
          </div>
        </header>

        <main className="flex-1 min-w-0 min-h-0 overflow-y-auto">{children}</main>
      </div>
      <GlobalAiAssistant />
    </div>
  )
}

/**
 * Traduce el `active` del router a un label legible para el header móvil.
 * Si no encuentra el módulo en la lista, devuelve el `active` en mayúsculas.
 */
function prettyTitle(active: string, subKey?: string): string {
  const labels: Record<string, string> = {
    dashboard: 'Dashboard',
    inventario: 'Inventario',
    alertas: 'Alertas',
    auditoria: 'Auditoría',
    movimientos: 'Movimientos',
    despachos: 'Despachos',
    ordenes: 'Órdenes',
    devoluciones: 'Devoluciones',
    usuarios: 'Usuarios',
    roles: 'Roles',
    tecnicos: 'Técnicos',
    reportes: 'Reportes',
    perfil: 'Perfil',
  }
  const base = labels[active] ?? active.toUpperCase()
  return subKey ? `${base} · ${subKey}` : base
}
