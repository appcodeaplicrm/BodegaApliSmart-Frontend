/**
 * Gráfico de línea: km acumulados por fecha.
 *
 * Usa Recharts (ya instalado en el package.json). Muestra el avance
 * del proyecto en el tiempo: cada punto es la suma acumulada de
 * `kmAvanzadosEnEstaFecha` hasta esa fecha.
 *
 * Si no hay avances, no se renderiza (la vista padre ya tiene un check).
 */
import { useMemo } from 'react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
} from 'recharts'
import type { AvanceListItem } from './types'

type Punto = {
  fecha: string
  fechaCorta: string
  kmAcumulado: number
}

export function GraficoAvance({ avances }: { avances: AvanceListItem[] }) {
  const data = useMemo<Punto[]>(() => {
    if (avances.length === 0) return []
    // Ordenar por fecha ascendente.
    //
    // IMPORTANTE: NO acumular acá. El `kmAvanzadosEnEstaFecha` que
    // devuelve el back ya ES el valor absoluto del nodo (km del
    // recorrido HASTA ese nodo), NO el delta. Si sumáramos, estaríamos
    // contando la ruta 2 veces (pej: 1.16 + 2.36 + 3.42 = 6.94 cuando
    // la ruta real es 4.41). Ver doc en `avances.service.ts` →
    // `recalcularKmAvanzadosTx`.
    //
    // Lo que mostramos es la "posición en la ruta" que alcanzó el
    // proyecto en cada fecha. El back garantiza que estos valores
    // vienen ordenados correctamente del modelo de trazabilidad N → N+1.
    const ordenados = [...avances].sort((a, b) =>
      a.fechaAvance.localeCompare(b.fechaAvance),
    )
    return ordenados.map((a) => {
      const d = new Date(a.fechaAvance)
      return {
        fecha: a.fechaAvance,
        fechaCorta: d.toLocaleDateString('es-CO', { day: '2-digit', month: 'short' }),
        kmAcumulado: Math.round(a.kmAvanzadosEnEstaFecha * 100) / 100,
      }
    })
  }, [avances])

  if (data.length === 0) {
    return null
  }

  return (
    <div className="w-full" style={{ height: 240 }}>
      <ResponsiveContainer>
        <LineChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
          <XAxis
            dataKey="fechaCorta"
            tick={{ fontSize: 10, fill: 'currentColor' }}
            stroke="rgba(255,255,255,0.2)"
          />
          <YAxis
            tick={{ fontSize: 10, fill: 'currentColor' }}
            stroke="rgba(255,255,255,0.2)"
            label={{
              value: 'km',
              angle: -90,
              position: 'insideLeft',
              style: { fontSize: 10, fill: 'currentColor' },
            }}
          />
          <Tooltip
            contentStyle={{
              background: 'rgba(20,20,20,0.95)',
              border: '1px solid rgba(255,255,255,0.15)',
              borderRadius: 4,
              fontSize: 12,
            }}
            labelStyle={{ color: '#fff' }}
            formatter={(v: number) => [`${v} km`, 'Acumulado']}
          />
          <Line
            type="monotone"
            dataKey="kmAcumulado"
            stroke="var(--color-primary, #ff5c00)"
            strokeWidth={2}
            dot={{ r: 3 }}
            activeDot={{ r: 5 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
