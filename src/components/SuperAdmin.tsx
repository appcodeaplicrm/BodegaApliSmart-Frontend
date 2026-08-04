import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Activity, Ban, Building2, Check, CheckCircle2, Clock, Crown,
  DollarSign, Ellipsis, Globe, Plus, Search, ToggleLeft, ToggleRight, Users,
  Warehouse, X,
} from 'lucide-react'
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { api } from '../lib/api'

type PlanKey = 'Starter' | 'Pro' | 'Enterprise'
type EstadoEmpresa = 'activa' | 'trial' | 'suspendida'
type Empresa = {
  id: string; nombre: string; rut: string; plan: PlanKey; usuarios: number;
  bodegas: number; acceso: string; estado: EstadoEmpresa; mrr: number
}
type TenantApi = {
  id: string; nombre: string; estado: 'Activo' | 'Inactivo';
  metricas: { usuarios: number; bodegas: number }
}
type Plan = {
  name: PlanKey; price: number; period: string; desc: string; features: string[];
  active: boolean; empresas: number; color: string
}

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
  { name: 'Starter', price: 99, period: 'mes', desc: 'Para equipos pequeños que comienzan a ordenar su inventario.', features: ['1 bodega', 'Hasta 8 usuarios', 'Inventario y alertas', 'Soporte por email'], active: true, empresas: 18, color: '#888880' },
  { name: 'Pro', price: 490, period: 'mes', desc: 'Operación completa para empresas en crecimiento.', features: ['5 bodegas', 'Hasta 30 usuarios', 'Reportes avanzados', 'Soporte prioritario'], active: true, empresas: 11, color: '#E8593F' },
  { name: 'Enterprise', price: 1290, period: 'mes', desc: 'Control, escala y acompañamiento para grandes operaciones.', features: ['Bodegas ilimitadas', 'Usuarios ilimitados', 'Analítica avanzada', 'Soporte dedicado'], active: true, empresas: 6, color: '#ABF768' },
]

const COMPARATIVA = [
  ['Gestión de inventario', true, true, true], ['Alertas de stock', true, true, true],
  ['Reportes avanzados', false, true, true], ['Multi-bodega', false, true, true],
  ['Analítica ejecutiva', false, false, true], ['Soporte dedicado', false, false, true],
] as const

export function SuperAdminEmpresas() {
  const [empresas, setEmpresas] = useState(EMPRESAS_BASE)
  const [search, setSearch] = useState('')
  const [filterPlan, setFilterPlan] = useState<'Todos' | PlanKey>('Todos')
  const [filterEstado, setFilterEstado] = useState<'Todos' | EstadoEmpresa>('Todos')
  const [menu, setMenu] = useState<string | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    api.get<TenantApi[]>('/admin/tenants').then((tenants) => {
      if (!tenants.length) return
      setEmpresas(tenants.map((t, i) => {
        const fallback = EMPRESAS_BASE[i % EMPRESAS_BASE.length]
        return { ...fallback, id: `E-${String(i + 1).padStart(3, '0')}`, nombre: t.nombre, usuarios: t.metricas.usuarios, bodegas: t.metricas.bodegas, estado: t.estado === 'Activo' ? 'activa' : 'suspendida' }
      }))
    }).catch(() => { /* La demo visual funciona sin backend. */ })
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
        <Select value={filterPlan} onChange={(v) => setFilterPlan(v as 'Todos' | PlanKey)} options={['Todos', 'Starter', 'Pro', 'Enterprise']} />
        <Select value={filterEstado} onChange={(v) => setFilterEstado(v as 'Todos' | EstadoEmpresa)} options={['Todos', 'activa', 'trial', 'suspendida']} />
        <button className="ml-auto btn-primary"><Plus size={13}/>Nueva empresa</button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px] text-left">
          <thead><tr>{['EMPRESA', 'RUT', 'PLAN', 'USUARIOS', 'BODEGAS', 'ÚLTIMO ACCESO', 'ESTADO', ''].map(h => <th key={h} className="px-4 py-3 text-[9px] font-normal tracking-widest text-muted-foreground border-b border-border font-mono">{h}</th>)}</tr></thead>
          <tbody>{filtered.map((e) => <tr key={e.id} className="border-b border-border/60 hover:bg-muted/20">
            <td className="px-4 py-3"><div className="flex gap-2.5 items-center"><span className="w-8 h-8 bg-muted flex items-center justify-center"><Building2 size={14} className="text-muted-foreground"/></span><span><span className="block text-xs font-medium">{e.nombre}</span><span className="text-[9px] font-mono text-muted-foreground">{e.id}</span></span></div></td>
            <td className="px-4 py-3 text-[10px] font-mono text-muted-foreground">{e.rut}</td><td className="px-4 py-3"><PlanBadge plan={e.plan}/></td>
            <td className="px-4 py-3 text-xs">{e.usuarios}</td><td className="px-4 py-3 text-xs">{e.bodegas}</td><td className="px-4 py-3 text-[10px] font-mono text-muted-foreground">{e.acceso}</td>
            <td className="px-4 py-3"><StatusBadge estado={e.estado}/></td>
            <td className="px-4 py-3 relative"><button onClick={() => setMenu(menu === e.id ? null : e.id)} className="p-1.5 text-muted-foreground hover:text-foreground"><Ellipsis size={15}/></button>{menu === e.id && <div ref={menuRef} className="absolute right-4 top-10 z-50 w-40 bg-card border border-border rounded shadow-xl p-1 text-xs"><MenuItem>Editar empresa</MenuItem><MenuItem>Cambiar plan</MenuItem><MenuItem>Ver detalles</MenuItem><MenuItem danger>Suspender</MenuItem></div>}</td>
          </tr>)}</tbody>
        </table>
      </div>
      <div className="p-4 flex justify-between items-center text-[10px] font-mono text-muted-foreground"><span>Mostrando {filtered.length} de {empresas.length} resultados</span><div className="flex gap-1"><Page active>1</Page><Page>2</Page><Page>3</Page></div></div>
    </Panel>
  </SuperAdminShell>
}

