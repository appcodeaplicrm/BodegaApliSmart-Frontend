import { Link } from 'react-router-dom'
import {
  BarChart3,
  ArrowDownToLine,
  ArrowUpFromLine,
  Copy,
  Inbox,
  Calendar,
} from 'lucide-react'
import { useAuth } from '../store/auth'

type SubKey = 'entradas' | 'salidas' | 'kardex'

const SUBMODULOS: {
  key: SubKey
  label: string
  descripcion: string
  icon: typeof ArrowDownToLine
  permiso: string
}[] = [
  {
    key: 'entradas',
    label: 'Entradas',
    descripcion: 'Historial de ingresos de mercadería al sistema.',
    icon: ArrowDownToLine,
    permiso: 'reportes.entradas.ver',
  },
  {
    key: 'salidas',
    label: 'Salidas',
    descripcion: 'Historial de salidas y despachos.',
    icon: ArrowUpFromLine,
    permiso: 'reportes.salidas.ver',
  },
  {
    key: 'kardex',
    label: 'Kardex',
    descripcion: 'Movimientos consolidados por producto y bodega.',
    icon: Copy,
    permiso: 'reportes.kardex.ver',
  },
]

/** Vista individual de un sub-módulo de Reportes (placeholder por ahora). */
export function Reportes({ subKey }: { subKey: string }) {
  const sub = SUBMODULOS.find((s) => s.key === subKey)

  if (!sub) {
    return (
      <div className="flex-1 flex items-center justify-center p-12">
        <p className="text-muted-foreground">Reporte "{subKey}" no encontrado.</p>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col min-w-0 min-h-0 overflow-y-auto">
      <div className="p-8 space-y-6">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 bg-muted flex items-center justify-center shrink-0 mt-1">
            <sub.icon size={20} className="text-primary" />
          </div>
          <div>
            <h1
              className="text-4xl uppercase text-foreground leading-none"
              style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900 }}
            >
              {sub.label}
            </h1>
            <p
              className="mt-1 text-sm text-muted-foreground"
              style={{ fontFamily: "'DM Sans', sans-serif" }}
            >
              {sub.descripcion}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button className="inline-flex items-center gap-2 px-3 py-2 border border-border text-xs text-foreground hover:border-foreground/30 transition-colors"
            style={{ borderRadius: '0.25rem', fontFamily: "'JetBrains Mono', monospace" }}
          >
            <Calendar size={12} />
            ÚLTIMOS 30 DÍAS
          </button>
        </div>

        <div
          className="bg-card border border-border py-20 px-6 flex flex-col items-center justify-center text-center"
          style={{ borderRadius: '0.25rem' }}
        >
          <div className="w-14 h-14 bg-muted flex items-center justify-center mb-5">
            <Inbox size={24} className="text-muted-foreground" />
          </div>
          <h3
            className="text-xl uppercase text-foreground"
            style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800 }}
          >
            Sin datos para mostrar
          </h3>
          <p
            className="mt-2 text-sm text-muted-foreground max-w-sm"
            style={{ fontFamily: "'DM Sans', sans-serif" }}
          >
            Cuando registres movimientos de {sub.label.toLowerCase()}, aparecerán
            acá.
          </p>
        </div>
      </div>
    </div>
  )
}

/** Índice de Reportes. Cards clickeables a cada sub-módulo. */
export function ReportesIndex() {
  const auth = useAuth()
  const permisosUsuario = new Set(
    auth.status === 'autenticado' ? auth.sesion.permisos : [],
  )
  const visibles = SUBMODULOS.filter((s) => permisosUsuario.has(s.permiso))

  return (
    <div className="flex-1 flex flex-col min-w-0 min-h-0 overflow-y-auto">
      <div className="p-8 space-y-6">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 bg-muted flex items-center justify-center shrink-0 mt-1">
            <BarChart3 size={20} className="text-primary" />
          </div>
          <div>
            <h1
              className="text-4xl uppercase text-foreground leading-none"
              style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900 }}
            >
              Reportes
            </h1>
            <p
              className="mt-1 text-sm text-muted-foreground"
              style={{ fontFamily: "'DM Sans', sans-serif" }}
            >
              Reportes disponibles según tus permisos
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {visibles.map((sub) => {
            const Icon = sub.icon
            return (
              <Link
                key={sub.key}
                to={`/reportes/${sub.key}`}
                className="group bg-card border border-border p-5 hover:border-primary/40 transition-colors"
                style={{ borderRadius: '0.25rem' }}
              >
                <div className="w-10 h-10 bg-primary/15 flex items-center justify-center mb-4 group-hover:bg-primary/25 transition-colors">
                  <Icon size={18} className="text-primary" />
                </div>
                <h3
                  className="text-lg uppercase text-foreground"
                  style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800 }}
                >
                  {sub.label}
                </h3>
                <p
                  className="mt-1 text-xs text-muted-foreground"
                  style={{ fontFamily: "'DM Sans', sans-serif" }}
                >
                  {sub.descripcion}
                </p>
              </Link>
            )
          })}
        </div>
      </div>
    </div>
  )
}
