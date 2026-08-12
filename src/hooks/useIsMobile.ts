/**
 * Hook que detecta si el viewport está en mobile.
 *
 * El breakpoint por defecto es 640px (equivalente a `sm` en Tailwind)
 * — coincide con el resto de la app, que considera mobile <sm.
 *
 * Usa `matchMedia` con listener para que responda en tiempo real
 * a rotación de pantalla o resize de ventana (no requiere recargar).
 *
 * En SSR / antes del primer render, devuelve `false` (asumimos
 * desktop por default) para evitar saltos de layout en el primer paint.
 */
import { useEffect, useState } from 'react'

const DEFAULT_MOBILE_QUERY = '(max-width: 639px)'

export function useIsMobile(query: string = DEFAULT_MOBILE_QUERY): boolean {
  const [isMobile, setIsMobile] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false
    return window.matchMedia(query).matches
  })

  useEffect(() => {
    if (typeof window === 'undefined') return
    const mql = window.matchMedia(query)
    // Set inicial (en caso de que cambie entre el init y el effect)
    setIsMobile(mql.matches)
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches)
    // `addEventListener` es la API moderna; `addListener` es el fallback
    // para navegadores viejos (Safari < 14).
    if (mql.addEventListener) {
      mql.addEventListener('change', handler)
      return () => mql.removeEventListener('change', handler)
    } else {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      mql.addListener(handler as any)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return () => mql.removeListener(handler as any)
    }
  }, [query])

  return isMobile
}
