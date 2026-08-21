import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { Loader2, MapPin } from 'lucide-react'

// Fix: Leaflet no carga los íconos por defecto en Vite.
import iconUrl from 'leaflet/dist/images/marker-icon.png'
import iconRetinaUrl from 'leaflet/dist/images/marker-icon-2x.png'
import shadowUrl from 'leaflet/dist/images/marker-shadow.png'

L.Icon.Default.mergeOptions({
  iconUrl,
  iconRetinaUrl,
  shadowUrl,
})

import type { ProyectoNodo } from './types'

/**
 * Punto a marcar en el mapa por un avance (no es un nodo del recorrido,
 * es un pin rojo que muestra "se llegó acá en este avance").
 */
export type AvancePin = {
  id: string
  /** ID del nodo al que se llegó con este avance (si lo tiene). */
  nodoId?: string | null
  latitud: number
  longitud: number
  titulo: string
  descripcion?: string
  fecha?: string
  kmAvanzadosEnEstaFecha?: number
}

type Props = {
  nodos: ProyectoNodo[]
  /** Avances con coordenadas (no todos los avances las tienen). */
  avances?: AvancePin[]
  /** Alto en px. Default 420. */
  height?: number
  /** Cuando es true, el mapa se ajusta para mostrar toda la ruta. */
  fitBounds?: boolean
  /** Mensaje cuando no hay nodos. */
  emptyMessage?: string
}

const COLORES_TIPO: Record<ProyectoNodo['tipo'], string> = {
  inicio: '#22c55e', // verde
  intermedio: '#3b82f6', // azul
  fin: '#ef4444', // rojo
}

const LABEL_TIPO: Record<ProyectoNodo['tipo'], string> = {
  inicio: 'Inicio',
  intermedio: 'Intermedio',
  fin: 'Fin',
}

/**
 * Mapa read-only con la ruta del proyecto.
 *  - Pines numerados (1..N) según orden.
 *  - Color por tipo (inicio=verde, intermedio=azul, fin=rojo).
 *  - Polilínea conectando los nodos.
 *  - Pines rojos opcionales para los avances (si tienen coords).
 *  - Popup por nodo con kmAcumulado + nombre + tipo.
 */
