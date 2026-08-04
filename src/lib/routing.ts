import { MODULOS } from '../store/permisos'
import type { ModulePermissionMap, Sesion } from '../store/auth'

/**
 * Resuelve a qué ruta mandar al usuario al iniciar sesión.
 *
 * Reglas:
 *   1. Si es superadmin → /admin/tenants (vista de gestión de tenants)
 *   2. Si no tiene bodega Y es admin → /onboarding
 *   3. Si no tiene bodega Y NO es admin → /waiting
 *   4. Si tiene bodega → el primer módulo (en orden de sidebar) donde
 *      el usuario tiene al menos una acción (generalmente `ver`).
 *   5. Fallback: /dashboard
 *
 * Esto evita que un user sin `dashboard.ver` aterrice en una pantalla
 * que no puede ver, mostrando un "Sin permisos". En vez de eso va
 * directo al primer módulo que sí puede usar.
 */
export function rutaInicialSegunPermisos(sesion: Sesion): string {
  // 1) Superadmin: vista dedicada de tenants (no requiere bodega)
  if (sesion.usuario.rol === 'superadmin') return '/superadmin/empresas'

  // 2) Sin bodega: admin → onboarding, resto → waiting
  if (!sesion.usuario.bodegaId) {
    if (sesion.usuario.rol === 'admin') return '/onboarding'
    return '/waiting'
  }

  // 2) Con bodega: buscar el primer módulo que pueda ver
  const perms = sesion.modulePermissions ?? {}
  const adminBypass = ['admin', 'superadmin'].includes(sesion.usuario.rol)

  for (const m of MODULOS) {
    if (!adminBypass && !usuarioPuedeVerModulo(perms, m.key, m.submodulos?.length ?? 0)) {
      continue
    }
    // Si es un módulo con sub-módulos, mandamos al primero que pueda ver
    if (m.submodulos && m.submodulos.length > 0) {
      for (const s of m.submodulos) {
        if (
          adminBypass ||
          perms[m.key]?.[s.key]?.length
        ) {
          return `/${m.key}/${s.key}`
        }
      }
      // Si tiene `ver` del padre pero ningún sub, mandamos al padre
      // (la vista índice del módulo le va a mostrar el módulo vacío
      // y el sidebar ya filtra los sub-ítems).
      if (adminBypass || perms[m.key]?.[m.key]?.includes('ver')) {
        return `/${m.key}`
      }
      continue
    }
    // Módulo plano: el primer módulo con cualquier acción vale
    return `/${m.key === 'dashboard' ? 'dashboard' : m.key}`
  }

  // 3) Fallback: si literalmente no tiene nada, mandamos a dashboard
  // y el PermissionGate de adentro mostrará el "Sin permisos".
  return '/dashboard'
}

/**
 * ¿El usuario tiene al menos una acción en `modulo`?
 * Para módulos con sub-módulos, alcanza con tener UNA acción en CUALQUIER
 * sub-módulo para que el módulo sea visible en el sidebar.
 */
function usuarioPuedeVerModulo(
  perms: ModulePermissionMap,
  modulo: string,
  cantidadSubmodulos: number,
): boolean {
  const modPerms = perms[modulo]
  if (!modPerms) return false
  if (cantidadSubmodulos === 0) {
    // Módulo plano: alcanza con que tenga al menos una acción
    return Object.values(modPerms).some(
      (acts) => Array.isArray(acts) && acts.length > 0,
    )
  }
  // Módulo con sub-módulos: alcanza con que tenga al menos un sub con acciones
  return Object.values(modPerms).some(
    (acts) => Array.isArray(acts) && acts.length > 0,
  )
}
