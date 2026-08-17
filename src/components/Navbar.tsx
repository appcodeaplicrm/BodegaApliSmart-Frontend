import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Menu, X } from 'lucide-react'

const navLinks = [
  { label: 'Funcionalidades', href: '#features' },
  { label: 'Cómo funciona', href: '#how' },
  { label: 'Precios', href: '#pricing' },
  { label: 'Recursos', href: '#resources' },
]

export function Navbar() {
  const [open, setOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const actualizarEstado = () => setScrolled(window.scrollY > 8)
    actualizarEstado()
    window.addEventListener('scroll', actualizarEstado, { passive: true })
    return () => window.removeEventListener('scroll', actualizarEstado)
  }, [])

  return (
    <header
      className={`fixed top-0 inset-x-0 z-50 overflow-x-clip bg-background/95 backdrop-blur-sm border-b transition-colors duration-200 ${
        scrolled ? 'border-border' : 'border-transparent'
      }`}
      style={{ fontFamily: "'DM Sans', system-ui, sans-serif", paddingTop: 'env(safe-area-inset-top)' }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        <a href="#" className="flex min-w-0 items-center gap-1">
          <span
            className="font-brand text-[clamp(0.95rem,5vw,1.5rem)] text-primary tracking-wide"
          >
            Bodega
          </span>
          <span className="font-brand text-[clamp(0.95rem,5vw,1.5rem)] text-white tracking-wide">
             ApliSmart
          </span>
        </a>

        <nav className="hidden md:flex items-center gap-8">
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              {link.label}
            </a>
          ))}
        </nav>

        <div className="hidden md:flex items-center gap-3">
          {/*
            Política: el acceso al dashboard SOLO es por login.
            - Sin sesión: solo "Iniciar sesión" / "Prueba gratis" → van a /login
            - Con sesión: "Iniciar sesión" sigue visible (logout es desde el dashboard)
              para mantener el camino de login como el "oficial" y que el usuario
              siempre sepa dónde está el botón.
          */}
          <Link
            to="/login"
            className="text-sm px-4 py-2 border border-border text-foreground hover:border-foreground/40 transition-colors"
          >
            Iniciar sesión
          </Link>
          <Link
            to="/login"
            state={{ fromSignup: true }}
            className="text-sm px-4 py-2 bg-primary text-primary-foreground hover:opacity-90 transition-opacity"
          >
            Prueba gratis
          </Link>
        </div>

        <button
          className="relative md:hidden text-foreground min-w-[44px] min-h-[44px] flex items-center justify-center"
          onClick={() => setOpen((o) => !o)}
          aria-label={open ? 'Cerrar menú' : 'Abrir menú'}
          aria-expanded={open}
        >
          <Menu
            size={22}
            className={`absolute transition-all duration-300 ease-out ${
              open ? 'rotate-90 scale-75 opacity-0' : 'rotate-0 scale-100 opacity-100'
            }`}
          />
          <X
            size={22}
            className={`absolute transition-all duration-300 ease-out ${
              open ? 'rotate-0 scale-100 opacity-100' : '-rotate-90 scale-75 opacity-0'
            }`}
          />
        </button>
      </div>

      <div
        className={`grid bg-background transition-[grid-template-rows,opacity,border-color] duration-300 ease-out md:hidden ${
          open
            ? 'grid-rows-[1fr] border-t border-border opacity-100'
            : 'pointer-events-none grid-rows-[0fr] border-t border-transparent opacity-0'
        }`}
        aria-hidden={!open}
      >
        <div className="overflow-hidden">
          <div
            className={`px-6 py-4 flex flex-col gap-4 transition-transform duration-300 ease-out ${
              open ? 'translate-y-0' : '-translate-y-3'
            }`}
          >
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                {link.label}
              </a>
            ))}
            <div className="flex flex-col gap-2 pt-2 border-t border-border">
              <Link
                to="/login"
                onClick={() => setOpen(false)}
                className="text-sm px-4 py-2 border border-border text-foreground text-center"
              >
                Iniciar sesión
              </Link>
              <Link
                to="/login"
                state={{ fromSignup: true }}
                onClick={() => setOpen(false)}
                className="text-sm px-4 py-2 bg-primary text-primary-foreground text-center"
              >
                Prueba gratis
              </Link>
            </div>
          </div>
        </div>
      </div>
    </header>
  )
}
