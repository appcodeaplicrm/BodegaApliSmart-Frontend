import { useState, useMemo, useEffect } from 'react'
import {
  ShieldCheck,
  Plus,
  Search,
  Pencil,
  Trash2,
  Lock,
  Check,
  X,
  ChevronRight,
  ChevronDown,
  CircleAlert,
  Inbox,
  RotateCcw,
} from 'lucide-react'
import {
  usePermisos,
  permisosStore,
  MODULOS,
  ACCIONES,
  ACCION_LABELS,
  keyVerPadre,
  keysSubmodulo,
  type ModuloKey,
  type ModuloDef,
  type SubmoduloDef,
  type Permiso,
  type Accion,
  type Rol,
} from '../store/permisos'
import { authStore } from '../store/auth'
import { api } from '../lib/api'
import { PageHeader } from './PageHeader'
import { Modal } from './Modal'

type CatalogoPermiso = { key: string; modulo: string; accion: string }

export function Roles() {
  const { roles } = usePermisos()
  const estadoStore = permisosStore.estado()
  const [query, setQuery] = useState('')
  const [editing, setEditing] = useState<Rol | null>(null)
  const [creating, setCreating] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<Rol | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [catalogoPlan, setCatalogoPlan] = useState<CatalogoPermiso[]>([])
  const [catalogoCargando, setCatalogoCargando] = useState(true)

  // El módulo `admin` (y su sub-módulo `tenants`) es solo para el
  // superadmin. Los admins comunes no deberían verlo ni asignarlo
  // a sus roles. Filtramos acá para que el editor de permisos
  // no muestre esa sección.
  const sesion = authStore.getSesion()
  const esSuperadmin = sesion?.usuario.rol === 'superadmin'
  const permisosDisponibles = useMemo(() => new Set(catalogoPlan.map((p) => p.key)), [catalogoPlan])
  const modulosVisibles = useMemo(() => MODULOS.filter((m) =>
    (esSuperadmin || m.key !== 'admin') && catalogoPlan.some((p) => p.modulo === m.key || p.modulo.startsWith(`${m.key}.`)),
  ).map((m) => ({
    ...m,
    submodulos: m.submodulos?.filter((s) => catalogoPlan.some((p) => p.modulo === `${m.key}.${s.key}`)),
  })), [catalogoPlan, esSuperadmin])

  // Cargar roles del back al montar la pantalla (si todavía no se cargaron).
  useEffect(() => {
    if (estadoStore.status === 'idle') {
      void permisosStore.cargar().catch(() => undefined)
    }
  }, [estadoStore.status])

  useEffect(() => {
    void api.get<CatalogoPermiso[]>('/permisos')
      .then(setCatalogoPlan)
      .catch(() => setCatalogoPlan([]))
      .finally(() => setCatalogoCargando(false))
  }, [])

  const filtrados = query.trim()
    ? roles.filter(
        (r) =>
          r.nombre.toLowerCase().includes(query.toLowerCase()) ||
          r.descripcion.toLowerCase().includes(query.toLowerCase()),
      )
    : roles

  return (
    <div className="flex-1 flex flex-col min-w-0 min-h-0">
      <PageHeader
        title="Roles y Permisos"
        subtitle="STOCKPRO · MATRIZ DE PERMISOS"
        actions={
          <button
            onClick={() => setCreating(true)}
            disabled={catalogoCargando}
            title={catalogoCargando ? 'Cargando permisos disponibles del plan…' : 'Crear un nuevo rol'}
            className="hidden lg:inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground text-xs font-medium hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-wait"
            style={{ borderRadius: '0.25rem' }}
          >
            <Plus size={13} />
            Nuevo Rol
          </button>
        }
      />

      <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 space-y-6">
        <div className="relative">
          <Search
            size={15}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por nombre o descripción…"
            className="w-full pl-9 pr-4 py-2.5 bg-card border border-border text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/60 transition-colors"
            style={{ borderRadius: '0.25rem', fontFamily: "'DM Sans', sans-serif" }}
          />
        </div>

        {/* Botón "Nuevo Rol" mobile: debajo del buscador.
            En desktop el header ya tiene su botón, así que lo ocultamos. */}
        <button
          onClick={() => setCreating(true)}
          disabled={catalogoCargando}
          title={catalogoCargando ? 'Cargando permisos disponibles del plan…' : 'Crear un nuevo rol'}
          className="lg:hidden w-full inline-flex items-center justify-center gap-1.5 min-h-11 bg-primary text-primary-foreground text-sm font-semibold active:scale-[0.98] transition-transform disabled:opacity-50 disabled:cursor-wait"
          style={{ borderRadius: '0.25rem' }}
        >
          <Plus size={15} />
          Nuevo Rol
        </button>

        {/* ESTADOS DE CARGA / ERROR */}
        {estadoStore.status === 'cargando' && roles.length === 0 && (
          <div className="bg-card border border-border p-8 flex items-center justify-center gap-3"
            style={{ borderRadius: '0.25rem' }}
          >
            <span
              className="w-4 h-4 border-2 border-primary/40 border-t-primary rounded-full animate-spin"
              aria-hidden
            />
            <span className="text-sm text-muted-foreground" style={{ fontFamily: "'DM Sans', sans-serif" }}>
              Cargando roles desde el servidor…
            </span>
          </div>
        )}

        {estadoStore.status === 'error' && (
          <div
            className="bg-card border border-primary/40 p-4 flex items-start gap-3"
            style={{ borderRadius: '0.25rem' }}
          >
            <CircleAlert size={16} className="text-primary shrink-0 mt-0.5" />
            <div className="flex-1">
              <p
                className="text-sm text-foreground"
                style={{ fontFamily: "'DM Sans', sans-serif", fontWeight: 500 }}
              >
                No se pudieron cargar los roles
              </p>
              <p
                className="mt-0.5 text-xs text-muted-foreground"
                style={{ fontFamily: "'JetBrains Mono', monospace" }}
              >
                {estadoStore.mensaje}
              </p>
            </div>
            <button
              onClick={() => void permisosStore.cargar().catch(() => undefined)}
              className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
              style={{ fontFamily: "'JetBrains Mono', monospace" }}
            >
              <RotateCcw size={11} />
              Reintentar
            </button>
          </div>
        )}

        {/* LISTA / VACÍO */}
        {estadoStore.status === 'listo' && filtrados.length === 0 && (
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
              Sin roles
            </h3>
            <p
              className="mt-2 text-sm text-muted-foreground max-w-sm"
              style={{ fontFamily: "'DM Sans', sans-serif" }}
            >
              {query
                ? 'Ningún rol coincide con la búsqueda.'
                : 'Cuando crees roles custom desde el botón "Nuevo Rol", aparecerán acá.'}
            </p>
          </div>
        )}

        {filtrados.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filtrados.map((rol) => (
              <RolCard
                key={rol.id}
                rol={rol}
                onEdit={() => setEditing(rol)}
                onDelete={() => setConfirmDelete(rol)}
              />
            ))}
          </div>
        )}
      </div>

      {creating && (
        <RolEditorModal
          onClose={() => setCreating(false)}
          onSave={async (data) => {
            await permisosStore.roles.crear(data)
            setCreating(false)
          }}
          modulosVisibles={modulosVisibles}
          permisosDisponibles={permisosDisponibles}
        />
      )}

      {editing && (
        <RolEditorModal
          rol={editing}
          onClose={() => setEditing(null)}
          onSave={async (data) => {
            await permisosStore.roles.actualizarPermisos(editing.id, data.permisos)
            setEditing(null)
            // Si el admin usa ese rol, sus permisos cambiaron → refrescar sesión.
            const yo = authStore.getSnapshot()
            if (yo.status === 'autenticado' && yo.sesion.usuario.rol === editing.key) {
              void authStore.refrescar()
            }
          }}
          modulosVisibles={modulosVisibles}
          permisosDisponibles={permisosDisponibles}
        />
      )}

      {confirmDelete && (
        <Modal
          open
          onClose={() => !deleting && setConfirmDelete(null)}
          title="Eliminar rol"
          description={confirmDelete.nombre}
          icon={<Trash2 size={16} className="text-primary" />}
          size="sm"
          footer={
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setConfirmDelete(null)}
                disabled={deleting}
                className="flex-1 min-h-[44px] py-2.5 border border-border text-sm text-foreground hover:border-foreground/30 transition-colors disabled:opacity-50"
                style={{ borderRadius: '0.25rem' }}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={async () => {
                  const rolEliminadoKey = confirmDelete.key
                  setDeleting(true)
                  try {
                    await permisosStore.roles.eliminar(confirmDelete.id)
                    // Si el admin usa ese rol, fue migrado a operador → refrescar.
                    const yo = authStore.getSnapshot()
                    if (yo.status === 'autenticado' && yo.sesion.usuario.rol === rolEliminadoKey) {
                      void authStore.refrescar()
                    }
                    setConfirmDelete(null)
                  } catch (err) {
                    // El back ya devuelve 400 si era del sistema; dejamos el modal abierto
                    // y mostramos el error
                    console.error('Error al eliminar rol:', err)
                  } finally {
                    setDeleting(false)
                  }
                }}
                disabled={deleting}
                className="flex-1 min-h-[44px] py-2.5 bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50 inline-flex items-center justify-center gap-2"
                style={{ borderRadius: '0.25rem' }}
              >
                {deleting ? (
                  <>
                    <span
                      className="w-3.5 h-3.5 border-2 border-primary-foreground/40 border-t-primary-foreground rounded-full animate-spin"
                      aria-hidden
                    />
                    Eliminando…
                  </>
                ) : (
                  'Eliminar'
                )}
              </button>
            </div>
          }
        >
          <div className="p-5">
            <p
              className="text-sm text-muted-foreground"
              style={{ fontFamily: "'DM Sans', sans-serif" }}
            >
              ¿Eliminar el rol{' '}
              <span className="text-foreground font-medium">{confirmDelete.nombre}</span>?
              Los usuarios asignados a este rol pasarán automáticamente a Operador.
            </p>
          </div>
        </Modal>
      )}
    </div>
  )
}

