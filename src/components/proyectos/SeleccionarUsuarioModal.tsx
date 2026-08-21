/**
 * Modal genérico para seleccionar uno o varios usuarios.
 *
 * Reusado por el form de crear proyecto para:
 *  - Elegir el ENCARGADO (modo single).
 *  - Elegir los TÉCNICOS (modo multi, con checkboxes).
 *
 * Filtra por los roles dirigidos del proyecto. Los usuarios que ya
 * están asignados a otro proyecto activo se muestran deshabilitados
 * con su proyecto origen (para evitar pisar asignaciones).
 *
 * Decisión UX:
 *  - Modo single → click en un usuario lo selecciona y cierra el modal.
 *  - Modo multi → checkboxes a la izquierda, footer con "Listo" para
 *    confirmar. El user puede destildar y retildar antes de cerrar.
 *  - Buscador arriba para filtrar por nombre/email.
 *  - Muestra los roles del user como mini-chips.
 */
import { useMemo, useState } from 'react'
import { Check, Loader2, Search, AlertTriangle, X } from 'lucide-react'
import { Modal } from '../Modal'
import type { ProyectoUsuarioAsignable } from './types'

type Props = {
  open: boolean
  mode: 'single' | 'multi'
  usuarios: ProyectoUsuarioAsignable[]
  loading?: boolean
  /** Single: el user actualmente seleccionado. Multi: el set actual. */
  selectedIds: string[]
  /** Opcional: ids a deshabilitar (excluir) además de los ocupados. */
  excludedIds?: string[]
  title: string
  description?: string
  onConfirm: (ids: string[]) => void
  onClose: () => void
}

export function SeleccionarUsuarioModal({
  open,
  mode,
  usuarios,
  loading = false,
  selectedIds,
  excludedIds = [],
  title,
  description,
  onConfirm,
  onClose,
}: Props) {
  const [busqueda, setBusqueda] = useState('')
  // Estado local para multi (para que el user pueda ver la selección
  // actual antes de confirmar). En single no hace falta.
  const [draftMulti, setDraftMulti] = useState<string[]>(selectedIds)

  // Reset draft cuando se abre
  if (open && draftMulti.length === 0 && selectedIds.length > 0) {
    setDraftMulti(selectedIds)
  }

  const filtrados = useMemo(() => {
    const q = busqueda.toLowerCase().trim()
    return usuarios.filter((u) => {
      if (q && !`${u.nombre} ${u.email}`.toLowerCase().includes(q)) return false
      return true
    })
  }, [usuarios, busqueda])

  const disponibles = filtrados.filter((u) => !u.ocupadoEnProyecto)
  const ocupados = filtrados.filter((u) => !!u.ocupadoEnProyecto)
  const excluidos = excludedIds

  function isChecked(id: string): boolean {
    if (mode === 'single') return selectedIds.includes(id)
    return draftMulti.includes(id)
  }

  function toggle(id: string) {
    if (mode === 'single') {
      onConfirm([id])
      onClose()
      return
    }
    setDraftMulti((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    )
  }

  function handleConfirm() {
    if (mode === 'multi') {
      onConfirm(draftMulti)
      onClose()
    }
  }

  const seleccionadosCount = mode === 'multi' ? draftMulti.length : selectedIds.length

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      size="md"
      footer={
        mode === 'multi' ? (
          <div className="flex items-center justify-between gap-2">
            <div className="text-xs text-muted-foreground">
              <strong className="text-foreground">{seleccionadosCount}</strong>{' '}
              {seleccionadosCount === 1 ? 'seleccionado' : 'seleccionados'}
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-3 py-1.5 text-sm border border-border hover:border-foreground/40 transition-colors"
                style={{ borderRadius: '0.25rem' }}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity"
                style={{ borderRadius: '0.25rem' }}
              >
                <Check size={14} />
                Confirmar selección
              </button>
            </div>
          </div>
        ) : undefined
      }
    >
      {loading ? (
        <div className="p-6 flex items-center justify-center text-muted-foreground">
          <Loader2 size={18} className="animate-spin mr-2" />
          Buscando usuarios…
        </div>
      ) : usuarios.length === 0 ? (
        <div className="p-6 text-center">
          <p className="text-sm text-muted-foreground">
            No hay usuarios activos con esos roles en esta bodega. Asigná los
            roles en el módulo Usuarios primero.
          </p>
        </div>
      ) : (
        <div className="p-3 sm:p-4">
          {/* Buscador */}
          <div className="relative mb-3">
            <Search
              size={14}
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
            />
            <input
              type="text"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar por nombre o email…"
              className="w-full pl-8 pr-3 py-2 bg-background border border-border text-sm focus:outline-none focus:border-foreground/40"
              style={{ borderRadius: '0.25rem' }}
            />
          </div>

          {/* Lista */}
          {filtrados.length === 0 ? (
            <div className="p-4 text-center text-xs text-muted-foreground">
              No hay usuarios que coincidan con "{busqueda}".
            </div>
          ) : (
            <div className="max-h-80 overflow-y-auto space-y-1">
              {/* Disponibles primero */}
              {disponibles.length > 0 && (
                <>
                  <div className="text-[10px] text-muted-foreground uppercase tracking-widest px-2 py-1" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                    Disponibles ({disponibles.length})
                  </div>
                  {disponibles.map((u) => {
                    const excluido = excluidos.includes(u.id)
                    return (
                      <UserRow
                        key={u.id}
                        user={u}
                        mode={mode}
                        checked={isChecked(u.id)}
                        disabled={excluido}
                        onToggle={() => toggle(u.id)}
                      />
                    )
                  })}
                </>
              )}

              {/* Ocupados en otros proyectos, al final */}
              {ocupados.length > 0 && (
                <>
                  <div className="text-[10px] text-muted-foreground uppercase tracking-widest px-2 py-1 mt-2 flex items-center gap-1" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                    <AlertTriangle size={10} />
                    Ya asignados a otro proyecto ({ocupados.length})
                  </div>
                  {ocupados.map((u) => (
                    <UserRow
                      key={u.id}
                      user={u}
                      mode={mode}
                      checked={false}
                      disabled
                      onToggle={() => undefined}
                    />
                  ))}
                </>
              )}
            </div>
          )}
        </div>
      )}
    </Modal>
  )
}

