import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Activity, AlertTriangle, Ban, Building2, Check, CheckCircle2, Clock, Crown, Eye, EyeOff,
  DollarSign, Ellipsis, Globe, Plus, Search, ToggleLeft, ToggleRight, Users,
  Warehouse, X, Loader2, ChevronRight,
} from 'lucide-react'
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { api } from '../lib/api'
import { HeaderNotificationsButton } from './HeaderNotificationsButton'
import { createPortal } from 'react-dom'

type PlanKey = 'Starter' | 'Pro' | 'Enterprise'
type EstadoEmpresa = 'activa' | 'trial' | 'suspendida'
type Empresa = {
  id: string; backendId?: string; nombre: string; rut: string; plan: string; usuarios: number;
  bodegas: number; acceso: string; estado: EstadoEmpresa; mrr: number; email?: string; createdAt?: string;
  metricas?: { productos: number; pedidos: number; alertas: number; kits: number };
  bodegasDetalle?: Array<{ id: string; nombre: string; direccion?: string | null; createdAt?: string }>;
}
type TenantApi = {
  id: string; nombre: string; email: string; estado: 'Activo' | 'Inactivo'; createdAt?: string; adminId?: string;
  bodegas?: Array<{ id: string; nombre: string; direccion?: string | null; createdAt?: string }>;
  metricas: { usuarios: number; bodegas: number; productos?: number; pedidos?: number; alertas?: number; kits?: number };
  subscription?: { status: 'trialing' | 'active' | 'past_due' | 'canceled' | 'expired'; plan: { name: string; priceAmount: number } } | null
}
type Plan = {
  id: string; name: string; price: number; period: string; desc: string; features: string[];
  featureItems: Array<{ code: string; name: string; type: 'boolean' | 'limit' | 'metered'; enabled: boolean; limitValue: number | null }>;
  permissionKeys: string[];
  active: boolean; empresas: number; color: string
}
type BackendPlan = {
  id: string; name: string; code: string; description: string | null; priceAmount: number;
  currency: string; billingPeriod: 'month' | 'year'; status: 'draft' | 'active' | 'archived';
  features: Array<{ enabled: boolean; limitValue: number | null; feature: { code: string; name: string; type: 'boolean' | 'limit' | 'metered' } }>;
  permissions: Array<{ permiso: { key: string; modulo: string; accion: string; descripcion: string } }>;
  _count: { subscriptions: number }
}
type FeatureApi = { id: string; code: string; name: string; type: 'boolean' | 'limit' | 'metered'; unit: string | null }
type PermissionApi = { id: string; key: string; modulo: string; accion: string; descripcion: string }

const EMPRESAS_BASE: Empresa[] = [
  { id: 'E-001', nombre: 'Constructora Andina', rut: '76.123.456-7', plan: 'Enterprise', usuarios: 48, bodegas: 8, acceso: 'Hace 2 min', estado: 'activa', mrr: 1290 },
  { id: 'E-002', nombre: 'Logística Pacífico', rut: '77.419.820-3', plan: 'Pro', usuarios: 24, bodegas: 4, acceso: 'Hace 18 min', estado: 'activa', mrr: 490 },
  { id: 'E-003', nombre: 'Industrias del Norte', rut: '89.731.125-9', plan: 'Starter', usuarios: 7, bodegas: 1, acceso: 'Hace 1 h', estado: 'trial', mrr: 99 },
  { id: 'E-004', nombre: 'Servicios Técnicos Sur', rut: '80.552.104-1', plan: 'Pro', usuarios: 19, bodegas: 3, acceso: 'Ayer, 16:42', estado: 'activa', mrr: 490 },
  { id: 'E-005', nombre: 'Grupo Metalmecánico', rut: '90.118.667-4', plan: 'Enterprise', usuarios: 62, bodegas: 11, acceso: 'Hace 3 días', estado: 'suspendida', mrr: 1290 },
  { id: 'E-006', nombre: 'Obras Civiles Capital', rut: '75.982.443-8', plan: 'Starter', usuarios: 5, bodegas: 1, acceso: 'Hace 5 días', estado: 'trial', mrr: 99 },
]

const MRR_DATA = [
  { mes: 'ENE', mrr: 6820 }, { mes: 'FEB', mrr: 7240 }, { mes: 'MAR', mrr: 7610 },
  { mes: 'ABR', mrr: 8430 }, { mes: 'MAY', mrr: 9120 }, { mes: 'JUN', mrr: 9880 },
  { mes: 'JUL', mrr: 10540 }, { mes: 'AGO', mrr: 11230 },
]

const PLANES_INICIALES: Plan[] = [
  { id: 'plan_starter', name: 'Starter', price: 99, period: 'mes', desc: 'Para equipos pequeños que comienzan a ordenar su inventario.', features: ['1 bodega', 'Hasta 8 usuarios'], featureItems: [], permissionKeys: [], active: true, empresas: 18, color: '#888880' },
  { id: 'plan_pro', name: 'Pro', price: 490, period: 'mes', desc: 'Operación completa para empresas en crecimiento.', features: ['5 bodegas', 'Hasta 30 usuarios'], featureItems: [], permissionKeys: [], active: true, empresas: 11, color: '#E8593F' },
  { id: 'plan_enterprise', name: 'Enterprise', price: 1290, period: 'mes', desc: 'Control, escala y acompañamiento para grandes operaciones.', features: ['Bodegas ilimitadas', 'Usuarios ilimitados'], featureItems: [], permissionKeys: [], active: true, empresas: 6, color: '#ABF768' },
]

const COMPARATIVA = [
  ['Gestión de inventario', true, true, true], ['Alertas de stock', true, true, true],
  ['Reportes avanzados', false, true, true], ['Multi-bodega', false, true, true],
  ['Analítica ejecutiva', false, false, true], ['Soporte dedicado', false, false, true],
] as const

