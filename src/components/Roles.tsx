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
  type Rol,
} from '../store/permisos'
import { authStore } from '../store/auth'

export function Roles() {
  const { roles } = usePermisos()
  const estadoStore = permisosStore.estado()
  const [query, setQuery] = useState('')
  const [editing, setEditing] = useState<Rol | null>(null)
  const [creating, setCreating] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<Rol | null>(null)
  const [deleting, setDeleting] = useState(false)

  // El módulo `admin` (y su sub-módulo `tenants`) es solo para el
  // superadmin. Los admins comunes no deberían verlo ni asignarlo
  // a sus roles. Filtramos acá para que el editor de permisos
  // no muestre esa sección.
  const sesion = authStore.getSesion()
  const esSuperadmin = sesion?.usuario.rol === 'superadmin'
  const modulosVisibles = useMemo(
    () => (esSuperadmin ? MODULOS : MODULOS.filter((m) => m.key !== 'admin')),
    [esSuperadmin],
  )

  // Cargar roles del back al montar la pantalla (si todavía no se cargaron).
  useEffect(() => {
    if (estadoStore.status === 'idle') {
      void permisosStore.cargar().catch(() => undefined)
    }
  }, [estadoStore.status])

  const filtrados = query.trim()
    ? roles.filter(
        (r) =>
          r.nombre.toLowerCase().includes(query.toLowerCase()) ||
          r.descripcion.toLowerCase().includes(query.toLowerCase()),
      )
    : roles

  return (
    <div className="flex-1 flex flex-col min-w-0 min-h-0 overflow-y-auto">
      <div className="p-8 space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 bg-muted flex items-center justify-center shrink-0 mt-1">
              <ShieldCheck size={20} className="text-primary" />
            </div>
            <div>
              <h1
                className="text-4xl uppercase text-foreground leading-none"
                style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900 }}
              >
                Roles y Permisos
              </h1>
              <p
                className="mt-1 text-sm text-muted-foreground"
                style={{ fontFamily: "'DM Sans', sans-serif" }}
              >
                Configura qué puede hacer cada rol en cada módulo y sub-módulo
              </p>
            </div>
          </div>

          <button
            onClick={() => setCreating(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity"
            style={{ borderRadius: '0.25rem' }}
          >
            <Plus size={16} />
            Nuevo Rol
          </button>
        </div>

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
        />
      )}

      {confirmDelete && (
        <div
          className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => !deleting && setConfirmDelete(null)}
        >
          <div
            className="bg-card border border-border w-full max-w-sm"
            style={{ borderRadius: '0.25rem' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-5">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 bg-primary/15 flex items-center justify-center">
                  <Trash2 size={15} className="text-primary" />
                </div>
                <h3
                  className="text-lg uppercase text-foreground"
                  style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800 }}
                >
                  Eliminar rol
                </h3>
              </div>
              <p
                className="text-sm text-muted-foreground"
                style={{ fontFamily: "'DM Sans', sans-serif" }}
              >
                ¿Eliminar el rol{' '}
                <span className="text-foreground font-medium">{confirmDelete.nombre}</span>?
                Los usuarios asignados a este rol pasarán automáticamente a Operador.
              </p>
            </div>
            <div className="flex items-center gap-2 p-4 border-t border-border">
              <button
                onClick={() => setConfirmDelete(null)}
                disabled={deleting}
                className="flex-1 py-2.5 border border-border text-sm text-foreground hover:border-foreground/30 transition-colors disabled:opacity-50"
                style={{ borderRadius: '0.25rem' }}
              >
                Cancelar
              </button>
              <button
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
                className="flex-1 py-2.5 bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50 inline-flex items-center justify-center gap-2"
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
          </div>
        </div>
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
              {rol.usuariosCount > 0 && (
                <span
                  className="inline-flex items-center px-1.5 py-0.5 text-[10px] border border-secondary/40 text-secondary bg-secondary/10"
                  style={{ borderRadius: '0.15rem', fontFamily: "'JetBrains Mono', monospace" }}
                >
                  {rol.usuariosCount} usuario{rol.usuariosCount === 1 ? '' : 's'}
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
}: {
  selected: Set<Permiso>
  onToggle: (p: Permiso) => void
  modulosVisibles?: readonly ModuloDef[]
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
      <table className="w-full">
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
                />
              )
            }
            const isOpen = expanded.has(m.key)
            const subKeys = subs.flatMap((s) => keysSubmodulo(m.key, s.key))
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
              />
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function ModuloFila({
  modulo,
  selected,
  onToggle,
}: {
  modulo: ModuloDef
  selected: Set<Permiso>
  onToggle: (p: Permiso) => void
}) {
  const allOn = modulo.acciones.every((a) => selected.has(`${modulo.key}.${a}`))
  const someOn = modulo.acciones.some((a) => selected.has(`${modulo.key}.${a}`))

  function toggleTodo() {
    if (allOn) {
      for (const a of modulo.acciones) {
        if (selected.has(`${modulo.key}.${a}`)) onToggle(`${modulo.key}.${a}`)
      }
    } else {
      for (const a of modulo.acciones) {
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
}) {
  const verPadre = keyVerPadre(modulo.key)
  const tieneVerPadre = selected.has(verPadre)
  const allOn = subOn === subTotal

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
          const subKeys = keysSubmodulo(modulo.key, s.key)
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
}: {
  rol?: Rol
  onClose: () => void
  onSave: (data: { nombre: string; descripcion: string; permisos: Permiso[] }) => Promise<void> | void
  modulosVisibles?: readonly ModuloDef[]
}) {
  const isNew = !rol
  const [nombre, setNombre] = useState(rol?.nombre ?? '')
  const [descripcion, setDescripcion] = useState(rol?.descripcion ?? '')
  const [permisos, setPermisos] = useState<Set<Permiso>>(
    () => new Set(rol?.permisos ?? []),
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
    <div
      className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-card border border-border w-full max-w-3xl max-h-[90vh] flex flex-col"
        style={{ borderRadius: '0.25rem' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-5 border-b border-border shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-primary/15 flex items-center justify-center">
              <ShieldCheck size={18} className="text-primary" />
            </div>
            <div>
              <h2
                className="text-xl uppercase text-foreground leading-none"
                style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900 }}
              >
                {isNew ? 'Nuevo Rol' : `Editar permisos: ${rol!.nombre}`}
              </h2>
              <p
                className="mt-1 text-xs text-muted-foreground"
                style={{ fontFamily: "'DM Sans', sans-serif" }}
              >
                {isNew
                  ? 'Definí nombre, descripción y los permisos del nuevo rol'
                  : 'Modificá qué puede hacer este rol en cada módulo'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={guardando}
            className="text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">
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

        <div className="p-4 border-t border-border flex items-center gap-3 shrink-0">
          <button
            onClick={onClose}
            disabled={guardando}
            className="flex-1 py-2.5 border border-border text-sm text-foreground hover:border-foreground/30 transition-colors disabled:opacity-50"
            style={{ borderRadius: '0.25rem' }}
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={guardando}
            className="flex-1 py-2.5 bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50 inline-flex items-center justify-center gap-2"
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
      </div>
    </div>
  )
}