// ─────────────────────────────────────────────────────────────
//  UserRow
// ─────────────────────────────────────────────────────────────

function UserRow({
  user,
  mode,
  checked,
  disabled,
  onToggle,
}: {
  user: ProyectoUsuarioAsignable
  mode: 'single' | 'multi'
  checked: boolean
  disabled: boolean
  onToggle: () => void
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={disabled}
      className={[
        'w-full flex items-center gap-2.5 px-2.5 py-2 text-left transition-colors',
        disabled
          ? 'opacity-50 cursor-not-allowed'
          : checked
            ? 'bg-primary/10'
            : 'hover:bg-muted',
      ].join(' ')}
      style={{ borderRadius: '0.25rem' }}
    >
      {/* Checkbox (multi) o radio (single) */}
      {mode === 'multi' ? (
        <span
          className={[
            'w-4 h-4 border flex items-center justify-center shrink-0',
            checked
              ? 'bg-primary border-primary'
              : 'bg-background border-border',
          ].join(' ')}
          style={{ borderRadius: '0.125rem' }}
        >
          {checked && <Check size={11} className="text-primary-foreground" />}
        </span>
      ) : (
        <span
          className={[
            'w-4 h-4 rounded-full border flex items-center justify-center shrink-0',
            checked
              ? 'border-primary'
              : 'border-border bg-background',
          ].join(' ')}
        >
          {checked && <span className="w-2 h-2 rounded-full bg-primary" />}
        </span>
      )}

      {/* Avatar con iniciales */}
      <span
        className="w-8 h-8 rounded-full bg-foreground/10 flex items-center justify-center text-xs font-medium text-foreground shrink-0"
        style={{ fontFamily: "'JetBrains Mono', monospace" }}
      >
        {user.nombre
          .split(' ')
          .map((p) => p[0])
          .slice(0, 2)
          .join('')
          .toUpperCase()}
      </span>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-foreground truncate">
          {user.nombre}
        </div>
        <div className="text-[10px] text-muted-foreground truncate">{user.email}</div>
        {user.ocupadoEnProyecto && (
          <div className="text-[10px] text-destructive mt-0.5 flex items-center gap-1">
            <AlertTriangle size={9} />
            Ocupado en {user.ocupadoEnProyecto.codigo}
          </div>
        )}
      </div>

      {/* Roles como mini-chips */}
      <div className="hidden sm:flex flex-wrap gap-1 shrink-0 max-w-[180px] justify-end">
        {user.roles.slice(0, 2).map((r) => (
          <span
            key={r.id}
            className="px-1.5 py-0.5 text-[9px] uppercase tracking-wider bg-muted text-muted-foreground"
            style={{ borderRadius: '0.125rem' }}
          >
            {r.nombre}
          </span>
        ))}
        {user.roles.length > 2 && (
          <span
            className="px-1.5 py-0.5 text-[9px] uppercase tracking-wider bg-muted text-muted-foreground"
            style={{ borderRadius: '0.125rem' }}
          >
            +{user.roles.length - 2}
          </span>
        )}
      </div>
    </button>
  )
}
