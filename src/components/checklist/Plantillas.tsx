/**
 * Sección 1: Plantillas.
 *
 * - Lista de plantillas como acordeón (un solo expandido a la vez,
 *   `grid-template-rows` para la animación, no `max-height`).
 * - Card colapsada: info + badge + toggle + "Ver ítems" + "Agendar".
 * - Card expandida: tabla de ítems + footer "Editar / Eliminar".
 *
 * El "Editar" delega al padre (`onEditar`), que abre el `PlantillaForm`
 * en modo edición con los datos cargados. El "Eliminar" también delega:
 * el padre abre un `ConfirmModal` para evitar el `confirm()` nativo.
 */
import { useState } from 'react'
import {
  CheckSquare,
  UserCog,
  CalendarDays,
  Send,
  Eye,
  ToggleRight,
  ToggleLeft,
  Pencil,
  Trash2,
  ChevronDown,
} from 'lucide-react'
import type { PlantillaListItem } from './types'
import { obtenerPlantilla } from './api'
import { useBodegaActiva } from '../../store/bodegaActiva'

type PlantillasProps = {
  plantillas: PlantillaListItem[]
  /** Si false, oculta toggle/botón "Editar"/"Eliminar"/"Agendar" por plantilla. */
  canEdit: boolean
  onToggle: (id: string) => Promise<void> | void
  onAgendar: (p: PlantillaListItem) => void
  onEditar: (p: PlantillaListItem) => void
  onEliminar: (p: PlantillaListItem) => void
  onReload: () => Promise<void>
}

