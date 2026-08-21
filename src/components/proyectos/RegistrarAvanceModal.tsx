/**
 * Modal para registrar un avance en el proyecto.
 *
 * Campos:
 *  - Fecha del avance (default: hoy)
 *  - Técnico que reporta (default: el user actual; si el user no es
 *    técnico del proyecto, lo bloqueamos)
 *  - Km avanzados en este día (> 0)
 *  - Descripción (obligatoria, máx 2000 chars)
 *  - Fotos (upload múltiple, max 20)
 *
 * Flujo de subida de fotos:
 *  1. User selecciona N archivos
 *  2. Por cada uno, subimos a `/uploads?seccion=proyectos&bodegaId=...`
 *     y guardamos el `key` retornado
 *  3. Cuando hace submit, mandamos el array de `key` al back
 */
import { useEffect, useMemo, useState } from 'react'
import {
  AlertCircle,
  Camera,
  Loader2,
  X,
} from 'lucide-react'
import { Modal } from '../Modal'
import { useBodegaActiva } from '../../store/bodegaActiva'
import { useAuth } from '../../store/auth'
import { crearAvance, subirFotoAvance, listarAvances } from './api'
import type { AvanceFoto } from './types'

type Props = {
  open: boolean
  proyectoId: string
  /** Técnicos asignados al proyecto (para popular el select). */
  tecnicosAsignados: Array<{ tecnicoId: string; tecnico: { id: string; nombre: string } }>
  /**
   * Nodos del recorrido (estudio previo). Si se elige uno, el back
   * puede usar el `kmAcumulado` del nodo como `kmAvanzadosEnEstaFecha`
   * automáticamente.
   */
  nodos: Array<{
    id: string
    nombre: string | null
    tipo: 'inicio' | 'intermedio' | 'fin'
    orden: number
    kmAcumulado: number
  }>
  /**
   * ID sugerido al abrir el modal (típicamente el del user actual
   * o el del encargado del proyecto). Se usa como default si el
   * técnico está en la lista; si no, queda el primero de la lista.
   */
  tecnicoSugeridoId: string | null
  /**
   * Si viene, el modal se abre con un nodo y un km ya fijados.
   * El usuario NO puede editar el nodo ni el km (el modal se vuelve
   * de "confirmación" del avance del nodo seleccionado). Caso típico:
   * se clickea "Subir avance" en un nodo de la tab Mapa y se abre
   * este modal ya con todo precargado.
   */
  nodoFijo?: { nodoId: string; kmAcumulado: number } | null
  onClose: () => void
  onCreated: () => void
}

type FotoSubiendo = {
  id: string
  file: File
  preview: string
  status: 'subiendo' | 'listo' | 'error'
  key?: string
  /** URL pública del archivo (`/uploads/{key}`) que devuelve el
   * back. Se manda en el payload del avance para que el front
   * pueda mostrarla sin tener que reconstruirla. */
  url?: string
  error?: string
}

