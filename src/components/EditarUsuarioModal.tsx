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
  labelAccion,
  keyVerPadre,
  TODAS_LAS_KEYS,
  apiGetPermisosUsuario,
  accionesCustomSubmodulo,
  type ModuloKey,
  type ModuloDef,
  type SubmoduloDef,
  type Permiso,
} from '../store/permisos'
import { authStore, type ModulePermissionMap } from '../store/auth'
import { bodegaActivaStore } from '../store/bodegaActiva'
import { api } from '../lib/api'
import { Modal } from './Modal'

type EditarUsuarioModalProps = {
  usuario: Usuario
  onClose: () => void
  /**
   * Llamado cuando el guardado (PUT /usuarios/:id/bodegas/:bodegaId)
   * termina OK. Útil para que la vista padre refresque la grilla sin
   * tener que recargar la página.
   */
  onSaved?: () => void
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

export function EditarUsuarioModal({ usuario, onClose, onSaved }: EditarUsuarioModalProps) {
  const { roles } = usePermisos()
  const [nombre, setNombre] = useState(usuario.nombre)
  const [email, setEmail] = useState(usuario.email)
  const [rol, setRol] = useState<RolUsuario>(usuario.rol)
  const [estado, setEstado] = useState<EstadoUsuario>(usuario.estado)
  const [error, setError] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [cargando, setCargando] = useState(true)

  // Permisos del ROL del user EN LA BODEGA ACTIVA. Los trae el back
  // en `r.rolPermisos` (lista plana de keys). Esto es la "línea base"
  // contra la que se mide el override: lo que está verde por el rol,
  // rojo por override (denegado), y los extras (verde sin ser del rol)
  // son del override.
  //
  // FIX bug matriz: antes se usaba `rolObj?.permisos` del store global
  // (los permisos del rol del ADMIN QUE EDITA, no del user a editar).
  // Por eso la matriz mostraba los permisos del admin (todos en
  // verde) en vez de los del user real.
  const [basePerms, setBasePerms] = useState<Set<string>>(new Set())

  // Estado de la matriz (verde = true, rojo = false). Se hidrata al
  // abrir el modal con el ESTADO PERSISTIDO (override o rol, no
  // efectivos). Esto permite que al guardar mandemos SOLO la diferencia
  // y no dupliquemos el rol en el override.
  const [permisos, setPermisos] = useState<PermisoEstado>({})
  /** Override original persistido en DB. `null` si no hay, `{}` si está
   *  vacío (denegó todo), objeto si tiene keys. */
  const [overrideOriginal, setOverrideOriginal] = useState<ModulePermissionMap | null>(null)
  const [overrideDirty, setOverrideDirty] = useState(false)

  // Cargar el estado actual del user desde el back al abrir.
  // Importante: la fuente de verdad para la matriz es el ESTADO
  // PERSISTIDO (override si hay, rol si no), NO los permisos
  // efectivos. Hidratar con efectivos causa el bug de duplicar el
  // rol en el override al guardar.
  useEffect(() => {
    let cancelado = false
    setCargando(true)
    void apiGetPermisosUsuario(usuario.id)
      .then((r) => {
        if (cancelado) return
        setOverrideOriginal(r.override)
        setBasePerms(new Set(r.rolPermisos ?? []))

        // Hidratamos la matriz con:
        //   - Si hay override (`r.override` no es null) → usamos la
        //     UNIÓN del override. Es la "foto" exacta persistida.
        //   - Si NO hay override → usamos los del rol (`rolPermisos`).
        //     Equivale a "el user tiene lo mismo que su rol".
        //     Esto es la fuente de verdad para "lo que se va a mostrar
        //     al guardar" y se mantiene en sync con `basePerms`.
        const overrideKeys = new Set<string>()
        for (const [mod, subs] of Object.entries(r.override ?? {})) {
          for (const [sub, actions] of Object.entries(subs ?? {})) {
            for (const a of actions ?? []) {
              overrideKeys.add(mod === sub ? `${mod}.${a}` : `${mod}.${sub}.${a}`)
            }
          }
        }

        const rolKeys = new Set<string>(r.rolPermisos ?? [])
        const inicial: PermisoEstado = {}
        for (const k of TODAS_LAS_KEYS) {
          if (overrideKeys.size > 0) {
            // Hay override → la foto es exactamente el override.
            inicial[k] = overrideKeys.has(k)
          } else {
            // Sin override → la foto es el rol.
            inicial[k] = rolKeys.has(k)
          }
        }
        setPermisos(inicial)
        setOverrideDirty(false)
        // Rol del user EN ESTA BODEGA (no el global). El select de
        // rol del form debe mostrar el rol de la asignación, no el
        // legacy `Usuario.rol`. Si el response trae el rol, lo
        // usamos; si no (porque la bodega no tiene asignación para
        // este user), caemos al rol global legacy como fallback.
        if (r.rol) {
          setRol(r.rol.key as RolUsuario)
        }
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
      // Incluimos las acciones custom del sub-módulo (si las tiene)
      // para que el toggle "invertir" del sub-módulo las togglee también.
      const accs = s.acciones ?? ACCIONES
      const keys = accs.map((a) => `${m}.${s.key}.${a}` as Permiso)
      const allOn = keys.every((k) => next[k])
      for (const k of keys) next[k] = !allOn
      return next
    })
    setOverrideDirty(true)
  }

  function resetMatriz() {
    // Reset a "todo lo del rol verde, todo lo demás rojo".
    // `basePerms` viene del ROL del user en la bodega activa (no del
    // admin que edita). Esto significa: si el user tenía un override
    // que le daba `inventario.crear` y yo reseteo, le quito ese permiso
    // extra y queda igual al rol.
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
      // ─── SPRINT 3: edición por-bodega ───
      // Flujo:
      //   1. Info global del user (nombre, email, estado) → PATCH /usuarios/:id
      //   2. Rol + override de la bodega activa → PUT /usuarios/:id/bodegas/:bodegaActiva
      //   3. Si el user editado soy yo, refrescar mi sesión para que
      //      los cambios se vean reflejados en mi sidebar/permisos.
      //
      // El override de bodega se manda como array PLANO de keys
      // (`modulo.accion` o `modulo.submodulo.accion`) — es lo que
      // espera `UsuarioBodega.modulePermissions` (campo `String[]`).
      // Si la matriz final coincide con el rol, mandamos `[]` para
      // que el back borre el override y el user herede del rol.

      // 1) Info global del user (sin rol ni bodegaId).
      await usuariosStore.actualizar(usuario.id, {
        nombre: nombre.trim(),
        email: email.trim(),
        estado,
      })

      // 2) Construir la "foto" final de permisos para esta bodega.
      //    El back espera un array PLANO de keys (`modulo.accion` o
      //    `modulo.submodulo.accion`) en el campo `permisos` del body
      //    de `PUT /usuarios/:id/bodegas/:bodegaId` (Sprint 3 fase 5).
      //
      //    Semántica:
      //    - Si la matriz coincide EXACTAMENTE con el rol del user
      //      en la bodega → mandamos `[]` (borrar override, heredar
      //      del rol). NO mandamos la foto del rol porque ya la tiene
      //      el back.
      //    - Si la matriz difiere del rol → mandamos TODA la foto
      //      como array plano. El back lo guarda como override
      //      REEMPLAZANDO al rol.
      //
      //    Antes (BUG): se armaba un objeto `ModulePermissionMap` con
      //    las keys prendidas y se mandaba eso. Pero el endpoint
      //    multibodega espera un `string[]` (lo guarda en
      //    `UsuarioBodega.modulePermissions` que es `String[]`).
      //    Además se mandaba "todo lo verde" en vez de la diferencia
      //    con el rol, lo que duplicaba los permisos del rol en el
      //    override.
      const matrizKeys: string[] = []
      for (const k of TODAS_LAS_KEYS) {
        if (permisos[k]) matrizKeys.push(k)
      }

      // ¿La matriz final coincide con los permisos del rol?
      // Comparamos sets (no importa el orden).
      const rolSet = new Set(basePerms)
      const matrizSet = new Set(matrizKeys)
      let coincideConRol = matrizSet.size === rolSet.size
      if (coincideConRol) {
        for (const k of matrizSet) {
          if (!rolSet.has(k)) {
            coincideConRol = false
            break
          }
        }
      }

      // Decidir qué mandar:
      //   - coincideConRol === true → `[]` (back borra override)
      //   - coincideConRol === false → `matrizKeys` (foto nueva)
      // En cualquier caso, mandamos SIEMPRE `permisos` para que la
      // operación sea explícita y no dependa del estado previo.
      const permisosParaEnviar: string[] = coincideConRol ? [] : matrizKeys

      // 2.b) Hacer el upsert por-bodega con el ROL del formulario
      // (que representa el rol que el user tiene EN ESTA BODEGA).
      // Sin bodega activa no podemos operar (el modal no debería
      // haberse abierto sin bodega, pero por las dudas).
      const bodegaActivaId = bodegaActivaStore.getId()
      if (!bodegaActivaId) {
        throw new Error('No hay bodega activa. Cerrá el modal y reintentá.')
      }
      await api.put<unknown>(
        `/usuarios/${usuario.id}/bodegas/${bodegaActivaId}`,
        {
          rolKey: rol,
          permisos: permisosParaEnviar,
        },
      )

      // 3) Si soy yo, refrescar mi sesión.
      const yo = authStore.getSnapshot()
      if (yo.status === 'autenticado' && yo.sesion.usuario.id === usuario.id) {
        await authStore.refrescar()
      }

      onSaved?.()
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
    <Modal
      open
      onClose={onClose}
      title="Editar usuario"
      description="Ajustá los permisos que este usuario tendrá por sobre los de su rol"
      icon={<Pencil size={16} className="text-primary" />}
      size="lg"
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
            type="submit"
            form="editar-usuario-form"
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
              'Guardar cambios'
            )}
          </button>
        </div>
      }
    >
      <form id="editar-usuario-form" onSubmit={handleSubmit} className="p-5 space-y-5">
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
                  // Admin puede ser delegado; superadmin no es asignable.
                  .filter((r) => r.key !== 'superadmin')
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
              className="inline-flex items-center gap-1.5 min-h-[44px] px-2 text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-30"
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
            <>
              {/* ── DESKTOP: tabla (md+) ─────────────────────── */}
              <div
                className="hidden md:block bg-muted/30 border border-border overflow-hidden"
                style={{ borderRadius: '0.25rem' }}
              >
                <table className="w-full text-sm">
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
                          {labelAccion(a)}
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

              {/* ── MOBILE: lista de acordeones (<md) ──────────
                  Mismo patrón que la matriz de Roles. Un módulo = un
                  acordeón; los submódulos se ven dentro como tarjetas
                  con grilla 3+1 de acciones. */}
              <ul className="md:hidden divide-y divide-border border border-border bg-muted/30" style={{ borderRadius: '0.25rem' }}>
                {MODULOS.map((m) => {
                  const subs = m.submodulos ?? []
                  const isOpen = expanded.has(m.key)
                  return (
                    <li key={m.key}>
                      <button
                        type="button"
                        onClick={() => toggleExpand(m.key)}
                        className="w-full text-left p-3 flex items-center gap-3 hover:bg-muted/50 active:bg-muted/70 transition-colors"
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
                            style={{ fontFamily: "'DM Sans', sans-serif", fontWeight: 500 }}
                          >
                            {m.label}
                          </div>
                          <div
                            className="text-[10px] text-muted-foreground mt-0.5"
                            style={{ fontFamily: "'JetBrains Mono', monospace" }}
                          >
                            {subs.length > 0
                              ? `${subs.length} sub-módulos`
                              : `${m.acciones.length} acciones`}
                          </div>
                        </div>
                        <ModuloBadgeCell
                          keys={(subs.length > 0
                            ? [keyVerPadre(m.key), ...subs.flatMap((s) => ACCIONES.map((a) => `${m.key}.${s.key}.${a}`))]
                            : m.acciones.map((a) => `${m.key}.${a}`)
                          ).map((k) => k as Permiso)}
                          permisos={permisos}
                          basePerms={basePerms}
                        />
                      </button>

                      {isOpen && (
                        <div className="px-3 pb-3 pt-1 space-y-3 bg-background/40">
                          {subs.length === 0 ? (
                            <ModuloAccionesGridMovil
                              moduloKey={m.key}
                              acciones={m.acciones}
                              permisos={permisos}
                              basePerms={basePerms}
                              onToggle={togglePermiso}
                              onToggleTodo={() => toggleModuloCompleto(m)}
                            />
                          ) : (
                            <>
                              <ModuloAccionesGridMovil
                                moduloKey={m.key}
                                acciones={['ver']}
                                permisos={permisos}
                                basePerms={basePerms}
                                onToggle={togglePermiso}
                                labelOverride="Ver módulo (abre el submenú)"
                                singleAction
                              />
                              {subs.map((s) => (
                                <SubmoduloAccionesGridMovil
                                  key={`${m.key}.${s.key}`}
                                  moduloKey={m.key}
                                  sub={s}
                                  permisos={permisos}
                                  basePerms={basePerms}
                                  onToggle={togglePermiso}
                                  onToggleTodo={() => toggleSubmoduloCompleto(m.key, s)}
                                />
                              ))}
                            </>
                          )}
                        </div>
                      )}
                    </li>
                  )
                })}
              </ul>
            </>
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
      </form>
    </Modal>
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
          const accsCustom = accionesCustomSubmodulo(s)
          return (
            <>
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
                    {accsCustom.length > 0 && (
                      <span
                        className="text-[9px] text-muted-foreground/70 ml-1"
                        style={{ fontFamily: "'JetBrains Mono', monospace" }}
                      >
                        (+{accsCustom.length} custom)
                      </span>
                    )}
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
              {/* Acciones custom granulares del sub-módulo. Como no
                  entran en las 4 columnas de la tabla, se renderizan
                  como fila extra con chips. */}
              {accsCustom.length > 0 && (
                <tr
                  key={`${m.key}.${s.key}.custom`}
                  className="border-b border-border last:border-b-0 bg-muted/20"
                >
                  <td
                    colSpan={ACCIONES.length + 2}
                    className="px-3 py-2 pl-12"
                  >
                    <div className="flex flex-wrap gap-1.5">
                      {accsCustom.map((a) => {
                        const p: Permiso = `${m.key}.${s.key}.${a}`
                        return (
                          <button
                            key={a}
                            type="button"
                            onClick={() => togglePermiso(p)}
                            title={p}
                            className={`min-h-[28px] px-2 py-0.5 text-[10px] border transition-colors ${cellClass(p)}`}
                            style={{ borderRadius: '0.15rem' }}
                          >
                            {labelAccion(a)}
                          </button>
                        )
                      })}
                    </div>
                  </td>
                </tr>
              )}
            </>
          )
        })}
    </>
  )
}

