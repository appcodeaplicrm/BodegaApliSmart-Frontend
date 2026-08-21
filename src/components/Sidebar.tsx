import { useState, useEffect, useMemo } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../store/auth'
import { useBodegas, bodegasStore } from '../store/bodegas'
import { useBodegasAccesibles, bodegasAccesiblesStore } from '../store/contextoBodega'
import { useBodegaActiva, bodegaActivaStore } from '../store/bodegaActiva'
import { useAlertas, alertasStore } from '../store/alertas'
import { MisBodegasButton } from './MisBodegasButton'
import { usePermisosDeBodegaActiva } from '../hooks/usePermisosDeBodegaActiva'
import { permisosPorBodegaStore } from '../store/permisosPorBodega'
import { authStore } from '../store/auth'
import { MODULOS } from '../store/permisos'
import { permisoDeRuta, primeraRutaPermitida } from '../lib/routing'
import { imageUrl } from '../lib/apiBase'
import { useRealtimeStatus } from './RealtimeProvider'
import {
  LayoutDashboard,
  Boxes,
  Truck,
  UserCog,
  ShieldCheck,
  BarChart3,
  // FileText,
  Settings,
  LogOut,
  Search,
  PanelLeftClose,
  PanelLeftOpen,
  ChevronRight,
  Wrench,
  BellRing,
  PackageOpen,
  Undo2,
  HardHat,
  FolderKanban,
  ListChecks,
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
  Tag,
  Award,
  MapPin,
  Map as MapIcon,
  MessageCircle,
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
  /** Callback opcional. Si está, se usa en lugar de navegar a `path`.
   *  Útil para sub-ítems que disparan una acción (ej: cambiar de bodega
   *  activa) en vez de cambiar de ruta. */
  onSelect?: () => void
  /** Si es true, el sub-ítem se renderiza resaltado aunque no coincida
   *  con la URL actual. Lo usa el sidebar para marcar la bodega activa
   *  en el submenú de "Mis bodegas". */
  selectedByAction?: boolean
  /** Ícono extra a la derecha (ej: check verde para la bodega activa). */
  trailingIcon?: typeof LayoutDashboard
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
  /** Estado móvil: el sidebar está abierto como drawer (sólo <lg). */
  mobileOpen?: boolean
  /** Callback para cerrar el drawer móvil (backdrop / Escape / ruta). */
  onMobileClose?: () => void
}