export function SuperAdminEmpresas() {
  const [empresas, setEmpresas] = useState(EMPRESAS_BASE)
  const [search, setSearch] = useState('')
  const [filterPlan, setFilterPlan] = useState<string>('Todos')
  const [filterEstado, setFilterEstado] = useState<'Todos' | EstadoEmpresa>('Todos')
  const [menu, setMenu] = useState<string | null>(null)
  const [showCreateAdmin, setShowCreateAdmin] = useState(false)
  const [createdMessage, setCreatedMessage] = useState<string | null>(null)
  const [availablePlans, setAvailablePlans] = useState<BackendPlan[]>([])
  const [editingEmpresa, setEditingEmpresa] = useState<Empresa | null>(null)
  const [detalleEmpresa, setDetalleEmpresa] = useState<Empresa | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    api.get<TenantApi[]>('/admin/tenants').then((tenants) => {
      if (!tenants.length) return
      setEmpresas(tenants.filter(t => !t.adminId || t.adminId === t.id).map((t, i) => tenantToEmpresa(t, i)))
    }).catch(() => { /* La demo visual funciona sin backend. */ })
  }, [])

  useEffect(() => {
    api.get<BackendPlan[]>('/admin/plans').then(plans => setAvailablePlans(plans.filter(plan => plan.status === 'active'))).catch(() => {})
  }, [])

  useEffect(() => {
    const close = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setMenu(null)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [])

  const filtered = useMemo(() => empresas.filter((e) => {
    const q = search.toLowerCase()
    return (e.nombre.toLowerCase().includes(q) || e.rut.includes(search)) &&
      (filterPlan === 'Todos' || e.plan === filterPlan) &&
      (filterEstado === 'Todos' || e.estado === filterEstado)
  }), [empresas, search, filterPlan, filterEstado])

  const totalMRR = empresas.reduce((sum, e) => sum + e.mrr, 0)
  const totalUsuarios = empresas.reduce((sum, e) => sum + e.usuarios, 0)

  return <SuperAdminShell title="Empresas" subtitle="Gestión global de clientes y suscripciones">
    <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
      <Kpi icon={Building2} label="Empresas" value={String(empresas.length)} sub="+3 este mes" />
      <Kpi icon={DollarSign} label="MRR total" value={money(totalMRR)} sub="+8.4% vs. mes anterior" accent />
      <Kpi icon={Users} label="Usuarios" value={String(totalUsuarios)} sub="En todas las empresas" />
      <Kpi icon={Warehouse} label="Bodegas" value={String(empresas.reduce((s, e) => s + e.bodegas, 0))} sub="Operación consolidada" />
    </div>

    <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
      <Panel className="xl:col-span-2">
        <SectionTitle title="Evolución del MRR" sub="USD · ÚLTIMOS 8 MESES" />
        <div className="h-60 mt-4">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={MRR_DATA}>
              <defs><linearGradient id="mrrLime" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#ABF768" stopOpacity={0.3}/><stop offset="100%" stopColor="#ABF768" stopOpacity={0}/></linearGradient></defs>
              <CartesianGrid stroke="rgba(255,255,255,.06)" strokeDasharray="3 3" />
              <XAxis dataKey="mes" stroke="#888880" fontSize={10} tickLine={false} axisLine={false}/>
              <YAxis stroke="#888880" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(v) => `$${v / 1000}k`}/>
              <Tooltip contentStyle={{ background: '#2E2E2E', border: '1px solid rgba(255,255,255,.08)', fontSize: 11 }} formatter={(v) => money(Number(v))}/>
              <Area type="monotone" dataKey="mrr" stroke="#ABF768" strokeWidth={2} fill="url(#mrrLime)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Panel>
      <Panel>
        <SectionTitle title="Distribución de planes" sub={`${empresas.length} EMPRESAS`} />
        <div className="mt-6 space-y-5">
          {(['Starter', 'Pro', 'Enterprise'] as PlanKey[]).map((plan) => {
            const count = empresas.filter((e) => e.plan === plan).length
            const color = plan === 'Starter' ? '#888880' : plan === 'Pro' ? '#E8593F' : '#ABF768'
            return <div key={plan}>
              <div className="flex justify-between text-xs mb-2"><span>{plan}</span><span className="font-mono text-muted-foreground">{count} · {Math.round(count / empresas.length * 100)}%</span></div>
              <div className="h-1.5 bg-muted overflow-hidden"><div className="h-full" style={{ width: `${count / empresas.length * 100}%`, backgroundColor: color }}/></div>
            </div>
          })}
        </div>
        <div className="grid grid-cols-2 gap-2 mt-7 pt-5 border-t border-border">
          <MiniMetric label="Enterprise MRR" value={money(empresas.filter(e => e.plan === 'Enterprise').reduce((s, e) => s + e.mrr, 0))}/>
          <MiniMetric label="Usuarios totales" value={String(totalUsuarios)}/>
        </div>
      </Panel>
    </div>

    <Panel className="p-0 overflow-visible">
      <div className="p-3 sm:p-4 border-b border-border grid grid-cols-2 lg:flex lg:flex-wrap items-center gap-2">
        <div className="relative col-span-2 lg:flex-1 lg:min-w-52"><Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"/><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar empresa..." className="control pl-9 pr-8 w-full"/>{search && <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground"><X size={13}/></button>}</div>
        <div className="min-w-0 [&>select]:w-full"><Select value={filterPlan} onChange={setFilterPlan} options={['Todos', ...Array.from(new Set(empresas.map(e => e.plan)))]} /></div>
        <div className="min-w-0 [&>select]:w-full"><Select value={filterEstado} onChange={(v) => setFilterEstado(v as 'Todos' | EstadoEmpresa)} options={['Todos', 'activa', 'trial', 'suspendida']} /></div>
        <button onClick={() => setShowCreateAdmin(true)} className="col-span-2 lg:col-span-1 lg:ml-auto btn-primary justify-center"><Plus size={13}/>Crear administrador</button>
      </div>
      <div className="md:hidden divide-y divide-border">
        {filtered.length ? filtered.map(e => <button key={e.id} type="button" onClick={() => setDetalleEmpresa(e)} className="w-full p-4 text-left active:bg-muted/60 hover:bg-muted/30 transition-colors">
          <div className="flex items-start gap-3"><span className="w-10 h-10 shrink-0 bg-secondary/10 border border-secondary/20 flex items-center justify-center"><Building2 size={16} className="text-secondary"/></span><div className="min-w-0 flex-1"><div className="flex items-start justify-between gap-2"><div className="min-w-0"><div className="text-sm font-semibold truncate">{e.nombre}</div><div className="text-[9px] font-mono text-muted-foreground truncate mt-0.5">{e.email ?? e.rut}</div></div><StatusBadge estado={e.estado}/></div><div className="flex items-center gap-2 mt-3"><PlanBadge plan={e.plan}/><span className="text-[9px] font-mono text-muted-foreground">{e.usuarios} usuarios</span><span className="text-muted-foreground">·</span><span className="text-[9px] font-mono text-muted-foreground">{e.bodegas} bodegas</span></div><div className="mt-3 pt-2 border-t border-border/60 flex justify-between text-[9px] font-mono text-muted-foreground"><span>{e.acceso}</span><span className="text-secondary">VER DETALLE →</span></div></div></div>
        </button>) : <div className="p-8 text-center text-xs text-muted-foreground">No hay empresas que coincidan con los filtros.</div>}
      </div>
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full min-w-[900px] text-left">
          <thead className="bg-background/30"><tr>{['EMPRESA', 'IDENTIFICACIÓN', 'PLAN', 'OPERACIÓN', 'ÚLTIMO ACCESO', 'ESTADO', 'ACCIONES'].map(h => <th key={h} className="px-4 py-3 text-[9px] font-normal tracking-widest text-muted-foreground border-b border-border font-mono">{h}</th>)}</tr></thead>
          <tbody>{filtered.map((e) => <tr key={e.id} className="border-b border-border/60 hover:bg-secondary/[0.035] transition-colors group">
            <td className="px-4 py-3"><button onClick={() => setDetalleEmpresa(e)} className="flex gap-3 items-center text-left"><span className="w-9 h-9 bg-muted border border-border flex items-center justify-center group-hover:border-secondary/30"><Building2 size={15} className="text-secondary"/></span><span><span className="block text-xs font-semibold group-hover:text-secondary transition-colors">{e.nombre}</span><span className="text-[9px] font-mono text-muted-foreground">{e.email ?? e.id}</span></span></button></td>
            <td className="px-4 py-3"><span className="block text-[10px] font-mono text-muted-foreground">{e.rut}</span><span className="text-[8px] font-mono text-muted-foreground/70">{e.id}</span></td><td className="px-4 py-3"><PlanBadge plan={e.plan}/></td>
            <td className="px-4 py-3"><div className="flex gap-4"><span className="text-[10px]"><strong className="block text-sm text-foreground">{e.usuarios}</strong><span className="text-muted-foreground">usuarios</span></span><span className="text-[10px]"><strong className="block text-sm text-foreground">{e.bodegas}</strong><span className="text-muted-foreground">bodegas</span></span></div></td><td className="px-4 py-3 text-[10px] font-mono text-muted-foreground">{e.acceso}</td>
            <td className="px-4 py-3"><StatusBadge estado={e.estado}/></td>
            <td className="px-4 py-3 relative"><div className="flex items-center gap-1"><button onClick={() => setDetalleEmpresa(e)} className="px-2.5 py-1.5 border border-border text-[9px] font-mono hover:border-secondary/30 hover:text-secondary">DETALLE</button><button onClick={() => setMenu(menu === e.id ? null : e.id)} className="p-1.5 text-muted-foreground hover:text-foreground"><Ellipsis size={15}/></button></div>{menu === e.id && <div ref={menuRef} className="absolute right-4 top-10 z-50 w-40 bg-card border border-border rounded shadow-xl p-1 text-xs"><MenuItem onClick={() => { setEditingEmpresa(e); setMenu(null) }}>Editar empresa</MenuItem><MenuItem danger={e.estado !== 'suspendida'} success={e.estado === 'suspendida'} onClick={async () => { if (!e.backendId) return; const reactivar = e.estado === 'suspendida'; await api.patch(`/admin/tenants/${e.backendId}/status`, { estado: reactivar ? 'Activo' : 'Inactivo' }); setEmpresas(prev => prev.map(item => item.id === e.id ? { ...item, estado: reactivar ? 'activa' : 'suspendida' } : item)); setCreatedMessage(reactivar ? `${e.nombre} fue reactivada correctamente.` : `${e.nombre} fue suspendida.`); setMenu(null) }}>{e.estado === 'suspendida' ? 'Reactivar empresa' : 'Suspender'}</MenuItem></div>}</td>
          </tr>)}</tbody>
        </table>
      </div>
      <div className="p-3 sm:p-4 flex justify-between items-center text-[9px] sm:text-[10px] font-mono text-muted-foreground"><span>Mostrando {filtered.length} de {empresas.length}</span><div className="hidden md:flex gap-1"><Page active>1</Page><Page>2</Page><Page>3</Page></div></div>
    </Panel>
    {createdMessage && <div className="fixed right-5 bottom-5 z-[70] flex items-center gap-2 bg-card border border-secondary/30 px-4 py-3 text-xs shadow-xl"><CheckCircle2 size={14} className="text-secondary"/><span>{createdMessage}</span><button onClick={() => setCreatedMessage(null)} className="ml-3 text-muted-foreground"><X size={13}/></button></div>}
    {showCreateAdmin && <CreateAdminModal
      onClose={() => setShowCreateAdmin(false)}
      onCreated={(tenant) => {
        setEmpresas(prev => [...prev, tenantToEmpresa(tenant, prev.length)])
        setShowCreateAdmin(false)
        setCreatedMessage(`Administrador ${tenant.nombre} creado correctamente.`)
      }}
    />}
    {editingEmpresa && <EditEmpresaModal empresa={editingEmpresa} plans={availablePlans} onClose={() => setEditingEmpresa(null)} onSaved={updated => { setEmpresas(prev => prev.map(item => item.id === updated.id ? updated : item)); setEditingEmpresa(null); setCreatedMessage(`${updated.nombre} fue actualizada correctamente.`) }}/>} 
    {detalleEmpresa && <EmpresaDetalleModal empresa={detalleEmpresa} onClose={() => setDetalleEmpresa(null)} onEdit={() => { setEditingEmpresa(detalleEmpresa); setDetalleEmpresa(null) }}/>} 
  </SuperAdminShell>
}

