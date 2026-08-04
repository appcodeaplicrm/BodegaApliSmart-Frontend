const footerLinks = {
  producto: ['Funcionalidades', 'Precios', 'Integraciones', 'Roadmap'],
  empresa: ['Sobre winery smart', 'Casos de éxito', 'Trabaja con nosotros', 'Prensa'],
  recursos: ['Documentación', 'Blog', 'Centro de ayuda', 'Estado del sistema'],
}

export function Footer() {
  return (
    <footer className="border-t border-border py-12">
      <div className="max-w-7xl mx-auto px-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-8">
          <div className="flex items-center">
            <span
              className="text-foreground text-2xl tracking-wider"
              style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900 }}
            >
              WINERY SMART
            </span>
          </div>

          <div className="grid grid-cols-3 gap-8 md:gap-16">
            {Object.entries(footerLinks).map(([section, links]) => (
              <div key={section}>
                <div
                  className="text-xs text-muted-foreground uppercase tracking-widest mb-3"
                  style={{ fontFamily: "'JetBrains Mono', monospace" }}
                >
                  {section}
                </div>
                <ul className="space-y-2">
                  {links.map((l) => (
                    <li key={l}>
                      <a
                        href="#"
                        className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                      >
                        {l}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-12 pt-6 border-t border-border flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <p
            className="text-xs text-muted-foreground"
            style={{ fontFamily: "'JetBrains Mono', monospace" }}
          >
            © 2026 winery smart — sistema de gestión de bodega
          </p>
          <div
            className="flex items-center gap-4 text-xs text-muted-foreground"
            style={{ fontFamily: "'JetBrains Mono', monospace" }}
          >
            <a href="#" className="hover:text-foreground transition-colors">
              Términos
            </a>
            <a href="#" className="hover:text-foreground transition-colors">
              Privacidad
            </a>
            <a href="#" className="hover:text-foreground transition-colors">
              Seguridad
            </a>
          </div>
        </div>
      </div>
    </footer>
  )
}
