import { useEffect, useState } from 'react'
import {
  Building2,
  Users as UsersIcon,
  Package,
  ClipboardList,
  AlertTriangle,
  Boxes,
  Crown,
  ExternalLink,
  Loader2,
  RefreshCw,
} from 'lucide-react'
import { api } from '../lib/api'
import { tenantActivoStore, useTenantActivo } from '../store/tenantActivo'
import { useAuth } from '../store/auth'

type Bodega = { id: string; nombre: string; direccion: string | null; createdAt: string }
type Metricas = {
  usuarios: number
  bodegas: number
  productos: number
  pedidos: number
  alertas: number
  kits: number
}
type Tenant = {
  id: string
  nombre: string
  email: string
  estado: 'Activo' | 'Inactivo'
  createdAt: string
  bodegas: Bodega[]
  metricas: Metricas
}

/**
 * Vista `/admin/tenants` — solo accesible para superadmin.
 *
 * Muestra la lista de admins del sistema (cada uno es un tenant) con:
 *  - Datos básicos: nombre, email, fecha de creación, estado
 *  - Lista de bodegas que administra
 *  - Métricas: usuarios, bodegas, productos, pedidos, alertas, kits
 *
 * Por ahora, esta vista es READ-ONLY. Más adelante se va a poder:
 *  - Crear tenants nuevos
 *  - Editar admins
 *  - Dar de baja tenants
 *  - Switchear "ver como este tenant" (el selector de tenantActivo)
 */
export function AdminTenants() {
  const auth = useAuth()
  const [tenants, setTenants] = useState<Tenant[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  async function cargar() {
    setLoading(true)
    setError(null)
    try {
      const data = await api.get<Tenant[]>('/admin/tenants')
      setTenants(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cargar la lista de tenants.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void cargar()
  }, [])

  const esSuperadmin =
    auth.status === 'autenticado' && auth.sesion.usuario.rol === 'superadmin'

  return (
    <div className="h-full w-full overflow-y-auto bg-background">
      <div className="max-w-7xl mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <div
              className="text-[10px] text-muted-foreground tracking-widest uppercase mb-1"
              style={{ fontFamily: "'JetBrains Mono', monospace" }}
            >
              Panel de administración
            </div>
            <h1
              className="text-3xl uppercase text-foreground leading-none"
              style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900 }}
            >
              Tenants
            </h1>
            <p
              className="text-sm text-muted-foreground mt-2 max-w-2xl"
              style={{ fontFamily: "'DM Sans', sans-serif" }}
            >
              Cada tenant es un admin dueño de su empresa. Acá ves todos los
              tenants del sistema, sus bodegas y métricas básicas.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void cargar()}
              disabled={loading}
              className="inline-flex items-center gap-2 px-3 py-2 border border-border text-sm hover:border-foreground/30 transition-colors disabled:opacity-50"
              style={{ borderRadius: '0.25rem', fontFamily: "'DM Sans', sans-serif" }}
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
              Refrescar
            </button>
          </div>
        </div>

        {/* Banner: el superadmin no tiene bodega asignada */}
        {esSuperadmin && (
          <div
            className="flex items-start gap-3 p-4 bg-secondary/5 border border-secondary/20"
            style={{ borderRadius: '0.25rem' }}
          >
            <Crown size={18} className="text-secondary shrink-0 mt-0.5" />
            <div
              className="text-sm text-foreground"
              style={{ fontFamily: "'DM Sans', sans-serif" }}
            >
              Estás navegando como <strong>superadmin</strong>. Tu cuenta no está
              asociada a ninguna bodega. El selector de tenant activo arriba a la
              derecha te permite elegir desde qué tenant ver los datos cuando
              navegues a un módulo.
            </div>
          </div>
        )}

        {/* Loading / error / list */}
        {loading && !tenants ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 size={20} className="text-primary animate-spin" />
          </div>
        ) : error ? (
          <div
            className="bg-primary/5 border border-primary/20 p-6 text-center"
            style={{ borderRadius: '0.25rem' }}
          >
            <AlertTriangle size={20} className="text-primary mx-auto mb-2" />
            <p
              className="text-sm text-foreground"
              style={{ fontFamily: "'DM Sans', sans-serif" }}
            >
              {error}
            </p>
            <button
              type="button"
              onClick={() => void cargar()}
              className="mt-3 px-3 py-1.5 bg-primary text-primary-foreground text-sm hover:bg-primary/90"
              style={{ borderRadius: '0.25rem' }}
            >
              Reintentar
            </button>
          </div>
        ) : tenants && tenants.length === 0 ? (
          <div
            className="bg-muted/30 border border-border p-12 text-center"
            style={{ borderRadius: '0.25rem' }}
          >
            <Building2 size={32} className="text-muted-foreground mx-auto mb-3" />
            <p
              className="text-sm text-muted-foreground"
              style={{ fontFamily: "'DM Sans', sans-serif" }}
            >
              No hay tenants todavía. Los admins se crean desde aquí o por seed.
            </p>
          </div>
        ) : (
          tenants && <TenantsGrid tenants={tenants} />
        )}

        {/* Footer: el selector de tenant activo */}
        {esSuperadmin && (
          <TenantActivoSelector />
        )}
      </div>
    </div>
  )
}