export function SuperAdminPlanes() {
  const [planes, setPlanes] = useState(PLANES_INICIALES)
  const [editing, setEditing] = useState<PlanKey | null>(null)
  const [editData, setEditData] = useState<Plan | null>(null)
  const totalMRR = planes.reduce((sum, p) => sum + (p.active ? p.price * p.empresas : 0), 0)

  const startEdit = (plan: Plan) => { setEditing(plan.name); setEditData({ ...plan, features: [...plan.features] }) }
  const save = () => { if (editing && editData) setPlanes(prev => prev.map(p => p.name === editing ? editData : p)); setEditing(null); setEditData(null) }
  const toggleActive = (name: PlanKey) => setPlanes(prev => prev.map(p => p.name === name ? { ...p, active: !p.active } : p))

  return <SuperAdminShell title="Planes" subtitle="Configuración comercial y límites por suscripción">
    <div className="bg-card border border-secondary/20 p-4 flex items-center justify-between gap-4">
      <div><div className="eyebrow">MRR PROYECTADO</div><div className="text-3xl font-black font-heading">{money(totalMRR)}<span className="text-xs font-normal text-muted-foreground ml-2">/ mes</span></div></div>
      <button className="btn-primary"><Plus size={13}/>Crear plan</button>
    </div>
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
      {planes.map((plan) => {
        const isEditing = editing === plan.name
        const draft = isEditing && editData ? editData : plan
        return <div key={plan.name} className={`bg-card border overflow-hidden flex flex-col ${isEditing ? 'border-primary/50 ring-1 ring-primary/20' : 'border-border'}`}>
          <div className="h-0.5" style={{ backgroundColor: plan.color }}/>
          <div className="p-5 flex-1">
            <div className="flex justify-between items-center"><h2 className="text-2xl uppercase font-black font-heading">{plan.name}</h2><button onClick={() => toggleActive(plan.name)} title={plan.active ? 'Desactivar plan' : 'Activar plan'}>{plan.active ? <ToggleRight size={22} className="text-secondary"/> : <ToggleLeft size={22} className="text-muted-foreground"/>}</button></div>
            <div className="mt-5 flex items-end gap-2">{isEditing ? <input type="number" value={draft.price} onChange={e => setEditData({ ...draft, price: Number(e.target.value) })} className="control w-28 text-2xl"/> : <span className="text-4xl font-black font-heading">${plan.price}</span>}<span className="text-xs text-muted-foreground mb-1">USD / {plan.period}</span></div>
            {isEditing ? <textarea value={draft.desc} onChange={e => setEditData({ ...draft, desc: e.target.value })} className="control mt-4 min-h-20 resize-none"/> : <p className="text-xs text-muted-foreground mt-4 min-h-10">{plan.desc}</p>}
            <div className="mt-6 space-y-2.5">{draft.features.map((feature, i) => <div key={i} className="flex items-center gap-2 text-xs"><Check size={13} style={{ color: plan.color }} className="shrink-0"/>{isEditing ? <><input value={feature} onChange={e => setEditData({ ...draft, features: draft.features.map((f, n) => n === i ? e.target.value : f) })} className="control py-1 flex-1"/><button onClick={() => setEditData({ ...draft, features: draft.features.filter((_, n) => n !== i) })} className="text-muted-foreground hover:text-primary"><X size={13}/></button></> : feature}</div>)}</div>
            {isEditing && <button onClick={() => setEditData({ ...draft, features: [...draft.features, 'Nueva característica'] })} className="mt-4 text-[10px] font-mono text-primary flex items-center gap-1"><Plus size={11}/>AGREGAR FEATURE</button>}
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
  return <div className="h-full flex flex-col min-w-0"><header className="min-h-14 border-b border-border px-6 py-3 flex items-center gap-3 shrink-0"><div className="inline-flex items-center gap-1.5 px-2 py-1 rounded bg-secondary/10 border border-secondary/20"><Crown size={11} className="text-secondary"/><span className="text-secondary font-mono text-[9px]">SUPER ADMIN</span></div><div><h1 className="text-2xl uppercase leading-none font-heading font-black">{title}</h1><div className="eyebrow mt-1">{subtitle}</div></div></header><div className="flex-1 overflow-y-auto p-6 space-y-5">{children}</div></div>
}

function Kpi({ icon: Icon, label, value, sub, accent }: { icon: typeof Building2; label: string; value: string; sub: string; accent?: boolean }) { return <div className={`relative bg-card border p-4 overflow-hidden ${accent ? 'border-secondary/30 bg-secondary/5' : 'border-border'}`}>{accent && <span className="absolute left-0 top-0 h-full w-0.5 bg-secondary"/>}<div className="flex justify-between"><div className="eyebrow">{label}</div><Icon size={14} className={accent ? 'text-secondary' : 'text-muted-foreground'}/></div><div className="text-3xl font-heading font-black mt-2">{value}</div><div className="text-[10px] text-muted-foreground mt-1">{sub}</div></div> }
function Panel({ children, className = '' }: { children: React.ReactNode; className?: string }) { return <div className={`bg-card border border-border p-5 ${className}`}>{children}</div> }
function SectionTitle({ title, sub }: { title: string; sub: string }) { return <div><h2 className="text-xl uppercase font-heading font-black">{title}</h2><div className="eyebrow mt-1">{sub}</div></div> }
function MiniMetric({ label, value }: { label: string; value: string }) { return <div className="bg-muted/30 border border-border p-3"><div className="eyebrow">{label}</div><div className="font-heading font-bold text-lg mt-1">{value}</div></div> }
function Select({ value, onChange, options }: { value: string; onChange: (value: string) => void; options: string[] }) { return <select value={value} onChange={e => onChange(e.target.value)} className="control w-auto min-w-32">{options.map(o => <option key={o}>{o}</option>)}</select> }
function PlanBadge({ plan }: { plan: PlanKey }) { const classes = plan === 'Starter' ? 'bg-muted text-muted-foreground' : plan === 'Pro' ? 'bg-primary/15 text-primary' : 'bg-secondary/15 text-secondary'; return <span className={`px-2 py-1 text-[9px] font-mono ${classes}`}>{plan.toUpperCase()}</span> }
function StatusBadge({ estado }: { estado: EstadoEmpresa }) { const Icon = estado === 'activa' ? CheckCircle2 : estado === 'trial' ? Clock : Ban; const classes = estado === 'activa' ? 'text-secondary bg-secondary/10 border-secondary/20' : estado === 'trial' ? 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20' : 'text-primary bg-primary/10 border-primary/20'; return <span className={`inline-flex items-center gap-1.5 px-2 py-1 text-[9px] font-mono border ${classes}`}><Icon size={10}/>{estado.toUpperCase()}</span> }
function MenuItem({ children, danger }: { children: React.ReactNode; danger?: boolean }) { return <button className={`w-full text-left px-2.5 py-2 hover:bg-muted ${danger ? 'text-primary' : 'text-foreground'}`}>{children}</button> }
function Page({ children, active }: { children: React.ReactNode; active?: boolean }) { return <button className={`w-7 h-7 border ${active ? 'border-secondary bg-secondary/10 text-secondary' : 'border-border hover:border-foreground/30'}`}>{children}</button> }
function money(value: number) { return `$${value.toLocaleString('en-US')}` }