function RolCard({
  rol,
  onEdit,
  onDelete,
}: {
  rol: Rol
  onEdit: () => void
  onDelete: () => void
}) {
  const counts = useMemo(() => {
    let modulos = 0
    let submodulos = 0
    for (const m of MODULOS) {
      if (!m.submodulos || m.submodulos.length === 0) {
        if (m.acciones.some((a) => rol.permisos.includes(`${m.key}.${a}`))) modulos++
      } else {
        for (const s of m.submodulos) {
          if (keysSubmodulo(m.key, s.key).some((k) => rol.permisos.includes(k))) {
            submodulos++
          }
        }
      }
    }
    return { modulos, submodulos, total: rol.permisos.length }
  }, [rol.permisos])

  return (
    <div
      className="bg-card border border-border p-5 flex flex-col gap-3"
      style={{ borderRadius: '0.25rem' }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <div className="w-9 h-9 bg-primary/15 flex items-center justify-center shrink-0">
            <ShieldCheck size={16} className="text-primary" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3
                className="text-lg uppercase text-foreground"
                style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800 }}
              >
                {rol.nombre}
              </h3>
              {rol.esSistema && (
                <span
                  className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] border border-muted text-muted-foreground"
                  style={{ borderRadius: '0.15rem', fontFamily: "'JetBrains Mono', monospace" }}
                >
                  <Lock size={9} />
                  SISTEMA
                </span>
              )}
            </div>
            <p
              className="mt-1 text-sm text-muted-foreground"
              style={{ fontFamily: "'DM Sans', sans-serif" }}
            >
              {rol.descripcion}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={onEdit}
            title="Editar permisos"
            className="w-8 h-8 border border-border text-muted-foreground hover:border-foreground/40 hover:text-foreground transition-colors flex items-center justify-center"
            style={{ borderRadius: '0.25rem' }}
          >
            <Pencil size={14} />
          </button>
          {!rol.esSistema && (
            <button
              onClick={onDelete}
              title="Eliminar rol"
              className="w-8 h-8 border border-border text-muted-foreground hover:border-primary/40 hover:text-primary transition-colors flex items-center justify-center"
              style={{ borderRadius: '0.25rem' }}
            >
              <Trash2 size={14} />
            </button>
          )}
        </div>
      </div>

      <div
        className="pt-3 border-t border-border flex items-center gap-3 text-xs text-muted-foreground flex-wrap"
        style={{ fontFamily: "'JetBrains Mono', monospace" }}
      >
        <span>{rol.permisos.length} permisos</span>
        <span>·</span>
        <span>{counts.modulos} módulos</span>
        {counts.submodulos > 0 && (
          <>
            <span>·</span>
            <span>{counts.submodulos} sub-módulos</span>
          </>
        )}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────
