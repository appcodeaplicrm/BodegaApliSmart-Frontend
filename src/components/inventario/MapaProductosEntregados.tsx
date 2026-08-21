import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

export type PuntoProductoEntregado = {
  id: string
  serial: string
  latitud: number
  longitud: number
  producto: { nombre: string; codigo: string }
  tecnico: string
}

export function MapaProductosEntregados({
  puntos,
  onSelect,
}: {
  puntos: PuntoProductoEntregado[]
  onSelect: (id: string) => void
}) {
  const container = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    if (!container.current) return
    const center: L.LatLngExpression = puntos.length
      ? [puntos[0].latitud, puntos[0].longitud]
      : [-0.1807, -78.4678]
    const map = L.map(container.current, { center, zoom: puntos.length ? 15 : 7 })
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap',
    }).addTo(map)
    const bounds: L.LatLngExpression[] = []
    puntos.forEach((punto) => {
      const pos: L.LatLngExpression = [punto.latitud, punto.longitud]
      bounds.push(pos)
      const marker = L.marker(pos, {
        icon: L.divIcon({
          className: '',
          html: '<div style="width:32px;height:32px;border-radius:50%;background:#ef5b42;border:3px solid #242424;box-shadow:0 0 0 2px rgba(239,91,66,.35);display:grid;place-items:center;color:#fff;font:bold 15px system-ui">●</div>',
          iconSize: [32, 32], iconAnchor: [16, 16],
        }),
      }).addTo(map).bindTooltip(
        `<strong>${escapeHtml(punto.producto.nombre)}</strong><br>Serial: ${escapeHtml(punto.serial)}<br><small>${escapeHtml(punto.tecnico)}</small>`,
        { direction: 'top', offset: [0, -14] },
      )
      marker.on('click', () => onSelect(punto.id))
    })
    if (bounds.length > 1) map.fitBounds(L.latLngBounds(bounds), { padding: [45, 45], maxZoom: 17 })
    const resize = new ResizeObserver(() => map.invalidateSize())
    resize.observe(container.current)
    return () => { resize.disconnect(); map.remove() }
  }, [puntos, onSelect])
  return <div ref={container} className="h-[420px] lg:h-[calc(100vh-150px)] min-h-[420px] w-full border border-border bg-[#1d1d1d] z-0" />
}

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[char]!)
}
