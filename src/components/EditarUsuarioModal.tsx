import { useState, useMemo, useEffect, type FormEvent } from 'react'
import {
  X,
  Pencil,
  Check,
  ShieldCheck,
  RotateCcw,
  ChevronDown,
  ChevronRight,
  CircleAlert,
} from 'lucide-react'
import { usuariosStore, type Usuario, type RolUsuario, type EstadoUsuario } from '../store/usuarios'
import {
  usePermisos,
  MODULOS,
  ACCIONES,
  ACCION_LABELS,
  keyVerPadre,
  TODAS_LAS_KEYS,
  apiGetPermisosUsuario,
  apiReplacePermisosOverride,
  type ModuloKey,
  type ModuloDef,
  type SubmoduloDef,
  type Permiso,
} from '../store/permisos'
import { authStore, type ModulePermissionMap } from '../store/auth'

type EditarUsuarioModalProps = {
  usuario: Usuario
  onClose: () => void
}

const ESTADOS: EstadoUsuario[] = ['Activo', 'Inactivo']

/**
 * Modelo de 2 estados para los permisos del usuario (vista por la UI):
 *
 *   - Verde (activo): el user TIENE este permiso. Puede venir del rol
 *     o de un override per-user.
 *   - Rojo (sin tilde): el user NO TIENE este permiso.
 *
 * Al abrir el modal, la matriz arranca con:
 *   - Verde todo lo del rol
 *   - Verde todo lo del override actual persistido en DB (si hay)
 *   - Rojo todo lo demás
 *
 * Al guardar, se manda la UNIÓN de todo lo que está verde como override
 * literal. El back lo guarda tal cual (la próxima vez que se abra el
 * modal, ese override se vuelve a mostrar como "todo lo que está verde").
 *
 * El user puede:
 *   - Tildar algo que estaba en rojo → se agrega al override
 *   - Destildar algo del rol → se quita del override (no se hereda más)
 *   - Destildar algo que vos agregaste antes → se quita del override
 */
type PermisoEstado = Record<string, boolean>

