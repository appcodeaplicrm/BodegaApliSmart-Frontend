/**
 * Vista principal del módulo Checklist.
 *
 * - Header con ícono ListChecks + título + breadcrumb + KPI mini-strip.
 * - Tabs internos: "Plantillas" | "Programados & Historial".
 * - Maneja el modal de agendar (cross-section: el botón "Agendar" en
 *   la sección Plantillas y el botón "Nuevo checklist" en la sección
 *   Programados pueden abrirlo).
 * - Si no hay bodega activa, muestra un fallback claro.
 */
import { useState, useMemo } from 'react'
import { ListChecks, Plus, Building2 } from 'lucide-react'
import { PageHeader } from '../PageHeader'
import { useChecklist } from './useChecklist'
import { useChecklistPerms } from './useChecklistPerms'
import { Plantillas } from './Plantillas'
import { ProgramadosHistorial } from './ProgramadosHistorial'
import { PlantillaForm } from './PlantillaForm'
import { ConfirmModal } from './ConfirmModal'
import { AgendarModal } from './AgendarModal'
import { togglePlantilla as apiToggle, agendar as apiAgendar, eliminarPlantilla as apiEliminar, obtenerPlantilla } from './api'
import type { Plantilla, PlantillaListItem } from './types'

type Section = 'plantillas' | 'programados'