//  Matriz de permisos jerárquica
// ─────────────────────────────────────────────

function MatrizPermisos({
  selected,
  onToggle,
  modulosVisibles = MODULOS,
  permisosDisponibles,
}: {
  selected: Set<Permiso>
  onToggle: (p: Permiso) => void
  modulosVisibles?: readonly ModuloDef[]
  permisosDisponibles: ReadonlySet<string>
}) {
  const [expanded, setExpanded] = useState<Set<ModuloKey>>(
    () => new Set(modulosVisibles.filter((m) => m.submodulos?.length).map((m) => m.key)),
  )

  function toggleExpand(m: ModuloKey) {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(m)) next.delete(m)
      else next.add(m)
      return next
    })
  }

  return (
    <div
      className="bg-muted/30 border border-border overflow-hidden"
      style={{ borderRadius: '0.25rem' }}
    >
      {/* DESKTOP: tabla con todas las columnas */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr
              className="border-b border-border bg-card"
              style={{ fontFamily: "'JetBrains Mono', monospace" }}
            >
              <th className="text-left px-3 py-2.5 text-[10px] text-muted-foreground tracking-widest uppercase font-normal">
                Módulo / Sub-módulo
              </th>
              {ACCIONES.map((a) => (
                <th
                  key={a}
                  className="text-center px-3 py-2.5 text-[10px] text-muted-foreground tracking-widest uppercase font-normal"
                >
                  {ACCION_LABELS[a]}
                </th>
              ))}
              <th className="text-center px-3 py-2.5 text-[10px] text-muted-foreground tracking-widest uppercase font-normal w-16">
                todo
              </th>
            </tr>
          </thead>
          <tbody>
            {modulosVisibles.map((m) => {
              const subs = m.submodulos ?? []
              if (subs.length === 0) {
                return (
                  <ModuloFila
                    key={m.key}
                    modulo={m}
                    selected={selected}
                    onToggle={onToggle}
                    permisosDisponibles={permisosDisponibles}
                  />
                )
              }
              const isOpen = expanded.has(m.key)
              const subKeys = subs
                .flatMap((s) => keysSubmodulo(m.key, s.key))
                .filter((k) => permisosDisponibles.has(k))
              const subOn = subKeys.filter((k) => selected.has(k)).length
              return (
                <ModuloPadreGrupo
                  key={m.key}
                  modulo={m}
                  isOpen={isOpen}
                  onToggleExpand={() => toggleExpand(m.key)}
                  submodulos={subs}
                  selected={selected}
                  onToggleSub={onToggle}
                  onToggleTodoGrupo={() => {
                    const allOn = subOn === subKeys.length
                    for (const k of subKeys) {
                      if (allOn && selected.has(k)) onToggle(k)
                      if (!allOn && !selected.has(k)) onToggle(k)
                    }
                  }}
                  subOn={subOn}
                  subTotal={subKeys.length}
                  permisosDisponibles={permisosDisponibles}
                />
              )
            })}
          </tbody>
        </table>
      </div>

      {/* MOBILE: lista de acordeones, uno por módulo. Si tiene submódulos
          se expande y muestra cada uno con sus 5 acciones (Ver/Crear/
          Editar/Eliminar/Todo) en grilla 3+2. Sin submódulos → se ve la
          fila de acciones directa al expandir. */}
      <ul className="md:hidden divide-y divide-border">
        {modulosVisibles.map((m) => {
          const subs = m.submodulos ?? []
          const isOpen = expanded.has(m.key)
          const accionesDisponibles = m.acciones.filter((a) =>
            permisosDisponibles.has(`${m.key}.${a}`),
          )
          const allOn =
            accionesDisponibles.length > 0 &&
            accionesDisponibles.every((a) => selected.has(`${m.key}.${a}`))
          const someOn = accionesDisponibles.some((a) =>
            selected.has(`${m.key}.${a}`),
          )
          function toggleTodoModulo() {
            if (allOn) {
              for (const a of accionesDisponibles) {
                if (selected.has(`${m.key}.${a}`)) onToggle(`${m.key}.${a}`)
              }
            } else {
              for (const a of accionesDisponibles) {
                if (!selected.has(`${m.key}.${a}`)) onToggle(`${m.key}.${a}`)
              }
            }
          }
          return (
            <li key={m.key}>
              <button
                type="button"
                onClick={() => toggleExpand(m.key)}
                className="w-full text-left p-3 flex items-center gap-3 hover:bg-muted/30 active:bg-muted/50 transition-colors"
                aria-expanded={isOpen}
              >
                <ChevronRight
                  size={14}
                  className={`text-muted-foreground shrink-0 transition-transform ${
                    isOpen ? 'rotate-90' : ''
                  }`}
                />
                <div className="flex-1 min-w-0">
                  <div
                    className="text-sm text-foreground"
                    style={{
                      fontFamily: "'DM Sans', sans-serif",
                      fontWeight: 500,
                    }}
                  >
                    {m.label}
                  </div>
                  {subs.length > 0 ? (
                    <div
                      className="text-[10px] text-muted-foreground mt-0.5"
                      style={{ fontFamily: "'JetBrains Mono', monospace" }}
                    >
                      {subs.length} sub-módulos
                    </div>
                  ) : (
                    <div
                      className="text-[10px] text-muted-foreground mt-0.5"
                      style={{ fontFamily: "'JetBrains Mono', monospace" }}
                    >
                      {accionesDisponibles.length} acciones
                    </div>
                  )}
                </div>
                {subs.length === 0 && (
                  <span
                    className={`shrink-0 w-2 h-2 rounded-full ${
                      allOn
                        ? 'bg-secondary'
                        : someOn
                          ? 'bg-primary'
                          : 'bg-muted-foreground/30'
                    }`}
                    title={
                      allOn
                        ? 'Todas las acciones activas'
                        : someOn
                          ? 'Algunas acciones activas'
                          : 'Sin acciones activas'
                    }
                  />
                )}
              </button>

              {isOpen && (
                <div className="px-3 pb-3 space-y-3 bg-background/40">
                  {subs.length === 0 ? (
                    <div className="pt-2">
                      <ModuloAccionesGrid
                        moduloKey={m.key}
                        acciones={accionesDisponibles}
                        selected={selected}
                        onToggle={onToggle}
                        allOn={allOn}
                        someOn={someOn}
                        onToggleTodo={toggleTodoModulo}
                      />
                    </div>
                  ) : (
                    <>
                      {subs
                        .filter((s) =>
                          // El sub-módulo se muestra si al menos una de
                          // sus acciones (modulo.sub.accion) está
                          // disponible en el catálogo del plan.
                          keysSubmodulo(m.key, s.key).some((k) =>
                            permisosDisponibles.has(k),
                          ),
                        )
                        .map((s) => {
                          const subKeys = keysSubmodulo(m.key, s.key).filter(
                            (k) => permisosDisponibles.has(k),
                          )
                          const subAllOn =
                            subKeys.length > 0 &&
                            subKeys.every((k) => selected.has(k))
                          const subSomeOn = subKeys.some((k) => selected.has(k))
                          return (
                            <SubmoduloAcciones
                              key={s.key}
                              moduloKey={m.key}
                              sub={s}
                              subKeys={subKeys}
                              selected={selected}
                              onToggle={onToggle}
                              allOn={subAllOn}
                              someOn={subSomeOn}
                            />
                          )
                        })}
                    </>
                  )}
                </div>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}

// ─── Helpers mobile: grilla de acciones por sub-módulo ──────────────

function ModuloAccionesGrid({
  moduloKey,
  acciones,
  selected,
  onToggle,
  allOn,
  someOn,
  onToggleTodo,
}: {
  moduloKey: string
  acciones: string[]
  selected: Set<Permiso>
  onToggle: (p: Permiso) => void
  allOn: boolean
  someOn: boolean
  onToggleTodo: () => void
}) {
  return (
    <div className="pt-1">
      <div className="grid grid-cols-3 gap-2">
        {acciones.map((a) => {
          const p = `${moduloKey}.${a}` as Permiso
          const has = selected.has(p)
          return (
            <button
              key={a}
              type="button"
              onClick={() => onToggle(p)}
              className={`min-h-11 px-2 py-2 border text-xs transition-colors ${
                has
                  ? 'border-secondary/50 bg-secondary/15 text-secondary'
                  : 'border-border text-muted-foreground hover:border-foreground/30'
              }`}
              style={{ borderRadius: '0.25rem' }}
            >
              {has && <Check size={12} className="inline mr-1 -mt-0.5" />}
              {ACCION_LABELS[a]}
            </button>
          )
        })}
      </div>
      <button
        type="button"
        onClick={onToggleTodo}
        className={`mt-2 w-full min-h-11 px-2 py-2 border text-xs transition-colors ${
          allOn
            ? 'border-secondary/50 bg-secondary/15 text-secondary'
            : someOn
              ? 'border-primary/50 bg-primary/10 text-primary'
              : 'border-border text-muted-foreground hover:border-foreground/30'
        }`}
        style={{ borderRadius: '0.25rem' }}
      >
        {allOn && <Check size={12} className="inline mr-1 -mt-0.5" />}
        Todo el módulo
      </button>
    </div>
  )
}

function SubmoduloAcciones({
  moduloKey,
  sub,
  subKeys,
  selected,
  onToggle,
  allOn,
  someOn,
}: {
  moduloKey: string
  sub: { key: string; label: string }
  subKeys: string[]
  selected: Set<Permiso>
  onToggle: (p: Permiso) => void
  allOn: boolean
  someOn: boolean
}) {
  function toggleTodoSub() {
    if (allOn) {
      for (const k of subKeys) {
        if (selected.has(k as Permiso)) onToggle(k as Permiso)
      }
    } else {
      for (const k of subKeys) {
        if (!selected.has(k as Permiso)) onToggle(k as Permiso)
      }
    }
  }
  return (
    <div className="pt-2">
      <div
        className="text-[10px] text-muted-foreground uppercase tracking-widest mb-1.5"
        style={{ fontFamily: "'JetBrains Mono', monospace" }}
      >
        {sub.label}
      </div>
      <div className="grid grid-cols-3 gap-2">
        {subKeys.map((k) => {
          const accion = k.split('.').pop() ?? ''
          const has = selected.has(k as Permiso)
          return (
            <button
              key={k}
              type="button"
              onClick={() => onToggle(k as Permiso)}
              className={`min-h-11 px-2 py-2 border text-xs transition-colors ${
                has
                  ? 'border-secondary/50 bg-secondary/15 text-secondary'
                  : 'border-border text-muted-foreground hover:border-foreground/30'
              }`}
              style={{ borderRadius: '0.25rem' }}
            >
              {has && <Check size={12} className="inline mr-1 -mt-0.5" />}
              {ACCION_LABELS[accion as Accion] ?? accion}
            </button>
          )
        })}
      </div>
      <button
        type="button"
        onClick={toggleTodoSub}
        className={`mt-2 w-full min-h-11 px-2 py-2 border text-xs transition-colors ${
          allOn
            ? 'border-secondary/50 bg-secondary/15 text-secondary'
            : someOn
              ? 'border-primary/50 bg-primary/10 text-primary'
              : 'border-border text-muted-foreground hover:border-foreground/30'
        }`}
        style={{ borderRadius: '0.25rem' }}
      >
        {allOn && <Check size={12} className="inline mr-1 -mt-0.5" />}
        Todo
      </button>
    </div>
  )
}

function ModuloFila({
  modulo,
  selected,
  onToggle,
  permisosDisponibles,
}: {
  modulo: ModuloDef
  selected: Set<Permiso>
  onToggle: (p: Permiso) => void
  permisosDisponibles: ReadonlySet<string>
}) {
  const accionesDisponibles = modulo.acciones.filter((a) => permisosDisponibles.has(`${modulo.key}.${a}`))
  const allOn = accionesDisponibles.length > 0 && accionesDisponibles.every((a) => selected.has(`${modulo.key}.${a}`))
  const someOn = accionesDisponibles.some((a) => selected.has(`${modulo.key}.${a}`))

  function toggleTodo() {
    if (allOn) {
      for (const a of accionesDisponibles) {
        if (selected.has(`${modulo.key}.${a}`)) onToggle(`${modulo.key}.${a}`)
      }
    } else {
      for (const a of accionesDisponibles) {
        if (!selected.has(`${modulo.key}.${a}`)) onToggle(`${modulo.key}.${a}`)
      }
    }
  }

  return (
    <tr className="border-b border-border last:border-b-0 hover:bg-card/40">
      <td
        className="px-3 py-2.5 text-sm text-foreground"
        style={{ fontFamily: "'DM Sans', sans-serif", fontWeight: 500 }}
      >
        {modulo.label}
      </td>
      {ACCIONES.map((a) => {
        const p = `${modulo.key}.${a}`
        if (!permisosDisponibles.has(p)) return <td key={a} className="text-center px-3 py-2 text-muted-foreground/40">—</td>
        const has = selected.has(p)
        return (
          <td key={a} className="text-center px-3 py-2">
            <CellToggle
              active={has}
              onClick={() => onToggle(p)}
              title={p}
            />
          </td>
        )
      })}
      <td className="text-center px-3 py-2">
        <CellToggle
          active={allOn}
          partial={someOn && !allOn}
          onClick={toggleTodo}
          title="Seleccionar todo el módulo"
        />
      </td>
    </tr>
  )
}

function ModuloPadreGrupo({
  modulo,
  isOpen,
  onToggleExpand,
  submodulos,
  selected,
  onToggleSub,
  onToggleTodoGrupo,
  subOn,
  subTotal,
  permisosDisponibles,
}: {
  modulo: ModuloDef
  isOpen: boolean
  onToggleExpand: () => void
  submodulos: readonly SubmoduloDef[]
  selected: Set<Permiso>
  onToggleSub: (p: Permiso) => void
  onToggleTodoGrupo: () => void
  subOn: number
  subTotal: number
  permisosDisponibles: ReadonlySet<string>
}) {
  const verPadre = keyVerPadre(modulo.key)
  const tieneVerPadre = selected.has(verPadre)
  const allOn = subTotal > 0 && subOn === subTotal

  return (
    <>
      <tr
        className="border-b border-border bg-card/60 cursor-pointer hover:bg-card/90"
        onClick={onToggleExpand}
      >
        <td
          className="px-3 py-2.5 text-sm text-foreground"
          style={{ fontFamily: "'DM Sans', sans-serif", fontWeight: 600 }}
        >
          <span className="inline-flex items-center gap-2">
            {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            {modulo.label}
            <span
              className="text-[10px] text-muted-foreground"
              style={{ fontFamily: "'JetBrains Mono', monospace" }}
            >
              ({submodulos.length})
            </span>
          </span>
        </td>
        {ACCIONES.map((a) => {
          if (a === 'ver') {
            if (!permisosDisponibles.has(verPadre)) return <td key={a} className="text-center px-3 py-2 text-muted-foreground/40">—</td>
            return (
              <td key={a} className="text-center px-3 py-2">
                <CellToggle
                  active={tieneVerPadre}
                  onClick={(e) => {
                    e.stopPropagation()
                    onToggleSub(verPadre)
                  }}
                  title={verPadre}
                />
              </td>
            )
          }
          return <td key={a} className="text-center px-3 py-2 text-muted-foreground/40">—</td>
        })}
        <td className="text-center px-3 py-2">
          <CellToggle
            active={allOn}
            partial={subOn > 0 && !allOn}
            onClick={(e) => {
              e.stopPropagation()
              onToggleTodoGrupo()
            }}
            title="Activar todos los sub-módulos"
          />
        </td>
      </tr>
      {isOpen &&
        submodulos.map((s) => {
          const subKeys = keysSubmodulo(modulo.key, s.key).filter((k) => permisosDisponibles.has(k))
          const allSubOn = subKeys.every((k) => selected.has(k))
          const someSubOn = subKeys.some((k) => selected.has(k))
          return (
            <tr
              key={`${modulo.key}.${s.key}`}
              className="border-b border-border last:border-b-0 hover:bg-card/40"
            >
              <td
                className="px-3 py-2 text-sm text-muted-foreground pl-9"
                style={{ fontFamily: "'DM Sans', sans-serif" }}
              >
                <span className="inline-flex items-center gap-2">
                  <span
                    className="w-3 h-px bg-border"
                    aria-hidden
                  />
                  {s.label}
                </span>
              </td>
              {ACCIONES.map((a) => {
                const p: Permiso = `${modulo.key}.${s.key}.${a}`
                if (!permisosDisponibles.has(p)) return <td key={a} className="text-center px-3 py-2 text-muted-foreground/40">—</td>
                const has = selected.has(p)
                return (
                  <td key={a} className="text-center px-3 py-2">
                    <CellToggle
                      active={has}
                      onClick={() => onToggleSub(p)}
                      title={p}
                    />
                  </td>
                )
              })}
              <td className="text-center px-3 py-2">
                <CellToggle
                  active={allSubOn}
                  partial={someSubOn && !allSubOn}
                  onClick={() => {
                    for (const k of subKeys) {
                      if (allSubOn && selected.has(k)) onToggleSub(k)
                      if (!allSubOn && !selected.has(k)) onToggleSub(k)
                    }
                  }}
                  title="Activar todo el sub-módulo"
                />
              </td>
            </tr>
          )
        })}
    </>
  )
}

function CellToggle({
  active,
  partial,
  onClick,
  title,
}: {
  active: boolean
  partial?: boolean
  onClick: (e: React.MouseEvent) => void
  title: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-7 h-7 border flex items-center justify-center transition-colors ${
        active
          ? 'bg-secondary/15 border-secondary/40 text-secondary'
          : partial
            ? 'bg-secondary/5 border-secondary/30 text-secondary/70'
            : 'bg-muted border-border text-muted-foreground hover:border-foreground/40'
      }`}
      style={{ borderRadius: '0.15rem' }}
      title={title}
    >
      {active ? <Check size={14} /> : partial ? <span className="text-[10px]">·</span> : <X size={14} />}
    </button>
  )
}

// ─────────────────────────────────────────────
//  Editor de rol (crear/editar) — async
// ─────────────────────────────────────────────

function RolEditorModal({
  rol,
  onClose,
  onSave,
  modulosVisibles = MODULOS,
  permisosDisponibles,
}: {
  rol?: Rol
  onClose: () => void
  onSave: (data: { nombre: string; descripcion: string; permisos: Permiso[] }) => Promise<void> | void
  modulosVisibles?: readonly ModuloDef[]
  permisosDisponibles: ReadonlySet<string>
}) {
  const isNew = !rol
  const [nombre, setNombre] = useState(rol?.nombre ?? '')
  const [descripcion, setDescripcion] = useState(rol?.descripcion ?? '')
  const [permisos, setPermisos] = useState<Set<Permiso>>(
    () => new Set((rol?.permisos ?? []).filter((p) => permisosDisponibles.has(p))),
  )
  const [error, setError] = useState('')
  const [guardando, setGuardando] = useState(false)

  function toggle(p: Permiso) {
    setPermisos((prev) => {
      const next = new Set(prev)
      if (next.has(p)) next.delete(p)
      else next.add(p)
      return next
    })
  }

  async function handleSave() {
    if (guardando) return
    if (!nombre.trim()) {
      setError('El nombre del rol es obligatorio.')
      return
    }
    setError('')
    setGuardando(true)
    try {
      await onSave({ nombre: nombre.trim(), descripcion: descripcion.trim(), permisos: Array.from(permisos) })
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : 'No se pudo guardar el rol. Intentá de nuevo.'
      setError(msg)
      setGuardando(false)
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={isNew ? 'Nuevo Rol' : `Editar permisos: ${rol!.nombre}`}
      description={isNew
        ? 'Definí nombre, descripción y los permisos del nuevo rol'
        : 'Modificá qué puede hacer este rol en cada módulo'}
      icon={<ShieldCheck size={16} className="text-primary" />}
      size="xl"
      footer={
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={guardando}
            className="flex-1 min-h-[44px] py-2.5 border border-border text-sm text-foreground hover:border-foreground/30 transition-colors disabled:opacity-50"
            style={{ borderRadius: '0.25rem' }}
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={guardando}
            className="flex-1 min-h-[44px] py-2.5 bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50 inline-flex items-center justify-center gap-2"
            style={{ borderRadius: '0.25rem' }}
          >
            {guardando ? (
              <>
                <span
                  className="w-3.5 h-3.5 border-2 border-primary-foreground/40 border-t-primary-foreground rounded-full animate-spin"
                  aria-hidden
                />
                Guardando…
              </>
            ) : (
              isNew ? 'Crear Rol' : 'Guardar cambios'
            )}
          </button>
        </div>
      }
    >
      <div className="p-5 space-y-5">
          {isNew && (
            <div className="space-y-3">
              <div>
                <label
                  className="block text-xs text-muted-foreground tracking-widest uppercase mb-1.5"
                  style={{ fontFamily: "'JetBrains Mono', monospace" }}
                >
                  Nombre del rol *
                </label>
                <input
                  type="text"
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  placeholder="Ej: Jefe de turno, Auditor, etc."
                  disabled={guardando}
                  className="w-full px-3 py-2.5 bg-muted border border-border text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/60 transition-colors disabled:opacity-50"
                  style={{ borderRadius: '0.25rem', fontFamily: "'DM Sans', sans-serif" }}
                />
              </div>
              <div>
                <label
                  className="block text-xs text-muted-foreground tracking-widest uppercase mb-1.5"
                  style={{ fontFamily: "'JetBrains Mono', monospace" }}
                >
                  Descripción
                </label>
                <input
                  type="text"
                  value={descripcion}
                  onChange={(e) => setDescripcion(e.target.value)}
                  placeholder="Qué puede hacer este rol…"
                  disabled={guardando}
                  className="w-full px-3 py-2.5 bg-muted border border-border text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/60 transition-colors disabled:opacity-50"
                  style={{ borderRadius: '0.25rem', fontFamily: "'DM Sans', sans-serif" }}
                />
              </div>
            </div>
          )}

          <div>
            <div
              className="text-xs text-muted-foreground tracking-widest uppercase mb-2"
              style={{ fontFamily: "'JetBrains Mono', monospace" }}
            >
              Matriz de permisos
            </div>
            <p
              className="text-xs text-muted-foreground mb-3"
              style={{ fontFamily: "'DM Sans', sans-serif" }}
            >
              Los módulos con sub-módulos se controlan granularmente por sub-módulo.
              Para que un usuario vea el item padre en el sidebar, activá{' '}
              <span className="text-foreground">«Ver»</span> en la fila del padre.
            </p>
            <MatrizPermisos
              selected={permisos}
              onToggle={toggle}
              modulosVisibles={modulosVisibles}
              permisosDisponibles={permisosDisponibles}
            />
          </div>

          {error && (
            <p
              className="text-xs text-primary bg-primary/10 border border-primary/20 px-3 py-2"
              style={{ fontFamily: "'JetBrains Mono', monospace", borderRadius: '0.25rem' }}
            >
              ⚠ {error}
            </p>
          )}
      </div>
    </Modal>
  )
}