export function SuperAdminPlanes() {
  const [planes, setPlanes] = useState(PLANES_INICIALES)
  const [editing, setEditing] = useState<string | null>(null)
  const [editData, setEditData] = useState<Plan | null>(null)
  const [showCreatePlan, setShowCreatePlan] = useState(false)
  const [permissionCatalog, setPermissionCatalog] = useState<PermissionApi[]>([])
  const totalMRR = planes.reduce((sum, p) => sum + (p.active ? p.price * p.empresas : 0), 0)

  useEffect(() => {
    api.get<BackendPlan[]>('/admin/plans').then(data => setPlanes(data.map(backendPlanToUi))).catch(() => {})
    api.get<PermissionApi[]>('/admin/plan-permissions').then(setPermissionCatalog).catch(() => {})
  }, [])

  const startEdit = (plan: Plan) => { setEditing(plan.name); setEditData({ ...plan, features: [...plan.features], featureItems: plan.featureItems.map(item => ({ ...item })), permissionKeys: [...plan.permissionKeys] }) }
  const save = async () => {
    if (!editing || !editData) return
    await api.patch(`/admin/plans/${editData.id}`, { priceAmount: Math.round(editData.price * 100), description: editData.desc })
    await api.put(`/admin/plans/${editData.id}/features`, { features: editData.featureItems.map(f => ({ code: f.code, enabled: f.enabled, limitValue: f.enabled ? f.limitValue : null })) })
    await api.put(`/admin/plans/${editData.id}/permissions`, { permissions: editData.permissionKeys })
    setPlanes(prev => prev.map(p => p.name === editing ? editData : p)); setEditing(null); setEditData(null)
  }
  const toggleActive = async (plan: Plan) => {
    await api.post(`/admin/plans/${plan.id}/${plan.active ? 'archive' : 'publish'}`)
    setPlanes(prev => prev.map(p => p.id === plan.id ? { ...p, active: !p.active } : p))
  }

  return <SuperAdminShell title="Planes" subtitle="Configuración comercial y límites por suscripción">
    {!editing && <div className="bg-card border border-secondary/20 p-4 flex items-center justify-between gap-4 animate-[planGridIn_.25s_ease-out]">
      <div><div className="eyebrow">MRR PROYECTADO</div><div className="text-3xl font-black font-heading">{money(totalMRR)}<span className="text-xs font-normal text-muted-foreground ml-2">/ mes</span></div></div>
      <button onClick={() => setShowCreatePlan(true)} className="btn-primary"><Plus size={13}/>Crear plan</button>
    </div>}
    {editing && editData ? (
      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.7fr)_minmax(320px,0.8fr)] gap-5 animate-[planEditorIn_.32s_ease-out]">
        <div className="bg-card border border-primary/30 shadow-2xl min-w-0 overflow-hidden">
          <div className="px-5 py-4 border-b border-border flex items-start justify-between gap-4 bg-primary/[0.03]">
            <div><div className="eyebrow text-primary">EDITANDO PLAN</div><h2 className="text-2xl uppercase font-black font-heading mt-1">Configuración de {editData.name}</h2><p className="text-xs text-muted-foreground mt-1">Ajusta capacidades, límites y permisos. La vista previa se actualiza en tiempo real.</p></div>
            <button onClick={() => { setEditing(null); setEditData(null) }} className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted" aria-label="Cerrar editor"><X size={16}/></button>
          </div>
          <div className="p-5 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-[180px_minmax(0,1fr)] gap-4">
              <Field label="PRECIO MENSUAL (USD)"><input type="number" min={0} value={editData.price} onChange={e => setEditData({ ...editData, price: Number(e.target.value) })} className="control text-xl font-heading font-black"/></Field>
              <Field label="DESCRIPCIÓN"><textarea value={editData.desc} onChange={e => setEditData({ ...editData, desc: e.target.value })} className="control min-h-20 resize-none"/></Field>
            </div>
            <div><div className="eyebrow mb-2">CAPACIDADES Y LÍMITES</div><div className="border border-border divide-y divide-border grid grid-cols-1 2xl:grid-cols-2 2xl:divide-y-0">
              {editData.featureItems.map((feature, i) => <div key={feature.code} className="p-3 flex items-center gap-3 border-b 2xl:odd:border-r border-border last:border-b-0">
                <input type="checkbox" checked={feature.enabled} onChange={e => setEditData({ ...editData, featureItems: editData.featureItems.map((f, n) => n === i ? { ...f, enabled: e.target.checked } : f) })} className="accent-[#ABF768]"/>
                <div className="flex-1 min-w-0"><div className={`text-xs ${feature.enabled ? 'text-foreground' : 'text-muted-foreground'}`}>{feature.name}</div><div className="text-[9px] font-mono text-muted-foreground">{feature.code}</div></div>
                {feature.type !== 'boolean' && feature.enabled && <input type="number" min={0} value={feature.limitValue ?? ''} placeholder="Ilimitado" onChange={e => setEditData({ ...editData, featureItems: editData.featureItems.map((f, n) => n === i ? { ...f, limitValue: e.target.value === '' ? null : Number(e.target.value) } : f) })} className="control py-1.5 w-28"/>}
              </div>)}
            </div></div>
            <div><div className="flex items-end justify-between gap-3 mb-2"><div><div className="eyebrow">MÓDULOS Y PERMISOS</div><p className="text-[10px] text-muted-foreground mt-1">Selecciona módulos completos, submódulos o acciones individuales.</p></div><span className="font-mono text-[9px] text-secondary">{editData.permissionKeys.length} SELECCIONADOS</span></div><PermissionModuleSelector catalog={permissionCatalog} selected={editData.permissionKeys} onChange={permissionKeys => setEditData({ ...editData, permissionKeys })}/></div>
          </div>
          <div className="sticky bottom-0 px-5 py-4 border-t border-border bg-card/95 backdrop-blur flex justify-end gap-2">
            <button onClick={() => { setEditing(null); setEditData(null) }} className="btn-outline justify-center min-w-28">Cancelar</button><button onClick={save} className="btn-primary justify-center min-w-32">Guardar cambios</button>
          </div>
        </div>
        <div className="xl:sticky xl:top-0 self-start min-w-0">
          <PlanPreviewCard plan={editData} catalog={permissionCatalog}/>
        </div>
      </div>
    ) : (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 animate-[planGridIn_.25s_ease-out]">
      {planes.map((plan) => {
        const draft = plan
        return <div key={plan.name} className="bg-card border overflow-hidden flex flex-col border-border transition-all duration-300 hover:-translate-y-1 hover:shadow-xl">
          <div className="h-0.5" style={{ backgroundColor: plan.color }}/>
          <div className="p-5 flex-1">
            <div className="flex justify-between items-center"><h2 className="text-2xl uppercase font-black font-heading">{plan.name}</h2><button onClick={() => void toggleActive(plan)} title={plan.active ? 'Desactivar plan' : 'Activar plan'}>{plan.active ? <ToggleRight size={22} className="text-secondary"/> : <ToggleLeft size={22} className="text-muted-foreground"/>}</button></div>
            <div className="mt-5 flex items-end gap-2"><span className="text-4xl font-black font-heading">${plan.price}</span><span className="text-xs text-muted-foreground mb-1">USD / {plan.period}</span></div>
            <p className="text-xs text-muted-foreground mt-4 min-h-10">{plan.desc}</p>
            <div className="mt-6 space-y-2.5">{draft.featureItems.length ? draft.featureItems.map((feature, i) => <div key={feature.code} className="flex items-center gap-2 text-xs border-b border-border/50 pb-2">
              <Check size={13} style={{ color: feature.enabled ? plan.color : '#888880' }} className={feature.enabled ? '' : 'opacity-30'}/><span className={`flex-1 ${feature.enabled ? '' : 'text-muted-foreground'}`}>{feature.name}</span>
              {feature.type !== 'boolean' && feature.enabled && <span className="font-mono text-[9px] text-muted-foreground">{feature.limitValue == null ? 'ILIMITADO' : `MÁX. ${feature.limitValue}`}</span>}
            </div>) : draft.features.map((feature, i) => <div key={i} className="flex items-center gap-2 text-xs"><Check size={13} style={{ color: plan.color }}/>{feature}</div>)}</div>
            <div className="mt-5 pt-4 border-t border-border"><div className="eyebrow mb-2">MÓDULOS DEL PLAN</div><ModuleBadges catalog={permissionCatalog} selected={draft.permissionKeys}/></div>
          </div>
          <div className="p-4 border-t border-border bg-background/20">
            {!plan.active && <div className="text-[10px] text-primary font-mono mb-3">ESTE PLAN NO ADMITE NUEVAS EMPRESAS</div>}
            <div className="flex justify-between text-[10px] font-mono text-muted-foreground mb-3"><span>{plan.empresas} EMPRESAS</span><span>{money(plan.price * plan.empresas)} MRR</span></div>
            <button onClick={() => startEdit(plan)} className="btn-outline w-full justify-center">Editar plan</button>
          </div>
        </div>
      })}
    </div>)}
    <Panel className="p-0 overflow-hidden"><div className="p-5 border-b border-border"><SectionTitle title="Comparativa de planes" sub="CARACTERÍSTICAS Y DISPONIBILIDAD"/></div><table className="w-full text-xs"><thead><tr><th className="p-4 text-left text-muted-foreground font-normal">Característica</th>{planes.map(p => <th key={p.name} className="p-4 font-mono text-[10px]" style={{ color: p.color }}>{p.name.toUpperCase()}</th>)}</tr></thead><tbody>{COMPARATIVA.map(row => <tr key={row[0]} className="border-t border-border"><td className="p-4">{row[0]}</td>{row.slice(1).map((value, i) => <td key={i} className="p-4 text-center">{value ? <Check size={13} className="mx-auto text-secondary"/> : <X size={13} className="mx-auto text-muted-foreground opacity-40"/>}</td>)}</tr>)}</tbody></table></Panel>
    {showCreatePlan && <CreatePlanModal onClose={() => setShowCreatePlan(false)} onCreated={plan => { setPlanes(prev => [...prev, backendPlanToUi(plan)]); setShowCreatePlan(false) }}/>} 
  </SuperAdminShell>
}

