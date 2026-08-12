import { MapPin } from 'lucide-react'
import { CatalogoScreen, type CatalogoConfig } from './CatalogoScreen'

/**
 * Pantalla de gestión de Secciones de la bodega (alias: Ubicaciones).
 *
 * El endpoint del back se llama `/ubicaciones` (modelo Prisma), pero
 * en la UI lo mostramos como "Secciones de la bodega" porque es más
 * claro para el usuario final.
 *
 * Reutiliza CatalogoScreen con la misma config de Categorías/Marcas.
 */
const config: CatalogoConfig = {
  key: 'ubicaciones',
  titulo: 'Secciones de la bodega',
  endpoint: 'ubicaciones',
  labelSingular: 'sección',
  placeholderNombre: 'Ej: Estantería A1, Rack refrigerado, Depósito sur',
  icon: MapPin,
  requiereBodega: true,
}

export function UbicacionesScreen() {
  return <CatalogoScreen config={config} />
}
