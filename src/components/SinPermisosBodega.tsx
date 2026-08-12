/**
 * SinPermisosBodega — Pantalla de fallback cuando el user autenticado
 * no tiene NINGÚN módulo con permiso `ver` en la bodega activa.
 *
 * Casos que aterrizan acá:
 *   - Delegado con bodega asignada pero con un rol que solo tiene
 *     permisos de acción (crear/editar/eliminar) y ningún `ver`.
 *   - Cambio de bodega a una en la que el user no tiene permisos de
 *     visualización.
 *
 * Ofrece dos salidas:
 *   1. Cambiar de bodega (si el user tiene otras).
 *   2. Cerrar sesión.
 *
 * Sprint 3 Fase 6 (corrección 6 del .md).
 */

import { useAuth } from '../store/auth'
import { useBodegaActiva } from '../store/bodegaActiva'
import { useBodegasAccesibles, bodegasAccesiblesStore } from '../store/contextoBodega'
import { authStore } from '../store/auth'
import { bodegaActivaStore } from '../store/bodegaActiva'
import { ShieldX, Warehouse, LogOut, ArrowLeftRight } from 'lucide-react'

export function SinPermisosBodega({ onLogout }: { onLogout?: () => void }) {
  const auth = useAuth()
  const activaId = useBodegaActiva()
  const bodegasAccesibles = useBodegasAccesibles()
  const lista =
    bodegasAccesibles.status === 'listo' ? bodegasAccesibles.bodegas : []
  // ¿El user puede cambiar a otra bodega con permisos `ver`?
  const hayOtras = lista.length > 1
  const nombreUsuario = auth.status === 'autenticado' ? auth.sesion.usuario.nombre : ''

  function handleCambiar() {
    // Elegimos una bodega distinta a la actual, priorizando la principal.
    const otra =
      lista.find((b) => b.id !== activaId && b.esPrincipal) ??
      lista.find((b) => b.id !== activaId)
    if (!otra) return
    // El cambio completo (incluyendo recarga de permisos) lo hace
    // el Sidebar. Acá sólo seteamos la activa y dejamos que el hook
    // `usePermisosDeBodegaActiva` dispare la carga.
    bodegaActivaStore.set(otra.id, otra.nombre)
    void bodegasAccesiblesStore.cargar().catch(() => undefined)
  }

  function handleLogout() {
    if (onLogout) {
      onLogout()
    } else {
      void authStore.logout()
    }
  }

  return (
    <div className="flex min-h-full items-center justify-center p-8">
      <div className="max-w-md w-full text-center">
        <div className="inline-flex w-16 h-16 bg-primary/10 items-center justify-center mb-5" style={{ borderRadius: '0.25rem' }}>
          <ShieldX size={28} className="text-primary" />
        </div>
        <h1
          className="text-3xl uppercase text-foreground mb-3"
          style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900 }}
        >
          Sin módulos disponibles
        </h1>
        <p
          className="text-sm text-muted-foreground mb-6"
          style={{ fontFamily: "'DM Sans', sans-serif" }}
        >
          {nombreUsuario ? `${nombreUsuario}, no tenés permisos de visualización en esta bodega. ` : 'No tenés permisos de visualización en esta bodega. '}
          Pedile al administrador del tenant que revise tu asignación de rol en esta bodega.
        </p>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 justify-center">
          {hayOtras && (
            <button
              type="button"
              onClick={handleCambiar}
              className="inline-flex items-center justify-center gap-2 min-h-[40px] px-4 py-2 bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors"
              style={{ borderRadius: '0.25rem' }}
            >
              <ArrowLeftRight size={14} />
              Cambiar de bodega
            </button>
          )}
          {lista.length > 0 && !hayOtras && (
            <span
              className="inline-flex items-center justify-center gap-2 text-xs text-muted-foreground"
              style={{ fontFamily: "'JetBrains Mono', monospace" }}
            >
              <Warehouse size={12} />
              Esta es tu única bodega accesible
            </span>
          )}
          <button
            type="button"
            onClick={handleLogout}
            className="inline-flex items-center justify-center gap-2 min-h-[40px] px-4 py-2 border border-border text-sm text-foreground hover:border-foreground/30 transition-colors"
            style={{ borderRadius: '0.25rem' }}
          >
            <LogOut size={14} />
            Cerrar sesión
          </button>
        </div>
      </div>
    </div>
  )
}
