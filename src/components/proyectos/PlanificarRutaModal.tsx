/**
 * Modal del planificador de ruta. Reemplaza el editor manual de
 * nodos con un flujo asistido:
 *
 *   1) El user hace click en el mapa para marcar el PUNTO DE INICIO.
 *   2) Click en uno o más WAYPOINTS intermedios (opcional).
 *   3) Click en el PUNTO FINAL.
 *   4) Define la DISTANCIA ENTRE NODOS (default 2 km).
 *   5) Click "Generar ruta" → el back llama a OSRM, resuelve la
 *      ruta por calles, samplea cada X km, y crea los
 *      `ProyectoNodo` con sus `kmAcumulado`.
 *
 * Si todo sale bien, mostramos el resultado (cantidad de nodos,
 * km totales) y un botón "Confirmar" que ejecuta el cambio en la
 * DB. Si falla (OSRM no responde, ruta imposible, etc.) mostramos
 * el error con un botón "Reintentar".
 *
 * UX:
 *  - Los markers se renderizan con colores distintos según el rol:
 *    verde (inicio), azul (waypoint), rojo (fin).
 *  - La polilínea "preview" se actualiza en vivo mientras el user
 *    marca los puntos (línea recta entre los puntos marcados).
 *  - El botón "Limpiar" resetea los markers para empezar de nuevo.
 */
import { useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import {
  AlertCircle,
  Loader2,
  MapPin,
  RotateCcw,
  Route,
  Trash2,
  X,
} from 'lucide-react'
import { Modal } from '../Modal'
import { planificarRuta } from './api'
import type { PlanificarRutaResultado } from './api'
import { imageUrl } from '../../lib/apiBase'
import type { ProyectoNodo } from './types'

// Fix íconos Leaflet en Vite (mismo patrón que MapaNodos).
import iconUrl from 'leaflet/dist/images/marker-icon.png'
import iconRetinaUrl from 'leaflet/dist/images/marker-icon-2x.png'
import shadowUrl from 'leaflet/dist/images/marker-shadow.png'
L.Icon.Default.mergeOptions({
  iconUrl,
  iconRetinaUrl,
  shadowUrl,
})

type Props = {
  open: boolean
  /**
   * ID del proyecto. Si viene vacío (`''`), el modal entra en
   * modo "preview": el back calcula la ruta con OSRM y devuelve
   * los nodos, pero NO persiste nada. Útil para el form de
   * crear proyecto, donde todavía no hay id.
   */
  proyectoId: string
  /** Nodos existentes (solo se muestran al abrir como referencia). */
  initialNodos?: ProyectoNodo[]
  onClose: () => void
  onPlanned: (resultado: PlanificarRutaResultado) => void
}

type PuntoMarcado = {
  latitud: number
  longitud: number
  /** 'inicio' | 'waypoint' | 'fin' */
  rol: 'inicio' | 'waypoint' | 'fin'
}

const DEFAULT_CENTER = { lat: 4.711, lng: -74.0721 }
const DEFAULT_ZOOM = 12

export function PlanificarRutaModal({
  open,
  proyectoId,
  initialNodos = [],
  onClose,
  onPlanned,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const markersRef = useRef<L.Marker[]>([])
  const polylineRef = useRef<L.Polyline | null>(null)
  const resizeObserverRef = useRef<ResizeObserver | null>(null)

  const [puntos, setPuntos] = useState<PuntoMarcado[]>([])
  const [distanciaPorNodoKm, setDistanciaPorNodoKm] = useState('2')
  const [nombreBase, setNombreBase] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [preview, setPreview] = useState<PlanificarRutaResultado | null>(null)

  // Init del mapa: cuando `open` pasa a `true`, inicializamos
  // Init del mapa: cuando el modal se abre, inicializamos Leaflet.
  // Patrón idéntico al `MapaNodosEditor` (que SÍ funciona) — la
  // clave es:
  //  1) Cleanup AGRESIVO al inicio (mata mapa zombie antes de
  //     re-crear).
  //  2) Delay de 50ms (no 100ms) antes de inicializar Leaflet.
  //  3) `invalidateSize()` INMEDIATO después de crear el mapa,
  //     antes de los `setTimeout` adicionales.
  //  4) Cleanup en el `return` que mata mapa + ResizeObserver.
  // NO se re-inicializa si `initialNodos` cambia mientras el modal
  // está abierto (eso era el bug: mataba y re-creaba el mapa con
  // cada render del padre).
  useEffect(() => {
    if (!open) return

    // Si quedó un mapa vivo de una apertura anterior, limpiarlo
    // ANTES de re-crear. Sin esto, el segundo `L.map` puede
    // fallar silenciosamente.
    if (mapRef.current) {
      mapRef.current.remove()
      mapRef.current = null
      markersRef.current.forEach((m) => m.remove())
      markersRef.current = []
      if (polylineRef.current) {
        polylineRef.current.remove()
        polylineRef.current = null
      }
    }

    const initTimer = setTimeout(() => {
      if (!containerRef.current) return

      const centroInicial =
        initialNodos.length > 0
          ? {
              lat: Number(initialNodos[0].latitud),
              lng: Number(initialNodos[0].longitud),
            }
          : DEFAULT_CENTER

      const map = L.map(containerRef.current, {
        center: [centroInicial.lat, centroInicial.lng],
        zoom: DEFAULT_ZOOM,
        zoomControl: true,
      })
      mapRef.current = map

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }).addTo(map)

      // InvalidateSize inmediato + varios más para cubrir la
      // animación de entrada del modal (el contenedor puede
      // estar en 0×0 al principio y crecer hasta su tamaño
      // final). Mismo patrón que `MapaNodosEditor`.
      map.invalidateSize()
      setTimeout(() => map.invalidateSize(), 50)
      setTimeout(() => map.invalidateSize(), 200)
      setTimeout(() => map.invalidateSize(), 500)

      // ResizeObserver como red de seguridad.
      const ro = new ResizeObserver(() => {
        map.invalidateSize()
      })
      ro.observe(containerRef.current)
      resizeObserverRef.current = ro

      // Click en el mapa → agrega un punto según el estado actual.
      map.on('click', (e: L.LeafletMouseEvent) => {
        const { lat, lng } = e.latlng
        setPuntos((prev) => {
          if (prev.length === 0) {
            return [{ latitud: lat, longitud: lng, rol: 'inicio' }]
          }
          return [
            ...prev,
            { latitud: lat, longitud: lng, rol: 'waypoint' },
          ]
        })
      })
    }, 50)

    return () => {
      clearTimeout(initTimer)
      if (resizeObserverRef.current) {
        resizeObserverRef.current.disconnect()
        resizeObserverRef.current = null
      }
      if (mapRef.current) {
        mapRef.current.remove()
        mapRef.current = null
      }
      markersRef.current.forEach((m) => m.remove())
      markersRef.current = []
      if (polylineRef.current) {
        polylineRef.current.remove()
        polylineRef.current = null
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  // Reset al cerrar
  useEffect(() => {
    if (!open) {
      setPuntos([])
      setError(null)
      setPreview(null)
      setDistanciaPorNodoKm('2')
      setNombreBase('')
      // Limpiar markers y polyline del mapa
      markersRef.current.forEach((m) => m.remove())
      markersRef.current = []
      if (polylineRef.current) {
        polylineRef.current.remove()
        polylineRef.current = null
      }
    }
  }, [open])

  // Re-render markers y polyline cuando cambian los puntos.
  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    // Limpiar markers y polyline previos
    markersRef.current.forEach((m) => m.remove())
    markersRef.current = []
    if (polylineRef.current) {
      polylineRef.current.remove()
      polylineRef.current = null
    }

    if (puntos.length === 0) return

    // Render markers con color por rol
    for (const p of puntos) {
      const color =
        p.rol === 'inicio' ? '#22c55e' : p.rol === 'fin' ? '#ef4444' : '#3b82f6'
      const label =
        p.rol === 'inicio' ? 'I' : p.rol === 'fin' ? 'F' : 'W'
      const icon = L.divIcon({
        className: 'planificador-marker',
        html: `<div style="
          width: 28px; height: 28px;
          background: ${color};
          border: 3px solid white;
          border-radius: 50%;
          box-shadow: 0 0 0 2px rgba(0,0,0,0.2);
          display: flex; align-items: center; justify-content: center;
          color: white; font-weight: bold; font-size: 13px;
          font-family: 'JetBrains Mono', monospace;
        ">${label}</div>`,
        iconSize: [28, 28],
        iconAnchor: [14, 14],
      })
      const marker = L.marker([p.latitud, p.longitud], { icon }).addTo(map)
      markersRef.current.push(marker)
    }

    // Polyline conectando los puntos (línea recta como preview
    // hasta que llegue la ruta real de OSRM).
    if (puntos.length >= 2) {
      polylineRef.current = L.polyline(
        puntos.map((p) => [p.latitud, p.longitud]),
        {
          color: '#3b82f6',
          weight: 3,
          opacity: 0.5,
          dashArray: '6, 8',
        },
      ).addTo(map)
    }
  }, [puntos])

  function marcarComoFin() {
    // El user define explícitamente que el ÚLTIMO punto agregado
    // es el fin. Sin esto, el último punto quedaría como
    // 'waypoint' y la ruta tendría inicio + N waypoints sin fin.
    setPuntos((prev) => {
      if (prev.length < 2) return prev
      const next = [...prev]
      next[next.length - 1] = { ...next[next.length - 1], rol: 'fin' }
      return next
    })
  }

  function deshacer() {
    setPuntos((prev) => prev.slice(0, -1))
  }

  function limpiar() {
    setPuntos([])
  }

  function handleClose() {
    if (busy) return
    onClose()
  }

  async function handleGenerar() {
    if (puntos.length < 2) {
      setError('Marcá al menos el inicio y el fin en el mapa.')
      return
    }
    const inicio = puntos[0]
    // Si el último punto sigue siendo 'waypoint', no se puede
    // planificar. Forzamos al user a marcar "Marcar fin" primero.
    const fin = puntos[puntos.length - 1]
    if (fin.rol !== 'fin') {
      setError(
        'El último punto debe ser el FIN. Tocá "Marcar como fin" o usá el último punto agregado como fin explícitamente.',
      )
      return
    }
    const waypoints = puntos
      .slice(1, -1)
      .filter((p) => p.rol === 'waypoint')

    const dist = Number(distanciaPorNodoKm)
    if (!dist || dist < 0.1) {
      setError('La distancia entre nodos debe ser al menos 0.1 km.')
      return
    }

    setBusy(true)
    setError(null)
    setPreview(null)
    try {
      const res = await planificarRuta(proyectoId, {
        inicio: { latitud: inicio.latitud, longitud: inicio.longitud },
        waypoints: waypoints.map((w) => ({
          latitud: w.latitud,
          longitud: w.longitud,
        })),
        fin: { latitud: fin.latitud, longitud: fin.longitud },
        distanciaPorNodoKm: dist,
        sobrescribirKmATrabajar: true,
        nombreBase: nombreBase.trim() || undefined,
        preview: !proyectoId, // si no hay proyectoId, forzar preview
      })
      setPreview(res)
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : 'No se pudo planificar la ruta. Reintentá.'
      setError(msg)
    } finally {
      setBusy(false)
    }
  }

  function handleConfirmar() {
    if (!preview) return
    onPlanned(preview)
  }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Planificar ruta"
      description="Marcá inicio, waypoints (opcional) y fin en el mapa. El sistema calcula la ruta por calles y genera los nodos automáticamente."
      icon={<Route size={18} />}
      size="full"
      scrollBody={false}
      footer={
        <div className="flex items-center justify-between gap-2">
          <div className="text-[10px] text-muted-foreground tracking-widest" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
            {puntos.length === 0
              ? 'Hacé click en el mapa para empezar'
              : puntos.length === 1
                ? '1 punto · ahora un waypoint o el fin'
                : `${puntos.length} puntos`}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleClose}
              disabled={busy}
              className="px-3 py-1.5 text-sm border border-border hover:border-foreground/40 transition-colors disabled:opacity-50"
              style={{ borderRadius: '0.25rem' }}
            >
              Cancelar
            </button>
            {preview ? (
              <button
                type="button"
                onClick={handleConfirmar}
                className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-secondary text-secondary-foreground text-sm font-medium hover:opacity-90 transition-opacity"
                style={{ borderRadius: '0.25rem' }}
              >
                <MapPin size={13} />
                Aplicar {preview.cantidadNodos} nodos
              </button>
            ) : (
              <button
                type="button"
                onClick={handleGenerar}
                disabled={busy || puntos.length < 2}
                className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
                style={{ borderRadius: '0.25rem' }}
              >
                {busy && <Loader2 size={13} className="animate-spin" />}
                {busy ? 'Calculando ruta…' : 'Generar ruta'}
              </button>
            )}
          </div>
        </div>
      }
    >
      <div
        className="grid grid-cols-1 lg:grid-cols-[1fr_320px] lg:h-[600px]"
      >
        {/* Mapa. En mobile va ABAJO del panel (`order-2`) y en desktop
            va a la IZQUIERDA (`lg:order-1`). En mobile le damos un
            alto fijo razonable (400px) y dejamos que el body del
            modal scrollee. En desktop el grid fuerza 600px totales. */}
        <div className="relative proyecto-mapa-scope z-0 order-2 lg:order-1 h-[400px] lg:h-auto">
          <div
            ref={containerRef}
            className="w-full h-full bg-muted z-0 proyecto-mapa-scope"
            style={{ borderRadius: '0.25rem' }}
          />
          {/* Leyenda superpuesta */}
          <div
            className="absolute bottom-3 left-3 z-10 bg-background/95 border border-border px-3 py-2 text-[10px] space-y-1.5"
            style={{ borderRadius: '0.15rem', fontFamily: "'JetBrains Mono', monospace" }}
          >
            <div className="flex items-center gap-2">
              <span
                className="inline-flex w-5 h-5 rounded-full items-center justify-center text-white text-[10px] font-bold"
                style={{ background: '#22c55e' }}
              >
                I
              </span>
              <span>Inicio</span>
            </div>
            <div className="flex items-center gap-2">
              <span
                className="inline-flex w-5 h-5 rounded-full items-center justify-center text-white text-[10px] font-bold"
                style={{ background: '#3b82f6' }}
              >
                W
              </span>
              <span>Waypoint</span>
            </div>
            <div className="flex items-center gap-2">
              <span
                className="inline-flex w-5 h-5 rounded-full items-center justify-center text-white text-[10px] font-bold"
                style={{ background: '#ef4444' }}
              >
                F
              </span>
              <span>Fin</span>
            </div>
          </div>
        </div>

        {/* Panel lateral. En mobile va ARRIBA del mapa (`order-1`)
            y en desktop a la DERECHA del mapa (`lg:order-2`). En
            mobile tiene `max-h-[400px]` para que el contenido del
            panel scrollee internamente; el mapa va debajo con su
            propia altura fija. */}
        <div
          className="border-t lg:border-t-0 lg:border-l border-border p-4 space-y-4 overflow-y-auto order-1 lg:order-2 max-h-[400px] lg:max-h-none"
        >
          {/* Paso 1: instrucciones */}
          <div>
            <div
              className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1"
              style={{ fontFamily: "'JetBrains Mono', monospace" }}
            >
              1 · Marcá los puntos
            </div>
            <ol className="text-xs text-muted-foreground space-y-1 list-decimal pl-4">
              <li>Click en el mapa para el <strong className="text-foreground">inicio</strong>.</li>
              <li>Clicks intermedios para <strong className="text-foreground">waypoints</strong> (opcional).</li>
              <li>Click final y después "Marcar como fin".</li>
            </ol>
          </div>

          {/* Lista de puntos marcados */}
          {puntos.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-1">
                <div
                  className="text-[10px] uppercase tracking-widest text-muted-foreground"
                  style={{ fontFamily: "'JetBrains Mono', monospace" }}
                >
                  Puntos ({puntos.length})
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={deshacer}
                    disabled={busy || puntos.length === 0}
                    title="Deshacer último punto"
                    className="text-[10px] text-muted-foreground hover:text-foreground disabled:opacity-30 inline-flex items-center gap-1"
                  >
                    <RotateCcw size={10} />
                  </button>
                  <button
                    type="button"
                    onClick={limpiar}
                    disabled={busy || puntos.length === 0}
                    title="Limpiar todos los puntos"
                    className="text-[10px] text-muted-foreground hover:text-destructive disabled:opacity-30 inline-flex items-center gap-1"
                  >
                    <Trash2 size={10} />
                  </button>
                </div>
              </div>
              <ul className="space-y-1 max-h-32 overflow-y-auto">
                {puntos.map((p, idx) => (
                  <li
                    key={idx}
                    className="flex items-center gap-2 text-[11px]"
                    style={{ fontFamily: "'JetBrains Mono', monospace" }}
                  >
                    <span
                      className="inline-flex w-4 h-4 rounded-full items-center justify-center text-white text-[9px] font-bold shrink-0"
                      style={{
                        background:
                          p.rol === 'inicio'
                            ? '#22c55e'
                            : p.rol === 'fin'
                              ? '#ef4444'
                              : '#3b82f6',
                      }}
                    >
                      {p.rol === 'inicio' ? 'I' : p.rol === 'fin' ? 'F' : idx}
                    </span>
                    <span className="text-muted-foreground">
                      {p.latitud.toFixed(4)}, {p.longitud.toFixed(4)}
                    </span>
                    {p.rol === 'waypoint' && (
                      <button
                        type="button"
                        onClick={() =>
                          setPuntos((prev) =>
                            prev.filter((_, i) => i !== idx),
                          )
                        }
                        className="ml-auto text-muted-foreground hover:text-destructive"
                      >
                        <X size={10} />
                      </button>
                    )}
                  </li>
                ))}
              </ul>
              {/* Botón "Marcar como fin" para confirmar el último */}
              {puntos.length >= 2 && puntos[puntos.length - 1].rol === 'waypoint' && (
                <button
                  type="button"
                  onClick={marcarComoFin}
                  className="mt-2 w-full text-[11px] py-1.5 border border-dashed border-border hover:border-foreground/40 transition-colors"
                  style={{ borderRadius: '0.25rem' }}
                >
                  Marcar último punto como FIN
                </button>
              )}
            </div>
          )}

          {/* Paso 2: distancia entre nodos */}
          <div>
            <label className="block text-[10px] uppercase tracking-widest text-muted-foreground mb-1" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
              2 · Distancia entre nodos
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                step="0.1"
                min="0.1"
                max="100"
                value={distanciaPorNodoKm}
                onChange={(e) => setDistanciaPorNodoKm(e.target.value)}
                className="flex-1 px-2 py-1.5 bg-background border border-border text-sm focus:outline-none focus:border-foreground/40"
                style={{ borderRadius: '0.25rem' }}
              />
              <span className="text-xs text-muted-foreground">km</span>
            </div>
            <p className="mt-1 text-[10px] text-muted-foreground">
              Por cada X km de ruta se crea un nodo.
            </p>
          </div>

          {/* Paso 3: nombre base */}
          <div>
            <label className="block text-[10px] uppercase tracking-widest text-muted-foreground mb-1" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
              3 · Nombre base (opcional)
            </label>
            <input
              type="text"
              value={nombreBase}
              onChange={(e) => setNombreBase(e.target.value)}
              placeholder="Ej: Tendido, Tramo A"
              maxLength={50}
              className="w-full px-2 py-1.5 bg-background border border-border text-sm focus:outline-none focus:border-foreground/40"
              style={{ borderRadius: '0.25rem' }}
            />
            <p className="mt-1 text-[10px] text-muted-foreground">
              Cada nodo se llamará "{nombreBase.trim() || 'Nodo'} #N".
            </p>
          </div>

          {/* Error */}
          {error && (
            <div className="border border-destructive/30 bg-destructive/5 p-2.5 text-[11px] text-destructive flex items-start gap-2">
              <AlertCircle size={12} className="mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Preview del resultado */}
          {preview && (
            <div
              className="border border-secondary/30 bg-secondary/5 p-3 space-y-2"
              style={{ borderRadius: '0.25rem' }}
            >
              <div
                className="text-[10px] uppercase tracking-widest text-secondary"
                style={{ fontFamily: "'JetBrains Mono', monospace" }}
              >
                Vista previa · listo para aplicar
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <div className="text-[9px] text-muted-foreground uppercase tracking-widest" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                    Nodos a crear
                  </div>
                  <div className="text-base font-bold text-foreground" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>
                    {preview.cantidadNodos}
                  </div>
                </div>
                <div>
                  <div className="text-[9px] text-muted-foreground uppercase tracking-widest" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                    Km ruta
                  </div>
                  <div className="text-base font-bold text-foreground tabular-nums" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>
                    {preview.kmTotalRuta.toFixed(2)}
                  </div>
                </div>
                <div className="col-span-2">
                  <div className="text-[9px] text-muted-foreground uppercase tracking-widest" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                    Km a trabajar (se sobrescribe)
                  </div>
                  <div className="text-base font-bold text-primary tabular-nums" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>
                    {preview.kmATrabajar.toFixed(2)} km
                  </div>
                </div>
              </div>
              <p className="text-[10px] text-muted-foreground leading-tight">
                Se reemplazan los nodos existentes. Los avances previos quedan desligados (no se borran).
              </p>
            </div>
          )}
        </div>
      </div>
    </Modal>
  )
}
