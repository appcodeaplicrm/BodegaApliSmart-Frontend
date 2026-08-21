import { useEffect, useState, type FormEvent } from 'react'
import {
  UserPlus,
  Eye,
  EyeOff,
  KeyRound,
  ShieldCheck,
  CircleAlert,
  Plus,
  Trash2,
  Star,
  ChevronDown,
  ChevronRight,
  Grid3x3,
  RotateCcw,
} from 'lucide-react'
import {
  usuariosStore,
  type EstadoUsuario,
} from '../store/usuarios'
import {
  usePermisos,
  permisosStore,
  MODULOS,
  ACCIONES,
  ACCION_LABELS,
  labelAccion,
  accionesCustomSubmodulo,
  type Permiso,
} from '../store/permisos'
import { useBodegas } from '../store/bodegas'
import { useBodegaActiva } from '../store/bodegaActiva'
import { ApiError } from '../lib/api'
import { Modal } from './Modal'
import { SelectMobile } from './SelectMobile'

type CrearUsuarioModalProps = {
  onClose: () => void
  /** Se llama con el usuario recién creado (cuando la API responde OK). */
  onCreated?: (usuario: { id: string; nombre: string; email: string }) => void
}

/**
 * `superadmin` es cross-tenant y nunca se ofrece. `admin` sí puede
 * asignarse como administrador delegado de una o varias bodegas.
 */
const ROLES_RESERVADOS = new Set(['superadmin'])

const ESTADOS: EstadoUsuario[] = ['Activo', 'Inactivo']

