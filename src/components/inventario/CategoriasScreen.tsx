import { Tag } from 'lucide-react'
import { CatalogoScreen, type CatalogoConfig } from './CatalogoScreen'

const config: CatalogoConfig = {
  key: 'categorias',
  titulo: 'Categorías',
  endpoint: 'categorias',
  labelSingular: 'categoría',
  placeholderNombre: 'Ej: Herramientas eléctricas',
  icon: Tag,
  requiereBodega: true,
}

export function CategoriasScreen() {
  return <CatalogoScreen config={config} />
}