export function SuperAdminPlaceholder({ type }: { type: 'metricas' | 'sistema' }) {
  const isMetrics = type === 'metricas'
  const Icon = isMetrics ? Activity : Globe
  return <SuperAdminShell title={isMetrics ? 'Métricas' : 'Sistema'} subtitle={isMetrics ? 'Analítica consolidada de la plataforma' : 'Estado y configuración global'}>
    <div className="min-h-[430px] bg-card border border-border flex flex-col items-center justify-center text-center p-8">
      <div className="w-14 h-14 bg-secondary/10 border border-secondary/20 flex items-center justify-center"><Icon size={23} className="text-secondary"/></div>
      <div className="eyebrow mt-6">PRÓXIMAMENTE</div><h2 className="font-heading font-black uppercase text-3xl mt-2">{isMetrics ? 'Métricas de plataforma' : 'Control del sistema'}</h2>
      <p className="text-sm text-muted-foreground mt-3 max-w-md">{isMetrics ? 'Aquí se consolidarán adopción, retención, actividad y crecimiento de todas las empresas.' : 'Aquí vivirán la salud de servicios, auditoría, parámetros globales y herramientas operativas.'}</p>
    </div>
  </SuperAdminShell>
}

function SuperAdminShell({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return <div className="h-full flex flex-col min-w-0"><header className="hidden lg:flex min-h-14 border-b border-border px-6 py-3 items-center gap-3 shrink-0"><div className="inline-flex items-center gap-1.5 px-2 py-1 rounded bg-secondary/10 border border-secondary/20"><Crown size={11} className="text-secondary"/><span className="text-secondary font-mono text-[9px]">SUPER ADMIN</span></div><div><h1 className="text-2xl uppercase leading-none font-heading font-black">{title}</h1><div className="eyebrow mt-1">{subtitle}</div></div><div className="ml-auto"><HeaderNotificationsButton /></div></header><div className="flex-1 overflow-y-auto p-6 space-y-5">{children}</div></div>
}

function Kpi({ icon: Icon, label, value, sub, accent }: { icon: typeof Building2; label: string; value: string; sub: string; accent?: boolean }) { return <div className={`relative bg-card border p-4 overflow-hidden ${accent ? 'border-secondary/30 bg-secondary/5' : 'border-border'}`}>{accent && <span className="absolute left-0 top-0 h-full w-0.5 bg-secondary"/>}<div className="flex justify-between"><div className="eyebrow">{label}</div><Icon size={14} className={accent ? 'text-secondary' : 'text-muted-foreground'}/></div><div className="text-3xl font-heading font-black mt-2">{value}</div><div className="text-[10px] text-muted-foreground mt-1">{sub}</div></div> }
function Panel({ children, className = '' }: { children: React.ReactNode; className?: string }) { return <div className={`bg-card border border-border p-5 ${className}`}>{children}</div> }
function SectionTitle({ title, sub }: { title: string; sub: string }) { return <div><h2 className="text-xl uppercase font-heading font-black">{title}</h2><div className="eyebrow mt-1">{sub}</div></div> }
function MiniMetric({ label, value }: { label: string; value: string }) { return <div className="bg-muted/30 border border-border p-3"><div className="eyebrow">{label}</div><div className="font-heading font-bold text-lg mt-1">{value}</div></div> }
function Select({ value, onChange, options }: { value: string; onChange: (value: string) => void; options: string[] }) { return <select value={value} onChange={e => onChange(e.target.value)} className="control w-auto min-w-32">{options.map(o => <option key={o}>{o}</option>)}</select> }
function PlanBadge({ plan }: { plan: string }) { const classes = plan === 'Starter' ? 'bg-muted text-muted-foreground' : plan === 'Pro' ? 'bg-primary/15 text-primary' : 'bg-secondary/15 text-secondary'; return <span className={`px-2 py-1 text-[9px] font-mono ${classes}`}>{plan.toUpperCase()}</span> }
function StatusBadge({ estado }: { estado: EstadoEmpresa }) { const Icon = estado === 'activa' ? CheckCircle2 : estado === 'trial' ? Clock : Ban; const classes = estado === 'activa' ? 'text-secondary bg-secondary/10 border-secondary/20' : estado === 'trial' ? 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20' : 'text-primary bg-primary/10 border-primary/20'; return <span className={`inline-flex items-center gap-1.5 px-2 py-1 text-[9px] font-mono border ${classes}`}><Icon size={10}/>{estado.toUpperCase()}</span> }
function MenuItem({ children, danger, success, onClick }: { children: React.ReactNode; danger?: boolean; success?: boolean; onClick?: () => void | Promise<void> }) { return <button onClick={() => void onClick?.()} className={`w-full text-left px-2.5 py-2 hover:bg-muted ${danger ? 'text-primary' : success ? 'text-secondary' : 'text-foreground'}`}>{children}</button> }
function Page({ children, active }: { children: React.ReactNode; active?: boolean }) { return <button className={`w-7 h-7 border ${active ? 'border-secondary bg-secondary/10 text-secondary' : 'border-border hover:border-foreground/30'}`}>{children}</button> }
function money(value: number) { return `$${value.toLocaleString('en-US')}` }

function backendPlanToUi(plan: BackendPlan): Plan {
  const normalized = plan.name.toLowerCase()
  const name = plan.name
  const color = normalized.includes('starter') ? '#888880' : normalized.includes('pro') ? '#E8593F' : '#ABF768'
  return {
    id: plan.id, name, price: plan.priceAmount / 100, period: plan.billingPeriod === 'year' ? 'año' : 'mes',
    desc: plan.description ?? '', active: plan.status === 'active', empresas: plan._count.subscriptions, color,
    features: plan.features.filter(item => item.enabled).map(item => item.feature.name),
    featureItems: plan.features.map(item => ({ code: item.feature.code, name: item.feature.name, type: item.feature.type, enabled: item.enabled, limitValue: item.limitValue })),
    permissionKeys: plan.permissions.map(item => item.permiso.key),
  }
}

function tenantToEmpresa(tenant: TenantApi, index: number): Empresa {
  const fallback = EMPRESAS_BASE[index % EMPRESAS_BASE.length]
  const planName = tenant.subscription?.plan.name.toLowerCase() ?? ''
  const plan = tenant.subscription?.plan.name ?? (planName.includes('enterprise') ? 'Enterprise' : planName.includes('pro') ? 'Pro' : 'Starter')
  return {
    ...fallback,
    id: `E-${String(index + 1).padStart(3, '0')}`,
    backendId: tenant.id,
    nombre: tenant.nombre,
    plan,
    mrr: (tenant.subscription?.plan.priceAmount ?? fallback.mrr * 100) / 100,
    usuarios: tenant.metricas.usuarios,
    bodegas: tenant.metricas.bodegas,
    email: tenant.email,
    createdAt: tenant.createdAt,
    bodegasDetalle: tenant.bodegas ?? [],
    metricas: { productos: tenant.metricas.productos ?? 0, pedidos: tenant.metricas.pedidos ?? 0, alertas: tenant.metricas.alertas ?? 0, kits: tenant.metricas.kits ?? 0 },
    acceso: 'Sin ingresos aún',
    estado: tenant.estado !== 'Activo' || ['canceled', 'expired', 'past_due'].includes(tenant.subscription?.status ?? '') ? 'suspendida' : tenant.subscription?.status === 'trialing' ? 'trial' : 'activa',
  }
}

function EditEmpresaModal({ empresa, plans, onClose, onSaved }: { empresa: Empresa; plans: BackendPlan[]; onClose: () => void; onSaved: (empresa: Empresa) => void }) {
  const [nombre, setNombre] = useState(empresa.nombre)
  const [email, setEmail] = useState(empresa.email ?? '')
  const [planName, setPlanName] = useState(empresa.plan)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  async function submit(event: React.FormEvent) {
    event.preventDefault(); if (!empresa.backendId) return
    setLoading(true); setError(null)
    try {
      await api.patch(`/admin/tenants/${empresa.backendId}`, { nombre: nombre.trim(), email: email.trim().toLowerCase() })
      const selectedPlan = plans.find(plan => plan.name === planName)
      if (selectedPlan && planName !== empresa.plan) await api.post(`/admin/tenants/${empresa.backendId}/subscription`, { planId: selectedPlan.id, status: 'active' })
      onSaved({ ...empresa, nombre: nombre.trim(), email: email.trim().toLowerCase(), plan: planName, mrr: selectedPlan ? selectedPlan.priceAmount / 100 : empresa.mrr, estado: 'activa' })
    } catch (err) { setError(err instanceof Error ? err.message : 'No se pudo actualizar la empresa.') } finally { setLoading(false) }
  }
  return createPortal(<div className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4" onMouseDown={e => { if (e.target === e.currentTarget && !loading) onClose() }}><form onSubmit={submit} className="w-full max-w-lg bg-card border border-border shadow-2xl">
    <div className="p-5 border-b border-border flex justify-between gap-4"><div><div className="eyebrow text-secondary">GESTIÓN DE EMPRESA</div><h2 className="font-heading text-2xl font-black uppercase mt-1">Editar empresa</h2><p className="text-xs text-muted-foreground mt-1">Actualiza los datos principales y la suscripción.</p></div><button type="button" onClick={onClose}><X size={16}/></button></div>
    <div className="p-5 space-y-4">{error && <div className="bg-primary/10 border border-primary/20 p-3 text-xs text-primary">{error}</div>}<Field label="NOMBRE"><input required minLength={2} value={nombre} onChange={e => setNombre(e.target.value)} className="control"/></Field><Field label="CORREO"><input required type="email" value={email} onChange={e => setEmail(e.target.value)} className="control"/></Field><Field label="PLAN"><select value={planName} onChange={e => setPlanName(e.target.value)} className="control">{plans.map(plan => <option key={plan.id} value={plan.name}>{plan.name} · ${(plan.priceAmount / 100).toLocaleString('en-US')} USD/mes</option>)}</select></Field></div>
    <div className="p-4 border-t border-border flex justify-end gap-2"><button type="button" onClick={onClose} disabled={loading} className="btn-outline">Cancelar</button><button disabled={loading} className="btn-primary min-w-32 justify-center">{loading ? <Loader2 size={13} className="animate-spin"/> : <Check size={13}/>}Guardar cambios</button></div>
  </form></div>, document.body)
}

function EmpresaDetalleModal({ empresa, onClose, onEdit }: { empresa: Empresa; onClose: () => void; onEdit: () => void }) {
  const metrics = empresa.metricas ?? { productos: 0, pedidos: 0, alertas: 0, kits: 0 }
  return createPortal(<div className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center sm:p-4" onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}><div className="w-full sm:max-w-2xl h-[92dvh] sm:h-auto sm:max-h-[90dvh] flex flex-col overflow-hidden bg-card border-t sm:border border-border shadow-2xl rounded-t-xl sm:rounded-none">
    <div className="h-1 bg-secondary shrink-0"/><div className="p-4 sm:p-5 border-b border-border flex justify-between gap-4 shrink-0 bg-card"><div className="min-w-0"><div className="flex items-center gap-2"><PlanBadge plan={empresa.plan}/><StatusBadge estado={empresa.estado}/></div><h2 className="font-heading text-2xl sm:text-3xl font-black uppercase mt-3 truncate">{empresa.nombre}</h2><p className="text-[10px] sm:text-xs text-muted-foreground mt-1 truncate">{empresa.email ?? 'Sin correo registrado'} · {empresa.rut}</p></div><button onClick={onClose} className="w-9 h-9 shrink-0 flex items-center justify-center border border-border"><X size={16}/></button></div>
    <div className="p-4 sm:p-5 space-y-5 flex-1 min-h-0 overflow-y-auto"><div className="grid grid-cols-2 sm:grid-cols-3 gap-2"><DetailMetric label="Usuarios" value={empresa.usuarios}/><DetailMetric label="Bodegas" value={empresa.bodegas}/><DetailMetric label="Productos" value={metrics.productos}/><DetailMetric label="Pedidos" value={metrics.pedidos}/><DetailMetric label="Alertas activas" value={metrics.alertas}/><DetailMetric label="Kits" value={metrics.kits}/></div>
      <div><div className="eyebrow mb-2">BODEGAS DE LA EMPRESA</div>{empresa.bodegasDetalle?.length ? <div className="border border-border divide-y divide-border">{empresa.bodegasDetalle.map(bodega => <div key={bodega.id} className="p-3 flex items-center gap-3"><Warehouse size={14} className="text-secondary"/><div><div className="text-xs font-medium">{bodega.nombre}</div><div className="text-[9px] font-mono text-muted-foreground">{bodega.direccion || 'Sin dirección registrada'}</div></div></div>)}</div> : <div className="border border-dashed border-border p-6 text-center text-xs text-muted-foreground">Esta empresa todavía no tiene bodegas.</div>}</div>
      <div className="grid grid-cols-2 gap-3 text-[10px] font-mono"><div className="border border-border p-3"><span className="text-muted-foreground block mb-1">CREADA</span>{empresa.createdAt ? new Date(empresa.createdAt).toLocaleDateString('es-CO') : '—'}</div><div className="border border-border p-3"><span className="text-muted-foreground block mb-1">MRR</span>{money(empresa.mrr)}</div></div>
    </div><div className="p-3 sm:p-4 border-t border-border flex gap-2 shrink-0 bg-card"><button onClick={onClose} className="btn-outline flex-1 sm:flex-none sm:ml-auto justify-center">Cerrar</button><button onClick={onEdit} className="btn-primary flex-1 sm:flex-none justify-center"><Eye size={13}/>Editar empresa</button></div>
  </div></div>, document.body)
}

function DetailMetric({ label, value }: { label: string; value: number }) { return <div className="border border-border bg-background/20 p-3"><div className="text-xl font-black font-heading">{value}</div><div className="text-[8px] font-mono tracking-widest text-muted-foreground uppercase mt-1">{label}</div></div> }

function CreateAdminModal({ onClose, onCreated }: { onClose: () => void; onCreated: (tenant: TenantApi) => void }) {
  const [nombre, setNombre] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [plans, setPlans] = useState<BackendPlan[]>([])
  const [planId, setPlanId] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showPlanPicker, setShowPlanPicker] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape' && !loading) onClose() }
    document.addEventListener('keydown', closeOnEscape)
    return () => document.removeEventListener('keydown', closeOnEscape)
  }, [loading, onClose])

  useEffect(() => {
    api.get<BackendPlan[]>('/admin/plans').then(items => {
      const active = items.filter(item => item.status === 'active')
      setPlans(active)
      setPlanId(active[0]?.id ?? '')
    }).catch(err => setError(err instanceof Error ? err.message : 'No se pudieron cargar los planes.'))
  }, [])

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setError(null)
    if (password !== confirmPassword) {
      setError('Las contraseñas no coinciden.')
      return
    }
    setLoading(true)
    try {
      const tenant = await api.post<TenantApi>('/admin/tenants', {
        nombre: nombre.trim(),
        email: email.trim().toLowerCase(),
        password,
        planId,
      })
      onCreated(tenant)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo crear el administrador.')
    } finally {
      setLoading(false)
    }
  }

  return createPortal(<div className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center sm:p-4" onMouseDown={(e) => { if (e.target === e.currentTarget && !loading) onClose() }}>
    <form onSubmit={submit} role="dialog" aria-modal="true" aria-labelledby="create-admin-title" className="w-full sm:max-w-lg h-[92dvh] sm:h-auto sm:max-h-[calc(100dvh-2rem)] flex flex-col overflow-hidden bg-card border-t sm:border border-border shadow-2xl rounded-t-xl sm:rounded-none">
      <div className="p-4 sm:p-5 border-b border-border flex items-start justify-between gap-4 shrink-0 bg-card">
        <div><div className="inline-flex items-center gap-1.5 text-secondary font-mono text-[9px] tracking-widest"><Crown size={11}/>SUPER ADMIN</div><h2 id="create-admin-title" className="font-heading text-2xl font-black uppercase mt-1">Crear administrador</h2><p className="text-xs text-muted-foreground mt-1">Creará una cuenta administradora y un tenant nuevo.</p></div>
        <button type="button" onClick={onClose} disabled={loading} className="p-1.5 text-muted-foreground hover:text-foreground disabled:opacity-40" aria-label="Cerrar"><X size={16}/></button>
      </div>
      <div className="p-4 sm:p-5 space-y-4 flex-1 min-h-0 overflow-y-auto">
        {error && <div className="flex items-start gap-2 bg-primary/10 border border-primary/20 p-3 text-xs text-primary"><AlertTriangle size={14} className="shrink-0 mt-0.5"/><span>{error}</span></div>}
        <Field label="NOMBRE COMPLETO"><input autoFocus required minLength={2} maxLength={100} value={nombre} onChange={e => setNombre(e.target.value)} className="control" placeholder="Ej. María González" disabled={loading}/></Field>
        <Field label="CORREO ELECTRÓNICO"><input required type="email" maxLength={150} value={email} onChange={e => setEmail(e.target.value)} className="control" placeholder="admin@empresa.com" disabled={loading}/></Field>
        <Field label="PLAN INICIAL" hint="Suscripción activa">
          <button type="button" onClick={() => setShowPlanPicker(true)} disabled={loading || plans.length === 0} className="md:hidden control w-full text-left flex items-center justify-between gap-3">
            <span>{plans.find(plan => plan.id === planId) ? `${plans.find(plan => plan.id === planId)!.name} · $${(plans.find(plan => plan.id === planId)!.priceAmount / 100).toLocaleString('en-US')} USD / mes` : 'Seleccionar plan'}</span><ChevronRight size={14} className="text-muted-foreground"/>
          </button>
          <select required value={planId} onChange={e => setPlanId(e.target.value)} className="control hidden md:block" disabled={loading || plans.length === 0}>
            {plans.length === 0 && <option value="">No hay planes activos</option>}
            {plans.map(plan => <option key={plan.id} value={plan.id}>{plan.name} · ${(plan.priceAmount / 100).toLocaleString('en-US')} USD / {plan.billingPeriod === 'year' ? 'año' : 'mes'}</option>)}
          </select>
        </Field>
        <Field label="CONTRASEÑA TEMPORAL" hint="Mínimo 8 caracteres">
          <div className="relative"><input required type={showPassword ? 'text' : 'password'} minLength={8} maxLength={100} value={password} onChange={e => setPassword(e.target.value)} className="control pr-10" placeholder="••••••••" disabled={loading}/><button type="button" onClick={() => setShowPassword(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}>{showPassword ? <EyeOff size={14}/> : <Eye size={14}/>}</button></div>
        </Field>
        <Field label="CONFIRMAR CONTRASEÑA"><input required type={showPassword ? 'text' : 'password'} minLength={8} maxLength={100} value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} className="control" placeholder="••••••••" disabled={loading}/></Field>
        <div className="bg-secondary/5 border border-secondary/15 p-3 text-[10px] text-muted-foreground leading-relaxed"><strong className="text-secondary font-mono">CUENTA REAL:</strong> el administrador podrá iniciar sesión con estas credenciales y completará la creación de su primera bodega desde el onboarding.</div>
      </div>
      <div className="p-3 sm:p-4 border-t border-border flex gap-2 shrink-0 bg-card"><button type="button" onClick={onClose} disabled={loading} className="btn-outline flex-1 sm:flex-none sm:ml-auto justify-center">Cancelar</button><button type="submit" disabled={loading || !planId} className="btn-primary flex-1 sm:flex-none sm:min-w-40 justify-center disabled:opacity-60">{loading ? <><Loader2 size={13} className="animate-spin"/>Creando...</> : <><Plus size={13}/>Crear administrador</>}</button></div>
    </form>
    {showPlanPicker && <div className="fixed inset-0 z-[110] bg-black/70 flex items-end md:hidden" onMouseDown={e => { if (e.target === e.currentTarget) setShowPlanPicker(false) }}><div className="w-full max-h-[75dvh] bg-card border-t border-border rounded-t-xl overflow-hidden shadow-2xl">
      <div className="p-4 border-b border-border flex items-center justify-between"><div><div className="eyebrow text-secondary">SUSCRIPCIÓN</div><h3 className="font-heading text-xl font-black uppercase mt-1">Seleccionar plan</h3></div><button type="button" onClick={() => setShowPlanPicker(false)} className="w-9 h-9 border border-border flex items-center justify-center"><X size={15}/></button></div>
      <div className="p-3 space-y-2 overflow-y-auto max-h-[calc(75dvh-5rem)]">{plans.map(plan => { const selected = plan.id === planId; return <button type="button" key={plan.id} onClick={() => { setPlanId(plan.id); setShowPlanPicker(false) }} className={`w-full p-4 border text-left transition-colors ${selected ? 'border-secondary/50 bg-secondary/[0.06]' : 'border-border bg-background/20'}`}><div className="flex items-center gap-3"><span className={`w-5 h-5 border flex items-center justify-center shrink-0 ${selected ? 'bg-secondary border-secondary text-background' : 'border-border text-transparent'}`}><Check size={12}/></span><div className="flex-1 min-w-0"><div className="font-heading text-lg font-black uppercase">{plan.name}</div><div className="text-[10px] font-mono text-muted-foreground mt-1">${(plan.priceAmount / 100).toLocaleString('en-US')} USD / {plan.billingPeriod === 'year' ? 'año' : 'mes'}</div></div>{selected && <span className="text-[8px] font-mono text-secondary">SELECCIONADO</span>}</div></button> })}</div>
    </div></div>}
  </div>, document.body)
}

