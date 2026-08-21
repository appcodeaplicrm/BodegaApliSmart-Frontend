import { useEffect, useMemo, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { MapPin } from 'lucide-react'

export type PuntoReporteUso = {
  id: string
  latitud: number
  longitud: number
  titulo: string
  detalle?: string
}

export function MapaReporteUso({ puntos }: { puntos: PuntoReporteUso[] }) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<L.Map | null>(null)

  const agrupados = useMemo(() => {
    const groups = new Map<string, PuntoReporteUso[]>()
    puntos.forEach((punto) => {
      const key = `${punto.latitud.toFixed(6)},${punto.longitud.toFixed(6)}`
      groups.set(key, [...(groups.get(key) ?? []), punto])
    })
    return [...groups.values()]
  }, [puntos])

  useEffect(() => {
    if (!containerRef.current || mapRef.current || agrupados.length === 0) return
    const primero = agrupados[0][0]
    const map = L.map(containerRef.current, {
      center: [primero.latitud, primero.longitud],
      zoom: 16,
      zoomControl: true,
    })
    mapRef.current = map
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap',
    }).addTo(map)

    const bounds: L.LatLngExpression[] = []
    agrupados.forEach((grupo, index) => {
      const punto = grupo[0]
      const position: L.LatLngExpression = [punto.latitud, punto.longitud]
      bounds.push(position)
      const marker = L.marker(position, {
        icon: L.divIcon({
          className: '',
          html: `<div style="width:34px;height:34px;border-radius:50%;background:#ef5b42;border:3px solid #242424;box-shadow:0 0 0 2px rgba(239,91,66,.45),0 8px 20px rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center;color:white;font:bold 12px system-ui">${index + 1}</div>`,
          iconSize: [34, 34],
          iconAnchor: [17, 17],
        }),
      }).addTo(map)
      const contenido = grupo.map((item) => `<div style="margin-bottom:7px"><strong>${escapeHtml(item.titulo)}</strong>${item.detalle ? `<br><span>${escapeHtml(item.detalle)}</span>` : ''}</div>`).join('')
      marker.bindPopup(`<div style="min-width:180px">${contenido}<small>${punto.latitud.toFixed(6)}, ${punto.longitud.toFixed(6)}</small></div>`)
    })
    if (bounds.length > 1) map.fitBounds(L.latLngBounds(bounds), { padding: [45, 45], maxZoom: 17 })

    const resize = new ResizeObserver(() => map.invalidateSize())
    resize.observe(containerRef.current)
    window.setTimeout(() => map.invalidateSize(), 100)
    return () => {
      resize.disconnect()
      map.remove()
      mapRef.current = null
    }
  }, [agrupados])

  if (puntos.length === 0) {
    return <div className="h-[280px] lg:h-[460px] border border-dashed border-border flex flex-col items-center justify-center text-center text-muted-foreground"><MapPin size={24} className="mb-2 opacity-60" /><span className="text-sm">No hay coordenadas disponibles.</span></div>
  }

  return <div ref={containerRef} className="h-[300px] lg:h-[460px] w-full bg-[#1d1d1d] border border-border z-0" aria-label="Mapa de ubicación de los recursos" />
}

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[char]!)
}
