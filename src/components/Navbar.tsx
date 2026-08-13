import { useState } from 'react'
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

  return (
    <header
      className="fixed top-0 inset-x-0 z-50 bg-background/95 backdrop-blur-sm border-b border-border"
      style={{ fontFamily: "'DM Sans', system-ui, sans-serif", paddingTop: 'env(safe-area-inset-top)' }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        <a href="#" className="flex items-center">
          <span
            className="text-foreground text-2xl tracking-wider"
            style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900 }}
          >
            BodegaApliSmart
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
          className="md:hidden text-foreground min-w-[44px] min-h-[44px] -mr-2 flex items-center justify-center"
          onClick={() => setOpen((o) => !o)}
          aria-label={open ? 'Cerrar menú' : 'Abrir menú'}
          aria-expanded={open}
        >
          {open ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>

      {open && (
        <div className="md:hidden border-t border-border bg-background">
          <div className="px-6 py-4 flex flex-col gap-4">
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
      )}
    </header>
  )
}
