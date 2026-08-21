/**
 * Modal para seleccionar el estado inicial del proyecto.
 *
 * Self-contained: carga los estados del catálogo al abrirse. Si la
 * promesa falla (por permisos o DB), muestra un error con botón
 * "Reintentar" en vez de un spinner infinito.
 *
 * Lista todos los estados del catálogo de `ProyectoEstado`. El user
 * elige uno (single-select) y se cierra. Es consistente con los
 * demás modales de selección del sistema (p.ej. `AccionOrdenModal`).
 */
import { useEffect, useState } from 'react'
import { AlertCircle, Check, Loader2, RefreshCw } from 'lucide-react'
import { Modal } from '../Modal'
import { listarEstados } from './api'
import type { ProyectoEstado } from './types'

type Props = {
  open: boolean
  selectedId: string
  onSelect: (estado: { id: string; nombre: string; colorHex: string | null }) => void
  onClose: () => void
}

const DEFAULT_COLORS: Record<string, string> = {
  Planificado: '#6b7280',
  EnProgreso: '#22c55e',
  Pausado: '#eab308',
  Finalizado: '#3b82f6',
  Cancelado: '#ef4444',
}

function colorFor(e: Pick<ProyectoEstado, 'colorHex' | 'nombre'>): string {
  return e.colorHex ?? DEFAULT_COLORS[e.nombre] ?? '#6b7280'
}

export function SeleccionarEstadoModal({
  open,
  selectedId,
  onSelect,
  onClose,
}: Props) {
  const [estados, setEstados] = useState<ProyectoEstado[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busqueda, setBusqueda] = useState('')

  // Cargar estados cada vez que se abre el modal. Esto es
  // self-contained: no depende de que el padre ya los haya
  // cargado. Si la promesa falla, el user ve el error y puede
  // reintentar sin tener que cerrar y abrir el modal padre.
  useEffect(() => {
    if (!open) return
    let cancelled = false
    setLoading(true)
    setError(null)
    listarEstados()
      .then((data) => {
        if (!cancelled) {
          setEstados(data)
          setLoading(false)
        }
      })
      .catch((err) => {
        if (!cancelled) {
          const msg =
            err instanceof Error
              ? err.message
              : 'No se pudieron cargar los estados.'
          setError(msg)
          setLoading(false)
        }
      })
    return () => {
      cancelled = true
    }
  }, [open])

  // Resetear la búsqueda cuando se cierra
  useEffect(() => {
    if (!open) setBusqueda('')
  }, [open])

  const filtrados = estados.filter((e) =>
    e.nombre.toLowerCase().includes(busqueda.toLowerCase()),
  )

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Elegir estado"
      description="El proyecto inicia con este estado. Después lo podés cambiar."
      size="sm"
    >
      <div className="p-3 sm:p-4">
        {loading ? (
          <div className="py-10 flex flex-col items-center justify-center text-muted-foreground">
            <Loader2 size={20} className="animate-spin mb-2" />
            <span className="text-sm">Cargando estados…</span>
          </div>
        ) : error ? (
          <div className="py-6 flex flex-col items-center text-center">
            <AlertCircle size={24} className="text-destructive mb-2" />
            <p className="text-sm text-destructive mb-3">{error}</p>
            <button
              type="button"
              onClick={() => {
                setLoading(true)
                setError(null)
                listarEstados()
                  .then(setEstados)
                  .catch((err) =>
                    setError(
                      err instanceof Error ? err.message : 'Error desconocido',
                    ),
                  )
                  .finally(() => setLoading(false))
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-foreground text-background text-xs font-medium hover:opacity-90"
              style={{ borderRadius: '0.25rem' }}
            >
              <RefreshCw size={12} />
              Reintentar
            </button>
          </div>
        ) : estados.length === 0 ? (
          <div className="py-8 text-center">
            <p className="text-sm text-muted-foreground mb-3">
              No hay estados en el catálogo. Esto no debería pasar — el
              seed debería haber creado los 5 estados por defecto.
            </p>
            <p className="text-xs text-muted-foreground">
              Contactá al administrador del sistema.
            </p>
          </div>
        ) : (
          <>
            {/* Buscador */}
            <div className="relative mb-2">
              <input
                type="text"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Buscar estado…"
                className="w-full pl-3 pr-3 py-2 bg-background border border-border text-sm focus:outline-none focus:border-foreground/40"
                style={{ borderRadius: '0.25rem' }}
              />
            </div>

            {/* Lista */}
            <div className="max-h-72 overflow-y-auto space-y-1">
              {filtrados.length === 0 ? (
                <div className="p-4 text-center text-xs text-muted-foreground">
                  No hay estados que coincidan con "{busqueda}".
                </div>
              ) : (
                filtrados.map((e) => {
                  const activo = e.id === selectedId
                  return (
                    <button
                      key={e.id}
                      type="button"
                      onClick={() => {
                        onSelect({
                          id: e.id,
                          nombre: e.nombre,
                          colorHex: e.colorHex,
                        })
                        onClose()
                      }}
                      className={[
                        'w-full flex items-center gap-2 px-3 py-2.5 text-left text-sm transition-colors',
                        activo
                          ? 'bg-primary/10 text-primary'
                          : 'hover:bg-muted text-foreground',
                      ].join(' ')}
                      style={{ borderRadius: '0.25rem' }}
                    >
                      <span
                        className="inline-block w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: colorFor(e) }}
                      />
                      <span className="flex-1 font-medium">{e.nombre}</span>
                      {activo && <Check size={14} className="text-primary" />}
                    </button>
                  )
                })
              )}
            </div>

            <div
              className="mt-3 pt-3 border-t border-border text-[10px] text-muted-foreground text-center uppercase tracking-widest"
              style={{ fontFamily: "'JetBrains Mono', monospace" }}
            >
              {filtrados.length}{' '}
              {filtrados.length === 1 ? 'estado' : 'estados'} disponibles
            </div>
          </>
        )}
      </div>
    </Modal>
  )
}
