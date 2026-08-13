import { useState, useEffect, useCallback } from 'react'
import {
  Users,
  UserCheck,
  UserX,
  Wrench,
  Plus,
  Search,
  Pencil,
  KeyRound,
  Trash2,
  ShieldCheck,
  Inbox,
  CircleAlert,
  RotateCcw,
  Mail,
  Building2,
  ChevronRight,
} from 'lucide-react'
import {
  useUsuarios,
  usuariosStore,
  type EstadoUsuario,
  type RolUsuario,
  type Usuario,
} from '../store/usuarios'
import { EditarUsuarioModal } from './EditarUsuarioModal'
import { CrearUsuarioModal } from './CrearUsuarioModal'
import { CambiarPasswordModal } from './CambiarPasswordModal'
import { PageHeader } from './PageHeader'
import { permisosStore } from '../store/permisos'
import { useBodegaActiva } from '../store/bodegaActiva'
import { Pagination } from './Pagination'
import { Modal } from './Modal'

const DEFAULT_PAGE_SIZE = 10

export function Usuarios() {
  const { usuarios, estado } = useUsuarios()
  const activaId = useBodegaActiva()
  const [query, setQuery] = useState('')
  const [confirmDelete, setConfirmDelete] = useState<Usuario | null>(null)
  const [editing, setEditing] = useState<Usuario | null>(null)
  const [changingPass, setChangingPass] = useState<Usuario | null>(null)
  const [creating, setCreating] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')
  const [detalle, setDetalle] = useState<Usuario | null>(null)

  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE)

  const cargar = useCallback(
    (override?: { page?: number; buscar?: string; bodegaId?: string | null }) => {
      const nextPage = override?.page ?? page
      const nextBuscar = override?.buscar !== undefined ? override.buscar : query
      // Por defecto filtramos por la bodega activa. Pasale `bodegaId: null`
      // explícito para traer TODOS los usuarios del tenant.
      const nextBodegaId =
        override?.bodegaId !== undefined ? override.bodegaId : activaId
      void usuariosStore
        .cargarPaginado({
          buscar: nextBuscar || undefined,
          bodegaId: nextBodegaId || undefined,
          page: nextPage,
          pageSize,
        })
        .catch(() => undefined)
    },
    [page, pageSize, query, activaId],
  )

  // Cargar usuarios + roles del back al montar y al cambiar de bodega activa
  useEffect(() => {
    setPage(1)
    void usuariosStore
      .cargarPaginado({
        bodegaId: activaId || undefined,
        page: 1,
        pageSize,
      })
      .catch(() => undefined)
    if (permisosStore.estado().status === 'idle') {
      void permisosStore.cargar().catch(() => undefined)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageSize, activaId])

  // Debounce del search → reset a page 1
  useEffect(() => {
    const t = setTimeout(() => {
      setPage(1)
      void usuariosStore
        .cargarPaginado({
          buscar: query || undefined,
          bodegaId: activaId || undefined,
          page: 1,
          pageSize,
        })
        .catch(() => undefined)
    }, 300)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query])

  // Cuando cambia la página, refetch
  useEffect(() => {
    if (estado.status === 'idle') return
    cargar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page])

  const total = estado.status === 'listo' ? estado.total : 0
  const totalPages = estado.status === 'listo' ? estado.totalPages : 0

  const activos = usuarios.filter((u) => u.estado === 'Activo').length
  const inactivos = usuarios.filter((u) => u.estado === 'Inactivo').length
  const rolesEnUso = new Set(usuarios.map((u) => u.rol).filter(Boolean)).size

  async function handleDelete(u: Usuario) {
    if (deleting) return
    setDeleting(true)
    setDeleteError('')
    try {
      await usuariosStore.eliminar(u.id)
      setConfirmDelete(null)
      cargar()
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : 'No se pudo eliminar el usuario.'
      setDeleteError(msg)
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="flex-1 flex flex-col min-w-0 min-h-0">
      <PageHeader
        title="Gestión de Usuarios"
        subtitle="BodegaApliSmart · ROLES Y PERMISOS"
        actions={
          <button
            onClick={() => setCreating(true)}
            className="hidden lg:inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground text-xs font-medium hover:opacity-90 transition-opacity"
            style={{ borderRadius: '0.25rem' }}
          >
            <Plus size={13} />
            Nuevo Usuario
          </button>
        }
      />

      <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatTile
            icon={Users}
            iconClass="text-primary"
            label="Total Usuarios"
            value={String(total)}
          />
          <StatTile
            icon={UserCheck}
            iconClass="text-secondary"
            label="Activos"
            value={String(activos)}
          />
          <StatTile
            icon={UserX}
            iconClass="text-muted-foreground"
            label="Inactivos"
            value={String(inactivos)}
          />
          <StatTile
            icon={Wrench}
            iconClass="text-primary"
            label="Roles en uso"
            value={String(rolesEnUso)}
          />
        </div>

        {/* Botón "Nuevo Usuario" mobile: debajo de las cards KPI.
            En desktop el header ya tiene su botón, así que lo ocultamos. */}
        <button
          onClick={() => setCreating(true)}
          className="lg:hidden w-full inline-flex items-center justify-center gap-1.5 min-h-11 bg-primary text-primary-foreground text-sm font-semibold active:scale-[0.98] transition-transform"
          style={{ borderRadius: '0.25rem' }}
        >
          <Plus size={15} />
          Nuevo Usuario
        </button>

        <div className="relative">
          <Search
            size={15}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por nombre, email o rol…"
            className="w-full pl-9 pr-4 py-2.5 bg-card border border-border text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/60 transition-colors"
            style={{ borderRadius: '0.25rem', fontFamily: "'DM Sans', sans-serif" }}
          />
        </div>

        {/* ESTADOS DE CARGA / ERROR */}
        {(estado.status === 'idle' || estado.status === 'cargando') && usuarios.length === 0 && (
          <div className="bg-card border border-border p-8 flex items-center justify-center gap-3"
            style={{ borderRadius: '0.25rem' }}
          >
            <span
              className="w-4 h-4 border-2 border-primary/40 border-t-primary rounded-full animate-spin"
              aria-hidden
            />
            <span className="text-sm text-muted-foreground" style={{ fontFamily: "'DM Sans', sans-serif" }}>
              Cargando usuarios desde el servidor…
            </span>
          </div>
        )}

        {estado.status === 'error' && (
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
                No se pudieron cargar los usuarios
              </p>
              <p
                className="mt-0.5 text-xs text-muted-foreground"
                style={{ fontFamily: "'JetBrains Mono', monospace" }}
              >
                {estado.mensaje}
              </p>
            </div>
            <button
              onClick={() => cargar()}
              className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
              style={{ fontFamily: "'JetBrains Mono', monospace" }}
            >
              <RotateCcw size={11} />
              Reintentar
            </button>
          </div>
        )}

        {/* LISTA / VACÍO */}
        {estado.status === 'listo' && usuarios.length === 0 && (
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
              Sin usuarios
            </h3>
            <p
              className="mt-2 text-sm text-muted-foreground max-w-sm"
              style={{ fontFamily: "'DM Sans', sans-serif" }}
            >
              {query
                ? 'Ningún usuario coincide con la búsqueda.'
                : 'Cuando crees usuarios desde el botón "Nuevo Usuario", aparecerán acá.'}
            </p>
          </div>
        )}

        {usuarios.length > 0 && (
          <div
            className="bg-card border border-border overflow-hidden"
            style={{ borderRadius: '0.25rem' }}
          >
            {/* MOBILE: lista de filas-tap que abren el modal de detalle */}
            <ul className="sm:hidden divide-y divide-border">
              {usuarios.map((u) => (
                <li key={u.id}>
                  <button
                    type="button"
                    onClick={() => setDetalle(u)}
                    className="w-full text-left p-3 flex items-center gap-3 hover:bg-muted/30 active:bg-muted/50 transition-colors"
                  >
                    <div className="w-9 h-9 bg-primary/15 flex items-center justify-center shrink-0">
                      <span
                        className="text-primary text-xs"
                        style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800 }}
                      >
                        {getInitials(u.nombre)}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div
                        className="text-sm text-foreground truncate"
                        style={{ fontFamily: "'DM Sans', sans-serif", fontWeight: 500 }}
                      >
                        {u.nombre}
                      </div>
                      <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                        <RolBadgeSmall rol={u.rol} rolNombre={u.rolNombre} />
                        <EstadoBadgeSmall estado={u.estado} />
                      </div>
                    </div>
                    <ChevronRight size={16} className="text-muted-foreground shrink-0" />
                  </button>
                </li>
              ))}
            </ul>

            {/* DESKTOP: tabla con todas las columnas */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead>
                  <tr
                    className="border-b border-border bg-muted/30"
                    style={{ fontFamily: "'JetBrains Mono', monospace" }}
                  >
                    <Th>Nombre</Th>
                    <Th>Email</Th>
                    <Th>Rol</Th>
                    <Th>Estado</Th>
                    <Th className="text-right">Acciones</Th>
                  </tr>
                </thead>
                <tbody>
                  {usuarios.map((u) => (
                    <tr
                      key={u.id}
                      className="border-b border-border last:border-b-0 hover:bg-muted/30 transition-colors"
                    >
                      <Td>
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 bg-primary/15 flex items-center justify-center shrink-0">
                            <span
                              className="text-primary text-xs"
                              style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800 }}
                            >
                              {getInitials(u.nombre)}
                            </span>
                          </div>
                          <div className="flex flex-col">
                            <span
                              className="text-sm text-foreground"
                              style={{ fontFamily: "'DM Sans', sans-serif", fontWeight: 500 }}
                            >
                              {u.nombre}
                            </span>
                            {u.bodegaNombre && (
                              <span
                                className="text-[10px] text-muted-foreground"
                                style={{ fontFamily: "'JetBrains Mono', monospace" }}
                              >
                                {u.bodegaNombre}
                              </span>
                            )}
                          </div>
                        </div>
                      </Td>
                      <Td>
                        <span
                          className="text-sm text-muted-foreground"
                          style={{ fontFamily: "'JetBrains Mono', monospace" }}
                        >
                          {u.email}
                        </span>
                      </Td>
                      <Td>
                        <RolBadge rol={u.rol} rolNombre={u.rolNombre} />
                      </Td>
                      <Td>
                        <EstadoBadge estado={u.estado} />
                      </Td>
                      <Td>
                        <div className="flex items-center justify-end gap-1.5">
                          <IconAction
                            label="Editar"
                            onClick={() => setEditing(u)}
                          >
                            <Pencil size={14} />
                          </IconAction>
                          <IconAction
                            label="Cambiar contraseña"
                            hoverClass="hover:border-secondary/40 hover:text-secondary"
                            onClick={() => setChangingPass(u)}
                          >
                            <KeyRound size={14} />
                          </IconAction>
                          <IconAction
                            label="Eliminar"
                            hoverClass="hover:border-primary/40 hover:text-primary"
                            onClick={() => setConfirmDelete(u)}
                          >
                            <Trash2 size={14} />
                          </IconAction>
                        </div>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination
              page={page}
              totalPages={totalPages}
              total={total}
              pageSize={pageSize}
              onChange={setPage}
              onPageSizeChange={(s) => {
                setPageSize(s)
                setPage(1)
              }}
              disabled={estado.status === 'cargando'}
            />
          </div>
        )}
      </div>

      {creating && (
        <CrearUsuarioModal
          onClose={() => setCreating(false)}
          onCreated={(u) => {
            setCreating(false)
            cargar()
            console.info('Usuario creado:', u.nombre)
          }}
        />
      )}

      {editing && (
        <EditarUsuarioModal
          usuario={editing}
          onClose={() => setEditing(null)}
        />
      )}

      {changingPass && (
        <CambiarPasswordModal
          usuario={changingPass}
          onClose={() => setChangingPass(null)}
        />
      )}

      {detalle && (
        <Modal
          open
          onClose={() => setDetalle(null)}
          title={detalle.nombre}
          description="Detalle del usuario"
          icon={
            <div className="w-9 h-9 bg-primary/15 flex items-center justify-center">
              <span
                className="text-primary text-sm"
                style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800 }}
              >
                {getInitials(detalle.nombre)}
              </span>
            </div>
          }
          size="md"
          footer={
            <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
              <button
                type="button"
                onClick={() => {
                  setEditing(detalle)
                  setDetalle(null)
                }}
                className="flex-1 inline-flex items-center justify-center gap-2 min-h-11 border border-border text-sm text-foreground hover:border-foreground/30 transition-colors"
                style={{ borderRadius: '0.25rem' }}
              >
                <Pencil size={14} />
                Editar
              </button>
              <button
                type="button"
                onClick={() => {
                  setChangingPass(detalle)
                  setDetalle(null)
                }}
                className="flex-1 inline-flex items-center justify-center gap-2 min-h-11 border border-secondary/40 text-sm text-secondary hover:bg-secondary/10 transition-colors"
                style={{ borderRadius: '0.25rem' }}
              >
                <KeyRound size={14} />
                Cambiar contraseña
              </button>
              <button
                type="button"
                onClick={() => {
                  setConfirmDelete(detalle)
                  setDetalle(null)
                }}
                className="flex-1 inline-flex items-center justify-center gap-2 min-h-11 bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors"
                style={{ borderRadius: '0.25rem' }}
              >
                <Trash2 size={14} />
                Eliminar
              </button>
            </div>
          }
        >
          <div className="px-4 sm:px-5 py-5 space-y-4">
            <DetailField icon={<Mail size={14} />} label="Email">
              <span
                className="text-sm text-foreground break-all"
                style={{ fontFamily: "'JetBrains Mono', monospace" }}
              >
                {detalle.email}
              </span>
            </DetailField>
            {detalle.bodegaNombre && (
              <DetailField icon={<Building2 size={14} />} label="Bodega">
                <span
                  className="text-sm text-foreground"
                  style={{ fontFamily: "'DM Sans', sans-serif" }}
                >
                  {detalle.bodegaNombre}
                </span>
              </DetailField>
            )}
            <DetailField icon={<ShieldCheck size={14} />} label="Rol">
              <RolBadge rol={detalle.rol} rolNombre={detalle.rolNombre} />
            </DetailField>
            <DetailField icon={<UserCheck size={14} />} label="Estado">
              <EstadoBadge estado={detalle.estado} />
            </DetailField>
          </div>
        </Modal>
      )}

      {confirmDelete && (
        <Modal
          open
          onClose={() => !deleting && setConfirmDelete(null)}
          title="Eliminar usuario"
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
                onClick={() => void handleDelete(confirmDelete)}
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
          <div className="p-5 space-y-3">
            <p
              className="text-sm text-muted-foreground"
              style={{ fontFamily: "'DM Sans', sans-serif" }}
            >
              ¿Seguro que querés eliminar a{' '}
              <span className="text-foreground font-medium">{confirmDelete.nombre}</span>?
              Esta acción no se puede deshacer.
            </p>
            {deleteError && (
              <p
                className="text-xs text-primary bg-primary/10 border border-primary/20 px-3 py-2"
                style={{ fontFamily: "'JetBrains Mono', monospace", borderRadius: '0.25rem' }}
              >
                ⚠ {deleteError}
              </p>
            )}
          </div>
        </Modal>
      )}
    </div>
  )
}

