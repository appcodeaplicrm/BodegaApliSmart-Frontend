import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { rutaInicialSegunPermisos } from './lib/routing'
import { Navbar } from './components/Navbar'
import { Landing } from './components/Landing'
import { Login } from './components/Login'
import { Dashboard } from './components/Dashboard'
import { OnboardingAdmin } from './components/OnboardingAdmin'
import { WaitingForBodega } from './components/WaitingForBodega'
import { SuperAdminEmpresas, SuperAdminPlanes, SuperAdminPlaceholder } from './components/SuperAdmin'
import { AppLayout } from './components/AppLayout'
import { RequireAuth } from './components/RequireAuth'
import { authStore, useAuth } from './store/auth'
import { bodegasStore } from './store/bodegas'
import { dashboardStore } from './store/dashboard'
import { bodegaActivaStore } from './store/bodegaActiva'
import { alertasStore } from './store/alertas'
import { tenantActivoStore } from './store/tenantActivo'

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
function AppRoutes() {
  const auth = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  // Hidratar la sesión al montar la app.
  useEffect(() => {
    if (auth.status === 'cargando') {
      void authStore.bootstrap()
    }
  }, [auth.status])

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

  // Mientras carga el auth, mostrar loader
  if (auth.status === 'cargando') {
    return <FullScreenLoader />
  }

  // Si está autenticado, no tiene bodega y está en una ruta que requiere bodega
  // (excepto /onboarding, /waiting, /login, /, /admin/tenants, /admin/*), redirigir
  // al destino correcto. El superadmin no entra acá: el requiereBodega NO se
  // le aplica (porque no es dueño de ninguna bodega).
  if (
    auth.status === 'autenticado' &&
    !auth.sesion.usuario.bodegaId &&
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
    auth.sesion.usuario.bodegaId &&
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
    navigate('/', { replace: true })
  }

const isLanding = location.pathname === '/'

  return (
    <>
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

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
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
    <div className="h-screen w-screen flex items-center justify-center bg-background">
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
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  )
}

export default App
