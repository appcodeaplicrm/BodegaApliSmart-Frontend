/**
 * Routing basado en permisos EFECTIVOS de la bodega activa.
 *
 * Antes (legacy) se basaba en `sesion.modulePermissions` que es el
 * del rol global. Ahora (Sprint 3 Fase 6) se basa en el array
 * plano de permisos de la bodega activa (lo que devuelve
 * `/auth/me/permisos-efectivos?bodegaId=...`).
 *
 * Reglas:
 *   1. Si es superadmin → /superadmin/empresas (no opera bodegas).
 *   2. Si no tiene bodegas accesibles → /onboarding (admin) o /waiting.
 *   3. Si tiene bodegas pero ningún permiso `ver` → /sin-permisos.
 *   4. Si tiene bodegas + al menos un permiso `ver` → el primero
 *      del catálogo `RUTAS_POR_PERMISO` (en orden de sidebar).
 */

import { MODULOS, type ModuloKey } from '../store/permisos'
import type { Sesion } from '../store/auth'

export type PermisosDeBodega = string[]

export type OpcionesRutaInicial = {
  esSuperadmin: boolean
  esPropietario: boolean
  tieneBodegas: boolean
}

/**
 * Catálogo de rutas protegidas, en el orden en que el sidebar las
 * muestra. La primera cuyo permiso `ver` esté presente es la
 * candidata a ruta inicial.
 */
const RUTAS_POR_PERMISO: ReadonlyArray<{
  permiso: string
  ruta: string
}> = [
  { permiso: 'dashboard.ver', ruta: '/dashboard' },
  { permiso: 'inventario.ver', ruta: '/inventario' },
  { permiso: 'inventario.productos.ver', ruta: '/inventario/productos' },
  { permiso: 'inventario.categorias.ver', ruta: '/inventario/categorias' },
  { permiso: 'inventario.marcas.ver', ruta: '/inventario/marcas' },
  { permiso: 'inventario.proveedores.ver', ruta: '/inventario/proveedores' },
  { permiso: 'inventario.ubicaciones.ver', ruta: '/inventario/ubicaciones' },
  { permiso: 'movimientos.ver', ruta: '/movimientos' },
  { permiso: 'despachos.ver', ruta: '/despachos' },
  { permiso: 'kits.ver', ruta: '/inventario' }, // kits vive dentro de inventario
  { permiso: 'usuarios.ver', ruta: '/usuarios' },
  { permiso: 'roles.ver', ruta: '/roles' },
  { permiso: 'tecnicos.solicitudes.ver', ruta: '/tecnicos/solicitudes' },
  { permiso: 'tecnicos.herramientas.ver', ruta: '/tecnicos/herramientas' },
  { permiso: 'tecnicos.alertas.ver', ruta: '/tecnicos/alertas' },
  { permiso: 'tecnicos.devoluciones.ver', ruta: '/devoluciones' },
  { permiso: 'tecnicos.asignadas.ver', ruta: '/tecnicos/asignadas' },
  { permiso: 'tecnicos.proyectos.ver', ruta: '/tecnicos/proyectos' },
  { permiso: 'tecnicos.checklist.ver', ruta: '/tecnicos/checklist' },
  { permiso: 'reportes.entradas.ver', ruta: '/reportes/entradas' },
  { permiso: 'reportes.salidas.ver', ruta: '/reportes/salidas' },
  { permiso: 'reportes.kardex.ver', ruta: '/reportes/kardex' },
  { permiso: 'alertas.ver', ruta: '/alertas' },
] as const

/**
 * Devuelve la primera ruta cuyo permiso `ver` esté presente en el
 * array. Si ninguna matchea, devuelve `null`.
 */
export function primeraRutaPermitida(
  permisos: PermisosDeBodega,
): string | null {
  const set = new Set(permisos)
  for (const item of RUTAS_POR_PERMISO) {
    if (set.has(item.permiso)) return item.ruta
  }
  return null
}

/**
 * Devuelve la ruta inicial absoluta a la que se debe mandar al
 * user después de un login (o un cambio de bodega) en función de
 * su contexto (permisos + bodegas + rol).
 *
 * El parámetro `permisos` es el array plano de keys que devuelve
 * el endpoint `/auth/me/permisos-efectivos`. NO usar el
 * `sesion.modulePermissions` legacy (que es el del rol global).
 */
export function rutaInicialDesdePermisos(
  permisos: PermisosDeBodega,
  opciones: OpcionesRutaInicial,
): string {
  if (opciones.esSuperadmin) return '/superadmin/empresas'
  if (!opciones.tieneBodegas) {
    return opciones.esPropietario ? '/onboarding' : '/waiting'
  }
  return primeraRutaPermitida(permisos) ?? '/sin-permisos'
}

/**
 * Versión legacy que recibe la `Sesion` completa. Mantenida por
 * compat con código que todavía la usa. Hace la mejor inferencia
 * posible con los datos disponibles.
 *
 * Preferí `rutaInicialDesdePermisos` cuando tengas los permisos
 * de la bodega activa.
 */
export function rutaInicialSegunPermisos(sesion: Sesion): string {
  if (sesion.usuario.rol === 'superadmin') return '/superadmin/empresas'
  if (!sesion.usuario.bodegaId) {
    if (sesion.usuario.rol === 'admin') return '/onboarding'
    return '/waiting'
  }
  const permisos = sesion.permisos ?? []
  return rutaInicialDesdePermisos(permisos, {
    esSuperadmin: false,
    esPropietario: sesion.usuario.rol === 'admin',
    tieneBodegas: Boolean(sesion.usuario.bodegaId),
  })
}

/**
 * Devuelve el permiso requerido por la ruta `pathname` (la primera
 * ruta de `RUTAS_POR_PERMISO` que matchea), o `null` si la ruta
 * no requiere permiso (ej: `/dashboard`).
 *
 * Usado para validar si la ruta actual sigue siendo visible cuando
 * cambia la bodega activa.
 */
export function permisoDeRuta(pathname: string): string | null {
  for (const item of RUTAS_POR_PERMISO) {
    if (item.ruta === pathname) return item.permiso
  }
  // Si es una subruta de un módulo con permiso plano, devolvemos
  // el permiso del padre para validar a nivel módulo.
  for (const m of MODULOS) {
    if (pathname === `/${m.key}` || pathname.startsWith(`/${m.key}/`)) {
      return `${m.key}.ver`
    }
  }
  return null
}

// Suprimimos el warning de unused (ModuloKey se usa en routing futuro)
void (null as unknown as ModuloKey)