export function EditarUsuarioModal({ usuario, onClose }: EditarUsuarioModalProps) {
  const { roles } = usePermisos()
  const [nombre, setNombre] = useState(usuario.nombre)
  const [email, setEmail] = useState(usuario.email)
  const [rol, setRol] = useState<RolUsuario>(usuario.rol)
  const [estado, setEstado] = useState<EstadoUsuario>(usuario.estado)
  const [error, setError] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [cargando, setCargando] = useState(true)

  const rolObj = roles.find((r) => r.key === rol)
  const basePerms = useMemo(() => new Set<string>(rolObj?.permisos ?? []), [rolObj])

  // Estado de la matriz (verde = true, rojo = false). Se hidrata al
  // abrir el modal con los permisos efectivos actuales del user.
  const [permisos, setPermisos] = useState<PermisoEstado>({})
  /** Permisos que NO vienen del rol (los que vos agregaste o quitaste). */
  const [overrideOriginal, setOverrideOriginal] = useState<ModulePermissionMap | null>(null)
  const [overrideDirty, setOverrideDirty] = useState(false)

  // Cargar el estado actual del user desde el back al abrir.
  // Importante: la fuente de verdad para la matriz es `permisosEfectivos`
  // (lo que el back ya calculó aplicando rol + override). Eso evita
  // depender de que el catálogo de roles local esté cargado.
  useEffect(() => {
    let cancelado = false
    setCargando(true)
    void apiGetPermisosUsuario(usuario.id)
      .then((r) => {
        if (cancelado) return
        setOverrideOriginal(r.override)

        // Hidratamos la matriz con la UNIÓN de:
        //   1) permisos del rol del usuario (si los tenemos en el store)
        //   2) permisosEfectivos que ya calculó el back (incluye override)
        // La idea: si los roles NO están cargados todavía, arrancamos con
        // los efectivos. Si SÍ están cargados, partimos del rol y le
        // sumamos/cruzamos con el override. En la práctica, ambos enfoques
        // terminan en el mismo set: los efectivos.
        const efectivosKeys = new Set<string>()
        for (const [mod, subs] of Object.entries(r.permisosEfectivos ?? {})) {
          for (const [sub, actions] of Object.entries(subs ?? {})) {
            for (const a of actions ?? []) {
              efectivosKeys.add(mod === sub ? `${mod}.${a}` : `${mod}.${sub}.${a}`)
            }
          }
        }

        const inicial: PermisoEstado = {}
        for (const k of TODAS_LAS_KEYS) {
          // Verde si el back ya lo considera efectivo. Esto es la
          // "foto final" que el back aplicó.
          inicial[k] = efectivosKeys.has(k)
        }
        setPermisos(inicial)
        setOverrideDirty(false)
      })
      .catch((err) => {
        if (cancelado) return
        setError(
          err instanceof Error
            ? err.message
            : 'No se pudieron cargar los permisos del usuario.',
        )
      })
      .finally(() => {
        if (!cancelado) setCargando(false)
      })
    return () => {
      cancelado = true
    }
    // Solo re-hidratamos si cambia el user; el cambio de rol desde el
    // dropdown del modal se refleja al guardar (la API lo persiste y
    // el back recalcula los efectivos del nuevo rol).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usuario.id])

  const [expanded, setExpanded] = useState<Set<ModuloKey>>(
    () => new Set(MODULOS.filter((m) => m.submodulos?.length).map((m) => m.key)),
  )

  function toggleExpand(m: ModuloKey) {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(m)) next.delete(m)
      else next.add(m)
      return next
    })
  }

  function togglePermiso(p: Permiso) {
    setPermisos((prev) => {
      const next = { ...prev }
      next[p] = !next[p]
      return next
    })
    setOverrideDirty(true)
  }

  function toggleModuloCompleto(m: ModuloDef) {
    setPermisos((prev) => {
      const next = { ...prev }
      const keys = m.acciones.map((a) => `${m.key}.${a}` as Permiso)
      const allOn = keys.every((k) => next[k])
      for (const k of keys) next[k] = !allOn
      return next
    })
    setOverrideDirty(true)
  }

  function toggleSubmoduloCompleto(m: ModuloKey, s: SubmoduloDef) {
    setPermisos((prev) => {
      const next = { ...prev }
      const keys = ACCIONES.map((a) => `${m}.${s.key}.${a}` as Permiso)
      const allOn = keys.every((k) => next[k])
      for (const k of keys) next[k] = !allOn
      return next
    })
    setOverrideDirty(true)
  }

  function resetMatriz() {
    // Reset a "todo lo del rol verde, todo lo demás rojo"
    const inicial: PermisoEstado = {}
    for (const k of TODAS_LAS_KEYS) {
      inicial[k] = basePerms.has(k)
    }
    setPermisos(inicial)
    setOverrideDirty(true)
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (guardando) return
    setError('')

    if (!nombre.trim()) {
      setError('El nombre es obligatorio.')
      return
    }
    if (!email.trim()) {
      setError('El email es obligatorio.')
      return
    }

    setGuardando(true)
    try {
      // 1) Actualizar info del usuario (nombre, email, rol, estado)
      await usuariosStore.actualizar(usuario.id, {
        nombre: nombre.trim(),
        email: email.trim(),
        rol,
        estado,
      })

      // 2) Construir el override final: la "foto completa" de permisos
      //    del user, incluyendo lo del rol y los extras.
      //
      //    El back interpreta el override como la "foto final" (manda sobre
      //    el rol). Si el override está presente, el rol se IGNORA. Por eso
      //    tenemos que mandar TODO lo que está en verde, no solo los extras.
      //
      //    Si la foto verde coincide EXACTAMENTE con el rol (sin extras ni
      //    denegados), mandamos `null` para borrar el override y que el
      //    user herede del rol puro (más limpio).
      const overrideFinal: ModulePermissionMap = {}
      for (const k of TODAS_LAS_KEYS) {
        if (!permisos[k]) continue
        const parts = k.split('.')
        if (parts.length === 2) {
          const [mod, a] = parts
          if (!overrideFinal[mod]) overrideFinal[mod] = {}
          if (!overrideFinal[mod][mod]) overrideFinal[mod][mod] = []
          if (!overrideFinal[mod][mod].includes(a)) overrideFinal[mod][mod].push(a)
        } else if (parts.length === 3) {
          const [mod, sub, a] = parts
          if (!overrideFinal[mod]) overrideFinal[mod] = {}
          if (!overrideFinal[mod][sub]) overrideFinal[mod][sub] = []
          if (!overrideFinal[mod][sub].includes(a)) overrideFinal[mod][sub].push(a)
        }
      }

      // 3) Persistir
      //    - Si overrideFinal tiene keys → mandar la foto completa
      //    - Si overrideFinal está vacío Y había override original
      //      → mandar null para borrar el override (vuelve a heredar del rol)
      //    - Si overrideFinal está vacío Y NO había override
      //      → no mandar nada (dejar al user como está, que es con el rol)
      const tieneKeys = Object.values(overrideFinal).some((subs) =>
        Object.values(subs ?? {}).some((acts) => acts.length > 0),
      )
      if (tieneKeys) {
        await apiReplacePermisosOverride(usuario.id, overrideFinal)
      } else if (overrideOriginal && Object.keys(overrideOriginal).length > 0) {
        await apiReplacePermisosOverride(usuario.id, null)
      }
      // Si no había override y no hay keys nuevas, no mandamos nada

      // 4) Si soy yo, refrescar mi sesión
      const yo = authStore.getSnapshot()
      if (yo.status === 'autenticado' && yo.sesion.usuario.id === usuario.id) {
        await authStore.refrescar()
      }

      onClose()
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : 'No se pudo guardar el usuario.'
      setError(msg)
    } finally {
      setGuardando(false)
    }
  }

  const counts = useMemo(() => {
    let totalOn = 0
    let totalOff = 0
    for (const k of TODAS_LAS_KEYS) {
      if (permisos[k]) totalOn++
      else totalOff++
    }
    return { totalOn, totalOff }
  }, [permisos])

  function cellClass(p: Permiso) {
    const on = permisos[p]
    const isBase = basePerms.has(p)
    if (on) return 'bg-secondary/15 border-secondary/40 text-secondary'
    // El permiso del rol está denegado explícitamente → lo mostramos en rojo
    if (!on && isBase) return 'bg-primary/15 border-primary/40 text-primary'
    return 'bg-muted border-border text-muted-foreground hover:border-foreground/40'
  }

  function cellIcon(p: Permiso) {
    if (permisos[p]) return <Check size={14} />
    return <X size={14} />
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-card border border-border w-full max-w-3xl max-h-[92vh] flex flex-col"
        style={{ borderRadius: '0.25rem' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-5 border-b border-border shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-primary/15 flex items-center justify-center">
              <Pencil size={16} className="text-primary" />
            </div>
            <div>
              <h2
                className="text-xl uppercase text-foreground leading-none"
                style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900 }}
              >
                Editar usuario
              </h2>
              <p
                className="mt-1 text-xs text-muted-foreground"
                style={{ fontFamily: "'DM Sans', sans-serif" }}
              >
                Ajustá los permisos que este usuario tendrá por sobre los de su rol
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

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
          <div className="p-5 space-y-5">
            {/* INFORMACIÓN */}
            <Section title="Información del usuario" icon={Pencil}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Field label="Nombre completo" required>
                  <input
                    type="text"
                    value={nombre}
                    onChange={(e) => setNombre(e.target.value)}
                    className={inputClass}
                    disabled={guardando}
                  />
                </Field>
                <Field label="Email" required>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className={inputClass}
                    disabled={guardando}
                  />
                </Field>
                <Field label="Rol" required>
                  <select
                    value={rol}
                    onChange={(e) => setRol(e.target.value as RolUsuario)}
                    className={inputClass}
                    disabled={guardando}
                  >
                    {roles
                      // Excluimos los roles reservados del sistema
                      // (admin, superadmin) del dropdown de edición.
                      .filter((r) => r.key !== 'admin' && r.key !== 'superadmin')
                      .map((r) => (
                        <option key={r.id} value={r.key}>
                          {r.nombre}
                        </option>
                      ))}
                  </select>
                </Field>
                <Field label="Estado" required>
                  <select
                    value={estado}
                    onChange={(e) => setEstado(e.target.value as EstadoUsuario)}
                    className={inputClass}
                    disabled={guardando}
                  >
                    {ESTADOS.map((es) => (
                      <option key={es} value={es}>
                        {es}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
            </Section>

            {/* PERMISOS DEL USUARIO */}
            <Section
              title="Permisos del usuario"
              icon={ShieldCheck}
              trailing={
                <button
                  type="button"
                  onClick={resetMatriz}
                  disabled={!overrideDirty || guardando}
                  className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-30"
                  style={{ fontFamily: "'JetBrains Mono', monospace" }}
                >
                  <RotateCcw size={11} />
                  Reset al rol
                </button>
              }
            >
              <p
                className="text-xs text-muted-foreground mb-3"
                style={{ fontFamily: "'DM Sans', sans-serif" }}
              >
                <span className="text-secondary font-medium">Verde</span> = el usuario tiene el permiso.{' '}
                <span className="text-primary font-medium">Rojo</span> = no lo tiene. Arranca con todo lo del rol
                en verde, más lo que vos hayas configurado antes. Tildá/destildá solo lo que querés cambiar.
              </p>

              <div
                className="flex items-center gap-3 mb-3 text-[10px]"
                style={{ fontFamily: "'JetBrains Mono', monospace" }}
              >
                <Legend color="bg-secondary/15 border-secondary/40 text-secondary" label="Tiene" />
                <Legend color="bg-primary/15 border-primary/40 text-primary" label="No tiene" />
                <span className="ml-auto text-muted-foreground">
                  {counts.totalOn} activos · {counts.totalOff} inactivos
                </span>
              </div>

              {cargando ? (
                <div className="p-8 flex items-center justify-center gap-3">
                  <span
                    className="w-4 h-4 border-2 border-primary/40 border-t-primary rounded-full animate-spin"
                    aria-hidden
                  />
                  <span className="text-sm text-muted-foreground">
                    Cargando permisos del usuario…
                  </span>
                </div>
              ) : (
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
                        <th className="text-left px-3 py-2 text-[10px] text-muted-foreground tracking-widest uppercase font-normal">
                          Módulo / Sub-módulo
                        </th>
                        {ACCIONES.map((a) => (
                          <th
                            key={a}
                            className="text-center px-3 py-2 text-[10px] text-muted-foreground tracking-widest uppercase font-normal"
                          >
                            {ACCION_LABELS[a]}
                          </th>
                        ))}
                        <th className="text-center px-3 py-2 text-[10px] text-muted-foreground tracking-widest uppercase font-normal w-16">
                          todo
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {MODULOS.map((m) => {
                        const subs = m.submodulos ?? []
                        if (subs.length === 0) {
                          return renderFilaModuloPlano(m, {
                            togglePermiso,
                            toggleModuloCompleto,
                            cellClass,
                            cellIcon,
                          })
                        }
                        return renderGrupoModulo(
                          { ...m, submodulos: subs },
                          {
                            expanded: expanded.has(m.key),
                            onToggleExpand: () => toggleExpand(m.key),
                            togglePermiso,
                            toggleSubmoduloCompleto,
                            cellClass,
                            cellIcon,
                          },
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </Section>

            {error && (
              <div
                className="flex items-start gap-2 text-xs text-primary bg-primary/10 border border-primary/20 px-3 py-2"
                style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  borderRadius: '0.25rem',
                }}
              >
                <CircleAlert size={13} className="mt-0.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}
          </div>

          <div className="p-4 border-t border-border flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={guardando}
              className="flex-1 py-2.5 border border-border text-sm text-foreground hover:border-foreground/30 transition-colors disabled:opacity-50"
              style={{ borderRadius: '0.25rem' }}
            >
              Cancelar
            </button>
            <button
              type="submit"
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
                'Guardar cambios'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────
//  Render helpers
// ─────────────────────────────────────────────

type RenderHelpers = {
  togglePermiso: (p: Permiso) => void
  toggleModuloCompleto?: (m: ModuloDef) => void
  toggleSubmoduloCompleto?: (m: ModuloKey, s: SubmoduloDef) => void
  cellClass: (p: Permiso) => string
  cellIcon: (p: Permiso) => React.ReactNode
}

function renderFilaModuloPlano(m: ModuloDef, h: RenderHelpers) {
  return (
    <tr key={m.key} className="border-b border-border last:border-b-0">
      <td
        className="px-3 py-2 text-sm text-foreground"
        style={{ fontFamily: "'DM Sans', sans-serif", fontWeight: 500 }}
      >
        {m.label}
      </td>
      {ACCIONES.map((a) => {
        const p: Permiso = `${m.key}.${a}`
        return (
          <td key={a} className="text-center px-2 py-2">
            <button
              type="button"
              onClick={() => h.togglePermiso(p)}
              className={`w-7 h-7 border flex items-center justify-center transition-colors ${h.cellClass(p)}`}
              style={{ borderRadius: '0.15rem' }}
              title={p}
            >
              {h.cellIcon(p)}
            </button>
          </td>
        )
      })}
      <td className="text-center px-2 py-2">
        <button
          type="button"
          onClick={() => h.toggleModuloCompleto?.(m)}
          className="text-[10px] text-muted-foreground hover:text-foreground transition-colors"
          style={{ fontFamily: "'JetBrains Mono', monospace" }}
          title="Invertir todas las acciones del módulo"
        >
          invertir
        </button>
      </td>
    </tr>
  )
}

type RenderGrupoArgs = RenderHelpers & {
  expanded: boolean
  onToggleExpand: () => void
}

function renderGrupoModulo(
  m: ModuloDef & { submodulos: readonly SubmoduloDef[] },
  args: RenderGrupoArgs,
) {
  const { expanded, onToggleExpand, togglePermiso, toggleSubmoduloCompleto, cellClass, cellIcon } = args
  const verPadre = keyVerPadre(m.key)

  return (
    <>
      <tr
        key={m.key}
        className="border-b border-border bg-card/60 cursor-pointer hover:bg-card/90"
        onClick={onToggleExpand}
      >
        <td
          className="px-3 py-2 text-sm text-foreground"
          style={{ fontFamily: "'DM Sans', sans-serif", fontWeight: 600 }}
        >
          <span className="inline-flex items-center gap-2">
            {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            {m.label}
            <span
              className="text-[10px] text-muted-foreground"
              style={{ fontFamily: "'JetBrains Mono', monospace" }}
            >
              ({m.submodulos.length})
            </span>
          </span>
        </td>
        {ACCIONES.map((a) => {
          if (a === 'ver') {
            return (
              <td key={a} className="text-center px-2 py-2">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    togglePermiso(verPadre)
                  }}
                  className={`w-7 h-7 border flex items-center justify-center transition-colors ${cellClass(verPadre)}`}
                  style={{ borderRadius: '0.15rem' }}
                  title={verPadre}
                >
                  {cellIcon(verPadre)}
                </button>
              </td>
            )
          }
          return <td key={a} className="text-center px-2 py-2 text-muted-foreground/40">—</td>
        })}
        <td className="text-center px-2 py-2" />
      </tr>
      {expanded &&
        m.submodulos.map((s) => {
          return (
            <tr
              key={`${m.key}.${s.key}`}
              className="border-b border-border last:border-b-0"
            >
              <td
                className="px-3 py-2 text-sm text-muted-foreground pl-9"
                style={{ fontFamily: "'DM Sans', sans-serif" }}
              >
                <span className="inline-flex items-center gap-2">
                  <span className="w-3 h-px bg-border" aria-hidden />
                  {s.label}
                </span>
              </td>
              {ACCIONES.map((a) => {
                const p: Permiso = `${m.key}.${s.key}.${a}`
                return (
                  <td key={a} className="text-center px-2 py-2">
                    <button
                      type="button"
                      onClick={() => togglePermiso(p)}
                      className={`w-7 h-7 border flex items-center justify-center transition-colors ${cellClass(p)}`}
                      style={{ borderRadius: '0.15rem' }}
                      title={p}
                    >
                      {cellIcon(p)}
                    </button>
                  </td>
                )
              })}
              <td className="text-center px-2 py-2">
                <button
                  type="button"
                  onClick={() => toggleSubmoduloCompleto?.(m.key, s)}
                  className="text-[10px] text-muted-foreground hover:text-foreground transition-colors"
                  style={{ fontFamily: "'JetBrains Mono', monospace" }}
                  title="Invertir todas las acciones del sub-módulo"
                >
                  invertir
                </button>
              </td>
            </tr>
          )
        })}
    </>
  )
}

const inputClass =
  'w-full px-3 py-2.5 bg-muted border border-border text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/60 transition-colors disabled:opacity-50'

function Section({
  title,
  icon: Icon,
  trailing,
  children,
}: {
  title: string
  icon: typeof Pencil
  trailing?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div
      className="bg-muted/30 border border-border p-4"
      style={{ borderRadius: '0.25rem' }}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 bg-primary/10 flex items-center justify-center">
            <Icon size={13} className="text-primary" />
          </div>
          <h3
            className="text-sm uppercase text-foreground tracking-wider"
            style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800 }}
          >
            {title}
          </h3>
        </div>
        {trailing}
      </div>
      {children}
    </div>
  )
}

function Field({
  label,
  required,
  children,
}: {
  label: string
  required?: boolean
  children: React.ReactNode
}) {
  return (
    <div>
      <label
        className="block text-xs text-muted-foreground tracking-widest uppercase mb-1.5"
        style={{ fontFamily: "'JetBrains Mono', monospace" }}
      >
        {label} {required && <span className="text-primary">*</span>}
      </label>
      {children}
    </div>
  )
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 border ${color}`}
      style={{ borderRadius: '0.15rem', textTransform: 'uppercase' }}
    >
      {label}
    </span>
  )
}