export function CrearUsuarioModal({ onClose, onCreated }: CrearUsuarioModalProps) {
  const { roles } = usePermisos()
  const bodegasState = useBodegas()
  const activaId = useBodegaActiva()

  const [nombre, setNombre] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmar, setConfirmar] = useState('')
  // ─── Sprint 3 Fase 5: múltiples asignaciones ───
  // Cada fila es "bodega + rol + esPrincipal". El admin puede agregar
  // varias filas para asignar al usuario a N bodegas con roles distintos.
  // Backwards-compat: si el front no manda `asignaciones`, el back
  // crea una sola asignación a partir de `bodegaId` (legacy).
  //
  // Sprint 3 Fase 5 (override por bodega):
  //   - `permisosOverride`: Set de keys de permisos. `null` = sin override
  //     (usa los del rol). `Set` con al menos un elemento = override
  //     explícito (REEMPLAZA al rol en esta bodega). Esto le da al
  //     admin control fino sin ambigüedad.
  //   - `matrizAbierta`: estado de UI por fila (qué filas tienen la
  //     mini-matriz desplegada).
  type Asignacion = {
    bodegaId: string
    rolKey: string
    esPrincipal: boolean
    permisosOverride: Set<Permiso> | null
  }
  const [asignaciones, setAsignaciones] = useState<Asignacion[]>([])
  const [matrizAbierta, setMatrizAbierta] = useState<Set<number>>(new Set())
  const [estado, setEstado] = useState<EstadoUsuario>('Activo')
  const [showPwd, setShowPwd] = useState(false)
  const [error, setError] = useState('')
  const [cargando, setCargando] = useState(false)

  // Cargamos roles si todavía no están en el store.
  useEffect(() => {
    if (permisosStore.estado().status === 'idle') {
      void permisosStore.cargar().catch(() => undefined)
    }
  }, [])

  // Lista de bodegas del tenant.
  const bodegas = bodegasState.status === 'listo' ? bodegasState.bodegas : []
  // Default: una asignación inicial con la bodega activa y el primer rol.
  useEffect(() => {
    if (asignaciones.length === 0 && bodegas.length > 0) {
      const bodegaInicial = activaId && bodegas.some((b) => b.id === activaId)
        ? activaId
        : bodegas[0].id
      setAsignaciones([{ bodegaId: bodegaInicial, rolKey: '', esPrincipal: true, permisosOverride: null }])
    }
  }, [asignaciones.length, bodegas, activaId])

  // Roles disponibles: admin del sistema y roles custom del tenant.
  // Superadmin nunca es asignable desde este formulario.
  const rolesDisponibles = roles
    .filter((r) => !ROLES_RESERVADOS.has(r.key))
    .map((r) => ({ key: r.key, nombre: r.nombre }))

  // ─── Sprint 3 Fase 5: auto-seleccionar el primer rol disponible ───
  // Si una fila tiene `rolKey === ''` (vacío) y hay roles disponibles,
  // le asignamos el primero. Esto evita que la mini-matriz diga
  // "Elegí un rol primero" cuando ya hay un rol usable.
  useEffect(() => {
    if (rolesDisponibles.length === 0) return
    setAsignaciones((prev) => {
      let dirty = false
      const next = prev.map((a) => {
        if (a.rolKey !== '') return a
        dirty = true
        return { ...a, rolKey: rolesDisponibles[0].key }
      })
      return dirty ? next : prev
    })
  }, [rolesDisponibles.length, asignaciones.length])

  // Para la mini-matriz: dado un rolKey, devolvemos los permisos del rol
  // (o Set vacío si el rol todavía no se eligió). Si el admin ya personalizó
  // el override de esa fila, devolvemos ese override en su lugar.
  //
  // NOTA: usamos `a == null` (no `!== null`) para chequear override.
  // El tipo dice `Set | null`, pero en runtime el botón "Agregar bodega"
  // puede crear una fila con `permisosOverride === undefined` si nos
  // olvidamos de inicializarlo. `undefined == null` es `true` en JS, así
  // que este guard normaliza ambos casos. (También: `permisosOverride`
  // siempre es un `Set` si es no-nulo — nunca devolvemos `undefined`.)
  function getPermisosEfectivos(asig: Asignacion): Set<Permiso> {
    if (asig.permisosOverride != null) return asig.permisosOverride
    if (!asig.rolKey) return new Set<Permiso>()
    const rol = permisosStore.roles.obtener(asig.rolKey)
    return new Set(rol?.permisos ?? [])
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (cargando) return
    setError('')

    // Validaciones
    if (!nombre.trim()) {
      setError('El nombre es obligatorio.')
      return
    }
    if (nombre.trim().length < 2) {
      setError('El nombre debe tener al menos 2 caracteres.')
      return
    }
    if (!email.trim()) {
      setError('El email es obligatorio.')
      return
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError('El email no tiene un formato válido.')
      return
    }
    if (!password) {
      setError('La contraseña es obligatoria.')
      return
    }
    if (password.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres.')
      return
    }
    if (password !== confirmar) {
      setError('La confirmación no coincide con la contraseña.')
      return
    }
    if (asignaciones.length === 0) {
      setError('Agregá al menos una asignación (bodega + rol).')
      return
    }
    // Validar cada asignación
    for (const [i, a] of asignaciones.entries()) {
      if (!a.bodegaId) {
        setError(`Asignación ${i + 1}: elegí una bodega.`)
        return
      }
      if (!a.rolKey) {
        setError(`Asignación ${i + 1}: elegí un rol.`)
        return
      }
    }
    // Una sola principal
    const principales = asignaciones.filter((a) => a.esPrincipal)
    if (principales.length > 1) {
      setError('Solo una asignación puede ser principal.')
      return
    }
    // No bodegas duplicadas
    const bodegasSet = new Set(asignaciones.map((a) => a.bodegaId))
    if (bodegasSet.size !== asignaciones.length) {
      setError('No podés asignar la misma bodega dos veces.')
      return
    }

    setCargando(true)
    // Usamos el endpoint nuevo con `asignaciones[]` si está disponible.
    // Si el back aún no lo tiene, caemos al legacy (bodegaId + rolKey).
    const primera = asignaciones.find((a) => a.esPrincipal) ?? asignaciones[0]
    usuariosStore
      .crear({
        nombre: nombre.trim(),
        email: email.trim(),
        password,
        rol: primera.rolKey,
        bodegaId: primera.bodegaId,
        estado,
        // ─── Sprint 3: múltiples asignaciones ───
        // El back crea una fila por cada item en `asignaciones[]`.
        // `permisos` solo se manda si la fila tiene un override explícito
        // (no `null`). Si es `null` (usa el rol), el back lo interpreta
        // como "sin override".
        asignaciones: asignaciones.map((a) => ({
          bodegaId: a.bodegaId,
          rolKey: a.rolKey,
          esPrincipal: a.esPrincipal,
          permisos: a.permisosOverride ? Array.from(a.permisosOverride) : undefined,
        })),
      })
      .then((u) => {
        onCreated?.({ id: u.id, nombre: u.nombre, email: u.email })
        onClose()
      })
      .catch((err: unknown) => {
        if (err instanceof ApiError) {
          setError(err.message || 'No se pudo crear el usuario.')
        } else if (err instanceof Error) {
          setError(err.message)
        } else {
          setError('No se pudo crear el usuario.')
        }
      })
      .finally(() => {
        setCargando(false)
      })
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Nuevo Usuario"
      description="Creá un usuario nuevo en la bodega en la que estás trabajando"
      icon={<UserPlus size={16} className="text-primary" />}
      size="md"
      footer={
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={cargando}
            className="flex-1 min-h-11 border border-border text-sm text-foreground hover:border-foreground/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ borderRadius: '0.25rem' }}
          >
            Cancelar
          </button>
          <button
            type="submit"
            form="form-crear-usuario"
            disabled={cargando}
            className="flex-1 min-h-11 bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
            style={{ borderRadius: '0.25rem' }}
          >
            {cargando ? (
              <>
                <span
                  className="w-3.5 h-3.5 border-2 border-primary-foreground/40 border-t-primary-foreground rounded-full animate-spin"
                  aria-hidden
                />
                Creando…
              </>
            ) : (
              'Crear usuario'
            )}
          </button>
        </div>
      }
    >
      <form
        id="form-crear-usuario"
        onSubmit={handleSubmit}
        className="px-4 sm:px-5 py-5 space-y-5"
      >
        {/* INFORMACIÓN */}
        <Section title="Información del usuario" icon={UserPlus}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Field label="Nombre completo" required>
              <input
                type="text"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                placeholder="Ej: Juan Pérez"
                className={inputClass}
                autoComplete="off"
                autoFocus
                disabled={cargando}
              />
            </Field>
            <Field label="Email" required>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="usuario@empresa.com"
                className={inputClass}
                autoComplete="off"
                disabled={cargando}
              />
            </Field>
          </div>
        </Section>

            {/* CREDENCIALES */}
            <Section title="Credenciales" icon={KeyRound}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Field
                  label="Contraseña"
                  required
                  hint="Mínimo 8 caracteres"
                >
                  <div className="relative">
                    <input
                      type={showPwd ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className={`${inputClass} pr-10`}
                      autoComplete="new-password"
                      disabled={cargando}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPwd((s) => !s)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
                      title={showPwd ? 'Ocultar' : 'Mostrar'}
                      tabIndex={-1}
                    >
                      {showPwd ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                </Field>
                <Field label="Confirmar contraseña" required>
                  <input
                    type={showPwd ? 'text' : 'password'}
                    value={confirmar}
                    onChange={(e) => setConfirmar(e.target.value)}
                    placeholder="••••••••"
                    className={inputClass}
                    autoComplete="new-password"
                    disabled={cargando}
                  />
                </Field>
              </div>
            </Section>

            {/* ASIGNACIÓN */}
            <Section title="Asignación" icon={ShieldCheck}>
              <Field label="Estado" required>
                <SelectMobile
                  value={estado}
                  onChange={(v) => setEstado(v as EstadoUsuario)}
                  options={ESTADOS.map((es) => ({
                    value: es,
                    label: es,
                  }))}
                  disabled={cargando}
                  aria-label="Estado"
                />
              </Field>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label
                    className="block text-xs text-muted-foreground tracking-widest uppercase"
                    style={{ fontFamily: "'JetBrains Mono', monospace" }}
                  >
                    Asignaciones <span className="text-primary">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={() =>
                      setAsignaciones((prev) => [
                        ...prev,
                        {
                          bodegaId:
                            bodegas.find((b) => !prev.some((p) => p.bodegaId === b.id))?.id ?? '',
                          // `rolKey` arranca con el de la primera fila para
                          // que las nuevas bodegas tengan el mismo rol por
                          // default (después se puede cambiar). Si no hay
                          // ninguna, queda '' y el useEffect de auto-selección
                          // lo completa cuando los roles estén listos.
                          rolKey: prev[0]?.rolKey ?? '',
                          esPrincipal: prev.length === 0,
                          // `permisosOverride: null` EXPLÍCITO. Si queda
                          // `undefined` el guard de `getPermisosEfectivos`
                          // se confunde y devuelve `undefined` en vez de
                          // un Set, reventando `permisosEfectivos.has()`.
                          permisosOverride: null,
                        },
                      ])
                    }
                    disabled={cargando || bodegas.every((b) => asignaciones.some((a) => a.bodegaId === b.id))}
                    className="inline-flex items-center gap-1.5 min-h-[36px] px-2.5 py-1.5 text-xs text-foreground border border-border hover:border-primary/40 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    style={{ borderRadius: '0.25rem', fontFamily: "'DM Sans', sans-serif" }}
                  >
                    <Plus size={12} />
                    Agregar bodega
                  </button>
                </div>
                <p
                  className="text-[10px] text-muted-foreground mb-3"
                  style={{ fontFamily: "'DM Sans', sans-serif" }}
                >
                  Asigná al usuario a una o más bodegas. Cada bodega puede
                  tener un rol distinto. Marcá una como principal (es la
                  que se abre por defecto).
                </p>
                {asignaciones.length === 0 ? (
                  <div
                    className="text-xs text-muted-foreground border border-dashed border-border px-3 py-4 text-center"
                    style={{ borderRadius: '0.25rem' }}
                  >
                    Sin asignaciones. Tocá "Agregar bodega" para crear la primera.
                  </div>
                ) : (
                  <ul className="space-y-2">
                    {asignaciones.map((a, i) => {
                      const matrizEstaAbierta = matrizAbierta.has(i)
                      const permisosEfectivos = getPermisosEfectivos(a)
                      // Mismo razonamiento que en getPermisosEfectivos: usamos
                      // `!= null` para tratar `null` y `undefined` igual.
                      const tieneOverrideCustom = a.permisosOverride != null
                      return (
                        <li
                          key={i}
                          className="bg-muted/40 border border-border"
                          style={{ borderRadius: '0.25rem' }}
                        >
                          {/* ── Fila principal: estrella + bodega + rol + acciones ── */}
                          <div className="flex items-center gap-2 p-2.5">
                            <button
                              type="button"
                              onClick={() =>
                                setAsignaciones((prev) =>
                                  prev.map((p, idx) => ({
                                    ...p,
                                    esPrincipal: idx === i,
                                  })),
                                )
                              }
                              className={`shrink-0 w-7 h-7 flex items-center justify-center border transition-colors ${
                                a.esPrincipal
                                  ? 'border-secondary/50 bg-secondary/15 text-secondary'
                                  : 'border-border text-muted-foreground hover:text-secondary'
                              }`}
                              style={{ borderRadius: '0.25rem' }}
                              title={a.esPrincipal ? 'Principal' : 'Marcar como principal'}
                              disabled={cargando}
                            >
                              <Star size={13} fill={a.esPrincipal ? 'currentColor' : 'none'} />
                            </button>
                            <SelectMobile
                              value={a.bodegaId}
                              onChange={(v) =>
                                setAsignaciones((prev) =>
                                  prev.map((p, idx) => (idx === i ? { ...p, bodegaId: v } : p)),
                                )
                              }
                              options={bodegas.map((b) => ({
                                value: b.id,
                                label:
                                  b.nombre +
                                  (b.id === activaId ? ' · actual' : '') +
                                  (asignaciones.some((p, idx) => idx !== i && p.bodegaId === b.id)
                                    ? ' (ya asignada)'
                                    : ''),
                              }))}
                              disabled={cargando}
                              aria-label={`Bodega de la asignación ${i + 1}`}
                            />
                            <SelectMobile
                              value={a.rolKey}
                              onChange={(v) =>
                                // Cambiar el rol resetea el override (la
                                // base cambió; los permisos viejos ya no
                                // aplican con el nuevo rol).
                                setAsignaciones((prev) =>
                                  prev.map((p, idx) =>
                                    idx === i ? { ...p, rolKey: v, permisosOverride: null } : p,
                                  ),
                                )
                              }
                              options={rolesDisponibles.map((r) => ({
                                value: r.key,
                                label: r.nombre,
                              }))}
                              disabled={cargando}
                              aria-label={`Rol de la asignación ${i + 1}`}
                            />
                            {asignaciones.length > 1 && (
                              <button
                                type="button"
                                onClick={() =>
                                  setAsignaciones((prev) => {
                                    const next = prev.filter((_, idx) => idx !== i)
                                    if (!next.some((p) => p.esPrincipal) && next[0]) {
                                      next[0] = { ...next[0], esPrincipal: true }
                                    }
                                    return next
                                  })
                                }
                                disabled={cargando}
                                className="shrink-0 w-9 h-11 flex items-center justify-center text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                                style={{ borderRadius: '0.25rem' }}
                                title="Quitar asignación"
                                aria-label="Quitar asignación"
                              >
                                <Trash2 size={14} />
                              </button>
                            )}
                          </div>

                          {/* ── Fila inferior: header clickeable del acordeón ── */}
                          <div
                            role="button"
                            tabIndex={0}
                            onClick={() => {
                              if (cargando || !a.rolKey) return
                              setMatrizAbierta((prev) => {
                                const next = new Set(prev)
                                if (next.has(i)) next.delete(i)
                                else next.add(i)
                                return next
                              })
                            }}
                            onKeyDown={(e) => {
                              if ((e.key === 'Enter' || e.key === ' ') && !cargando && a.rolKey) {
                                e.preventDefault()
                                setMatrizAbierta((prev) => {
                                  const next = new Set(prev)
                                  if (next.has(i)) next.delete(i)
                                  else next.add(i)
                                  return next
                                })
                              }
                            }}
                            aria-expanded={matrizEstaAbierta}
                            aria-disabled={!a.rolKey}
                            className={`flex items-center justify-start gap-1.5 px-2.5 py-1.5 border-t border-border bg-background/30 select-none transition-colors ${
                              a.rolKey
                                ? matrizEstaAbierta
                                  ? 'text-primary'
                                  : 'text-muted-foreground hover:text-foreground cursor-pointer'
                                : 'text-muted-foreground/50 cursor-not-allowed'
                            }`}
                            style={{ fontFamily: "'JetBrains Mono', monospace" }}
                            title={
                              a.rolKey
                                ? matrizEstaAbierta
                                  ? 'Ocultar matriz'
                                  : 'Ver / editar permisos de esta asignación'
                                : 'Elegí un rol primero'
                            }
                          >
                            {matrizEstaAbierta ? (
                              <ChevronDown size={12} />
                            ) : (
                              <ChevronRight size={12} />
                            )}
                            <Grid3x3 size={11} />
                            <span className="text-[10px] uppercase tracking-widest">Matriz</span>
                            {tieneOverrideCustom && (
                              <span
                                className="ml-1 w-1.5 h-1.5 rounded-full bg-secondary"
                                title="Esta asignación tiene permisos personalizados"
                              />
                            )}
                          </div>

                          {/* ── Mini-matriz expandible ── */}
                          {matrizEstaAbierta && a.rolKey && (
                            <div className="border-t border-border bg-background/40 p-3">
                              <div className="flex items-center justify-between mb-2">
                                <div
                                  className="text-[10px] text-muted-foreground uppercase tracking-widest"
                                  style={{ fontFamily: "'JetBrains Mono', monospace" }}
                                >
                                  {tieneOverrideCustom
                                    ? 'Override personalizado · reemplaza al rol'
                                    : 'Permisos del rol (clic para personalizar)'}
                                </div>
                                {tieneOverrideCustom && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setAsignaciones((prev) =>
                                        prev.map((p, idx) =>
                                          idx === i ? { ...p, permisosOverride: null } : p,
                                        ),
                                      )
                                    }
                                    disabled={cargando}
                                    className="inline-flex items-center gap-1.5 min-h-[32px] px-2 py-1 text-[10px] text-muted-foreground hover:text-foreground border border-border transition-colors"
                                    style={{ borderRadius: '0.25rem', fontFamily: "'JetBrains Mono', monospace" }}
                                  >
                                    <RotateCcw size={10} />
                                    Volver al rol
                                  </button>
                                )}
                              </div>
                              <ul className="space-y-2">
                                {MODULOS.map((m) => {
                                  const subs = m.submodulos ?? []
                                  // Si tiene sub-módulos, mostramos cada uno.
                                  // Si no, mostramos el módulo plano.
                                  return (
                                    <li key={m.key}>
                                      <div className="text-xs text-foreground font-semibold mb-1">
                                        {m.label}
                                      </div>
                                      {subs.length === 0 ? (
                                        <div className="flex flex-wrap gap-1.5 pl-2">
                                          {m.acciones.map((a) => {
                                            const key = `${m.key}.${a}` as Permiso
                                            const on = permisosEfectivos.has(key)
                                            return (
                                              <button
                                                key={a}
                                                type="button"
                                                onClick={() => {
                                                  // El primer click sobre un
                                                  // permiso cuando todavía no hay
                                                  // override crea el override
                                                  // (copiando la base del rol).
                                                  // Después tildar/destildar
                                                  // alterna.
                                                  setAsignaciones((prev) =>
                                                    prev.map((p, idx) => {
                                                      if (idx !== i) return p
                                                      const base =
                                                        p.permisosOverride ??
                                                        new Set(
                                                          permisosStore.roles.obtener(
                                                            p.rolKey,
                                                          )?.permisos ?? [],
                                                        )
                                                      const next = new Set(base)
                                                      if (on) next.delete(key)
                                                      else next.add(key)
                                                      return { ...p, permisosOverride: next }
                                                    }),
                                                  )
                                                }}
                                                disabled={cargando}
                                                className={`min-h-[32px] px-2.5 py-1 text-[11px] border transition-colors ${
                                                  on
                                                    ? 'border-secondary/50 bg-secondary/15 text-secondary'
                                                    : 'border-border text-muted-foreground hover:border-foreground/30'
                                                }`}
                                                style={{ borderRadius: '0.15rem' }}
                                              >
                                                {labelAccion(a)}
                                              </button>
                                            )
                                          })}
                                        </div>
                                      ) : (
                                        <div className="pl-2 space-y-1.5">
                                          {subs.map((s) => {
                                            // Sub-módulos de un módulo con
                                            // sub-módulos (Técnicos, Reportes)
                                            // tienen las 4 acciones completas.
                                            // Por eso usamos la constante
                                            // global `ACCIONES` y NO
                                            // `m.acciones` (que es solo del
                                            // padre y suele tener solo "ver").
                                            return (
                                              <div key={s.key}>
                                                <div className="text-[11px] text-muted-foreground mb-1 flex items-center gap-2">
                                                  <span>{s.label}</span>
                                                  {accionesCustomSubmodulo(s).length > 0 && (
                                                    <span
                                                      className="text-[9px] text-muted-foreground/70"
                                                      style={{ fontFamily: "'JetBrains Mono', monospace" }}
                                                    >
                                                      (+{accionesCustomSubmodulo(s).length} custom)
                                                    </span>
                                                  )}
                                                </div>
                                                <div className="flex flex-wrap gap-1.5 pl-2">
                                                  {ACCIONES.map((a) => {
                                                    const key = `${m.key}.${s.key}.${a}` as Permiso
                                                    const on = permisosEfectivos.has(key)
                                                    return (
                                                      <button
                                                        key={a}
                                                        type="button"
                                                        onClick={() => {
                                                          setAsignaciones((prev) =>
                                                            prev.map((p, idx) => {
                                                              if (idx !== i) return p
                                                              const base =
                                                                p.permisosOverride ??
                                                                new Set(
                                                                  permisosStore.roles.obtener(
                                                                    p.rolKey,
                                                                  )?.permisos ?? [],
                                                                )
                                                              const next = new Set(base)
                                                              if (on) next.delete(key)
                                                              else next.add(key)
                                                              return { ...p, permisosOverride: next }
                                                            }),
                                                          )
                                                        }}
                                                        disabled={cargando}
                                                        className={`min-h-[32px] px-2.5 py-1 text-[11px] border transition-colors ${
                                                          on
                                                            ? 'border-secondary/50 bg-secondary/15 text-secondary'
                                                            : 'border-border text-muted-foreground hover:border-foreground/30'
                                                        }`}
                                                        style={{ borderRadius: '0.15rem' }}
                                                      >
                                                        {labelAccion(a)}
                                                      </button>
                                                    )
                                                  })}
                                                </div>
                                                {/* Acciones custom granulares (no entran en las 4 base).
                                                    Se renderizan como chips extra debajo de los base. */}
                                                {(() => {
                                                  const accsCustom = accionesCustomSubmodulo(s)
                                                  if (accsCustom.length === 0) return null
                                                  return (
                                                    <div className="flex flex-wrap gap-1.5 pl-2 mt-1.5">
                                                      {accsCustom.map((a) => {
                                                        const key = `${m.key}.${s.key}.${a}` as Permiso
                                                        const on = permisosEfectivos.has(key)
                                                        return (
                                                          <button
                                                            key={a}
                                                            type="button"
                                                            onClick={() => {
                                                              setAsignaciones((prev) =>
                                                                prev.map((p, idx) => {
                                                                  if (idx !== i) return p
                                                                  const base =
                                                                    p.permisosOverride ??
                                                                    new Set(
                                                                      permisosStore.roles.obtener(
                                                                        p.rolKey,
                                                                      )?.permisos ?? [],
                                                                    )
                                                                  const next = new Set(base)
                                                                  if (on) next.delete(key)
                                                                  else next.add(key)
                                                                  return { ...p, permisosOverride: next }
                                                                }),
                                                              )
                                                            }}
                                                            disabled={cargando}
                                                            className={`min-h-[28px] px-2 py-0.5 text-[10px] border transition-colors ${
                                                              on
                                                                ? 'border-secondary/50 bg-secondary/15 text-secondary'
                                                                : 'border-border text-muted-foreground hover:border-foreground/30'
                                                            }`}
                                                            style={{ borderRadius: '0.15rem' }}
                                                          >
                                                            {labelAccion(a)}
                                                          </button>
                                                        )
                                                      })}
                                                    </div>
                                                  )
                                                })()}
                                              </div>
                                            )
                                          })}
                                        </div>
                                      )}
                                    </li>
                                  )
                                })}
                              </ul>
                            </div>
                          )}
                        </li>
                      )
                    })}
                  </ul>
                )}
              </div>
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

const inputClass =
  'w-full px-3 py-2.5 min-h-[44px] bg-muted border border-border text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/60 transition-colors disabled:opacity-50 disabled:cursor-not-allowed'

function Section({
  title,
  icon: Icon,
  children,
}: {
  title: string
  icon: typeof UserPlus
  children: React.ReactNode
}) {
  return (
    <div
      className="bg-muted/30 border border-border p-4"
      style={{ borderRadius: '0.25rem' }}
    >
      <div className="flex items-center gap-2 mb-3">
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
      <div className="space-y-3">{children}</div>
    </div>
  )
}

function Field({
  label,
  required,
  hint,
  children,
}: {
  label: string
  required?: boolean
  hint?: string
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
      {hint && (
        <p
          className="mt-1 text-[10px] text-muted-foreground"
          style={{ fontFamily: "'JetBrains Mono', monospace" }}
        >
          {hint}
        </p>
      )}
    </div>
  )
}