const inputClass =
  'w-full px-3 py-2.5 min-h-[44px] bg-muted border border-border text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/60 transition-colors disabled:opacity-50'

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

// ─────────────────────────────────────────────
//  Helpers mobile (acordeones + grilla de acciones)
//  Mismo patrón visual que la matriz de Roles.tsx
// ─────────────────────────────────────────────

/**
 * Badge compacto a la derecha del header del acordeón.
 * Resume el estado de todas las acciones de un módulo / grupo:
 *  - Verde  → todas activas
 *  - Naranja → algunas activas (mixto)
 *  - Gris   → todas inactivas
 */
function ModuloBadgeCell({
  keys,
  permisos,
  basePerms,
}: {
  keys: Permiso[]
  permisos: PermisoEstado
  basePerms: Set<string>
}) {
  if (keys.length === 0) return null
  const on = keys.filter((k) => permisos[k]).length
  const total = keys.length
  const allOn = on === total
  const someOn = on > 0
  const dot = allOn
    ? 'bg-secondary'
    : someOn
      ? 'bg-primary'
      : 'bg-muted-foreground/30'
  return (
    <div className="flex items-center gap-1.5 shrink-0">
      <span
        className="text-[10px] text-muted-foreground"
        style={{ fontFamily: "'JetBrains Mono', monospace" }}
      >
        {on}/{total}
      </span>
      <span className={`w-2 h-2 rounded-full ${dot}`} aria-hidden />
    </div>
  )
}

