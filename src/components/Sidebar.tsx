import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../store/auth'
import { useBodegas, bodegasStore } from '../store/bodegas'
import { useBodegaActiva } from '../store/bodegaActiva'
import { useAlertas, alertasStore } from '../store/alertas'
import {
  LayoutDashboard,
  Boxes,
  Truck,
  UserCog,
  ShieldCheck,
  BarChart3,
  // FileText,
  Bell,
  Settings,
  HelpCircle,
  LogOut,
  Search,
  PanelLeftClose,
  PanelLeftOpen,
  ChevronRight,
  MoreVertical,
  User as UserIcon,
  Sliders,
  Wrench,
  BellRing,
  PackageOpen,
  Undo2,
  HardHat,
  FolderKanban,
  AlertTriangle,
  ArrowDownToLine,
  ArrowUpFromLine,
  Copy,
  ShieldCheck as ShieldIcon,
  Crown,
  Building2,
  CreditCard,
  Activity,
  Globe,
} from 'lucide-react'

type BadgeStyle = 'count' | 'alert' | 'new' | 'alertas'

type SubItemDef = {
  key: string
  /** Path al que navega este sub-ítem (relativo a /tecnicos o /reportes) */
  path: string
  label: string
  icon: typeof LayoutDashboard
  badge?: string
  badgeStyle?: BadgeStyle
  /** Permiso requerido para ver este sub-ítem */
  permiso?: string
}

type NavItem = {
  key: string
  /** Path al que navega este item */
  path: string
  label: string
  icon: typeof LayoutDashboard
  badge?: string
  badgeStyle?: BadgeStyle
  children?: SubItemDef[]
  /** Permiso requerido para ver este item (y/o sus hijos) */
  permiso?: string
  /** si es bodega, renderiza con subtítulo */
  sub?: string
}

type SidebarProps = {
  /** Vista activa (ej: 'dashboard', 'inventario', 'tecnicos') */
  active: string
  /** Sub-ítem activo (ej: 'solicitudes' si estamos en /tecnicos/solicitudes) */
  subKey?: string
  onLogout?: () => void
}

const general: NavItem[] = [
  { key: 'dashboard', path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, permiso: 'dashboard.ver' },
  {
    key: 'inventario',
    path: '/inventario',
    label: 'Inventario',
    icon: Boxes,
    badge: '1.5k',
    permiso: 'inventario.ver',
  },
  {
    key: 'alertas',
    path: '/alertas',
    label: 'Alertas',
    icon: AlertTriangle,
    permiso: 'alertas.ver',
    badge: 'alertas', // marker para que el render use el badge dinámico
  },
  {
    key: 'movimientos',
    path: '/movimientos',
    label: 'Movimientos',
    icon: ArrowDownToLine,
    permiso: 'movimientos.ver',
  },
  {
    key: 'despachos',
    path: '/despachos',
    label: 'Despachos',
    icon: Truck,
    permiso: 'despachos.ver',
  },
  {
    key: 'usuarios',
    path: '/usuarios',
    label: 'Usuarios',
    icon: UserCog,
    permiso: 'usuarios.ver',
  },
  {
    key: 'roles',
    path: '/roles',
    label: 'Roles',
    icon: ShieldCheck,
    permiso: 'roles.ver',
  },
  {
    key: 'tecnicos',
    path: '/tecnicos',
    label: 'Técnicos',
    icon: HardHat,
    permiso: 'tecnicos.ver',
    children: [
      {
        key: 'solicitudes',
        path: '/tecnicos/solicitudes',
        label: 'Solicitudes de Recursos',
        icon: PackageOpen,
        permiso: 'tecnicos.solicitudes.ver',
      },
      {
        key: 'herramientas',
        path: '/tecnicos/herramientas',
        label: 'Herramientas Obligatorias',
        icon: Wrench,
        permiso: 'tecnicos.herramientas.ver',
      },
      {
        key: 'alertas-kit',
        path: '/tecnicos/alertas',
        label: 'Alertas de Kit',
        icon: BellRing,
        permiso: 'tecnicos.alertas.ver',
      },
      {
        key: 'devoluciones',
        path: '/devoluciones',
        label: 'Devoluciones',
        icon: Undo2,
        permiso: 'tecnicos.devoluciones.ver',
      },
      {
        key: 'asignadas',
        path: '/tecnicos/asignadas',
        label: 'Herramientas Asignadas',
        icon: HardHat,
        permiso: 'tecnicos.asignadas.ver',
      },
      {
        key: 'proyectos',
        path: '/tecnicos/proyectos',
        label: 'Proyectos',
        icon: FolderKanban,
        permiso: 'tecnicos.proyectos.ver',
      },
    ],
  },
  {
    key: 'reportes',
    path: '/reportes',
    label: 'Reportes',
    icon: BarChart3,
    permiso: 'reportes.ver',
    children: [
      {
        key: 'entradas',
        path: '/reportes/entradas',
        label: 'Entradas',
        icon: ArrowDownToLine,
        permiso: 'reportes.entradas.ver',
      },
      {
        key: 'salidas',
        path: '/reportes/salidas',
        label: 'Salidas',
        icon: ArrowUpFromLine,
        permiso: 'reportes.salidas.ver',
      },
      {
        key: 'kardex',
        path: '/reportes/kardex',
        label: 'Kardex',
        icon: Copy,
        permiso: 'reportes.kardex.ver',
      },
    ],
  },
  // { key: 'documentos', path: '/documentos', label: 'Documentos', icon: FileText, badge: 'Nuevo', badgeStyle: 'new' },
]

