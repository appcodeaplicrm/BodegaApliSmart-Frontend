import { useState, useRef, useEffect } from 'react'
import { ChevronDown, Check, Warehouse, MapPin, Plus } from 'lucide-react'
import { useBodegas } from '../store/bodegas'
import { useBodegaActiva, bodegaActivaStore } from '../store/bodegaActiva'
import { useAuth } from '../store/auth'
import { AgregarBodegaModal } from './AgregarBodegaModal'

/**
 * Dropdown para elegir la bodega activa del dashboard.
 * - Lista las bodegas reales del back (bodegasStore)
 * - Persiste en localStorage (bodegaActivaStore)
 * - Al cambiar, emite un evento global que el DashboardView escucha
 * - El superadmin no ve el botón "+" (no puede crear bodegas)
 */
export function SelectorBodega() {
  const bodegasState = useBodegas()
  const activaId = useBodegaActiva()
  const auth = useAuth()
  const [open, setOpen] = useState(false)
  const [showCrearBodega, setShowCrearBodega] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const esSuperadmin =
    auth.status === 'autenticado' && auth.sesion.usuario.rol === 'superadmin'

  // Click outside para cerrar
  useEffect(() => {
    if (!open) return
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [open])

  // Auto-seleccionar la única bodega si no hay elección o la elección no existe
  // (debe estar antes de cualquier return condicional para no violar Rules of Hooks)
  const bodegas = bodegasState.status === 'listo' ? bodegasState.bodegas : []
  useEffect(() => {
    if (bodegasState.status !== 'listo') return
    if (bodegas.length === 0) return
    const primeraId = bodegas[0].id
    if (bodegas.length === 1 && activaId !== primeraId) {
      bodegaActivaStore.set(primeraId)
      return
    }
    if (activaId && !bodegas.some((b) => b.id === activaId)) {
      bodegaActivaStore.set(primeraId)
      return
    }
    if (!activaId) {
      bodegaActivaStore.set(primeraId)
    }
    // bodegas como dep generaría un loop (array nuevo en cada render);
    // usamos `bodegasState.bodegas` directo para que la dep sea estable
    // mientras el array referencial no cambie.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bodegasState.status, bodegasState.status === 'listo' ? bodegasState.bodegas : null, activaId])

  // Mientras carga la lista, mostramos "Cargando..."
  if (bodegasState.status === 'idle' || bodegasState.status === 'cargando') {
    return (
      <div
        className="inline-flex items-center gap-2 px-3 py-1.5 border border-border bg-muted"
        style={{ borderRadius: '0.25rem' }}
      >
        <Warehouse size={13} className="text-muted-foreground" />
        <span
          className="text-xs text-muted-foreground"
          style={{ fontFamily: "'JetBrains Mono', monospace" }}
        >
          Cargando bodegas…
        </span>
      </div>
    )
  }

  if (bodegasState.status === 'error') {
    return (
      <div
        className="inline-flex items-center gap-2 px-3 py-1.5 border border-primary/30 bg-primary/5"
        style={{ borderRadius: '0.25rem' }}
      >
        <Warehouse size={13} className="text-primary" />
        <span
          className="text-xs text-primary"
          style={{ fontFamily: "'JetBrains Mono', monospace" }}
        >
          Error al cargar
        </span>
      </div>
    )
  }

  if (bodegas.length === 0) {
    return (
      <div
        className="inline-flex items-center gap-2 px-3 py-1.5 border border-border bg-muted"
        style={{ borderRadius: '0.25rem' }}
      >
        <Warehouse size={13} className="text-muted-foreground" />
        <span
          className="text-xs text-muted-foreground"
          style={{ fontFamily: "'JetBrains Mono', monospace" }}
        >
          Sin bodegas asignadas
        </span>
      </div>
    )
  }

  const activa = bodegas.find((b) => b.id === activaId) ?? bodegas[0]

  return (
    <div className="inline-flex items-center gap-1.5">
      <div ref={ref} className="relative">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="inline-flex items-center gap-2 px-3 py-1.5 border border-border bg-muted hover:border-primary/40 transition-colors"
          style={{ borderRadius: '0.25rem' }}
        >
          <Warehouse size={13} className="text-primary shrink-0" />
          <div className="text-left min-w-0">
            <div
              className="text-[9px] text-muted-foreground uppercase tracking-widest leading-none"
              style={{ fontFamily: "'JetBrains Mono', monospace" }}
            >
              Viendo
            </div>
            <div
              className="text-sm font-semibold text-foreground truncate max-w-[200px]"
              style={{ fontFamily: "'Barlow Condensed', sans-serif" }}
            >
              {activa.nombre}
            </div>
          </div>
          <ChevronDown
            size={14}
            className={`text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`}
          />
        </button>

      {open && (
        <div
          className="absolute right-0 top-full mt-1 z-50 w-72 bg-card border border-border shadow-lg"
          style={{ borderRadius: '0.25rem' }}
        >
          <div
            className="px-3 py-2 border-b border-border text-[10px] text-muted-foreground uppercase tracking-widest"
            style={{ fontFamily: "'JetBrains Mono', monospace" }}
          >
            MIS BODEGAS · {bodegas.length}
          </div>
          <ul className="max-h-72 overflow-y-auto py-1">
            {bodegas.map((b) => {
              const isActive = b.id === activaId
              return (
                <li key={b.id}>
                  <button
                    type="button"
                    onClick={() => {
                      bodegaActivaStore.set(b.id)
                      setOpen(false)
                    }}
                    className={`w-full flex items-start gap-2 px-3 py-2 text-left transition-colors ${
                      isActive
                        ? 'bg-primary/10 text-foreground'
                        : 'text-foreground hover:bg-muted'
                    }`}
                  >
                    <Warehouse
                      size={13}
                      className={isActive ? 'text-primary mt-0.5 shrink-0' : 'text-muted-foreground mt-0.5 shrink-0'}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold truncate">
                        {b.nombre}
                      </div>
                      {b.direccion && (
                        <div
                          className="text-[10px] text-muted-foreground flex items-center gap-1 mt-0.5"
                          style={{ fontFamily: "'JetBrains Mono', monospace" }}
                        >
                          <MapPin size={8} />
                          <span className="truncate">{b.direccion}</span>
                        </div>
                      )}
                    </div>
                    {isActive && <Check size={14} className="text-primary shrink-0 mt-0.5" />}
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      )}
      </div>

      {/* Botón "+" para crear una bodega nueva (solo admin, NO superadmin).
          Mismo alto que el selector (py-1.5 + 2 líneas de texto ≈ 48px). */}
      {!esSuperadmin && (
        <button
          type="button"
          onClick={() => setShowCrearBodega(true)}
          title="Crear nueva bodega"
          aria-label="Crear nueva bodega"
          className="inline-flex items-center justify-center self-stretch w-10 border border-border bg-muted text-muted-foreground hover:border-primary/40 hover:text-primary transition-colors"
          style={{ borderRadius: '0.25rem' }}
        >
          <Plus size={15} />
        </button>
      )}

      {showCrearBodega && (
        <AgregarBodegaModal
          onClose={() => setShowCrearBodega(false)}
          onCreated={({ id }) => {
            // Al crear la bodega, la marcamos como activa automáticamente
            // para que el dashboard entre directo a esa bodega.
            bodegaActivaStore.set(id)
          }}
        />
      )}
    </div>
  )
}