function CreatePlanModal({ onClose, onCreated }: { onClose: () => void; onCreated: (plan: BackendPlan) => void }) {
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [description, setDescription] = useState('')
  const [price, setPrice] = useState('')
  const [features, setFeatures] = useState<Array<FeatureApi & { enabled: boolean; limitValue: number | null }>>([])
  const [permissions, setPermissions] = useState<PermissionApi[]>([])
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => { api.get<FeatureApi[]>('/admin/features').then(items => setFeatures(items.map(item => ({ ...item, enabled: false, limitValue: null })))).catch(err => setError(err instanceof Error ? err.message : 'No se cargaron las capacidades.')) }, [])
  useEffect(() => { api.get<PermissionApi[]>('/admin/plan-permissions').then(setPermissions).catch(err => setError(err instanceof Error ? err.message : 'No se cargaron los módulos.')) }, [])
  async function submit(event: React.FormEvent) {
    event.preventDefault(); setLoading(true); setError(null)
    try {
      const plan = await api.post<BackendPlan>('/admin/plans', { name: name.trim(), code: code.trim().toLowerCase(), description: description.trim(), priceAmount: Math.round(Number(price) * 100), billingPeriod: 'month', features: features.map(f => ({ code: f.code, enabled: f.enabled, limitValue: f.enabled ? f.limitValue : null })), permissions: selectedPermissions })
      onCreated(plan)
    } catch (err) { setError(err instanceof Error ? err.message : 'No se pudo crear el plan.') } finally { setLoading(false) }
  }
  return createPortal(<div className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm flex items-start justify-center p-2 sm:p-4 overflow-hidden" onMouseDown={e => { if (e.target === e.currentTarget && !loading) onClose() }}><form onSubmit={submit} role="dialog" aria-modal="true" className="w-full max-w-2xl h-[calc(100dvh-1rem)] sm:h-[calc(100dvh-2rem)] flex flex-col overflow-hidden bg-card border border-border shadow-2xl">
    <div className="p-5 border-b border-border flex justify-between shrink-0 bg-card"><div><div className="eyebrow text-secondary">SUPER ADMIN</div><h2 className="font-heading text-2xl font-black uppercase mt-1">Crear plan</h2><p className="text-xs text-muted-foreground mt-1">El plan se crea como borrador y después podrás publicarlo.</p></div><button onClick={onClose} disabled={loading}><X size={16}/></button></div>
    <div className="p-5 space-y-4 flex-1 min-h-0 overflow-y-auto">{error && <div className="bg-primary/10 border border-primary/20 p-3 text-xs text-primary">{error}</div>}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3"><Field label="NOMBRE" hint="Visible para el cliente"><input required minLength={2} value={name} onChange={e => { setName(e.target.value); if (!code) setCode(e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')) }} className="control" placeholder="Ej. Profesional"/></Field><Field label="CÓDIGO" hint="Minúsculas, sin espacios"><input required pattern="[a-z0-9_-]{2,40}" value={code} onChange={e => setCode(e.target.value)} className="control font-mono" placeholder="Ej. profesional"/></Field></div>
      <Field label="DESCRIPCIÓN" hint="Resumen comercial del plan"><textarea value={description} onChange={e => setDescription(e.target.value)} className="control min-h-20 resize-none" placeholder="Ej. Para empresas en crecimiento que necesitan mayor control y capacidad."/></Field>
      <Field label="PRECIO MENSUAL (USD)"><input required type="number" min="0" step="0.01" value={price} onChange={e => setPrice(e.target.value)} className="control" placeholder="49.00"/></Field>
      <div><div className="eyebrow mb-2">CAPACIDADES Y LÍMITES</div><div className="border border-border divide-y divide-border">{features.map((feature, index) => <div key={feature.code} className="p-3 flex items-center gap-3"><input type="checkbox" checked={feature.enabled} onChange={e => setFeatures(prev => prev.map((f, i) => i === index ? { ...f, enabled: e.target.checked } : f))} className="accent-[#ABF768]"/><div className="flex-1"><div className="text-xs">{feature.name}</div><div className="text-[9px] font-mono text-muted-foreground">{feature.code}</div></div>{feature.type !== 'boolean' && feature.enabled && <input type="number" min={0} value={feature.limitValue ?? ''} onChange={e => setFeatures(prev => prev.map((f, i) => i === index ? { ...f, limitValue: e.target.value === '' ? null : Number(e.target.value) } : f))} placeholder="Ilimitado" className="control w-28"/>}</div>)}</div></div>
      <div><div className="eyebrow mb-2">MÓDULOS Y PERMISOS DISPONIBLES</div><PermissionModuleSelector catalog={permissions} selected={selectedPermissions} onChange={setSelectedPermissions}/></div>
    </div>
    <div className="shrink-0 px-5 py-4 flex justify-end gap-2 border-t border-border bg-card shadow-[0_-12px_24px_rgba(0,0,0,0.18)]"><button type="button" onClick={onClose} disabled={loading} className="btn-outline">Cancelar</button><button type="submit" disabled={loading} className="btn-primary min-w-32 justify-center">{loading ? <Loader2 size={13} className="animate-spin"/> : <Plus size={13}/>}Crear plan</button></div>
  </form></div>, document.body)
}