const general: NavItem[] = [
  // Chat interno 1-a-1 — sin permiso (visible para todos los
  // usuarios activos de la bodega).
  { key: 'chat', path: '/chat', label: 'Chat', icon: MessageCircle },
  { key: 'dashboard', path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, permiso: 'dashboard.ver' },
  {
    key: 'inventario',
    path: '/inventario',
    label: 'Inventario',
    icon: Boxes,
    badge: '1.5k',
    permiso: 'inventario.ver',
    children: [
      {
        key: 'productos',
        path: '/inventario',
        label: 'Productos',
        icon: Boxes,
        permiso: 'inventario.ver',
      },
      {
        key: 'categorias',
        path: '/inventario/categorias',
        label: 'Categorías',
        icon: Tag,
        permiso: 'inventario.ver',
      },
      {
        key: 'marcas',
        path: '/inventario/marcas',
        label: 'Marcas',
        icon: Award,
        permiso: 'inventario.ver',
      },
      {
        key: 'proveedores',
        path: '/inventario/proveedores',
        label: 'Proveedores',
        icon: Truck,
        permiso: 'inventario.ver',
      },
      {
        key: 'ubicaciones',
        path: '/inventario/ubicaciones',
        label: 'Secciones de la bodega',
        icon: MapPin,
        permiso: 'inventario.ver',
      },
      {
        key: 'productos-entregados',
        path: '/inventario/productos-entregados',
        label: 'Productos entregados',
        icon: MapIcon,
        permiso: 'inventario.productos-entregados.ver',
      },
    ],
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
    key: 'auditoria',
    path: '/auditoria',
    label: 'Auditoría',
    icon: ShieldCheck,
    permiso: 'auditoria.ver',
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
      {
        key: 'checklist',
        path: '/tecnicos/checklist',
        label: 'Checklist',
        icon: ListChecks,
        permiso: 'tecnicos.checklist.ver',
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

export function Sidebar({ active, subKey, onLogout, mobileOpen = false, onMobileClose }: SidebarProps) {
  const realtimeStatus = useRealtimeStatus()
  const [collapsed, setCollapsed] = useState(false)
  // Submenús que están expandidos. La regla:
  // - Si entramos a un sub-item (active='tecnicos' + subKey='solicitudes'),
  //   abrimos automáticamente el submenú del padre.
  // - Si entramos al item raíz sin subKey, NO abrimos nada (que el sidebar
  //   quede limpio hasta que el usuario clickee el toggle).
  const [openMenus, setOpenMenus] = useState<Record<string, boolean>>({})

  const navigate = useNavigate()
  const location = useLocation()
  const auth = useAuth()
  // Sprint 3 Fase 6 (Corrección 3 del .md): el sidebar consume las
  // bodegas ACCESIBLES del user (vía /auth/me/bodegas), NO la lista
  // global de bodegas del tenant (vía /bodegas). Eso evita la
  // dependencia circular: /bodegas exige inventario.ver, que es un
  // permiso de bodega que todavía no se eligió.
  const bodegasAccesiblesState = useBodegasAccesibles()

  useEffect(() => {
    // Si hay subKey y active es uno de los items con submenús, abrirlo
    if (subKey) {
      setOpenMenus((prev) => ({ ...prev, [active]: true }))
    }
  }, [active, subKey])

  // Cierra el drawer móvil cuando cambia la ruta (cualquier navegación).
  // Lo hace el Sidebar directamente para no obligar al AppLayout a
  // coordinarse con un useEffect separado.
  useEffect(() => {
    onMobileClose?.()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname])

  // Carga las bodegas accesibles (vía /auth/me/bodegas) si todavía
  // no se cargaron. NO recarga en cada cambio de `auth` — el
  // bootstrap del App.tsx y el Login.tsx ya se encargan de la
  // carga inicial con la bodega activa y permisos incluidos.
  useEffect(() => {
    if (auth.status !== 'autenticado') return
    if (bodegasAccesiblesState.status === 'idle' || bodegasAccesiblesState.status === 'error') {
      void bodegasAccesiblesStore.cargar().catch(() => {
        /* el estado 'error' ya se seteó */
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth.status])

  // ─── Permisos de la bodega activa (Sprint 3 Fase 6) ───
  // Los módulos del sidebar cambian según la bodega activa. Un user puede
  // tener permisos distintos en cada bodega, así que NO usamos
  // `auth.sesion.permisos` (que es estático, del login). Usamos
  // `usePermisosDeBodegaActiva()` que cachea por bodega.
  //
  // Edge case: mientras se cargan los permisos de la nueva bodega, el
  // sidebar usa los permisos anteriores (o vacío si es la primera
  // carga) para no parpadear.
  const { permisos: permisosDeBodega, bodegaId: _bodegaActivaDelHook } = usePermisosDeBodegaActiva()
  const permisosUsuario = useMemo(
    () => new Set<string>(permisosDeBodega?.permisos ?? []),
    [permisosDeBodega],
  )
  // Propietario del tenant: viene explícito del back (`esPropietario: true`).
  // NO se infiere del nombre del rol: si un delegado conserva `admin`
  // global, eso NO significa que sea propietario del tenant. El back
  // ya devuelve TODOS los permisos efectivos del propietario limitados
  // por el plan, así que NO necesitamos un bypass visual: si los
  // permisos del cache incluyen el permiso del item, el item se ve.
  const esPropietario = permisosDeBodega?.esPropietario === true
  function tienePermiso(key: string | undefined): boolean {
    if (!key) return true // items sin permiso declarado son visibles
    if (esPropietario) return true
    return permisosUsuario.has(key)
  }

  // ─── Sincronizar `auth.sesion.permisos` con la bodega activa ───
  // Hay un montón de componentes en la app que leen
  // `auth.sesion.permisos.includes('inventario.crear')` directamente
  // (botones de crear/editar/eliminar, guards, etc.). Para que todos se
  // enteren del cambio de bodega SIN reescribir cada uno, sincronizamos
  // los permisos de la sesión con los de la bodega activa cada vez que
  // el store `permisosPorBodega` se actualiza. La alternativa (migrar
  // todos los usos a `usePermisosDeBodegaActiva`) es más prolija pero
  // requiere tocar ~15 archivos. Esta sincronización es un trade-off:
  //   - Mantiene la API existente (`auth.sesion.permisos` sigue
  //     funcionando).
  //   - `modulePermissions` y `permisos` siempre quedan consistentes.
  //   - El back sigue siendo la fuente de verdad: cada `cargar(bodegaId)`
  //     hace un fetch fresco.
  useEffect(() => {
    if (!permisosDeBodega) return
    if (auth.status !== 'autenticado') return
    authStore.actualizarPermisos(
      permisosDeBodega.permisos,
      permisosDeBodega.modulePermissions,
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [permisosDeBodega])

  // Filtrar items y sub-ítems por permiso.
  //
  // Regla (Sprint 3 Fase 6 — Corrección 5 del .md): un módulo/sub-módulo
  // aparece SOLO si el user tiene permiso `ver` explícito sobre él.
  // NO basta con tener `crear`, `editar` o `eliminar` para que la
  // pantalla sea visible. Esto mantiene la consistencia con
  // `rutaInicialDesdePermisos` y con el backend (que también exige
  // `*.ver` para listar).
  //
  // Shape de checks:
  //   - Módulo plano (sin sub-módulos) → `${modulo}.ver`
  //     ej: 'movimientos.ver' muestra Movimientos.
  //   - Sub-módulo → `${modulo}.${submodulo}.ver`
  //     ej: 'inventario.productos.ver' muestra Productos dentro de Inventario.
  //   - Padre con sub-módulos → aparece si tiene `${modulo}.ver` O si al
  //     menos un hijo tiene `${modulo}.${submodulo}.ver`. Esto permite
  //     que un user con `inventario.productos.ver` (sin `inventario.ver`)
  //     vea el item padre Inventario, y Productos como sub-item.
  function puedeVerModuloPlano(moduloKey: string): boolean {
    if (esPropietario) return true
    return permisosUsuario.has(`${moduloKey}.ver`)
  }
  function puedeVerSubmodulo(moduloKey: string, subKey: string): boolean {
    if (esPropietario) return true
    return permisosUsuario.has(`${moduloKey}.${subKey}.ver`)
  }
  // ⚠️ Antes había un `padreTieneVer` que se usaba para mostrar el
  // módulo padre si algún sub-módulo era visible. Lo eliminamos
  // porque contradice la regla de "ocultar el módulo si no tenés el
  // permiso del padre" (los sub-permisos se usan para flujos
  // puntuales como Solicitud de Recursos, no para mostrar el módulo
  // en el sidebar).

  function tienePermisoEnModulo(item: NavItem): boolean {
    if (tienePermiso(item.permiso)) return true
    if (esPropietario) return true
    if (item.children) {
      // Módulo con sub-módulos: aparece SOLO si tiene el `ver` propio
      // del módulo padre. NO se filtra por sub-módulos visibles.
      //
      // Razón (ago 2026): un user con permisos granulares del
      // sub-módulo (ej: `inventario.productos.ver` sin
      // `inventario.ver`) debe poder usar la lista de productos
      // desde otros flujos (Solicitud de Recursos, Despachos)
      // SIN ver el módulo Inventario en el sidebar. El check se
      // hace en el BACK (los endpoints aceptan cualquiera de los
      // dos permisos, ver `productos.controller.ts`).
      //
      // Antes (mal) mostraba el módulo si algún sub-módulo era
      // visible, contradiciendo la intención de "ocultar el módulo
      // si no tenés el permiso del padre".
      return false
    }
    // Módulo plano.
    return puedeVerModuloPlano(item.key)
  }

  const generalFiltrado = general
    .map((item) => {
      if (!tienePermisoEnModulo(item)) return null
      if (item.children) {
        const hijosVisibles = item.children.filter((c) => {
          if (tienePermiso(c.permiso)) return true
          const modulo = MODULOS.find((m) => m.key === item.key)
          if (modulo?.submodulos) {
            return puedeVerSubmodulo(item.key, c.key)
          }
          // Sin sub-módulos en MODULOS: fallback al permiso del item.
          if (tienePermiso(c.permiso)) return true
          return false
        })
        if (hijosVisibles.length === 0) return null
        return { ...item, children: hijosVisibles }
      }
      return item
    })
    .filter((x): x is NavItem => x !== null)

  // (El bloque `itemsBodegas` / `generalConBodegas` ya no existe:
  // el selector de bodega activa se movió a `MisBodegasButton`,
  // un botón en la parte baja del Sidebar que abre un modal. Ver
  // el render del bottom del Sidebar más abajo.)

  // El item activo es el que matchea la URL actual
  const viewActivo = active ?? 'dashboard'
  const subActivo = subKey
  // Para saber si estamos "bajo" un item con children (ej: /tecnicos/...)
  // construimos el path completo de la URL.
  const pathActual = subActivo ? `/${viewActivo}/${subActivo}` : `/${viewActivo}`

  const sesion = auth.status === 'autenticado' ? auth.sesion : null
  const usuario = sesion?.usuario ?? null
  const nombreUsuario = usuario?.nombre ?? '—'
  // Para checks de permiso seguimos usando la key (no el nombre legible).
  const rolKey = (usuario?.rol ?? '').toLowerCase().trim()
  const esSuperadmin = rolKey === 'superadmin'
  // ─── Sprint 3: "dueño del tenant" ───
  // La condición de "dueño del tenant" la da explícitamente el back
  // vía `permisosDeBodega.esPropietario`. NO se infiere de la key
  // del rol: si un delegado conserva `admin` global, eso NO
  // significa que sea propietario (sección 12 del .md).
  // (El flag de "es dueño del tenant" ahora lo decide el
  // `MisBodegasButton` a partir del store de bodegas accesibles.)
  // Rol que se muestra en la barra inferior: el nombre del rol
  // efectivo en la bodega activa (NO el rol global de la sesión).
  // Si es propietario y no tiene rol explícito, mostramos "Propietario".
  const rolUsuario = esPropietario
    ? 'Propietario'
    : (permisosDeBodega?.rol?.nombre ?? usuario?.rolNombre ?? '—')
  // Bodega activa (puede diferir de `usuario.bodegaId` si el user
  // cambió manualmente desde el sidebar). La fuente es `useBodegaActiva`
  // (no `usuario.bodegaId`, que es la principal legacy).
  const bodegaActivaActual = useBodegaActiva()

  // ─── Reasegurar bodega activa (defensa en profundidad) ───
  // El init de la bodega activa lo hace el `Login.tsx` (cuando
  // termina el login) y el bootstrap del `App.tsx` (cuando se
  // recarga la página). Este effect es una red de seguridad: si
  // el cache de bodegas accesibles ya está listo y la activa no
  // es válida, la corrige eligiendo principal → primera.
  useEffect(() => {
    if (bodegasAccesiblesState.status !== 'listo') return
    const guardada = bodegaActivaStore.getId()
    const activa =
      bodegasAccesiblesStore.elegirBodegaActiva(guardada)
    if (!activa) return
    if (guardada !== activa.id) {
      bodegaActivaStore.set(activa.id, activa.nombre)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bodegasAccesiblesState.status])

  // Nombre legible de la bodega activa. Fuente: `bodegaActivaActual`
  // (que ya viene del `bodegaActivaStore` sincronizado al login).
  // NO usamos `usuario.bodegaId` (que es la principal legacy).
  const bodegaActivaInfo =
    bodegaActivaActual && bodegasAccesiblesState.status === 'listo'
      ? bodegasAccesiblesState.bodegas.find((b) => b.id === bodegaActivaActual)
      : null
  const bodegaLabel = bodegaActivaInfo?.nombre ?? '—'
  const initials = getInitials(nombreUsuario)
  const avatarUrl = imageUrl(usuario?.fotoUrl) ?? usuario?.fotoUrl ?? null

  const widthClass = collapsed ? 'w-16' : 'w-60'

  // ─── Items dinámicos de bodegas (Sprint 3 Fase 6) ───
  // El sidebar ahora es el dueño del selector de bodega activa. La lista
  // de bodegas se muestra como sub-menú de "Mis bodegas" y cada bodega
  // es un sub-item con `onSelect` (cambia la bodega activa, NO navega).
  // "Crear bodega" es un sub-item con `onSelect` que abre el modal — solo
  // (El selector de bodega activa se movió a `MisBodegasButton`,
  // que vive en la parte baja del Sidebar. Acá ya no construimos
  // items de "Mis bodegas" para el nav.)

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
        if (item.path) irA(item.path)
      }
    } else {
      if (item.children) {
        toggleMenu(item.label)
      } else {
        if (item.path) irA(item.path)
      }
    }
  }

  return (
    <>
      {/* Overlay móvil: solo se muestra cuando el drawer está abierto
          en pantallas <lg. Click → cierra. */}
      <div
        onClick={onMobileClose}
        aria-hidden
        className={`fixed inset-0 z-40 bg-background/80 backdrop-blur-sm transition-opacity duration-300 lg:hidden ${
          mobileOpen ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
      />
      <aside
        // En móvil: drawer fijo, oculto por transform.
        // En desktop (lg): relativo, sin transform, ocupa su ancho.
        className={`${widthClass} shrink-0 bg-card border-r border-border flex flex-col overflow-hidden
          fixed inset-y-0 left-0 z-50 transform transition-[width,transform] duration-300 ease-out will-change-[width,transform]
          lg:relative lg:translate-x-0 lg:z-auto lg:h-dvh
          ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
        style={{
          // Áreas seguras iOS: respetar el inset-left y top.
          paddingLeft: 'max(0px, env(safe-area-inset-left))',
          paddingTop: 'env(safe-area-inset-top)',
        }}
        aria-hidden={!mobileOpen}
      >
      {/* HEADER */}
      <div
        className={`p-4 border-b border-border transition-[padding,gap] duration-200 ease-out ${
          collapsed ? 'flex flex-col items-center gap-3' : 'flex items-center justify-between'
        }`}
      >
        {!collapsed && (
          <div className="flex items-center min-w-0 gap-1">
          <span
            className="font-brand text-[clamp(0.40rem,1.5vw,0.95rem)] text-primary tracking-wide"
          >
            Bodega
          </span>
          <span className="font-brand text-[clamp(0.40rem,1.5vw,0.95rem)] text-white tracking-wide">
             ApliSmart
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
            // El padre se ilumina SOLO si la URL actual está BAJO su path
            // con sub-ruta (ej: /inventario/categorias → padre Inventario).
            // NO se ilumina si la URL es exactamente su path (eso es
            // responsabilidad del sub-item raíz, ej: "Productos").
            //
            // Si el padre es /tecnicos y la URL es /devoluciones (otro item
            // top-level), el padre NO se ilumina aunque startsWith('/tecnicos/')
            // no matchee (la URL no empieza con /tecnicos/).
            //
            // Caso especial: si el padre NO tiene children, se ilumina
            // cuando su path coincide exacto.
            const childActive = hasChildren
              ? pathActual.startsWith(item.path + '/')
              : false

            return (
              <li key={item.key}>
                <button
                  onClick={() => handleParentClick(item)}
                  title={collapsed ? item.label : undefined}
                  className={`w-full flex items-center gap-3 px-3 py-2 text-sm transition-[color,background-color,padding,gap] duration-200 ease-out ${
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
                          // El sub-item se ilumina SOLO si su path matchea
                          // exacto con la URL actual. Esto evita que el
                          // sub-item con path === parent.path (ej: Productos
                          // con /inventario) quede activo cuando estamos
                          // en /inventario/categorias.
                          //
                          // Excepción: si el sub-item tiene `onSelect` (no
                          // navega, dispara una acción como cambiar de bodega),
                          // usamos `selectedByAction` para resaltarlo
                          // (lo pasa el padre como prop extra).
                          const isSubActive = sub.path === pathActual
                          const isActionActive = sub.onSelect && sub.selectedByAction === true
                          const isHighlighted = isSubActive || isActionActive
                          return (
                            <li key={sub.key}>
                              <button
                                onClick={() => {
                                  if (sub.onSelect) {
                                    sub.onSelect()
                                  } else {
                                    irA(sub.path)
                                  }
                                }}
                                className={`w-full flex items-center gap-2.5 px-2 py-1.5 text-[13px] transition-colors ${
                                  isHighlighted
                                    ? 'bg-primary/15 text-white font-semibold'
                                    : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
                                }`}
                                style={{ borderRadius: '0.25rem' }}
                              >
                                {isHighlighted && (
                                  <span className="w-1 h-1 rounded-full bg-primary flex-shrink-0" />
                                )}
                                <SubIcon
                                  size={13}
                                  className={`shrink-0 ${
                                    isHighlighted ? 'text-primary' : 'text-muted-foreground'
                                  }`}
                                />
                                <span className="flex-1 text-left truncate">{sub.label}</span>
                                {sub.trailingIcon && (
                                  <sub.trailingIcon
                                    size={12}
                                    className="text-secondary shrink-0"
                                  />
                                )}
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
                      className={`w-full flex items-center gap-3 px-3 py-2 text-sm transition-[color,background-color,padding,gap] duration-200 ease-out ${isActive ? 'bg-secondary/15 text-secondary' : 'text-muted-foreground hover:bg-muted hover:text-foreground'} ${collapsed ? 'justify-center' : ''}`}
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

      {/* BOTTOM BAR — iconos siempre presentes (4 acciones rápidas) */}
      <div
        className={`border-t border-border transition-[padding,gap] duration-200 ease-out ${
          collapsed ? 'p-2 flex flex-col items-stretch gap-1' : 'p-3 flex items-center gap-1'
        }`}
      >
        <IconBtn label="Seguridad" collapsed={collapsed} onClick={() => irA('/perfil')}>
          <ShieldIcon size={collapsed ? 16 : 14} />
        </IconBtn>
        <IconBtn label="Configuración" collapsed={collapsed}>
          <Settings size={collapsed ? 16 : 14} />
        </IconBtn>
        <IconBtn label="Cerrar sesión" collapsed={collapsed} onClick={onLogout}>
          <LogOut size={collapsed ? 16 : 14} />
        </IconBtn>
      </div>

      {/* Selector de bodega activa — vive en la parte baja del Sidebar,
          sobre el perfil. Click → abre un modal con buscador + lista
          completa de bodegas accesibles. Ver `MisBodegasButton.tsx`. */}
      <div
        className={`border-t border-border transition-[padding] duration-200 ease-out ${
          collapsed ? 'p-2' : 'p-3'
        }`}
      >
        <MisBodegasButton collapsed={collapsed} />
      </div>

      {/* PERFIL — siempre visible, con el avatar del usuario.
          Click → ir a /perfil. Activo cuando viewActivo === 'perfil'. */}
      <div className="p-3 border-t border-border">
        <button
          onClick={() => irA('/perfil')}
          title={collapsed ? `Perfil · ${nombreUsuario}` : undefined}
          className={`w-full flex items-center transition-colors ${
            collapsed ? 'justify-center py-1' : 'gap-2 hover:bg-muted py-1.5'
          } ${viewActivo === 'perfil' ? 'bg-muted' : ''}`}
          style={{ borderRadius: '0.25rem' }}
        >
          <div
            className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 overflow-hidden ${
              esSuperadmin
                ? 'bg-secondary/20 border border-secondary/30'
                : 'bg-primary/20 border border-primary/30'
            }`}
          >
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt={`Foto de ${nombreUsuario}`}
                className="w-full h-full object-cover"
              />
            ) : esSuperadmin ? (
              <Crown size={14} className="text-secondary" />
            ) : (
              <span
                className="text-primary text-xs"
                style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800 }}
              >
                {initials}
              </span>
            )}
          </div>
          {!collapsed && (
            <>
              <div className="flex-1 text-left min-w-0">
                <div className="text-xs text-foreground flex items-center gap-2 min-w-0">
                  <span className="truncate">{nombreUsuario}</span>
                  <span
                    aria-label={`Estado de conexión: ${realtimeStatus}`}
                    title={`Estado de conexión: ${realtimeStatus}`}
                    className={`w-2 h-2 rounded-full shrink-0 ${
                      realtimeStatus === 'connected'
                        ? 'bg-emerald-500'
                        : realtimeStatus === 'connecting'
                          ? 'bg-amber-500 animate-pulse'
                          : realtimeStatus === 'error'
                            ? 'bg-red-500'
                            : 'bg-zinc-500'
                    }`}
                  />
                </div>
                <div
                  className="text-[9px] text-muted-foreground flex items-center gap-1"
                  style={{ fontFamily: "'JetBrains Mono', monospace" }}
                >
                  <span
                    className={`px-1 bg-muted ${
                      esSuperadmin ? 'text-secondary' : 'text-muted-foreground'
                    }`}
                    style={{ borderRadius: '0.15rem' }}
                  >
                    {esSuperadmin ? 'Super Admin' : rolUsuario}
                  </span>
                  {!esSuperadmin && <span>· {bodegaLabel}</span>}
                </div>
              </div>
              <ChevronRight size={14} className="text-muted-foreground shrink-0" />
            </>
          )}
        </button>
      </div>
    </aside>
    </>
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
  collapsed,
}: {
  children: React.ReactNode
  label: string
  onClick?: () => void
  collapsed?: boolean
}) {
  return (
    <button
      onClick={onClick}
      title={label}
      className={`relative text-muted-foreground hover:text-foreground hover:bg-muted transition-colors ${
        collapsed
          ? 'flex items-center justify-center py-2'
          : 'flex-1 flex items-center justify-center py-2'
      }`}
      style={{ borderRadius: '0.25rem' }}
    >
      {children}
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
