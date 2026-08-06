/**
 * Modal para ejecutar un checklist (wizard de marcado de ítems).
 *
 * - Carga el detalle de la asignación al abrir.
 * - Por cada ítem muestra: texto + toggle OK / NO OK + campo de
 *   observación (solo si NO OK).
 * - Permite guardado parcial (solo algunos ítems marcados).
 * - Si marca TODOS los ítems, al hacer click en "Cerrar checklist"
 *   el back calcula el resultado y la asignación pasa a `completado`.
 * - Si la asignación ya estaba completada, muestra vista de solo
 *   lectura con el resultado final.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { Modal } from './Modal'
import {
  X,
  Check,
  XCircle,
  AlertCircle,
  Loader2,
  Save,
  Play,
  Lock,
  Upload,
  Camera,
  Image as ImageIcon,
} from 'lucide-react'
import { ejecutarChecklist, obtenerAsignacion, subirFoto } from './api'
import { TomarFotoModal } from './TomarFotoModal'
import type { CkAsignacionDetalle } from './types'

type Props = {
  /** ID de la asignación a abrir. */
  asignacionId: string
  /** Bodega activa (para que el back autorice). */
  bodegaId: string
  /** Cerrar el modal. */
  onClose: () => void
  /** Notificar al padre para que recargue programados/historial. */
  onChanged: () => Promise<void> | void
  /**
   * Si es true, el modal abre en modo solo lectura: no muestra los
   * botones OK/NO OK, ni "Guardar parcial" ni "Cerrar checklist".
   * Se usa cuando el user abre un checklist de otro día desde la
   * lista de Programados (no puede ejecutarlo, solo consultarlo).
   */
  readOnly?: boolean
}

type Draft = {
  /** itemId → ok (true/false) o null si no marcado. */
  marks: Record<string, boolean | null>
  /** itemId → observación si fue NO OK. */
  obs: Record<string, string>
  /** itemId → key de la foto de evidencia subida (opcional). */
  fotos: Record<string, string | null>
  /** Observación general opcional al cerrar. */
  obsGeneral: string
}

function emptyDraft(): Draft {
  return { marks: {}, obs: {}, fotos: {}, obsGeneral: '' }
}