function PermissionModuleSelector({ catalog, selected, onChange }: { catalog: PermissionApi[]; selected: string[]; onChange: (keys: string[]) => void }) {
  const groups = groupPermissions(catalog)
  const selectedSet = new Set(selected)
  const toggleKeys = (keys: string[], enabled: boolean) => {
    const next = new Set(selected)
    keys.forEach(key => enabled ? next.add(key) : next.delete(key))
    onChange([...next])
  }
  return <div className="grid grid-cols-1 2xl:grid-cols-2 gap-3">{Object.entries(groups).map(([module, permissions]) => {
    const keys = permissions.map(permission => permission.key)
    const enabledCount = keys.filter(key => selectedSet.has(key)).length
    const submodules = groupSubmodules(permissions)
    const moduleEnabled = enabledCount === keys.length && keys.length > 0
    return <section key={module} className={`border transition-all duration-200 ${enabledCount > 0 ? 'border-secondary/35 bg-secondary/[0.035] shadow-[inset_3px_0_0_#ABF768]' : 'border-border bg-background/15 hover:border-foreground/20'}`}>
      <button type="button" onClick={() => toggleKeys(keys, !moduleEnabled)} aria-pressed={moduleEnabled} className="w-full flex items-center gap-3 px-4 py-3 cursor-pointer border-b border-border/70 text-left">
        <span className={`w-5 h-5 flex items-center justify-center border transition-colors ${moduleEnabled ? 'bg-secondary border-secondary text-background' : enabledCount > 0 ? 'border-secondary text-secondary' : 'border-border text-transparent'}`}>
          <Check size={13}/>
        </span>
        <span className="uppercase font-heading font-black text-lg tracking-wide">{moduleLabel(module)}</span>
        <span className={`ml-auto px-2 py-1 text-[9px] font-mono border ${enabledCount > 0 ? 'text-secondary border-secondary/25 bg-secondary/10' : 'text-muted-foreground border-border'}`}>{enabledCount} / {keys.length}</span>
      </button>
      <div className="p-3 space-y-2">{sortedSubmodules(module, submodules).map(([submodule, submodulePermissions]) => {
      const submoduleKeys = submodulePermissions.map(permission => permission.key)
      const submoduleEnabled = submoduleKeys.filter(key => selectedSet.has(key)).length
      const allSubmoduleEnabled = submoduleEnabled === submoduleKeys.length && submoduleKeys.length > 0
      return <div key={submodule} className={`p-3 border ${submoduleEnabled > 0 ? 'border-secondary/20 bg-secondary/[0.025]' : 'border-border/70'}`}>
        <button type="button" onClick={() => toggleKeys(submoduleKeys, !allSubmoduleEnabled)} aria-pressed={allSubmoduleEnabled} className="w-full flex items-center gap-2 cursor-pointer text-left">
          <span className={`w-4 h-4 flex items-center justify-center border ${allSubmoduleEnabled ? 'bg-secondary border-secondary text-background' : submoduleEnabled > 0 ? 'border-secondary text-secondary' : 'border-border text-transparent'}`}><Check size={10}/></span>
          <span className="text-[10px] font-semibold uppercase tracking-wide">{submoduleLabel(module, submodule)}</span><span className="ml-auto text-[8px] font-mono text-muted-foreground">{submoduleEnabled}/{submoduleKeys.length}</span>
        </button>
        <div className="mt-2.5 flex flex-wrap gap-1.5">{submodulePermissions.map(permission => {
          const active = selectedSet.has(permission.key)
          return <button type="button" key={permission.key} title={permission.descripcion} aria-pressed={active} onClick={() => toggleKeys([permission.key], !active)} className={`cursor-pointer select-none inline-flex items-center gap-1.5 px-2.5 py-1.5 border text-[9px] font-mono transition-all ${active ? 'border-secondary/40 bg-secondary/15 text-secondary shadow-sm' : 'border-border text-muted-foreground hover:text-foreground hover:border-foreground/25 hover:bg-muted'}`}>{active && <Check size={9}/>}<span>{permission.accion}</span></button>
        })}</div>
      </div>
    })}</div>
    </section>
  })}</div>
}

