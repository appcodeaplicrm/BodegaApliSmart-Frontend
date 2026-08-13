/**
 * Form de plantilla de checklist (crear O editar).
 *
 * - Si recibe `initial`, arranca con esos valores (modo edición).
 * - Si NO recibe `initial`, arranca vacío (modo creación).
 *
 * MODAL con 3 secciones:
 *   1. DATOS DEL CHECKLIST — nombre, descripción, rol, hora sugerida,
 *      tipo de PDF (FORMATO ESCALERA o FORMATO EPP).
 *   2. HEADER DEL PDF (EMPRESA + OBJETO) — logo, nombre, departamento,
 *      formato, datos del objeto a inspeccionar.
 *   3. ITEMS A VERIFICAR — el cuerpo del checklist (los definís vos).
 *
 * El `htmlKind` define el formato del PDF al imprimir:
 *   - "escaleras" → Inspección de Escaleras (ítems con SI / NO).
 *   - "epp"       → Inspección Semanal de EPP (ítems con BUEN / MAL / NO PRESENTA).
 *
 * Ver `checklistPdf.escaleras.ts` y `checklistPdf.epp.ts` para el
 * layout del PDF.
 */
import { useState, useRef, useEffect } from 'react'
import {
  Check,
  Plus,
  X,
  AlertCircle,
  Building2,
  Package,
  Loader2,
  FileText,
  Upload,
  CheckSquare,
  Square,
} from 'lucide-react'
import { crearPlantilla, actualizarPlantilla, subirFoto } from './api'
import type { CkRol, Plantilla } from './types'
import { Modal } from '../Modal'
import { SelectMobile } from '../SelectMobile'
import { DateTimePicker } from '../DateTimePicker'

type PlantillaFormProps = {
  roles: CkRol[]
  bodegaId: string
  /** Si está presente, el form entra en modo edición con estos valores. */
  initial?: Plantilla
  onCancel: () => void
  onSaved: () => void | Promise<void>
}

type HtmlKind = 'escaleras' | 'epp'

const HTML_KINDS: { value: HtmlKind; label: string; descripcion: string }[] = [
  {
    value: 'escaleras',
    label: 'FORMATO ESCALERA',
    descripcion: 'Inspección de escalera. Lista de ítems con SI / NO por día.',
  },
  {
    value: 'epp',
    label: 'FORMATO EPP',
    descripcion: 'Inspección semanal de EPP. Lista de EPPs con 3 estados por día (BUEN / MAL / NO PRESENTA).',
  },
]

type DraftItem = { tempId: string; texto: string; requerido: boolean }

let TEMP_ID = 0
const nextTempId = () => `tmp-${++TEMP_ID}`

