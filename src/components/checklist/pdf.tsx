/**
 * Generador de PDF del historial de checklist.
 *
 * Usa @react-pdf/renderer (la misma lib que `src/lib/pdf.tsx` para
 * pedidos). El back NO participa: el front arma el PDF con los datos
 * que ya tiene la fila del historial + el detalle de la asignación
 * (que incluye fotos y observaciones por ítem).
 *
 * Layout (basado en el mockup "Lista de Verificación"):
 *  1. Header con marca "LISTA DE VERIFICACIÓN" + título del checklist
 *  2. Grid RESPONSABLE / DEPARTAMENTO / FECHA
 *  3. Barra de progreso + "X de Y ítems completados"
 *  4. Lista de ítems con ✓ / ✗ iconos. OK tachado, pendiente con
 *    borde, NO OK con motivo en rojo.
 *  5. Galería de fotos (solo si hay): una por ítem, con su nombre y
 *    motivo (si fue NO OK) abajo.
 *  6. Observación general (si hay).
 *  7. Footer con paginación.
 */
import { Document, Page, Text, View, StyleSheet, Image, pdf } from '@react-pdf/renderer'
import type { CkHistorialItem } from './types'
import type { CkAsignacionDetalle } from './types'
import { imageUrl } from '../../lib/apiBase'

/* ─── Paleta ─────────────────────────────────────────────── */

const COLORS = {
  fg: '#1B1B1B',
  muted: '#6B7280',
  // Resultado
  aprobadoBg: '#D1FADF',
  aprobadoFg: '#054F31',
  aprobadoLine: '#12B76A',
  aprobadoIcon: '#039855',
  // Pendiente
  pendienteBg: '#FFFFFF',
  pendienteFg: '#1B1B1B',
  pendienteBorder: '#D0D5DD',
  // Rechazado / NO OK
  rechazadoBg: '#FEE4E2',
  rechazadoFg: '#8B1F1A',
  rechazadoLine: '#E8593F',
  rechazadoIcon: '#D92D20',
  // Neutrales
  card: '#FFFFFF',
  page: '#FFFFFF',
  border: '#E5E7EB',
  borderStrong: '#D0D5DD',
  brand: '#E8593F',
}

