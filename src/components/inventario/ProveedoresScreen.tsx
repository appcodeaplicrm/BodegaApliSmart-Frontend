import { Truck } from 'lucide-react'
import { CatalogoScreen, type CatalogoConfig } from './CatalogoScreen'

const config: CatalogoConfig = {
  key: 'proveedores',
  titulo: 'Proveedores',
  endpoint: 'proveedores',
  labelSingular: 'proveedor',
  placeholderNombre: 'Ej: Distribuidora La Industrial',
  icon: Truck,
  // Aunque conceptualmente los proveedores son globales, el controller
  // actual del back exige `bodegaId` para listar/crear (scope por
  // bodega en el modelo Prisma). Si en el futuro se vuelve global,
  // cambiar a false y ajustar el controller.
  requiereBodega: true,
  campoExtra: {
    key: 'ruc',
    label: 'RUC (opcional)',
    placeholder: 'Ej: 80012345-1',
  },
}

export function ProveedoresScreen() {
  return <CatalogoScreen config={config} />
}
