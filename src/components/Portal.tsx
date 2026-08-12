import { useEffect, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

/**
 * Renderiza `children` directamente en el `<body>` para escapar de cualquier
 * contenedor con `transform`, `filter`, `perspective` u `overflow: hidden`
 * que rompa el `position: fixed` y deje al modal confinado a un subset del
 * viewport.
 *
 * Útil para modales, drawers, toasts y menús flotantes que necesitan vivir
 * en el viewport real, no en un padre con layout.
 */
export function Portal({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) return null
  if (typeof document === 'undefined') return null

  return createPortal(children, document.body)
}
