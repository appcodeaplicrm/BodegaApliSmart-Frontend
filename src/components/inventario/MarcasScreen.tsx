import { Award } from 'lucide-react'
import { CatalogoScreen, type CatalogoConfig } from './CatalogoScreen'

const config: CatalogoConfig = {
  key: 'marcas',
  titulo: 'Marcas',
  endpoint: 'marcas',
  labelSingular: 'marca',
  placeholderNombre: 'Ej: Bosch, Makita, Stanley',
  icon: Award,
  requiereBodega: true,
}

export function MarcasScreen() {
  return <CatalogoScreen config={config} />
}
