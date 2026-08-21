/**
 * Vista de detalle de un proyecto.
 *
 * Estructura:
 *  - Header: nombre, código, estado (badge), fechas, acciones
 *  - Barra de progreso (km avanzados / km totales)
 *  - 5 KPIs: costo total, km avanzados, costo por km, técnicos activos,
 *    días restantes
 *  - Tabs: Técnicos | Productos | Solicitudes | Avances | Mapa |
 *    Desglose de costos
 *  - Gráfico de línea (km acumulados por fecha) — Recharts
 *
 * Sigue el patrón de ChecklistView: header con PageHeader, KPIs en
 * grilla, tabs con TabButton custom, contenido scrolleable.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  Users,
  Package,
  Inbox,
  Send,
  TrendingUp,
  Calendar,
  AlertCircle,
  Loader2,
  Camera,
  FileText,
  CheckCircle2,
  XCircle,
  PauseCircle,
  PlayCircle,
  Map,
  MapPin,
  Flag,
  ChevronRight,
} from 'lucide-react'
import { useBodegaActiva } from '../../store/bodegaActiva'
import { useAuth, authStore } from '../../store/auth'
import { PageHeader } from '../PageHeader'
import { Modal } from '../Modal'
import { Pagination } from '../Pagination'
import { useRealtimeEvent } from '../../hooks/useRealtimeEvent'
import { imageUrl } from '../../lib/apiBase'
import { obtenerProyecto, listarProductosDelProyecto, listarSolicitudesDelProyecto, listarAvances } from './api'
import { listarNodos, crearNodo, actualizarNodo, eliminarNodo } from './api'
import type {
  ProyectoDetalle,
  ProductoDelProyecto,
  SolicitudListItem,
  AvanceListItem,
} from './types'

type ProyectoT = ProyectoDetalle
import { RegistrarAvanceModal } from './RegistrarAvanceModal'
import { SolicitudBodegaModal } from './SolicitudBodegaModal'
import { CambiarEstadoModal } from './CambiarEstadoModal'
import { AsignarProductosInicialesModal } from './AsignarProductosInicialesModal'
import { GraficoAvance } from './GraficoAvance'
import { CostoDesgloseTab } from './CostoDesgloseTab'
import { MapaNodos, type AvancePin } from './MapaNodos'
import { MapaNodosEditor, type NodoEditable } from './MapaNodosEditor'
import { PlanificarRutaModal } from './PlanificarRutaModal'
import { Route } from 'lucide-react'
import { ValorBlur } from '../../lib/valorBlur'

type TabKey =
  | 'tecnicos'
  | 'productos'
  | 'solicitudes'
  | 'avances'
  | 'desglose'
  | 'mapa'

const TABS: { key: TabKey; label: string; icon: typeof Users }[] = [
  { key: 'tecnicos', label: 'Técnicos', icon: Users },
  { key: 'productos', label: 'Productos', icon: Package },
  { key: 'solicitudes', label: 'Solicitudes a bodega', icon: Send },
  { key: 'avances', label: 'Avances', icon: TrendingUp },
  { key: 'mapa', label: 'Mapa', icon: Map },
  { key: 'desglose', label: 'Desglose de costos', icon: FileText },
]

function formatMoneyCop(n: number): string {
  return n.toLocaleString('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('es-CO', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

function daysBetween(a: Date, b: Date): number {
  const ms = b.getTime() - a.getTime()
  return Math.round(ms / (1000 * 60 * 60 * 24))
}

function colorEstado(nombre: string, colorHex: string | null): string {
  if (colorHex) return colorHex
  switch (nombre) {
    case 'Planificado':
      return '#6b7280'
    case 'EnProgreso':
      return '#22c55e'
    case 'Pausado':
      return '#eab308'
    case 'Finalizado':
      return '#3b82f6'
    case 'Cancelado':
      return '#ef4444'
    default:
      return '#6b7280'
  }
}

export function ProyectoDetalle() {
  const params = useParams<{ id: string }>()
  const id = params.id ?? ''
  const navigate = useNavigate()
  const auth = useAuth()
  const bodegaId = useBodegaActiva()

  const [proyecto, setProyecto] = useState<ProyectoT | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<TabKey>('tecnicos')

  // Data de cada tab
  const [productos, setProductos] = useState<ProductoDelProyecto[]>([])
  const [solicitudes, setSolicitudes] = useState<SolicitudListItem[]>([])
  const [solicitudesTotal, setSolicitudesTotal] = useState(0)
  const [avances, setAvances] = useState<AvanceListItem[]>([])
  const [avancesTotal, setAvancesTotal] = useState(0)
  const [nodosMapa, setNodosMapa] = useState<
    Array<{
      id: string
      nombre: string | null
      tipo: 'inicio' | 'intermedio' | 'fin'
      orden: number
      latitud: number
      longitud: number
      kmAcumulado: number
    }>
  >([])
  const [dataLoading, setDataLoading] = useState(false)

  // Modales
  const [avanceOpen, setAvanceOpen] = useState(false)
  const [solicitudOpen, setSolicitudOpen] = useState(false)
  const [cambiarEstadoOpen, setCambiarEstadoOpen] = useState(false)
  const [productosOpen, setProductosOpen] = useState(false)
  const [mapaNodosOpen, setMapaNodosOpen] = useState(false)
  const [planificarRutaOpen, setPlanificarRutaOpen] = useState(false)
  // Cuando el user clickea "Subir avance" en un nodo del mapa,
  // guardamos el nodoId y el km para que el modal los reciba.
  const [avanceNodoFijo, setAvanceNodoFijo] = useState<
    { nodoId: string; kmAcumulado: number } | null
  >(null)

  // ─────────────────────────────────────────────────────────────
  //  Realtime: se suscribe ABAJO, después de declarar
  //  `cargarProyecto` y `cargarTabData`. Ver bloque al final del
  //  componente, antes del return.
  // ─────────────────────────────────────────────────────────────

  const cargarProyecto = useCallback(async () => {
    if (!id) return
    setLoading(true)
    setError(null)
    try {
      const p = (await obtenerProyecto(id)) as ProyectoT
      setProyecto(p)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'No se pudo cargar el proyecto.'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }, [id])

  const cargarTabData = useCallback(
    async (tabKey: TabKey) => {
      if (!id) return
      setDataLoading(true)
      try {
        if (tabKey === 'productos') {
          const data = await listarProductosDelProyecto(id)
          setProductos(data)
        } else if (tabKey === 'mapa') {
          const data = await listarNodos(id)
          setNodosMapa(data)
        } else if (tabKey === 'solicitudes') {
          const data = await listarSolicitudesDelProyecto(id, {
            page: 1,
            pageSize: 50,
          })
          setSolicitudes(data.data)
          setSolicitudesTotal(data.total)
        } else if (tabKey === 'avances') {
          const data = await listarAvances({
            proyectoId: id,
            page: 1,
            pageSize: 50,
          })
          setAvances(data.data)
          setAvancesTotal(data.total)
        }
      } catch {
        /* error en cada tab, no rompe */
      } finally {
        setDataLoading(false)
      }
    },
    [id],
  )

  useEffect(() => {
    void cargarProyecto()
  }, [cargarProyecto])

  useEffect(() => {
    if (proyecto) void cargarTabData(tab)
  }, [proyecto, tab, cargarTabData])

  // ─── Realtime del proyecto abierto ─────────────────────────
  // El `RealtimeProvider` despacha CustomEvents globales
  // (`realtime:proyecto-solicitud`, `realtime:proyecto-avance`) con
  // el `proyectoId` en el detail. Acá escuchamos SOLO los del proyecto
  // abierto y refetchamos el tab correspondiente. Patrón espejo de
  // `realtime:catalogo` (ver RealtimeProvider).
  useEffect(() => {
    if (typeof window === 'undefined' || !id) return
    const onSolicitud = (ev: Event) => {
      const detail = (ev as CustomEvent<{ proyectoId: string }>).detail
      if (detail?.proyectoId !== id) return
      // El tab activo puede ser 'solicitudes' o no. Si lo es, el
      // `cargarTabData('solicitudes')` ya lo refresca. Si no lo es,
      // igual refrescamos en background para que cuando el user vuelva
      // al tab ya esté actualizado.
      if (proyecto) void cargarTabData('solicitudes')
    }
    const onAvance = (ev: Event) => {
      const detail = (ev as CustomEvent<{ proyectoId: string }>).detail
      if (detail?.proyectoId !== id) return
      if (proyecto) void cargarTabData('avances')
      // Recargar también el proyecto para refrescar los KPIs
      // (kmAvanzados, costoPorKm, etc.) y el gráfico.
      void cargarProyecto()
    }
    window.addEventListener('realtime:proyecto-solicitud', onSolicitud)
    window.addEventListener('realtime:proyecto-avance', onAvance)
    return () => {
      window.removeEventListener('realtime:proyecto-solicitud', onSolicitud)
      window.removeEventListener('realtime:proyecto-avance', onAvance)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, tab, proyecto])

  // Permisos. Usamos `authStore.tienePermisos` (no `permisos.includes`
  // a secas) porque ese helper ya respeta `BYPASS_ROLES = ['admin']`.
  // El admin ve TODOS los botones de Proyectos, sin necesidad de tener
  // las 8 permission keys custom del submódulo asignadas explícitamente.
  const autenticado = auth.status === 'autenticado'
  const puedeEditar = autenticado && authStore.tienePermisos(['tecnicos.proyectos.editar'])
  const puedeSolicitar = autenticado && authStore.tienePermisos(['tecnicos.proyectos.solicitud.crear'])
  const puedeRegistrarAvance = autenticado && authStore.tienePermisos(['tecnicos.proyectos.avance.registrar'])
  const puedeAsignarProductos = autenticado && authStore.tienePermisos(['tecnicos.proyectos.producto.inicial'])
  const puedeGestionarNodos = autenticado && authStore.tienePermisos(['tecnicos.proyectos.nodo.gestionar'])

  // KPIs
  const kpis = useMemo(() => {
    if (!proyecto) return []
    const hoy = new Date()
    const inicio = new Date(proyecto.fechaInicio)
    const finEstimado = proyecto.fechaFinEstimada
      ? new Date(proyecto.fechaFinEstimada)
      : null
    const diasTranscurridos = Math.max(0, daysBetween(inicio, hoy))
    const diasRestantes = finEstimado
      ? Math.max(0, daysBetween(hoy, finEstimado))
      : null
    // Costo por km: usamos el TOTAL planificado (kmATrabajar) en
    // lugar de los km avanzados, así el KPI muestra un valor
    // estimado desde el inicio del proyecto (no solo cuando ya
    // hay avances registrados). Si todavía no hay km planificados
    // (caso raro), mostramos "—".
    const costoPorKm =
      proyecto.kmATrabajar > 0 ? proyecto.costoTotal / proyecto.kmATrabajar : 0
    return [
      { label: 'Costo total', value: <ValorBlur value={proyecto.costoTotal} render={() => formatMoneyCop(proyecto.costoTotal)} />, accent: 'text-secondary' as const },
      {
        label: 'Km avanzados',
        value: `${proyecto.kmAvanzados.toFixed(1)} / ${proyecto.kmATrabajar.toFixed(1)}`,
        accent: 'text-primary' as const,
      },
      {
        label: 'Costo por km',
        value: costoPorKm > 0 ? <ValorBlur value={costoPorKm} render={() => formatMoneyCop(costoPorKm)} /> : '—',
        accent: 'text-muted-foreground' as const,
      },
      {
        label: 'Técnicos activos',
        value: String(proyecto.tecnicosActivos),
        accent: 'text-primary' as const,
      },
      {
        label: finEstimado
          ? `Día ${diasTranscurridos} · restan ${diasRestantes}`
          : `Día ${diasTranscurridos}`,
        value: 'días',
        accent: 'text-muted-foreground' as const,
      },
    ]
  }, [proyecto])

  // ─────────────────────────────────────────────────────────────
  //  Realtime: si llega un evento de ESTE proyecto, refetchear.
  //  El store ya hace refetch del listado global; acá nos ocupamos
  //  del detalle y de los datos de las tabs.
  // ─────────────────────────────────────────────────────────────
  useRealtimeEvent('proyecto.estado-cambiado', (e) => {
    if ((e.payload as { id?: string }).id === id) {
      void cargarProyecto()
      void cargarTabData(tab)
    }
  })
  useRealtimeEvent('proyecto.tecnico-asignado', (e) => {
    if ((e.payload as { proyectoId?: string }).proyectoId === id) {
      void cargarProyecto()
      void cargarTabData('tecnicos')
    }
  })
  useRealtimeEvent('proyecto.producto-asignado', (e) => {
    if ((e.payload as { proyectoId?: string }).proyectoId === id) {
      void cargarProyecto()
      void cargarTabData('productos')
    }
  })
  useRealtimeEvent('proyecto.producto-eliminado', (e) => {
    if ((e.payload as { proyectoId?: string }).proyectoId === id) {
      void cargarProyecto()
      void cargarTabData('productos')
    }
  })
  useRealtimeEvent('solicitud-bodega.creada', (e) => {
    if ((e.payload as { proyectoId?: string }).proyectoId === id) {
      void cargarProyecto()
      void cargarTabData('solicitudes')
    }
  })
  useRealtimeEvent('solicitud-bodega.estado-cambiada', (e) => {
    if ((e.payload as { proyectoId?: string }).proyectoId === id) {
      void cargarProyecto()
      void cargarTabData('solicitudes')
    }
  })
  useRealtimeEvent('proyecto.avance-registrado', (e) => {
    if ((e.payload as { proyectoId?: string }).proyectoId === id) {
      void cargarProyecto()
      void cargarTabData('avances')
    }
  })
  useRealtimeEvent('proyecto.avance-eliminado', (e) => {
    if ((e.payload as { proyectoId?: string }).proyectoId === id) {
      void cargarProyecto()
      void cargarTabData('avances')
    }
  })

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 size={24} className="animate-spin text-muted-foreground" />
      </div>
    )
  }
  if (error || !proyecto) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 gap-3">
        <AlertCircle size={32} className="text-destructive" />
        <p className="text-sm text-destructive">{error ?? 'Proyecto no encontrado'}</p>
        <Link
          to="/tecnicos/proyectos"
          className="text-xs underline text-muted-foreground hover:text-foreground"
        >
          ← Volver al listado
        </Link>
      </div>
    )
  }

  const porcentaje =
    proyecto.kmATrabajar > 0
      ? Math.min(100, (proyecto.kmAvanzados / proyecto.kmATrabajar) * 100)
      : 0
  const colorEst = colorEstado(proyecto.estado.nombre, proyecto.estado.colorHex)
  const estadoTerminal =
    proyecto.estado.nombre === 'Finalizado' || proyecto.estado.nombre === 'Cancelado'

  return (
    <div className="flex-1 flex flex-col min-w-0 min-h-0">
      <PageHeader
        title={proyecto.nombreProyecto}
        subtitle={`${proyecto.codigo} · ${proyecto.estado.nombre}`}
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate('/tecnicos/proyectos')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs border border-border hover:border-foreground/40 transition-colors"
              style={{ borderRadius: '0.25rem' }}
            >
              <ArrowLeft size={13} />
              Volver
            </button>
            {puedeEditar && !estadoTerminal && (
              <button
                onClick={() => setCambiarEstadoOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-foreground text-background text-xs font-medium hover:opacity-90 transition-opacity"
                style={{ borderRadius: '0.25rem' }}
              >
                <PauseCircle size={13} />
                Cambiar estado
              </button>
            )}
          </div>
        }
      />

      <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 space-y-6">
        {/* Botón Volver para mobile. El `PageHeader` es `hidden
            lg:flex` (solo desktop), así que en mobile necesitamos
            un botón propio. Lo ponemos como fila compacta arriba
            de todo. */}
        <div className="lg:hidden">
          <button
            onClick={() => navigate('/tecnicos/proyectos')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs border border-border hover:border-foreground/40 transition-colors"
            style={{ borderRadius: '0.25rem' }}
          >
            <ArrowLeft size={13} />
            Volver
          </button>
        </div>
        {/* Header del proyecto: badge + fechas + descripción + barra de progreso */}
        <section className="bg-card border border-border p-4 sm:p-5" style={{ borderRadius: '0.25rem' }}>
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <span
                  className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] uppercase tracking-wider font-medium text-white"
                  style={{ backgroundColor: colorEst, borderRadius: '0.125rem' }}
                >
                  {proyecto.estado.nombre}
                </span>
                <span className="text-[10px] text-muted-foreground tracking-widest uppercase" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                  {proyecto.codigo}
                </span>
                <span className="text-[10px] text-muted-foreground tracking-widest uppercase" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                  · {proyecto.bodega.nombre}
                </span>
              </div>
              {proyecto.descripcion && (
                <p className="text-sm text-muted-foreground mb-3">{proyecto.descripcion}</p>
              )}
              <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  <Calendar size={12} />
                  Inicio: {formatDate(proyecto.fechaInicio)}
                </span>
                {proyecto.fechaFinEstimada && (
                  <span className="inline-flex items-center gap-1">
                    <Calendar size={12} />
                    Fin est.: {formatDate(proyecto.fechaFinEstimada)}
                  </span>
                )}
                {proyecto.fechaFinReal && (
                  <span className="inline-flex items-center gap-1">
                    <CheckCircle2 size={12} />
                    Fin real: {formatDate(proyecto.fechaFinReal)}
                  </span>
                )}
                {proyecto.encargado && (
                  <span>Encargado: <strong className="text-foreground">{proyecto.encargado.nombre}</strong></span>
                )}
              </div>
            </div>
          </div>

          {/* Barra de progreso */}
          <div className="mt-4">
            <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-1">
              <span className="flex items-center gap-1">
                <TrendingUp size={10} />
                Avance en km
              </span>
              <span style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                {porcentaje.toFixed(1)}%
              </span>
            </div>
            <div className="h-2 bg-muted overflow-hidden" style={{ borderRadius: '0.125rem' }}>
              <div
                className="h-full transition-all"
                style={{ width: `${porcentaje}%`, backgroundColor: colorEst }}
              />
            </div>
          </div>
        </section>

        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          {kpis.map((k) => (
            <div
              key={k.label}
              className="bg-card border border-border p-4"
              style={{ borderRadius: '0.25rem' }}
            >
              <div
                className="text-[10px] text-muted-foreground tracking-widest uppercase"
                style={{ fontFamily: "'JetBrains Mono', monospace" }}
              >
                {k.label}
              </div>
              <div
                className={`text-2xl leading-none mt-1.5 ${k.accent}`}
                style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800 }}
              >
                {k.value}
              </div>
            </div>
          ))}
        </div>

        {/* Gráfico de línea (km acumulados) */}
        {avances.length > 0 && (
          <section className="bg-card border border-border p-4 sm:p-5" style={{ borderRadius: '0.25rem' }}>
            <h3
              className="text-xs uppercase tracking-widest text-muted-foreground mb-3"
              style={{ fontFamily: "'JetBrains Mono', monospace" }}
            >
              Km acumulados por fecha
            </h3>
            <GraficoAvance avances={avances} />
          </section>
        )}

        {/* Tabs */}
        <div className="overflow-x-auto">
          <div className="inline-flex items-center gap-1 p-1 bg-muted border border-border w-fit" style={{ borderRadius: '0.375rem' }}>
            {TABS.map((t) => {
              const Icon = t.icon
              return (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key)}
                  className={[
                    'inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors',
                    tab === t.key
                      ? 'bg-card text-foreground border border-border shadow-sm'
                      : 'text-muted-foreground hover:text-foreground',
                  ].join(' ')}
                  style={{ borderRadius: '0.25rem', fontFamily: "'DM Sans', sans-serif" }}
                >
                  <Icon size={13} />
                  {t.label}
                </button>
              )
            })}
          </div>
        </div>

        {/* Acciones rápidas por tab */}
        <div className="flex flex-wrap gap-2">
          {tab === 'productos' && puedeAsignarProductos && !estadoTerminal && (
            <button
              onClick={() => setProductosOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground text-xs font-medium hover:opacity-90 transition-opacity"
              style={{ borderRadius: '0.25rem' }}
            >
              <Package size={13} />
              Asignar productos
            </button>
          )}
          {tab === 'solicitudes' && puedeSolicitar && !estadoTerminal && (
            <button
              onClick={() => setSolicitudOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground text-xs font-medium hover:opacity-90 transition-opacity"
              style={{ borderRadius: '0.25rem' }}
            >
              <Send size={13} />
              Nueva solicitud
            </button>
          )}
          {tab === 'mapa' && puedeGestionarNodos && !estadoTerminal && (
            <>
              <button
                onClick={() => setPlanificarRutaOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground text-xs font-medium hover:opacity-90 transition-opacity"
                style={{ borderRadius: '0.25rem' }}
              >
                <Route size={13} />
                Planificar ruta
              </button>
              <button
                onClick={() => setMapaNodosOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-border text-xs hover:border-foreground/40 transition-colors"
                style={{ borderRadius: '0.25rem' }}
              >
                <MapPin size={13} />
                {nodosMapa.length === 0 ? 'Marcar manual' : 'Editar manual'}
              </button>
            </>
          )}
          {tab === 'avances' && puedeRegistrarAvance && !estadoTerminal && (
            <button
              onClick={() => setAvanceOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground text-xs font-medium hover:opacity-90 transition-opacity"
              style={{ borderRadius: '0.25rem' }}
            >
              <Camera size={13} />
              Registrar avance
            </button>
          )}
        </div>

        {/* Contenido del tab */}
        <section className="bg-card border border-border" style={{ borderRadius: '0.25rem' }}>
          {dataLoading ? (
            <div className="p-8 flex items-center justify-center">
              <Loader2 size={20} className="animate-spin text-muted-foreground" />
            </div>
          ) : tab === 'tecnicos' ? (
            <TecnicosTab proyecto={proyecto} />
          ) : tab === 'productos' ? (
            <ProductosTab productos={productos} />
          ) : tab === 'solicitudes' ? (
            <SolicitudesTab solicitudes={solicitudes} total={solicitudesTotal} />
          ) : tab === 'avances' ? (
            <AvancesTab avances={avances} total={avancesTotal} />
          ) : tab === 'mapa' ? (
            <MapaTab
              nodos={nodosMapa as any}
              avances={avances.map<AvancePin>((a) => ({
                id: a.id,
                nodoId: a.nodo?.id ?? null,
                // Sin coords reales, los pines de avance no se dibujan.
                // Cuando el back mande nodoId, igual lo ignoramos acá
                // (la polilínea es la del recorrido). Si más adelante
                // queremos pines individuales por avance, lo agregamos.
                latitud: a.nodo?.latitud ?? 0,
                longitud: a.nodo?.longitud ?? 0,
                titulo: `Avance · ${a.tecnico.nombre}`,
                fecha: new Date(a.fechaAvance).toLocaleDateString('es-CO'),
                kmAvanzadosEnEstaFecha: a.kmAvanzadosEnEstaFecha,
              })).filter((p) => p.latitud !== 0 || p.longitud !== 0)}
              onEditarRecorrido={
                puedeGestionarNodos && !estadoTerminal
                  ? () => setMapaNodosOpen(true)
                  : undefined
              }
              onSubirAvance={(nodoId, kmAcumulado) => {
                setAvanceNodoFijo({ nodoId, kmAcumulado })
                setAvanceOpen(true)
              }}
              puedeRegistrarAvance={puedeRegistrarAvance}
              estadoTerminal={estadoTerminal}
            />
          ) : (
            <CostoDesgloseTab
              productos={productos}
            />
          )}
        </section>
      </div>

      {/* Modales */}
      {avanceOpen && (
        <RegistrarAvanceModal
          open={avanceOpen}
          proyectoId={id}
          tecnicosAsignados={proyecto.tecnicos}
          nodos={proyecto.nodos ?? []}
          tecnicoSugeridoId={proyecto.encargado?.id ?? null}
          nodoFijo={avanceNodoFijo}
          onClose={() => {
            setAvanceOpen(false)
            setAvanceNodoFijo(null)
          }}
          onCreated={() => {
            setAvanceOpen(false)
            setAvanceNodoFijo(null)
            void cargarProyecto()
            void cargarTabData('avances')
          }}
        />
      )}
      {solicitudOpen && (
        <SolicitudBodegaModal
          open={solicitudOpen}
          proyectoId={id}
          bodegaId={bodegaId ?? ''}
          onClose={() => setSolicitudOpen(false)}
          onCreated={() => {
            setSolicitudOpen(false)
            void cargarProyecto()
            void cargarTabData('solicitudes')
          }}
        />
      )}
      {cambiarEstadoOpen && (
        <CambiarEstadoModal
          open={cambiarEstadoOpen}
          proyectoId={id}
          estadoActualNombre={proyecto.estado.nombre}
          onClose={() => setCambiarEstadoOpen(false)}
          onChanged={() => {
            setCambiarEstadoOpen(false)
            void cargarProyecto()
          }}
        />
      )}
      {productosOpen && proyecto && (
        <AsignarProductosInicialesModal
          open={productosOpen}
          proyectoId={id}
          bodegaId={bodegaId ?? ''}
          tecnicosAsignados={proyecto.tecnicos}
          onClose={() => setProductosOpen(false)}
          onCreated={() => {
            setProductosOpen(false)
            void cargarProyecto()
            void cargarTabData('productos')
          }}
        />
      )}
      {mapaNodosOpen && proyecto && (
        <MapaNodosEditor
          open={mapaNodosOpen}
          bodegaId={bodegaId ?? ''}
          initialNodos={nodosMapa.map<NodoEditable>((n) => ({
            localId: n.id,
            id: n.id,
            latitud: n.latitud,
            longitud: n.longitud,
            nombre: n.nombre ?? '',
            tipo: n.tipo,
            esNuevo: false,
          }))}
          onConfirm={async (nodos) => {
            // Sincronizar contra el back. Estrategia:
            //   1) Eliminar los nodos viejos que ya no están.
            //   2) Para los que quedan, hacer PATCH con la nueva
            //      posición / nombre / tipo / orden.
            //   3) Crear los nuevos (esNuevo=true).
            // El back recalcula `kmAcumulado` y normaliza `orden`
            // automáticamente.
            const prevIds = new Set(nodosMapa.map((n) => n.id))
            const nextIds = new Set(
              nodos.filter((n) => n.id).map((n) => n.id!),
            )
            const aEliminar = nodosMapa.filter((n) => !nextIds.has(n.id))

            try {
              for (const viejo of aEliminar) {
                await eliminarNodo(id, viejo.id)
              }
              for (let i = 0; i < nodos.length; i++) {
                const n = nodos[i]
                if (n.esNuevo) {
                  await crearNodo(id, {
                    latitud: n.latitud,
                    longitud: n.longitud,
                    nombre: n.nombre || undefined,
                    tipo: n.tipo,
                    orden: i + 1,
                  })
                } else if (n.id) {
                  await actualizarNodo(id, n.id, {
                    latitud: n.latitud,
                    longitud: n.longitud,
                    nombre: n.nombre || undefined,
                    tipo: n.tipo,
                    orden: i + 1,
                  })
                }
              }
              setMapaNodosOpen(false)
              void cargarTabData('mapa')
              void cargarProyecto()
            } catch (err) {
              // eslint-disable-next-line no-console
              console.error('Error sincronizando nodos:', err)
              // Igual cerramos el modal; el refetch va a mostrar
              // el estado real de la DB.
              setMapaNodosOpen(false)
              void cargarTabData('mapa')
              void cargarProyecto()
            }
          }}
          onClose={() => setMapaNodosOpen(false)}
        />
      )}
      {planificarRutaOpen && (
        <PlanificarRutaModal
          open={planificarRutaOpen}
          proyectoId={id}
          initialNodos={nodosMapa as any}
          onClose={() => setPlanificarRutaOpen(false)}
          onPlanned={() => {
            setPlanificarRutaOpen(false)
            // Refetch de los datos del proyecto y de la tab
            // mapa: los nodos cambiaron, el `kmATrabajar`
            // también.
            void cargarProyecto()
            void cargarTabData('mapa')
          }}
        />
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
//  Tabs (contenido)
// ─────────────────────────────────────────────────────────────

function TecnicosTab({ proyecto }: { proyecto: ProyectoT }) {
  const [detalleId, setDetalleId] = useState<string | null>(null)
  if (proyecto.tecnicos.length === 0) {
    return (
      <div className="py-16 px-6 flex flex-col items-center text-center">
        <Inbox size={28} className="text-muted-foreground mb-3" />
        <p className="text-sm text-muted-foreground">
          Aún no hay técnicos asignados. Asigná desde el form de crear/editar.
        </p>
      </div>
    )
  }
  const tecnicoDetalle = detalleId
    ? proyecto.tecnicos.find((t) => t.id === detalleId) ?? null
    : null
  return (
    <>
      {/* Desktop: tabla completa */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-sm min-w-[640px]">
          <thead className="bg-muted/40 border-b border-border">
            <tr className="text-left text-[10px] text-muted-foreground uppercase tracking-widest" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
              <th className="px-4 py-2.5">Técnico</th>
              <th className="px-4 py-2.5">Email</th>
              <th className="px-4 py-2.5">Rol en proyecto</th>
              <th className="px-4 py-2.5">Asignado</th>
              <th className="px-4 py-2.5">Estado</th>
            </tr>
          </thead>
          <tbody>
            {proyecto.tecnicos.map((t) => (
              <tr
                key={t.id}
                className="border-b border-border last:border-0 cursor-pointer hover:bg-muted/30"
                onClick={() => setDetalleId(t.id)}
              >
                <td className="px-4 py-3 font-medium text-foreground">{t.tecnico.nombre}</td>
                <td className="px-4 py-3 text-muted-foreground">{t.tecnico.email}</td>
                <td className="px-4 py-3 text-muted-foreground">{t.rolEnProyecto ?? '—'}</td>
                <td className="px-4 py-3 text-muted-foreground text-xs" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                  {formatDate(t.fechaAsignacion)}
                </td>
                <td className="px-4 py-3">
                  {t.fechaDesasignacion ? (
                    <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 bg-muted text-muted-foreground" style={{ borderRadius: '0.125rem' }}>
                      Desasignado
                    </span>
                  ) : (
                    <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 bg-secondary/20 text-secondary" style={{ borderRadius: '0.125rem' }}>
                      Activo
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile: lista compacta. Click → modal */}
      <ul className="md:hidden divide-y divide-border">
        {proyecto.tecnicos.map((t) => (
          <li key={t.id}>
            <button
              type="button"
              onClick={() => setDetalleId(t.id)}
              className="w-full text-left px-4 py-3 hover:bg-muted/30 active:bg-muted/50 transition-colors flex items-center gap-3"
              aria-label={`Ver detalle de ${t.tecnico.nombre}`}
            >
              <div className="flex-1 min-w-0">
                <div className="font-medium text-foreground truncate">
                  {t.tecnico.nombre}
                </div>
                <div className="text-[10px] text-muted-foreground truncate">
                  {t.rolEnProyecto ?? 'Sin rol asignado'}
                </div>
              </div>
              {t.fechaDesasignacion ? (
                <span
                  className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 bg-muted text-muted-foreground shrink-0"
                  style={{ borderRadius: '0.125rem' }}
                >
                  Desasignado
                </span>
              ) : (
                <span
                  className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 bg-secondary/20 text-secondary shrink-0"
                  style={{ borderRadius: '0.125rem' }}
                >
                  Activo
                </span>
              )}
              <ChevronRight size={14} className="text-muted-foreground shrink-0" />
            </button>
          </li>
        ))}
      </ul>

      {/* Modal: detalle del técnico (mobile + desktop click) */}
      <Modal
        open={!!tecnicoDetalle}
        onClose={() => setDetalleId(null)}
        title={tecnicoDetalle?.tecnico.nombre ?? 'Detalle del técnico'}
        description={tecnicoDetalle?.tecnico.email}
        icon={<Users size={18} />}
        size="md"
      >
        {tecnicoDetalle ? (
          <div className="p-5 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <div
                  className="text-[10px] text-muted-foreground uppercase tracking-widest"
                  style={{ fontFamily: "'JetBrains Mono', monospace" }}
                >
                  Email
                </div>
                <div className="text-base text-foreground mt-0.5">
                  {tecnicoDetalle.tecnico.email}
                </div>
              </div>
              <div>
                <div
                  className="text-[10px] text-muted-foreground uppercase tracking-widest"
                  style={{ fontFamily: "'JetBrains Mono', monospace" }}
                >
                  Rol en proyecto
                </div>
                <div className="text-base text-foreground mt-0.5">
                  {tecnicoDetalle.rolEnProyecto ?? '—'}
                </div>
              </div>
              <div>
                <div
                  className="text-[10px] text-muted-foreground uppercase tracking-widest"
                  style={{ fontFamily: "'JetBrains Mono', monospace" }}
                >
                  Estado
                </div>
                <div className="text-base text-foreground mt-0.5">
                  {tecnicoDetalle.fechaDesasignacion ? (
                    <span
                      className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 bg-muted text-muted-foreground"
                      style={{ borderRadius: '0.125rem' }}
                    >
                      Desasignado
                    </span>
                  ) : (
                    <span
                      className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 bg-secondary/20 text-secondary"
                      style={{ borderRadius: '0.125rem' }}
                    >
                      Activo
                    </span>
                  )}
                </div>
              </div>
              <div>
                <div
                  className="text-[10px] text-muted-foreground uppercase tracking-widest"
                  style={{ fontFamily: "'JetBrains Mono', monospace" }}
                >
                  Asignado
                </div>
                <div
                  className="text-base text-foreground mt-0.5"
                  style={{ fontFamily: "'JetBrains Mono', monospace" }}
                >
                  {formatDate(tecnicoDetalle.fechaAsignacion)}
                </div>
              </div>
              {tecnicoDetalle.fechaDesasignacion && (
                <div>
                  <div
                    className="text-[10px] text-muted-foreground uppercase tracking-widest"
                    style={{ fontFamily: "'JetBrains Mono', monospace" }}
                  >
                    Desasignado
                  </div>
                  <div
                    className="text-base text-foreground mt-0.5"
                    style={{ fontFamily: "'JetBrains Mono', monospace" }}
                  >
                    {formatDate(tecnicoDetalle.fechaDesasignacion)}
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : null}
      </Modal>
    </>
  )
}

function ProductosTab({ productos }: { productos: ProductoDelProyecto[] }) {
  const [detalleId, setDetalleId] = useState<string | null>(null)
  if (productos.length === 0) {
    return (
      <div className="py-16 px-6 flex flex-col items-center text-center">
        <Inbox size={28} className="text-muted-foreground mb-3" />
        <p className="text-sm text-muted-foreground">
          Sin productos. Asigná la dotación al crear el proyecto, o pedile
          productos a bodega desde la tab "Solicitudes a bodega".
        </p>
      </div>
    )
  }
  const totalSubtotal = productos.reduce((acc, p) => acc + p.subtotal, 0)
  // Subtotales por origen, para los KPIs arriba de la tabla.
  const subtotalInicial = productos
    .filter((p) => p.origen === 'inicial')
    .reduce((acc, p) => acc + p.subtotal, 0)
  const subtotalSolicitudes = productos
    .filter((p) => p.origen === 'solicitud')
    .reduce((acc, p) => acc + p.subtotal, 0)
  // Detalle abierto (para el modal de mobile). null = cerrado.
  const productoDetalle = detalleId
    ? productos.find((p) => p.id === detalleId) ?? null
    : null

  // ─── Helper: badge de origen (reutilizado en mobile + desktop) ──
  const OrigenBadge = ({ p }: { p: ProductoDelProyecto }) =>
    p.origen === 'inicial' ? (
      <span
        className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider px-1.5 py-0.5 bg-secondary/15 text-secondary"
        style={{ borderRadius: '0.125rem' }}
      >
        <Package size={10} />
        Inicial
      </span>
    ) : (
      <span
        className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider px-1.5 py-0.5 bg-primary/15 text-primary"
        style={{ borderRadius: '0.125rem', fontFamily: "'JetBrains Mono', monospace" }}
        title={p.origenCodigo ?? ''}
      >
        <Send size={10} />
        {p.origenCodigo}
      </span>
    )

  return (
    <>
      {/* Sub-resumen de la mezcla */}
      <div className="px-4 sm:px-5 py-3 border-b border-border bg-muted/20 grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div>
          <div
            className="text-[10px] text-muted-foreground tracking-widest uppercase"
            style={{ fontFamily: "'JetBrains Mono', monospace" }}
          >
            Inicial
          </div>
          <div
            className="text-base text-foreground mt-0.5"
            style={{ fontFamily: "'JetBrains Mono', monospace" }}
          >
            <ValorBlur value={subtotalInicial} render={() => formatMoneyCop(subtotalInicial)} />
          </div>
        </div>
        <div>
          <div
            className="text-[10px] text-muted-foreground tracking-widest uppercase"
            style={{ fontFamily: "'JetBrains Mono', monospace" }}
          >
            De solicitudes a bodega
          </div>
          <div
            className="text-base text-foreground mt-0.5"
            style={{ fontFamily: "'JetBrains Mono', monospace" }}
          >
            <ValorBlur value={subtotalSolicitudes} render={() => formatMoneyCop(subtotalSolicitudes)} />
          </div>
        </div>
        <div className="col-span-2 sm:col-span-1 sm:text-right">
          <div
            className="text-[10px] text-muted-foreground tracking-widest uppercase"
            style={{ fontFamily: "'JetBrains Mono', monospace" }}
          >
            Total
          </div>
          <div
            className="text-base text-primary mt-0.5"
            style={{ fontFamily: "'JetBrains Mono', monospace" }}
          >
            <ValorBlur value={totalSubtotal} render={() => formatMoneyCop(totalSubtotal)} />
          </div>
        </div>
      </div>
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-sm min-w-[720px]">
          <thead className="bg-muted/40 border-b border-border">
            <tr
              className="text-left text-[10px] text-muted-foreground uppercase tracking-widest"
              style={{ fontFamily: "'JetBrains Mono', monospace" }}
            >
              <th className="px-4 py-2.5">Producto</th>
              <th className="px-4 py-2.5">Origen</th>
              <th className="px-4 py-2.5 text-right">Cantidad</th>
              <th className="px-4 py-2.5 text-right">Costo unit.</th>
              <th className="px-4 py-2.5 text-right">Subtotal</th>
              <th className="px-4 py-2.5">Receptor</th>
              <th className="px-4 py-2.5">Fecha</th>
            </tr>
          </thead>
        <tbody>
          {productos.map((p) => {
            const esInicial = p.origen === 'inicial'
            return (
              <tr key={p.id} className="border-b border-border last:border-0">
                <td className="px-4 py-3">
                  <div className="font-medium text-foreground">{p.producto.nombre}</div>
                  <div
                    className="text-[10px] text-muted-foreground tracking-widest"
                    style={{ fontFamily: "'JetBrains Mono', monospace" }}
                  >
                    {p.producto.codigo}
                  </div>
                </td>
                <td className="px-4 py-3">
                  {esInicial ? (
                    <span
                      className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider px-1.5 py-0.5 bg-secondary/15 text-secondary"
                      style={{ borderRadius: '0.125rem' }}
                    >
                      <Package size={10} />
                      Inicial
                    </span>
                  ) : (
                    <span
                      className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider px-1.5 py-0.5 bg-primary/15 text-primary"
                      style={{ borderRadius: '0.125rem', fontFamily: "'JetBrains Mono', monospace" }}
                      title={p.origenCodigo ?? ''}
                    >
                      <Send size={10} />
                      {p.origenCodigo}
                    </span>
                  )}
                </td>
                <td
                  className="px-4 py-3 text-right"
                  style={{ fontFamily: "'JetBrains Mono', monospace" }}
                >
                  {p.cantidad.toFixed(2)} {p.producto.unidadMedida.abreviatura}
                </td>
                <td
                  className="px-4 py-3 text-right"
                  style={{ fontFamily: "'JetBrains Mono', monospace" }}
                >
                  <ValorBlur value={p.costoUnitario} render={() => formatMoneyCop(p.costoUnitario)} />
                </td>
                <td
                  className="px-4 py-3 text-right font-medium"
                  style={{ fontFamily: "'JetBrains Mono', monospace" }}
                >
                  <ValorBlur value={p.subtotal} render={() => formatMoneyCop(p.subtotal)} />
                </td>
                <td className="px-4 py-3 text-muted-foreground text-xs">
                  {p.tecnicoReceptor?.nombre ?? '— (uso común)'}
                </td>
                <td
                  className="px-4 py-3 text-muted-foreground text-xs"
                  style={{ fontFamily: "'JetBrains Mono', monospace" }}
                >
                  {formatDate(p.fechaEntrega)}
                </td>
              </tr>
            )
          })}
        </tbody>
        <tfoot>
          <tr className="bg-muted/40 border-t-2 border-border">
            <td
              colSpan={4}
              className="px-4 py-2.5 text-right text-[10px] uppercase tracking-widest text-muted-foreground"
              style={{ fontFamily: "'JetBrains Mono', monospace" }}
            >
              Total
            </td>
            <td
              className="px-4 py-2.5 text-right"
              style={{ fontFamily: "'JetBrains Mono', monospace" }}
            >
              <ValorBlur value={totalSubtotal} render={() => formatMoneyCop(totalSubtotal)} />
            </td>
            <td colSpan={2} />
          </tr>
        </tfoot>
        </table>
      </div>

      {/* ── Tabla MOBILE: solo Producto / Origen / Cantidad. ──
          Click en una fila abre un modal con el detalle completo. */}
      <div className="md:hidden">
        <ul className="divide-y divide-border">
          {productos.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => setDetalleId(p.id)}
                className="w-full text-left px-4 py-3 hover:bg-muted/30 active:bg-muted/50 transition-colors flex items-center gap-3"
                aria-label={`Ver detalle de ${p.producto.nombre}`}
              >
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-foreground truncate">
                    {p.producto.nombre}
                  </div>
                  <div
                    className="text-[10px] text-muted-foreground tracking-widest truncate"
                    style={{ fontFamily: "'JetBrains Mono', monospace" }}
                  >
                    {p.producto.codigo}
                  </div>
                </div>
                <OrigenBadge p={p} />
                <div
                  className="text-right shrink-0 tabular-nums"
                  style={{ fontFamily: "'JetBrains Mono', monospace" }}
                >
                  <div className="text-sm text-foreground">
                    {p.cantidad.toFixed(2)}
                  </div>
                  <div className="text-[10px] text-muted-foreground">
                    {p.producto.unidadMedida.abreviatura}
                  </div>
                </div>
                <ChevronRight size={14} className="text-muted-foreground shrink-0" />
              </button>
            </li>
          ))}
        </ul>
      </div>

      {/* ── Modal de detalle (mobile + desktop). Se abre con click
            en una fila. Muestra TODOS los campos del producto. ── */}
      <Modal
        open={!!productoDetalle}
        onClose={() => setDetalleId(null)}
        title={productoDetalle?.producto.nombre ?? 'Detalle del producto'}
        description={
          productoDetalle
            ? `${productoDetalle.producto.codigo} · ${productoDetalle.cantidad.toFixed(2)} ${productoDetalle.producto.unidadMedida.abreviatura}`
            : undefined
        }
        icon={<Package size={18} />}
        size="md"
      >
        {productoDetalle ? (
          <div className="p-5 space-y-4">
            <div className="flex items-center gap-2">
              <OrigenBadge p={productoDetalle} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div
                  className="text-[10px] text-muted-foreground uppercase tracking-widest"
                  style={{ fontFamily: "'JetBrains Mono', monospace" }}
                >
                  Cantidad
                </div>
                <div
                  className="text-base text-foreground mt-0.5 tabular-nums"
                  style={{ fontFamily: "'JetBrains Mono', monospace" }}
                >
                  {productoDetalle.cantidad.toFixed(2)}{' '}
                  {productoDetalle.producto.unidadMedida.abreviatura}
                </div>
              </div>
              <div>
                <div
                  className="text-[10px] text-muted-foreground uppercase tracking-widest"
                  style={{ fontFamily: "'JetBrains Mono', monospace" }}
                >
                  Costo unit.
                </div>
                <div
                  className="text-base text-foreground mt-0.5 tabular-nums"
                  style={{ fontFamily: "'JetBrains Mono', monospace" }}
                >
                  <ValorBlur
                    value={productoDetalle.costoUnitario}
                    render={() => formatMoneyCop(productoDetalle.costoUnitario)}
                  />
                </div>
              </div>
              <div>
                <div
                  className="text-[10px] text-muted-foreground uppercase tracking-widest"
                  style={{ fontFamily: "'JetBrains Mono', monospace" }}
                >
                  Subtotal
                </div>
                <div
                  className="text-base text-primary mt-0.5 tabular-nums"
                  style={{ fontFamily: "'JetBrains Mono', monospace" }}
                >
                  <ValorBlur
                    value={productoDetalle.subtotal}
                    render={() => formatMoneyCop(productoDetalle.subtotal)}
                  />
                </div>
              </div>
              <div>
                <div
                  className="text-[10px] text-muted-foreground uppercase tracking-widest"
                  style={{ fontFamily: "'JetBrains Mono', monospace" }}
                >
                  Fecha
                </div>
                <div
                  className="text-base text-foreground mt-0.5"
                  style={{ fontFamily: "'JetBrains Mono', monospace" }}
                >
                  {formatDate(productoDetalle.fechaEntrega)}
                </div>
              </div>
              <div className="col-span-2">
                <div
                  className="text-[10px] text-muted-foreground uppercase tracking-widest"
                  style={{ fontFamily: "'JetBrains Mono', monospace" }}
                >
                  Receptor
                </div>
                <div className="text-base text-foreground mt-0.5">
                  {productoDetalle.tecnicoReceptor?.nombre ?? '— (uso común)'}
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </Modal>
    </>
  )
}

function SolicitudesTab({ solicitudes, total }: { solicitudes: SolicitudListItem[]; total: number }) {
  const [detalleId, setDetalleId] = useState<string | null>(null)
  if (solicitudes.length === 0) {
    return (
      <div className="py-16 px-6 flex flex-col items-center text-center">
        <Inbox size={28} className="text-muted-foreground mb-3" />
        <p className="text-sm text-muted-foreground">
          No hay solicitudes a bodega para este proyecto. Crea una nueva.
        </p>
      </div>
    )
  }
  const colors: Record<string, string> = {
    pendiente: '#eab308',
    aprobada: '#3b82f6',
    rechazada: '#ef4444',
    entregada: '#22c55e',
  }
  const solicitudDetalle = detalleId
    ? solicitudes.find((s) => s.id === detalleId) ?? null
    : null
  return (
    <>
      {/* Desktop: tabla completa */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-sm min-w-[640px]">
          <thead className="bg-muted/40 border-b border-border">
            <tr className="text-left text-[10px] text-muted-foreground uppercase tracking-widest" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
              <th className="px-4 py-2.5">Código</th>
              <th className="px-4 py-2.5">Estado</th>
              <th className="px-4 py-2.5">Solicitado por</th>
              <th className="px-4 py-2.5">Items</th>
              <th className="px-4 py-2.5">Fecha</th>
            </tr>
          </thead>
          <tbody>
            {solicitudes.map((s) => (
              <tr
                key={s.id}
                className="border-b border-border last:border-0 cursor-pointer hover:bg-muted/30"
                onClick={() => setDetalleId(s.id)}
              >
                <td className="px-4 py-3 font-medium text-foreground" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                  {s.codigo}
                </td>
                <td className="px-4 py-3">
                  <span
                    className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 text-white"
                    style={{ backgroundColor: colors[s.estado] ?? '#6b7280', borderRadius: '0.125rem' }}
                  >
                    {s.estado}
                  </span>
                </td>
                <td className="px-4 py-3 text-muted-foreground">{s.solicitadoPor.nombre}</td>
                <td className="px-4 py-3 text-muted-foreground text-xs">{s.totalItems}</td>
                <td className="px-4 py-3 text-muted-foreground text-xs" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                  {formatDate(s.fechaSolicitud)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile: lista compacta. Click → modal */}
      <ul className="md:hidden divide-y divide-border">
        {solicitudes.map((s) => (
          <li key={s.id}>
            <button
              type="button"
              onClick={() => setDetalleId(s.id)}
              className="w-full text-left px-4 py-3 hover:bg-muted/30 active:bg-muted/50 transition-colors flex items-center gap-3"
              aria-label={`Ver detalle de ${s.codigo}`}
            >
              <div className="flex-1 min-w-0">
                <div
                  className="font-medium text-foreground"
                  style={{ fontFamily: "'JetBrains Mono', monospace" }}
                >
                  {s.codigo}
                </div>
                <div className="text-[10px] text-muted-foreground">
                  {s.solicitadoPor.nombre} · {s.totalItems} items
                </div>
              </div>
              <span
                className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 text-white shrink-0"
                style={{ backgroundColor: colors[s.estado] ?? '#6b7280', borderRadius: '0.125rem' }}
              >
                {s.estado}
              </span>
              <ChevronRight size={14} className="text-muted-foreground shrink-0" />
            </button>
          </li>
        ))}
      </ul>

      {/* Modal: detalle completo de la solicitud (mobile + desktop click) */}
      <Modal
        open={!!solicitudDetalle}
        onClose={() => setDetalleId(null)}
        title={solicitudDetalle?.codigo ?? 'Detalle de la solicitud'}
        description={
          solicitudDetalle
            ? `${solicitudDetalle.totalItems} items · ${formatDate(solicitudDetalle.fechaSolicitud)}`
            : undefined
        }
        icon={<Send size={18} />}
        size="md"
      >
        {solicitudDetalle ? (
          <div className="p-5 space-y-4">
            <div>
              <span
                className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 text-white"
                style={{ backgroundColor: colors[solicitudDetalle.estado] ?? '#6b7280', borderRadius: '0.125rem' }}
              >
                {solicitudDetalle.estado}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div
                  className="text-[10px] text-muted-foreground uppercase tracking-widest"
                  style={{ fontFamily: "'JetBrains Mono', monospace" }}
                >
                  Solicitado por
                </div>
                <div className="text-base text-foreground mt-0.5">
                  {solicitudDetalle.solicitadoPor.nombre}
                </div>
              </div>
              <div>
                <div
                  className="text-[10px] text-muted-foreground uppercase tracking-widest"
                  style={{ fontFamily: "'JetBrains Mono', monospace" }}
                >
                  Items
                </div>
                <div
                  className="text-base text-foreground mt-0.5"
                  style={{ fontFamily: "'JetBrains Mono', monospace" }}
                >
                  {solicitudDetalle.totalItems}
                </div>
              </div>
              <div>
                <div
                  className="text-[10px] text-muted-foreground uppercase tracking-widest"
                  style={{ fontFamily: "'JetBrains Mono', monospace" }}
                >
                  Fecha solicitud
                </div>
                <div
                  className="text-base text-foreground mt-0.5"
                  style={{ fontFamily: "'JetBrains Mono', monospace" }}
                >
                  {formatDate(solicitudDetalle.fechaSolicitud)}
                </div>
              </div>
              {solicitudDetalle.fechaAprobacion && (
                <div>
                  <div
                    className="text-[10px] text-muted-foreground uppercase tracking-widest"
                    style={{ fontFamily: "'JetBrains Mono', monospace" }}
                  >
                    Fecha aprobación
                  </div>
                  <div
                    className="text-base text-foreground mt-0.5"
                    style={{ fontFamily: "'JetBrains Mono', monospace" }}
                  >
                    {formatDate(solicitudDetalle.fechaAprobacion)}
                  </div>
                </div>
              )}
              {solicitudDetalle.fechaEntrega && (
                <div>
                  <div
                    className="text-[10px] text-muted-foreground uppercase tracking-widest"
                    style={{ fontFamily: "'JetBrains Mono', monospace" }}
                  >
                    Fecha entrega
                  </div>
                  <div
                    className="text-base text-foreground mt-0.5"
                    style={{ fontFamily: "'JetBrains Mono', monospace" }}
                  >
                    {formatDate(solicitudDetalle.fechaEntrega)}
                  </div>
                </div>
              )}
              {solicitudDetalle.fechaRechazo && (
                <div>
                  <div
                    className="text-[10px] text-muted-foreground uppercase tracking-widest"
                    style={{ fontFamily: "'JetBrains Mono', monospace" }}
                  >
                    Fecha rechazo
                  </div>
                  <div
                    className="text-base text-foreground mt-0.5"
                    style={{ fontFamily: "'JetBrains Mono', monospace" }}
                  >
                    {formatDate(solicitudDetalle.fechaRechazo)}
                  </div>
                </div>
              )}
              {solicitudDetalle.aprobadoPor && (
                <div>
                  <div
                    className="text-[10px] text-muted-foreground uppercase tracking-widest"
                    style={{ fontFamily: "'JetBrains Mono', monospace" }}
                  >
                    Aprobado por
                  </div>
                  <div className="text-base text-foreground mt-0.5">
                    {solicitudDetalle.aprobadoPor.nombre}
                  </div>
                </div>
              )}
              {solicitudDetalle.entregadoPor && (
                <div>
                  <div
                    className="text-[10px] text-muted-foreground uppercase tracking-widest"
                    style={{ fontFamily: "'JetBrains Mono', monospace" }}
                  >
                    Entregado por
                  </div>
                  <div className="text-base text-foreground mt-0.5">
                    {solicitudDetalle.entregadoPor.nombre}
                  </div>
                </div>
              )}
              {solicitudDetalle.rechazadoPor && (
                <div>
                  <div
                    className="text-[10px] text-muted-foreground uppercase tracking-widest"
                    style={{ fontFamily: "'JetBrains Mono', monospace" }}
                  >
                    Rechazado por
                  </div>
                  <div className="text-base text-foreground mt-0.5">
                    {solicitudDetalle.rechazadoPor.nombre}
                  </div>
                </div>
              )}
              {solicitudDetalle.comentario && (
                <div className="col-span-2">
                  <div
                    className="text-[10px] text-muted-foreground uppercase tracking-widest"
                    style={{ fontFamily: "'JetBrains Mono', monospace" }}
                  >
                    Comentario
                  </div>
                  <div className="text-base text-foreground mt-0.5 whitespace-pre-wrap">
                    {solicitudDetalle.comentario}
                  </div>
                </div>
              )}
              {solicitudDetalle.motivoRechazo && (
                <div className="col-span-2">
                  <div
                    className="text-[10px] text-muted-foreground uppercase tracking-widest"
                    style={{ fontFamily: "'JetBrains Mono', monospace" }}
                  >
                    Motivo de rechazo
                  </div>
                  <div className="text-base text-foreground mt-0.5 whitespace-pre-wrap">
                    {solicitudDetalle.motivoRechazo}
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : null}
      </Modal>
      {total > solicitudes.length && (
        <div className="p-3 text-center text-xs text-muted-foreground">
          Mostrando {solicitudes.length} de {total} solicitudes
        </div>
      )}
    </>
  )
}

function AvancesTab({ avances, total }: { avances: AvanceListItem[]; total: number }) {
  const [detalleId, setDetalleId] = useState<string | null>(null)
  if (avances.length === 0) {
    return (
      <div className="py-16 px-6 flex flex-col items-center text-center">
        <Inbox size={28} className="text-muted-foreground mb-3" />
        <p className="text-sm text-muted-foreground">
          Sin avances registrados. Hacé click en "Registrar avance".
        </p>
      </div>
    )
  }
  const avanceDetalle = detalleId
    ? avances.find((a) => a.id === detalleId) ?? null
    : null
  return (
    <>
      {/* Desktop + Mobile: cada avance es una card. En mobile se ve
          más compacta y es clickeable. En desktop ya tiene más aire. */}
      <div className="divide-y divide-border">
        {avances.map((a) => (
          <button
            key={a.id}
            type="button"
            onClick={() => setDetalleId(a.id)}
            className="w-full text-left p-4 sm:p-5 hover:bg-muted/30 active:bg-muted/50 transition-colors"
          >
            <div className="flex items-start justify-between gap-3 mb-2">
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-foreground">
                  {a.tecnico.nombre} · {a.kmAvanzadosEnEstaFecha.toFixed(2)} km
                </div>
                <div
                  className="text-[10px] text-muted-foreground mt-0.5"
                  style={{ fontFamily: "'JetBrains Mono', monospace" }}
                >
                  {formatDate(a.fechaAvance)} · registrado {formatDate(a.fechaRegistro)}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {a.totalProductosUsados > 0 && (
                  <span
                    className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 bg-muted text-muted-foreground"
                    style={{ borderRadius: '0.125rem' }}
                  >
                    {a.totalProductosUsados} productos
                  </span>
                )}
                <ChevronRight size={14} className="text-muted-foreground md:hidden" />
              </div>
            </div>
            {a.descripcion && (
              <p className="text-sm text-foreground/90 mb-2 whitespace-pre-wrap line-clamp-2 md:line-clamp-none">
                {a.descripcion}
              </p>
            )}
            {a.ubicacion && (
              <p className="text-xs text-muted-foreground mb-2">📍 {a.ubicacion}</p>
            )}
            {/* Miniaturas de fotos, solo desktop (en mobile las vemos
                en el modal). Oculto < md para que la card no
                explote verticalmente. */}
            {a.fotos && a.fotos.length > 0 && (
              <div className="hidden md:flex flex-wrap gap-2 mt-2">
                {a.fotos.slice(0, 8).map((f, i) => {
                  const url = imageUrl(f.url ?? f.key)
                  if (!url) return null
                  return (
                    <a
                      key={i}
                      href={url}
                      target="_blank"
                      rel="noreferrer"
                      className="block w-20 h-20 bg-muted overflow-hidden border border-border"
                      style={{ borderRadius: '0.125rem' }}
                    >
                      <img
                        src={url}
                        alt={`Foto ${i + 1}`}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    </a>
                  )
                })}
                {a.fotos.length > 8 && (
                  <div
                    className="w-20 h-20 flex items-center justify-center text-xs text-muted-foreground bg-muted border border-border"
                    style={{ borderRadius: '0.125rem' }}
                  >
                    +{a.fotos.length - 8}
                  </div>
                )}
              </div>
            )}
          </button>
        ))}
      </div>

      {/* Modal: detalle del avance (mobile + desktop click).
          Acá mostramos TODO: descripción completa, ubicación,
          fotos en grid, productos usados, etc. */}
      <Modal
        open={!!avanceDetalle}
        onClose={() => setDetalleId(null)}
        title="Detalle del avance"
        description={
          avanceDetalle
            ? `${avanceDetalle.tecnico.nombre} · ${avanceDetalle.kmAvanzadosEnEstaFecha.toFixed(2)} km`
            : undefined
        }
        icon={<Camera size={18} />}
        size="lg"
      >
        {avanceDetalle ? (
          <div className="p-5 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div
                  className="text-[10px] text-muted-foreground uppercase tracking-widest"
                  style={{ fontFamily: "'JetBrains Mono', monospace" }}
                >
                  Fecha del avance
                </div>
                <div
                  className="text-base text-foreground mt-0.5"
                  style={{ fontFamily: "'JetBrains Mono', monospace" }}
                >
                  {formatDate(avanceDetalle.fechaAvance)}
                </div>
              </div>
              <div>
                <div
                  className="text-[10px] text-muted-foreground uppercase tracking-widest"
                  style={{ fontFamily: "'JetBrains Mono', monospace" }}
                >
                  Registrado
                </div>
                <div
                  className="text-base text-foreground mt-0.5"
                  style={{ fontFamily: "'JetBrains Mono', monospace" }}
                >
                  {formatDate(avanceDetalle.fechaRegistro)}
                </div>
              </div>
              {avanceDetalle.ubicacion && (
                <div className="col-span-2">
                  <div
                    className="text-[10px] text-muted-foreground uppercase tracking-widest"
                    style={{ fontFamily: "'JetBrains Mono', monospace" }}
                  >
                    Ubicación
                  </div>
                  <div className="text-base text-foreground mt-0.5">
                    📍 {avanceDetalle.ubicacion}
                  </div>
                </div>
              )}
              {avanceDetalle.nodo && (
                <div className="col-span-2">
                  <div
                    className="text-[10px] text-muted-foreground uppercase tracking-widest"
                    style={{ fontFamily: "'JetBrains Mono', monospace" }}
                  >
                    Nodo asociado
                  </div>
                  <div className="text-base text-foreground mt-0.5">
                    #{avanceDetalle.nodo.orden} ·{' '}
                    {avanceDetalle.nodo.nombre ?? `Nodo ${avanceDetalle.nodo.orden}`}
                  </div>
                </div>
              )}
              {avanceDetalle.descripcion && (
                <div className="col-span-2">
                  <div
                    className="text-[10px] text-muted-foreground uppercase tracking-widest"
                    style={{ fontFamily: "'JetBrains Mono', monospace" }}
                  >
                    Descripción
                  </div>
                  <div className="text-base text-foreground mt-0.5 whitespace-pre-wrap">
                    {avanceDetalle.descripcion}
                  </div>
                </div>
              )}
            </div>
            {avanceDetalle.fotos && avanceDetalle.fotos.length > 0 && (
              <div>
                <div
                  className="text-[10px] text-muted-foreground uppercase tracking-widest mb-2"
                  style={{ fontFamily: "'JetBrains Mono', monospace" }}
                >
                  Fotos
                </div>
                <div className="flex flex-wrap gap-2">
                  {avanceDetalle.fotos.map((f, i) => {
                    const url = imageUrl(f.url ?? f.key)
                    if (!url) return null
                    return (
                      <a
                        key={i}
                        href={url}
                        target="_blank"
                        rel="noreferrer"
                        className="block w-20 h-20 bg-muted overflow-hidden border border-border"
                        style={{ borderRadius: '0.125rem' }}
                      >
                        <img
                          src={url}
                          alt={`Foto ${i + 1}`}
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                      </a>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        ) : null}
      </Modal>
      {total > avances.length && (
        <div className="p-3 text-center text-xs text-muted-foreground">
          Mostrando {avances.length} de {total} avances
        </div>
      )}
    </>
  )
}

// ─────────────────────────────────────────────────────────────
//  MapaTab — recorrido del proyecto (nodos + avances)
// ─────────────────────────────────────────────────────────────

function MapaTab({
  nodos,
  avances,
  onEditarRecorrido,
  onSubirAvance,
  puedeRegistrarAvance,
  estadoTerminal,
}: {
  nodos: any
  avances: AvancePin[]
  /** Botón para abrir el editor de nodos (mapa con click para crear). */
  onEditarRecorrido?: () => void
  /** Click en "Subir avance" de un nodo. */
  onSubirAvance: (nodoId: string, kmAcumulado: number) => void
  /** Si el user tiene permiso para registrar avances. */
  puedeRegistrarAvance: boolean
  /** Si el proyecto está finalizado/cancelado (no se pueden subir). */
  estadoTerminal: boolean
}) {
  const totalKmRuta = nodos[nodos.length - 1]?.kmAcumulado ?? 0
  const totalNodos = nodos.length
  const totalAvancesMapa = avances.length

  // Detalle abierto (mobile + click en desktop). null = cerrado.
  const [detalleNodoId, setDetalleNodoId] = useState<string | null>(null)
  const nodoDetalle = detalleNodoId
    ? nodos.find((n: any) => n.id === detalleNodoId) ?? null
    : null
  const nodoDetalleIdx = nodoDetalle
    ? nodos.findIndex((n: any) => n.id === nodoDetalle.id)
    : -1
  // Para el modal replicamos los flags que muestra la tabla.
  const nodoDetalleEsUltimo =
    nodoDetalle != null && nodoDetalle.tipo === 'fin'
  const nodoDetalleAnteriorCompletado =
    nodoDetalleIdx > 0
      ? avances.some((a) => a.nodoId === nodos[nodoDetalleIdx - 1].id)
      : true
  const nodoDetalleCompletado =
    nodoDetalle != null
      ? avances.some((a) => a.nodoId === nodoDetalle.id)
      : false
  const antepenultimo = nodos[nodos.length - 2]
  const recorridoCompleto =
    !!antepenultimo && avances.some((a) => a.nodoId === antepenultimo.id)

  // Calculamos el estado de cada nodo a partir de los avances.
  // Como cada nodo del recorrido solo se "visita" una vez (el front
  // usa el orden), basta con mirar si hay un avance cuyo `nodoId`
  // coincide. Si lo hay → completado. Si no → en espera.
  // PERO los `avances` que llegan al MapaTab son AvancePin (sin
  // nodoId), así que usamos un workaround: cruzamos por las
  // coordenadas del nodo.
  // (Más limpio sería que MapaTab reciba los `avances` completos
  // con su `nodo`, pero por ahora lo hacemos por coord.)
  // En su lugar, calculamos desde los `nodos` que ya tienen
  // `id`, y dejamos el `set de nodos completados` para el
  // componente padre (que tiene la lista completa de AvanceListItem).
  // Por simplicidad, calculamos acá mismo contando los pines
  // que coinciden con las coords del nodo.

  return (
    <div className="p-4 sm:p-5 space-y-4">
      {/* Resumen rápido (KPIs) */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-muted/30 border border-border p-3" style={{ borderRadius: '0.25rem' }}>
          <div
            className="text-[10px] text-muted-foreground tracking-widest uppercase"
            style={{ fontFamily: "'JetBrains Mono', monospace" }}
          >
            Nodos del recorrido
          </div>
          <div
            className="text-xl font-bold text-foreground mt-1"
            style={{ fontFamily: "'Barlow Condensed', sans-serif" }}
          >
            {totalNodos}
          </div>
        </div>
        <div className="bg-muted/30 border border-border p-3" style={{ borderRadius: '0.25rem' }}>
          <div
            className="text-[10px] text-muted-foreground tracking-widest uppercase"
            style={{ fontFamily: "'JetBrains Mono', monospace" }}
          >
            Km totales de la ruta
          </div>
          <div
            className="text-xl font-bold text-foreground mt-1"
            style={{ fontFamily: "'Barlow Condensed', sans-serif" }}
          >
            {totalKmRuta.toFixed(2)}
          </div>
        </div>
        <div className="bg-muted/30 border border-border p-3" style={{ borderRadius: '0.25rem' }}>
          <div
            className="text-[10px] text-muted-foreground tracking-widest uppercase"
            style={{ fontFamily: "'JetBrains Mono', monospace" }}
          >
            Avances con nodo
          </div>
          <div
            className="text-xl font-bold text-foreground mt-1"
            style={{ fontFamily: "'Barlow Condensed', sans-serif" }}
          >
            {totalAvancesMapa}
          </div>
        </div>
      </div>

      {/* Lista de nodos (SIEMPRE presente). Es el detalle que más
          se consulta: el mapa es visual pero la lista es la fuente
          de verdad de los nodos registrados. */}
      <div className="border border-border overflow-hidden" style={{ borderRadius: '0.25rem' }}>
        <div
          className="flex items-center justify-between px-4 py-2 bg-muted/40"
        >
          <div
            className="text-[10px] uppercase tracking-widest text-muted-foreground"
            style={{ fontFamily: "'JetBrains Mono', monospace" }}
          >
            Recorrido · {totalNodos} {totalNodos === 1 ? 'nodo' : 'nodos'}
          </div>
          {onEditarRecorrido && (
            <button
              type="button"
              onClick={onEditarRecorrido}
              className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider text-primary hover:underline"
              style={{ fontFamily: "'JetBrains Mono', monospace" }}
            >
              {totalNodos === 0 ? '+ Marcar recorrido' : 'Editar'}
            </button>
          )}
        </div>
        {totalNodos === 0 ? (
          <div className="px-4 py-6 text-center text-xs text-muted-foreground">
            Aún no hay nodos registrados. Click "Marcar recorrido" para
            empezar a marcar el estudio previo del proyecto.
          </div>
        ) : (
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm min-w-[640px]">
            <thead>
              <tr
                className="bg-muted/30 border-b border-border text-[10px] text-muted-foreground uppercase tracking-widest"
                style={{ fontFamily: "'JetBrains Mono', monospace" }}
              >
                <th className="px-3 py-2 w-10 text-center">#</th>
                <th className="px-3 py-2 text-left">Nodo</th>
                <th className="px-3 py-2 text-left">Trayecto</th>
                <th className="px-3 py-2 text-right">Km acum.</th>
                <th className="px-3 py-2 text-right hidden sm:table-cell">
                  Coords
                </th>
                <th className="px-3 py-2 text-right">Acción</th>
              </tr>
            </thead>
            <tbody>
              {nodos.map((n: any, idx: number) => {
              const color =
                n.tipo === 'inicio'
                  ? '#22c55e'
                  : n.tipo === 'fin'
                    ? '#ef4444'
                    : '#3b82f6'
              // ¿Este nodo ya tiene un avance registrado?
              const completado = avances.some(
                (a) => a.nodoId === n.id,
              )
              // ¿Se puede subir avance en este nodo?
              // Reglas de la trazabilidad N → N+1:
              //  - El primer nodo (inicio) siempre se puede.
              //  - Los intermedios, solo si el ANTERIOR está
              //    completado.
              //  - El ÚLTIMO nodo (fin) NO tiene botón de subir
              //    avance: es la meta del recorrido, no hay un
              //    tramo propio que documentar. Solo se muestra
              //    como "Final".
              const anterior = idx > 0 ? nodos[idx - 1] : null
              const anteriorCompletado =
                anterior == null
                  ? true
                  : avances.some((a) => a.nodoId === anterior.id)
              const esUltimoNodo = n.tipo === 'fin'
              // El recorrido queda completo cuando se sube el
              // avance del ANTEPENÚLTIMO nodo (que documenta el
              // tramo "De Nodo N-1 a Nodo N", o sea, hasta la
              // meta). Sin ese avance, el último nodo sigue
              // siendo una meta "pendiente" — hay que llegar
              // hasta él, no solo definirlo.
              const antepenultimo = nodos[nodos.length - 2]
              const recorridoCompleto =
                !!antepenultimo &&
                avances.some((a) => a.nodoId === antepenultimo.id)
              // Solo se puede subir avance si el nodo NO está
              // completado todavía (la trazabilidad N → N+1 es
              // de un solo uso por nodo: cuando se sube, queda
              // "completado" y el siguiente se desbloquea).
              // El último nodo tampoco tiene botón (es la meta).
              const puedeSubir =
                !estadoTerminal &&
                !esUltimoNodo &&
                !completado &&
                puedeRegistrarAvance &&
                anteriorCompletado
              return (
                <tr
                  key={n.id}
                  className="border-b border-border last:border-0 hover:bg-muted/20"
                >
                  {/* # (bolita numerada) */}
                  <td className="px-3 py-2.5 text-center align-middle">
                    <span
                      className="inline-flex w-7 h-7 rounded-full items-center justify-center text-xs font-bold text-white"
                      style={{
                        background: color,
                        fontFamily: "'JetBrains Mono', monospace",
                      }}
                    >
                      {n.orden}
                    </span>
                  </td>
                  {/* Nodo (nombre + badge de estado + tipo) */}
                  <td className="px-3 py-2.5 align-middle">
                    <div className="flex items-center gap-2 flex-wrap">
                      <div className="text-sm font-medium text-foreground">
                        {n.nombre ?? `Nodo ${n.orden}`}
                      </div>
                      {esUltimoNodo && recorridoCompleto ? (
                        <span
                          className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] uppercase tracking-wider"
                          style={{
                            backgroundColor: '#22c55e',
                            color: 'white',
                            borderRadius: '0.125rem',
                            fontFamily: "'JetBrains Mono', monospace",
                          }}
                          title="Se subió el avance del tramo final: el recorrido está completo"
                        >
                          <CheckCircle2 size={9} />
                          Recorrido completo
                        </span>
                      ) : esUltimoNodo ? (
                        <span
                          className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] uppercase tracking-wider"
                          style={{
                            backgroundColor: '#3b82f6',
                            color: 'white',
                            borderRadius: '0.125rem',
                            fontFamily: "'JetBrains Mono', monospace",
                          }}
                          title="Es la meta del recorrido — falta subir el avance del tramo anterior"
                        >
                          Meta
                        </span>
                      ) : completado ? (
                        <span
                          className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] uppercase tracking-wider"
                          style={{
                            backgroundColor: '#22c55e',
                            color: 'white',
                            borderRadius: '0.125rem',
                            fontFamily: "'JetBrains Mono', monospace",
                          }}
                          title="Ya hay un avance registrado en este nodo"
                        >
                          <CheckCircle2 size={9} />
                          Completado
                        </span>
                      ) : (
                        <span
                          className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] uppercase tracking-wider"
                          style={{
                            backgroundColor:
                              anteriorCompletado ? '#eab308' : '#6b7280',
                            color: 'white',
                            borderRadius: '0.125rem',
                            fontFamily: "'JetBrains Mono', monospace",
                          }}
                          title={
                            anteriorCompletado
                              ? 'Listo para subir avance'
                              : 'Esperando que se complete el nodo anterior'
                          }
                        >
                          {anteriorCompletado ? 'En espera' : 'Bloqueado'}
                        </span>
                      )}
                    </div>
                    <div
                      className="text-[10px] text-muted-foreground uppercase tracking-wider mt-0.5"
                      style={{ fontFamily: "'JetBrains Mono', monospace" }}
                    >
                      {n.tipo}
                    </div>
                  </td>
                  {/* Trayecto (regla N → N+1) */}
                  <td
                    className="px-3 py-2.5 align-middle text-[10px] uppercase tracking-wider text-muted-foreground"
                    style={{ fontFamily: "'JetBrains Mono', monospace" }}
                  >
                    {esUltimoNodo
                      ? '—'
                      : `De Nodo ${n.orden} a Nodo ${nodos[idx + 1].orden}`}
                  </td>
                  {/* Km acumulado */}
                  <td
                    className="px-3 py-2.5 align-middle text-right tabular-nums"
                    style={{ fontFamily: "'JetBrains Mono', monospace" }}
                  >
                    {n.kmAcumulado.toFixed(2)}{' '}
                    <span className="text-[10px] text-muted-foreground">km</span>
                  </td>
                  {/* Coords */}
                  <td
                    className="px-3 py-2.5 align-middle text-right hidden sm:table-cell text-[10px] text-muted-foreground tabular-nums"
                    style={{ fontFamily: "'JetBrains Mono', monospace" }}
                    title={`${n.latitud}, ${n.longitud}`}
                  >
                    {n.latitud.toFixed(5)}, {n.longitud.toFixed(5)}
                  </td>
                  {/* Acción (botón "Subir avance", "Final" o "Recorrido completo") */}
                  <td className="px-3 py-2.5 align-middle text-right">
                    {esUltimoNodo && recorridoCompleto ? (
                      <span
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-[10px] uppercase tracking-wider font-semibold"
                        style={{
                          backgroundColor: '#22c55e',
                          color: 'white',
                          borderRadius: '0.15rem',
                          fontFamily: "'JetBrains Mono', monospace",
                        }}
                        title="El recorrido está completo: se subió el avance del último tramo"
                      >
                        <CheckCircle2 size={11} />
                        Recorrido completo
                      </span>
                    ) : esUltimoNodo ? (
                      <span
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-[10px] uppercase tracking-wider font-semibold"
                        style={{
                          backgroundColor: '#1f2937',
                          color: 'white',
                          borderRadius: '0.15rem',
                          fontFamily: "'JetBrains Mono', monospace",
                        }}
                        title="Último nodo del recorrido, no requiere avance propio"
                      >
                        <Flag size={11} />
                        Final
                      </span>
                    ) : !completado && puedeRegistrarAvance && !estadoTerminal ? (
                      <button
                        type="button"
                        onClick={() => {
                          if (!puedeSubir) return
                          // El avance del nodo N documenta el
                          // tramo DESDE N HASTA N+1, así que los
                          // km registrados son la distancia
                          // acumulada en el nodo N+1 (no en N).
                          // El id del nodo que se pasa es el de
                          // N (el avance queda asociado a N,
                          // que es el que se "completó" al
                          // llegar a N+1).
                          const nodoSiguiente = nodos[idx + 1]
                          const kmHastaSiguiente = nodoSiguiente
                            ? nodoSiguiente.kmAcumulado
                            : n.kmAcumulado
                          onSubirAvance(n.id, kmHastaSiguiente)
                        }}
                        disabled={!puedeSubir}
                        className={[
                          'inline-flex items-center gap-1 px-2.5 py-1 text-[10px] uppercase tracking-wider font-semibold transition-colors',
                          puedeSubir
                            ? 'bg-primary text-primary-foreground hover:opacity-90'
                            : 'bg-muted text-muted-foreground cursor-not-allowed',
                        ].join(' ')}
                        style={{ borderRadius: '0.15rem' }}
                        title={
                          puedeSubir
                            ? `Registrar avance del tramo De Nodo ${n.orden} a Nodo ${nodos[idx + 1].orden}`
                            : 'Tenés que completar el nodo anterior primero'
                        }
                      >
                        <Camera size={11} />
                        Subir avance
                      </button>
                    ) : null}
                  </td>
                </tr>
              )
            })}
            </tbody>
            </table>
          </div>
        )}
        {/* Mobile: lista compacta con # / Nombre / Km.
            Click → modal con todos los detalles del nodo. */}
        <ul className="md:hidden divide-y divide-border">
          {nodos.map((n: any, idx: number) => {
            const color =
              n.tipo === 'inicio'
                ? '#22c55e'
                : n.tipo === 'fin'
                  ? '#ef4444'
                  : '#3b82f6'
            return (
              <li key={n.id}>
                <button
                  type="button"
                  onClick={() => setDetalleNodoId(n.id)}
                  className="w-full text-left px-4 py-3 hover:bg-muted/30 active:bg-muted/50 transition-colors flex items-center gap-3"
                  aria-label={`Ver detalle del nodo ${n.orden}`}
                >
                  <span
                    className="inline-flex w-7 h-7 rounded-full items-center justify-center text-xs font-bold text-white shrink-0"
                    style={{
                      background: color,
                      fontFamily: "'JetBrains Mono', monospace",
                    }}
                  >
                    {n.orden}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-foreground truncate">
                      {n.nombre ?? `Nodo ${n.orden}`}
                    </div>
                    <div
                      className="text-[10px] text-muted-foreground uppercase tracking-widest"
                      style={{ fontFamily: "'JetBrains Mono', monospace" }}
                    >
                      {n.tipo}
                    </div>
                  </div>
                  <div
                    className="text-right shrink-0 tabular-nums"
                    style={{ fontFamily: "'JetBrains Mono', monospace" }}
                  >
                    <div className="text-sm text-foreground">
                      {n.kmAcumulado.toFixed(2)}
                    </div>
                    <div className="text-[10px] text-muted-foreground">km</div>
                  </div>
                  <ChevronRight size={14} className="text-muted-foreground shrink-0" />
                </button>
              </li>
            )
          })}
        </ul>
      </div>

      {/* Modal: detalle del nodo (mobile + desktop click) */}
      <Modal
        open={!!nodoDetalle}
        onClose={() => setDetalleNodoId(null)}
        title={
          nodoDetalle
            ? nodoDetalle.nombre ?? `Nodo ${nodoDetalle.orden}`
            : 'Detalle del nodo'
        }
        description={
          nodoDetalle
            ? `Nodo #${nodoDetalle.orden} · ${nodoDetalle.tipo}`
            : undefined
        }
        icon={<MapPin size={18} />}
        size="md"
      >
        {nodoDetalle ? (
          <div className="p-5 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div
                  className="text-[10px] text-muted-foreground uppercase tracking-widest"
                  style={{ fontFamily: "'JetBrains Mono', monospace" }}
                >
                  Km acumulado
                </div>
                <div
                  className="text-base text-foreground mt-0.5 tabular-nums"
                  style={{ fontFamily: "'JetBrains Mono', monospace" }}
                >
                  {nodoDetalle.kmAcumulado.toFixed(2)} km
                </div>
              </div>
              <div>
                <div
                  className="text-[10px] text-muted-foreground uppercase tracking-widest"
                  style={{ fontFamily: "'JetBrains Mono', monospace" }}
                >
                  Tipo
                </div>
                <div
                  className="text-base text-foreground mt-0.5 uppercase"
                  style={{ fontFamily: "'JetBrains Mono', monospace" }}
                >
                  {nodoDetalle.tipo}
                </div>
              </div>
              <div className="col-span-2">
                <div
                  className="text-[10px] text-muted-foreground uppercase tracking-widest"
                  style={{ fontFamily: "'JetBrains Mono', monospace" }}
                >
                  Coordenadas
                </div>
                <div
                  className="text-sm text-foreground mt-0.5 tabular-nums"
                  style={{ fontFamily: "'JetBrains Mono', monospace" }}
                >
                  {nodoDetalle.latitud.toFixed(5)},{' '}
                  {nodoDetalle.longitud.toFixed(5)}
                </div>
              </div>
              {nodoDetalleEsUltimo ? (
                <div className="col-span-2">
                  <div
                    className="text-[10px] text-muted-foreground uppercase tracking-widest"
                    style={{ fontFamily: "'JetBrains Mono', monospace" }}
                  >
                    Estado
                  </div>
                  <div className="text-base text-foreground mt-0.5">
                    {recorridoCompleto ? (
                      <span
                        className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] uppercase tracking-wider"
                        style={{
                          backgroundColor: '#22c55e',
                          color: 'white',
                          borderRadius: '0.125rem',
                          fontFamily: "'JetBrains Mono', monospace",
                        }}
                      >
                        <CheckCircle2 size={9} />
                        Recorrido completo
                      </span>
                    ) : (
                      <span
                        className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] uppercase tracking-wider"
                        style={{
                          backgroundColor: '#3b82f6',
                          color: 'white',
                          borderRadius: '0.125rem',
                          fontFamily: "'JetBrains Mono', monospace",
                        }}
                      >
                        Meta
                      </span>
                    )}
                  </div>
                </div>
              ) : (
                <div className="col-span-2">
                  <div
                    className="text-[10px] text-muted-foreground uppercase tracking-widest"
                    style={{ fontFamily: "'JetBrains Mono', monospace" }}
                  >
                    Trayecto
                  </div>
                  <div
                    className="text-sm text-foreground mt-0.5"
                    style={{ fontFamily: "'JetBrains Mono', monospace" }}
                  >
                    De Nodo {nodoDetalle.orden} a Nodo{' '}
                    {nodos[nodoDetalleIdx + 1]?.orden}
                  </div>
                </div>
              )}
              {nodoDetalleEsUltimo ? null : (
                <div className="col-span-2">
                  <div
                    className="text-[10px] text-muted-foreground uppercase tracking-widest"
                    style={{ fontFamily: "'JetBrains Mono', monospace" }}
                  >
                    Estado
                  </div>
                  <div className="text-base text-foreground mt-0.5">
                    {nodoDetalleCompletado ? (
                      <span
                        className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] uppercase tracking-wider"
                        style={{
                          backgroundColor: '#22c55e',
                          color: 'white',
                          borderRadius: '0.125rem',
                          fontFamily: "'JetBrains Mono', monospace",
                        }}
                      >
                        <CheckCircle2 size={9} />
                        Completado
                      </span>
                    ) : (
                      <span
                        className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] uppercase tracking-wider"
                        style={{
                          backgroundColor: nodoDetalleAnteriorCompletado
                            ? '#eab308'
                            : '#6b7280',
                          color: 'white',
                          borderRadius: '0.125rem',
                          fontFamily: "'JetBrains Mono', monospace",
                        }}
                      >
                        {nodoDetalleAnteriorCompletado
                          ? 'En espera'
                          : 'Bloqueado'}
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : null}
      </Modal>

      {/* Mapa (decorativo, debajo de la lista). Si Leaflet no carga
          los tiles (problema conocido dentro de modales), la lista
          de arriba sigue siendo la fuente de verdad. */}
      <MapaNodos nodos={nodos} avances={avances} />
    </div>
  )
}
