import { useCallback, useEffect, useMemo, useState } from 'react'
import { CheckCircle2, Clock3, Loader2, RefreshCcw, ShieldAlert, XCircle } from 'lucide-react'
import { api, ApiError } from '../lib/api'
import { authStore } from '../store/auth'
import { useBodegaActiva } from '../store/bodegaActiva'
import { PageHeader } from './PageHeader'

type Estado = 'Pendiente' | 'EnRevision' | 'Resuelto' | 'Descartado'
type Severidad = 'BAJA' | 'MEDIA' | 'ALTA' | 'CRITICA'
type Hallazgo = {
  id: string
  titulo: string
  descripcion: string
  tipo: string
  origen: string
  severidad: Severidad
  estado: Estado
  resumenIa?: string | null
  explicacionIa?: string | null
  recomendacionesIa?: string[] | null
  ocurrencias: number
  ultimaDeteccion: string
}

const estados: Array<{ value: Estado | 'Activas' | 'Todas'; label: string }> = [
  { value: 'Activas', label: 'Activas' },
  { value: 'Pendiente', label: 'Pendientes' },
  { value: 'EnRevision', label: 'En revisión' },
  { value: 'Resuelto', label: 'Resueltas' },
  { value: 'Descartado', label: 'Descartadas' },
  { value: 'Todas', label: 'Todas' },
]

export function Auditoria() {
  const bodegaId = useBodegaActiva()
  const [items, setItems] = useState<Hallazgo[]>([])
  const [filter, setFilter] = useState<Estado | 'Activas' | 'Todas'>('Activas')
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const puedeEditar = authStore.tienePermisos(['auditoria.editar'])

  const cargar = useCallback(async () => {
    if (!bodegaId) return
    setLoading(true); setError(null)
    try {
      const data = await api.get<Hallazgo[]>(`/auditoria-inteligente/hallazgos?bodegaId=${encodeURIComponent(bodegaId)}`)
      setItems(data)
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'No se pudieron cargar las auditorías.')
    } finally { setLoading(false) }
  }, [bodegaId])

  useEffect(() => { void cargar() }, [cargar])

  const visibles = useMemo(() => items.filter((item) => {
    if (filter === 'Todas') return true
    if (filter === 'Activas') return item.estado === 'Pendiente' || item.estado === 'EnRevision'
    return item.estado === filter
  }), [items, filter])

  const actualizar = async (id: string, estado: Estado) => {
    setUpdating(id)
    try {
      const updated = await api.patch<Hallazgo>(`/auditoria-inteligente/hallazgos/${id}`, { estado })
      setItems((current) => current.map((item) => item.id === id ? updated : item))
    } finally { setUpdating(null) }
  }

  return <div className="min-h-full bg-background">
    <PageHeader title="Auditoría" subtitle="BodegaApliSmart · REVISIÓN INTELIGENTE" actions={<button type="button" onClick={() => void cargar()} className="btn-outline"><RefreshCcw size={13}/>Actualizar</button>}/>
    <div className="p-4 sm:p-6 space-y-5">
      <div className="flex gap-2 overflow-x-auto pb-1">{estados.map((estado) => <button key={estado.value} type="button" onClick={() => setFilter(estado.value)} className={`shrink-0 px-3 py-2 border text-[10px] font-mono uppercase ${filter === estado.value ? 'border-secondary/45 bg-secondary/10 text-secondary' : 'border-border text-muted-foreground hover:text-foreground'}`}>{estado.label}</button>)}</div>
      {error && <div className="border border-red-500/30 bg-red-500/10 text-red-300 p-3 text-xs">{error}</div>}
      {loading ? <div className="h-64 grid place-items-center text-muted-foreground"><Loader2 className="animate-spin"/></div> : visibles.length === 0 ? <div className="border border-border bg-card h-64 grid place-items-center text-center"><div><CheckCircle2 size={28} className="mx-auto text-secondary mb-3"/><h2 className="font-heading text-xl">SIN HALLAZGOS</h2><p className="text-xs text-muted-foreground mt-1">No hay auditorías para este filtro.</p></div></div> : <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">{visibles.map((item) => <AuditCard key={item.id} item={item} editing={puedeEditar} busy={updating === item.id} onUpdate={actualizar}/>)}</div>}
    </div>
  </div>
}

function AuditCard({ item, editing, busy, onUpdate }: { item: Hallazgo; editing: boolean; busy: boolean; onUpdate: (id: string, estado: Estado) => Promise<void> }) {
  const severityClass: Record<Severidad, string> = {
    BAJA: 'text-sky-300 border-sky-400/30 bg-sky-400/10',
    MEDIA: 'text-amber-300 border-amber-400/30 bg-amber-400/10',
    ALTA: 'text-orange-300 border-orange-400/30 bg-orange-400/10',
    CRITICA: 'text-red-300 border-red-400/30 bg-red-400/10',
  }
  return <article className="border border-border bg-card p-4 sm:p-5">
    <div className="flex items-start gap-3"><span className="w-10 h-10 shrink-0 grid place-items-center border border-primary/30 bg-primary/10 text-primary"><ShieldAlert size={18}/></span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><span className={`px-2 py-1 border text-[8px] font-mono ${severityClass[item.severidad]}`}>{item.severidad}</span><span className="px-2 py-1 border border-border text-[8px] font-mono text-muted-foreground">{item.estado}</span>{item.ocurrencias > 1 && <span className="text-[9px] font-mono text-primary">+{item.ocurrencias}</span>}</div><h2 className="font-heading text-lg mt-2">{item.titulo}</h2><p className="text-xs leading-relaxed text-muted-foreground mt-1.5">{item.resumenIa || item.descripcion}</p></div></div>
    {item.explicacionIa && <p className="mt-4 border-l-2 border-secondary/30 pl-3 text-xs leading-relaxed text-foreground/80">{item.explicacionIa}</p>}
    {item.recomendacionesIa?.length ? <div className="mt-4"><div className="eyebrow mb-2">RECOMENDACIONES</div><ul className="space-y-1.5 text-xs text-muted-foreground">{item.recomendacionesIa.map((rec, index) => <li key={index}>• {rec}</li>)}</ul></div> : null}
    <div className="mt-4 pt-3 border-t border-border flex flex-wrap items-center gap-2"><span className="mr-auto inline-flex items-center gap-1.5 text-[9px] font-mono text-muted-foreground"><Clock3 size={11}/>{new Date(item.ultimaDeteccion).toLocaleString('es-CO')}</span>{editing && <>{item.estado !== 'EnRevision' && <button disabled={busy} onClick={() => void onUpdate(item.id, 'EnRevision')} className="btn-outline text-[10px]">Revisar</button>}{item.estado !== 'Resuelto' && <button disabled={busy} onClick={() => void onUpdate(item.id, 'Resuelto')} className="btn-outline text-[10px]"><CheckCircle2 size={12}/>Resolver</button>}{item.estado !== 'Descartado' && <button disabled={busy} onClick={() => void onUpdate(item.id, 'Descartado')} className="btn-outline text-[10px]"><XCircle size={12}/>Descartar</button>}</>}</div>
  </article>
}
