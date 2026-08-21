/**
 * Modal para ejecutar un checklist.
 *
 * - Carga el detalle de la asignación al abrir.
 * - El comportamiento por item depende del `htmlKind` de la plantilla:
 *   - "escaleras" → 2 botones: OK / NO OK (con observación si NO).
 *     Además permite subir foto de evidencia.
 *   - "epp"       → 3 botones: BUEN ESTADO / MAL ESTADO / NO PRESENTA.
 *     Sin fotos (no aplica). Sin `requerido` (todos son requeridos).
 * - Permite guardado parcial (solo algunos items marcados).
 * - Si marca TODOS los ítems, al hacer click en "Cerrar checklist"
 *   el back calcula el resultado y la asignación pasa a `completado`.
 * - Si la asignación ya estaba completada, muestra vista de solo
 *   lectura con el resultado final.
 *
 * Convención del campo `ok` en EPP:
 *   - `'bueno'`      = BUEN ESTADO
 *   - `'malo'`       = MAL ESTADO (se pide observación)
 *   - `'noPresenta'` = NO PRESENTA
 *   - `undefined`    = no marcado
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { Modal } from '../Modal'
import { useCapturaEvidencia } from '../../hooks/useCapturaEvidencia'
import {
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
  Minus,
} from 'lucide-react'
import { ejecutarChecklist, obtenerAsignacion, subirFoto } from './api'
import { TomarFotoModal } from './TomarFotoModal'
import type { CkAsignacionDetalle } from './types'

/** Marca de un item del checklist. Usamos string en vez de boolean|null
 * para evitar confundir "no marcado" (undefined) con "NO PRESENTA"
 * (string explícito). */
type MarkValue = 'bueno' | 'malo' | 'noPresenta'