export function ChecklistView() {
  const data = useChecklist()
  const perms = useChecklistPerms()
  // Si el user no tiene todos los permisos del submódulo, NO puede
  // acceder a la pestaña "Plantillas" ni a los botones de gestión.
  // Solo ve su historial y sus programados. Forzamos la sección
  // inicial a "programados" en ese caso.
  const [section, setSection] = useState<Section>(perms.canManage ? 'plantillas' : 'programados')

  // Form de plantilla: si `editing` es null, está en modo creación;
  // si tiene valor, es el `initial` del form de edición.
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Plantilla | null>(null)
  const [loadingPlantilla, setLoadingPlantilla] = useState(false)

  // Modal de confirmación para eliminar plantilla.
  const [toDelete, setToDelete] = useState<PlantillaListItem | null>(null)

  // Modal de agendar. `agPlantilla` es la plantilla pre-seleccionada
  // cuando se abre desde el botón "Agendar" de una plantilla concreta.
  const [showAgenda, setShowAgenda] = useState(false)
  const [agPlantillaId, setAgPlantillaId] = useState<string | undefined>(undefined)
  const [agSaved, setAgSaved] = useState(false)

  const kpis = useMemo(() => {
    const activas = data.plantillas.filter((p) => p.activa).length
    const pendientes = data.asignaciones.filter((a) => a.estado === 'pendiente').length
    const completados = data.asignaciones.filter((a) => a.estado === 'completado').length
    const vencidos = data.asignaciones.filter((a) => a.estado === 'vencido').length
    return { activas, pendientes, completados, vencidos }
  }, [data.plantillas, data.asignaciones])

  const handleNuevoChecklist = () => {
    if (!perms.canCreate) return
    setSection('plantillas')
    setAgPlantillaId(undefined)
    setShowAgenda(true)
  }

  const handleAgendar = (plantilla?: PlantillaListItem) => {
    if (!perms.canCreate) return
    setAgPlantillaId(plantilla?.id)
    setShowAgenda(true)
  }

  const handleEditarPlantilla = async (p: PlantillaListItem) => {
    if (!perms.canCreate) return
    setLoadingPlantilla(true)
    setShowForm(true)
    try {
      // Cargamos el detalle completo (incluye empresa/objeto/items).
      const full = await obtenerPlantilla(p.id, data.bodegaId)
      setEditing(full)
    } catch (e) {
      alert((e as Error).message ?? 'No se pudo cargar la plantilla.')
      setShowForm(false)
    } finally {
      setLoadingPlantilla(false)
    }
  }

  const handleCloseForm = () => {
    setShowForm(false)
    setEditing(null)
  }

  const handleEliminarPlantilla = async () => {
    if (!toDelete) return
    await apiEliminar(toDelete.id, data.bodegaId)
    await data.reload()
  }

  if (!data.bodegaId) {
    return <SinBodegaActiva />
  }

  return (
    <div className="flex-1 flex flex-col min-w-0 min-h-0">
      <PageHeader
        title="Checklist"
        subtitle={
          perms.canManage
            ? 'STOCKPRO · TÉCNICOS'
            : 'STOCKPRO · TÉCNICOS · SOLO CONSULTA'
        }
        actions={
          perms.canCreate ? (
            <button
              onClick={() => {
                setEditing(null)
                setShowForm(true)
              }}
              className="hidden lg:inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground text-xs font-medium hover:opacity-90 transition-opacity"
              style={{ borderRadius: '0.25rem' }}
            >
              <Plus size={13} />
              Nueva plantilla
            </button>
          ) : null
        }
      />

      {/* KPI mini-strip (oculto en <xl, igual que el resto del módulo) */}
      <div className="px-4 sm:px-6 lg:px-8 pt-4 sm:pt-6 hidden xl:grid grid-cols-4 border-b border-border">
        <KpiCell label="PLANTILLAS ACTIVAS" value={kpis.activas} accent="text-foreground" />
        <KpiCell label="PENDIENTES" value={kpis.pendientes} accent="text-yellow-400" />
        <KpiCell label="COMPLETADOS" value={kpis.completados} accent="text-secondary" />
        <KpiCell label="VENCIDOS" value={kpis.vencidos} accent="text-primary" />
      </div>

      {/* Section tabs: solo mostramos "Plantillas" si el user tiene
          todos los permisos del submódulo. Caso contrario, la vista
          arranca directo en "Programados & Historial" y se oculta
          la otra pestaña. */}
      {perms.canManage && (
        <div className="px-4 sm:px-6 lg:px-8 pt-3 sm:pt-4">
          <div className="inline-flex items-center gap-1 p-1 bg-muted rounded-lg border border-border w-fit">
            <TabButton active={section === 'plantillas'} onClick={() => setSection('plantillas')}>
              Plantillas
            </TabButton>
            <TabButton
              active={section === 'programados'}
              onClick={() => setSection('programados')}
            >
              Programados & Historial
            </TabButton>
          </div>
        </div>
      )}

      {/* Mobile: botón "+ Nueva plantilla" full-width debajo de los tabs
          (solo visible cuando estamos en la pestaña Plantillas). */}
      {perms.canCreate && section === 'plantillas' && perms.canManage && (
        <div className="px-4 sm:px-6 lg:px-8 pt-3 sm:hidden">
          <button
            type="button"
            onClick={() => {
              setEditing(null)
              setShowForm(true)
            }}
            className="w-full min-h-[44px] inline-flex items-center justify-center gap-2 bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 active:opacity-80 transition-opacity"
            style={{ borderRadius: '0.25rem' }}
          >
            <Plus size={15} />
            Nueva plantilla
          </button>
        </div>
      )}

      {/* Contenido */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
        {data.loading ? (
          <LoadingState />
        ) : data.error ? (
          <ErrorState message={data.error} onRetry={data.reload} />
        ) : showForm && perms.canCreate ? (
          <PlantillaForm
            roles={data.roles}
            bodegaId={data.bodegaId}
            initial={editing ?? undefined}
            onCancel={handleCloseForm}
            onSaved={async () => {
              handleCloseForm()
              await data.reload()
            }}
          />
        ) : section === 'plantillas' && perms.canManage ? (
          <Plantillas
            plantillas={data.plantillas}
            canEdit={perms.canCreate}
            onToggle={async (id) => {
              await apiToggle(id, data.bodegaId)
              await data.reload()
            }}
            onAgendar={(p) => handleAgendar(p)}
            onEditar={handleEditarPlantilla}
            onEliminar={(p) => setToDelete(p)}
            onReload={data.reload}
          />
        ) : (
          <ProgramadosHistorial
            asignaciones={data.asignaciones}
            historial={data.historial}
            onNuevoChecklist={handleNuevoChecklist}
            canCreate={perms.canCreate}
            bodegaId={data.bodegaId!}
            onChanged={data.reload}
          />
        )}
      </div>

      {showAgenda && perms.canCreate && (
        <AgendarModal
          plantillas={data.plantillas}
          roles={data.roles}
          bodegaId={data.bodegaId}
          plantillaIdInicial={agPlantillaId}
          agSaved={agSaved}
          onClose={() => {
            setShowAgenda(false)
            setAgSaved(false)
          }}
          onAgendar={async (input) => {
            await apiAgendar({ ...input, bodegaId: data.bodegaId! })
            setAgSaved(true)
            await data.reload()
          }}
        />
      )}

      {toDelete && (
        <ConfirmModal
          open
          onClose={() => setToDelete(null)}
          title="Eliminar plantilla"
          description={
            <>
              ¿Eliminar la plantilla <strong>"{toDelete.nombre}"</strong>?
              <br />
              Esta acción no se puede deshacer. Si la plantilla tiene
              asignaciones, no se podrá eliminar.
            </>
          }
          confirmLabel="Eliminar plantilla"
          tone="danger"
          onConfirm={handleEliminarPlantilla}
        />
      )}

      {loadingPlantilla && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center pointer-events-none">
          <div className="bg-card border border-border px-4 py-3 text-sm text-foreground inline-flex items-center gap-2"
            style={{ borderRadius: '0.25rem' }}>
            <Plus size={14} className="animate-pulse" />
            Cargando plantilla…
          </div>
        </div>
      )}
    </div>
  )
}

