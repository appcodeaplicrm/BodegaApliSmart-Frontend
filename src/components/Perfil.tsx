import { useEffect, useState } from 'react'
import {
  User as UserIcon,
  KeyRound,
  BellRing,
  History,
  Pencil,
  Save,
  X,
  Camera,
  Eye,
  EyeOff,
  CheckCircle2,
  Smartphone,
  Monitor,
  ToggleLeft,
  ToggleRight,
  Warehouse,
  Building2,
  ShieldCheck,
  AtSign,
  Mail,
  Phone,
  UserCog,
  CalendarDays,
  Shield,
  Inbox,
} from 'lucide-react'
import { api, ApiError } from '../lib/api'
import { useAuth } from '../store/auth'

// ───────────────────────────────────────────────────────────────────
//  Tipos
// ───────────────────────────────────────────────────────────────────

type Perfil = {
  id: string
  nombre: string
  username: string
  email: string
  telefono: string
  cargo: string
  estado: 'Activo' | 'Inactivo'
  rol: string
  rolNombre: string
  bodega: { id: string; nombre: string } | null
  empresa: { id: string; nombre: string; email: string } | null
  createdAt: string
  ultimoAcceso: string | null
  estadisticas: { movimientos: number; despachos: number; checklists: number }
}

type ActividadItem = {
  accion: string
  modulo: string
  fecha: string
  ip: string
  dispositivo: string
}

type NotifKey =
  | 'stock_bajo'
  | 'mov_registrado'
  | 'nuevo_kit'
  | 'ck_pendiente'
  | 'ck_vencido'
  | 'ck_aprobado'
  | 'login_nuevo'
  | 'cambio_pass'
  | 'reporte_listo'

type NotifMap = Record<NotifKey, boolean>

type SesionItem = {
  id: string
  dispositivo: string
  ubicacion: string
  hora: string
  current: boolean
}

type Tab = 'info' | 'seguridad' | 'notificaciones' | 'actividad'

// Catálogo de notificaciones (debe matchear el back)
const NOTIF_GRUPOS: Array<{ grupo: string; items: Array<{ key: NotifKey; label: string; desc: string }> }> = [
  {
    grupo: 'Inventario',
    items: [
      { key: 'stock_bajo', label: 'Alertas de stock bajo', desc: 'Cuando un producto baja del mínimo' },
      { key: 'mov_registrado', label: 'Movimientos registrados', desc: 'Cada entrada/salida confirmada' },
      { key: 'nuevo_kit', label: 'Nuevos kits creados', desc: 'Cuando se crea un kit en la bodega' },
    ],
  },
  {
    grupo: 'Checklists',
    items: [
      { key: 'ck_pendiente', label: 'Checklist pendiente', desc: 'Cuando se agenda un checklist para mí' },
      { key: 'ck_vencido', label: 'Checklist vencido', desc: 'Si no lo completé antes del límite' },
      { key: 'ck_aprobado', label: 'Resultado aprobado', desc: 'Cuando el bodeguero aprueba mi checklist' },
    ],
  },
  {
    grupo: 'Sistema',
    items: [
      { key: 'login_nuevo', label: 'Nuevo inicio de sesión', desc: 'Si detectamos un login desde otro dispositivo' },
      { key: 'cambio_pass', label: 'Cambio de contraseña', desc: 'Cuando alguien cambia la pass de tu cuenta' },
      { key: 'reporte_listo', label: 'Reporte listo', desc: 'Cuando un reporte programado termina de generarse' },
    ],
  },
]

// ───────────────────────────────────────────────────────────────────
//  Componente principal
// ───────────────────────────────────────────────────────────────────

export function Perfil() {
  const auth = useAuth()
  const [tab, setTab] = useState<Tab>('info')

  return (
    <div className="flex-1 flex flex-col min-w-0 min-h-0 bg-background">
      <PageHeader />

      <div className="flex-1 overflow-y-auto p-8">
        <div className="max-w-4xl mx-auto space-y-6">
          <ProfileCard />
          <Tabs tab={tab} setTab={setTab} />

          {tab === 'info' && <TabInfo />}
          {tab === 'seguridad' && <TabSeguridad />}
          {tab === 'notificaciones' && <TabNotificaciones />}
          {tab === 'actividad' && <TabActividad />}

          {/* firma de auth para que no marque unused */}
          {auth.status === 'autenticado' ? null : null}
        </div>
      </div>
    </div>
  )
}