const s = StyleSheet.create({
  page: {
    backgroundColor: COLORS.page,
    color: COLORS.fg,
    padding: 36,
    paddingBottom: 56,
    fontSize: 10,
    fontFamily: 'Helvetica',
  },

  // ─── Brand + título ──────────────────────────────────────
  brand: {
    fontSize: 8,
    color: COLORS.muted,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  title: {
    fontSize: 20,
    fontWeight: 700,
    color: COLORS.fg,
    marginBottom: 14,
  },
  divider: {
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    borderBottomStyle: 'solid',
    marginBottom: 12,
  },

  // ─── Grid RESPONSABLE / ROL / DESTINATARIO / FECHA ──────────
  infoGrid: {
    flexDirection: 'row',
    marginHorizontal: -4,
    marginBottom: 12,
  },
  infoCell: {
    flex: 1,
    paddingHorizontal: 4,
  },
  infoLabel: {
    fontSize: 7,
    color: COLORS.muted,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  infoValue: {
    fontSize: 10,
    color: COLORS.fg,
  },

  // ─── Barra de progreso ───────────────────────────────────
  progressBox: {
    backgroundColor: '#F2F4F7',
    borderRadius: 4,
    padding: 8,
    marginBottom: 14,
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  progressText: {
    fontSize: 9,
    color: COLORS.muted,
  },
  progressPct: {
    fontSize: 12,
    fontWeight: 700,
    color: COLORS.fg,
  },
  progressBarBg: {
    height: 6,
    backgroundColor: COLORS.border,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: 6,
    backgroundColor: COLORS.aprobadoLine,
  },

  // ─── Lista de ítems ──────────────────────────────────────
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: COLORS.pendienteBorder,
    marginBottom: 6,
  },
  itemRowOk: {
    backgroundColor: COLORS.aprobadoBg,
    borderColor: COLORS.aprobadoLine,
  },
  itemRowNo: {
    backgroundColor: COLORS.rechazadoBg,
    borderColor: COLORS.rechazadoLine,
  },
  itemIcon: {
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  itemIconOk: { backgroundColor: COLORS.aprobadoIcon },
  itemIconNo: { backgroundColor: COLORS.rechazadoIcon },
  itemIconPending: {
    backgroundColor: COLORS.page,
    borderWidth: 1,
    borderColor: COLORS.pendienteBorder,
    borderStyle: 'solid',
  },
  itemTextWrap: { flex: 1 },
  itemText: {
    fontSize: 10,
    color: COLORS.fg,
  },
  itemTextOk: {
    textDecoration: 'line-through',
    color: COLORS.muted,
  },
  itemMotivo: {
    fontSize: 8,
    color: COLORS.rechazadoFg,
    marginTop: 2,
    fontStyle: 'italic',
  },
  itemIconCheck: {
    color: COLORS.page,
    fontSize: 10,
    fontWeight: 700,
  },
  itemIconX: {
    color: COLORS.page,
    fontSize: 10,
    fontWeight: 700,
  },

  // ─── Sección de fotos ────────────────────────────────────
  photosTitle: {
    fontSize: 8,
    color: COLORS.muted,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginTop: 16,
    marginBottom: 8,
  },
  photoCard: {
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: COLORS.border,
    borderRadius: 4,
    padding: 8,
    marginBottom: 8,
  },
  photoFrame: {
    width: '100%',
    height: 220,
    objectFit: 'contain',
    backgroundColor: '#F9FAFB',
    marginBottom: 6,
  },
  photoEmpty: {
    width: '100%',
    height: 100,
    backgroundColor: '#F9FAFB',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: COLORS.border,
    borderRadius: 4,
    marginBottom: 6,
  },
  photoEmptyText: {
    fontSize: 8,
    color: COLORS.muted,
  },
  photoItemLabel: {
    fontSize: 9,
    color: COLORS.fg,
    fontWeight: 700,
    marginBottom: 2,
  },
  photoMotivo: {
    fontSize: 8,
    color: COLORS.rechazadoFg,
    fontStyle: 'italic',
  },

  // ─── Observación general ─────────────────────────────────
  generalBox: {
    marginTop: 12,
    padding: 10,
    backgroundColor: '#F9FAFB',
    borderRadius: 4,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: COLORS.borderStrong,
  },
  generalLabel: {
    fontSize: 7,
    color: COLORS.muted,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  generalText: { fontSize: 9, color: COLORS.fg },

  // ─── Footer ─────────────────────────────────────────────
  footer: {
    position: 'absolute',
    bottom: 24,
    left: 36,
    right: 36,
    flexDirection: 'row',
    justifyContent: 'space-between',
    fontSize: 8,
    color: COLORS.muted,
  },
})

/* ─── Tipos ──────────────────────────────────────────────── */

type PdfInput = {
  /** Header: nombre de la plantilla. */
  titulo: string
  /** Para el grid de info. */
  /** Quien ejecutó el checklist (técnico / operador). */
  responsable: string
  /** ROL que tenía ese usuario al momento de la ejecución. */
  responsableRol: string
  /** A quién se le hizo el checklist. En la mayoría de los casos coincide
   * con `responsable` (un técnico se hace su propio checklist), pero
   * si en el futuro se permite que un supervisor ejecute en nombre de
   * otro, este campo lo distingue. */
  destinatario: string
  /** ISO; la mostramos formateada. */
  fecha: string
  /** Estado final (aprobado/observaciones/rechazado). */
  resultado: 'aprobado' | 'observaciones' | 'rechazado'
  /** Total de ítems. */
  total: number
  /** Ítems OK. */
  okCount: number
  /** Ítems con foto y motivo. */
  items: Array<{
    id: string
    texto: string
    ok: boolean | null
    observacion: string | null
    /**
     * Data URL embebida (`data:image/png;base64,...`). Se pasa
     * directo al `<Image src={...}>`. Si es null, el PDF muestra
     * un placeholder.
     */
    fotoDataUrl: string | null
  }>
  /** Observación general al pie. */
  observacionGeneral: string | null
}

/* ─── Helpers ────────────────────────────────────────────── */

/**
 * Descarga una imagen y la devuelve como `Uint8Array` (binario crudo).
 *
 * En `@react-pdf/renderer` v4 hay un bug conocido: pasar el `src`
 * de `<Image>` como string (URL o data URL) **funciona en el
 * PDFViewer pero NO en `toBlob()`** (issue #1072, #1143). La única
 * forma que SÍ funciona consistentemente es pasar la imagen como
 * objeto: `{ data: Uint8Array, format: 'png' | 'jpeg' }`.
 *
 * Por eso pre-descargamos la imagen en el browser y la convertimos
 * a `Uint8Array` antes de armar el PDF.
 */
async function fetchAsDataUrl(src: string | null): Promise<string | null> {
  if (!src) return null
  try {
    // Sin `credentials: 'include'`: las imágenes de /uploads son
    // públicas y el `Access-Control-Allow-Origin: *` del back es
    // incompatible con credenciales.
    const res = await fetch(src, { mode: 'cors' })
    if (!res.ok) return null
    const blob = await res.blob()
    return await new Promise<string | null>((resolve) => {
      const reader = new FileReader()
      reader.onloadend = () =>
        resolve(typeof reader.result === 'string' ? reader.result : null)
      reader.onerror = () => resolve(null)
      reader.readAsDataURL(blob)
    })
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error('[checklist-pdf] No se pudo descargar la imagen:', src, e)
    return null
  }
}

function formatFechaHora(iso: string): string {
  try {
    const d = new Date(iso)
    const dd = String(d.getDate()).padStart(2, '0')
    const mm = String(d.getMonth() + 1).padStart(2, '0')
    const yy = String(d.getFullYear())
    const hh = String(d.getHours()).padStart(2, '0')
    const min = String(d.getMinutes()).padStart(2, '0')
    return `${dd}/${mm}/${yy} ${hh}:${min}`
  } catch {
    return iso
  }
}

function resultadoAccent(r: PdfInput['resultado']): string {
  if (r === 'aprobado') return COLORS.aprobadoLine
  if (r === 'observaciones') return '#F79009'
  return COLORS.rechazadoLine
}

/* ─── Componente principal ───────────────────────────────── */

function ChecklistPDF({ input }: { input: PdfInput }) {
  const okPercent = input.total > 0 ? Math.round((input.okCount / input.total) * 100) : 0
  const accent = resultadoAccent(input.resultado)
  const itemsConFoto = input.items.filter((i) => !!i.fotoDataUrl)
  const hasObservacionGeneral = !!input.observacionGeneral?.trim()

  return (
    <Document>
      <Page size="A4" style={s.page}>
        {/* Brand + título */}
        <Text style={s.brand}>LISTA DE VERIFICACIÓN</Text>
        <Text style={s.title}>{input.titulo}</Text>
        <View style={s.divider} />

        {/* Grid info: Responsable / ROL / Destinatario / Fecha+hora */}
        <View style={s.infoGrid}>
          <View style={s.infoCell}>
            <Text style={s.infoLabel}>RESPONSABLE</Text>
            <Text style={s.infoValue}>{input.responsable}</Text>
          </View>
          <View style={s.infoCell}>
            <Text style={s.infoLabel}>ROL</Text>
            <Text style={s.infoValue}>{input.responsableRol}</Text>
          </View>
          <View style={s.infoCell}>
            <Text style={s.infoLabel}>NOMBRE</Text>
            <Text style={s.infoValue}>{input.destinatario}</Text>
          </View>
          <View style={s.infoCell}>
            <Text style={s.infoLabel}>HORA Y FECHA</Text>
            <Text style={s.infoValue}>{formatFechaHora(input.fecha)}</Text>
          </View>
        </View>

        {/* Barra de progreso */}
        <View style={s.progressBox}>
          <View style={s.progressRow}>
            <Text style={s.progressText}>
              {input.okCount} de {input.total} ítems completados
            </Text>
            <Text style={[s.progressPct, { color: accent }]}>{okPercent}%</Text>
          </View>
          <View style={s.progressBarBg}>
            <View
              style={[s.progressBarFill, { width: `${okPercent}%`, backgroundColor: accent }]}
            />
          </View>
        </View>

        {/* Lista de ítems */}
        {input.items.map((it, idx) => {
          const isOk = it.ok === true
          const isNo = it.ok === false
          const rowStyle = isOk
            ? [s.itemRow, s.itemRowOk]
            : isNo
              ? [s.itemRow, s.itemRowNo]
              : [s.itemRow]
          const iconStyle = isOk
            ? [s.itemIcon, s.itemIconOk]
            : isNo
              ? [s.itemIcon, s.itemIconNo]
              : [s.itemIcon, s.itemIconPending]
          return (
            <View key={it.id} style={rowStyle} wrap={false}>
              <View style={iconStyle}>
                <Text
                  style={
                    isOk
                      ? s.itemIconCheck
                      : isNo
                        ? s.itemIconX
                        : { fontSize: 8, color: COLORS.muted }
                  }
                >
                  {isOk ? '✓' : isNo ? '✗' : '○'}
                </Text>
              </View>
              <View style={s.itemTextWrap}>
                <Text style={[s.itemText, isOk ? s.itemTextOk : {}]}>
                  {String(idx + 1).padStart(2, '0')} · {it.texto}
                </Text>
                {isNo && it.observacion && (
                  <Text style={s.itemMotivo}>Motivo: {it.observacion}</Text>
                )}
              </View>
            </View>
          )
        })}

        {/* Galería de fotos */}
        {itemsConFoto.length > 0 && (
          <>
            <Text style={s.photosTitle}>EVIDENCIA FOTOGRÁFICA</Text>
            {itemsConFoto.map((it) => {
              const isNo = it.ok === false
              return (
                <View key={`photo-${it.id}`} style={s.photoCard} wrap={false}>
                  <Text style={s.photoItemLabel}>{it.texto}</Text>
                  {it.fotoDataUrl ? (
                    // Pasamos la imagen como OBJETO con data + format.
                    // Esta es la única forma que funciona consistente
                    // con `toBlob()` en @react-pdf/renderer v4
                    // (issue #1072, #1143).
                    <Image src={it.fotoDataUrl} style={s.photoFrame} />
                  ) : (
                    <View style={s.photoEmpty}>
                      <Text style={s.photoEmptyText}>Foto no disponible</Text>
                    </View>
                  )}
                  {isNo && it.observacion && (
                    <Text style={s.photoMotivo}>Motivo: {it.observacion}</Text>
                  )}
                </View>
              )
            })}
          </>
        )}

        {/* Observación general */}
        {hasObservacionGeneral && (
          <View style={s.generalBox} wrap={false}>
            <Text style={s.generalLabel}>OBSERVACIÓN GENERAL</Text>
            <Text style={s.generalText}>{input.observacionGeneral}</Text>
          </View>
        )}

        {/* Footer */}
        <View style={s.footer} fixed>
          <Text>StockPro · Checklist de Instrumentos</Text>
          <Text
            render={({ pageNumber, totalPages }) =>
              `Página ${pageNumber} de ${totalPages}`
            }
          />
        </View>
      </Page>
    </Document>
  )
}

/* ─── API pública ────────────────────────────────────────── */

/**
 * Helper: a partir de un `CkAsignacionDetalle` y un `CkHistorialItem`
 * (o datos sueltos del resumen), arma el PDF. Se usa desde el botón
 * PDF de la tabla de historial.
 *
 * Las fotos se pre-descargan como `Uint8Array` **antes** de armar
 * el PDF. Esto es necesario por un bug de @react-pdf/renderer v4
 * con `toBlob()`: el `src` como string (URL o data URL) no embebe
 * la imagen en el PDF descargado. La única forma que SÍ funciona
 * es pasar `src={{ data: Uint8Array, format: 'png' }}`.
 */
export async function descargarPdfDetalle(
  detalle: CkAsignacionDetalle,
): Promise<void> {
  // 1) Pre-descargar todas las fotos como Uint8Array en paralelo.
  const fotosData = await Promise.all(
    detalle.items.map(async (i) => {
      const src = imageUrl(i.fotoKey) || imageUrl(i.fotoUrl)
      return [i.itemId, await fetchAsDataUrl(src)] as const
    }),
  )
  const fotoMap = new Map(fotosData)

  // 2) Armar el input con las fotos embebidas como binarios.
  const input: PdfInput = {
    titulo: detalle.plantilla.nombre,
    responsable: detalle.tecnico.nombre,
    responsableRol: '—', // TODO si después querés que el back lo devuelva
    destinatario: detalle.tecnico.nombre, // mismo usuario por ahora
    fecha: detalle.finishedAt ?? new Date().toISOString(),
    resultado:
      detalle.resultado ?? (detalle.estado === 'vencido' ? 'rechazado' : 'observaciones'),
    total: detalle.totalItems,
    okCount: detalle.okCount,
    items: detalle.items.map((i) => ({
      id: i.itemId,
      texto: i.texto,
      ok: i.ok,
      observacion: i.observacion,
      fotoDataUrl: fotoMap.get(i.itemId) ?? null,
    })),
    observacionGeneral: detalle.observacion,
  }
  const blob = await pdf(<ChecklistPDF input={input} />).toBlob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `checklist-${detalle.id}.pdf`
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 0)
}

/**
 * Compat: descarga el PDF de una fila del historial usando solo el
 * resumen (sin fotos ni observaciones por ítem). El back devuelve
 * `CkHistorialItem` que es liviano. Para el PDF rico, usá
 * `descargarPdfDetalle` que ya consume `obtenerAsignacion`.
 */
export async function descargarPdfHistorial(item: CkHistorialItem): Promise<void> {
  const input: PdfInput = {
    titulo: item.plantilla,
    responsable: item.tecnico,
    responsableRol: item.rol,
    destinatario: item.tecnico,
    fecha: item.fecha,
    resultado: item.resultado,
    total: item.total,
    okCount: item.ok,
    items: Array.from({ length: item.total }, (_, i) => ({
      id: `hist-${i}`,
      texto: `Ítem ${i + 1}`,
      ok: i < item.ok,
      observacion: null,
      fotoDataUrl: null,
    })),
    observacionGeneral: null,
  }
  const blob = await pdf(<ChecklistPDF input={input} />).toBlob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `checklist-${item.id}.pdf`
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 0)
}

// Re-export del helper de @react-pdf/renderer para no importar dos veces.
// (Importado arriba junto con los demás componentes de @react-pdf/renderer.)