/**
 * Grilla mobile de acciones para un módulo SIN sub-módulos
 * (o para el "ver" del padre cuando SÍ tiene sub-módulos).
 * Botones grandes (min-h-11) para touch, con grilla 3 columnas.
 */
function ModuloAccionesGridMovil({
  moduloKey,
  acciones,
  permisos,
  basePerms,
  onToggle,
  onToggleTodo,
  labelOverride,
  singleAction,
}: {
  moduloKey: string
  acciones: readonly string[]
  permisos: PermisoEstado
  basePerms: Set<string>
  onToggle: (p: Permiso) => void
  onToggleTodo?: () => void
  labelOverride?: string
  singleAction?: boolean
}) {
  const keys = acciones.map((a) => `${moduloKey}.${a}` as Permiso)
  const onCount = keys.filter((k) => permisos[k]).length
  const allOn = onCount === keys.length
  const someOn = onCount > 0

  return (
    <div>
      {labelOverride && (
        <div
          className="text-[10px] text-muted-foreground uppercase tracking-widest mb-1.5"
          style={{ fontFamily: "'JetBrains Mono', monospace" }}
        >
          {labelOverride}
        </div>
      )}
      <div className={`grid gap-2 ${singleAction ? 'grid-cols-1' : 'grid-cols-3'}`}>
        {acciones.map((a) => {
          const p = `${moduloKey}.${a}` as Permiso
          const has = permisos[p]
          const isBase = basePerms.has(p)
          // Mismo lenguaje visual que la versión desktop:
          // verde activo, rojo si está denegado del rol, gris normal.
          const cls = has
            ? 'border-secondary/50 bg-secondary/15 text-secondary'
            : !has && isBase
              ? 'border-primary/50 bg-primary/10 text-primary'
              : 'border-border text-muted-foreground'
          return (
            <button
              key={a}
              type="button"
              onClick={() => onToggle(p)}
              className={`min-h-[44px] px-2 py-2 border text-xs transition-colors ${cls} flex items-center justify-center gap-1.5`}
              style={{ borderRadius: '0.25rem', fontFamily: "'DM Sans', sans-serif" }}
            >
              {has && <Check size={12} />}
              {labelAccion(a)}
            </button>
          )
        })}
      </div>
      {onToggleTodo && (
        <button
          type="button"
          onClick={onToggleTodo}
          className={`mt-2 w-full min-h-[44px] px-2 py-2 border text-xs transition-colors ${
            allOn
              ? 'border-secondary/50 bg-secondary/15 text-secondary'
              : someOn
                ? 'border-primary/50 bg-primary/10 text-primary'
                : 'border-border text-muted-foreground'
          } flex items-center justify-center gap-1.5`}
          style={{ borderRadius: '0.25rem', fontFamily: "'DM Sans', sans-serif" }}
        >
          {allOn && <Check size={12} />}
          {singleAction ? 'Invertir' : 'Todo el módulo'}
        </button>
      )}
    </div>
  )
}

