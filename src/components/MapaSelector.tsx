import { useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { MapPin, Search, Loader2, X } from 'lucide-react'

// Fix: Leaflet no carga los íconos por defecto en Vite.
// Tomamos el SVG de los assets que sí incluye leaflet.
import iconUrl from 'leaflet/dist/images/marker-icon.png'
import iconRetinaUrl from 'leaflet/dist/images/marker-icon-2x.png'
import shadowUrl from 'leaflet/dist/images/marker-shadow.png'

L.Icon.Default.mergeOptions({
  iconUrl,
  iconRetinaUrl,
  shadowUrl,
})

type Coords = { lat: number; lng: number }

type Props = {
  /** Dirección legible que ya tenía el form (por si el usuario no usa el mapa). */
  value?: string
  onChange: (direccion: string, coords: Coords | null) => void
}

const DEFAULT_CENTER: Coords = { lat: -0.1807, lng: -78.4678 } // Quito, Ecuador por defecto
const DEFAULT_ZOOM = 12

/**
 * Mapa gratis con Leaflet + OpenStreetMap. Sin API key.
 * - Buscador con Nominatim (geocoding gratis, 1 req/s).
 * - Click en el mapa → mueve el pin → reverse geocoding para obtener la dirección.
 * - Botón "X" para borrar el pin.
 */
export function MapaSelector({ value = '', onChange }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const markerRef = useRef<L.Marker | null>(null)

  // Guardamos onChange en un ref para que el useEffect del mapa no dependa
  // de la función que pasa el padre. Si el padre pasa una función nueva en
  // cada render (lo normal si hace `(d) => setX(d)`), sin esto el efecto
  // se vuelve a correr, remueve el mapa y crea uno nuevo cada vez.
  const onChangeRef = useRef(onChange)
  useEffect(() => {
    onChangeRef.current = onChange
  }, [onChange])

  const [search, setSearch] = useState(value)
  const [coords, setCoords] = useState<Coords | null>(null)
  const [buscando, setBuscando] = useState(false)
  const [loadingMapa, setLoadingMapa] = useState(false)
  const [error, setError] = useState('')

  // ─── Init del mapa ─────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return

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

    // CRÍTICO: cuando el mapa se monta dentro de un flex container con
    // overflow-hidden, Leaflet no detecta bien el tamaño inicial y queda
    // en 0×0. invalidateSize lo fuerza a recalcular.
    // Lo llamamos 2 veces: una apenas monta, otra con un pequeño delay
    // por si la animación de entrada todavía no terminó.
    setTimeout(() => map.invalidateSize(), 0)
    setTimeout(() => map.invalidateSize(), 300)

    // Helper local para poner/mover el pin
    const setPin = (lat: number, lng: number) => {
      if (markerRef.current) {
        markerRef.current.setLatLng([lat, lng])
      } else {
        markerRef.current = L.marker([lat, lng]).addTo(map)
      }
    }

    // Click en el mapa → pone/mueve el pin
    map.on('click', async (e: L.LeafletMouseEvent) => {
      const { lat, lng } = e.latlng
      setLoadingMapa(true)
      setError('')
      try {
        const direccion = await reverseGeocode(lat, lng)
        setCoords({ lat, lng })
        setSearch(direccion)
        onChangeRef.current(direccion, { lat, lng })
        setPin(lat, lng)
      } catch {
        const fallback = `${lat.toFixed(5)}, ${lng.toFixed(5)}`
        setCoords({ lat, lng })
        setSearch(fallback)
        onChangeRef.current(fallback, { lat, lng })
        setPin(lat, lng)
      } finally {
        setLoadingMapa(false)
      }
    })

    // Cleanup al desmontar
    return () => {
      map.remove()
      mapRef.current = null
      markerRef.current = null
    }
  }, []) // ← intencionalmente vacío: solo se monta 1 vez

  // ─── Búsqueda por texto (Nominatim) ──────────────────────
  async function handleSearch() {
    const q = search.trim()
    if (!q) return
    setBuscando(true)
    setError('')
    try {
      const url = new URL('https://nominatim.openstreetmap.org/search')
      url.searchParams.set('q', q)
      url.searchParams.set('format', 'json')
      url.searchParams.set('limit', '1')
      url.searchParams.set('addressdetails', '1')

      const res = await fetch(url.toString(), {
        headers: { Accept: 'application/json' },
      })
      if (!res.ok) throw new Error('Error en la búsqueda')
      const results = (await res.json()) as Array<NominatimResult>
      if (results.length === 0) {
        setError('No se encontró la dirección. Probá ser más específico.')
        return
      }
      const r = results[0]
      const lat = Number(r.lat)
      const lng = Number(r.lon)
      // Dirección legible corta: "Ciudad, Provincia, País"
      // Si no hay addressdetails, caemos al display_name.
      const direccion = formatShortAddress(r)

      setCoords({ lat, lng })
      setSearch(direccion)
      onChangeRef.current(direccion, { lat, lng })

      // Mover mapa + pin
      const map = mapRef.current
      if (map) {
        // invalidateSize por si el contenedor cambió de tamaño
        map.invalidateSize()
        map.setView([lat, lng], 16, { animate: true })
        if (markerRef.current) {
          markerRef.current.setLatLng([lat, lng])
        } else {
          markerRef.current = L.marker([lat, lng]).addTo(map)
        }
      }
    } catch {
      setError('No se pudo buscar la dirección. Verificá tu conexión.')
    } finally {
      setBuscando(false)
    }
  }

  function handleClear() {
    setCoords(null)
    setSearch('')
    onChangeRef.current('', null)
    if (markerRef.current && mapRef.current) {
      mapRef.current.removeLayer(markerRef.current)
      markerRef.current = null
    }
  }

  return (
    <div className="space-y-2">
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
            placeholder="Buscá una dirección (ej: Av. Amazonas, Quito)"
            className="w-full pl-9 pr-3 py-2.5 bg-muted border border-border text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/60 transition-colors"
            style={{ borderRadius: '0.25rem', fontFamily: "'DM Sans', sans-serif" }}
          />
        </div>
        <button
          type="button"
          onClick={() => void handleSearch()}
          disabled={buscando || !search.trim()}
          className="px-4 py-2.5 bg-secondary text-secondary-foreground text-sm font-semibold hover:bg-secondary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          style={{ borderRadius: '0.25rem' }}
        >
          {buscando ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <Search size={14} />
          )}
          Buscar
        </button>
        {coords && (
          <button
            type="button"
            onClick={handleClear}
            className="px-3 py-2.5 bg-muted border border-border text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors"
            style={{ borderRadius: '0.25rem' }}
            aria-label="Limpiar selección"
          >
            <X size={14} />
          </button>
        )}
      </div>

      <div
        ref={containerRef}
        className="relative w-full h-52 border border-border overflow-hidden bg-muted"
        style={{ borderRadius: '0.25rem' }}
      >
        {loadingMapa && (
          <div className="absolute inset-0 z-[400] bg-background/50 flex items-center justify-center pointer-events-none">
            <Loader2 size={20} className="animate-spin text-primary" />
          </div>
        )}
      </div>

      <div
        className="flex items-center gap-2 text-xs text-muted-foreground"
        style={{ fontFamily: "'JetBrains Mono', monospace" }}
      >
        <MapPin size={11} className={coords ? 'text-primary' : ''} />
        {coords ? (
          <span>
            {coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}
          </span>
        ) : (
          <span>Hacé click en el mapa o buscá una dirección ↑</span>
        )}
      </div>

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
    </div>
  )
}