export function EjecutarChecklistModal({
  asignacionId,
  bodegaId,
  onClose,
  onChanged,
  readOnly = false,
}: Props) {
  const [detalle, setDetalle] = useState<CkAsignacionDetalle | null>(null)
  const [draft, setDraft] = useState<Draft>(emptyDraft())
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  const isClosed = detalle?.estado === 'completado' || readOnly

  // Carga inicial
  useEffect(() => {
    let cancel = false
    setLoading(true)
    setLoadError(null)
    obtenerAsignacion(asignacionId, bodegaId)
      .then((d) => {
        if (cancel) return
        setDetalle(d)
        // Pre-rellenar el draft con lo que ya estuviera marcado
        // (caso "guardado parcial" anterior).
        const marks: Record<string, boolean | null> = {}
        const obs: Record<string, string> = {}
        const fotos: Record<string, string | null> = {}
        for (const it of d.items) {
          marks[it.itemId] = it.ok
          if (it.observacion) obs[it.itemId] = it.observacion
          if (it.fotoKey) fotos[it.itemId] = it.fotoKey
        }
        setDraft({
          marks,
          obs,
          fotos,
          obsGeneral: d.observacion ?? '',
        })
      })
      .catch((e) => {
        if (cancel) return
        setLoadError((e as Error).message ?? 'No se pudo cargar la asignación.')
      })
      .finally(() => {
        if (!cancel) setLoading(false)
      })
    return () => {
      cancel = true
    }
  }, [asignacionId, bodegaId])

  // Métricas derivadas
  const totalMarcados = useMemo(
    () => Object.values(draft.marks).filter((v) => v !== null && v !== undefined).length,
    [draft.marks],
  )
  const totalItems = detalle?.items.length ?? 0
  const progreso = totalItems > 0 ? Math.round((totalMarcados / totalItems) * 100) : 0
  const puedeCerrar = totalMarcados === totalItems && totalItems > 0

  const setMark = (itemId: string, ok: boolean) => {
    setDraft((prev) => ({
      ...prev,
      marks: { ...prev.marks, [itemId]: ok },
      // Si vuelve a OK, limpiamos la observación.
      obs: ok ? { ...prev.obs, [itemId]: '' } : prev.obs,
    }))
  }

  const setObs = (itemId: string, value: string) => {
    setDraft((prev) => ({ ...prev, obs: { ...prev.obs, [itemId]: value } }))
  }

  /**
   * Setea la key de la foto de un ítem. Se llama desde los handlers
   * de "Subir foto" / "Tomar foto" del ItemRow, después de subir
   * el blob al storage. Si `value` es `null`, la limpiamos.
   */
  const setFoto = (itemId: string, value: string | null) => {
    setDraft((prev) => ({ ...prev, fotos: { ...prev.fotos, [itemId]: value } }))
  }

  const handleGuardar = async (cerrar: boolean) => {
    if (!detalle) return
    setSaveError(null)

    // Armamos el payload solo con los ítems que tienen marca.
    const items = detalle.items
      .filter((it) => draft.marks[it.itemId] !== null && draft.marks[it.itemId] !== undefined)
      .map((it) => ({
        itemId: it.itemId,
        ok: draft.marks[it.itemId] as boolean,
        observacion: draft.obs[it.itemId]?.trim() || undefined,
        // Si el user subió una foto en este ítem, la mandamos. Si la
        // tenía del server y NO la cambió, también la mandamos (el back
        // hace upsert). Si la limpió, mandamos null.
        fotoKey: draft.fotos[it.itemId] ?? null,
      }))

    if (items.length === 0) {
      setSaveError('Marca al menos un ítem antes de guardar.')
      return
    }

    // Si quiere cerrar, todos los ítems deben estar marcados.
    if (cerrar && !puedeCerrar) {
      setSaveError('Para cerrar el checklist, marca todos los ítems.')
      return
    }

    setSaving(true)
    try {
      const actualizado = await ejecutarChecklist(
        asignacionId,
        {
          items,
          observacionGeneral: draft.obsGeneral.trim() || undefined,
        },
        bodegaId,
      )
      setDetalle(actualizado)
      // Si cerró, no seguimos permitiendo editar.
      await onChanged()
    } catch (e) {
      setSaveError((e as Error).message ?? 'No se pudo guardar.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal zIndex={100} full>
      <div
        className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-2xl flex flex-col"
        style={{ borderRadius: '0.5rem' }}
      >
        {loading ? (
          <ModalLoading />
        ) : loadError ? (
          <ModalError message={loadError} onClose={onClose} />
        ) : !detalle ? (
          <ModalError message="Sin datos." onClose={onClose} />
        ) : (
          <>
            <Header
              detalle={detalle}
              progreso={progreso}
              totalMarcados={totalMarcados}
              onClose={onClose}
              readOnly={readOnly}
            />

            {/* Lista de ítems */}
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-2">
              {detalle.items.map((it, idx) => (
                <ItemRow
                  key={it.itemId}
                  index={idx + 1}
                  texto={it.texto}
                  requerido={it.requerido}
                  ok={draft.marks[it.itemId] ?? null}
                  observacion={draft.obs[it.itemId] ?? ''}
                  fotoKey={draft.fotos[it.itemId] ?? it.fotoKey ?? null}
                  disabled={isClosed}
                  bodegaId={bodegaId}
                  onSetMark={(v) => setMark(it.itemId, v)}
                  onSetObs={(v) => setObs(it.itemId, v)}
                  onSetFoto={(key) => setFoto(it.itemId, key)}
                  onClearFoto={() => setFoto(it.itemId, null)}
                />
              ))}

              {/* Observación general (solo si NO está cerrado) */}
              {!isClosed && (
                <div className="pt-2 border-t border-border/40">
                  <label className="block">
                    <span
                      className="block text-[10px] text-muted-foreground tracking-widest mb-1"
                      style={{ fontFamily: "'JetBrains Mono', monospace" }}
                    >
                      OBSERVACIÓN GENERAL (OPCIONAL)
                    </span>
                    <textarea
                      value={draft.obsGeneral}
                      onChange={(e) =>
                        setDraft((prev) => ({ ...prev, obsGeneral: e.target.value }))
                      }
                      rows={2}
                      placeholder="Notas sobre la ejecución, contexto, advertencias…"
                      className="w-full bg-background border border-border px-3 py-1.5 text-sm focus:border-primary/50 outline-none resize-none"
                      style={{ borderRadius: '0.25rem' }}
                    />
                  </label>
                </div>
              )}

              {saveError && (
                <div className="flex items-center gap-2 text-xs text-primary bg-primary/10 border border-primary/20 px-3 py-2"
                  style={{ borderRadius: '0.25rem' }}>
                  <AlertCircle size={12} /> {saveError}
                </div>
              )}
            </div>

            {/* Footer con acciones */}
            <Footer
              isClosed={isClosed}
              puedeCerrar={puedeCerrar}
              saving={saving}
              onClose={onClose}
              onGuardarParcial={() => handleGuardar(false)}
              onCerrar={() => handleGuardar(true)}
            />
          </>
        )}
      </div>
    </Modal>
  )
}

// ─────────── sub-componentes ───────────

function Header({
  detalle,
  progreso,
  totalMarcados,
  onClose,
  readOnly,
}: {
  detalle: CkAsignacionDetalle
  progreso: number
  totalMarcados: number
  onClose: () => void
  readOnly: boolean
}) {
  const isClosed = detalle.estado === 'completado'
  return (
    <div className="px-5 py-4 border-b border-border">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1">
            {(isClosed || readOnly) && (
              <Lock size={12} className="text-muted-foreground shrink-0" />
            )}
            <h3
              className="text-base uppercase text-foreground truncate"
              style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800 }}
            >
              {detalle.plantilla.nombre}
            </h3>
          </div>
          <div className="text-[11px] text-muted-foreground flex items-center gap-3 flex-wrap">
            <span>Técnico: <span className="text-foreground">{detalle.tecnico.nombre}</span></span>
            <span>Límite: <span className="text-foreground">{new Date(detalle.fechaLimite).toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' })}</span></span>
            {isClosed && detalle.resultado && (
              <ResultadoBadge resultado={detalle.resultado} />
            )}
          </div>
        </div>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground shrink-0">
          <X size={16} />
        </button>
      </div>

      {/* Barra de progreso */}
      <div className="mt-3 flex items-center gap-3">
        <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
          <div
            className="h-full rounded-full transition-all"
            style={{
              width: `${progreso}%`,
              background: isClosed ? '#ABF768' : progreso === 100 ? '#ABF768' : '#facc15',
            }}
          />
        </div>
        <span
          className="text-[10px] text-muted-foreground shrink-0"
          style={{ fontFamily: "'JetBrains Mono', monospace" }}
        >
          {totalMarcados}/{detalle.items.length} ({progreso}%)
        </span>
      </div>
    </div>
  )
}

function ItemRow({
  index,
  texto,
  requerido,
  ok,
  observacion,
  fotoKey,
  disabled,
  bodegaId,
  onSetMark,
  onSetObs,
  onSetFoto,
  onClearFoto,
}: {
  index: number
  texto: string
  requerido: boolean
  ok: boolean | null
  observacion: string
  fotoKey: string | null
  disabled: boolean
  bodegaId: string
  onSetMark: (v: boolean) => void
  onSetObs: (v: string) => void
  onSetFoto: (key: string) => void
  onClearFoto: () => void
}) {
  // Estado local: ¿está abierto el modal de "Tomar foto" para este ítem?
  const [showCamera, setShowCamera] = useState(false)
  // Estado local: ¿está subiendo? (muestra spinner en el botón de "Subir")
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleSubirFoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return
    setUploading(true)
    try {
      const res = await subirFoto(f, bodegaId, f.name)
      onSetFoto(res.key)
    } catch (err) {
      alert(`No se pudo subir la foto: ${(err as Error).message}`)
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleTomarFoto = async (blob: Blob) => {
    setUploading(true)
    try {
      const res = await subirFoto(blob, bodegaId, `webcam-${Date.now()}.jpg`)
      onSetFoto(res.key)
    } catch (err) {
      alert(`No se pudo subir la foto: ${(err as Error).message}`)
    } finally {
      setUploading(false)
      setShowCamera(false)
    }
  }

  return (
    <div
      className={[
        'rounded-md border p-3 transition-colors',
        ok === true
          ? 'border-secondary/30 bg-secondary/5'
          : ok === false
            ? 'border-primary/30 bg-primary/5'
            : 'border-border bg-background',
      ].join(' ')}
      style={{ borderRadius: '0.25rem' }}
    >
      <div className="flex items-start gap-3">
        <span
          className="text-[10px] text-muted-foreground mt-0.5 shrink-0"
          style={{ fontFamily: "'JetBrains Mono', monospace" }}
        >
          {String(index).padStart(2, '0')}
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm text-foreground">{texto}</span>
            {requerido && (
              <span
                className="px-1.5 py-0.5 text-[9px] border bg-primary/10 text-primary border-primary/20"
                style={{ borderRadius: '0.25rem', fontFamily: "'JetBrains Mono', monospace" }}
              >
                REQUERIDO
              </span>
            )}
          </div>

          {/* Campo de observación si fue NO OK */}
          {ok === false && !disabled && (
            <input
              type="text"
              value={observacion}
              onChange={(e) => onSetObs(e.target.value)}
              placeholder="Describe la incidencia…"
              className="mt-2 w-full bg-background border border-border px-2 py-1 text-xs focus:border-primary/50 outline-none"
              style={{ borderRadius: '0.25rem' }}
            />
          )}
          {ok === false && disabled && observacion && (
            <p className="mt-1 text-xs text-muted-foreground italic">
              "{observacion}"
            </p>
          )}

          {/* Botones de foto y preview (solo si NO está disabled y el ítem
              está marcado) */}
          {!disabled && ok !== null && (
            <div className="mt-2 flex items-center gap-2 flex-wrap">
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="inline-flex items-center gap-1 px-2 py-1 text-[10px] border border-border hover:border-primary/40 disabled:opacity-50"
                style={{ borderRadius: '0.25rem' }}
                title="Elegir una imagen del dispositivo"
              >
                <Upload size={11} /> Subir foto
              </button>
              <button
                onClick={() => setShowCamera(true)}
                disabled={uploading}
                className="inline-flex items-center gap-1 px-2 py-1 text-[10px] border border-border hover:border-primary/40 disabled:opacity-50"
                style={{ borderRadius: '0.25rem' }}
                title="Tomar foto con la cámara"
              >
                <Camera size={11} /> Tomar foto
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleSubirFoto}
              />
              {uploading && (
                <span className="text-[10px] text-muted-foreground"
                  style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                  Subiendo…
                </span>
              )}
              {fotoKey && (
                <div className="flex items-center gap-2">
                  <span
                    className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] bg-secondary/15 text-secondary border border-secondary/20"
                    style={{ borderRadius: '0.25rem', fontFamily: "'JetBrains Mono', monospace" }}
                  >
                    <ImageIcon size={10} /> foto OK
                  </span>
                  <button
                    onClick={onClearFoto}
                    className="text-[10px] text-muted-foreground hover:text-foreground"
                    title="Quitar la foto"
                  >
                    <XCircle size={11} />
                  </button>
                </div>
              )}
            </div>
          )}
          {disabled && fotoKey && (
            <div className="mt-2 flex items-center gap-2">
              <span
                className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] bg-secondary/15 text-secondary border border-secondary/20"
                style={{ borderRadius: '0.25rem', fontFamily: "'JetBrains Mono', monospace" }}
              >
                <ImageIcon size={10} /> foto adjunta
              </span>
            </div>
          )}
        </div>

        {/* Botones OK / NO OK */}
        {!disabled && (
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={() => onSetMark(true)}
              className={[
                'inline-flex items-center justify-center w-8 h-8 border transition-colors',
                ok === true
                  ? 'bg-secondary/20 text-secondary border-secondary/40'
                  : 'bg-background text-muted-foreground border-border hover:border-secondary/40',
              ].join(' ')}
              style={{ borderRadius: '0.25rem' }}
              title="OK"
            >
              <Check size={14} />
            </button>
            <button
              onClick={() => onSetMark(false)}
              className={[
                'inline-flex items-center justify-center w-8 h-8 border transition-colors',
                ok === false
                  ? 'bg-primary/20 text-primary border-primary/40'
                  : 'bg-background text-muted-foreground border-border hover:border-primary/40',
              ].join(' ')}
              style={{ borderRadius: '0.25rem' }}
              title="No OK"
            >
              <XCircle size={14} />
            </button>
          </div>
        )}
      </div>

      {/* Modal de cámara en vivo (solo si está abierto) */}
      {showCamera && (
        <TomarFotoModal
          label={`— ${texto.slice(0, 40)}${texto.length > 40 ? '…' : ''}`}
          onClose={() => setShowCamera(false)}
          onCapture={handleTomarFoto}
        />
      )}
    </div>
  )
}