function SinBodegaActiva() {
  return (
    <div className="flex-1 flex flex-col min-w-0 min-h-0">
      <PageHeader title="Checklist" subtitle="STOCKPRO · TÉCNICOS" />
      <div className="flex-1 flex flex-col items-center justify-center p-12 text-center">
        <Building2 size={32} className="text-muted-foreground mb-3" />
        <h3
          className="text-base uppercase text-foreground"
          style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800 }}
        >
          Sin bodega activa
        </h3>
        <p className="text-sm text-muted-foreground max-w-sm mt-2">
          Selecciona una bodega en el selector del sidebar para ver los checklists
          de esa bodega. Los checklists no se mezclan entre bodegas.
        </p>
      </div>
    </div>
  )
}

// ─────────── helpers locales ───────────

function KpiCell({ label, value, accent }: { label: string; value: number; accent: string }) {
  return (
    <div className="px-4 py-3 border-r border-border last:border-r-0">
      <div
        className="text-[10px] text-muted-foreground tracking-widest"
        style={{ fontFamily: "'JetBrains Mono', monospace" }}
      >
        {label}
      </div>
      <div
        className={`text-2xl leading-none mt-1 ${accent}`}
        style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800 }}
      >
        {value}
      </div>
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
      className={[
        'px-3 py-1.5 text-xs font-medium rounded-md transition-colors',
        active
          ? 'bg-card text-foreground border border-border shadow-sm'
          : 'text-muted-foreground hover:text-foreground',
      ].join(' ')}
      style={{ fontFamily: "'DM Sans', sans-serif" }}
    >
      {children}
    </button>
  )
}

function LoadingState() {
  return (
    <div className="flex items-center justify-center py-20 text-muted-foreground text-sm">
      Cargando checklist…
    </div>
  )
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-3">
      <ListChecks size={32} className="text-muted-foreground" />
      <p className="text-sm text-muted-foreground">No se pudo cargar el módulo: {message}</p>
      <button
        onClick={onRetry}
        className="px-3 py-1.5 text-xs border border-border hover:border-primary/40"
        style={{ borderRadius: '0.25rem' }}
      >
        Reintentar
      </button>
    </div>
  )
}