const superAdminItems: NavItem[] = [
  { key: 'empresas', path: '/superadmin/empresas', label: 'Empresas', icon: Building2 },
  { key: 'planes', path: '/superadmin/planes', label: 'Planes', icon: CreditCard },
  { key: 'metricas', path: '/superadmin/metricas', label: 'Métricas', icon: Activity },
  { key: 'sistema', path: '/superadmin/sistema', label: 'Sistema', icon: Globe },
]

export function Sidebar({ active, subKey, onLogout }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false)
  // Submenús que están expandidos. La regla:
  // - Si entramos a un sub-item (active='tecnicos' + subKey='solicitudes'),
  //   abrimos automáticamente el submenú del padre.
  // - Si entramos al item raíz sin subKey, NO abrimos nada (que el sidebar
  //   quede limpio hasta que el usuario clickee el toggle).
  const [openMenus, setOpenMenus] = useState<Record<string, boolean>>({})

  useEffect(() => {
    // Si hay subKey y active es uno de los items con submenús, abrirlo
    if (subKey) {
      setOpenMenus((prev) => ({ ...prev, [active]: true }))
    }
  }, [active, subKey])
  const navigate = useNavigate()
  const auth = useAuth()
  const bodegasState = useBodegas()

  // - Si nunca se cargaron (status === 'idle') → carga inicial.
  // - Si ya están cargadas pero cambió la bodega activa del usuario
  //   (porque el back le asignó una nueva o cambió la sesión) → revalidar.
  // - Si el status es 'error' → reintentar al montar.
  useEffect(() => {
    const status = bodegasState.status
    let debeCargar = status === 'idle' || status === 'error'
    if (!debeCargar && status === 'listo' && auth.status === 'autenticado') {
      const userBodegaId = auth.sesion.usuario.bodegaId
      if (userBodegaId !== null && !bodegasState.bodegas.some((b) => b.id === userBodegaId)) {
        debeCargar = true
      }
    }
    if (debeCargar) {
      void bodegasStore
        .cargar({ rol: auth.status === 'autenticado' ? auth.sesion.usuario.rol : undefined })
        .catch(() => {
          /* si falla, no rompemos el sidebar — solo no va a listar */
        })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bodegasState.status, auth])

  // Permisos del usuario actual (Set para O(1) lookup)
  const permisosUsuario = new Set<string>(
    auth.status === 'autenticado' ? auth.sesion.permisos : [],
  )
  function tienePermiso(key: string | undefined): boolean {
    if (!key) return true // items sin permiso declarado son visibles
    return permisosUsuario.has(key)
  }

  // Filtrar items y sub-ítems por permiso
  const generalFiltrado = general
    .map((item) => {
      if (!tienePermiso(item.permiso)) return null
      if (item.children) {
        const hijosVisibles = item.children.filter((c) => tienePermiso(c.permiso))
        if (hijosVisibles.length === 0) return null
        return { ...item, children: hijosVisibles }
      }
      return item
    })
    .filter((x): x is NavItem => x !== null)

  // El item activo es el que matchea la URL actual
  const viewActivo = active ?? 'dashboard'
  const subActivo = subKey
  // Para saber si estamos "bajo" un item con children (ej: /tecnicos/...)
  // construimos el path completo de la URL.
  const pathActual = subActivo ? `/${viewActivo}/${subActivo}` : `/${viewActivo}`

  const sesion = auth.status === 'autenticado' ? auth.sesion : null
  const usuario = sesion?.usuario ?? null
  const nombreUsuario = usuario?.nombre ?? '—'
  const rolUsuario = usuario?.rol ?? '—'
  // Solo los admins pueden crear bodegas. Consideramos tanto 'admin' como
  // 'superadmin' (por si el back emite ese nombre en algún flujo).
  const rolKey = (rolUsuario ?? '').toLowerCase().trim()
  const esSuperadmin = rolKey === 'superadmin'
  // Nombre legible de la bodega activa del usuario. Tomamos la bodega cuyo id
  // coincide con usuario.bodegaId y caemos al nombre del back si está disponible.
  const bodegaActivaId = usuario?.bodegaId ?? null
  const bodegaActiva =
    bodegaActivaId && bodegasState.status === 'listo'
      ? bodegasState.bodegas.find((b) => b.id === bodegaActivaId)
      : null
  const bodegaLabel = bodegaActiva?.nombre ?? usuario?.nombre ?? '—'
  const initials = getInitials(nombreUsuario)

  const widthClass = collapsed ? 'w-16' : 'w-60'

  function irA(path: string) {
    navigate(path)
  }

  function toggleMenu(label: string) {
    setOpenMenus((prev) => ({ ...prev, [label]: !prev[label] }))
  }

  function handleParentClick(item: NavItem) {
    if (collapsed) {
      // Si el item tiene submenús, expandir para mostrarlos.
      // Si NO tiene submenús, navegar sin expandir (el sidebar sigue colapsado).
      if (item.children) {
        setCollapsed(false)
        setOpenMenus((prev) => ({ ...prev, [item.label]: true }))
      } else {
        irA(item.path)
      }
    } else {
      if (item.children) {
        toggleMenu(item.label)
      } else {
        irA(item.path)
      }
    }
  }

  return (
    <aside
      className={`${widthClass} shrink-0 h-screen bg-card border-r border-border flex flex-col transition-all duration-300 ease-in-out`}
    >
      {/* HEADER */}
      <div
        className={`p-4 border-b border-border ${
          collapsed ? 'flex flex-col items-center gap-3' : 'flex items-center justify-between'
        }`}
      >
        {!collapsed && (
          <div className="flex items-center min-w-0">
            <span
              className="text-foreground text-sm tracking-wider truncate"
              style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900 }}
            >
              WINERY SMART
            </span>
          </div>
        )}
        {collapsed && (
          <div className="w-7 h-7 bg-primary flex items-center justify-center shrink-0">
            <Boxes size={15} className="text-primary-foreground" strokeWidth={2.5} />
          </div>
        )}
        <button
          onClick={() => setCollapsed((c) => !c)}
          className="text-muted-foreground hover:text-foreground transition-colors shrink-0"
          aria-label={collapsed ? 'Expandir sidebar' : 'Colapsar sidebar'}
        >
          {collapsed ? <PanelLeftOpen size={14} /> : <PanelLeftClose size={15} />}
        </button>
      </div>

      {/* SEARCH */}
      {!collapsed && (
        <div className="p-3 border-b border-border">
          <div className="relative">
            <Search
              size={13}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
            />
            <input
              type="text"
              placeholder="Buscar..."
              className="w-full pl-8 pr-10 py-2 bg-muted border border-border text-xs text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/60 transition-colors"
              style={{ borderRadius: '0.25rem', fontFamily: "'JetBrains Mono', monospace" }}
            />
            <kbd
              className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground border border-border px-1.5 py-0.5"
              style={{ borderRadius: '0.15rem', fontFamily: "'JetBrains Mono', monospace" }}
            >
              ⌘K
            </kbd>
          </div>
        </div>
      )}

      {/* SCROLL AREA */}
      <nav className="flex-1 overflow-y-auto py-3">
        {!collapsed && (
          <div
            className="px-4 mb-2 text-[10px] text-muted-foreground uppercase tracking-widest"
            style={{ fontFamily: "'JetBrains Mono', monospace" }}
          >
            GENERAL
          </div>
        )}
        <ul className="space-y-0.5 px-2">
          {generalFiltrado.map((item) => {
            const Icon = item.icon
            const isActive = viewActivo === item.key
            const hasChildren = !!item.children?.length
            const isOpen = !!openMenus[item.label]
            // El padre se ilumina SOLO si la URL actual está bajo su path.
            // Esto evita que un sub-item con path absoluto (ej: /devoluciones
            // dentro de Técnicos con path /tecnicos) ilumine al padre cuando
            // la URL real es /devoluciones (top-level).
            //
            // La condición: `pathActual` empieza con `item.path + '/'`
            //              o `pathActual === item.path`
            const childActive = hasChildren
              ? pathActual === item.path || pathActual.startsWith(item.path + '/')
              : false

            return (
              <li key={item.key}>
                <button
                  onClick={() => handleParentClick(item)}
                  title={collapsed ? item.label : undefined}
                  className={`w-full flex items-center gap-3 px-3 py-2 text-sm transition-colors ${
                    isOpen && childActive
                      ? 'bg-primary/25 text-white'
                      : isOpen
                        ? 'bg-muted text-foreground'
                        : isActive || childActive
                          ? 'bg-primary/20 text-white font-semibold'
                          : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                  } ${collapsed ? 'justify-center' : ''}`}
                  style={{ borderRadius: '0.25rem' }}
                >
                  <Icon
                    size={15}
                    className={`shrink-0 ${
                      isActive || childActive || (isOpen && hasChildren)
                        ? 'text-primary'
                        : 'text-muted-foreground'
                    }`}
                  />
                  {!collapsed && (
                    <>
                      <span className="flex-1 text-left">{item.label}</span>
                      {item.badge === 'alertas' ? (
                        <AlertasBadge />
                      ) : (
                        item.badge && item.badgeStyle && (
                          <Badge value={item.badge} style={item.badgeStyle} />
                        )
                      )}
                      {hasChildren && (
                        <ChevronRight
                          size={13}
                          className={`text-muted-foreground transition-transform duration-300 ${
                            isOpen ? 'rotate-90' : ''
                          }`}
                        />
                      )}
                    </>
                  )}
                </button>

                {/* Submenu acordeón */}
                {hasChildren && !collapsed && (
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateRows: isOpen ? '1fr' : '0fr',
                      transition: 'grid-template-rows 280ms cubic-bezier(0.4,0,0.2,1)',
                    }}
                  >
                    <div className="overflow-hidden">
                      <ul className="ml-3 mt-1 mb-1 pl-3 border-l border-border space-y-0.5">
                        {item.children!.map((sub) => {
                          const SubIcon = sub.icon
                          // El sub-item se ilumina si su path matchea el path actual.
                          // Soporta paths absolutos (ej: /devoluciones) y relativos
                          // al padre (ej: /tecnicos/solicitudes).
                          const isSubActive =
                            sub.path === pathActual ||
                            pathActual.startsWith(sub.path + '/')
                          return (
                            <li key={sub.key}>
                              <button
                                onClick={() => irA(sub.path)}
                                className={`w-full flex items-center gap-2.5 px-2 py-1.5 text-[13px] transition-colors ${
                                  isSubActive
                                    ? 'bg-primary/15 text-white font-semibold'
                                    : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
                                }`}
                                style={{ borderRadius: '0.25rem' }}
                              >
                                {isSubActive && (
                                  <span className="w-1 h-1 rounded-full bg-primary flex-shrink-0" />
                                )}
                                <SubIcon
                                  size={13}
                                  className={`shrink-0 ${
                                    isSubActive ? 'text-primary' : 'text-muted-foreground'
                                  }`}
                                />
                                <span className="flex-1 text-left truncate">{sub.label}</span>
                              </button>
                            </li>
                          )
                        })}
                      </ul>
                    </div>
                  </div>
                )}
              </li>
            )
          })}
        </ul>

        {esSuperadmin && (
          <>
            {!collapsed && (
              <div className="px-4 mt-6 mb-1.5 flex items-center gap-2 text-muted-foreground">
                <Crown size={9} className="text-secondary shrink-0" />
                <span className="text-[9px] tracking-[0.12em] font-mono">SUPER ADMIN</span>
              </div>
            )}
            <ul className="space-y-0.5 px-2">
              {superAdminItems.map((item) => {
                const Icon = item.icon
                const isActive = viewActivo === 'superadmin' && subActivo === item.key
                return (
                  <li key={item.key}>
                    <button
                      onClick={() => irA(item.path)}
                      title={collapsed ? item.label : undefined}
                      className={`w-full flex items-center gap-3 px-3 py-2 text-sm transition-colors ${isActive ? 'bg-secondary/15 text-secondary' : 'text-muted-foreground hover:bg-muted hover:text-foreground'} ${collapsed ? 'justify-center' : ''}`}
                      style={{ borderRadius: '0.25rem' }}
                    >
                      <Icon size={15} className={isActive ? 'text-secondary shrink-0' : 'text-muted-foreground shrink-0'} />
                      {!collapsed && <span>{item.label}</span>}
                    </button>
                  </li>
                )
              })}
            </ul>
          </>
        )}

      </nav>

      {/* BOTTOM BAR */}
      {collapsed ? (
        <KebabMenu
          onLogout={onLogout}
          nombreUsuario={nombreUsuario}
          rolUsuario={rolUsuario}
          bodegaLabel={bodegaLabel}
          initials={initials}
        />
      ) : (
        <div className="p-3 border-t border-border flex items-center gap-1">
          <IconBtn label="Notificaciones">
            <Bell size={14} />
            <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-primary" />
          </IconBtn>
          <IconBtn label="Seguridad">
            <ShieldIcon size={14} />
          </IconBtn>
          <IconBtn label="Configuración">
            <Settings size={14} />
          </IconBtn>
          <IconBtn label="Cerrar sesión" onClick={onLogout}>
            <LogOut size={14} />
          </IconBtn>
        </div>
      )}

      {/* PERFIL */}
      {!collapsed && (
        <div className="p-3 border-t border-border">
          <button className="w-full flex items-center gap-2 hover:bg-muted transition-colors py-1.5">
            <div className={`w-8 h-8 flex items-center justify-center shrink-0 ${esSuperadmin ? 'bg-secondary/20 border border-secondary/30' : 'bg-primary/20 border border-primary/30'}`}>
              {esSuperadmin ? <Crown size={14} className="text-secondary" /> : <span className="text-primary text-xs" style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800 }}>{initials}</span>}
            </div>
            <div className="flex-1 text-left min-w-0">
              <div className="text-xs text-foreground truncate">{nombreUsuario}</div>
              <div
                className="text-[9px] text-muted-foreground flex items-center gap-1"
                style={{ fontFamily: "'JetBrains Mono', monospace" }}
              >
                <span
                  className={`px-1 bg-muted ${esSuperadmin ? 'text-secondary' : 'text-muted-foreground'}`}
                  style={{ borderRadius: '0.15rem' }}
                >
                  {esSuperadmin ? 'Super Admin' : rolUsuario}
                </span>
                {!esSuperadmin && <span>· {bodegaLabel}</span>}
              </div>
            </div>
            <ChevronRight size={14} className="text-muted-foreground shrink-0" />
          </button>
        </div>
      )}
    </aside>
  )
}

