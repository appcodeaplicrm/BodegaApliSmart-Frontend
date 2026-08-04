import { getSubmodulo, SUBMODULOS_TECNICOS } from './tecnicos/tecnicos'
import { SubmoduloView } from './tecnicos/SubmoduloView'
import { Ordenes } from './Ordenes'
import { Link } from 'react-router-dom'
import { HardHat } from 'lucide-react'
import { useAuth } from '../store/auth'

type TecnicosProps = {
  subKey: string
}

export function Tecnicos({ subKey }: TecnicosProps) {
  // 'Solicitudes de Recursos' usa la pantalla completa de Órdenes
  if (subKey === 'solicitudes') {
    return <Ordenes />
  }

  // Convertir el path segment (ej: "solicitudes") al key completo (ej: "tecnicos:solicitudes")
  // que usa getSubmodulo
  const fullKey = subKey.startsWith('tecnicos:') ? subKey : `tecnicos:${subKey}`

  const sub = getSubmodulo(fullKey)
  if (!sub) {
    return (
      <div className="flex-1 flex items-center justify-center p-12">
        <p className="text-muted-foreground">Submódulo no encontrado.</p>
      </div>
    )
  }
  return <SubmoduloView sub={sub} />
}

/**
 * Índice de Técnicos. Se muestra cuando el usuario va a /tecnicos sin un
 * sub-ítem. Lista los sub-módulos como cards clickeables.
 */
export function TecnicosIndex() {
  const auth = useAuth()
  const permisosUsuario = new Set(
    auth.status === 'autenticado' ? auth.sesion.permisos : [],
  )

  // Filtrar por permiso (usando la jerarquía nueva de sub-módulos)
  const visibles = SUBMODULOS_TECNICOS.filter((s) => {
    const subKey = s.key.split(':')[1] // 'tecnicos:solicitudes' → 'solicitudes'
    return permisosUsuario.has(`tecnicos.${subKey}.ver`)
  })

  return (
    <div className="flex-1 flex flex-col min-w-0 min-h-0 overflow-y-auto">
      <div className="p-8 space-y-6">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 bg-muted flex items-center justify-center shrink-0 mt-1">
            <HardHat size={20} className="text-primary" />
          </div>
          <div>
            <h1
              className="text-4xl uppercase text-foreground leading-none"
              style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900 }}
            >
              Técnicos
            </h1>
            <p
              className="mt-1 text-sm text-muted-foreground"
              style={{ fontFamily: "'DM Sans', sans-serif" }}
            >
              Sub-módulos disponibles para tu rol
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {visibles.map((sub) => {
            const Icon = sub.icon
            const path = `/tecnicos/${sub.key.split(':')[1]}`
            return (
              <Link
                key={sub.key}
                to={path}
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