type EjecutarChecklistModalProps = {
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
  /** itemId → marca. Usa string en vez de null/boolean para que
   * "NO PRESENTA" sea un valor explícito (no la ausencia de valor)
   * y no se confunda con `undefined` (no marcado). */
  marks: Record<string, MarkValue>
  /** itemId → observación si fue NO OK / MAL ESTADO. */
  obs: Record<string, string>
  /** itemId → key de la foto de evidencia subida (opcional, solo escaleras). */
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
}: EjecutarChecklistModalProps) {
  const [detalle, setDetalle] = useState<CkAsignacionDetalle | null>(null)
  const [draft, setDraft] = useState<Draft>(emptyDraft())
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  const isClosed = detalle?.estado === 'completado' || readOnly
  const htmlKind: 'escaleras' | 'epp' = detalle?.plantilla.htmlKind ?? 'escaleras'
  const isEpp = htmlKind === 'epp'

  // Carga inicial
  useEffect(() => {
    let cancel = false
    setLoading(true)
    setLoadError(null)
    obtenerAsignacion(asignacionId, bodegaId)
      .then((d) => {
        if (cancel) return
        setDetalle(d)
        const marks: Record<string, MarkValue> = {}
        const obs: Record<string, string> = {}
        const fotos: Record<string, string | null> = {}
        for (const it of d.items) {
          // Convertir `boolean | null` del back a MarkValue del front.
          // null = NO PRESENTA → 'noPresenta'.
          // true = bueno → 'bueno'. false = malo → 'malo'.
          // null también puede ser "no marcado aún" (CkEjecucionItem sin
          // fila) — en ese caso NO pre-cargamos el mark y queda undefined.
          // En la práctica el back SIEMPRE devuelve null explícito si
          // fue seteado por el usuario, así que es seguro.
          if (it.ok === true) marks[it.itemId] = 'bueno'
          else if (it.ok === false) marks[it.itemId] = 'malo'
          else if (it.ok === null) marks[it.itemId] = 'noPresenta'
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
  // Las marcas usan string en vez de boolean|null para evitar
  // confundir "no marcado" (undefined) con "NO PRESENTA" ('noPresenta').
  //   - undefined   → no se tocó todavía
  //   - 'bueno'     → BUEN ESTADO
  //   - 'malo'      → MAL ESTADO
  //   - 'noPresenta' → NO PRESENTA
  const totalMarcados = useMemo(
    () =>
      Object.values(draft.marks).filter(
        (v) => v !== undefined,
      ).length,
    [draft.marks],
  )
  const totalItems = detalle?.items.length ?? 0
  const progreso = totalItems > 0 ? Math.round((totalMarcados / totalItems) * 100) : 0
  const puedeCerrar = totalMarcados === totalItems && totalItems > 0

  const setMark = (itemId: string, ok: MarkValue) => {
    setDraft((prev) => ({
      ...prev,
      marks: { ...prev.marks, [itemId]: ok },
      // Si NO es "malo", limpiamos la observación (los items bueno/noPresenta
      // no requieren observación, solo los "malo").
      obs: ok === 'malo' ? prev.obs : { ...prev.obs, [itemId]: '' },
    }))
  }

  const setObs = (itemId: string, value: string) => {
    setDraft((prev) => ({ ...prev, obs: { ...prev.obs, [itemId]: value } }))
  }

  const setFoto = (itemId: string, value: string | null) => {
    setDraft((prev) => ({ ...prev, fotos: { ...prev.fotos, [itemId]: value } }))
  }

  const handleGuardar = async (cerrar: boolean) => {
    if (!detalle) return
    setSaveError(null)

    const items = detalle.items
      .filter((it) => draft.marks[it.itemId] !== undefined)
      .map((it) => {
        const mark = draft.marks[it.itemId] as MarkValue
        // Convertir MarkValue → boolean|null del back.
        // 'bueno' → true, 'malo' → false, 'noPresenta' → null.
        const okValue: boolean | null =
          mark === 'bueno' ? true : mark === 'malo' ? false : null
        return {
          itemId: it.itemId,
          ok: okValue,
          observacion: draft.obs[it.itemId]?.trim() || undefined,
          fotoKey: draft.fotos[it.itemId] ?? null,
        }
      })

    if (items.length === 0) {
      setSaveError('Marca al menos un ítem antes de guardar.')
      return
    }

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
      await onChanged()
    } catch (e) {
      setSaveError((e as Error).message ?? 'No se pudo guardar.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={
        detalle?.plantilla?.nombre
          ? `Ejecutar checklist · ${detalle.plantilla.nombre}`
          : 'Ejecutar checklist'
      }
      size="lg"
      contentClassName="max-h-[90dvh] sm:max-h-[90dvh] flex flex-col"
      footer={
        detalle && !loadError ? (
          <Footer
            isClosed={isClosed}
            puedeCerrar={puedeCerrar}
            saving={saving}
            isEpp={isEpp}
            onClose={onClose}
            onGuardarParcial={() => handleGuardar(false)}
            onCerrar={() => handleGuardar(true)}
          />
        ) : null
      }
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
            readOnly={readOnly}
            isEpp={isEpp}
          />

          <div className="px-5 py-4 space-y-2">
            {detalle.items.map((it, idx) => (
              <ItemRow
                key={it.itemId}
                index={idx + 1}
                texto={it.texto}
                requerido={it.requerido}
                ok={draft.marks[it.itemId]}
                observacion={draft.obs[it.itemId] ?? ''}
                fotoKey={!isEpp ? (draft.fotos[it.itemId] ?? it.fotoKey ?? null) : null}
                disabled={isClosed}
                bodegaId={bodegaId}
                isEpp={isEpp}
                onSetMark={(v) => setMark(it.itemId, v)}
                onSetObs={(v) => setObs(it.itemId, v)}
                onSetFoto={(key) => setFoto(it.itemId, key)}
                onClearFoto={() => setFoto(it.itemId, null)}
              />
            ))}

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
        </>
      )}
    </Modal>
  )
}

// ─────────── sub-componentes ───────────

function Header({
  detalle,
  progreso,
  totalMarcados,
  readOnly,
  isEpp,
}: {
  detalle: CkAsignacionDetalle
  progreso: number
  totalMarcados: number
  readOnly: boolean
  isEpp: boolean
}) {
  const isClosed = detalle.estado === 'completado'
  return (
    <div className="px-5 py-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            {(isClosed || readOnly) && (
              <Lock size={12} className="text-muted-foreground shrink-0" />
            )}
            <h3
              className="text-base uppercase text-foreground truncate"
              style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800 }}
            >
              {detalle.plantilla.nombre}
            </h3>
            <span
              className="px-1.5 py-0.5 text-[9px] border bg-muted text-muted-foreground border-border shrink-0"
              style={{ borderRadius: '0.25rem', fontFamily: "'JetBrains Mono', monospace" }}
            >
              {isEpp ? 'EPP' : 'ESCALERAS'}
            </span>
          </div>
          <div className="text-[11px] text-muted-foreground flex items-center gap-3 flex-wrap">
            <span>Técnico: <span className="text-foreground">{detalle.tecnico.nombre}</span></span>
            <span>Límite: <span className="text-foreground">{new Date(detalle.fechaLimite).toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' })}</span></span>
            {isClosed && detalle.resultado && (
              <ResultadoBadge resultado={detalle.resultado} />
            )}
          </div>
        </div>
      </div>

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
  isEpp,
  onSetMark,
  onSetObs,
  onSetFoto,
  onClearFoto,
}: {
  index: number
  texto: string
  requerido: boolean
  ok: MarkValue
  observacion: string
  fotoKey: string | null
  disabled: boolean
  bodegaId: string
  isEpp: boolean
  onSetMark: (v: MarkValue) => void
  onSetObs: (v: string) => void
  onSetFoto: (key: string) => void
  onClearFoto: () => void
}) {
  const evidencia = useCapturaEvidencia()
  const [showCamera, setShowCamera] = useState(false)
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

  // Colores del border según estado
  const colorClass =
    ok === 'bueno'
      ? 'border-secondary/30 bg-secondary/5'
      : ok === 'malo'
        ? 'border-primary/30 bg-primary/5'
        : ok === 'noPresenta'
          ? 'border-border bg-muted/30'
          : 'border-border bg-background'

  return (
    <div
      className={['rounded-md border p-3 transition-colors', colorClass].join(' ')}
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

          {/* Observación si fue MAL ESTADO */}
          {ok === 'malo' && !disabled && (
            <input
              type="text"
              value={observacion}
              onChange={(e) => onSetObs(e.target.value)}
              placeholder={isEpp ? 'Detalle del daño o problema…' : 'Describe la incidencia…'}
              className="mt-2 w-full bg-background border border-border px-2 py-1 text-xs focus:border-primary/50 outline-none"
              style={{ borderRadius: '0.25rem' }}
            />
          )}
          {ok === 'malo' && disabled && observacion && (
            <p className="mt-1 text-xs text-muted-foreground italic">
              "{observacion}"
            </p>
          )}

          {/* Botones de foto y preview (solo para ESCALERAS, no EPP) */}
          {!disabled && !isEpp && ok !== 'noPresenta' && (
            <div className="mt-2 flex items-center gap-2 flex-wrap">
              {evidencia.puedeSubir && <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="inline-flex items-center gap-1 px-2 py-1 text-[10px] border border-border hover:border-primary/40 disabled:opacity-50"
                style={{ borderRadius: '0.25rem' }}
                title="Elegir una imagen del dispositivo"
              >
                <Upload size={11} /> Subir foto
              </button>}
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
          {!isEpp && disabled && fotoKey && (
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

        {/* Botones de marcado: 2 para escaleras, 3 para EPP */}
        {!disabled && (
          <div className="flex items-center gap-1 shrink-0">
            {isEpp ? (
              <>
                {/* BUEN ESTADO (verde) */}
                <button
                  onClick={() => onSetMark('bueno')}
                  className={[
                    'inline-flex items-center justify-center w-8 h-8 border transition-colors',
                    ok === 'bueno'
                      ? 'bg-secondary/20 text-secondary border-secondary/40'
                      : 'bg-background text-muted-foreground border-border hover:border-secondary/40',
                  ].join(' ')}
                  style={{ borderRadius: '0.25rem' }}
                  title="BUEN ESTADO"
                >
                  <Check size={14} />
                </button>
                {/* MAL ESTADO (rojo) */}
                <button
                  onClick={() => onSetMark('malo')}
                  className={[
                    'inline-flex items-center justify-center w-8 h-8 border transition-colors',
                    ok === 'malo'
                      ? 'bg-primary/20 text-primary border-primary/40'
                      : 'bg-background text-muted-foreground border-border hover:border-primary/40',
                  ].join(' ')}
                  style={{ borderRadius: '0.25rem' }}
                  title="MAL ESTADO"
                >
                  <XCircle size={14} />
                </button>
                {/* NO PRESENTA (gris) */}
                <button
                  onClick={() => onSetMark('noPresenta')}
                  className={[
                    'inline-flex items-center justify-center w-8 h-8 border transition-colors',
                    ok === 'noPresenta'
                      ? 'bg-muted text-muted-foreground border-muted-foreground/40'
                      : 'bg-background text-muted-foreground border-border hover:border-foreground/30',
                  ].join(' ')}
                  style={{ borderRadius: '0.25rem' }}
                  title="NO PRESENTA"
                >
                  <Minus size={14} />
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => onSetMark('bueno')}
                  className={[
                    'inline-flex items-center justify-center w-8 h-8 border transition-colors',
                    ok === 'bueno'
                      ? 'bg-secondary/20 text-secondary border-secondary/40'
                      : 'bg-background text-muted-foreground border-border hover:border-secondary/40',
                  ].join(' ')}
                  style={{ borderRadius: '0.25rem' }}
                  title="OK"
                >
                  <Check size={14} />
                </button>
                <button
                  onClick={() => onSetMark('malo')}
                  className={[
                    'inline-flex items-center justify-center w-8 h-8 border transition-colors',
                    ok === 'malo'
                      ? 'bg-primary/20 text-primary border-primary/40'
                      : 'bg-background text-muted-foreground border-border hover:border-primary/40',
                  ].join(' ')}
                  style={{ borderRadius: '0.25rem' }}
                  title="No OK"
                >
                  <XCircle size={14} />
                </button>
              </>
            )}
          </div>
        )}
      </div>

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
  isEpp,
  onClose,
  onGuardarParcial,
  onCerrar,
}: {
  isClosed: boolean
  puedeCerrar: boolean
  saving: boolean
  isEpp: boolean
  onClose: () => void
  onGuardarParcial: () => void
  onCerrar: () => void
}) {
  if (isClosed) {
    return (
      <div className="flex items-center justify-end">
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
    <div className="flex items-center justify-between gap-2">
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
          {isEpp ? 'Cerrar inspección' : 'Cerrar checklist'}
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