function Badge({ value, style }: { value: string; style: BadgeStyle }) {
  const className =
    style === 'count'
      ? 'bg-secondary text-secondary-foreground'
      : style === 'alert'
        ? 'bg-primary text-primary-foreground'
        : style === 'alertas'
          ? 'bg-primary text-primary-foreground'
          : 'border border-secondary text-secondary'
  return (
    <span
      className={`text-[9px] px-1.5 py-0.5 ${className}`}
      style={{
        borderRadius: '0.15rem',
        fontFamily: "'JetBrains Mono', monospace",
        fontWeight: 500,
      }}
    >
      {value}
    </span>
  )
}

/** Badge vivo: cuenta las alertas activas de la bodega seleccionada. */
function AlertasBadge() {
  const activaId = useBodegaActiva()
  const state = useAlertas()

  useEffect(() => {
    if (!activaId) return
    if (state.status === 'idle') {
      void alertasStore.cargar(activaId).catch(() => undefined)
    }
  }, [activaId, state.status])

  if (state.status !== 'listo' || state.bodegaId !== activaId) return null
  const n = state.alertas.length
  if (n === 0) return null
  return <Badge value={n > 99 ? '99+' : String(n)} style="alertas" />
}

function IconBtn({
  children,
  label,
  onClick,
}: {
  children: React.ReactNode
  label: string
  onClick?: () => void
}) {
  return (
    <button
      onClick={onClick}
      title={label}
      className="relative flex-1 flex items-center justify-center py-2 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
      style={{ borderRadius: '0.25rem' }}
    >
      {children}
    </button>
  )
}

