/**
 * Hook para que las pantallas que muestran catálogos locales
 * (categorías, marcas, proveedores, ubicaciones, unidades de medida)
 * re-fetcheen cuando llega un evento realtime de cambio en ese catálogo.
 *
 * Estos catálogos NO tienen store global (cada componente los carga
 * con un useEffect al montar o al cambiar de bodega). El RealtimeProvider
 * despacha un `CustomEvent('realtime:catalogo', { detail: { tipo } })`
 * en `window` cuando el back emite el evento. Este hook escucha esos
 * eventos y dispara el callback que vos pases.
 *
 * Ejemplo de uso en `InventarioV2`:
 *
 *   useCatalogoRealtime(['categoria', 'marca', 'proveedor'], () => {
 *     // Re-cargar los catálogos del modal de crear producto
 *     void recargarCatalogos()
 *   })
 *
 * El array de tipos es por si una pantalla muestra varios catálogos
 * y querés reaccionar a cualquiera de ellos con el mismo callback.
 */
import { useEffect, useRef } from 'react'

export type CatalogoTipo =
  | 'categoria'
  | 'marca'
  | 'proveedor'
  | 'ubicacion'
  | 'unidad-medida'

const CATALOG_EVENT = 'realtime:catalogo'

export function useCatalogoRealtime(
  tipos: CatalogoTipo[],
  callback: () => void,
): void {
  // Mismo patrón que useRealtimeEvent: ref para evitar re-suscripción
  // en cada render pero ejecutar siempre el callback más reciente.
  const cbRef = useRef(callback)
  useEffect(() => {
    cbRef.current = callback
  }, [callback])

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (tipos.length === 0) return
    const set = new Set<CatalogoTipo>(tipos)
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ tipo: CatalogoTipo }>).detail
      if (detail && set.has(detail.tipo)) {
        cbRef.current()
      }
    }
    window.addEventListener(CATALOG_EVENT, handler)
    return () => window.removeEventListener(CATALOG_EVENT, handler)
  }, [tipos.join('|')])
}