export function PlantillaForm({ roles, bodegaId, initial, onCancel, onSaved }: PlantillaFormProps) {
  const isEdit = Boolean(initial)
  // ─── Sección 1: DATOS DEL CHECKLIST ───
  const [nombre, setNombre] = useState(initial?.nombre ?? '')
  const [descripcion, setDescripcion] = useState(initial?.descripcion ?? '')
  const [rolId, setRolId] = useState(initial?.rol.id ?? roles[0]?.id ?? '')
  const [horaSugerida, setHoraSugerida] = useState(initial?.horaSugerida ?? '')
  const [htmlKind, setHtmlKind] = useState<HtmlKind>((initial?.htmlKind as HtmlKind) ?? 'escaleras')

  // ─── Sección 2: HEADER DEL PDF (EMPRESA) ───
  const [empresaNombre, setEmpresaNombre] = useState(initial?.empresaNombre ?? '')
  const [empresaDepartamento, setEmpresaDepartamento] = useState(initial?.empresaDepartamento ?? '')
  const [empresaFormato, setEmpresaFormato] = useState(
    initial?.empresaFormato ?? 'Formato de Inspección para Escaleras de Tijera',
  )
  const [empresaLogoKey, setEmpresaLogoKey] = useState<string | null>(initial?.empresaLogoKey ?? null)
  const [empresaLogoUrl, setEmpresaLogoUrl] = useState<string | null>(initial?.empresaLogoUrl ?? null)
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const logoInputRef = useRef<HTMLInputElement>(null)

  // ─── Sección 3: OBJETO A INSPECCIONAR (PDF) ───
  const [objetoNombre, setObjetoNombre] = useState(initial?.objetoNombre ?? 'Escalera articulada')
  const [objetoLongitud, setObjetoLongitud] = useState(initial?.objetoLongitud ?? '')
  const [objetoTipos, setObjetoTipos] = useState<string[]>(initial?.objetoTipos ?? [])
  const [objetoCapacidad, setObjetoCapacidad] = useState(initial?.objetoCapacidad ?? '')
  const [objetoCodigo, setObjetoCodigo] = useState(initial?.objetoCodigo ?? '')
  const [objetoFotoKey, setObjetoFotoKey] = useState<string | null>(initial?.objetoFotoKey ?? null)
  const [objetoFotoUrl, setObjetoFotoUrl] = useState<string | null>(initial?.objetoFotoUrl ?? null)
  const [uploadingFoto, setUploadingFoto] = useState(false)
  const fotoInputRef = useRef<HTMLInputElement>(null)

  // ─── Sección 4: ITEMS A VERIFICAR ───
  // El usuario define los items. El formato (SI/NO para escaleras,
  // 3 estados para EPP) lo define el htmlKind.
  const [items, setItems] = useState<DraftItem[]>(
    initial?.items && initial.items.length > 0
      ? initial.items.map((it) => ({
          tempId: nextTempId(),
          texto: it.texto,
          requerido: it.requerido,
        }))
      : [{ tempId: nextTempId(), texto: '', requerido: true }],
  )

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Si el `initial` cambia (ej. el padre re-carga la plantilla después
  // de un refresh), sincronizamos los campos controlables.
  useEffect(() => {
    if (!initial) return
    setNombre(initial.nombre)
    setDescripcion(initial.descripcion ?? '')
    setRolId(initial.rol.id)
    setHoraSugerida(initial.horaSugerida ?? '')
    setHtmlKind((initial.htmlKind as HtmlKind) ?? 'escaleras')
    setEmpresaNombre(initial.empresaNombre ?? '')
    setEmpresaDepartamento(initial.empresaDepartamento ?? '')
    setEmpresaFormato(initial.empresaFormato ?? 'Formato de Inspección para Escaleras de Tijera')
    setEmpresaLogoKey(initial.empresaLogoKey ?? null)
    setEmpresaLogoUrl(initial.empresaLogoUrl ?? null)
    setObjetoNombre(initial.objetoNombre ?? 'Escalera articulada')
    setObjetoLongitud(initial.objetoLongitud ?? '')
    setObjetoTipos(initial.objetoTipos ?? [])
    setObjetoCapacidad(initial.objetoCapacidad ?? '')
    setObjetoCodigo(initial.objetoCodigo ?? '')
    setObjetoFotoKey(initial.objetoFotoKey ?? null)
    setObjetoFotoUrl(initial.objetoFotoUrl ?? null)
    setItems(
      initial.items && initial.items.length > 0
        ? initial.items.map((it) => ({
            tempId: nextTempId(),
            texto: it.texto,
            requerido: it.requerido,
          }))
        : [{ tempId: nextTempId(), texto: '', requerido: true }],
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initial?.id])

  // ─── Uploads ───
  const handleUploadLogo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return
    setUploadingLogo(true)
    setError(null)
    try {
      const res = await subirFoto(f, bodegaId, `logo-plantilla-${Date.now()}.${f.name.split('.').pop()}`)
      setEmpresaLogoKey(res.key)
      setEmpresaLogoUrl(res.url)
    } catch (err) {
      setError(`No se pudo subir el logo: ${(err as Error).message}`)
    } finally {
      setUploadingLogo(false)
      if (logoInputRef.current) logoInputRef.current.value = ''
    }
  }

  const handleUploadFoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return
    setUploadingFoto(true)
    setError(null)
    try {
      const res = await subirFoto(f, bodegaId, `objeto-plantilla-${Date.now()}.${f.name.split('.').pop()}`)
      setObjetoFotoKey(res.key)
      setObjetoFotoUrl(res.url)
    } catch (err) {
      setError(`No se pudo subir la foto: ${(err as Error).message}`)
    } finally {
      setUploadingFoto(false)
      if (fotoInputRef.current) fotoInputRef.current.value = ''
    }
  }

  // ─── Items ───
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
    if (!empresaNombre.trim()) {
      setError('Indica el nombre de la empresa.')
      return
    }
    if (htmlKind === 'escaleras' && !objetoNombre.trim()) {
      setError('Indica el nombre del objeto a inspeccionar.')
      return
    }
    const itemsLimpios = items.map((i) => i.texto.trim()).filter(Boolean)
    if (itemsLimpios.length === 0) {
      setError('Agrega al menos un ítem con texto.')
      return
    }
    setSubmitting(true)
    const itemsPayload = items
      .filter((i) => i.texto.trim().length > 0)
      .map((i) => ({ texto: i.texto.trim(), requerido: i.requerido }))

    const payload = {
      nombre: nombreLimpio,
      descripcion: descripcion.trim() || undefined,
      rolId,
      horaSugerida: horaSugerida.trim() || undefined,
      htmlKind,
      // PDF header (empresa)
      empresaLogoKey: empresaLogoKey ?? undefined,
      empresaNombre: empresaNombre.trim() || undefined,
      empresaDepartamento: empresaDepartamento.trim() || undefined,
      empresaFormato: empresaFormato.trim() || undefined,
      // El formato EPP trabaja directamente por ítems y no tiene un
      // objeto principal a inspeccionar.
      ...(htmlKind === 'escaleras'
        ? {
            objetoNombre: objetoNombre.trim() || undefined,
            objetoLongitud: objetoLongitud.trim() || undefined,
            objetoTipos: objetoTipos.length > 0 ? objetoTipos : undefined,
            objetoCapacidad: objetoCapacidad.trim() || undefined,
            objetoCodigo: objetoCodigo.trim() || undefined,
            objetoFotoKey: objetoFotoKey ?? undefined,
          }
        : {}),
      // Items custom. Cada plantilla puede tener los suyos.
      items: itemsPayload,
    }

    try {
      if (isEdit && initial) {
        await actualizarPlantilla(initial.id, payload, bodegaId)
      } else {
        await crearPlantilla({ ...payload, activa: true, bodegaId })
      }
      await onSaved()
    } catch (e) {
      setError((e as Error).message ?? 'No se pudo guardar la plantilla.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal
      open
      onClose={submitting ? () => {} : onCancel}
      title={isEdit ? 'Editar plantilla de checklist' : 'Nueva plantilla de checklist'}
      icon={isEdit ? <Plus size={14} className="text-primary-foreground" /> : <Plus size={14} className="text-primary-foreground" />}
      size="lg"
      contentClassName="max-h-[90dvh] sm:max-h-[90dvh]"
      footer={
        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={submitting}
            className="min-h-[44px] px-4 py-2 border border-border text-sm text-foreground hover:border-foreground/30 transition-colors disabled:opacity-50"
            style={{ borderRadius: '0.25rem' }}
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting}
            className="inline-flex items-center gap-2 min-h-[44px] px-4 py-2 bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50"
            style={{ borderRadius: '0.25rem' }}
          >
            {submitting ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                Guardando…
              </>
            ) : (
              <>
                <Check size={14} />
                {isEdit ? 'Guardar cambios' : 'Crear plantilla'}
              </>
            )}
          </button>
        </div>
      }
    >
      <div className="p-5 space-y-4">
        {/* ─── SECCIÓN 1: DATOS DEL CHECKLIST ─── */}
        <Section icon={<Plus size={12} />} title="DATOS DEL CHECKLIST">
          <Field label="Nombre">
            <input
              type="text"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Ej: Verificación diaria de instrumento"
              className="w-full min-h-[44px] bg-background border border-border px-3 py-2 text-sm focus:border-primary/50 outline-none"
              style={{ borderRadius: '0.25rem' }}
            />
          </Field>
          <Field label="Rol asignado">
            <SelectMobile
              value={rolId}
              onChange={setRolId}
              options={roles.map((r) => ({ value: r.id, label: r.nombre }))}
              placeholder="Seleccionar rol…"
              label="Rol"
            />
          </Field>
          <Field label="Descripción (opcional)">
            <textarea
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              placeholder="Para qué sirve esta plantilla, qué cubre…"
              rows={2}
              className="w-full bg-background border border-border px-3 py-2 text-sm focus:border-primary/50 outline-none resize-none"
              style={{ borderRadius: '0.25rem' }}
            />
          </Field>
          <Field label="Hora sugerida de ejecución (opcional)">
            <DateTimePicker
              mode="time"
              value={horaSugerida}
              onChange={setHoraSugerida}
              placeholder="08:00"
              label="Hora"
            />
          </Field>
          <Field label="Plantilla de PDF">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {HTML_KINDS.map((k) => {
                const selected = htmlKind === k.value
                return (
                  <button
                    key={k.value}
                    type="button"
                    onClick={() => setHtmlKind(k.value)}
                    className={[
                      'flex flex-col items-start text-left p-3 border transition-colors min-h-[64px]',
                      selected
                        ? 'bg-primary/15 border-primary/40 text-foreground'
                        : 'bg-background border-border text-muted-foreground hover:border-primary/30',
                    ].join(' ')}
                    style={{ borderRadius: '0.25rem' }}
                    aria-pressed={selected}
                  >
                    <span className="flex items-center gap-2 text-sm font-semibold text-foreground">
                      <FileText size={14} className={selected ? 'text-primary' : 'text-muted-foreground'} />
                      {k.label}
                    </span>
                    <span className="text-[11px] text-muted-foreground mt-1 leading-snug">
                      {k.descripcion}
                    </span>
                  </button>
                )
              })}
            </div>
          </Field>
        </Section>

        {/* ─── SECCIÓN 2: HEADER DEL PDF (EMPRESA) ─── */}
        <Section icon={<Building2 size={12} />} title="HEADER DEL PDF (EMPRESA)">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Nombre de la empresa">
              <input
                type="text"
                value={empresaNombre}
                onChange={(e) => setEmpresaNombre(e.target.value)}
                placeholder="Ej: Vuela Technology S.A.S"
                className="w-full min-h-[44px] bg-background border border-border px-3 py-2 text-sm focus:border-primary/50 outline-none"
                style={{ borderRadius: '0.25rem' }}
              />
            </Field>
            <Field label="Área / Departamento">
              <input
                type="text"
                value={empresaDepartamento}
                onChange={(e) => setEmpresaDepartamento(e.target.value)}
                placeholder="Ej: Operaciones"
                className="w-full min-h-[44px] bg-background border border-border px-3 py-2 text-sm focus:border-primary/50 outline-none"
                style={{ borderRadius: '0.25rem' }}
              />
            </Field>
          </div>
          <Field label="Título del formato">
            <input
              type="text"
              value={empresaFormato}
              onChange={(e) => setEmpresaFormato(e.target.value)}
              placeholder="Ej: Formato de Inspección para Escaleras de Tijera"
              className="w-full min-h-[44px] bg-background border border-border px-3 py-2 text-sm focus:border-primary/50 outline-none"
              style={{ borderRadius: '0.25rem' }}
            />
          </Field>
          <Field label="Logo de la empresa">
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                {empresaLogoUrl ? (
                  <div className="relative">
                    <img
                      src={empresaLogoUrl}
                      alt="Logo override"
                      className="w-16 h-16 object-contain border border-border bg-background"
                      style={{ borderRadius: '0.25rem' }}
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setEmpresaLogoKey(null)
                        setEmpresaLogoUrl(null)
                      }}
                      className="absolute -top-2 -right-2 w-6 h-6 bg-primary text-primary-foreground inline-flex items-center justify-center"
                      style={{ borderRadius: '9999px' }}
                      aria-label="Quitar logo override"
                    >
                      <X size={12} />
                    </button>
                  </div>
                ) : (
                  <div className="w-16 h-16 border border-dashed border-border bg-muted/30 flex items-center justify-center text-muted-foreground"
                    style={{ borderRadius: '0.25rem' }}
                    title="Logo del tenant">
                    <Building2 size={20} />
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => logoInputRef.current?.click()}
                  disabled={uploadingLogo}
                  className="inline-flex items-center gap-2 min-h-[44px] px-3 py-2 text-sm border border-border hover:border-primary/40 disabled:opacity-50"
                  style={{ borderRadius: '0.25rem' }}
                >
                  {uploadingLogo ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                  {empresaLogoUrl ? 'Cambiar logo' : 'Subir logo'}
                </button>
                <input
                  ref={logoInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleUploadLogo}
                />
              </div>
              <p className="text-[10px] text-muted-foreground"
                style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                Si no subís un logo se pondrá el de tu empresa.
              </p>
            </div>
          </Field>
        </Section>

        {/* El formato EPP se define por ítems; no existe un objeto principal. */}
        {htmlKind === 'escaleras' && (
        <Section icon={<Package size={12} />} title="OBJETO A INSPECCIONAR (PDF)">
          <Field label="Nombre del objeto">
            <input
              type="text"
              value={objetoNombre}
              onChange={(e) => setObjetoNombre(e.target.value)}
              placeholder="Ej: Escalera articulada"
              className="w-full min-h-[44px] bg-background border border-border px-3 py-2 text-sm focus:border-primary/50 outline-none"
              style={{ borderRadius: '0.25rem' }}
            />
          </Field>
          <Field label="Tipos (marcá los que tenga el objeto)">
            <div className="grid grid-cols-4 gap-2">
              {(['III', 'I', 'IA', 'IAA'] as const).map((tipo) => {
                const selected = objetoTipos.includes(tipo)
                return (
                  <button
                    key={tipo}
                    type="button"
                    onClick={() => {
                      setObjetoTipos((prev) =>
                        prev.includes(tipo)
                          ? prev.filter((t) => t !== tipo)
                          : [...prev, tipo],
                      )
                    }}
                    className={[
                      'min-h-[44px] px-3 py-2 text-sm font-semibold border transition-colors',
                      selected
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-background text-muted-foreground border-border hover:border-primary/40',
                    ].join(' ')}
                    style={{ borderRadius: '0.25rem' }}
                    aria-pressed={selected}
                  >
                    {selected ? '✓ ' : ''}{tipo}
                  </button>
                )
              })}
            </div>
          </Field>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Longitud">
              <input
                type="text"
                value={objetoLongitud}
                onChange={(e) => setObjetoLongitud(e.target.value)}
                placeholder="1.8 m"
                className="w-full min-h-[44px] bg-background border border-border px-3 py-2 text-sm focus:border-primary/50 outline-none"
                style={{ borderRadius: '0.25rem' }}
              />
            </Field>
            <Field label="Capacidad de carga">
              <input
                type="text"
                value={objetoCapacidad}
                onChange={(e) => setObjetoCapacidad(e.target.value)}
                placeholder="150 kg"
                className="w-full min-h-[44px] bg-background border border-border px-3 py-2 text-sm focus:border-primary/50 outline-none"
                style={{ borderRadius: '0.25rem' }}
              />
            </Field>
          </div>
          <Field label="Código del objeto">
            <input
              type="text"
              value={objetoCodigo}
              onChange={(e) => setObjetoCodigo(e.target.value)}
              placeholder="Ej: VUEL-TIJ-001"
              className="w-full min-h-[44px] bg-background border border-border px-3 py-2 text-sm focus:border-primary/50 outline-none"
              style={{ borderRadius: '0.25rem' }}
            />
          </Field>
          <Field label="Foto del objeto (opcional)">
            <div className="flex items-center gap-3">
              {objetoFotoUrl ? (
                <div className="relative">
                  <img
                    src={objetoFotoUrl}
                    alt="Objeto"
                    className="w-16 h-16 object-cover border border-border bg-background"
                    style={{ borderRadius: '0.25rem' }}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setObjetoFotoKey(null)
                      setObjetoFotoUrl(null)
                    }}
                    className="absolute -top-2 -right-2 w-6 h-6 bg-primary text-primary-foreground inline-flex items-center justify-center"
                    style={{ borderRadius: '9999px' }}
                    aria-label="Quitar foto"
                  >
                    <X size={12} />
                  </button>
                </div>
              ) : (
                <div className="w-16 h-16 border border-dashed border-border bg-muted/30 flex items-center justify-center text-muted-foreground"
                  style={{ borderRadius: '0.25rem' }}>
                  <Package size={20} />
                </div>
              )}
              <button
                type="button"
                onClick={() => fotoInputRef.current?.click()}
                disabled={uploadingFoto}
                className="inline-flex items-center gap-2 min-h-[44px] px-3 py-2 text-sm border border-border hover:border-primary/40 disabled:opacity-50"
                style={{ borderRadius: '0.25rem' }}
              >
                {uploadingFoto ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                {objetoFotoUrl ? 'Cambiar' : 'Subir foto'}
              </button>
              <input
                ref={fotoInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleUploadFoto}
              />
            </div>
          </Field>
        </Section>
        )}

        {/* ─── SECCIÓN 4: ITEMS A VERIFICAR ─── */}
        <Section icon={<CheckSquare size={12} />} title={`ÍTEMS A VERIFICAR (${items.length})`}>
          <div className="space-y-2">
            {items.map((it, idx) => (
              <ItemRow
                key={it.tempId}
                index={idx + 1}
                texto={it.texto}
                requerido={it.requerido}
                onChange={(v) => handleItemChange(it.tempId, v)}
                onToggleRequerido={() => handleToggleRequerido(it.tempId)}
                onRemove={() => handleRemoveItem(it.tempId)}
              />
            ))}
          </div>
          <button
            type="button"
            onClick={handleAddItem}
            className="w-full min-h-[44px] inline-flex items-center justify-center gap-2 border border-dashed border-border text-sm text-muted-foreground hover:border-primary/40 hover:text-foreground transition-colors"
            style={{ borderRadius: '0.25rem' }}
          >
            <Plus size={14} />
            Agregar ítem
          </button>
        </Section>

        {error && (
          <div className="text-xs text-primary bg-primary/10 border border-primary/20 px-3 py-2 flex items-start gap-2"
            style={{ borderRadius: '0.25rem' }}>
            <AlertCircle size={12} className="mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}
      </div>
    </Modal>
  )
}