// ───────────────────────────────────────────────────────────────────
//  PageHeader
// ───────────────────────────────────────────────────────────────────

function PageHeader() {
  return (
    <header className="h-14 border-b border-border px-6 flex items-center justify-between shrink-0 gap-3">
      <div className="min-w-0">
        <h1
          className="text-2xl uppercase text-foreground leading-none"
          style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900 }}
        >
          PERFIL
        </h1>
        <div
          className="text-[10px] text-muted-foreground uppercase tracking-widest mt-1"
          style={{ fontFamily: "'JetBrains Mono', monospace" }}
        >
          STOCKPRO · CUENTA Y PREFERENCIAS
        </div>
      </div>
    </header>
  )
}

// ───────────────────────────────────────────────────────────────────
//  ProfileCard (siempre visible en todos los tabs)
// ───────────────────────────────────────────────────────────────────

function ProfileCard() {
  const [perfil, setPerfil] = useState<Perfil | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    api
      .get<Perfil>('/perfil')
      .then((p) => setPerfil(p))
      .catch((e) => setError(e instanceof ApiError ? e.message : 'Error cargando perfil'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <CardSkeleton />
  if (error || !perfil) {
    return (
      <div className="bg-card border border-border p-6 text-sm text-primary">
        ⚠ {error ?? 'No se pudo cargar el perfil.'}
      </div>
    )
  }

  const initials = getInitials(perfil.nombre)
  const fechaIngreso = new Date(perfil.createdAt).toLocaleDateString('es-CO', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
  const id = `USR-${perfil.id.slice(-5).toUpperCase()}`

  return (
    <div className="bg-card border border-border overflow-hidden">
      {/* Banner */}
      <div
        className="h-24 relative"
        style={{
          background:
            'linear-gradient(135deg, #E8593F18 0%, #ABF76815 60%, #24242400 100%)',
        }}
      >
        <div
          className="absolute inset-0 opacity-5"
          style={{
            backgroundImage:
              'linear-gradient(rgba(255,255,255,1) 1px,transparent 1px), linear-gradient(90deg,rgba(255,255,255,1) 1px,transparent 1px)',
            backgroundSize: '32px 32px',
          }}
        />
      </div>

      {/* Avatar + cámara */}
      <div className="px-6 -mt-10 relative">
        <div className="w-20 h-20 rounded-xl bg-primary border-4 border-card flex items-center justify-center">
          <span
            className="text-primary-foreground"
            style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: 28 }}
          >
            {initials}
          </span>
        </div>
        <button
          title="Cambiar foto"
          className="absolute left-[68px] top-12 w-6 h-6 rounded-full bg-secondary border-2 border-card flex items-center justify-center"
        >
          <Camera size={11} className="text-secondary-foreground" strokeWidth={2.5} />
        </button>
      </div>

      {/* Info */}
      <div className="px-6 pt-3 pb-4">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="min-w-0">
            <h2
              className="text-3xl uppercase text-foreground leading-none"
              style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900 }}
            >
              {perfil.nombre}
            </h2>
            <div className="text-sm text-muted-foreground mt-1.5">
              {perfil.cargo || 'Sin cargo asignado'}
            </div>

            {/* Meta-info */}
            <div className="flex items-center gap-3 mt-3 flex-wrap">
              {perfil.bodega && (
                <MetaIcon icon={Warehouse} label={perfil.bodega.nombre} />
              )}
              {perfil.empresa && (
                <MetaIcon icon={Building2} label={perfil.empresa.nombre} />
              )}
              <MetaIcon icon={CalendarDays} label={`Ingreso ${fechaIngreso}`} />
              <span
                className="text-[9px] px-1.5 py-0.5 bg-primary/15 text-primary border border-primary/20 uppercase"
                style={{
                  borderRadius: '0.15rem',
                  fontFamily: "'JetBrains Mono', monospace",
                  fontWeight: 500,
                }}
              >
                {perfil.rolNombre}
              </span>
            </div>
          </div>

          <PillActivo />
        </div>

        {/* Mini-stats (solo desktop) */}
        <div className="hidden md:grid grid-cols-3 mt-5" style={{ gap: '1px', background: 'var(--border, #2a2a2a)' }}>
          <StatCell value={perfil.estadisticas.movimientos} label="Movimientos" />
          <StatCell value={perfil.estadisticas.despachos} label="Despachos" />
          <StatCell value={perfil.estadisticas.checklists} label="Checklists" />
        </div>
      </div>

      {/* Footer */}
      <div className="bg-muted/40 border-t border-border/60 px-6 py-4 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <CalendarDays size={13} />
          <span
            className="uppercase tracking-wider"
            style={{ fontFamily: "'JetBrains Mono', monospace" }}
          >
            Miembro desde
          </span>
          <span className="text-foreground">{fechaIngreso}</span>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span
            className="uppercase tracking-wider text-muted-foreground"
            style={{ fontFamily: "'JetBrains Mono', monospace" }}
          >
            ID de cuenta
          </span>
          <span
            className="text-foreground"
            style={{ fontFamily: "'JetBrains Mono', monospace" }}
          >
            {id}
          </span>
        </div>
      </div>
    </div>
  )
}

