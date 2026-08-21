import { useMemo } from 'react'
import { useAuth } from '../store/auth'
import { PERMISO_VALORES_VER } from '../lib/format'

/**
 * Devuelve `true` si el usuario actual puede ver valores monetarios
 * (precio, costo, total, etc.) en el sistema.
 *
 * El back también chequea este permiso y redacta los campos a `null`
 * en su respuesta (vía `RedactValoresInterceptor`). El chequeo del
 * front es para decidir QUÉ renderizar; el del back es la fuente de
 * verdad para evitar leaks.
 *
 * Bypass para admin: si el rol del usuario es `admin`, devolvemos
 * `true` sin chequear el permiso en la DB (el admin tiene todos los
 * permisos del catálogo por defecto).
 */
export function usePuedeVerValores(): boolean {
  const estado = useAuth()
  return useMemo(() => {
    if (estado.status !== 'autenticado') return false
    const rol = estado.sesion.usuario.rol
    if (rol === 'admin') return true
    const set = new Set(estado.sesion.permisos ?? [])
    return set.has(PERMISO_VALORES_VER)
  }, [estado])
}