export function RegistrarAvanceModal({
  open,
  proyectoId,
  tecnicosAsignados,
  nodos,
  tecnicoSugeridoId,
  nodoFijo,
  onClose,
  onCreated,
}: Props) {
  const auth = useAuth()
  const bodegaId = useBodegaActiva()
  const userId = auth.status === 'autenticado' ? auth.sesion.usuario.id : null

  const [fechaAvance, setFechaAvance] = useState(() =>
    new Date().toISOString().slice(0, 10),
  )
  // El técnico que reporta es SIEMPRE el user con la sesión activa.
  // No se elige en el form (decisión de UX: el avance queda a
  // nombre del que lo carga). El back igual recibe el id por
  // consistencia y para soportar la lógica de permisos.
  const tecnicoId = userId ?? ''
  // Si viene `nodoFijo` (modal abierto desde la tab Mapa con un
  // nodo seleccionado), arrancamos con ese nodo y km fijos. Si no,
  // arrancamos vacíos para que el user elija en el select.
  const [nodoId, setNodoId] = useState(nodoFijo?.nodoId ?? '')
  const [km, setKm] = useState(
    nodoFijo ? nodoFijo.kmAcumulado.toFixed(3) : '',
  )
  const [descripcion, setDescripcion] = useState('')
  const [fotos, setFotos] = useState<FotoSubiendo[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  // Reset al cerrar
  useEffect(() => {
    if (!open) {
      setFechaAvance(new Date().toISOString().slice(0, 10))
      setKm('')
      setDescripcion('')
      setFotos([])
      setErrorMsg(null)
    }
  }, [open])

  // Validaciones
  const errores = useMemo<string[]>(() => {
    const e: string[] = []
    if (!fechaAvance) e.push('La fecha es obligatoria.')
    const kmNum = Number(km)
    if (!km || isNaN(kmNum) || kmNum <= 0) e.push('Los km deben ser mayores a 0.')
    if (!descripcion.trim()) e.push('La descripción es obligatoria.')
    if (!tecnicoId) e.push('Necesitás estar autenticado para registrar un avance.')
    if (!bodegaId) e.push('Selecciona una bodega activa.')
    return e
  }, [fechaAvance, km, descripcion, tecnicoId, bodegaId])

  const fotosListas = fotos.filter((f) => f.status === 'listo' && f.key)
  const puedeSubmit = errores.length === 0 && fotosListas.length === fotos.length && !submitting

  // Subir fotos automáticamente cuando se agregan
  useEffect(() => {
    if (!open || !bodegaId) return
    const pendientes = fotos.filter((f) => f.status === 'subiendo')
    if (pendientes.length === 0) return
    pendientes.forEach((f) => {
      void subirFotoAvance(f.file, bodegaId)
        .then((res) => {
          setFotos((prev) =>
            prev.map((x) =>
              x.id === f.id
                ? { ...x, status: 'listo', key: res.key, url: res.url }
                : x,
            ),
          )
        })
        .catch((err) => {
          const msg = err instanceof Error ? err.message : 'Error al subir'
          setFotos((prev) =>
            prev.map((x) =>
              x.id === f.id ? { ...x, status: 'error', error: msg } : x,
            ),
          )
        })
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fotos.length])

  function handleAddFiles(files: FileList | null) {
    if (!files || files.length === 0) return
    const nuevos: FotoSubiendo[] = Array.from(files).map((file) => ({
      id: `${Date.now()}-${Math.random()}`,
      file,
      preview: URL.createObjectURL(file),
      status: 'subiendo',
    }))
    setFotos((prev) => [...prev, ...nuevos].slice(0, 20))
  }

  function handleRemoveFoto(id: string) {
    setFotos((prev) => {
      const target = prev.find((f) => f.id === id)
      if (target) URL.revokeObjectURL(target.preview)
      return prev.filter((f) => f.id !== id)
    })
  }

  async function handleSubmit() {
    if (!puedeSubmit) return
    setSubmitting(true)
    setErrorMsg(null)
    try {
      const fotosInput: AvanceFoto[] = fotosListas.map((f, i) => ({
        key: f.key!,
        // url es la URL pública del archivo (`/uploads/{key}`).
        // NO usar f.preview (es un blob:http://... que solo vive
        // en la sesión del browser; el back lo guardaría tal cual
        // y después el front no podría cargarlo).
        url: f.url,
        mimeType: f.file.type,
        sizeBytes: f.file.size,
        orden: i,
      }))
      await crearAvance(proyectoId, {
        fechaAvance: new Date(fechaAvance).toISOString(),
        tecnicoId: tecnicoId || undefined,
        kmAvanzadosEnEstaFecha: Number(km),
        descripcion: descripcion.trim(),
        nodoId: nodoId || undefined,
        fotos: fotosInput.length > 0 ? fotosInput : undefined,
      })
      // Refrescar para que aparezca en la lista
      void listarAvances({ proyectoId, page: 1, pageSize: 50 }).catch(() => undefined)
      onCreated()
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'No se pudo registrar el avance.'
      setErrorMsg(msg)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Registrar avance"
      description="Reportá el trabajo del día. Las fotos se suben al guardar."
      icon={<Camera size={18} />}
      size="xl"
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
            Guardar avance
          </button>
        </div>
      }
    >
      <div className="p-5 sm:p-6 space-y-4">
          {errores.length > 0 && (
            <div className="border border-destructive/30 bg-destructive/5 p-3 space-y-1">
              {errores.map((e: string, i: number) => (
                <div key={i} className="flex items-start gap-2 text-xs text-destructive">
                  <AlertCircle size={12} className="mt-0.5 shrink-0" />
                  <span>{e}</span>
                </div>
              ))}
            </div>
          )}
          {errorMsg && (
            <div className="border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">
              {errorMsg}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-foreground mb-1">
                Fecha del avance <span className="text-destructive">*</span>
              </label>
              <input
                type="date"
                value={fechaAvance}
                onChange={(e) => setFechaAvance(e.target.value)}
                className="w-full px-3 py-2 bg-background border border-border text-sm focus:outline-none focus:border-foreground/40"
                style={{ borderRadius: '0.25rem' }}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-foreground mb-1">
                Km avanzados <span className="text-destructive">*</span>
                {nodoFijo && (
                  <span className="text-muted-foreground ml-2 text-[10px] uppercase tracking-wider">
                    (fijado por el nodo)
                  </span>
                )}
              </label>
              {nodoFijo ? (
                <div
                  className="w-full px-3 py-2 bg-muted/30 border border-border text-sm text-foreground tabular-nums"
                  style={{ borderRadius: '0.25rem', fontFamily: "'JetBrains Mono', monospace" }}
                >
                  {km || '0.000'} km
                </div>
              ) : (
                <input
                  type="number"
                  step="0.001"
                  min="0"
                  value={km}
                  onChange={(e) => setKm(e.target.value)}
                  placeholder="0.000"
                  className="w-full px-3 py-2 bg-background border border-border text-sm focus:outline-none focus:border-foreground/40"
                  style={{ borderRadius: '0.25rem' }}
                />
              )}
            </div>
          </div>

          {/* Nodo del recorrido. Si el modal se abrió con `nodoFijo`,
              mostramos el nodo como texto readonly y los km NO son
              editables (es un avance de "confirmación" del nodo).
              Si no, el user elige el nodo con un select y los km
              se autocompletan. */}
          {nodos.length > 0 && (
            <div>
              <label className="block text-xs font-medium text-foreground mb-1">
                Nodo del recorrido{nodoFijo ? '' : ' (opcional)'}
              </label>
              {nodoFijo ? (
                <div
                  className="w-full px-3 py-2 bg-muted/30 border border-border text-sm text-foreground"
                  style={{ borderRadius: '0.25rem' }}
                >
                  {(() => {
                    const idx = nodos.findIndex(
                      (x) => x.id === nodoFijo.nodoId,
                    )
                    const n = nodos[idx]
                    if (!n) return '—'
                    // El "trayecto" que se documenta al subir el
                    // avance de este nodo. Regla de trazabilidad
                    // N → N+1: para CADA nodo (incluido el primero),
                    // el input muestra el tramo DESDE este nodo
                    // HACIA el siguiente. Si es el último, no
                    // debería haberse podido abrir (no hay botón
                    // "Subir avance" en el último nodo), pero por
                    // seguridad mostramos la meta igual.
                    const anterior = idx > 0 ? nodos[idx - 1] : null
                    const esUltimo = idx === nodos.length - 1
                    let trayecto: string
                    if (esUltimo) {
                      trayecto = `Meta del recorrido (Nodo ${n.orden})`
                    } else {
                      trayecto = `De Nodo ${n.orden} a Nodo ${nodos[idx + 1].orden}`
                    }
                    // `anterior` se mantiene para los textos de
                    // apoyo (mostrar el nodo anterior y el km).
                    void anterior
                    return (
                      <span>
                        <span
                          className="inline-block w-4 h-4 rounded-full mr-2 align-middle"
                          style={{
                            background:
                              n.tipo === 'inicio'
                                ? '#22c55e'
                                : n.tipo === 'fin'
                                  ? '#ef4444'
                                  : '#3b82f6',
                          }}
                        />
                        <span className="font-medium">{trayecto}</span>
                        <span className="text-muted-foreground ml-2">
                          · {n.nombre ?? `Nodo ${n.orden}`} ·{' '}
                          {n.kmAcumulado.toFixed(2)} km
                        </span>
                      </span>
                    )
                  })()}
                </div>
              ) : (
                <>
                  <select
                    value={nodoId}
                    onChange={(e) => {
                      const id = e.target.value
                      setNodoId(id)
                      if (id) {
                        const n = nodos.find((x) => x.id === id)
                        if (n) setKm(n.kmAcumulado.toFixed(3))
                      }
                    }}
                    className="w-full px-3 py-2 bg-background border border-border text-sm focus:outline-none focus:border-foreground/40"
                    style={{ borderRadius: '0.25rem' }}
                  >
                    <option value="">— Sin nodo —</option>
                    {nodos.map((n, nIdx) => {
                      // Cada opción muestra el tramo que se va a
                      // documentar al elegir ese nodo. Regla
                      // N → N+1: el avance del nodo N documenta
                      // "De Nodo N a Nodo N+1". Si N es el último
                      // nodo, es la meta.
                      const esUltimoNodo = nIdx === nodos.length - 1
                      const tramo = esUltimoNodo
                        ? `meta · ${n.kmAcumulado.toFixed(2)} km`
                        : `De Nodo ${n.orden} a Nodo ${nodos[nIdx + 1].orden} · ${n.kmAcumulado.toFixed(2)} km`
                      return (
                        <option key={n.id} value={n.id}>
                          {n.orden}. {n.nombre ?? `Nodo ${n.orden}`} — {tramo}
                        </option>
                      )
                    })}
                  </select>
                  <p className="mt-1 text-[10px] text-muted-foreground">
                    Si elegís un nodo, los km se autocompletan con la distancia
                    acumulada del recorrido hasta ese punto.
                  </p>
                </>
              )}
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-foreground mb-1">
              Técnico que reporta <span className="text-destructive">*</span>
            </label>
            <div
              className="w-full px-3 py-2 bg-muted/30 border border-border text-sm text-foreground"
              style={{ borderRadius: '0.25rem' }}
            >
              {auth.status === 'autenticado' ? (
                <span className="font-medium">{auth.sesion.usuario.nombre}</span>
              ) : (
                <span className="text-muted-foreground">—</span>
              )}
            </div>
            <p className="mt-1 text-[10px] text-muted-foreground">
              El avance se registra a nombre del usuario con la sesión activa.
            </p>
          </div>

          <div>
            <label className="block text-xs font-medium text-foreground mb-1">
              Descripción <span className="text-destructive">*</span>
            </label>
            <textarea
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              rows={3}
              placeholder="Qué se hizo hoy, en qué punto del trazado, condiciones del terreno…"
              className="w-full px-3 py-2 bg-background border border-border text-sm focus:outline-none focus:border-foreground/40 resize-none"
              style={{ borderRadius: '0.25rem' }}
            />
          </div>

          {/* Fotos (upload múltiple) */}
          <div>
            <label className="block text-xs font-medium text-foreground mb-1">
              Fotos ({fotos.length}/20)
            </label>
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={(e) => handleAddFiles(e.target.files)}
              className="block w-full text-xs text-muted-foreground file:mr-3 file:py-1.5 file:px-3 file:border-0 file:bg-foreground file:text-background file:text-xs file:font-medium file:cursor-pointer hover:file:opacity-90"
              style={{ borderRadius: '0.25rem' }}
            />
            {fotos.length > 0 && (
              <div className="grid grid-cols-4 sm:grid-cols-6 gap-2 mt-2">
                {fotos.map((f) => (
                  <div
                    key={f.id}
                    className="relative w-full aspect-square bg-muted overflow-hidden border border-border"
                    style={{ borderRadius: '0.125rem' }}
                  >
                    <img
                      src={f.preview}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                    {f.status === 'subiendo' && (
                      <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                        <Loader2 size={16} className="animate-spin text-white" />
                      </div>
                    )}
                    {f.status === 'error' && (
                      <div className="absolute inset-0 bg-destructive/70 flex items-center justify-center text-[9px] text-white text-center p-1">
                        Error
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => handleRemoveFoto(f.id)}
                      className="absolute top-1 right-1 bg-black/60 text-white p-0.5 hover:bg-black/80"
                      style={{ borderRadius: '0.125rem' }}
                    >
                      <X size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
      </div>
    </Modal>
  )
}
