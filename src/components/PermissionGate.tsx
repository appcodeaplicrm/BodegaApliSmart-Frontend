import type { ReactNode } from 'react'
import { authStore, useAuth } from '../store/auth'
import { Forbidden } from './Forbidden'

type PermissionGateProps = {
  /** Permiso único o array de permisos (AND) */
  permiso: string | string[]
  children: ReactNode
  /** Qué mostrar si NO tiene permiso. Default: <Forbidden /> */
  fallback?: ReactNode
}

/**
 * Gate de permisos. Renderiza `children` solo si el usuario autenticado tiene
 * el/los permisos pedidos. Si no, renderiza `fallback`.
 *
 * Si el usuario no está autenticado, este componente NO debe usarse —
 * el <RequireAuth> ya se encarga antes. Acá solo verificamos permisos.
 */
export function PermissionGate({ permiso, children, fallback }: PermissionGateProps) {
  const auth = useAuth()
  if (auth.status !== 'autenticado') return null

  const keys = Array.isArray(permiso) ? permiso : [permiso]
  const tiene = authStore.tienePermisos(keys)
  if (!tiene) {
    return <>{fallback ?? <Forbidden />}</>
  }
  return <>{children}</>
}
