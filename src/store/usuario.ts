/**
 * Tipo legacy. La fuente de verdad del usuario actual ahora es `authStore`
 * (`useAuth()` en `store/auth.ts`). Este archivo se mantiene solo por
 * compatibilidad de imports que pueda haber quedado en algún lado.
 */
export type UsuarioActivo = {
  id: string
  nombre: string
  rol: 'Operador' | 'Bodeguero' | 'Admin'
  bodega: string
}

/** @deprecated usar `useAuth().sesion.usuario` en su lugar. */
export const usuarioActual: UsuarioActivo = {
  id: '',
  nombre: '',
  rol: 'Operador',
  bodega: '',
}