function TenantsGrid({ tenants }: { tenants: Tenant[] }) {
  return (
    <div className="space-y-3">
      <div
        className="text-[10px] text-muted-foreground tracking-widest uppercase"
        style={{ fontFamily: "'JetBrains Mono', monospace" }}
      >
        {tenants.length} tenant{tenants.length === 1 ? '' : 's'}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {tenants.map((t) => (
          <TenantCard key={t.id} tenant={t} />
        ))}
      </div>
    </div>
  )
}

function TenantCard({ tenant }: { tenant: Tenant }) {
  const tenantActivo = useTenantActivo()
  const esActivo =
    tenantActivo.kind === 'admin' && tenantActivo.adminId === tenant.id
  const t = tenantActivoStore

  return (
    <div
      className={`bg-card border ${
        esActivo ? 'border-secondary' : 'border-border'
      } p-4 space-y-4`}
      style={{ borderRadius: '0.25rem' }}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0 flex-1">
          <div className="w-10 h-10 bg-primary/15 flex items-center justify-center shrink-0">
            <Crown size={18} className="text-primary" />
          </div>
          <div className="min-w-0 flex-1">
            <div
              className="text-base text-foreground truncate"
              style={{ fontFamily: "'DM Sans', sans-serif", fontWeight: 600 }}
            >
              {tenant.nombre}
            </div>
            <div
              className="text-[10px] text-muted-foreground truncate"
              style={{ fontFamily: "'JetBrains Mono', monospace" }}
            >
              {tenant.email}
            </div>
            <div className="flex items-center gap-2 mt-1">
              <span
                className={`text-[9px] uppercase tracking-widest px-2 py-0.5 border ${
                  tenant.estado === 'Activo'
                    ? 'text-secondary border-secondary/30'
                    : 'text-primary border-primary/30'
                }`}
                style={{ borderRadius: '0.125rem', fontFamily: "'JetBrains Mono', monospace" }}
              >
                {tenant.estado}
              </span>
              {esActivo && (
                <span
                  className="text-[9px] uppercase tracking-widest px-2 py-0.5 bg-secondary text-secondary-foreground"
                  style={{ borderRadius: '0.125rem', fontFamily: "'JetBrains Mono', monospace" }}
                >
                  Activo
                </span>
              )}
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={() => (esActivo ? t.setNinguno() : t.setAdmin(tenant.id))}
          className={`shrink-0 px-2.5 py-1 text-[10px] uppercase tracking-widest border transition-colors ${
            esActivo
              ? 'border-secondary text-secondary-foreground bg-secondary hover:bg-secondary/90'
              : 'border-border text-foreground hover:border-secondary/50'
          }`}
          style={{ borderRadius: '0.125rem', fontFamily: "'JetBrains Mono', monospace" }}
        >
          {esActivo ? 'Desactivar' : 'Activar'}
        </button>
      </div>

      {/* Métricas */}
      <div className="grid grid-cols-3 gap-2">
        <Metrica icon={UsersIcon} label="Usuarios" value={tenant.metricas.usuarios} />
        <Metrica icon={Building2} label="Bodegas" value={tenant.metricas.bodegas} />
        <Metrica icon={Package} label="Productos" value={tenant.metricas.productos} />
        <Metrica icon={ClipboardList} label="Pedidos" value={tenant.metricas.pedidos} />
        <Metrica icon={AlertTriangle} label="Alertas" value={tenant.metricas.alertas} />
        <Metrica icon={Boxes} label="Kits" value={tenant.metricas.kits} />
      </div>

      {/* Bodegas */}
      {tenant.bodegas.length > 0 && (
        <div>
          <div
            className="text-[10px] text-muted-foreground uppercase tracking-widest mb-1.5"
            style={{ fontFamily: "'JetBrains Mono', monospace" }}
          >
            Bodegas ({tenant.bodegas.length})
          </div>
          <ul className="space-y-1">
            {tenant.bodegas.map((b) => (
              <li
                key={b.id}
                className="flex items-center justify-between text-xs bg-muted/30 border border-border px-2.5 py-1.5"
                style={{ borderRadius: '0.25rem' }}
              >
                <span
                  className="truncate text-foreground"
                  style={{ fontFamily: "'DM Sans', sans-serif" }}
                >
                  {b.nombre}
                </span>
                {b.direccion && (
                  <span
                    className="text-[10px] text-muted-foreground truncate ml-2 shrink-0"
                    style={{ fontFamily: "'JetBrains Mono', monospace" }}
                  >
                    {b.direccion}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Footer con link al detalle (placeholder por ahora) */}
      <div
        className="text-[10px] text-muted-foreground flex items-center gap-1.5 pt-2 border-t border-border"
        style={{ fontFamily: "'JetBrains Mono', monospace" }}
      >
        <span>Creado el {new Date(tenant.createdAt).toLocaleDateString('es-CO')}</span>
        <span className="text-border">·</span>
        <button
          type="button"
          disabled
          className="inline-flex items-center gap-1 text-muted-foreground/60 cursor-not-allowed"
          title="Próximamente: ver detalle del tenant"
        >
          Ver detalle <ExternalLink size={10} />
        </button>
      </div>
    </div>
  )
}

function Metrica({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Building2
  label: string
  value: number
}) {
  return (
    <div
      className="bg-muted/30 border border-border p-2"
      style={{ borderRadius: '0.25rem' }}
    >
      <div
        className="flex items-center gap-1 text-[9px] text-muted-foreground uppercase tracking-widest mb-0.5"
        style={{ fontFamily: "'JetBrains Mono', monospace" }}
      >
        <Icon size={10} />
        {label}
      </div>
      <div
        className="text-base text-foreground leading-none"
        style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700 }}
      >
        {value.toLocaleString('es-CO')}
      </div>
    </div>
  )
}

function TenantActivoSelector() {
  const t = useTenantActivo()
  const store = tenantActivoStore
  return (
    <div
      className="bg-card border border-border p-4 space-y-3"
      style={{ borderRadius: '0.25rem' }}
    >
      <div
        className="text-[10px] text-muted-foreground uppercase tracking-widest"
        style={{ fontFamily: "'JetBrains Mono', monospace" }}
      >
        Tenant activo
      </div>
      <p
        className="text-xs text-muted-foreground"
        style={{ fontFamily: "'DM Sans', sans-serif" }}
      >
        Esto define desde qué tenant ves los datos cuando navegues a un
        módulo común (dashboard, inventario, etc). Por ahora es solo
        un marcador visual — la lógica de filtrado por header
        <code className="mx-1 px-1.5 py-0.5 bg-muted border border-border" style={{ borderRadius: '0.125rem' }}>X-Tenant-Id</code>
        la implementaremos en el siguiente sprint.
      </p>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => store.setNinguno()}
          className={`px-3 py-1.5 text-xs uppercase tracking-widest border transition-colors ${
            t.kind === 'null'
              ? 'bg-foreground text-background border-foreground'
              : 'border-border text-foreground hover:border-foreground/30'
          }`}
          style={{ borderRadius: '0.25rem', fontFamily: "'JetBrains Mono', monospace" }}
        >
          Ninguno
        </button>
        <button
          type="button"
          onClick={() => store.setTodos()}
          className={`px-3 py-1.5 text-xs uppercase tracking-widest border transition-colors ${
            t.kind === 'all'
              ? 'bg-foreground text-background border-foreground'
              : 'border-border text-foreground hover:border-foreground/30'
          }`}
          style={{ borderRadius: '0.25rem', fontFamily: "'JetBrains Mono', monospace" }}
        >
          Todos los tenants
        </button>
      </div>
    </div>
  )
}