export function MapaNodos({
  nodos,
  avances = [],
  height = 420,
  fitBounds = true,
  emptyMessage = 'Este proyecto aún no tiene nodos en el mapa. Podés agregar el recorrido desde la tab "Mapa".',
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const layersRef = useRef<L.Layer[]>([])
  const loadingRef = useRef(true)

  useEffect(() => {
    loadingRef.current = true
  }, [nodos, avances])

  // Init del mapa (1 vez)
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return

    const map = L.map(containerRef.current, {
      center: [4.711, -74.0721],
      zoom: 12,
      zoomControl: true,
    })
    mapRef.current = map

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map)

    setTimeout(() => map.invalidateSize(), 0)
    setTimeout(() => map.invalidateSize(), 300)

    return () => {
      map.remove()
      mapRef.current = null
      layersRef.current = []
    }
  }, [])

  // Redibuja pines + línea cada vez que cambian los nodos/avances
  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    // Limpiar layers previos
    for (const layer of layersRef.current) {
      map.removeLayer(layer)
    }
    layersRef.current = []

    if (nodos.length === 0) {
      loadingRef.current = false
      return
    }

    const latLngs: L.LatLngExpression[] = []

    // Pines de los nodos (numerados, color por tipo)
    for (const n of nodos) {
      const pos: L.LatLngExpression = [n.latitud, n.longitud]
      latLngs.push(pos)

      const icon = L.divIcon({
        className: 'proyecto-nodo-pin',
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
            border: 2px solid white;
            border-radius: 50%;
            font-weight: 700;
            font-size: 12px;
            box-shadow: 0 2px 6px rgba(0,0,0,0.3);
            font-family: 'JetBrains Mono', monospace;
          ">${n.orden}</div>
        `,
        iconSize: [32, 32],
        iconAnchor: [16, 16],
      })

      const popup = `
        <div style="font-family: 'DM Sans', sans-serif; min-width: 180px;">
          <div style="
            display: inline-block;
            padding: 2px 6px;
            background: ${COLORES_TIPO[n.tipo]};
            color: white;
            font-size: 9px;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            margin-bottom: 4px;
            border-radius: 2px;
            font-family: 'JetBrains Mono', monospace;
          ">${LABEL_TIPO[n.tipo]} · Nodo ${n.orden}</div>
          <div style="font-weight: 600; font-size: 13px; margin-bottom: 2px;">
            ${escapeHtml(n.nombre ?? `Nodo ${n.orden}`)}
          </div>
          <div style="font-size: 11px; color: #6b7280; font-family: 'JetBrains Mono', monospace;">
            ${n.kmAcumulado.toFixed(2)} km
          </div>
          <div style="font-size: 10px; color: #9ca3af; margin-top: 4px; font-family: 'JetBrains Mono', monospace;">
            ${n.latitud.toFixed(5)}, ${n.longitud.toFixed(5)}
          </div>
        </div>
      `

      const marker = L.marker(pos, { icon }).bindPopup(popup).addTo(map)
      layersRef.current.push(marker)
    }

    // Polilínea conectando los nodos
    if (nodos.length >= 2) {
      const polyline = L.polyline(latLngs, {
        color: '#3b82f6',
        weight: 3,
        opacity: 0.7,
        dashArray: '6, 6',
      }).addTo(map)
      layersRef.current.push(polyline)
    }

    // Pines de los avances (rojos, más chicos)
    if (avances.length > 0) {
      for (const a of avances) {
        const pos: L.LatLngExpression = [a.latitud, a.longitud]
        const icon = L.divIcon({
          className: 'proyecto-avance-pin',
          html: `
            <div style="
              width: 16px;
              height: 16px;
              background: #ef4444;
              border: 2px solid white;
              border-radius: 50%;
              box-shadow: 0 0 0 2px rgba(239, 68, 68, 0.3);
            "></div>
          `,
          iconSize: [16, 16],
          iconAnchor: [8, 8],
        })
        const popup = `
          <div style="font-family: 'DM Sans', sans-serif; min-width: 160px;">
            <div style="font-weight: 600; font-size: 13px; margin-bottom: 4px;">
              ${escapeHtml(a.titulo)}
            </div>
            ${a.fecha ? `<div style="font-size: 11px; color: #6b7280;">${escapeHtml(a.fecha)}</div>` : ''}
            ${a.kmAvanzadosEnEstaFecha != null ? `<div style="font-size: 11px; color: #6b7280; font-family: 'JetBrains Mono', monospace;">+${a.kmAvanzadosEnEstaFecha.toFixed(2)} km</div>` : ''}
            ${a.descripcion ? `<div style="font-size: 11px; color: #6b7280; margin-top: 4px;">${escapeHtml(a.descripcion)}</div>` : ''}
          </div>
        `
        const marker = L.marker(pos, { icon }).bindPopup(popup).addTo(map)
        layersRef.current.push(marker)
      }
    }

    // Fit bounds a la ruta (o al centro del primer nodo si hay uno solo)
    if (fitBounds && latLngs.length > 0) {
      if (latLngs.length === 1) {
        map.setView(latLngs[0], 14, { animate: true })
      } else {
        map.fitBounds(L.latLngBounds(latLngs), { padding: [40, 40] })
      }
    }

    setTimeout(() => map.invalidateSize(), 50)
    loadingRef.current = false
  }, [nodos, avances, fitBounds])

  if (nodos.length === 0) {
    return (
      <div
        className="border border-dashed border-border bg-muted/20 p-8 text-center text-xs text-muted-foreground"
        style={{ borderRadius: '0.25rem' }}
      >
        <MapPin size={20} className="mx-auto mb-2 text-muted-foreground" />
        {emptyMessage}
      </div>
    )
  }

  return (
    <div className="relative z-0 proyecto-mapa-scope">
      <div
        ref={containerRef}
        className="w-full border border-border overflow-hidden bg-muted relative z-0 proyecto-mapa-scope"
        style={{ height, borderRadius: '0.25rem' }}
      />
      {/* Leyenda (queda ENCIMA del mapa porque está en el mismo
          stacking context que el `z-0` del padre, pero el padre
          ya está limitado a `z-0` así que el mapa no se puede
          "escapar" hacia el modal). */}
      <div
        className="absolute bottom-2 left-2 bg-background/90 border border-border px-2.5 py-1.5 text-[10px] flex items-center gap-3"
        style={{ borderRadius: '0.15rem', fontFamily: "'JetBrains Mono', monospace" }}
      >
        <span className="flex items-center gap-1.5">
          <span
            className="inline-block w-3 h-3 rounded-full"
            style={{ background: COLORES_TIPO.inicio }}
          />
          Inicio
        </span>
        <span className="flex items-center gap-1.5">
          <span
            className="inline-block w-3 h-3 rounded-full"
            style={{ background: COLORES_TIPO.intermedio }}
          />
          Intermedio
        </span>
        <span className="flex items-center gap-1.5">
          <span
            className="inline-block w-3 h-3 rounded-full"
            style={{ background: COLORES_TIPO.fin }}
          />
          Fin
        </span>
        {avances.length > 0 && (
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-3 h-3 rounded-full bg-destructive" />
            Avance
          </span>
        )}
      </div>
    </div>
  )
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
