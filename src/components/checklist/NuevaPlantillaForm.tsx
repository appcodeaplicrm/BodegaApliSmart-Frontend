/**
 * Form de nueva plantilla.
 *
 * El .md es claro: NO es modal. Reemplaza la lista cuando se muestra
 * (lo controla `ChecklistView` con `showForm`).
 *
 * - Inputs: nombre, descripción, rol asignado.
 * - Tabla de ítems editable: agregar / quitar / toggle "Requerido".
 * - Submit: llama `crearPlantilla` y notifica al padre.
 */
import { useState } from 'react'
import { Check, Plus, X, AlertCircle } from 'lucide-react'
import { crearPlantilla } from './api'
import type { CkRol } from './types'

type NuevaPlantillaFormProps = {
  roles: CkRol[]
  bodegaId: string
  onCancel: () => void
  onCreated: () => void | Promise<void>
}

type DraftItem = { tempId: string; texto: string; requerido: boolean }

let TEMP_ID = 0
const nextTempId = () => `tmp-${++TEMP_ID}`

export function NuevaPlantillaForm({ roles, bodegaId, onCancel, onCreated }: NuevaPlantillaFormProps) {
  const [nombre, setNombre] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [rolId, setRolId] = useState(roles[0]?.id ?? '')
  const [horaSugerida, setHoraSugerida] = useState('')
  const [items, setItems] = useState<DraftItem[]>([
    { tempId: nextTempId(), texto: '', requerido: true },
  ])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleAddItem = () => {
    setItems((prev) => [...prev, { tempId: nextTempId(), texto: '', requerido: true }])
  }

  const handleRemoveItem = (tempId: string) => {
    setItems((prev) => (prev.length === 1 ? prev : prev.filter((i) => i.tempId !== tempId)))
  }

  const handleItemChange = (tempId: string, texto: string) => {
    setItems((prev) => prev.map((i) => (i.tempId === tempId ? { ...i, texto } : i)))
  }

  const handleToggleRequerido = (tempId: string) => {
    setItems((prev) => prev.map((i) => (i.tempId === tempId ? { ...i, requerido: !i.requerido } : i)))
  }

  const handleSubmit = async () => {
    setError(null)
    const nombreLimpio = nombre.trim()
    if (nombreLimpio.length < 2) {
      setError('El nombre debe tener al menos 2 caracteres.')
      return
    }
    if (!rolId) {
      setError('Selecciona un rol.')
      return
    }
    const itemsLimpios = items.map((i) => i.texto.trim()).filter(Boolean)
    if (itemsLimpios.length === 0) {
      setError('Agrega al menos un ítem con texto.')
      return
    }
    setSubmitting(true)
    try {
      await crearPlantilla({
        nombre: nombreLimpio,
        descripcion: descripcion.trim() || undefined,
        rolId,
        activa: true,
        bodegaId,
        horaSugerida: horaSugerida.trim() || undefined,
        items: items
          .filter((i) => i.texto.trim().length > 0)
          .map((i) => ({ texto: i.texto.trim(), requerido: i.requerido })),
      })
      await onCreated()
    } catch (e) {
      setError((e as Error).message ?? 'No se pudo crear la plantilla.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div
      className="rounded-lg border border-primary/30 bg-card ring-1 ring-primary/10 p-5 space-y-4"
      style={{ borderRadius: '0.25rem' }}
    >
      <div className="flex items-center justify-between">
        <h2
          className="text-base uppercase text-foreground"
          style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800 }}
        >
          Nueva plantilla de checklist
        </h2>
      </div>

      {/* Campos cabecera */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Field label="Nombre">
          <input
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder="Ej: Verificación diaria de instrumentos"
            className="w-full bg-background border border-border px-3 py-1.5 text-sm focus:border-primary/50 outline-none"
            style={{ borderRadius: '0.25rem' }}
          />
        </Field>
        <Field label="Rol asignado">
          <select
            value={rolId}
            onChange={(e) => setRolId(e.target.value)}
            className="w-full bg-background border border-border px-3 py-1.5 text-sm focus:border-primary/50 outline-none"
            style={{ borderRadius: '0.25rem' }}
          >
            {roles.length === 0 ? (
              <option value="">(no hay roles con usuarios en esta bodega)</option>
            ) : (
              roles.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.nombre}
                  {r.usuariosCount != null ? ` (${r.usuariosCount})` : ''}
                </option>
              ))
            )}
          </select>
        </Field>
      </div>

      <Field label="Descripción (opcional)">
        <textarea
          value={descripcion}
          onChange={(e) => setDescripcion(e.target.value)}
          rows={2}
          className="w-full bg-background border border-border px-3 py-1.5 text-sm focus:border-primary/50 outline-none resize-none"
          style={{ borderRadius: '0.25rem' }}
        />
      </Field>

      <Field label="Hora sugerida de ejecución (opcional)">
        <div className="flex items-center gap-2">
          <input
            type="time"
            value={horaSugerida}
            onChange={(e) => setHoraSugerida(e.target.value)}
            style={{ colorScheme: 'dark' }}
            className="bg-background border border-border px-3 py-1.5 text-sm focus:border-primary/50 outline-none"
            onClick={(e) => e.currentTarget.showPicker?.()}
          />
          <span className="text-[10px] text-muted-foreground"
            style={{ fontFamily: "'JetBrains Mono', monospace" }}>
            El calendario ubicará este checklist a esta hora del día.
          </span>
        </div>
      </Field>

      {/* Tabla de ítems */}
      <div>
        <div className="grid grid-cols-[24px_1fr_80px_32px] text-[10px] tracking-widest text-muted-foreground px-1 mb-1"
          style={{ fontFamily: "'JetBrains Mono', monospace" }}>
          <div>#</div>
          <div>VERIFICACIÓN</div>
          <div className="text-center">REQUERIDO</div>
          <div />
        </div>
        <div className="space-y-1">
          {items.map((it, idx) => (
            <div key={it.tempId} className="grid grid-cols-[24px_1fr_80px_32px] items-center">
              <div className="text-[10px] text-muted-foreground text-center"
                style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                {String(idx + 1).padStart(2, '0')}
              </div>
              <input
                value={it.texto}
                onChange={(e) => handleItemChange(it.tempId, e.target.value)}
                placeholder="Ej: Calibración de sensor"
                className="w-full bg-transparent border-b border-transparent focus:border-primary/40 px-2 py-1 text-sm outline-none"
              />
              <div className="text-center">
                <button
                  onClick={() => handleToggleRequerido(it.tempId)}
                  className={[
                    'px-2 py-0.5 text-[10px] border transition-colors',
                    it.requerido
                      ? 'bg-primary/15 text-primary border-primary/20'
                      : 'bg-muted text-muted-foreground border-border',
                  ].join(' ')}
                  style={{ borderRadius: '0.25rem', fontFamily: "'JetBrains Mono', monospace" }}
                >
                  {it.requerido ? 'SÍ' : 'NO'}
                </button>
              </div>
              <button
                onClick={() => handleRemoveItem(it.tempId)}
                disabled={items.length === 1}
                className="flex items-center justify-center text-muted-foreground hover:text-primary disabled:opacity-30"
                aria-label="Eliminar ítem"
              >
                <X size={14} />
              </button>
            </div>
          ))}
        </div>
        <button
          onClick={handleAddItem}
          className="mt-2 w-full inline-flex items-center justify-center gap-1 py-1.5 text-xs border border-dashed border-border hover:border-primary/40 text-muted-foreground hover:text-foreground"
          style={{ borderRadius: '0.25rem' }}
        >
          <Plus size={12} /> Agregar ítem
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2 text-xs text-primary bg-primary/10 border border-primary/20 px-3 py-2"
          style={{ borderRadius: '0.25rem' }}>
          <AlertCircle size={12} /> {error}
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/40">
        <button
          onClick={onCancel}
          disabled={submitting}
          className="px-3 py-1.5 text-xs border border-border hover:border-primary/40 disabled:opacity-50"
          style={{ borderRadius: '0.25rem' }}
        >
          Cancelar
        </button>
        <button
          onClick={handleSubmit}
          disabled={submitting}
          className="inline-flex items-center gap-1 px-3 py-1.5 text-xs bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50"
          style={{ borderRadius: '0.25rem' }}
        >
          <Check size={12} />
          {submitting ? 'Creando…' : 'Crear plantilla'}
        </button>
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
