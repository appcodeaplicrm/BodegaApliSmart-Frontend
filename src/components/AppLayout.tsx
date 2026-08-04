import type { ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import { Sidebar } from './Sidebar'

/**
 * AppLayout — wrapper compartido por todas las vistas autenticadas.
 *
 *  - Muestra el `Sidebar` (que ya tiene el botón de logout).
 *  - Pasa `active` y `subKey` sacándolos del pathname actual, así
 *    el sidebar marca el item activo sin que cada ruta tenga que
 *    pasarlos manualmente.
 *  - `onExit` viene del padre (App.tsx) y hace logout + reset de
 *    stores + redirect a /.
 *
 * Antes esto vivía dentro de `Dashboard.tsx`, pero al haber múltiples
 * vistas autenticadas (Dashboard, AdminTenants, futuras), centralizamos
 * el layout acá.
 */
export function AppLayout({
  onExit,
  children,
}: {
  onExit: () => void
  children: ReactNode
}) {
  const location = useLocation()
  // Parsea el path: /inventario → active='inventario', /admin/tenants → active='admin', subKey='tenants'
  const segments = location.pathname.split('/').filter(Boolean)
  const active = segments[0] ?? 'dashboard'
  const subKey = segments[1]

  return (
    <div className="h-screen bg-background text-foreground flex overflow-hidden">
      <Sidebar active={active} subKey={subKey} onLogout={onExit} />
      <main className="flex-1 min-w-0 min-h-0 overflow-y-auto">{children}</main>
    </div>
  )
}