function Th({
  children,
  className = '',
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <th
      className={`text-left px-4 py-3 text-[10px] text-muted-foreground tracking-widest uppercase font-normal ${className}`}
    >
      {children}
    </th>
  )
}

function Td({ children }: { children: React.ReactNode }) {
  return <td className="px-4 py-3 align-top">{children}</td>
}

function StatTile({
  icon: Icon,
  iconClass,
  label,
  value,
}: {
  icon: typeof Users
  iconClass: string
  label: string
  value: string
}) {
  return (
    <div
      className="bg-card border border-border p-4 flex items-center gap-3"
      style={{ borderRadius: '0.25rem' }}
    >
      <div className="w-9 h-9 bg-muted flex items-center justify-center shrink-0">
        <Icon size={16} className={iconClass} />
      </div>
      <div className="min-w-0">
        <div
          className="text-[10px] text-muted-foreground uppercase tracking-widest leading-tight"
          style={{ fontFamily: "'JetBrains Mono', monospace" }}
        >
          {label}
        </div>
        <div
          className="text-2xl text-foreground leading-tight mt-0.5"
          style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800 }}
        >
          {value}
        </div>
      </div>
    </div>
  )
}

function RolBadge({ rol, rolNombre }: { rol: RolUsuario; rolNombre?: string }) {
  // Como los roles son custom, mostramos el `rolNombre` (que viene del
  // back con el label legible) o, en su defecto, el `key` en mayúsculas.
  const label = rolNombre?.trim() || rol.toUpperCase() || '—'
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] border border-primary/40 text-primary bg-primary/10"
      style={{
        borderRadius: '0.15rem',
        fontFamily: "'JetBrains Mono', monospace",
        fontWeight: 500,
        letterSpacing: '0.05em',
      }}
    >
      <ShieldCheck size={10} />
      {label}
    </span>
  )
}