function ItemRow({
  index,
  texto,
  requerido,
  onChange,
  onToggleRequerido,
  onRemove,
}: {
  index: number
  texto: string
  requerido: boolean
  onChange: (v: string) => void
  onToggleRequerido: () => void
  onRemove: () => void
}) {
  return (
    <div className="border border-border bg-background p-2.5"
      style={{ borderRadius: '0.25rem' }}>
      <div className="flex items-center gap-2">
        <span
          className="text-[10px] text-muted-foreground shrink-0 w-6"
          style={{ fontFamily: "'JetBrains Mono', monospace" }}
        >
          {String(index).padStart(2, '0')}
        </span>
        <input
          type="text"
          value={texto}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Ej: Zapatas en buen estado"
          className="flex-1 min-h-[40px] bg-transparent border-none px-2 text-sm focus:outline-none"
        />
        <button
          type="button"
          onClick={onRemove}
          className="min-w-[36px] min-h-[36px] inline-flex items-center justify-center text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
          style={{ borderRadius: '0.25rem' }}
          aria-label="Eliminar ítem"
        >
          <X size={14} />
        </button>
      </div>
      <div className="flex items-center gap-2 mt-1 pt-1 border-t border-border/50">
        <button
          type="button"
          onClick={onToggleRequerido}
          className={[
            'min-h-[32px] inline-flex items-center gap-1.5 px-2 text-xs border transition-colors',
            requerido
              ? 'bg-primary/15 text-primary border-primary/30'
              : 'bg-background text-muted-foreground border-border hover:border-primary/30',
          ].join(' ')}
          style={{ borderRadius: '0.25rem' }}
          aria-pressed={requerido}
        >
          {requerido ? <CheckSquare size={12} /> : <Square size={12} />}
          {requerido ? 'Requerido' : 'Opcional'}
        </button>
      </div>
    </div>
  )
}

function Section({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode
  title: string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-3 border-l-2 border-primary/30 pl-3">
      <div className="flex items-center gap-2 text-muted-foreground">
        {icon}
        <span
          className="text-[10px] tracking-widest"
          style={{ fontFamily: "'JetBrains Mono', monospace" }}
        >
          {title}
        </span>
      </div>
      {children}
    </div>
  )
}

function Field({
  label,
  children,
  help,
}: {
  label: string
  children: React.ReactNode
  help?: string
}) {
  return (
    <label className="block">
      <span
        className="block text-[10px] text-muted-foreground tracking-widest mb-1.5"
        style={{ fontFamily: "'JetBrains Mono', monospace" }}
      >
        {label.toUpperCase()}
      </span>
      {children}
      {help && (
        <span
          className="block text-[10px] text-muted-foreground mt-1"
          style={{ fontFamily: "'JetBrains Mono', monospace" }}
        >
          {help}
        </span>
      )}
    </label>
  )
}
