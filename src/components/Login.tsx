import { useState, type FormEvent } from 'react'
import { Eye, EyeOff, ArrowRight, ArrowLeft } from 'lucide-react'
import { authStore } from '../store/auth'
import { ApiError } from '../lib/api'
import { rutaInicialDesdePermisos } from '../lib/routing'
import { bodegaActivaStore } from '../store/bodegaActiva'
import { permisosPorBodegaStore } from '../store/permisosPorBodega'
import { bodegasAccesiblesStore } from '../store/contextoBodega'
import { bodegasStore } from '../store/bodegas'

type LoginProps = {
  onBack: () => void
  onLoginSuccess: (destino?: string) => void
}

export function Login({ onBack, onLoginSuccess }: LoginProps) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    if (!email || !password) {
      setError('Completa todos los campos para continuar.')
      return
    }
    setLoading(true)
    try {
      // 1) Login
      await authStore.login(email, password)
      // 2) Resetear caches que dependen del user (pueden tener datos
      //    del user anterior, sobre todo bodegaActivaStore que se
      //    hidrata de localStorage).
      bodegaActivaStore.reset()
      permisosPorBodegaStore.reset()
      bodegasAccesiblesStore.reset()
      bodegasStore.reset()

      // 3) Inicializar el contexto de bodega. Este paso es CRÍTICO
      //    y tiene que pasar ANTES de navegar. Si navegamos antes,
      //    `rutaInicialDesdePermisos` usa los permisos del login
      //    (que son del rol global) y puede mandar al user a una
      //    ruta que NO tiene permiso en su bodega activa.
      const { bodegas, esPropietario } = await bodegasAccesiblesStore.cargar()

      const sesion = authStore.getSesion()
      const esSuperadmin = sesion?.usuario.rol === 'superadmin'
      if (esSuperadmin) {
        onLoginSuccess('/superadmin/empresas')
        return
      }
      if (bodegas.length === 0) {
        onLoginSuccess(esPropietario ? '/onboarding' : '/waiting')
        return
      }

      // 4) Elegir la bodega activa: primero la guardada, después la
      //    principal, después la primera.
      const guardada = bodegaActivaStore.getId()
      const activa =
        bodegasAccesiblesStore.elegirBodegaActiva(guardada) ?? bodegas[0]
      bodegaActivaStore.set(activa.id, activa.nombre)

      // 5) Cargar permisos efectivos de esa bodega.
      const permisos = await permisosPorBodegaStore.cargar(activa.id, {
        force: true,
      })

      // 6) Sincronizar la sesión global con los permisos de la
      //    bodega activa. Esto hace que `auth.sesion.permisos`
      //    refleje lo que el user puede hacer en la bodega activa.
      authStore.actualizarPermisos(
        permisos.permisos,
        permisos.modulePermissions,
      )

      // 7) Decidir la ruta inicial según los permisos EFECTIVOS
      //    de la bodega activa, no del rol global.
      const destino = rutaInicialDesdePermisos(permisos.permisos, {
        esSuperadmin: false,
        esPropietario: permisos.esPropietario || esPropietario,
        tieneBodegas: true,
      })
      onLoginSuccess(destino)
    } catch (err) {
      if (err instanceof ApiError) {
        // Mensaje amigable según el código
        if (err.status === 401) {
          setError('Credenciales inválidas.')
        } else if (err.status === 429) {
          setError('Demasiados intentos. Esperá un minuto.')
        } else {
          setError(err.message)
        }
      } else {
        setError('No se pudo conectar con el servidor.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-dvh bg-background text-foreground flex flex-col lg:flex-row">
      <aside className="hidden lg:flex lg:w-1/2 relative border-r border-border p-12 flex-col justify-between overflow-hidden">
        <div
          className="absolute inset-0 opacity-[0.03] pointer-events-none"
          style={{
            backgroundImage:
              'linear-gradient(rgba(255,255,255,1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,1) 1px, transparent 1px)',
            backgroundSize: '40px 40px',
          }}
        />
        <div className="absolute top-[-80px] left-[-80px] w-72 h-72 rounded-full bg-primary opacity-10 blur-3xl pointer-events-none" />
        <div className="absolute bottom-[-60px] right-[-60px] w-56 h-56 rounded-full bg-secondary opacity-10 blur-3xl pointer-events-none" />

        <div className="relative z-10">
          <button
            onClick={onBack}
            className="flex items-center gap-2 min-h-[44px] text-xs text-muted-foreground hover:text-foreground transition-colors mb-8"
            style={{ fontFamily: "'JetBrains Mono', monospace" }}
          >
            <ArrowLeft size={14} />
            VOLVER AL SITIO
          </button>

          <div className="flex items-center">
            <span
              className="text-foreground text-2xl tracking-wider"
              style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900 }}
            >
              BodegaApliSmart
            </span>
          </div>
        </div>

        <div className="relative z-10">
          <h1
            className="text-5xl xl:text-7xl uppercase leading-none text-foreground"
            style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900 }}
          >
            tu bodega
            <br />
            bajo <span className="text-primary">control</span>
          </h1>

          <p
            className="mt-5 text-sm text-muted-foreground max-w-xs leading-relaxed"
            style={{ fontFamily: "'DM Sans', sans-serif" }}
          >
            opera entradas, salidas y picking desde cualquier dispositivo con la
            plataforma que ya usan +1.200 bodegas en latinoamérica.
          </p>
        </div>

        <div className="relative z-10">
          <div className="pt-6 border-t border-border grid grid-cols-3 gap-4">
            <MiniStat value="1.2K+" label="bodegas" />
            <MiniStat value="98.7%" label="precisión" />
            <MiniStat value="24/7" label="operación" />
          </div>
        </div>
      </aside>

      <main
        className="flex-1 flex flex-col items-center justify-center px-4 sm:px-6 py-8 sm:py-12"
        style={{ paddingBottom: 'max(3rem, env(safe-area-inset-bottom))' }}
      >
        <div className="flex lg:hidden items-center mb-10">
          <span
            className="text-foreground text-2xl tracking-wider"
            style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900 }}
          >
            BodegaApliSmart
          </span>
        </div>

        <div className="max-w-sm w-full">
          <button
            onClick={onBack}
            className="lg:hidden self-start flex items-center gap-2 min-h-[44px] text-xs text-muted-foreground hover:text-foreground transition-colors mb-6"
            style={{ fontFamily: "'JetBrains Mono', monospace" }}
          >
            <ArrowLeft size={14} />
            VOLVER
          </button>

          <div
            className="text-xs text-muted-foreground tracking-widest mb-3"
            style={{ fontFamily: "'JetBrains Mono', monospace" }}
          >
            — ACCESO AL SISTEMA
          </div>

          <h2
            className="text-4xl uppercase text-foreground leading-none"
            style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900 }}
          >
            BIENVENIDO DE <span className="text-primary">VUELTA</span>
          </h2>

          <p
            className="mt-2 text-sm text-muted-foreground"
            style={{ fontFamily: "'DM Sans', sans-serif" }}
          >
            ingresa con tu cuenta para operar tu bodega.
          </p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-4">
            <div>
              <label
                htmlFor="email"
                className="block text-xs text-muted-foreground tracking-widest uppercase mb-2"
                style={{ fontFamily: "'JetBrains Mono', monospace" }}
              >
                correo
              </label>
              <input
                id="email"
                type="email"
                inputMode="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="tu@empresa.com"
                className="w-full px-4 py-3 min-h-[44px] border border-border bg-muted text-foreground text-sm placeholder:text-muted-foreground outline-none focus:border-primary/60 transition-colors"
                style={{ borderRadius: '0.25rem', fontFamily: "'DM Sans', sans-serif" }}
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="block text-xs text-muted-foreground tracking-widest uppercase mb-2"
                style={{ fontFamily: "'JetBrains Mono', monospace" }}
              >
                contraseña
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  placeholder="••••••••"
                  className="w-full px-4 py-3 pr-11 min-h-[44px] border border-border bg-muted text-foreground text-sm placeholder:text-muted-foreground outline-none focus:border-primary/60 transition-colors"
                  style={{ borderRadius: '0.25rem', fontFamily: "'DM Sans', sans-serif" }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  className="absolute right-1 top-1/2 -translate-y-1/2 min-w-[44px] min-h-[44px] flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
                  aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {error && (
              <p
                className="text-xs text-primary bg-primary/10 border border-primary/20 px-3 py-2"
                style={{ fontFamily: "'JetBrains Mono', monospace", borderRadius: '0.25rem' }}
              >
                ⚠ {error}
              </p>
            )}

            <div className="flex justify-end">
              <a
                href="#"
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                style={{ fontFamily: "'JetBrains Mono', monospace" }}
              >
                ¿olvidaste tu contraseña?
              </a>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full min-h-[44px] flex items-center justify-center gap-2 py-3 bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90 transition-all group disabled:opacity-60 disabled:cursor-not-allowed"
              style={{ borderRadius: '0.25rem' }}
            >
              {loading ? (
                <>
                  <span className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                  VERIFICANDO...
                </>
              ) : (
                <>
                  INGRESAR
                  <ArrowRight
                    size={16}
                    className="group-hover:translate-x-0.5 transition-transform"
                  />
                </>
              )}
            </button>

            <div className="flex items-center gap-3 my-6">
              <div className="flex-1 h-px bg-border" />
              <span
                className="text-xs text-muted-foreground"
                style={{ fontFamily: "'JetBrains Mono', monospace" }}
              >
                O
              </span>
              <div className="flex-1 h-px bg-border" />
            </div>

            <button
              type="button"
              className="w-full min-h-[44px] flex items-center justify-center gap-2 py-3 border border-border text-foreground text-sm hover:border-foreground/30 transition-all"
              style={{ borderRadius: '0.25rem' }}
            >
              <GoogleIcon />
              continuar con google
            </button>

            <p
              className="text-center text-xs text-muted-foreground mt-6"
              style={{ fontFamily: "'DM Sans', sans-serif" }}
            >
              ¿no tienes cuenta?{' '}
              <a
                href="#"
                className="text-secondary hover:underline font-medium"
                style={{ fontFamily: "'DM Sans', sans-serif" }}
              >
                solicitar acceso
              </a>
            </p>
          </form>
        </div>
      </main>
    </div>
  )
}