function Footer({
  isClosed,
  puedeCerrar,
  saving,
  onClose,
  onGuardarParcial,
  onCerrar,
}: {
  isClosed: boolean
  puedeCerrar: boolean
  saving: boolean
  onClose: () => void
  onGuardarParcial: () => void
  onCerrar: () => void
}) {
  if (isClosed) {
    return (
      <div className="px-5 py-3 border-t border-border flex items-center justify-end">
        <button
          onClick={onClose}
          className="px-3 py-1.5 text-xs border border-border hover:border-primary/40"
          style={{ borderRadius: '0.25rem' }}
        >
          Cerrar
        </button>
      </div>
    )
  }

  return (
    <div className="px-5 py-3 border-t border-border flex items-center justify-between gap-2">
      <span
        className="text-[10px] text-muted-foreground"
        style={{ fontFamily: "'JetBrains Mono', monospace" }}
      >
        {puedeCerrar ? 'Todos los ítems marcados. Podés cerrar.' : 'Marcado parcial permitido.'}
      </span>
      <div className="flex items-center gap-2">
        <button
          onClick={onClose}
          disabled={saving}
          className="px-3 py-1.5 text-xs border border-border hover:border-primary/40 disabled:opacity-50"
          style={{ borderRadius: '0.25rem' }}
        >
          Cancelar
        </button>
        <button
          onClick={onGuardarParcial}
          disabled={saving}
          className="inline-flex items-center gap-1 px-3 py-1.5 text-xs border border-border hover:border-primary/40 disabled:opacity-50"
          style={{ borderRadius: '0.25rem' }}
        >
          <Save size={12} /> {saving ? 'Guardando…' : 'Guardar parcial'}
        </button>
        <button
          onClick={onCerrar}
          disabled={!puedeCerrar || saving}
          className="inline-flex items-center gap-1 px-3 py-1.5 text-xs bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50"
          style={{ borderRadius: '0.25rem' }}
        >
          {saving ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} />}
          Cerrar checklist
        </button>
      </div>
    </div>
  )
}