/**
 * Grilla mobile de acciones para un sub-módulo concreto.
 * Muestra el label del sub-módulo arriba, la grilla de 4 acciones, y
 * el botón "Todo" para invertir todo el sub.
 * Si el sub-módulo tiene acciones custom, las renderiza como
 * chips extra abajo de la grilla principal.
 */
function SubmoduloAccionesGridMovil({
  moduloKey,
  sub,
  permisos,
  basePerms,
  onToggle,
  onToggleTodo,
}: {
  moduloKey: string
  sub: SubmoduloDef
  permisos: PermisoEstado
  basePerms: Set<string>
  onToggle: (p: Permiso) => void
  onToggleTodo: () => void
}) {
  // Las 4 acciones base (ver/crear/editar/eliminar).
  const keys = ACCIONES.map((a) => `${moduloKey}.${sub.key}.${a}` as Permiso)
  const onCount = keys.filter((k) => permisos[k]).length
  const allOn = onCount === keys.length
  const someOn = onCount > 0

  // Acciones custom granulares del sub-módulo (si las tiene).
  const accsCustom = accionesCustomSubmodulo(sub)

  return (
    <div>
      <div
        className="text-[10px] text-muted-foreground uppercase tracking-widest mb-1.5 flex items-center gap-2"
        style={{ fontFamily: "'JetBrains Mono', monospace" }}
      >
        <span>{sub.label}</span>
        {accsCustom.length > 0 && (
          <span className="text-[9px] text-muted-foreground/70 normal-case">
            (+{accsCustom.length} custom)
          </span>
        )}
      </div>
      <div className="grid grid-cols-3 gap-2">
        {ACCIONES.map((a) => {
          const p = `${moduloKey}.${sub.key}.${a}` as Permiso
          const has = permisos[p]
          const isBase = basePerms.has(p)
          const cls = has
            ? 'border-secondary/50 bg-secondary/15 text-secondary'
            : !has && isBase
              ? 'border-primary/50 bg-primary/10 text-primary'
              : 'border-border text-muted-foreground'
          return (
            <button
              key={a}
              type="button"
              onClick={() => onToggle(p)}
              className={`min-h-[44px] px-2 py-2 border text-xs transition-colors ${cls} flex items-center justify-center gap-1.5`}
              style={{ borderRadius: '0.25rem', fontFamily: "'DM Sans', sans-serif" }}
            >
              {has && <Check size={12} />}
              {labelAccion(a)}
            </button>
          )
        })}
      </div>
      {/* Acciones custom granulares (chips) */}
      {accsCustom.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-1.5">
          {accsCustom.map((a) => {
            const p = `${moduloKey}.${sub.key}.${a}` as Permiso
            const has = permisos[p]
            const isBase = basePerms.has(p)
            const cls = has
              ? 'border-secondary/50 bg-secondary/15 text-secondary'
              : !has && isBase
                ? 'border-primary/50 bg-primary/10 text-primary'
                : 'border-border text-muted-foreground'
            return (
              <button
                key={a}
                type="button"
                onClick={() => onToggle(p)}
                title={p}
                className={`min-h-[32px] px-2 py-1 text-[10px] border transition-colors ${cls} flex items-center justify-center gap-1`}
                style={{ borderRadius: '0.15rem', fontFamily: "'DM Sans', sans-serif" }}
              >
                {has && <Check size={10} />}
                {labelAccion(a)}
              </button>
            )
          })}
        </div>
      )}
      <button
        type="button"
        onClick={onToggleTodo}
        className={`mt-2 w-full min-h-[44px] px-2 py-2 border text-xs transition-colors ${
          allOn
            ? 'border-secondary/50 bg-secondary/15 text-secondary'
            : someOn
              ? 'border-primary/50 bg-primary/10 text-primary'
              : 'border-border text-muted-foreground'
        } flex items-center justify-center gap-1.5`}
        style={{ borderRadius: '0.25rem', fontFamily: "'DM Sans', sans-serif" }}
      >
        {allOn && <Check size={12} />}
        Todo
      </button>
    </div>
  )
}