function MiniStat({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <div
        className="text-2xl text-foreground"
        style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900 }}
      >
        {value}
      </div>
      <div
        className="text-xs text-muted-foreground uppercase tracking-widest mt-1"
        style={{ fontFamily: "'JetBrains Mono', monospace" }}
      >
        {label}
      </div>
    </div>
  )
}

function GoogleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#F5F2EC"
        d="M21.6 12.227c0-.709-.064-1.39-.182-2.045H12v3.868h5.382a4.6 4.6 0 0 1-1.996 3.018v2.51h3.227c1.89-1.74 2.987-4.298 2.987-7.351z"
      />
      <path
        fill="#F5F2EC"
        d="M12 22c2.7 0 4.964-.895 6.619-2.422l-3.227-2.51c-.895.6-2.04.954-3.392.954-2.605 0-4.81-1.76-5.595-4.123H3.064v2.59A9.997 9.997 0 0 0 12 22z"
        opacity="0.7"
      />
      <path
        fill="#F5F2EC"
        d="M6.405 13.9a6.005 6.005 0 0 1 0-3.8V7.51H3.064a10.012 10.012 0 0 0 0 8.98l3.34-2.59z"
        opacity="0.4"
      />
      <path
        fill="#F5F2EC"
        d="M12 5.977c1.468 0 2.786.505 3.823 1.495l2.868-2.868C16.96 2.987 14.696 2 12 2 8.118 2 4.768 4.222 3.064 7.51l3.34 2.59C7.19 7.737 9.395 5.977 12 5.977z"
        opacity="0.55"
      />
    </svg>
  )
}
