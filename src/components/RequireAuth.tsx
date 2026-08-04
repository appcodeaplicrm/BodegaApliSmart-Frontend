import { useEffect, type ReactNode } from 'react'
import { authStore, useAuth } from '../store/auth'

type RequireAuthProps = {
  children: ReactNode
  /** Qué renderizar si no hay sesión */
  fallback: ReactNode
  /** Qué mostrar mientras se hace el /auth/me inicial. Default: spinner. */
  loadingFallback?: ReactNode
}

/**
 * Gate de autenticación.
 *
 * Renderiza UNO de tres, según el estado del auth:
 *  - 'cargando' → loadingFallback (o spinner por default)
 *  - 'autenticado' → children
 *  - 'anonimo' → fallback
 *
 * Dispara el bootstrap la primera vez que se monta.
 *
 * NOTA: RequireAuth retorna UN solo árbol (o children, o fallback, o loading).
 * Los children NO se montan si el estado no es 'autenticado'.
 */
export function RequireAuth({ children, fallback, loadingFallback }: RequireAuthProps) {
  const auth = useAuth()

  useEffect(() => {
    if (auth.status === 'cargando') {
      void authStore.bootstrap()
    }
  }, [auth.status])

  // ANTES renderizaba <>{children}</> lo cual en React NO monta los children
  // hasta que efectivamente se renderizan. Pero el bug era otro: el wrapper
  // en App.tsx tenía `<RequireAuth fallback={...}> <Dashboard /> </RequireAuth>`
  // y React trataba los children como un slot que se evalúa siempre.
  //
  // El fix real es asegurar que retornamos UN solo árbol condicionalmente
  // y NO renderizar children en ningún caso cuando no estamos autenticados.

  if (auth.status === 'cargando') {
    return <>{loadingFallback ?? <FullScreenLoader />}</>
  }
  if (auth.status === 'anonimo') {
    return <>{fallback}</>
  }
  return <>{children}</>
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
