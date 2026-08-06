/**
 * Permisos del módulo Checklist para el user logueado.
 *
 * Reglas (alineadas con la decisión del usuario):
 *  - Si el user tiene los 4 permisos del submódulo (`ver`, `crear`,
 *    `editar`, `eliminar`) → `canManage: true`. Ve la pestaña
 *    Plantillas, los botones de crear/agendar, etc.
 *  - Si solo tiene `ver` (o un set incompleto) → `canManage: false`.
 *    Ve solo su historial y sus propios programados. No ve la pestaña
 *    Plantillas, ni el botón "Nueva plantilla" ni "Nuevo checklist".
 *  - El admin y superadmin siempre pasan (BYPASS_ROLES en el store).
 *
 * El back también valida (defensa en profundidad): un user restrictivo
 * que intente llamar a un endpoint de gestión recibe 403.
 */
import { authStore } from '../../store/auth'

export type ChecklistPerms = {
  /** Tiene los 4 permisos del submódulo. Ve y gestiona todo. */
  canManage: boolean
  /** Puede crear plantillas y agendar. (Implica canManage, pero lo
   * exponemos separado por si en el futuro queremos granularidad.) */
  canCreate: boolean
  /** Puede ver su historial. Casi siempre true si está en este módulo. */
  canView: boolean
}

const CK_KEYS = [
  'tecnicos.checklist.ver',
  'tecnicos.checklist.crear',
  'tecnicos.checklist.editar',
  'tecnicos.checklist.eliminar',
] as const

export function useChecklistPerms(): ChecklistPerms {
  // Usamos el store directo (no el hook) porque `tienePermisos` no
  // está expuesto en el snapshot de `useAuth()`. El método ya respeta
  // el BYPASS_ROLES (admin/superadmin = true) y no causa re-renders
  // porque no usa estado reactivo — los permisos del user solo
  // cambian en login/logout, momento en que el componente se re-monta.
  const canView = authStore.tienePermisos(['tecnicos.checklist.ver'])
  const canManage = canView && authStore.tienePermisos([...CK_KEYS])
  const canCreate =
    canView && authStore.tienePermisos(['tecnicos.checklist.ver', 'tecnicos.checklist.crear'])
  return { canManage, canCreate, canView }
}
