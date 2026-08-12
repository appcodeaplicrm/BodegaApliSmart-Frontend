/**
 * Modal de agendamiento.
 *
 * - Usa el componente `Modal` reusable (Portal, focus trap, scroll lock).
 * - Campos: plantilla (solo activas), rol, fecha, hora límite.
 * - Switch "¿Objeto operativo al cierre?" (mapea al campo SI/NO
 *   "ESCALERA OPERATIVA" del PDF).
 * - Los datos del PDF (logo, empresa, formato, objeto, foto) ya
 *   vienen de la plantilla. Acá solo se elige el día y la hora.
 * - Estado de éxito: tras agendar, oculta el form y muestra un
 *   check + mensaje + botón Cerrar.
 */
import { useState, useEffect, useMemo } from 'react'
import { CheckCircle2, Users, Loader2, Send } from 'lucide-react'
import type { CkRol, PlantillaListItem } from './types'
import { usuariosPorRol } from './api'
import { Modal } from '../Modal'
import { SelectMobile } from '../SelectMobile'
import { DateTimePicker } from '../DateTimePicker'

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
    objetoOperativo?: boolean
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
    <Modal
      open
      onClose={onClose}
      title="Agendar checklist"
      size="md"
      contentClassName="max-h-[90dvh] sm:max-h-[90dvh]"
      footer={
        agSaved ? (
          <button
            type="button"
            onClick={onClose}
            className="w-full min-h-[44px] py-2.5 bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors"
            style={{ borderRadius: '0.25rem' }}
          >
            Cerrar
          </button>
        ) : (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="flex-1 min-h-[44px] py-2.5 border border-border text-sm text-foreground hover:border-foreground/30 transition-colors disabled:opacity-50"
              style={{ borderRadius: '0.25rem' }}
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting || activas.length === 0}
              className="flex-1 min-h-[44px] py-2.5 bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50 inline-flex items-center justify-center gap-2"
              style={{ borderRadius: '0.25rem' }}
            >
              {submitting ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  Agendando…
                </>
              ) : (
                <>
                  <Send size={14} />
                  Agendar
                </>
              )}
            </button>
          </div>
        )
      }
    >
      {agSaved ? (
        <SuccessPanel />
      ) : (
        <div className="p-5 space-y-3">
          <Field label="Plantilla">
            <SelectMobile
              value={plantillaId}
              onChange={(v) => {
                setPlantillaId(v)
                const p = plantillas.find((x) => x.id === v)
                if (p) setRolId(p.rol.id)
              }}
              options={activas.map((p) => ({ value: p.id, label: p.nombre }))}
              placeholder={activas.length === 0 ? 'No hay plantillas activas' : 'Seleccionar plantilla…'}
              disabled={activas.length === 0}
              label="Plantilla"
            />
          </Field>

          <Field label="Rol asignado">
            <SelectMobile
              value={rolId}
              onChange={(v) => setRolId(v)}
              options={[
                { value: '', label: 'Usar el rol de la plantilla' },
                ...roles.map((r) => ({
                  value: r.id,
                  label: `${r.nombre}${r.usuariosCount != null ? ` (${r.usuariosCount})` : ''}`,
                })),
              ]}
              placeholder="Seleccionar rol…"
              label="Rol asignado"
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Fecha">
              <DateTimePicker mode="date" value={fecha} onChange={setFecha} placeholder="dd/mm/aaaa" label="Elegir fecha" />
            </Field>
            <Field label="Hora límite">
              <DateTimePicker mode="time" value={hora} onChange={setHora} placeholder="08:00" label="Elegir hora" />
            </Field>
          </div>

          <div className="bg-muted/50 border border-border p-3 text-xs text-muted-foreground flex items-start gap-2"
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
      )}
    </Modal>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-[10px] text-muted-foreground tracking-widest mb-1.5"
        style={{ fontFamily: "'JetBrains Mono', monospace" }}>
        {label.toUpperCase()}
      </span>
      {children}
    </label>
  )
}

function SuccessPanel() {
  return (
    <div className="flex flex-col items-center justify-center py-8 gap-3 text-center">
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
    </div>
  )
}
