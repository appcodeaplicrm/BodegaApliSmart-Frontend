import { useEffect, useState, type FormEvent } from 'react'
import {
  X,
  UserPlus,
  Eye,
  EyeOff,
  KeyRound,
  Building2,
  ShieldCheck,
  CircleAlert,
} from 'lucide-react'
import {
  usuariosStore,
  type RolUsuario,
  type EstadoUsuario,
} from '../store/usuarios'
import { usePermisos, permisosStore } from '../store/permisos'
import { useBodegas } from '../store/bodegas'
import { useBodegaActiva } from '../store/bodegaActiva'
import { ApiError } from '../lib/api'

type CrearUsuarioModalProps = {
  onClose: () => void
  /** Se llama con el usuario recién creado (cuando la API responde OK). */
  onCreated?: (usuario: { id: string; nombre: string; email: string }) => void
}

const ROLES_PREDEFINIDOS: { key: RolUsuario; label: string }[] = [
  { key: 'admin', label: 'Administrador' },
  { key: 'bodeguero', label: 'Bodeguero' },
  { key: 'operador', label: 'Operador' },
  { key: 'tecnico', label: 'Técnico' },
]

const ESTADOS: EstadoUsuario[] = ['Activo', 'Inactivo']

export function CrearUsuarioModal({ onClose, onCreated }: CrearUsuarioModalProps) {
  const { roles } = usePermisos()
  const bodegasState = useBodegas()
  const activaId = useBodegaActiva()

  const [nombre, setNombre] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmar, setConfirmar] = useState('')
  const [rolKey, setRolKey] = useState<RolUsuario | string>('operador')
  const [estado, setEstado] = useState<EstadoUsuario>('Activo')
  const [showPwd, setShowPwd] = useState(false)
  const [error, setError] = useState('')
  const [cargando, setCargando] = useState(false)

  // Cargamos roles si todavía no están en el store. NO necesitamos bodegas
  // (la bodega se asigna automáticamente desde la bodega activa).
  useEffect(() => {
    if (permisosStore.estado().status === 'idle') {
      void permisosStore.cargar().catch(() => undefined)
    }
  }, [])

  // Bodega destino: SIEMPRE la bodega activa del dashboard. No es
  // elegible: cada bodeguero gestiona los usuarios de su bodega.
  const bodegas = bodegasState.status === 'listo' ? bodegasState.bodegas : []
  const bodegaActiva = bodegas.find((b) => b.id === activaId)

  // Roles disponibles: predefinidos + custom del store de permisos
  const rolesDisponibles = (() => {
    const set = new Map<string, { key: string; nombre: string }>()
    for (const r of ROLES_PREDEFINIDOS) {
      set.set(r.key, { key: r.key, nombre: r.label })
    }
    for (const r of roles) {
      if (!set.has(r.key)) {
        set.set(r.key, { key: r.key, nombre: r.nombre })
      }
    }
    return Array.from(set.values())
  })()

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
    if (!activaId) {
      setError('No hay una bodega activa. Seleccioná una bodega antes de crear usuarios.')
      return
    }

    setCargando(true)
    usuariosStore
      .crear({
        nombre: nombre.trim(),
        email: email.trim(),
        password,
        rol: rolKey,
        bodegaId: activaId || null,
        estado,
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
    <div
      className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-card border border-border w-full max-w-xl max-h-[92vh] flex flex-col"
        style={{ borderRadius: '0.25rem' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-5 border-b border-border shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-primary/15 flex items-center justify-center">
              <UserPlus size={16} className="text-primary" />
            </div>
            <div>
              <h2
                className="text-xl uppercase text-foreground leading-none"
                style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900 }}
              >
                Nuevo Usuario
              </h2>
              <p
                className="mt-1 text-xs text-muted-foreground"
                style={{ fontFamily: "'DM Sans', sans-serif" }}
              >
                Creá un usuario nuevo en la bodega en la que estás trabajando
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition-colors"
            disabled={cargando}
          >
            <X size={18} />
          </button>
        </div>

        <form
          onSubmit={handleSubmit}
          className="flex-1 overflow-y-auto"
        >
          <div className="p-5 space-y-5">
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
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Field label="Rol" required>
                  <select
                    value={rolKey}
                    onChange={(e) => setRolKey(e.target.value)}
                    className={inputClass}
                    disabled={cargando}
                  >
                    {rolesDisponibles.map((r) => (
                      <option key={r.key} value={r.key}>
                        {r.nombre}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Estado" required>
                  <select
                    value={estado}
                    onChange={(e) =>
                      setEstado(e.target.value as EstadoUsuario)
                    }
                    className={inputClass}
                    disabled={cargando}
                  >
                    {ESTADOS.map((es) => (
                      <option key={es} value={es}>
                        {es}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>

              <Field
                label="Bodega"
                hint="El usuario queda asignado a la bodega en la que estás trabajando"
              >
                <div className="relative">
                  <Building2
                    size={14}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
                  />
                  <div
                    className={`${inputClass} pl-9 flex items-center text-foreground`}
                    style={{ fontFamily: "'DM Sans', sans-serif" }}
                  >
                    {bodegaActiva
                      ? bodegaActiva.nombre
                      : activaId
                        ? 'Cargando…'
                        : '— Sin bodega activa —'}
                  </div>
                </div>
              </Field>
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
              disabled={cargando}
              className="flex-1 py-2.5 border border-border text-sm text-foreground hover:border-foreground/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ borderRadius: '0.25rem' }}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={cargando}
              className="flex-1 py-2.5 bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
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
        </form>
      </div>
    </div>
  )
}

const inputClass =
  'w-full px-3 py-2.5 bg-muted border border-border text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/60 transition-colors disabled:opacity-50 disabled:cursor-not-allowed'

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
