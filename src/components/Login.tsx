import { useEffect, useState, type FormEvent } from 'react'
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

const LOGIN_BACKGROUNDS = [
  '/login/inventario-almacen.avif',
  '/login/almacen-logistico.jpg',
]

const LOGIN_PARTICLES = [
  { left: '7%', top: '14%', size: 3, delay: '-2s', duration: '13s' },
  { left: '18%', top: '72%', size: 5, delay: '-8s', duration: '17s' },
  { left: '27%', top: '34%', size: 2, delay: '-5s', duration: '12s' },
  { left: '38%', top: '88%', size: 4, delay: '-11s', duration: '18s' },
  { left: '46%', top: '18%', size: 3, delay: '-7s', duration: '15s' },
  { left: '57%', top: '63%', size: 2, delay: '-1s', duration: '11s' },
  { left: '66%', top: '29%', size: 5, delay: '-13s', duration: '19s' },
  { left: '75%', top: '82%', size: 3, delay: '-4s', duration: '14s' },
  { left: '86%', top: '45%', size: 4, delay: '-9s', duration: '16s' },
  { left: '94%', top: '69%', size: 2, delay: '-6s', duration: '12s' },
  { left: '13%', top: '48%', size: 2, delay: '-10s', duration: '15s' },
  { left: '82%', top: '11%', size: 3, delay: '-3s', duration: '17s' },
]

export function Login({ onBack, onLoginSuccess }: LoginProps) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [backgroundIndex, setBackgroundIndex] = useState(0)

  useEffect(() => {
    const interval = window.setInterval(() => {
      setBackgroundIndex((current) => (current + 1) % LOGIN_BACKGROUNDS.length)
    }, 6000)
    return () => window.clearInterval(interval)
  }, [])

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
          setError(err.message || 'Demasiados intentos. Intenta nuevamente más tarde.')
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
      <aside className="relative hidden overflow-hidden border-r border-border p-12 lg:flex lg:w-1/2 lg:flex-col lg:justify-between">
        {LOGIN_BACKGROUNDS.map((src, index) => (
          <img
            key={src}
            src={src}
            alt=""
            aria-hidden="true"
            className={`pointer-events-none absolute inset-0 h-full w-full object-cover transition-all duration-1000 ease-in-out ${
              backgroundIndex === index ? 'scale-100 opacity-100' : 'scale-105 opacity-0'
            }`}
          />
        ))}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/90 via-black/45 to-black/65" />

        <div className="relative z-10 flex items-start justify-between gap-6">
          <button
            onClick={onBack}
            className="flex min-h-[44px] items-center gap-2 text-xs text-white/70 transition-colors hover:text-white"
            style={{ fontFamily: "'JetBrains Mono', monospace" }}
          >
            <ArrowLeft size={14} />
            VOLVER AL SITIO
          </button>

          <LoginBrand />
        </div>

        <div className="relative z-10 flex flex-col items-start">
          <h1
            className="text-5xl uppercase leading-none text-white drop-shadow-lg xl:text-7xl"
            style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900 }}
          >
            tu bodega
            <br />
            bajo <span className="text-primary">control</span>
          </h1>
        </div>
      </aside>

      <main
        className="relative flex flex-1 flex-col items-center justify-center overflow-hidden px-4 py-8 sm:px-6 sm:py-12"
        style={{ paddingBottom: 'max(3rem, env(safe-area-inset-bottom))' }}
      >
        <svg
          className="pointer-events-none absolute inset-x-0 bottom-0 h-[38%] w-full opacity-[0.12]"
          viewBox="0 0 1440 320"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <path
            fill="#ff5500"
            d="M0,192L60,197.3C120,203,240,213,360,208C480,203,600,181,720,154.7C840,128,960,96,1080,90.7C1200,85,1320,107,1380,117.3L1440,128L1440,320L1380,320C1320,320,1200,320,1080,320C960,320,840,320,720,320C600,320,480,320,360,320C240,320,120,320,60,320L0,320Z"
          />
        </svg>

        <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden" aria-hidden="true">
          {LOGIN_PARTICLES.map((particle, index) => (
            <span
              key={`${particle.left}-${particle.top}`}
              className={`login-particle absolute rounded-full ${
                index % 4 === 0
                  ? 'bg-secondary/55 shadow-[0_0_10px_rgba(171,247,104,0.35)]'
                  : 'bg-primary/60 shadow-[0_0_10px_rgba(232,89,63,0.4)]'
              }`}
              style={{
                left: particle.left,
                top: particle.top,
                width: particle.size,
                height: particle.size,
                animationDelay: particle.delay,
                animationDuration: particle.duration,
              }}
            />
          ))}
        </div>

        <div className="relative z-10 mb-10 lg:hidden">
          <LoginBrand />
        </div>

        <div className="relative z-10 max-w-sm w-full">
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

function LoginBrand() {
  return (
    <div className="flex items-center gap-1">
      <span className="font-brand text-2xl tracking-wide text-primary">Bodega</span>
      <span className="font-brand text-2xl tracking-wide text-foreground">ApliSmart</span>
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
