/**
 * Vista principal del submódulo Proyectos (dentro de Técnicos).
 *
 * Layout:
 *  - Header con título y botón "Nuevo proyecto"
 *  - 3 KPIs: Activos / Técnicos asignados / Por iniciar
 *  - Filtros: por estado, por bodega, buscar
 *  - Grid de cards (1 columna en mobile, 2 en tablet, 3 en desktop)
 *  - Paginación al fondo
 *
 * Cards muestran: nombre, código, estado (badge), % avance (barra
 * horizontal), costo total, fecha inicio, técnicos (contador).
 *
 * Click en la card → abre el detalle (Capa 8). Por ahora navega a
 * `/tecnicos/proyectos/:id` (la ruta ya existe en el router).
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  FolderKanban,
  Plus,
  Search,
  Users,
  CalendarDays,
  TrendingUp,
  Inbox,
  Loader2,
} from 'lucide-react'
import { useBodegaActiva } from '../../store/bodegaActiva'
import { useAuth, authStore } from '../../store/auth'
import { PageHeader } from '../PageHeader'
import { Pagination } from '../Pagination'
import { proyectosStore, useProyectos } from './store'
import { ProyectoFormModal } from './ProyectoFormModal'
import type { ListProyectosQuery, ProyectoListItem } from './types'
import { ValorBlur } from '../../lib/valorBlur'

const DEFAULT_PAGE_SIZE = 9

/** Color del badge de estado. Si el catálogo no trae color, fallback. */
function colorBadge(nombre: string, colorHex: string | null): string {
  if (colorHex) return colorHex
  switch (nombre) {
    case 'Planificado':
      return '#6b7280' // gris
    case 'EnProgreso':
      return '#22c55e' // verde
    case 'Pausado':
      return '#eab308' // amarillo
    case 'Finalizado':
      return '#3b82f6' // azul
    case 'Cancelado':
      return '#ef4444' // rojo
    default:
      return '#6b7280'
  }
}

