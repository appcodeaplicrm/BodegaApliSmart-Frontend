import { useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import {
  Loader2,
  MapPin,
  Plus,
  Search,
  Trash2,
  X,
} from 'lucide-react'
import { Modal } from '../Modal'

// Fix: Leaflet no carga los íconos por defecto en Vite.
import iconUrl from 'leaflet/dist/images/marker-icon.png'
import iconRetinaUrl from 'leaflet/dist/images/marker-icon-2x.png'
import shadowUrl from 'leaflet/dist/images/marker-shadow.png'

L.Icon.Default.mergeOptions({
  iconUrl,
  iconRetinaUrl,
  shadowUrl,
})

export type NodoEditable = {
  /** Id local (temporal) hasta que el back asigne el id real. */
  localId: string
  id?: string
  latitud: number
  longitud: number
  nombre: string
  tipo: 'inicio' | 'intermedio' | 'fin'
  notas?: string
  /**
   * `kmAcumulado` que viene del planificador OSRM (distancia
   * REAL recorrida por la polyline). Si está presente, el back
   * lo respeta al crear el nodo. Si está undefined, el back
   * recalcula con Haversine (modo manual).
   */
  kmAcumulado?: number
  /** Solo para los NUEVOS. Cuando el back ya tiene id, este flag es false. */
  esNuevo: boolean
}

type Props = {
  open: boolean
  bodegaId?: string
  onClose: () => void
  onConfirm: (nodos: NodoEditable[]) => void
  /** Nodos iniciales (caso edición). */
  initialNodos?: NodoEditable[]
}

const COLORES_TIPO: Record<NodoEditable['tipo'], string> = {
  inicio: '#22c55e',
  intermedio: '#3b82f6',
  fin: '#ef4444',
}

const DEFAULT_CENTER = { lat: 4.711, lng: -74.0721 }
const DEFAULT_ZOOM = 12

/**
 * Modal para crear / editar el recorrido del proyecto.
 *
 * UX:
 *  - Click en el mapa → crea un nodo nuevo en esa posición.
 *  - Drag de un nodo → lo mueve. Se actualiza el `kmAcumulado` de
 *    TODOS los nodos al instante (lo recalculamos en el front con
 *    Haversine mientras el back no esté sincronizado — al confirmar
 *    se envían los POST/PATCH y el back recalcula de nuevo).
 *  - Lista lateral con el detalle editable: nombre, tipo, lat, lng.
 *  - Botón "X" en cada item para eliminarlo.
 *  - Botón "Invertir" para invertir el orden (útil si el user empezó
 *    a marcar del final al inicio).
 *  - Confirmar → devuelve el array al padre, que lo manda al back.
 */
export function MapaNodosEditor({
  open,
  bodegaId,
  onClose,
  onConfirm,
  initialNodos = [],
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const layersRef = useRef<Map<string, L.Marker>>(new Map())

  const [nodos, setNodos] = useState<NodoEditable[]>(initialNodos)
  const [seleccionId, setSeleccionId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [buscando, setBuscando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Reset cuando se abre
  useEffect(() => {
    if (open) {
      setNodos(initialNodos)
      setSeleccionId(null)
      setSearch('')
      setError(null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  // Init del mapa. CRÍTICO: este modal se monta dentro de otro
  // componente (`Modal`) que probablemente está oculto cuando
  // `open=false`. Leaflet, al inicializar, lee las dimensiones del
  // contenedor; si está en 0×0 los tiles no se dibujan.
  // Solución: cleanup agresivo + init con un pequeño delay
  // + múltiples `invalidateSize` para forzar el redibujo cuando
  // el modal termina su animación de entrada.
  useEffect(() => {
    if (!open) return

    // Si por alguna razón ya quedó un mapa vivo de una apertura
    // anterior, lo limpiamos.
    if (mapRef.current) {
      mapRef.current.remove()
      mapRef.current = null
      layersRef.current.clear()
    }

    // Esperamos a que el container esté en el DOM y dimensionado.
    // 50ms es suficiente para que React monte el <div ref> adentro
    // del Modal; el invalidateSize después se encarga del resto.
    const initTimer = setTimeout(() => {
      if (!containerRef.current) return

      const map = L.map(containerRef.current, {
        center: [DEFAULT_CENTER.lat, DEFAULT_CENTER.lng],
        zoom: DEFAULT_ZOOM,
        zoomControl: true,
      })
      mapRef.current = map

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }).addTo(map)

      // Forzar el recálculo de tamaño varias veces para cubrir la
      // animación de entrada del Modal (el contenedor puede estar
      // en 0×0 al principio y crecer hasta su tamaño final).
      map.invalidateSize()
      setTimeout(() => map.invalidateSize(), 50)
      setTimeout(() => map.invalidateSize(), 200)
      setTimeout(() => map.invalidateSize(), 500)

      // Click en el mapa → crear nodo nuevo
      map.on('click', (e: L.LeafletMouseEvent) => {
        const { lat, lng } = e.latlng
        setNodos((prev) => {
          // Si ya tenemos un nodo FIN, no dejamos crear más.
          if (prev.some((n) => n.tipo === 'fin')) return prev
          const newNodo: NodoEditable = {
            localId: `local-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            latitud: lat,
            longitud: lng,
            nombre: `Nodo ${prev.length + 1}`,
            tipo:
              prev.length === 0
                ? 'inicio'
                : 'intermedio',
            esNuevo: true,
          }
          setSeleccionId(newNodo.localId)
          return [...prev, newNodo]
        })
      })
    }, 50)

    return () => {
      clearTimeout(initTimer)
      if (mapRef.current) {
        mapRef.current.remove()
        mapRef.current = null
        layersRef.current.clear()
      }
    }
  }, [open])

  // Redibuja los pines cuando cambian los nodos
  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    // Borrar pines viejos
    for (const m of layersRef.current.values()) {
      map.removeLayer(m)
    }
    layersRef.current.clear()

    const latLngs: L.LatLngExpression[] = []

    nodos.forEach((n, idx) => {
      const pos: L.LatLngExpression = [n.latitud, n.longitud]
      latLngs.push(pos)

      const icon = L.divIcon({
        className: 'proyecto-nodo-editor-pin',
        html: `
          <div style="
            position: relative;
            width: 32px;
            height: 32px;
            display: flex;
            align-items: center;
            justify-content: center;
            background: ${COLORES_TIPO[n.tipo]};
            color: white;
            border: 2px solid ${seleccionId === n.localId ? '#facc15' : 'white'};
            border-radius: 50%;
            font-weight: 700;
            font-size: 12px;
            box-shadow: 0 2px 6px rgba(0,0,0,0.3);
            font-family: 'JetBrains Mono', monospace;
            cursor: grab;
          ">${idx + 1}</div>
        `,
        iconSize: [32, 32],
        iconAnchor: [16, 16],
      })

      const marker = L.marker(pos, { icon, draggable: true })
        .on('click', () => setSeleccionId(n.localId))
        .on('dragend', (ev) => {
          const { lat, lng } = ev.target.getLatLng()
          setNodos((prev) =>
            prev.map((x) =>
              x.localId === n.localId ? { ...x, latitud: lat, longitud: lng } : x,
            ),
          )
        })
        .addTo(map)
      layersRef.current.set(n.localId, marker)
    })

    // Polilínea
    if (nodos.length >= 2) {
      L.polyline(latLngs, {
        color: '#3b82f6',
        weight: 3,
        opacity: 0.7,
        dashArray: '6, 6',
      }).addTo(map)
    }

    // Fit bounds si hay nodos
    if (nodos.length > 0) {
      if (nodos.length === 1) {
        map.setView(latLngs[0], 14, { animate: true })
      } else {
        map.fitBounds(L.latLngBounds(latLngs), { padding: [40, 40] })
      }
    }
  }, [nodos, seleccionId])

  // ────────────────────────────────────────────
  //  Helpers
  // ────────────────────────────────────────────

  function updateNodo(localId: string, patch: Partial<NodoEditable>) {
    setNodos((prev) =>
      prev.map((n) => (n.localId === localId ? { ...n, ...patch } : n)),
    )
  }

  function eliminarNodo(localId: string) {
    setNodos((prev) => prev.filter((n) => n.localId !== localId))
    if (seleccionId === localId) setSeleccionId(null)
  }

  function invertir() {
    setNodos((prev) => {
      const arr = [...prev].reverse()
      // Intercambiar tipos: el primero pasa a 'inicio', el último a 'fin'.
      return arr.map((n, idx) => {
        if (idx === 0) return { ...n, tipo: 'inicio' }
        if (idx === arr.length - 1) return { ...n, tipo: 'fin' }
        return { ...n, tipo: 'intermedio' }
      })
    })
  }

  async function handleSearch() {
    const q = search.trim()
    if (!q) return
    setBuscando(true)
    setError(null)
    try {
      const url = new URL('https://nominatim.openstreetmap.org/search')
      url.searchParams.set('q', q)
      url.searchParams.set('format', 'json')
      url.searchParams.set('limit', '1')
      const res = await fetch(url.toString(), {
        headers: { Accept: 'application/json' },
      })
      if (!res.ok) throw new Error('Error en la búsqueda')
      const results = (await res.json()) as Array<{ lat: string; lon: string }>
      if (results.length === 0) {
        setError('No se encontró la dirección.')
        return
      }
      const r = results[0]
      const map = mapRef.current
      if (map) {
        map.invalidateSize()
        map.setView([Number(r.lat), Number(r.lon)], 16, { animate: true })
      }
    } catch {
      setError('No se pudo buscar. Verificá tu conexión.')
    } finally {
      setBuscando(false)
    }
  }

  const totalKm = calcularKmAcumulado(nodos)

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Recorrido del proyecto"
      description="Hacé click en el mapa para marcar los nodos. Arrastrá para moverlos."
      icon={<MapPin size={18} />}
      size="xl"
      footer={
        <div className="flex items-center justify-between gap-2">
          <div className="text-xs text-muted-foreground">
            <strong className="text-foreground">{nodos.length}</strong>{' '}
            {nodos.length === 1 ? 'nodo' : 'nodos'} · {totalKm.toFixed(2)} km totales
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
              onClick={() => onConfirm(nodos)}
              disabled={nodos.length === 0}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
              style={{ borderRadius: '0.25rem' }}
            >
              {nodos.some((n) => n.esNuevo)
                ? `Guardar ${nodos.length} ${nodos.length === 1 ? 'nodo' : 'nodos'}`
                : 'Confirmar'}
            </button>
          </div>
        </div>
      }
    >
      <div className="p-4 sm:p-5 grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Columna izquierda: mapa */}
        <div className="md:col-span-2 space-y-2">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
              />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    void handleSearch()
                  }
                }}
                placeholder="Buscá una dirección para centrar el mapa…"
                className="w-full pl-9 pr-3 py-2.5 bg-muted border border-border text-sm focus:outline-none focus:border-primary/60"
                style={{ borderRadius: '0.25rem' }}
              />
            </div>
            <button
              type="button"
              onClick={() => void handleSearch()}
              disabled={buscando || !search.trim()}
              className="px-3 py-2.5 bg-secondary text-secondary-foreground text-xs font-semibold hover:bg-secondary/90 transition-colors disabled:opacity-50 flex items-center gap-1.5"
              style={{ borderRadius: '0.25rem' }}
            >
              {buscando ? <Loader2 size={13} className="animate-spin" /> : <Search size={13} />}
              Buscar
            </button>
          </div>
          <div
            ref={containerRef}
            className="relative w-full border border-border overflow-hidden bg-muted z-0 proyecto-mapa-scope"
            style={{ height: 460, borderRadius: '0.25rem' }}
          />
          {error && (
            <p
              className="text-xs text-primary bg-primary/10 border border-primary/20 px-3 py-2"
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                borderRadius: '0.25rem',
              }}
            >
              ⚠ {error}
            </p>
          )}
          <p
            className="text-[10px] text-muted-foreground"
            style={{ fontFamily: "'JetBrains Mono', monospace" }}
          >
            Click en el mapa = nuevo nodo. Arrastrá un pin para moverlo.
            La polilínea conecta los nodos en orden.
          </p>
        </div>

        {/* Columna derecha: lista editable */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h3
              className="text-[10px] uppercase tracking-widest text-muted-foreground"
              style={{ fontFamily: "'JetBrains Mono', monospace" }}
            >
              Nodos ({nodos.length})
            </h3>
            {nodos.length >= 2 && (
              <button
                type="button"
                onClick={invertir}
                className="text-[10px] text-muted-foreground hover:text-foreground underline"
              >
                Invertir
              </button>
            )}
          </div>

          {nodos.length === 0 ? (
            <div className="border border-dashed border-border p-6 text-center text-xs text-muted-foreground" style={{ borderRadius: '0.25rem' }}>
              <MapPin size={20} className="mx-auto mb-2" />
              Hacé click en el mapa para empezar a marcar el recorrido.
            </div>
          ) : (
            <div className="max-h-[460px] overflow-y-auto space-y-1.5 pr-1">
              {nodos.map((n, idx) => (
                <NodoEditorRow
                  key={n.localId}
                  nodo={n}
                  orden={idx + 1}
                  seleccionado={seleccionId === n.localId}
                  onSelect={() => {
                    setSeleccionId(n.localId)
                    const map = mapRef.current
                    if (map) map.setView([n.latitud, n.longitud], Math.max(map.getZoom(), 14), { animate: true })
                  }}
                  onUpdate={(patch) => updateNodo(n.localId, patch)}
                  onDelete={() => eliminarNodo(n.localId)}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </Modal>
  )
}

// ──────────────────────────────────────────────────────────

function NodoEditorRow({
  nodo,
  orden,
  seleccionado,
  onSelect,
  onUpdate,
  onDelete,
}: {
  nodo: NodoEditable
  orden: number
  seleccionado: boolean
  onSelect: () => void
  onUpdate: (patch: Partial<NodoEditable>) => void
  onDelete: () => void
}) {
  return (
    <div
      onClick={onSelect}
      className={[
        'border p-2 cursor-pointer transition-colors',
        seleccionado
          ? 'border-primary bg-primary/5'
          : 'border-border bg-card hover:bg-muted/30',
      ].join(' ')}
      style={{ borderRadius: '0.25rem' }}
    >
      <div className="flex items-center gap-2 mb-1.5">
        <span
          className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0"
          style={{ background: COLORES_TIPO[nodo.tipo] }}
        >
          {orden}
        </span>
        <input
          type="text"
          value={nodo.nombre}
          onChange={(e) => onUpdate({ nombre: e.target.value })}
          onClick={(e) => e.stopPropagation()}
          className="flex-1 px-1.5 py-0.5 bg-background border border-border text-xs focus:outline-none focus:border-foreground/40"
          style={{ borderRadius: '0.15rem' }}
        />
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onDelete()
          }}
          className="text-muted-foreground hover:text-destructive shrink-0"
        >
          <Trash2 size={12} />
        </button>
      </div>
      <div className="grid grid-cols-2 gap-1.5 mb-1.5">
        <select
          value={nodo.tipo}
          onChange={(e) =>
            onUpdate({ tipo: e.target.value as NodoEditable['tipo'] })
          }
          onClick={(e) => e.stopPropagation()}
          className="px-1.5 py-0.5 bg-background border border-border text-[10px]"
          style={{ borderRadius: '0.15rem', fontFamily: "'JetBrains Mono', monospace" }}
        >
          <option value="inicio">Inicio</option>
          <option value="intermedio">Intermedio</option>
          <option value="fin">Fin</option>
        </select>
        <div
          className="text-[10px] text-muted-foreground flex items-center justify-end"
          style={{ fontFamily: "'JetBrains Mono', monospace" }}
        >
          {nodo.latitud.toFixed(4)}, {nodo.longitud.toFixed(4)}
        </div>
      </div>
    </div>
  )
}

// ──────────────────────────────────────────────────────────
//  Haversine (mismo del back, para recalcular kmAcumulado
//  en el front mientras el back no está sincronizado).
// ──────────────────────────────────────────────────────────

function haversineKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const toRad = (d: number) => (d * Math.PI) / 180
  const R = 6371
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

function calcularKmAcumulado(nodos: NodoEditable[]): number {
  let acum = 0
  for (let i = 1; i < nodos.length; i++) {
    acum += haversineKm(
      nodos[i - 1].latitud,
      nodos[i - 1].longitud,
      nodos[i].latitud,
      nodos[i].longitud,
    )
  }
  return acum
}
