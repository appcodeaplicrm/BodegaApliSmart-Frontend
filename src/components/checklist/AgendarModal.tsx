/**
 * Modal de agendamiento.
 *
 * - Backdrop con `bg-background/80 backdrop-blur-sm` (igual que el resto de modales del módulo).
 * - Campos: plantilla (solo activas), rol, fecha, hora límite.
 * - Nota informativa: "se asignará a todos los usuarios con ese rol".
 * - Estado de éxito: tras agendar, oculta el form y muestra un check
 *   + mensaje + botón Cerrar.
 *
 * Los inputs de fecha/hora usan `[color-scheme:dark]` para que el
 * picker nativo del navegador se vea coherente con el tema oscuro.
 */
import { useState, useEffect, useMemo } from 'react'
import { X, CheckCircle2, Users } from 'lucide-react'
import type { CkRol, PlantillaListItem } from './types'
import { usuariosPorRol } from './api'

type AgendarModalProps = {
  plantillas: PlantillaListItem[]
  roles: CkRol[]
  bodegaId: string
  plantillaIdInicial?: string
  agSaved: boolean
  onClose: () => void
  onAgendar: (input: {
    plantillaId: string
    rolId?: string
    fecha: string
    horaLimite: string
  }) => Promise<void>
}

export function AgendarModal({
  plantillas,
  roles,
  bodegaId,
  plantillaIdInicial,
  agSaved,
  onClose,
  onAgendar,
}: AgendarModalProps) {
  const activas = useMemo(() => plantillas.filter((p) => p.activa), [plantillas])
  const [plantillaId, setPlantillaId] = useState(plantillaIdInicial ?? '')
  const [rolId, setRolId] = useState('')
  const [fecha, setFecha] = useState('')
  const [hora, setHora] = useState('08:00')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [destinatariosCount, setDestinatariosCount] = useState<number | null>(null)

  // Preview de destinatarios: cuando cambia rol o bodega, contamos
  // cuántos usuarios van a recibir el checklist. Solo informativa.
  useEffect(() => {
    let cancel = false
    const rolParaConteo = rolId || plantillas.find((p) => p.id === plantillaId)?.rol.id
    if (!rolParaConteo) {
      setDestinatariosCount(null)
      return
    }
    usuariosPorRol(rolParaConteo, bodegaId)
      .then((list) => {
        if (!cancel) setDestinatariosCount(list.length)
      })
      .catch(() => {
        if (!cancel) setDestinatariosCount(null)
      })
    return () => {
      cancel = true
    }
  }, [rolId, bodegaId, plantillaId, plantillas])

  // Si hay plantilla inicial, pre-seleccionamos su rol como default
  // y la plantilla. Si no hay, elegimos la primera activa.
  useEffect(() => {
    if (plantillaIdInicial) {
      setPlantillaId(plantillaIdInicial)
      const p = plantillas.find((x) => x.id === plantillaIdInicial)
      if (p) setRolId(p.rol.id)
    } else if (!plantillaId && activas.length > 0) {
      setPlantillaId(activas[0].id)
      setRolId(activas[0].rol.id)
    }
  }, [plantillaIdInicial, plantillas, activas, plantillaId])

  const handleSubmit = async () => {
    setError(null)
    if (!plantillaId) {
      setError('Selecciona una plantilla.')
      return
    }
    if (!fecha) {
      setError('Selecciona una fecha.')
      return
    }
    if (!hora) {
      setError('Selecciona una hora.')
      return
    }
    setSubmitting(true)
    try {
      await onAgendar({ plantillaId, rolId: rolId || undefined, fecha, horaLimite: hora })
    } catch (e) {
      setError((e as Error).message ?? 'No se pudo agendar.')
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div
        className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-md p-5"
        style={{ borderRadius: '0.5rem' }}
      >
        {agSaved ? (
          <SuccessPanel onClose={onClose} />
        ) : (
          <>
            <div className="flex items-center justify-between mb-4">
              <h3
                className="text-base uppercase text-foreground"
                style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800 }}
              >
                Agendar checklist
              </h3>
              <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
                <X size={16} />
              </button>
            </div>

            <div className="space-y-3">
              <Field label="Plantilla">
                <select
                  value={plantillaId}
                  onChange={(e) => {
                    setPlantillaId(e.target.value)
                    const p = plantillas.find((x) => x.id === e.target.value)
                    if (p) setRolId(p.rol.id)
                  }}
                  className="w-full bg-background border border-border px-3 py-1.5 text-sm focus:border-primary/50 outline-none"
                  style={{ borderRadius: '0.25rem' }}
                >
                  {activas.length === 0 ? (
                    <option value="">(no hay plantillas activas)</option>
                  ) : (
                    activas.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.nombre}
                      </option>
                    ))
                  )}
                </select>
              </Field>

              <Field label="Rol asignado">
                <select
                  value={rolId}
                  onChange={(e) => setRolId(e.target.value)}
                  className="w-full bg-background border border-border px-3 py-1.5 text-sm focus:border-primary/50 outline-none"
                  style={{ borderRadius: '0.25rem' }}
                >
                  <option value="">(usar el rol de la plantilla)</option>
                  {roles.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.nombre}
                      {r.usuariosCount != null ? ` (${r.usuariosCount})` : ''}
                    </option>
                  ))}
                </select>
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Fecha">
                  <input
                    type="date"
                    value={fecha}
                    onChange={(e) => setFecha(e.target.value)}
                    style={{ colorScheme: 'dark' }}
                    className="w-full bg-background border border-border px-3 py-1.5 text-sm focus:border-primary/50 outline-none"
                    onClick={(e) => e.currentTarget.showPicker?.()}
                  />
                </Field>
                <Field label="Hora límite">
                  <input
                    type="time"
                    value={hora}
                    onChange={(e) => setHora(e.target.value)}
                    style={{ colorScheme: 'dark' }}
                    className="w-full bg-background border border-border px-3 py-1.5 text-sm focus:border-primary/50 outline-none"
                    onClick={(e) => e.currentTarget.showPicker?.()}
                  />
                </Field>
              </div>

              <div className="bg-muted/50 border border-border rounded-lg p-3 text-xs text-muted-foreground flex items-start gap-2"
                style={{ borderRadius: '0.25rem' }}>
                <Users size={12} className="mt-0.5 shrink-0" />
                <div>
                  <div>
                    Se asignará a los usuarios activos de <strong className="text-foreground">esta bodega</strong> con ese rol.
                    Si ya tienen esta plantilla hoy, no se duplicará.
                  </div>
                  {destinatariosCount !== null && (
                    <div className="mt-1 text-foreground">
                      <strong>{destinatariosCount}</strong> usuario(s) destinatario(s) en esta bodega.
                    </div>
                  )}
                </div>
              </div>

              {error && (
                <div className="text-xs text-primary bg-primary/10 border border-primary/20 px-3 py-2"
                  style={{ borderRadius: '0.25rem' }}>
                  {error}
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 mt-4">
              <button
                onClick={onClose}
                disabled={submitting}
                className="px-3 py-1.5 text-xs border border-border hover:border-primary/40 disabled:opacity-50"
                style={{ borderRadius: '0.25rem' }}
              >
                Cancelar
              </button>
              <button
                onClick={handleSubmit}
                disabled={submitting || activas.length === 0}
                className="px-3 py-1.5 text-xs bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50"
                style={{ borderRadius: '0.25rem' }}
              >
                {submitting ? 'Agendando…' : 'Agendar'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-[10px] text-muted-foreground tracking-widest mb-1"
        style={{ fontFamily: "'JetBrains Mono', monospace" }}>
        {label.toUpperCase()}
      </span>
      {children}
    </label>
  )
}

function SuccessPanel({ onClose }: { onClose: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-6 gap-3 text-center">
      <CheckCircle2 size={48} className="text-secondary" />
      <h3
        className="text-lg uppercase text-foreground"
        style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800 }}
      >
        Checklist agendado
      </h3>
      <p className="text-sm text-muted-foreground max-w-xs">
        Se asignó a los usuarios del rol y quedó pendiente de ejecución hasta la fecha límite.
      </p>
      <button
        onClick={onClose}
        className="mt-2 px-3 py-1.5 text-xs bg-primary text-primary-foreground hover:opacity-90"
        style={{ borderRadius: '0.25rem' }}
      >
        Cerrar
      </button>
    </div>
  )
}