function ModuleBadges({ catalog, selected }: { catalog: PermissionApi[]; selected: string[] }) {
  const allowed = new Set(selected)
  const modules = Object.entries(groupPermissions(catalog)).filter(([, permissions]) => permissions.some(permission => allowed.has(permission.key))).map(([module]) => module)
  return <div className="flex flex-wrap gap-1.5">{modules.length ? modules.map(module => <span key={module} className="px-2 py-1 bg-secondary/10 border border-secondary/20 text-secondary text-[9px] font-mono uppercase">{moduleLabel(module)}</span>) : <span className="text-[10px] text-muted-foreground">Sin módulos habilitados</span>}</div>
}

function PlanPreviewCard({ plan, catalog }: { plan: Plan; catalog: PermissionApi[] }) {
  return <div className="bg-card border border-primary/30 overflow-hidden shadow-2xl animate-[planPreviewIn_.4s_ease-out]">
    <div className="h-0.5" style={{ backgroundColor: plan.color }}/>
    <div className="p-4">
      <div className="flex justify-between items-center"><h2 className="text-xl uppercase font-black font-heading">{plan.name}</h2>{plan.active ? <ToggleRight size={18} className="text-secondary"/> : <ToggleLeft size={18} className="text-muted-foreground"/>}</div>
      <div className="mt-3 flex items-end gap-2"><span className="text-3xl font-black font-heading">${Number.isFinite(plan.price) ? plan.price : 0}</span><span className="text-[10px] text-muted-foreground mb-1">USD / {plan.period}</span></div>
      <p className="text-[10px] leading-relaxed text-muted-foreground mt-2 line-clamp-2">{plan.desc || 'Sin descripción.'}</p>
      <div className="mt-4">{plan.featureItems.map(feature => <div key={feature.code} className="flex items-center gap-2 text-[10px] border-b border-border/50 py-1.5 last:border-b-0">
        <Check size={11} style={{ color: feature.enabled ? plan.color : '#888880' }} className={feature.enabled ? '' : 'opacity-30'}/><span className={`flex-1 truncate ${feature.enabled ? '' : 'text-muted-foreground'}`}>{feature.name}</span>
        {feature.type !== 'boolean' && feature.enabled && <span className="font-mono text-[7px] text-muted-foreground whitespace-nowrap">{feature.limitValue == null ? 'ILIMITADO' : `MÁX. ${feature.limitValue}`}</span>}
      </div>)}</div>
      <div className="mt-3 pt-3 border-t border-border"><div className="text-[7px] font-mono tracking-widest text-muted-foreground mb-1.5">MÓDULOS DEL PLAN</div><CompactModuleBadges catalog={catalog} selected={plan.permissionKeys}/></div>
    </div>
    <div className="px-4 py-2.5 border-t border-border bg-background/20"><div className="flex justify-between text-[8px] font-mono text-muted-foreground"><span>{plan.empresas} EMPRESAS</span><span>{money(plan.price * plan.empresas)} MRR</span></div></div>
  </div>
}