function MetaIcon({ icon: Icon, label }: { icon: typeof Warehouse; label: string }) {
  return (
    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
      <Icon size={12} />
      <span>{label}</span>
    </div>
  )
}

function PillActivo() {
  return (
    <div className="inline-flex items-center gap-1.5 border border-secondary/30 bg-secondary/10 px-2 py-1" style={{ borderRadius: '0.25rem' }}>
      <span className="relative flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full rounded-full bg-secondary opacity-75 animate-ping" />
        <span className="relative inline-flex rounded-full h-2 w-2 bg-secondary" />
      </span>
      <span
        className="text-[10px] text-secondary uppercase tracking-widest"
        style={{ fontFamily: "'JetBrains Mono', monospace" }}
      >
        Activo
      </span>
    </div>
  )
}

function StatCell({ value, label }: { value: number; label: string }) {
  return (
    <div className="bg-card p-4 text-center">
      <div
        className="text-2xl text-foreground leading-none"
        style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900 }}
      >
        {value}
      </div>
      <div
        className="text-[9px] text-muted-foreground uppercase tracking-widest mt-1.5"
        style={{ fontFamily: "'JetBrains Mono', monospace" }}
      >
        {label}
      </div>
    </div>
  )
}

function CardSkeleton() {
  return <div className="bg-card border border-border h-48 animate-pulse" />
}

// ───────────────────────────────────────────────────────────────────
//  Tabs
// ───────────────────────────────────────────────────────────────────

