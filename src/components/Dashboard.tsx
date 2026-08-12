import { useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { AppLayout } from './AppLayout'
import { useBodegas, bodegasStore } from '../store/bodegas'
import { useBodegaActiva, bodegaActivaStore } from '../store/bodegaActiva'
import { useAuth } from '../store/auth'
import { DashboardView } from './DashboardView'
import { InventarioV2 } from './InventarioV2'
import { Despachos } from './Despachos'
import { Ordenes } from './Ordenes'
import { Devoluciones } from './Devoluciones'
import { Usuarios } from './Usuarios'
import { Roles } from './Roles'
import { Tecnicos, TecnicosIndex } from './Tecnicos'
import { Reportes, ReportesIndex } from './Reportes'
import { PermissionGate } from './PermissionGate'
import { Forbidden } from './Forbidden'
import { Alertas } from './Alertas'
import { Movimientos } from './Movimientos'
import { CategoriasScreen } from './inventario/CategoriasScreen'
import { MarcasScreen } from './inventario/MarcasScreen'
import { ProveedoresScreen } from './inventario/ProveedoresScreen'
import { UbicacionesScreen } from './inventario/UbicacionesScreen'

type DashboardProps = {
  /**
   * Vista a renderizar:
   *   undefined  → dashboard (resumen)
   *   'inventario' / 'despachos' / 'ordenes' / etc → módulo correspondiente
   *   'tecnicos'  → si hay :subKey, renderiza el sub; si no, el índice
   *   'reportes'  → idem
   */
  view?:
    | 'dashboard'
    | 'inventario'
    | 'despachos'
    | 'ordenes'
    | 'devoluciones'
    | 'usuarios'
    | 'roles'
    | 'tecnicos'
    | 'reportes'
    | 'alertas'
    | 'movimientos'
    | 'categorias'
    | 'marcas'
    | 'proveedores'
    | 'ubicaciones'
  onExit: () => void | Promise<void>
}

/**
 * Layout del dashboard. El `view` y el `:subKey` vienen de la ruta (vía props).
 *
 *   /dashboard              → view="dashboard"
 *   /inventario             → view="inventario"
 *   /tecnicos               → view="tecnicos" sin subKey → índice
 *   /tecnicos/solicitudes   → view="tecnicos" subKey="solicitudes" → sub-módulo
 */
export function Dashboard({ view = 'dashboard', onExit }: DashboardProps) {
  const params = useParams<{ subKey?: string }>()
  const bodegasState = useBodegas()
  const activaId = useBodegaActiva()
  const auth = useAuth()

  // Cada vez que el usuario entra al shell autenticado (cualquier ruta del
  // dashboard), revalidamos la lista de bodegas desde el back. Esto cubre
  // el caso de bodegas creadas/borradas en otra sesión o por otro admin.
  // El store es idempotente: si ya está cargando o listo, no vuelve a
  // pegarle al back. El superadmin no llama al back (no tiene permiso
  // `inventario.ver` y su vista es /admin/tenants).
  useEffect(() => {
    const rol = auth.status === 'autenticado' ? auth.sesion.usuario.rol : undefined
    void bodegasStore.cargar({ rol }).catch(() => {
      /* si falla, el cache anterior sigue siendo válido */
    })
  }, [auth])

  // Auto-seleccionar la bodega activa cuando las bodegas del back terminan
  // de cargar. Esto es importante para usuarios no-admin (que solo ven
  // SU bodega) y entran directo a /inventario sin pasar por el
  // SelectorBodega del DashboardView.
  useEffect(() => {
    if (bodegasState.status !== 'listo') return
    const bodegas = bodegasState.bodegas
    if (bodegas.length === 0) return
    const primeraId = bodegas[0].id
    // Si hay 1 sola bodega y la activa no coincide → set
    if (bodegas.length === 1 && activaId !== primeraId) {
      bodegaActivaStore.set(primeraId)
      return
    }
    // Si la activa no existe en la lista → set la primera
    if (activaId && !bodegas.some((b) => b.id === activaId)) {
      bodegaActivaStore.set(primeraId)
      return
    }
    // Si no hay activa y hay bodegas → set la primera
    if (!activaId) {
      bodegaActivaStore.set(primeraId)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bodegasState.status, bodegasState.status === 'listo' ? bodegasState.bodegas : null, activaId])

  return (
    <AppLayout onExit={onExit}>
      {view === 'dashboard' && (
        <PermissionGate permiso="dashboard.ver" fallback={<Forbidden />}>
          <DashboardView />
        </PermissionGate>
      )}

      {view === 'inventario' && (
        <PermissionGate permiso="inventario.ver" fallback={<Forbidden />}>
          <InventarioV2 />
        </PermissionGate>
      )}

      {view === 'categorias' && (
        <PermissionGate permiso="inventario.ver" fallback={<Forbidden />}>
          <CategoriasScreen />
        </PermissionGate>
      )}

      {view === 'marcas' && (
        <PermissionGate permiso="inventario.ver" fallback={<Forbidden />}>
          <MarcasScreen />
        </PermissionGate>
      )}

      {view === 'proveedores' && (
        <PermissionGate permiso="inventario.ver" fallback={<Forbidden />}>
          <ProveedoresScreen />
        </PermissionGate>
      )}

      {view === 'ubicaciones' && (
        <PermissionGate permiso="inventario.ver" fallback={<Forbidden />}>
          <UbicacionesScreen />
        </PermissionGate>
      )}

      {view === 'alertas' && (
        <PermissionGate permiso="alertas.ver" fallback={<Forbidden />}>
          <Alertas />
        </PermissionGate>
      )}

      {view === 'movimientos' && (
        <PermissionGate permiso="movimientos.ver" fallback={<Forbidden />}>
          <Movimientos />
        </PermissionGate>
      )}

      {view === 'despachos' && (
        <PermissionGate permiso="despachos.ver" fallback={<Forbidden />}>
          <Despachos />
        </PermissionGate>
      )}

      {view === 'ordenes' && (
        <PermissionGate permiso="tecnicos.solicitudes.ver" fallback={<Forbidden />}>
          <Ordenes />
        </PermissionGate>
      )}

      {view === 'devoluciones' && (
        <PermissionGate permiso="tecnicos.devoluciones.ver" fallback={<Forbidden />}>
          <Devoluciones />
        </PermissionGate>
      )}

      {view === 'usuarios' && (
        <PermissionGate permiso="usuarios.ver" fallback={<Forbidden />}>
          <Usuarios />
        </PermissionGate>
      )}

      {view === 'roles' && (
        <PermissionGate permiso="roles.ver" fallback={<Forbidden />}>
          <Roles />
        </PermissionGate>
      )}

      {view === 'tecnicos' && (
        <PermissionGate
          permiso={params.subKey ? getTecnicosSubPermiso(params.subKey) : 'tecnicos.ver'}
          fallback={<Forbidden />}
        >
          {params.subKey ? (
            <Tecnicos subKey={params.subKey} />
          ) : (
            <TecnicosIndex />
          )}
        </PermissionGate>
      )}

      {view === 'reportes' && (
        <PermissionGate
          permiso={params.subKey ? getReportesSubPermiso(params.subKey) : 'reportes.ver'}
          fallback={<Forbidden />}
        >
          {params.subKey ? (
            <Reportes subKey={params.subKey} />
          ) : (
            <ReportesIndex />
          )}
        </PermissionGate>
      )}
    </AppLayout>
  )
}

/** Mapeo de sub-ítem de Técnicos → permiso requerido (jerarquía nueva). */
function getTecnicosSubPermiso(subKey: string): string {
  switch (subKey) {
    case 'solicitudes':
      return 'tecnicos.solicitudes.ver'
    case 'herramientas':
      return 'tecnicos.herramientas.ver'
    case 'alertas':
      return 'tecnicos.alertas.ver'
    case 'devoluciones':
      return 'tecnicos.devoluciones.ver'
    case 'asignadas':
      return 'tecnicos.asignadas.ver'
    case 'proyectos':
      return 'tecnicos.proyectos.ver'
    default:
      return 'tecnicos.ver'
  }
}

/** Mapeo de sub-ítem de Reportes → permiso requerido. */
function getReportesSubPermiso(subKey: string): string {
  switch (subKey) {
    case 'entradas':
      return 'reportes.entradas.ver'
    case 'salidas':
      return 'reportes.salidas.ver'
    case 'kardex':
      return 'reportes.kardex.ver'
    default:
      return 'reportes.ver'
  }
}