function CompactModuleBadges({ catalog, selected }: { catalog: PermissionApi[]; selected: string[] }) {
  const allowed = new Set(selected)
  const modules = Object.entries(groupPermissions(catalog)).filter(([, permissions]) => permissions.some(permission => allowed.has(permission.key))).map(([module]) => module)
  return <div className="flex flex-wrap gap-1">{modules.length ? modules.map(module => <span key={module} className="px-1.5 py-0.5 bg-secondary/10 border border-secondary/20 text-secondary text-[7px] font-mono uppercase">{moduleLabel(module)}</span>) : <span className="text-[8px] text-muted-foreground">Sin módulos habilitados</span>}</div>
}

function groupPermissions(catalog: PermissionApi[]): Record<string, PermissionApi[]> {
  return catalog.reduce<Record<string, PermissionApi[]>>((groups, permission) => {
    const module = permission.modulo.split('.')[0]
    if (!groups[module]) groups[module] = []
    groups[module].push(permission)
    return groups
  }, {})
}

function groupSubmodules(permissions: PermissionApi[]): Record<string, PermissionApi[]> {
  return permissions.reduce<Record<string, PermissionApi[]>>((groups, permission) => {
    const parts = permission.modulo.split('.')
    const submodule = parts.length > 1 ? parts.slice(1).join('.') : '__module__'
    if (!groups[submodule]) groups[submodule] = []
    groups[submodule].push(permission)
    return groups
  }, {})
}

const SUBMODULE_LABELS: Record<string, string> = {
  'tecnicos.solicitudes': 'Solicitud de Recursos',
  'tecnicos.herramientas': 'Herramientas Obligatorias',
  'tecnicos.alertas': 'Alertas de Kit',
  'tecnicos.devoluciones': 'Devoluciones',
  'tecnicos.asignadas': 'Herramientas Asignadas',
  'tecnicos.proyectos': 'Proyecto',
  'tecnicos.checklist': 'Checklist',
  'reportes.salidas': 'Salida',
  'reportes.entradas': 'Entrada',
  'reportes.kardex': 'Kardex',
}

const MODULE_LABELS: Record<string, string> = {
  auditoria: 'Auditoría inteligente',
}

function moduleLabel(module: string): string {
  return MODULE_LABELS[module] ?? module
}

const SUBMODULE_ORDER: Record<string, string[]> = {
  tecnicos: ['__module__', 'solicitudes', 'herramientas', 'alertas', 'devoluciones', 'asignadas', 'proyectos', 'checklist'],
  reportes: ['__module__', 'salidas', 'entradas', 'kardex'],
}

function sortedSubmodules(module: string, groups: Record<string, PermissionApi[]>): [string, PermissionApi[]][] {
  const order = SUBMODULE_ORDER[module] ?? ['__module__']
  return Object.entries(groups).sort(([a], [b]) => {
    const aIndex = order.indexOf(a)
    const bIndex = order.indexOf(b)
    return (aIndex < 0 ? order.length : aIndex) - (bIndex < 0 ? order.length : bIndex) || a.localeCompare(b)
  })
}

function submoduleLabel(module: string, submodule: string): string {
  if (submodule === '__module__') return 'Acceso al módulo'
  const key = `${module}.${submodule}`
  return SUBMODULE_LABELS[key] ?? submodule.split('.').map(part => part.charAt(0).toUpperCase() + part.slice(1)).join(' / ')
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return <label className="block"><span className="flex justify-between eyebrow mb-2"><span>{label}</span>{hint && <span>{hint}</span>}</span>{children}</label>
}
