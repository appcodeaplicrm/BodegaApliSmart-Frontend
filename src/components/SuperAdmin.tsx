import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Activity, AlertTriangle, Ban, Building2, Check, CheckCircle2, Clock, Crown, Eye, EyeOff,
  DollarSign, Ellipsis, Globe, Plus, Search, ToggleLeft, ToggleRight, Users,
  Warehouse, X, Loader2,
} from 'lucide-react'
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { api } from '../lib/api'
import { HeaderNotificationsButton } from './HeaderNotificationsButton'

type PlanKey = 'Starter' | 'Pro' | 'Enterprise'
type EstadoEmpresa = 'activa' | 'trial' | 'suspendida'
type Empresa = {
  id: string; backendId?: string; nombre: string; rut: string; plan: string; usuarios: number;
  bodegas: number; acceso: string; estado: EstadoEmpresa; mrr: number
}
type TenantApi = {
  id: string; nombre: string; email: string; estado: 'Activo' | 'Inactivo';
  metricas: { usuarios: number; bodegas: number };
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
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    api.get<TenantApi[]>('/admin/tenants').then((tenants) => {
      if (!tenants.length) return
      setEmpresas(tenants.map((t, i) => tenantToEmpresa(t, i)))
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
      <div className="p-4 border-b border-border flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-52"><Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"/><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por nombre o RUT..." className="control pl-9 pr-8"/>{search && <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground"><X size={13}/></button>}</div>
        <Select value={filterPlan} onChange={setFilterPlan} options={['Todos', ...Array.from(new Set(empresas.map(e => e.plan)))]} />
        <Select value={filterEstado} onChange={(v) => setFilterEstado(v as 'Todos' | EstadoEmpresa)} options={['Todos', 'activa', 'trial', 'suspendida']} />
        <button onClick={() => setShowCreateAdmin(true)} className="ml-auto btn-primary"><Plus size={13}/>Crear administrador</button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px] text-left">
          <thead><tr>{['EMPRESA', 'RUT', 'PLAN', 'USUARIOS', 'BODEGAS', 'ÚLTIMO ACCESO', 'ESTADO', ''].map(h => <th key={h} className="px-4 py-3 text-[9px] font-normal tracking-widest text-muted-foreground border-b border-border font-mono">{h}</th>)}</tr></thead>
          <tbody>{filtered.map((e) => <tr key={e.id} className="border-b border-border/60 hover:bg-muted/20">
            <td className="px-4 py-3"><div className="flex gap-2.5 items-center"><span className="w-8 h-8 bg-muted flex items-center justify-center"><Building2 size={14} className="text-muted-foreground"/></span><span><span className="block text-xs font-medium">{e.nombre}</span><span className="text-[9px] font-mono text-muted-foreground">{e.id}</span></span></div></td>
            <td className="px-4 py-3 text-[10px] font-mono text-muted-foreground">{e.rut}</td><td className="px-4 py-3">{e.backendId && availablePlans.length ? <select value={e.plan} onChange={async event => { const selected = availablePlans.find(plan => plan.name === event.target.value); if (!selected) return; await api.post(`/admin/tenants/${e.backendId}/subscription`, { planId: selected.id, status: 'active' }); setEmpresas(prev => prev.map(item => item.id === e.id ? { ...item, plan: event.target.value as PlanKey, mrr: selected.priceAmount / 100, estado: 'activa' } : item)) }} className="bg-transparent text-[9px] font-mono outline-none"><option className="bg-card">{e.plan}</option>{availablePlans.filter(plan => plan.name !== e.plan).map(plan => <option className="bg-card" key={plan.id}>{plan.name}</option>)}</select> : <PlanBadge plan={e.plan}/>}</td>
            <td className="px-4 py-3 text-xs">{e.usuarios}</td><td className="px-4 py-3 text-xs">{e.bodegas}</td><td className="px-4 py-3 text-[10px] font-mono text-muted-foreground">{e.acceso}</td>
            <td className="px-4 py-3"><StatusBadge estado={e.estado}/></td>
            <td className="px-4 py-3 relative"><button onClick={() => setMenu(menu === e.id ? null : e.id)} className="p-1.5 text-muted-foreground hover:text-foreground"><Ellipsis size={15}/></button>{menu === e.id && <div ref={menuRef} className="absolute right-4 top-10 z-50 w-40 bg-card border border-border rounded shadow-xl p-1 text-xs"><MenuItem>Editar empresa</MenuItem><MenuItem>Cambiar plan</MenuItem><MenuItem>Ver detalles</MenuItem><MenuItem danger={e.estado !== 'suspendida'} success={e.estado === 'suspendida'} onClick={async () => { if (!e.backendId) return; const reactivar = e.estado === 'suspendida'; await api.patch(`/admin/tenants/${e.backendId}/status`, { estado: reactivar ? 'Activo' : 'Inactivo' }); setEmpresas(prev => prev.map(item => item.id === e.id ? { ...item, estado: reactivar ? 'activa' : 'suspendida' } : item)); setCreatedMessage(reactivar ? `${e.nombre} fue reactivada correctamente.` : `${e.nombre} fue suspendida.`); setMenu(null) }}>{e.estado === 'suspendida' ? 'Reactivar empresa' : 'Suspender'}</MenuItem></div>}</td>
          </tr>)}</tbody>
        </table>
      </div>
      <div className="p-4 flex justify-between items-center text-[10px] font-mono text-muted-foreground"><span>Mostrando {filtered.length} de {empresas.length} resultados</span><div className="flex gap-1"><Page active>1</Page><Page>2</Page><Page>3</Page></div></div>
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
    <div className="bg-card border border-secondary/20 p-4 flex items-center justify-between gap-4">
      <div><div className="eyebrow">MRR PROYECTADO</div><div className="text-3xl font-black font-heading">{money(totalMRR)}<span className="text-xs font-normal text-muted-foreground ml-2">/ mes</span></div></div>
      <button onClick={() => setShowCreatePlan(true)} className="btn-primary"><Plus size={13}/>Crear plan</button>
    </div>
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
      {planes.map((plan) => {
        const isEditing = editing === plan.name
        const draft = isEditing && editData ? editData : plan
        return <div key={plan.name} className={`bg-card border overflow-hidden flex flex-col ${isEditing ? 'border-primary/50 ring-1 ring-primary/20' : 'border-border'}`}>
          <div className="h-0.5" style={{ backgroundColor: plan.color }}/>
          <div className="p-5 flex-1">
            <div className="flex justify-between items-center"><h2 className="text-2xl uppercase font-black font-heading">{plan.name}</h2><button onClick={() => void toggleActive(plan)} title={plan.active ? 'Desactivar plan' : 'Activar plan'}>{plan.active ? <ToggleRight size={22} className="text-secondary"/> : <ToggleLeft size={22} className="text-muted-foreground"/>}</button></div>
            <div className="mt-5 flex items-end gap-2">{isEditing ? <input type="number" value={draft.price} onChange={e => setEditData({ ...draft, price: Number(e.target.value) })} className="control w-28 text-2xl"/> : <span className="text-4xl font-black font-heading">${plan.price}</span>}<span className="text-xs text-muted-foreground mb-1">USD / {plan.period}</span></div>
            {isEditing ? <textarea value={draft.desc} onChange={e => setEditData({ ...draft, desc: e.target.value })} className="control mt-4 min-h-20 resize-none"/> : <p className="text-xs text-muted-foreground mt-4 min-h-10">{plan.desc}</p>}
            <div className="mt-6 space-y-2.5">{draft.featureItems.length ? draft.featureItems.map((feature, i) => <div key={feature.code} className="flex items-center gap-2 text-xs border-b border-border/50 pb-2">
              {isEditing ? <input type="checkbox" checked={feature.enabled} onChange={e => setEditData({ ...draft, featureItems: draft.featureItems.map((f, n) => n === i ? { ...f, enabled: e.target.checked } : f) })} className="accent-[#ABF768]"/> : <Check size={13} style={{ color: feature.enabled ? plan.color : '#888880' }} className={feature.enabled ? '' : 'opacity-30'}/>}<span className={`flex-1 ${feature.enabled ? '' : 'text-muted-foreground'}`}>{feature.name}</span>
              {feature.type !== 'boolean' && feature.enabled && (isEditing ? <input type="number" min={0} value={feature.limitValue ?? ''} placeholder="Ilimitado" onChange={e => setEditData({ ...draft, featureItems: draft.featureItems.map((f, n) => n === i ? { ...f, limitValue: e.target.value === '' ? null : Number(e.target.value) } : f) })} className="control py-1 w-24"/> : <span className="font-mono text-[9px] text-muted-foreground">{feature.limitValue == null ? 'ILIMITADO' : `MÁX. ${feature.limitValue}`}</span>)}
            </div>) : draft.features.map((feature, i) => <div key={i} className="flex items-center gap-2 text-xs"><Check size={13} style={{ color: plan.color }}/>{feature}</div>)}</div>
            <div className="mt-5 pt-4 border-t border-border"><div className="eyebrow mb-2">MÓDULOS DEL PLAN</div>{isEditing ? <PermissionModuleSelector catalog={permissionCatalog} selected={draft.permissionKeys} onChange={permissionKeys => setEditData({ ...draft, permissionKeys })}/> : <ModuleBadges catalog={permissionCatalog} selected={draft.permissionKeys}/>}</div>
          </div>
          <div className="p-4 border-t border-border bg-background/20">
            {!plan.active && <div className="text-[10px] text-primary font-mono mb-3">ESTE PLAN NO ADMITE NUEVAS EMPRESAS</div>}
            <div className="flex justify-between text-[10px] font-mono text-muted-foreground mb-3"><span>{plan.empresas} EMPRESAS</span><span>{money(plan.price * plan.empresas)} MRR</span></div>
            {isEditing ? <div className="grid grid-cols-2 gap-2"><button onClick={save} className="btn-primary justify-center">Guardar</button><button onClick={() => { setEditing(null); setEditData(null) }} className="btn-outline justify-center">Cancelar</button></div> : <button onClick={() => startEdit(plan)} className="btn-outline w-full justify-center">Editar plan</button>}
          </div>
        </div>
      })}
    </div>
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
    acceso: 'Sin ingresos aún',
    estado: tenant.estado !== 'Activo' || ['canceled', 'expired', 'past_due'].includes(tenant.subscription?.status ?? '') ? 'suspendida' : tenant.subscription?.status === 'trialing' ? 'trial' : 'activa',
  }
}

function CreateAdminModal({ onClose, onCreated }: { onClose: () => void; onCreated: (tenant: TenantApi) => void }) {
  const [nombre, setNombre] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [plans, setPlans] = useState<BackendPlan[]>([])
  const [planId, setPlanId] = useState('')
  const [showPassword, setShowPassword] = useState(false)
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

  return <div className="fixed inset-0 z-[60] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4" onMouseDown={(e) => { if (e.target === e.currentTarget && !loading) onClose() }}>
    <div role="dialog" aria-modal="true" aria-labelledby="create-admin-title" className="w-full max-w-lg bg-card border border-border shadow-2xl">
      <div className="p-5 border-b border-border flex items-start justify-between gap-4">
        <div><div className="inline-flex items-center gap-1.5 text-secondary font-mono text-[9px] tracking-widest"><Crown size={11}/>SUPER ADMIN</div><h2 id="create-admin-title" className="font-heading text-2xl font-black uppercase mt-1">Crear administrador</h2><p className="text-xs text-muted-foreground mt-1">Creará una cuenta administradora y un tenant nuevo.</p></div>
        <button type="button" onClick={onClose} disabled={loading} className="p-1.5 text-muted-foreground hover:text-foreground disabled:opacity-40" aria-label="Cerrar"><X size={16}/></button>
      </div>
      <form onSubmit={submit} className="p-5 space-y-4">
        {error && <div className="flex items-start gap-2 bg-primary/10 border border-primary/20 p-3 text-xs text-primary"><AlertTriangle size={14} className="shrink-0 mt-0.5"/><span>{error}</span></div>}
        <Field label="NOMBRE COMPLETO"><input autoFocus required minLength={2} maxLength={100} value={nombre} onChange={e => setNombre(e.target.value)} className="control" placeholder="Ej. María González" disabled={loading}/></Field>
        <Field label="CORREO ELECTRÓNICO"><input required type="email" maxLength={150} value={email} onChange={e => setEmail(e.target.value)} className="control" placeholder="admin@empresa.com" disabled={loading}/></Field>
        <Field label="PLAN INICIAL" hint="Suscripción activa">
          <select required value={planId} onChange={e => setPlanId(e.target.value)} className="control" disabled={loading || plans.length === 0}>
            {plans.length === 0 && <option value="">No hay planes activos</option>}
            {plans.map(plan => <option key={plan.id} value={plan.id}>{plan.name} · ${(plan.priceAmount / 100).toLocaleString('en-US')} USD / {plan.billingPeriod === 'year' ? 'año' : 'mes'}</option>)}
          </select>
        </Field>
        <Field label="CONTRASEÑA TEMPORAL" hint="Mínimo 8 caracteres">
          <div className="relative"><input required type={showPassword ? 'text' : 'password'} minLength={8} maxLength={100} value={password} onChange={e => setPassword(e.target.value)} className="control pr-10" placeholder="••••••••" disabled={loading}/><button type="button" onClick={() => setShowPassword(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}>{showPassword ? <EyeOff size={14}/> : <Eye size={14}/>}</button></div>
        </Field>
        <Field label="CONFIRMAR CONTRASEÑA"><input required type={showPassword ? 'text' : 'password'} minLength={8} maxLength={100} value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} className="control" placeholder="••••••••" disabled={loading}/></Field>
        <div className="bg-secondary/5 border border-secondary/15 p-3 text-[10px] text-muted-foreground leading-relaxed"><strong className="text-secondary font-mono">CUENTA REAL:</strong> el administrador podrá iniciar sesión con estas credenciales y completará la creación de su primera bodega desde el onboarding.</div>
        <div className="flex justify-end gap-2 pt-2"><button type="button" onClick={onClose} disabled={loading} className="btn-outline">Cancelar</button><button type="submit" disabled={loading || !planId} className="btn-primary min-w-40 justify-center disabled:opacity-60">{loading ? <><Loader2 size={13} className="animate-spin"/>Creando...</> : <><Plus size={13}/>Crear administrador</>}</button></div>
      </form>
    </div>
  </div>
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
  return <div className="fixed inset-0 z-[60] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4" onMouseDown={e => { if (e.target === e.currentTarget && !loading) onClose() }}><div role="dialog" aria-modal="true" className="w-full max-w-2xl max-h-[90dvh] overflow-y-auto bg-card border border-border shadow-2xl">
    <div className="p-5 border-b border-border flex justify-between"><div><div className="eyebrow text-secondary">SUPER ADMIN</div><h2 className="font-heading text-2xl font-black uppercase mt-1">Crear plan</h2><p className="text-xs text-muted-foreground mt-1">El plan se crea como borrador y después podrás publicarlo.</p></div><button onClick={onClose} disabled={loading}><X size={16}/></button></div>
    <form onSubmit={submit} className="p-5 space-y-4">{error && <div className="bg-primary/10 border border-primary/20 p-3 text-xs text-primary">{error}</div>}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3"><Field label="NOMBRE"><input required minLength={2} value={name} onChange={e => { setName(e.target.value); if (!code) setCode(e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')) }} className="control"/></Field><Field label="CÓDIGO"><input required pattern="[a-z0-9_-]{2,40}" value={code} onChange={e => setCode(e.target.value)} className="control font-mono"/></Field></div>
      <Field label="DESCRIPCIÓN"><textarea value={description} onChange={e => setDescription(e.target.value)} className="control min-h-20 resize-none"/></Field>
      <Field label="PRECIO MENSUAL (USD)"><input required type="number" min="0" step="0.01" value={price} onChange={e => setPrice(e.target.value)} className="control" placeholder="49.00"/></Field>
      <div><div className="eyebrow mb-2">CAPACIDADES Y LÍMITES</div><div className="border border-border divide-y divide-border">{features.map((feature, index) => <div key={feature.code} className="p-3 flex items-center gap-3"><input type="checkbox" checked={feature.enabled} onChange={e => setFeatures(prev => prev.map((f, i) => i === index ? { ...f, enabled: e.target.checked } : f))} className="accent-[#ABF768]"/><div className="flex-1"><div className="text-xs">{feature.name}</div><div className="text-[9px] font-mono text-muted-foreground">{feature.code}</div></div>{feature.type !== 'boolean' && feature.enabled && <input type="number" min={0} value={feature.limitValue ?? ''} onChange={e => setFeatures(prev => prev.map((f, i) => i === index ? { ...f, limitValue: e.target.value === '' ? null : Number(e.target.value) } : f))} placeholder="Ilimitado" className="control w-28"/>}</div>)}</div></div>
      <div><div className="eyebrow mb-2">MÓDULOS Y PERMISOS DISPONIBLES</div><PermissionModuleSelector catalog={permissions} selected={selectedPermissions} onChange={setSelectedPermissions}/></div>
      <div className="flex justify-end gap-2"><button type="button" onClick={onClose} className="btn-outline">Cancelar</button><button disabled={loading} className="btn-primary min-w-32 justify-center">{loading ? <Loader2 size={13} className="animate-spin"/> : <Plus size={13}/>}Crear plan</button></div>
    </form>
  </div></div>
}

function PermissionModuleSelector({ catalog, selected, onChange }: { catalog: PermissionApi[]; selected: string[]; onChange: (keys: string[]) => void }) {
  const groups = groupPermissions(catalog)
  const selectedSet = new Set(selected)
  const toggleKeys = (keys: string[], enabled: boolean) => {
    const next = new Set(selected)
    keys.forEach(key => enabled ? next.add(key) : next.delete(key))
    onChange([...next])
  }
  return <div className="border border-border divide-y divide-border max-h-72 overflow-y-auto">{Object.entries(groups).map(([module, permissions]) => {
    const keys = permissions.map(permission => permission.key)
    const enabledCount = keys.filter(key => selectedSet.has(key)).length
    const submodules = groupSubmodules(permissions)
    return <div key={module} className="p-3"><label className="flex items-center gap-2 text-xs font-medium"><input type="checkbox" checked={enabledCount === keys.length && keys.length > 0} ref={element => { if (element) element.indeterminate = enabledCount > 0 && enabledCount < keys.length }} onChange={event => toggleKeys(keys, event.target.checked)} className="accent-[#ABF768]"/><span className="uppercase font-heading font-bold text-base">{module}</span><span className="ml-auto text-[9px] font-mono text-muted-foreground">{enabledCount}/{keys.length}</span></label><div className="mt-3 ml-5 space-y-3">{sortedSubmodules(module, submodules).map(([submodule, submodulePermissions]) => {
      const submoduleKeys = submodulePermissions.map(permission => permission.key)
      const submoduleEnabled = submoduleKeys.filter(key => selectedSet.has(key)).length
      return <div key={submodule} className="border-l border-border pl-3"><label className="flex items-center gap-2"><input type="checkbox" checked={submoduleEnabled === submoduleKeys.length && submoduleKeys.length > 0} ref={element => { if (element) element.indeterminate = submoduleEnabled > 0 && submoduleEnabled < submoduleKeys.length }} onChange={event => toggleKeys(submoduleKeys, event.target.checked)} className="accent-[#ABF768]"/><span className="text-[10px] font-semibold uppercase tracking-wide">{submoduleLabel(module, submodule)}</span><span className="text-[8px] font-mono text-muted-foreground">{submoduleEnabled}/{submoduleKeys.length}</span></label><div className="mt-1.5 flex flex-wrap gap-1.5">{submodulePermissions.map(permission => <label key={permission.key} title={permission.descripcion} className={`cursor-pointer px-2 py-1 border text-[9px] font-mono ${selectedSet.has(permission.key) ? 'border-secondary/30 bg-secondary/10 text-secondary' : 'border-border text-muted-foreground'}`}><input type="checkbox" className="sr-only" checked={selectedSet.has(permission.key)} onChange={event => toggleKeys([permission.key], event.target.checked)}/>{permission.accion}</label>)}</div></div>
    })}</div></div>
  })}</div>
}

function ModuleBadges({ catalog, selected }: { catalog: PermissionApi[]; selected: string[] }) {
  const allowed = new Set(selected)
  const modules = Object.entries(groupPermissions(catalog)).filter(([, permissions]) => permissions.some(permission => allowed.has(permission.key))).map(([module]) => module)
  return <div className="flex flex-wrap gap-1.5">{modules.length ? modules.map(module => <span key={module} className="px-2 py-1 bg-secondary/10 border border-secondary/20 text-secondary text-[9px] font-mono uppercase">{module}</span>) : <span className="text-[10px] text-muted-foreground">Sin módulos habilitados</span>}</div>
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