// ──────────────────────────────────────────────────────────
//  Nominatim — reverse geocoding (gratis, sin key, 1 req/s)
// ──────────────────────────────────────────────────────────

type NominatimAddress = {
  city?: string
  town?: string
  village?: string
  municipality?: string
  hamlet?: string
  suburb?: string
  county?: string
  state?: string
  region?: string
  country?: string
}

type NominatimResult = {
  lat: string
  lon: string
  display_name: string
  address?: NominatimAddress
}

/** Devuelve la primera ciudad disponible, en orden de preferencia. */
function pickCity(addr: NominatimAddress | undefined): string | null {
  if (!addr) return null
  return (
    addr.city ??
    addr.town ??
    addr.municipality ??
    addr.village ??
    addr.hamlet ??
    addr.suburb ??
    addr.county ??
    null
  )
}

/** Devuelve la primera provincia/estado disponible. */
function pickState(addr: NominatimAddress | undefined): string | null {
  if (!addr) return null
  return addr.state ?? addr.region ?? null
}

/**
 * Arma una dirección corta en formato "Ciudad, Provincia, País".
 * Omite los segmentos vacíos o duplicados (ej. si la ciudad y la provincia
 * se llaman igual, no repite).
 * Si no hay info suficiente, cae al `display_name` de Nominatim.
 */
function formatShortAddress(r: NominatimResult): string {
  const city = pickCity(r.address)
  const state = pickState(r.address)
  const country = r.address?.country ?? null

  const parts: string[] = []
  if (city && city !== state) parts.push(city)
  if (state) parts.push(state)
  if (country && country !== state) parts.push(country)

  if (parts.length === 0) return r.display_name
  return parts.join(', ')
}

async function reverseGeocode(lat: number, lng: number): Promise<string> {
  const url = new URL('https://nominatim.openstreetmap.org/reverse')
  url.searchParams.set('lat', String(lat))
  url.searchParams.set('lon', String(lng))
  url.searchParams.set('format', 'json')
  url.searchParams.set('zoom', '18')
  url.searchParams.set('addressdetails', '1')

  const res = await fetch(url.toString(), {
    headers: { Accept: 'application/json' },
  })
  if (!res.ok) throw new Error('reverse geocoding failed')
  const data = (await res.json()) as NominatimResult
  return formatShortAddress(data)
}