function formatMoneyUsd(n: number): string {
  // ⚠️ Formato USD legacy (no se migra a COP todavía; ver `formatMoney`
  // global en `../../lib/format`). El `ValorBlur` se encarga del blur.
  return n.toLocaleString('es-CO', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('es-CO', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

export function ProyectosView() {
  const auth = useAuth()
  const bodegaId = useBodegaActiva()
  const state = useProyectos()

  const [page, setPage] = useState(1)
  const [pageSize] = useState(DEFAULT_PAGE_SIZE)
  const [filtroEstado, setFiltroEstado] = useState<string>('')
  const [filtroBuscar, setFiltroBuscar] = useState<string>('')
  const [crearOpen, setCrearOpen] = useState(false)

  const query: ListProyectosQuery = useMemo(
    () => ({
      page,
      pageSize,
      bodegaId: bodegaId ?? undefined,
      estadoNombre: filtroEstado || undefined,
      buscar: filtroBuscar.trim() || undefined,
    }),
    [page, pageSize, bodegaId, filtroEstado, filtroBuscar],
  )

  // Carga inicial
  useEffect(() => {
    if (!bodegaId) return
    void proyectosStore.cargarPaginado(query)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bodegaId])

  // Cambio de página
  useEffect(() => {
    if (state.status !== 'listo') return
    if (state.query.page === page) return
    void proyectosStore.cargarPaginado(query)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page])

  // Filtros (debounced implícito: re-carga al cambiar estado/buscar)
  useEffect(() => {
    if (!bodegaId) return
    if (state.status === 'idle') return
    if (
      state.status === 'listo' &&
      state.query.page === page &&
      state.query.estadoNombre === query.estadoNombre &&
      state.query.buscar === query.buscar
    ) {
      return
    }
    if (page !== 1) setPage(1)
    else void proyectosStore.cargarPaginado({ ...query, page: 1 })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtroEstado, filtroBuscar])

  const cargar = useCallback(() => {
    void proyectosStore.cargarPaginado(query)
  }, [query])

  const proyectos: ProyectoListItem[] =
    state.status === 'listo' ? state.proyectos : []
  const total = state.status === 'listo' ? state.total : 0
  const totalPages = state.status === 'listo' ? state.totalPages : 0

  // KPIs (calculados del listado actual + memoria de las últimas cargas)
  const kpis = useMemo(() => {
    const activos = proyectos.filter(
      (p) =>
        p.estado.nombre === 'EnProgreso' || p.estado.nombre === 'Pausado',
    ).length
    const porIniciar = proyectos.filter(
      (p) => p.estado.nombre === 'Planificado',
    ).length
    const tecnicosAsignados = proyectos.reduce(
      (acc, p) => acc + p.tecnicosActivos,
      0,
    )
    return [
      {
        label: 'Activos',
        value: String(activos),
        accent: 'text-secondary' as const,
      },
      {
        label: 'Técnicos asignados',
        value: String(tecnicosAsignados),
        accent: 'text-primary' as const,
      },
      {
        label: 'Por iniciar',
        value: String(porIniciar),
        accent: 'text-muted-foreground' as const,
      },
    ]
  }, [proyectos])

  // Permisos con bypass. `authStore.tienePermisos` ya respeta
  // `BYPASS_ROLES = ['admin']` (admin ve todo, sin necesidad de tener
  // la key explícita).
  const puedeCrear =
    auth.status === 'autenticado' &&
    authStore.tienePermisos(['tecnicos.proyectos.crear'])

  return (
    <div className="flex-1 flex flex-col min-w-0 min-h-0">
      <PageHeader
        title="Proyectos"
        subtitle="BodegaApliSmart · TÉCNICOS · PROYECTOS"
        actions={
          puedeCrear ? (
            <button
              onClick={() => setCrearOpen(true)}
              disabled={!bodegaId}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground text-xs font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
              style={{ borderRadius: '0.25rem' }}
            >
              <Plus size={13} />
              Nuevo proyecto
            </button>
          ) : null
        }
      />

      <div className="flex-1 overflow-y-auto p-6 sm:p-8 space-y-6">
        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
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
                className={`text-3xl leading-none mt-1.5 ${k.accent}`}
                style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800 }}
              >
                {k.value}
              </div>
            </div>
          ))}
        </div>

        {/* Filtros */}
        <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
          <div className="relative flex-1 min-w-[200px]">
            <Search
              size={14}
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
            />
            <input
              type="text"
              placeholder="Buscar por nombre o código…"
              value={filtroBuscar}
              onChange={(e) => setFiltroBuscar(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 bg-background border border-border text-sm focus:outline-none focus:border-foreground/40"
              style={{ borderRadius: '0.25rem' }}
            />
          </div>
          <select
            value={filtroEstado}
            onChange={(e) => setFiltroEstado(e.target.value)}
            className="px-3 py-1.5 bg-background border border-border text-sm focus:outline-none focus:border-foreground/40"
            style={{ borderRadius: '0.25rem' }}
          >
            <option value="">Todos los estados</option>
            <option value="Planificado">Planificado</option>
            <option value="EnProgreso">En progreso</option>
            <option value="Pausado">Pausado</option>
            <option value="Finalizado">Finalizado</option>
            <option value="Cancelado">Cancelado</option>
          </select>
        </div>

        {/* Botón "Nuevo proyecto" mobile: debajo de los filtros.
            En desktop el `PageHeader.actions` ya lo muestra, así que
            lo ocultamos con `lg:hidden` para no duplicarlo. Patrón
            espejo del usado en Roles.tsx. */}
        {puedeCrear ? (
          <button
            onClick={() => setCrearOpen(true)}
            disabled={!bodegaId}
            className="lg:hidden w-full inline-flex items-center justify-center gap-1.5 min-h-11 bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
            style={{ borderRadius: '0.25rem' }}
          >
            <Plus size={15} />
            Nuevo proyecto
          </button>
        ) : null}

        {/* Estados de carga */}
        {state.status === 'cargando' && proyectos.length === 0 ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground">
            <Loader2 size={20} className="animate-spin mr-2" />
            Cargando proyectos…
          </div>
        ) : state.status === 'error' ? (
          <div className="border border-destructive/30 bg-destructive/5 p-6 text-center">
            <p className="text-sm text-destructive">{state.mensaje}</p>
            <button
              onClick={cargar}
              className="mt-3 text-xs underline text-muted-foreground hover:text-foreground"
            >
              Reintentar
            </button>
          </div>
        ) : proyectos.length === 0 ? (
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
              Sin proyectos
            </h3>
            <p
              className="mt-2 text-sm text-muted-foreground max-w-sm"
              style={{ fontFamily: "'DM Sans', sans-serif" }}
            >
              {filtroEstado || filtroBuscar
                ? 'No hay proyectos que coincidan con los filtros.'
                : 'Aún no hay proyectos creados. Crea el primero.'}
            </p>
            {puedeCrear && !filtroEstado && !filtroBuscar && (
              <button
                onClick={() => setCrearOpen(true)}
                disabled={!bodegaId}
                className="mt-5 inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground text-xs font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
                style={{ borderRadius: '0.25rem' }}
              >
                <Plus size={13} />
                Nuevo proyecto
              </button>
            )}
          </div>
        ) : (
          <>
            {/* Grid de cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {proyectos.map((p) => (
                <ProyectoCard key={p.id} proyecto={p} />
              ))}
            </div>

            <Pagination
              page={page}
              totalPages={totalPages}
              total={total}
              pageSize={pageSize}
              onChange={setPage}
            />
          </>
        )}
      </div>

      {/* Modal de crear */}
      {crearOpen && (
        <ProyectoFormModal
          open={crearOpen}
          onClose={() => setCrearOpen(false)}
          onCreated={() => {
            setCrearOpen(false)
            void proyectosStore.recargar()
          }}
        />
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
//  Card individual
// ─────────────────────────────────────────────────────────────

function ProyectoCard({ proyecto: p }: { proyecto: ProyectoListItem }) {
  // % de avance en km (lo calculamos acá también por si el back no
  // lo manda en el listado — el back sí lo manda solo en `detalle`,
  // acá lo recalculamos con los kmAvanzados/kmATrabajar del listado)
  const porcentaje =
    p.kmATrabajar > 0
      ? Math.min(100, (p.kmAvanzados / p.kmATrabajar) * 100)
      : 0
  const colorEstado = colorBadge(p.estado.nombre, p.estado.colorHex)

  return (
    <Link
      to={`/tecnicos/proyectos/${p.id}`}
      className="block bg-card border border-border hover:border-foreground/30 transition-colors"
      style={{ borderRadius: '0.25rem' }}
    >
      {/* Header: badge estado + código */}
      <div className="flex items-center justify-between px-4 pt-3 pb-2">
        <span
          className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] uppercase tracking-wider font-medium text-white"
          style={{ backgroundColor: colorEstado, borderRadius: '0.125rem' }}
        >
          {p.estado.nombre === 'EnProgreso' ? 'En progreso' : p.estado.nombre}
        </span>
        <span
          className="text-[10px] text-muted-foreground tracking-widest uppercase"
          style={{ fontFamily: "'JetBrains Mono', monospace" }}
        >
          {p.codigo}
        </span>
      </div>

      {/* Título + descripción */}
      <div className="px-4 pb-3">
        <h3
          className="text-lg uppercase leading-tight text-foreground"
          style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800 }}
        >
          {p.nombreProyecto}
        </h3>
        {p.descripcion && (
          <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
            {p.descripcion}
          </p>
        )}
      </div>

      {/* Barra de progreso */}
      <div className="px-4 pb-3">
        <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-1">
          <span className="flex items-center gap-1">
            <TrendingUp size={10} />
            Avance
          </span>
          <span style={{ fontFamily: "'JetBrains Mono', monospace" }}>
            {porcentaje.toFixed(1)}%
          </span>
        </div>
        <div className="h-1.5 bg-muted overflow-hidden" style={{ borderRadius: '0.125rem' }}>
          <div
            className="h-full bg-primary transition-all"
            style={{ width: `${porcentaje}%` }}
          />
        </div>
        <div className="mt-1 text-[10px] text-muted-foreground" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
          {p.kmAvanzados.toFixed(1)} / {p.kmATrabajar.toFixed(1)} km
        </div>
      </div>

      {/* Footer: costo + técnicos + fecha */}
      <div className="border-t border-border px-4 py-2.5 grid grid-cols-3 gap-2 text-[11px]">
        <div>
          <div className="text-muted-foreground uppercase tracking-wider text-[9px]">
            Costo
          </div>
          <div
            className="text-foreground font-medium"
            style={{ fontFamily: "'JetBrains Mono', monospace" }}
          >
            <ValorBlur
              value={p.costoTotal}
              render={() => formatMoneyUsd(p.costoTotal)}
            />
          </div>
        </div>
        <div>
          <div className="text-muted-foreground uppercase tracking-wider text-[9px] flex items-center gap-1">
            <Users size={9} /> Técnicos
          </div>
          <div
            className="text-foreground font-medium"
            style={{ fontFamily: "'JetBrains Mono', monospace" }}
          >
            {p.tecnicosActivos}
          </div>
        </div>
        <div>
          <div className="text-muted-foreground uppercase tracking-wider text-[9px] flex items-center gap-1">
            <CalendarDays size={9} /> Inicio
          </div>
          <div
            className="text-foreground font-medium"
            style={{ fontFamily: "'JetBrains Mono', monospace" }}
          >
            {formatDate(p.fechaInicio)}
          </div>
        </div>
      </div>

      {/* Roles dirigidos (mini chips) */}
      {p.rolesDirigidos.length > 0 && (
        <div className="border-t border-border px-4 py-2 flex flex-wrap gap-1">
          {p.rolesDirigidos.slice(0, 3).map((rd: { id: string; rol: { nombre: string } }) => (
            <span
              key={rd.id}
              className="px-1.5 py-0.5 text-[9px] uppercase tracking-wider bg-muted text-muted-foreground"
              style={{ borderRadius: '0.125rem' }}
            >
              {rd.rol.nombre}
            </span>
          ))}
          {p.rolesDirigidos.length > 3 && (
            <span
              className="px-1.5 py-0.5 text-[9px] uppercase tracking-wider bg-muted text-muted-foreground"
              style={{ borderRadius: '0.125rem' }}
            >
              +{p.rolesDirigidos.length - 3}
            </span>
          )}
        </div>
      )}
    </Link>
  )
}
