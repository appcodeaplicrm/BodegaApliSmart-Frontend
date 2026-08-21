/**
 * Modal para cambiar el estado de un proyecto.
 *
 * Muestra solo las transiciones válidas (matriz del service). El user
 * puede elegir el nuevo estado + motivo opcional.
 */
import { useEffect, useState } from 'react'
import { AlertCircle, Loader2, PauseCircle } from 'lucide-react'
import { Modal } from '../Modal'
import { SelectMobile } from '../SelectMobile'
import { listarEstados, cambiarEstado } from './api'
import type { ProyectoEstado } from './types'

type Props = {
  open: boolean
  proyectoId: string
  estadoActualNombre: string
  onClose: () => void
  onChanged: () => void
}

// Matriz espejo de `proyectos.service.ts:validarTransicionEstado`
const TRANSICIONES: Record<string, string[]> = {
  Planificado: ['EnProgreso', 'Cancelado'],
  EnProgreso: ['Pausado', 'Finalizado', 'Cancelado'],
  Pausado: ['EnProgreso', 'Cancelado'],
  Finalizado: [],
  Cancelado: [],
}

export function CambiarEstadoModal({
  open,
  proyectoId,
  estadoActualNombre,
  onClose,
  onChanged,
}: Props) {
  const [estados, setEstados] = useState<ProyectoEstado[]>([])
  const [loading, setLoading] = useState(false)
  const [estadoId, setEstadoId] = useState('')
  const [motivo, setMotivo] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setLoading(true)
    void listarEstados()
      .then(setEstados)
      .catch(() => setEstados([]))
      .finally(() => setLoading(false))
  }, [open])

  useEffect(() => {
    if (!open) {
      setEstadoId('')
      setMotivo('')
      setErrorMsg(null)
    }
  }, [open])

  const destinosDisponibles = TRANSICIONES[estadoActualNombre] ?? []
  const opciones = estados.filter((e) => destinosDisponibles.includes(e.nombre))
  const puedeSubmit = estadoId && !submitting

  async function handleSubmit() {
    if (!puedeSubmit) return
    setSubmitting(true)
    setErrorMsg(null)
    try {
      await cambiarEstado(proyectoId, estadoId, motivo || undefined)
      onChanged()
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'No se pudo cambiar el estado.'
      setErrorMsg(msg)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Cambiar estado del proyecto"
      description={`Estado actual: ${estadoActualNombre}`}
      icon={<PauseCircle size={18} />}
      size="sm"
      footer={
        <div className="flex items-center justify-end gap-2">
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
            onClick={handleSubmit}
            disabled={!puedeSubmit}
            className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
            style={{ borderRadius: '0.25rem' }}
          >
            {submitting && <Loader2 size={13} className="animate-spin" />}
            Cambiar estado
          </button>
        </div>
      }
    >
      {loading ? (
        <div className="p-6 flex items-center justify-center text-muted-foreground">
          <Loader2 size={18} className="animate-spin mr-2" />
          Cargando…
        </div>
      ) : opciones.length === 0 ? (
        <div className="p-5 sm:p-6">
          <div className="border border-muted-foreground/30 bg-muted/30 p-3 flex items-start gap-2 text-xs">
            <AlertCircle size={14} className="text-muted-foreground shrink-0 mt-0.5" />
            <span className="text-muted-foreground">
              El proyecto en estado "{estadoActualNombre}" no permite transiciones.
            </span>
          </div>
        </div>
      ) : (
        <div className="p-5 sm:p-6 space-y-4">
          {errorMsg && (
            <div className="border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">
              {errorMsg}
            </div>
          )}
          <div>
            <label className="block text-xs font-medium text-foreground mb-1">
              Nuevo estado <span className="text-destructive">*</span>
            </label>
            <SelectMobile
              value={estadoId}
              onChange={setEstadoId}
              placeholder="Seleccionar estado…"
              options={opciones.map((e) => ({ value: e.id, label: e.nombre }))}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-foreground mb-1">
              Motivo (opcional)
            </label>
            <textarea
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              rows={3}
              placeholder="Por qué se cambia el estado…"
              className="w-full px-3 py-2 bg-background border border-border text-sm focus:outline-none focus:border-foreground/40 resize-none"
              style={{ borderRadius: '0.25rem' }}
            />
          </div>
        </div>
      )}
    </Modal>
  )
}