export function Plantillas({
  plantillas,
  canEdit,
  onToggle,
  onAgendar,
  onEditar,
  onEliminar,
}: PlantillasProps) {
  const bodegaId = useBodegaActiva()
  const [expandId, setExpandId] = useState<string | null>(null)
  const [itemsDe, setItemsDe] = useState<Record<string, { id: string; texto: string; requerido: boolean }[]>>({})
  const [loadingItems, setLoadingItems] = useState<string | null>(null)

  const handleExpand = async (id: string) => {
    if (expandId === id) {
      setExpandId(null)
      return
    }
    setExpandId(id)
    if (!itemsDe[id]) {
      setLoadingItems(id)
      try {
        const full = await obtenerPlantilla(id, bodegaId)
        setItemsDe((prev) => ({ ...prev, [id]: full.items }))
      } finally {
        setLoadingItems(null)
      }
    }
  }

  if (plantillas.length === 0) {
    return (
      <div className="bg-card border border-border py-20 px-6 flex flex-col items-center justify-center text-center"
        style={{ borderRadius: '0.25rem' }}>
        <p className="text-sm text-muted-foreground">Aún no hay plantillas. Crea la primera con el botón "Nueva plantilla".</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {plantillas.map((p) => {
        const isExp = expandId === p.id
        const items = itemsDe[p.id] ?? []
        return (
          <div
            key={p.id}
            className={[
              'rounded-lg border bg-card transition-colors',
              isExp ? 'border-primary/30' : 'border-border',
            ].join(' ')}
            style={{ borderRadius: '0.25rem' }}
          >
            {/* Cabecera: en mobile va en bloque (apilado),
                en desktop en row horizontal. */}
            <div className="px-4 py-3 space-y-2 sm:space-y-0 sm:flex sm:items-center sm:gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span
                    className="text-sm font-semibold text-foreground truncate"
                    style={{ fontFamily: "'Barlow Condensed', sans-serif" }}
                  >
                    {p.nombre}
                  </span>
                  <span
                    className="text-[10px] text-muted-foreground"
                    style={{ fontFamily: "'JetBrains Mono', monospace" }}
                  >
                    {p.id.slice(0, 8).toUpperCase()}
                  </span>
                </div>
                <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
                  <span className="inline-flex items-center gap-1">
                    <UserCog size={11} /> {p.rol.nombre}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <CheckSquare size={11} /> {p.itemsCount} ítems
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <CalendarDays size={11} /> {new Date(p.createdAt).toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit', year: '2-digit' })}
                  </span>
                  <span className="sm:hidden">
                    <Badge activa={p.activa} />
                  </span>
                </div>
              </div>

              <div className="hidden sm:flex items-center gap-3 shrink-0">
                <Badge activa={p.activa} />
                {canEdit && (
                  <button
                    onClick={() => onToggle(p.id)}
                    className="text-muted-foreground hover:text-foreground transition-colors"
                    title={p.activa ? 'Desactivar' : 'Activar'}
                    aria-label="toggle"
                  >
                    {p.activa ? (
                      <ToggleRight size={22} className="text-secondary" />
                    ) : (
                      <ToggleLeft size={22} />
                    )}
                  </button>
                )}
                <button
                  onClick={() => handleExpand(p.id)}
                  className="inline-flex items-center gap-1 px-2.5 py-1 text-xs border border-border hover:border-primary/40"
                  style={{ borderRadius: '0.25rem' }}
                >
                  <Eye size={11} /> Ver ítems
                  <ChevronDown
                    size={11}
                    className={`transition-transform ${isExp ? 'rotate-180' : ''}`}
                  />
                </button>
                {canEdit && (
                  <button
                    onClick={() => onAgendar(p)}
                    className="inline-flex items-center gap-1 px-2.5 py-1 text-xs bg-primary/15 text-primary border border-primary/20 hover:bg-primary/25"
                    style={{ borderRadius: '0.25rem' }}
                  >
                    <Send size={11} /> Agendar
                  </button>
                )}
              </div>
            </div>

            {/* Mobile: botones de acción en una segunda fila (full-width) */}
            <div className="sm:hidden px-4 pb-3 flex items-center gap-2">
              {canEdit && (
                <button
                  onClick={() => onToggle(p.id)}
                  className="text-muted-foreground hover:text-foreground transition-colors px-1"
                  title={p.activa ? 'Desactivar' : 'Activar'}
                  aria-label="toggle"
                >
                  {p.activa ? (
                    <ToggleRight size={22} className="text-secondary" />
                  ) : (
                    <ToggleLeft size={22} />
                  )}
                </button>
              )}
              <button
                onClick={() => handleExpand(p.id)}
                className="flex-1 min-h-[40px] inline-flex items-center justify-center gap-1.5 px-2 py-1.5 text-xs border border-border hover:border-primary/40"
                style={{ borderRadius: '0.25rem' }}
              >
                <Eye size={12} /> Ver ítems
                <ChevronDown
                  size={12}
                  className={`transition-transform ${isExp ? 'rotate-180' : ''}`}
                />
              </button>
              {canEdit && (
                <button
                  onClick={() => onAgendar(p)}
                  className="flex-1 min-h-[40px] inline-flex items-center justify-center gap-1.5 px-2 py-1.5 text-xs bg-primary/15 text-primary border border-primary/20 hover:bg-primary/25"
                  style={{ borderRadius: '0.25rem' }}
                >
                  <Send size={12} /> Agendar
                </button>
              )}
            </div>

            {/* Acordeón */}
            <div
              style={{
                display: 'grid',
                gridTemplateRows: isExp ? '1fr' : '0fr',
                transition: 'grid-template-rows 260ms cubic-bezier(0.4,0,0.2,1)',
              }}
            >
              <div className="overflow-hidden">
                <div className="bg-muted/20 border-t border-border/60 px-4 py-3 space-y-3">
                  <div className="grid grid-cols-[24px_1fr_80px] text-[10px] tracking-widest text-muted-foreground"
                    style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                    <div />
                    <div>ÍTEM A VERIFICAR</div>
                    <div className="text-center">REQUERIDO</div>
                  </div>

                  {loadingItems === p.id ? (
                    <div className="text-xs text-muted-foreground py-3">Cargando ítems…</div>
                  ) : items.length === 0 ? (
                    <div className="text-xs text-muted-foreground py-3">Esta plantilla no tiene ítems.</div>
                  ) : (
                    items.map((it, idx) => (
                      <div key={it.id} className="grid grid-cols-[24px_1fr_80px] items-center gap-2">
                        <div className="flex items-center gap-2">
                          <div className="w-px h-4 bg-border" />
                          <span className="text-[10px] text-muted-foreground"
                            style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                            {String(idx + 1).padStart(2, '0')}
                          </span>
                        </div>
                        <div className="text-sm text-foreground">{it.texto}</div>
                        <div className="text-center">
                          <span
                            className={[
                              'inline-block px-2 py-0.5 text-[10px] border',
                              it.requerido
                                ? 'bg-primary/10 text-primary border-primary/20'
                                : 'bg-muted text-muted-foreground border-border',
                            ].join(' ')}
                            style={{ borderRadius: '0.25rem', fontFamily: "'JetBrains Mono', monospace" }}
                          >
                            {it.requerido ? 'SÍ' : 'NO'}
                          </span>
                        </div>
                      </div>
                    ))
                  )}

                  {canEdit && (
                    <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/40 flex-wrap">
                      <button
                        onClick={() => onEditar(p)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-xs border border-border hover:border-primary/40"
                        style={{ borderRadius: '0.25rem' }}
                      >
                        <Pencil size={11} /> Editar plantilla
                      </button>
                      <button
                        onClick={() => onEliminar(p)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-xs text-primary border border-primary/30 hover:bg-primary/10"
                        style={{ borderRadius: '0.25rem' }}
                      >
                        <Trash2 size={11} /> Eliminar
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function Badge({ activa }: { activa: boolean }) {
  return activa ? (
    <span
      className="px-2 py-0.5 text-[10px] border bg-secondary/15 text-secondary border-secondary/20"
      style={{ borderRadius: '0.25rem', fontFamily: "'JetBrains Mono', monospace" }}
    >
      ACTIVA
    </span>
  ) : (
    <span
      className="px-2 py-0.5 text-[10px] border bg-muted text-muted-foreground border-border"
      style={{ borderRadius: '0.25rem', fontFamily: "'JetBrains Mono', monospace" }}
    >
      INACTIVA
    </span>
  )
}
