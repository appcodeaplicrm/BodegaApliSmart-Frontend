/**
 * Modal con `createPortal(document.body)`.
 *
 * Esto es importante cuando el modal se renderiza dentro de un
 * contenedor con `overflow-y-auto` (como el `<main>` de AppLayout)
 * o cualquier contenedor que cree un stacking context. Sin el
 * portal, el modal queda "atrapado" dentro del contenedor y
 * queda detrás de headers/sidebars o no cubre el 100% de la
 * pantalla.
 *
 * Con el portal, el modal se monta como hijo directo de `<body>`,
 * así que su `position: fixed; inset: 0` cubre TODO el viewport
 * y su z-index es independiente del resto del layout.
 */
import { useEffect, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

type Props = {
  /** Z-index base. Default 100. Si necesitás un modal encima de otro, pasalo más alto. */
  zIndex?: number
  /** Si true, ocupa el 100% del viewport (default). Si false, centra con items-center. */
  full?: boolean
  /** Padding desde los bordes del viewport. */
  padding?: string
  children: ReactNode
}

export function Modal({ zIndex = 100, full = true, padding = 'p-2 sm:p-4', children }: Props) {
  // El portal requiere `document.body` que solo existe en el browser.
  // Usamos un mount flag para no romper el SSR (aunque acá no hay
  // SSR real, es una buena práctica).
  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) return null

  const containerClass = full
    ? 'fixed inset-0 bg-black/70 backdrop-blur-sm flex items-stretch justify-center'
    : 'fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm flex items-center justify-center'

  return createPortal(
    <div
      className={`${containerClass} ${padding}`}
      style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex }}
    >
      {children}
    </div>,
    document.body,
  )
}