function ResultadoBadge({
  resultado,
}: {
  resultado: 'aprobado' | 'observaciones' | 'rechazado'
}) {
  const map = {
    aprobado: 'bg-secondary/15 text-secondary border-secondary/20',
    observaciones: 'bg-yellow-400/15 text-yellow-400 border-yellow-400/20',
    rechazado: 'bg-primary/15 text-primary border-primary/20',
  } as const
  const label = {
    aprobado: 'APROBADO',
    observaciones: 'CON OBSERVACIONES',
    rechazado: 'RECHAZADO',
  }[resultado]
  return (
    <span
      className={`px-2 py-0.5 text-[10px] border ${map[resultado]}`}
      style={{ borderRadius: '0.25rem', fontFamily: "'JetBrains Mono', monospace" }}
    >
      {label}
    </span>
  )
}

function ModalLoading() {
  return (
    <div className="flex items-center justify-center p-12 text-muted-foreground text-sm gap-2">
      <Loader2 size={14} className="animate-spin" />
      Cargando asignación…
    </div>
  )
}

function ModalError({ message, onClose }: { message: string; onClose: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center p-10 gap-3">
      <AlertCircle size={28} className="text-primary" />
      <p className="text-sm text-muted-foreground text-center max-w-sm">{message}</p>
      <button
        onClick={onClose}
        className="px-3 py-1.5 text-xs border border-border hover:border-primary/40"
        style={{ borderRadius: '0.25rem' }}
      >
        Cerrar
      </button>
    </div>
  )
}