function Tabs({ tab, setTab }: { tab: Tab; setTab: (t: Tab) => void }) {
  return (
    <div className="inline-flex items-center gap-1 p-1 bg-muted rounded-lg border border-border w-fit">
      <TabButton active={tab === 'info'} onClick={() => setTab('info')}>
        <UserIcon size={13} />
        Mi Perfil
      </TabButton>
      <TabButton active={tab === 'seguridad'} onClick={() => setTab('seguridad')}>
        <KeyRound size={13} />
        Seguridad
      </TabButton>
      <TabButton active={tab === 'notificaciones'} onClick={() => setTab('notificaciones')}>
        <BellRing size={13} />
        Notificaciones
      </TabButton>
      <TabButton active={tab === 'actividad'} onClick={() => setTab('actividad')}>
        <History size={13} />
        Actividad
      </TabButton>
    </div>
  )
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs transition-colors ${
        active
          ? 'bg-card text-foreground shadow-sm'
          : 'text-muted-foreground hover:text-foreground'
      }`}
      style={{ borderRadius: '0.25rem' }}
    >
      {children}
    </button>
  )
}

// ───────────────────────────────────────────────────────────────────
//  TAB: Mi Perfil
// ───────────────────────────────────────────────────────────────────

function TabInfo() {
  const [perfil, setPerfil] = useState<Perfil | null>(null)
  const [draft, setDraft] = useState<Perfil | null>(null)
  const [editMode, setEditMode] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api.get<Perfil>('/perfil').then((p) => {
      setPerfil(p)
      setDraft(p)
    })
  }, [])

  async function handleSave() {
    if (!draft) return
    setSaving(true)
    setError(null)
    try {
      const updated = await api.patch<Perfil>('/perfil', {
        nombre: draft.nombre,
        username: draft.username,
        email: draft.email,
        telefono: draft.telefono,
        cargo: draft.cargo,
      })
      setPerfil(updated)
      setDraft(updated)
      setEditMode(false)
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'No se pudo guardar')
    } finally {
      setSaving(false)
    }
  }

  function handleCancel() {
    if (perfil) setDraft(perfil)
    setEditMode(false)
  }

  if (!perfil || !draft) return <div className="text-sm text-muted-foreground">Cargando…</div>

  return (
    <div className="bg-card border border-border p-6 space-y-5">
      {/* Header de la card */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h3
            className="text-lg uppercase text-foreground leading-none"
            style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900 }}
          >
            Información personal
          </h3>
          <div
            className="text-[10px] text-muted-foreground uppercase tracking-widest mt-1"
            style={{ fontFamily: "'JetBrains Mono', monospace" }}
          >
            Editá los datos de tu cuenta
          </div>
        </div>
        {editMode ? (
          <div className="flex items-center gap-2">
            <button
              onClick={handleCancel}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-border text-xs hover:border-foreground/30 transition-colors"
              style={{ borderRadius: '0.25rem' }}
            >
              <X size={13} />
              Cancelar
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground text-xs font-semibold hover:opacity-90 transition-opacity disabled:opacity-60"
              style={{ borderRadius: '0.25rem' }}
            >
              <Save size={13} />
              {saving ? 'Guardando…' : 'Guardar'}
            </button>
          </div>
        ) : (
          <button
            onClick={() => setEditMode(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-border text-xs hover:border-foreground/30 transition-colors"
            style={{ borderRadius: '0.25rem' }}
          >
            <Pencil size={13} />
            Editar perfil
          </button>
        )}
      </div>

      {error && (
        <div className="text-xs text-primary bg-primary/10 border border-primary/20 px-3 py-2" style={{ borderRadius: '0.25rem' }}>
          ⚠ {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Field
          icon={UserIcon}
          label="Nombre completo"
          value={draft.nombre}
          editable={editMode}
          onChange={(v) => setDraft({ ...draft, nombre: v })}
        />
        <Field
          icon={AtSign}
          label="Nombre de usuario"
          value={draft.username}
          editable={editMode}
          onChange={(v) => setDraft({ ...draft, username: v })}
        />
        <Field
          icon={Mail}
          label="Correo electrónico"
          value={draft.email}
          editable={editMode}
          type="email"
          onChange={(v) => setDraft({ ...draft, email: v })}
        />
        <Field
          icon={Phone}
          label="Teléfono"
          value={draft.telefono}
          editable={editMode}
          placeholder="(agregar)"
          onChange={(v) => setDraft({ ...draft, telefono: v })}
        />
        <Field
          icon={UserCog}
          label="Cargo"
          value={draft.cargo}
          editable={editMode}
          placeholder="(agregar)"
          onChange={(v) => setDraft({ ...draft, cargo: v })}
        />
        <Field
          icon={ShieldCheck}
          label="Rol del sistema"
          value={perfil.rolNombre}
          editable={false}
        />
        <Field
          icon={Warehouse}
          label="Bodega asignada"
          value={perfil.bodega?.nombre ?? '—'}
          editable={false}
        />
        <Field
          icon={Building2}
          label="Empresa"
          value={perfil.empresa?.nombre ?? '—'}
          editable={false}
        />
      </div>
    </div>
  )
}

function Field({
  icon: Icon,
  label,
  value,
  editable,
  type = 'text',
  placeholder,
  onChange,
}: {
  icon: typeof UserIcon
  label: string
  value: string
  editable: boolean
  type?: string
  placeholder?: string
  onChange?: (v: string) => void
}) {
  return (
    <div>
      <label
        className="flex items-center gap-1.5 text-[10px] text-muted-foreground uppercase tracking-widest mb-1.5"
        style={{ fontFamily: "'JetBrains Mono', monospace" }}
      >
        <Icon size={11} />
        {label}
        {!editable && (
          <span
            className="ml-auto text-[9px] border border-border text-muted-foreground px-1.5 py-0.5"
            style={{ borderRadius: '0.15rem' }}
          >
            Solo lectura
          </span>
        )}
      </label>
      {editable ? (
        <input
          type={type}
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange?.(e.target.value)}
          className="w-full px-3 py-2.5 rounded border border-border bg-muted text-foreground text-sm outline-none focus:border-primary/60 transition-colors"
          style={{ borderRadius: '0.25rem' }}
        />
      ) : (
        <div className="w-full px-3 py-2.5 rounded border border-border/50 bg-muted/50 text-muted-foreground text-sm">
          {value || '—'}
        </div>
      )}
    </div>
  )
}

// ───────────────────────────────────────────────────────────────────
//  TAB: Seguridad
// ───────────────────────────────────────────────────────────────────

function TabSeguridad() {
  const [showPassForm, setShowPassForm] = useState(false)
  const [passSaved, setPassSaved] = useState(false)
  const [actual, setActual] = useState('')
  const [nueva, setNueva] = useState('')
  const [confirmar, setConfirmar] = useState('')
  const [visible, setVisible] = useState({ actual: false, nueva: false, confirmar: false })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [sesiones, setSesiones] = useState<SesionItem[]>([])
  const [sesionesLoading, setSesionesLoading] = useState(true)

  useEffect(() => {
    void cargarSesiones()
  }, [])

  async function cargarSesiones() {
    setSesionesLoading(true)
    try {
      const data = await api.get<SesionItem[]>('/perfil/sesiones')
      setSesiones(data)
    } catch {
      // silencioso
    } finally {
      setSesionesLoading(false)
    }
  }

  const nivel = calcularFortaleza(nueva)

  async function handleSavePass() {
    setError(null)
    if (!actual) { setError('Indicá tu contraseña actual.'); return }
    if (nueva.length < 8) { setError('La nueva contraseña debe tener al menos 8 caracteres.'); return }
    if (nueva !== confirmar) { setError('La confirmación no coincide.'); return }
    setSubmitting(true)
    try {
      await api.post('/perfil/password', { actual, nueva })
      setPassSaved(true)
      setActual('')
      setNueva('')
      setConfirmar('')
      // Como el back revoca TODAS las sesiones, refrescamos la lista
      void cargarSesiones()
      setTimeout(() => {
        setPassSaved(false)
        setShowPassForm(false)
      }, 1800)
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'No se pudo cambiar la contraseña.')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleCerrarSesion(id: string) {
    if (!confirm('¿Cerrar esta sesión?')) return
    try {
      await api.delete(`/perfil/sesiones/${id}`)
      setSesiones((s) => s.filter((x) => x.id !== id))
    } catch {
      // silencioso
    }
  }

  async function handleCerrarTodas() {
    if (!confirm('¿Cerrar todas las demás sesiones?')) return
    try {
      await api.delete('/perfil/sesiones')
      await cargarSesiones()
    } catch {
      // silencioso
    }
  }

  return (
    <div className="space-y-4">
      {/* Contraseña */}
      <div className="bg-card border border-border p-6">
        <div className="flex items-center justify-between gap-3 mb-4">
          <div>
            <h3
              className="text-lg uppercase text-foreground leading-none"
              style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900 }}
            >
              Contraseña
            </h3>
            <div
              className="text-[10px] text-muted-foreground uppercase tracking-widest mt-1"
              style={{ fontFamily: "'JetBrains Mono', monospace" }}
            >
              Cambiá tu clave de acceso
            </div>
          </div>
          {!showPassForm && (
            <button
              onClick={() => setShowPassForm(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-border text-xs hover:border-foreground/30 transition-colors"
              style={{ borderRadius: '0.25rem' }}
            >
              <KeyRound size={13} />
              Cambiar
            </button>
          )}
        </div>

        {!showPassForm ? (
          <div className="flex items-center justify-between text-sm">
            <div className="tracking-widest text-foreground" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
              ●●●●●●●●●●
            </div>
            <div
              className="text-xs text-muted-foreground"
              style={{ fontFamily: "'JetBrains Mono', monospace" }}
            >
              última act. — (no registrada)
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <PasswordInput
              label="Contraseña actual"
              value={actual}
              visible={visible.actual}
              onToggle={() => setVisible({ ...visible, actual: !visible.actual })}
              onChange={setActual}
            />
            <div>
              <PasswordInput
                label="Nueva contraseña"
                value={nueva}
                visible={visible.nueva}
                onToggle={() => setVisible({ ...visible, nueva: !visible.nueva })}
                onChange={setNueva}
              />
              {/* Indicador de fortaleza */}
              <div className="flex gap-1 mt-2">
                {[0, 1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className={`flex-1 h-1 rounded-full ${
                      i < nivel ? FortalezaColor(nivel) : 'bg-muted'
                    }`}
                  />
                ))}
              </div>
              <div
                className="text-[10px] text-muted-foreground mt-1 uppercase tracking-widest"
                style={{ fontFamily: "'JetBrains Mono', monospace" }}
              >
                {nueva.length === 0
                  ? 'Mínimo 8 caracteres'
                  : nivel <= 1
                    ? 'Débil'
                    : nivel === 2
                      ? 'Aceptable'
                      : nivel === 3
                        ? 'Fuerte'
                        : 'Muy fuerte'}
              </div>
            </div>
            <PasswordInput
              label="Confirmar contraseña"
              value={confirmar}
              visible={visible.confirmar}
              onToggle={() => setVisible({ ...visible, confirmar: !visible.confirmar })}
              onChange={setConfirmar}
            />

            {passSaved && (
              <div
                className="flex items-center gap-2 p-3 bg-secondary/10 border border-secondary/20"
                style={{ borderRadius: '0.25rem' }}
              >
                <CheckCircle2 size={14} className="text-secondary" />
                <p className="text-xs text-secondary">
                  Contraseña actualizada correctamente. Se cerraron todas las demás sesiones.
                </p>
              </div>
            )}

            {error && (
              <div
                className="text-xs text-primary bg-primary/10 border border-primary/20 px-3 py-2"
                style={{ borderRadius: '0.25rem' }}
              >
                ⚠ {error}
              </div>
            )}

            <div className="flex items-center gap-2 pt-2">
              <button
                onClick={() => { setShowPassForm(false); setError(null) }}
                className="px-3 py-1.5 border border-border text-xs hover:border-foreground/30 transition-colors"
                style={{ borderRadius: '0.25rem' }}
              >
                Cancelar
              </button>
              <button
                onClick={handleSavePass}
                disabled={submitting || passSaved}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground text-xs font-semibold hover:opacity-90 transition-opacity disabled:opacity-60"
                style={{ borderRadius: '0.25rem' }}
              >
                <Save size={13} />
                {submitting ? 'Guardando…' : 'Guardar contraseña'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 2FA */}
      <div className="bg-card border border-border p-6 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-muted flex items-center justify-center" style={{ borderRadius: '0.25rem' }}>
            <Shield size={18} className="text-muted-foreground" />
          </div>
          <div>
            <div className="text-sm text-foreground">Verificación en dos pasos</div>
            <div
              className="text-[10px] text-muted-foreground uppercase tracking-widest mt-0.5"
              style={{ fontFamily: "'JetBrains Mono', monospace" }}
            >
              Una capa extra de seguridad
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span
            className="text-[10px] px-2 py-1 bg-muted text-muted-foreground uppercase"
            style={{ borderRadius: '0.15rem', fontFamily: "'JetBrains Mono', monospace" }}
          >
            Desactivado
          </span>
          <button
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-secondary/15 text-secondary border border-secondary/20 text-xs hover:bg-secondary/25 transition-colors"
            style={{ borderRadius: '0.25rem' }}
          >
            Activar 2FA
          </button>
        </div>
      </div>

      {/* Sesiones activas */}
      <div className="bg-card border border-border p-6">
        <div className="flex items-center justify-between gap-3 mb-3">
          <div>
            <h3
              className="text-lg uppercase text-foreground leading-none"
              style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900 }}
            >
              Sesiones activas
            </h3>
            <div
              className="text-[10px] text-muted-foreground uppercase tracking-widest mt-1"
              style={{ fontFamily: "'JetBrains Mono', monospace" }}
            >
              {sesiones.length} {sesiones.length === 1 ? 'sesión abierta' : 'sesiones abiertas'}
            </div>
          </div>
          <button
            onClick={handleCerrarTodas}
            className="text-xs text-primary hover:underline"
            style={{ fontFamily: "'JetBrains Mono', monospace" }}
          >
            Cerrar todas las otras sesiones →
          </button>
        </div>

        {sesionesLoading ? (
          <div className="text-sm text-muted-foreground py-4">Cargando…</div>
        ) : sesiones.length === 0 ? (
          <EmptyState icon={Inbox} mensaje="No hay sesiones activas." />
        ) : (
          <ul className="divide-y divide-border">
            {sesiones.map((s) => {
              const Icon = /iPhone|iPad|Android/i.test(s.dispositivo) ? Smartphone : Monitor
              return (
                <li
                  key={s.id}
                  className="flex items-center gap-3 py-3"
                >
                  <Icon size={15} className="text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-foreground truncate">
                      {s.dispositivo} · {s.ubicacion}
                    </div>
                    <div
                      className="text-[10px] text-muted-foreground"
                      style={{ fontFamily: "'JetBrains Mono', monospace" }}
                    >
                      {new Date(s.hora).toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' })}
                    </div>
                  </div>
                  {s.current ? (
                    <span className="inline-flex items-center gap-1.5 text-[10px] text-secondary uppercase tracking-widest" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                      <span className="relative flex h-1.5 w-1.5">
                        <span className="absolute inline-flex h-full w-full rounded-full bg-secondary opacity-75 animate-ping" />
                        <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-secondary" />
                      </span>
                      Sesión actual
                    </span>
                  ) : (
                    <button
                      onClick={() => handleCerrarSesion(s.id)}
                      className="text-xs px-2 py-1 text-primary border border-primary/20 hover:bg-primary/10 transition-colors"
                      style={{ borderRadius: '0.15rem' }}
                    >
                      Cerrar sesión
                    </button>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}

function PasswordInput({
  label,
  value,
  visible,
  onToggle,
  onChange,
}: {
  label: string
  value: string
  visible: boolean
  onToggle: () => void
  onChange: (v: string) => void
}) {
  return (
    <div>
      <label
        className="text-[10px] text-muted-foreground uppercase tracking-widest mb-1.5 block"
        style={{ fontFamily: "'JetBrains Mono', monospace" }}
      >
        {label}
      </label>
      <div className="relative">
        <input
          type={visible ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full px-3 py-2.5 pr-10 bg-muted border border-border text-sm text-foreground outline-none focus:border-primary/60 transition-colors"
          style={{ borderRadius: '0.25rem', fontFamily: "'JetBrains Mono', monospace" }}
        />
        <button
          type="button"
          onClick={onToggle}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
        >
          {visible ? <EyeOff size={15} /> : <Eye size={15} />}
        </button>
      </div>
    </div>
  )
}

// ───────────────────────────────────────────────────────────────────
//  TAB: Notificaciones
// ───────────────────────────────────────────────────────────────────

function TabNotificaciones() {
  const [notifs, setNotifs] = useState<NotifMap | null>(null)
  const [saving, setSaving] = useState(false)
  const [savedAt, setSavedAt] = useState<number | null>(null)

  useEffect(() => {
    api.get<NotifMap>('/perfil/notificaciones').then(setNotifs)
  }, [])

  const total = NOTIF_GRUPOS.reduce((acc, g) => acc + g.items.length, 0)
  const activas = notifs
    ? NOTIF_GRUPOS.reduce(
        (acc, g) => acc + g.items.filter((it) => notifs[it.key]).length,
        0,
      )
    : 0

  async function persistir(nuevoEstado: NotifMap) {
    setSaving(true)
    try {
      const server = await api.patch<NotifMap>('/perfil/notificaciones', nuevoEstado)
      setNotifs(server)
      setSavedAt(Date.now())
      setTimeout(() => setSavedAt(null), 1500)
    } finally {
      setSaving(false)
    }
  }

  function toggle(key: NotifKey) {
    if (!notifs) return
    const next = { ...notifs, [key]: !notifs[key] }
    setNotifs(next)
    void persistir(next)
  }

  function desactivarTodas() {
    if (!notifs) return
    const next = Object.fromEntries(
      Object.keys(notifs).map((k) => [k, false]),
    ) as NotifMap
    setNotifs(next)
    void persistir(next)
  }

  if (!notifs) return <div className="text-sm text-muted-foreground">Cargando…</div>

  return (
    <div className="bg-card border border-border">
      <div className="flex items-center justify-between p-4 border-b border-border gap-3 flex-wrap">
        <div
          className="text-[10px] text-muted-foreground uppercase tracking-widest"
          style={{ fontFamily: "'JetBrains Mono', monospace" }}
        >
          {activas} de {total} notificaciones activas
          {saving && <span className="ml-2 text-foreground">· guardando…</span>}
          {savedAt && <span className="ml-2 text-secondary">· guardado ✓</span>}
        </div>
        <button
          onClick={desactivarTodas}
          disabled={activas === 0}
          className="text-xs text-primary border border-primary/20 px-2 py-1 hover:bg-primary/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ borderRadius: '0.15rem' }}
        >
          Desactivar todas
        </button>
      </div>

      {NOTIF_GRUPOS.map((g) => (
        <div key={g.grupo} className="border-b border-border last:border-b-0">
          <div
            className="px-4 py-2 bg-muted/30 border-b border-border text-[10px] text-muted-foreground uppercase tracking-widest"
            style={{ fontFamily: "'JetBrains Mono', monospace" }}
          >
            {g.grupo}
          </div>
          <ul className="divide-y divide-border">
            {g.items.map((it) => (
              <li
                key={it.key}
                className="flex items-center gap-3 px-4 py-3 hover:bg-muted/20 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-foreground">{it.label}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{it.desc}</div>
                </div>
                <button
                  onClick={() => toggle(it.key)}
                  className="shrink-0"
                  aria-label={notifs[it.key] ? 'Desactivar' : 'Activar'}
                >
                  {notifs[it.key] ? (
                    <ToggleRight size={24} className="text-secondary" />
                  ) : (
                    <ToggleLeft size={24} className="text-muted-foreground" />
                  )}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  )
}

// ───────────────────────────────────────────────────────────────────
//  TAB: Actividad
// ───────────────────────────────────────────────────────────────────

function TabActividad() {
  const [items, setItems] = useState<ActividadItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api
      .get<ActividadItem[]>('/perfil/actividad?limit=50')
      .then(setItems)
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="text-sm text-muted-foreground">Cargando…</div>

  return (
    <div className="bg-card border border-border">
      {items.length === 0 ? (
        <EmptyState icon={Inbox} mensaje="Sin actividad reciente." />
      ) : (
        <ul className="divide-y divide-border">
          {items.map((a, i) => (
            <li
              key={i}
              className="flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors"
            >
              <div className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium text-foreground">{a.accion}</span>
                  <span
                    className="text-xs border border-border rounded px-1.5 py-0.5 text-muted-foreground"
                  >
                    {a.modulo}
                  </span>
                </div>
                <div
                  className="text-[10px] text-muted-foreground mt-0.5 flex items-center gap-1"
                  style={{ fontFamily: "'JetBrains Mono', monospace" }}
                >
                  {a.ip} · {a.dispositivo}
                </div>
              </div>
              <div
                className="text-xs text-muted-foreground shrink-0"
                style={{ fontFamily: "'JetBrains Mono', monospace" }}
              >
                {new Date(a.fecha).toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' })}
              </div>
            </li>
          ))}
        </ul>
      )}
      <div className="p-3 border-t border-border text-center">
        <a
          href="#"
          onClick={(e) => e.preventDefault()}
          className="text-xs text-primary hover:underline"
          style={{ fontFamily: "'JetBrains Mono', monospace" }}
        >
          Ver historial completo →
        </a>
      </div>
    </div>
  )
}

// ───────────────────────────────────────────────────────────────────
//  Helpers
// ───────────────────────────────────────────────────────────────────

function EmptyState({ icon: Icon, mensaje }: { icon: typeof Inbox; mensaje: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-2">
      <Icon size={28} />
      <p className="text-sm">{mensaje}</p>
    </div>
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

/** Devuelve 0..4 según la fortaleza de la contraseña. */
function calcularFortaleza(p: string): number {
  if (!p) return 0
  let score = 0
  if (p.length >= 8) score++
  if (p.length >= 12) score++
  if (/[A-Z]/.test(p) && /[a-z]/.test(p)) score++
  if (/\d/.test(p) && /[^A-Za-z0-9]/.test(p)) score++
  return Math.min(score, 4)
}

function FortalezaColor(nivel: number): string {
  if (nivel <= 1) return 'bg-primary'
  if (nivel === 2) return 'bg-yellow-400'
  return 'bg-secondary'
}
