import { useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { rutaInicialSegunPermisos, primeraRutaPermitida } from './lib/routing'
import { ErrorBoundary } from './components/ErrorBoundary'
import { Navbar } from './components/Navbar'
import { Landing } from './components/Landing'
import { Login } from './components/Login'
import { Dashboard } from './components/Dashboard'
import { OnboardingAdmin } from './components/OnboardingAdmin'
import { WaitingForBodega } from './components/WaitingForBodega'
import { Perfil } from './components/Perfil'
import { SinPermisosBodega } from './components/SinPermisosBodega'
import { SuperAdminEmpresas, SuperAdminPlanes, SuperAdminPlaceholder } from './components/SuperAdmin'
import { AppLayout } from './components/AppLayout'
import { RequireAuth } from './components/RequireAuth'
import { RealtimeProvider } from './components/RealtimeProvider'
import { ToastBridge } from './components/ToastBridge'
import { authStore, useAuth } from './store/auth'
import { bodegasStore } from './store/bodegas'
import { dashboardStore } from './store/dashboard'
import { bodegaActivaStore } from './store/bodegaActiva'
import { alertasStore } from './store/alertas'
import { tenantActivoStore } from './store/tenantActivo'
import { bodegasAccesiblesStore } from './store/contextoBodega'
import { permisosPorBodegaStore } from './store/permisosPorBodega'

/**
 * Rutas:
 *   /                       → landing (público)
 *   /login                  → login (público)
 *   /onboarding             → form para crear la primera bodega (admin)
 *   /waiting                → pantalla "esperá a ser asignado" (no-admin)
 *   /dashboard              → dashboard resumen
 *   /inventario, /despachos, /ordenes, /devoluciones, /usuarios, /roles → módulos
 *   /tecnicos, /tecnicos/:subKey → técnicos
 *   /reportes, /reportes/:subKey → reportes
 *
 * Auth flow:
 *   1. Login → si el usuario tiene bodega asignada → /dashboard
 *   2. Login → si el usuario es admin y NO tiene bodega → /onboarding
 *   3. Login → si el usuario no es admin y NO tiene bodega → /waiting
 *   4. Después de crear la primera bodega en /onboarding → /dashboard
 */
/**
 * Estado del bootstrap multibodega (corrección 2 del .md).
 *   - `cargando-auth`     → todavía no sabemos si hay sesión.
 *   - `cargando-bodega`   → hay sesión, cargando bodegas accesibles y permisos.
 *   - `listo`             → contexto completo, se pueden renderizar rutas.
 *   - `sin-bodegas`       → el user autenticado no tiene bodegas accesibles.
 *   - `error`             → algo falló (red, 500, etc.).
 */
type EstadoBootstrap = 'cargando-auth' | 'cargando-bodega' | 'listo' | 'sin-bodegas' | 'error'

function AppRoutes() {
  const auth = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [bootstrap, setBootstrap] = useState<EstadoBootstrap>('cargando-auth')

  // ─── Bootstrap: hidrata sesión + bodegas + permisos de la activa ───
  // Antes: solo `authStore.bootstrap()` y se seguía con la sesión
  // global. Ahora: si la autenticación es OK, cargamos las bodegas
  // accesibles y los permisos de la activa antes de renderizar
  // rutas protegidas. Esto evita el "primer frame con permisos
  // stale" que producía el bug del sidebar filtrando todo.
  useEffect(() => {
    let cancelado = false
    async function inicializar() {
      // FIX bug "loader pegado después de logout": si no hay sesión
      // (logout reciente), NO disparamos el bootstrap. El `handleExit`
      // ya puso `bootstrap = 'listo'` y navegó a `/`. Re-disparar
      // este effect podría pisar eso con un `cargando-*` y volver
      // a mostrar el spinner. Cortamos acá.
      if (auth.status === 'anonimo') {
        setBootstrap('listo')
        return
      }
      // 1) Auth
      if (auth.status === 'cargando') {
        const ok = await authStore.bootstrap()
        if (cancelado) return
        if (!ok) {
          setBootstrap('listo')
          return
        }
      }
      const sesion = authStore.getSesion()
      if (!sesion) {
        setBootstrap('listo')
        return
      }
      // 2) Superadmin: no opera bodegas, listo.
      if (sesion.usuario.rol === 'superadmin') {
        setBootstrap('listo')
        return
      }
      // 3) Bodegas accesibles
      setBootstrap('cargando-bodega')
      let bodegas
      try {
        const data = await bodegasAccesiblesStore.cargar()
        bodegas = data.bodegas
      } catch {
        if (cancelado) return
        setBootstrap('error')
        return
      }
      if (cancelado) return
      if (bodegas.length === 0) {
        setBootstrap('sin-bodegas')
        return
      }
      // 4) Elegir activa y cargar permisos
      const guardada = bodegaActivaStore.getId()
      const activa =
        bodegasAccesiblesStore.elegirBodegaActiva(guardada) ?? bodegas[0]
      bodegaActivaStore.set(activa.id, activa.nombre)
      try {
        const permisos = await permisosPorBodegaStore.cargar(activa.id, {
          force: true,
        })
        if (cancelado) return
        authStore.actualizarPermisos(
          permisos.permisos,
          permisos.modulePermissions,
        )
        setBootstrap('listo')
      } catch {
        if (cancelado) return
        setBootstrap('error')
      }
    }
    void inicializar()
    return () => {
      cancelado = true
    }
    // Solo se dispara cuando cambia el status de auth. El resto
    // del flujo es síncrono después del primer cambio.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth.status])

  // Loader global mientras el bootstrap no está listo. No se
  // renderiza NADA de rutas protegidas hasta que sepamos
  // quién es el user, qué bodegas tiene y qué permisos tiene
  // en la activa.
  if (auth.status === 'cargando' || bootstrap === 'cargando-auth' || bootstrap === 'cargando-bodega') {
    return <FullScreenLoader />
  }

  // Si está autenticado y va a /login, mandarlo al destino correcto
  // según tenga bodega o no.
  if (auth.status === 'autenticado' && location.pathname === '/login') {
    return <Navigate to={rutaInicialSegunPermisos(auth.sesion)} replace />
  }

  // Si está autenticado y va a / (root) y es superadmin, mandarlo a su panel.
  if (
    auth.status === 'autenticado' &&
    auth.sesion.usuario.rol === 'superadmin' &&
    location.pathname === '/'
  ) {
    return <Navigate to="/superadmin/empresas" replace />
  }

  // Si está autenticado, no tiene bodega y está en una ruta que requiere bodega
  // (excepto /onboarding, /waiting, /login, /, /admin/tenants, /admin/*), redirigir
  // al destino correcto. El superadmin no entra acá: el requiereBodega NO se
  // le aplica (porque no es dueño de ninguna bodega).
  if (
    auth.status === 'autenticado' &&
    !bodegaActivaStore.getId() &&
    auth.sesion.usuario.rol !== 'superadmin'
  ) {
    const pathRequiresBodega =
      !['/', '/login', '/onboarding', '/waiting', '/admin/tenants'].some((p) => location.pathname === p) &&
      !location.pathname.startsWith('/onboarding') &&
      !location.pathname.startsWith('/waiting') &&
      !location.pathname.startsWith('/admin/')
    if (pathRequiresBodega) {
      return (
        <Navigate
          to={rutaSegunSesion(auth.sesion.usuario.rol, null)}
          replace
        />
      )
    }
  }

  // Si está autenticado, tiene bodega y va a /, mandarlo al primer módulo
  // que pueda ver (en lugar de /dashboard, que puede no tenerlo permitido).
  if (
    auth.status === 'autenticado' &&
    bodegaActivaStore.getId() &&
    location.pathname === '/'
  ) {
    return <Navigate to={rutaInicialSegunPermisos(auth.sesion)} replace />
  }

  const handleExit = async () => {
    await authStore.logout()
    // Limpiar el cache para que el próximo login no muestre datos viejos.
    bodegasStore.reset()
    dashboardStore.reset()
    alertasStore.reset()
    bodegaActivaStore.reset()
    tenantActivoStore.reset()
    bodegasAccesiblesStore.reset()
    permisosPorBodegaStore.reset()
    // FIX bug "loader pegado después de logout":
    // ANTES poníamos `setBootstrap('cargando-auth')`, pero ese estado
    // matchea el FullScreenLoader, así que el usuario veía un flash
    // del spinner. Como no hay sesión activa, no necesitamos el
    // bootstrap multibodega → vamos directo a `listo` y la próxima
    // ruta (Landing o Login) se renderiza sin loader.
    setBootstrap('listo')
    navigate('/', { replace: true })
  }

const isLanding = location.pathname === '/'

  return (
    <RealtimeProvider>
      <ToastBridge />
      {/* El Navbar solo aparece en / y /login */}
      {isLanding && <Navbar />}

      <Routes>
        <Route path="/" element={<Landing />} />
        <Route
          path="/login"
          element={
            <Login
              onBack={() => navigate('/')}
              onLoginSuccess={(destino = '/dashboard') =>
                navigate(destino, { replace: true })
              }
            />
          }
        />

        {/* Onboarding: solo admins sin bodega */}
        <Route
          path="/onboarding"
          element={
            <RequireAuth
              loadingFallback={<FullScreenLoader />}
              fallback={<Navigate to="/login" replace />}
            >
              {/* Doble gate: solo admins pueden crear bodegas */}
              {auth.status === 'autenticado' && auth.sesion.usuario.bodegaId ? (
                <Navigate to="/dashboard" replace />
              ) : auth.status === 'autenticado' && auth.sesion.usuario.rol !== 'admin' ? (
                <Navigate to="/waiting" replace />
              ) : (
                <OnboardingAdmin />
              )}
            </RequireAuth>
          }
        />

        {/* Waiting: no-admins sin bodega */}
        <Route
          path="/waiting"
          element={
            <RequireAuth
              loadingFallback={<FullScreenLoader />}
              fallback={<Navigate to="/login" replace />}
            >
              {auth.status === 'autenticado' && auth.sesion.usuario.bodegaId ? (
                <Navigate to="/dashboard" replace />
              ) : auth.status === 'autenticado' && auth.sesion.usuario.rol === 'admin' ? (
                <Navigate to="/onboarding" replace />
              ) : (
                <WaitingForBodega />
              )}
            </RequireAuth>
          }
        />

        {/* Módulos autenticados (requieren bodega) */}
        <Route
          path="/dashboard"
          element={
            <RequireAuth
              loadingFallback={<FullScreenLoader />}
              fallback={<Navigate to="/login" replace />}
            >
              {auth.status === 'autenticado' && !auth.sesion.usuario.bodegaId ? (
                <Navigate to={rutaSegunSesion(auth.sesion.usuario.rol, null)} replace />
              ) : auth.status === 'autenticado' &&
                !authStore.can('dashboard', 'dashboard', 'ver') &&
                !['admin', 'superadmin'].includes(auth.sesion.usuario.rol) ? (
                // No tiene permiso de ver el dashboard → mandarlo al primer
                // módulo que sí pueda ver
                <Navigate to={rutaInicialSegunPermisos(auth.sesion)} replace />
              ) : (
                <Dashboard onExit={handleExit} />
              )}
            </RequireAuth>
          }
        />
        <Route
          path="/inventario"
          element={
            <RequireAuth
              loadingFallback={<FullScreenLoader />}
              fallback={<Navigate to="/login" replace />}
            >
              {auth.status === 'autenticado' && !auth.sesion.usuario.bodegaId ? (
                <Navigate to={rutaSegunSesion(auth.sesion.usuario.rol, null)} replace />
              ) : (
                <Dashboard view="inventario" onExit={handleExit} />
              )}
            </RequireAuth>
          }
        />
        <Route
          path="/inventario/categorias"
          element={
            <RequireAuth
              loadingFallback={<FullScreenLoader />}
              fallback={<Navigate to="/login" replace />}
            >
              {auth.status === 'autenticado' && !auth.sesion.usuario.bodegaId ? (
                <Navigate to={rutaSegunSesion(auth.sesion.usuario.rol, null)} replace />
              ) : (
                <Dashboard view="categorias" onExit={handleExit} />
              )}
            </RequireAuth>
          }
        />
        <Route
          path="/inventario/marcas"
          element={
            <RequireAuth
              loadingFallback={<FullScreenLoader />}
              fallback={<Navigate to="/login" replace />}
            >
              {auth.status === 'autenticado' && !auth.sesion.usuario.bodegaId ? (
                <Navigate to={rutaSegunSesion(auth.sesion.usuario.rol, null)} replace />
              ) : (
                <Dashboard view="marcas" onExit={handleExit} />
              )}
            </RequireAuth>
          }
        />
        <Route
          path="/inventario/proveedores"
          element={
            <RequireAuth
              loadingFallback={<FullScreenLoader />}
              fallback={<Navigate to="/login" replace />}
            >
              {auth.status === 'autenticado' && !auth.sesion.usuario.bodegaId ? (
                <Navigate to={rutaSegunSesion(auth.sesion.usuario.rol, null)} replace />
              ) : (
                <Dashboard view="proveedores" onExit={handleExit} />
              )}
            </RequireAuth>
          }
        />
        <Route
          path="/inventario/ubicaciones"
          element={
            <RequireAuth
              loadingFallback={<FullScreenLoader />}
              fallback={<Navigate to="/login" replace />}
            >
              {auth.status === 'autenticado' && !auth.sesion.usuario.bodegaId ? (
                <Navigate to={rutaSegunSesion(auth.sesion.usuario.rol, null)} replace />
              ) : (
                <Dashboard view="ubicaciones" onExit={handleExit} />
              )}
            </RequireAuth>
          }
        />
        <Route
          path="/alertas"
          element={
            <RequireAuth
              loadingFallback={<FullScreenLoader />}
              fallback={<Navigate to="/login" replace />}
            >
              {auth.status === 'autenticado' && !auth.sesion.usuario.bodegaId ? (
                <Navigate to={rutaSegunSesion(auth.sesion.usuario.rol, null)} replace />
              ) : (
                <Dashboard view="alertas" onExit={handleExit} />
              )}
            </RequireAuth>
          }
        />
        <Route
          path="/movimientos"
          element={
            <RequireAuth
              loadingFallback={<FullScreenLoader />}
              fallback={<Navigate to="/login" replace />}
            >
              {auth.status === 'autenticado' && !auth.sesion.usuario.bodegaId ? (
                <Navigate to={rutaSegunSesion(auth.sesion.usuario.rol, null)} replace />
              ) : (
                <Dashboard view="movimientos" onExit={handleExit} />
              )}
            </RequireAuth>
          }
        />
        <Route
          path="/despachos"
          element={
            <RequireAuth
              loadingFallback={<FullScreenLoader />}
              fallback={<Navigate to="/login" replace />}
            >
              {auth.status === 'autenticado' && !auth.sesion.usuario.bodegaId ? (
                <Navigate to={rutaSegunSesion(auth.sesion.usuario.rol, null)} replace />
              ) : (
                <Dashboard view="despachos" onExit={handleExit} />
              )}
            </RequireAuth>
          }
        />
        <Route
          path="/ordenes"
          element={
            <RequireAuth
              loadingFallback={<FullScreenLoader />}
              fallback={<Navigate to="/login" replace />}
            >
              {auth.status === 'autenticado' && !auth.sesion.usuario.bodegaId ? (
                <Navigate to={rutaSegunSesion(auth.sesion.usuario.rol, null)} replace />
              ) : (
                <Dashboard view="ordenes" onExit={handleExit} />
              )}
            </RequireAuth>
          }
        />
        <Route
          path="/devoluciones"
          element={
            <RequireAuth
              loadingFallback={<FullScreenLoader />}
              fallback={<Navigate to="/login" replace />}
            >
              {auth.status === 'autenticado' && !auth.sesion.usuario.bodegaId ? (
                <Navigate to={rutaSegunSesion(auth.sesion.usuario.rol, null)} replace />
              ) : (
                <Dashboard view="devoluciones" onExit={handleExit} />
              )}
            </RequireAuth>
          }
        />
        <Route
          path="/usuarios"
          element={
            <RequireAuth
              loadingFallback={<FullScreenLoader />}
              fallback={<Navigate to="/login" replace />}
            >
              {auth.status === 'autenticado' && !auth.sesion.usuario.bodegaId ? (
                <Navigate to={rutaSegunSesion(auth.sesion.usuario.rol, null)} replace />
              ) : (
                <Dashboard view="usuarios" onExit={handleExit} />
              )}
            </RequireAuth>
          }
        />
        <Route
          path="/roles"
          element={
            <RequireAuth
              loadingFallback={<FullScreenLoader />}
              fallback={<Navigate to="/login" replace />}
            >
              {auth.status === 'autenticado' && !auth.sesion.usuario.bodegaId ? (
                <Navigate to={rutaSegunSesion(auth.sesion.usuario.rol, null)} replace />
              ) : (
                <Dashboard view="roles" onExit={handleExit} />
              )}
            </RequireAuth>
          }
        />

        <Route
          path="/tecnicos"
          element={
            <RequireAuth
              loadingFallback={<FullScreenLoader />}
              fallback={<Navigate to="/login" replace />}
            >
              {auth.status === 'autenticado' && !auth.sesion.usuario.bodegaId ? (
                <Navigate to={rutaSegunSesion(auth.sesion.usuario.rol, null)} replace />
              ) : (
                <Dashboard view="tecnicos" onExit={handleExit} />
              )}
            </RequireAuth>
          }
        />
        <Route
          path="/tecnicos/:subKey"
          element={
            <RequireAuth
              loadingFallback={<FullScreenLoader />}
              fallback={<Navigate to="/login" replace />}
            >
              {auth.status === 'autenticado' && !auth.sesion.usuario.bodegaId ? (
                <Navigate to={rutaSegunSesion(auth.sesion.usuario.rol, null)} replace />
              ) : (
                <Dashboard view="tecnicos" onExit={handleExit} />
              )}
            </RequireAuth>
          }
        />

        <Route
          path="/reportes"
          element={
            <RequireAuth
              loadingFallback={<FullScreenLoader />}
              fallback={<Navigate to="/login" replace />}
            >
              {auth.status === 'autenticado' && !auth.sesion.usuario.bodegaId ? (
                <Navigate to={rutaSegunSesion(auth.sesion.usuario.rol, null)} replace />
              ) : (
                <Dashboard view="reportes" onExit={handleExit} />
              )}
            </RequireAuth>
          }
        />
        <Route
          path="/reportes/:subKey"
          element={
            <RequireAuth
              loadingFallback={<FullScreenLoader />}
              fallback={<Navigate to="/login" replace />}
            >
              {auth.status === 'autenticado' && !auth.sesion.usuario.bodegaId ? (
                <Navigate to={rutaSegunSesion(auth.sesion.usuario.rol, null)} replace />
              ) : (
                <Dashboard view="reportes" onExit={handleExit} />
              )}
            </RequireAuth>
          }
        />

        {/* Perfil: accesible para cualquier user autenticado (no requiere
            bodega, no requiere permiso especial). */}
        <Route
          path="/perfil"
          element={
            <RequireAuth
              loadingFallback={<FullScreenLoader />}
              fallback={<Navigate to="/login" replace />}
            >
              <AppLayout onExit={handleExit}>
                <Perfil />
              </AppLayout>
            </RequireAuth>
          }
        />

        {/* Compatibilidad con la ruta anterior del panel. */}
        <Route
          path="/admin/tenants"
          element={
            <RequireAuth
              loadingFallback={<FullScreenLoader />}
              fallback={<Navigate to="/login" replace />}
            >
              {auth.status === 'autenticado' &&
              auth.sesion.usuario.rol !== 'superadmin' ? (
                <Navigate to={rutaSegunSesion(auth.sesion.usuario.rol, auth.sesion.usuario.bodegaId)} replace />
              ) : auth.status === 'autenticado' ? (
                <Navigate to="/superadmin/empresas" replace />
              ) : null}
            </RequireAuth>
          }
        />

        {[
          ['empresas', <SuperAdminEmpresas />],
          ['planes', <SuperAdminPlanes />],
          ['metricas', <SuperAdminPlaceholder type="metricas" />],
          ['sistema', <SuperAdminPlaceholder type="sistema" />],
        ].map(([slug, content]) => (
          <Route
            key={slug as string}
            path={`/superadmin/${slug}`}
            element={
              <RequireAuth loadingFallback={<FullScreenLoader />} fallback={<Navigate to="/login" replace />}>
                {auth.status === 'autenticado' && auth.sesion.usuario.rol !== 'superadmin' ? (
                  <Navigate to={rutaSegunSesion(auth.sesion.usuario.rol, auth.sesion.usuario.bodegaId)} replace />
                ) : auth.status === 'autenticado' ? (
                  <AppLayout onExit={handleExit}>{content}</AppLayout>
                ) : null}
              </RequireAuth>
            }
          />
        ))}

        {/* /sin-permisos — fallback cuando el user no tiene permiso `ver`
            en ningún módulo de la bodega activa (Sprint 3 Fase 6). */}
        <Route
          path="/sin-permisos"
          element={
            <RequireAuth
              loadingFallback={<FullScreenLoader />}
              fallback={<Navigate to="/login" replace />}
            >
              <AppLayout onExit={handleExit}>
                <SinPermisosBodega onLogout={handleExit} />
              </AppLayout>
            </RequireAuth>
          }
        />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </RealtimeProvider>
  )
}

/** Decide a dónde mandar al usuario según su rol y si tiene bodega. */
function rutaSegunSesion(rol: string, bodegaId: string | null): string {
  if (rol === 'superadmin') return '/superadmin/empresas'
  if (bodegaId) return '/dashboard'
  if (rol === 'admin') return '/onboarding'
  return '/waiting'
}

function FullScreenLoader() {
  return (
    <div className="h-dvh w-screen flex items-center justify-center bg-background">
      <div className="flex items-center gap-3 text-muted-foreground">
        <span
          className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary rounded-full animate-spin"
          aria-hidden
        />
        <span
          className="text-xs tracking-widest uppercase"
          style={{ fontFamily: "'JetBrains Mono', monospace" }}
        >
          Cargando…
        </span>
      </div>
    </div>
  )
}

function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </ErrorBoundary>
  )
}

export default App