function EstadoBadge({ estado }: { estado: EstadoUsuario }) {
  const isActive = estado === 'Activo'
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 text-[10px] border ${
        isActive
          ? 'border-secondary/40 text-secondary bg-secondary/10'
          : 'border-muted text-muted-foreground bg-muted/30'
      }`}
      style={{
        borderRadius: '0.15rem',
        fontFamily: "'JetBrains Mono', monospace",
        fontWeight: 500,
      }}
    >
      {estado}
    </span>
  )
}

function RolBadgeSmall({ rol, rolNombre }: { rol: RolUsuario; rolNombre?: string }) {
  const label = rolNombre?.trim() || rol.toUpperCase() || '—'
  return (
    <span
      className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[9px] border border-primary/40 text-primary bg-primary/10"
      style={{
        borderRadius: '0.15rem',
        fontFamily: "'JetBrains Mono', monospace",
        fontWeight: 500,
        letterSpacing: '0.05em',
      }}
    >
      {label}
    </span>
  )
}

function EstadoBadgeSmall({ estado }: { estado: EstadoUsuario }) {
  const isActive = estado === 'Activo'
  return (
    <span
      className={`inline-flex items-center px-1.5 py-0.5 text-[9px] border ${
        isActive
          ? 'border-secondary/40 text-secondary bg-secondary/10'
          : 'border-muted text-muted-foreground bg-muted/30'
      }`}
      style={{
        borderRadius: '0.15rem',
        fontFamily: "'JetBrains Mono', monospace",
        fontWeight: 500,
      }}
    >
      {estado}
    </span>
  )
}

function DetailField({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="w-7 h-7 bg-muted flex items-center justify-center shrink-0 text-muted-foreground">
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <div
          className="text-[10px] text-muted-foreground uppercase tracking-widest leading-none mb-1"
          style={{ fontFamily: "'JetBrains Mono', monospace" }}
        >
          {label}
        </div>
        {children}
      </div>
    </div>
  )
}

function IconAction({
  children,
  label,
  hoverClass = 'hover:border-foreground/40 hover:text-foreground',
  onClick,
}: {
  children: React.ReactNode
  label: string
  hoverClass?: string
  onClick?: () => void
}) {
  return (
    <button
      onClick={onClick}
      title={label}
      className={`w-8 h-8 border border-border text-muted-foreground transition-colors flex items-center justify-center ${hoverClass}`}
      style={{ borderRadius: '0.25rem' }}
    >
      {children}
    </button>
  )
}

function getInitials(nombre: string) {
  return nombre
    .split(' ')
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase()
}