function KebabMenu({
  onLogout,
  nombreUsuario,
  rolUsuario,
  bodegaLabel,
  initials,
}: {
  onLogout?: () => void
  nombreUsuario: string
  rolUsuario: string
  bodegaLabel: string
  initials: string
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    function handleEsc(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', handle)
    document.addEventListener('keydown', handleEsc)
    return () => {
      document.removeEventListener('mousedown', handle)
      document.removeEventListener('keydown', handleEsc)
    }
  }, [open])

  return (
    <div ref={ref} className="relative p-3 border-t border-border">
      <button
        onClick={() => setOpen((o) => !o)}
        title="Más opciones"
        className={`w-full flex items-center justify-center py-2 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors ${
          open ? 'bg-muted text-foreground' : ''
        }`}
        style={{ borderRadius: '0.25rem' }}
      >
        <MoreVertical size={16} />
      </button>

      {open && (
        <div
          className="absolute bottom-full left-full ml-2 mb-1 w-64 bg-card border border-border z-50"
          style={{ borderRadius: '0.25rem' }}
        >
          <div className="p-3 border-b border-border flex items-center gap-3">
            <div className="w-9 h-9 bg-primary/20 border border-primary/30 flex items-center justify-center shrink-0">
              <span
                className="text-primary text-sm"
                style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800 }}
              >
                {initials}
              </span>
            </div>
            <div className="flex-1 text-left min-w-0">
              <div className="text-sm text-foreground truncate">{nombreUsuario}</div>
              <div
                className="text-[9px] text-muted-foreground"
                style={{ fontFamily: "'JetBrains Mono', monospace" }}
              >
                {rolUsuario} · {bodegaLabel}
              </div>
            </div>
            <ChevronRight size={14} className="text-muted-foreground shrink-0" />
          </div>

          <KItem icon={Sliders} label="Personalización" />
          <KItem icon={UserIcon} label="Perfil" />
          <KItem icon={Settings} label="Configuración" />
          <div className="my-1 border-t border-border" />
          <KItem icon={HelpCircle} label="Ayuda" trailing={<ChevronRight size={14} />} />
          <KItem
            icon={LogOut}
            label="Cerrar sesión"
            danger
            onClick={() => {
              setOpen(false)
              onLogout?.()
            }}
          />
        </div>
      )}
    </div>
  )
}

function KItem({
  icon: Icon,
  label,
  trailing,
  danger,
  onClick,
}: {
  icon: typeof Sliders
  label: string
  trailing?: React.ReactNode
  danger?: boolean
  onClick?: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors ${
        danger
          ? 'text-foreground hover:bg-primary/15 hover:text-primary'
          : 'text-foreground hover:bg-muted'
      }`}
    >
      <Icon size={15} className="text-muted-foreground shrink-0" />
      <span className="flex-1 text-left">{label}</span>
      {trailing}
    </button>
  )
}

function getInitials(nombre: string): string {
  return nombre
    .split(' ')
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase()
}
