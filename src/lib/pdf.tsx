import { Document, Page, Text, View, StyleSheet, Image, pdf } from '@react-pdf/renderer'
import type { Pedido, EntregaItem } from '../store/pedidos'
import { imageUrl } from './apiBase'

/* ─── Paleta clara tipo la captura ────────────────────────── */

const COLORS = {
  // Tipografía
  fg: '#1B1B1B',
  muted: '#6B7280',
  // Estados
  aprobadoBg: '#D1FADF',
  aprobadoFg: '#054F31',
  pendienteBg: '#FEF0C7',
  pendienteFg: '#7A4A00',
  canceladoBg: '#FEE4E2',
  canceladoFg: '#8B1F1A',
  // Tabla / cards
  card: '#FFFFFF',
  page: '#FFFFFF',
  border: '#E5E7EB',
  borderStrong: '#CBD2DA',
  accent: '#E8593F',
  // Etiquetas
  bodegaChipBg: '#FFF1EE',
  bodegaChipFg: '#9A2A1B',
  tecnicoChipBg: '#ECF7DD',
  tecnicoChipFg: '#3F5A1A',
  saltadoBg: '#F3F4F6',
  saltadoFg: '#6B7280',
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
  // ─── Header ────────────────────────────────────────────
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 18,
  },
  headerLeft: {
    flexDirection: 'column',
  },
  brand: {
    fontSize: 9,
    color: COLORS.muted,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  headerRight: {
    alignItems: 'flex-end',
  },
  codigo: {
    fontSize: 11,
    color: COLORS.muted,
    letterSpacing: 1,
    marginBottom: 4,
  },
  titulo: {
    fontSize: 22,
    fontWeight: 700,
    marginTop: 4,
  },

  // ─── Grid de info ──────────────────────────────────────
  section: {
    marginTop: 14,
  },
  sectionLabel: {
    fontSize: 8,
    color: COLORS.muted,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  infoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -4,
  },
  infoCell: {
    width: '50%',
    paddingHorizontal: 4,
    marginBottom: 10,
  },
  infoLabel: {
    fontSize: 7,
    color: COLORS.muted,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  infoValue: {
    fontSize: 11,
  },
  badge: {
    alignSelf: 'flex-start',
    paddingVertical: 3,
    paddingHorizontal: 8,
    fontSize: 9,
    fontWeight: 700,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },

  // ─── Motivo ────────────────────────────────────────────
  motivoBox: {
    border: `1 solid ${COLORS.borderStrong}`,
    padding: 8,
  },
  motivoText: { fontSize: 10 },

  // ─── Header de la sección de ítems ──────────────────────
  itemsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderStrong,
    borderBottomStyle: 'solid',
    paddingBottom: 6,
    marginBottom: 6,
  },
  itemsTitle: {
    fontSize: 11,
    color: COLORS.fg,
  },
  itemsCount: {
    fontSize: 9,
    color: COLORS.muted,
    letterSpacing: 1,
  },
  /**
   * Mini-tabla resumen de 2 columnas (Producto | Cantidad). Es la
   * "tabla" chiquita que va justo antes de los bloques de fotos.
   */
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#F9FAFB',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    borderBottomStyle: 'solid',
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  thProducto: {
    fontSize: 8,
    color: COLORS.muted,
    letterSpacing: 1,
    textTransform: 'uppercase',
    flex: 1,
  },
  thCantidad: {
    fontSize: 8,
    color: COLORS.muted,
    letterSpacing: 1,
    textTransform: 'uppercase',
    width: 60,
    textAlign: 'right',
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    borderBottomStyle: 'solid',
    paddingVertical: 6,
    paddingHorizontal: 8,
    alignItems: 'center',
    minHeight: 28,
  },
  tdProducto: {
    fontSize: 10,
    color: COLORS.fg,
    flex: 1,
    lineHeight: 1.3,
  },
  tdProductoSku: {
    fontSize: 8,
    color: COLORS.muted,
    letterSpacing: 0.5,
  },
  tdCantidad: {
    fontSize: 11,
    fontWeight: 700,
    color: COLORS.accent,
    width: 60,
    textAlign: 'right',
    lineHeight: 1.3,
  },

  // ─── Bloque por producto del pedido ────────────────────
  /**
   * Cada producto concreto (1 fila por DetallePedido, N filas si es kit)
   * muestra:
   *   - header con nombre, SKU, cantidad, total procesado
   *   - miniaturas del producto (de la galería)
   *   - fotos del bodeguero y del técnico (o "saltado")
   */
  productBlock: {
    border: `1 solid ${COLORS.border}`,
    padding: 10,
    marginBottom: 8,
  },
  productHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  productName: {
    fontSize: 11,
    fontWeight: 700,
    color: COLORS.fg,
    flex: 1,
    lineHeight: 1.3,
  },
  productMeta: {
    fontSize: 8,
    color: COLORS.muted,
    letterSpacing: 0.5,
  },
  productCantidad: {
    fontSize: 13,
    fontWeight: 700,
    color: COLORS.accent,
    marginLeft: 8,
    lineHeight: 1.3,
  },
  /** Etiqueta chip de quién tomó la foto. */
  chip: {
    fontSize: 7,
    letterSpacing: 1,
    textTransform: 'uppercase',
    fontWeight: 700,
    paddingVertical: 2,
    paddingHorizontal: 6,
  },
  chipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  chipBodega: {
    backgroundColor: COLORS.bodegaChipBg,
    color: COLORS.bodegaChipFg,
  },
  chipTecnico: {
    backgroundColor: COLORS.tecnicoChipBg,
    color: COLORS.tecnicoChipFg,
  },
  chipSaltado: {
    backgroundColor: COLORS.saltadoBg,
    color: COLORS.saltadoFg,
  },
  photosRow: {
    flexDirection: 'row',
  },
  photoCell: {
    flex: 1,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: COLORS.border,
    padding: 6,
  },
  photoCellBodega: {
    flex: 1,
    marginRight: 8,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: COLORS.border,
    padding: 6,
  },
  photoLabel: {
    fontSize: 7,
    color: COLORS.muted,
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 3,
  },
  photoFrame: {
    width: '100%',
    height: 170,
    objectFit: 'contain',
    border: `1 solid ${COLORS.border}`,
    backgroundColor: '#F9FAFB',
  },
  photoEmpty: {
    width: '100%',
    height: 170,
    border: `1 solid ${COLORS.border}`,
    backgroundColor: '#F9FAFB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoEmptyText: {
    fontSize: 8,
    color: COLORS.muted,
  },
  motivoSalto: {
    fontSize: 8,
    color: COLORS.muted,
    marginTop: 4,
    fontStyle: 'italic',
  },

  // ─── Footer ────────────────────────────────────────────
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

type PdfContext = {
  bodegaNombre: string
  operadorRol: string
}

type Props = {
  pedido: Pedido
  bodegaNombre: string
  operadorRol: string
}

/**
 * Normaliza una URL relativa del back a absoluta, para que el `<Image>`
 * de @react-pdf/renderer la pueda descargar.
 *
 * Si la URL ya es absoluta, la devuelve igual. Si no se puede resolver,
 * devuelve null y el render muestra el placeholder.
 */
function resolvePdfImageSrc(url: string | null | undefined): string | null {
  return imageUrl(url)
}

/**
 * "Aplana" los items del pedido: 1 fila por producto concreto.
 *  - Producto suelto → 1 fila
 *  - Kit → N filas (1 por producto del kit)
 *
 * Cada fila tiene asociado el EntregaItem correspondiente (si existe),
 * que es donde viven las fotos del bodeguero y del técnico.
 */
type FlatItem = {
  /** id del DetallePedido (para kits, el mismo para todas las filas). */
  detalleId: string
  nombre: string
  sku: string
  cantidad: number
  /** Solo true para items que vienen de un kit. */
  esDeKit: boolean
  nombreKit?: string
  fotoProducto: string | null
  entregaItem: EntregaItem | null
}

function flatItems(pedido: Pedido): FlatItem[] {
  const out: FlatItem[] = []
  for (const it of pedido.items) {
    if (it.producto) {
      const ei = (it.entregaItems ?? [])[0] ?? null
      const fotoProducto = (it.producto.documentos ?? [])[0]?.url ?? null
      out.push({
        detalleId: it.id,
        nombre: it.producto.nombre,
        sku: it.producto.codigo,
        cantidad: Number(it.cantidad),
        esDeKit: false,
        fotoProducto,
        entregaItem: ei,
      })
    } else if (it.kit) {
      // Para kits, los EntregaItem vienen 1 por producto del kit
      // y todos comparten el mismo detalleId (el del kit).
      const eis = it.entregaItems ?? []
      for (const ei of eis) {
        out.push({
          detalleId: it.id,
          nombre: ei.producto.nombre,
          sku: ei.producto.codigo,
          cantidad: Number(ei.cantidad),
          esDeKit: true,
          nombreKit: it.kit.nombre,
          fotoProducto: null,
          entregaItem: ei,
        })
      }
      // Si el kit no tiene EntregaItem (caso borde legacy), igual listamos
      // los productos del kit para que se vean en el PDF.
      if (eis.length === 0) {
        const kitCant = Number(it.cantidad)
        for (const ki of it.kit.items) {
          out.push({
            detalleId: it.id,
            nombre: ki.producto.nombre,
            sku: ki.producto.codigo,
            cantidad: kitCant * Number(ki.cantidad),
            esDeKit: true,
            nombreKit: it.kit.nombre,
            fotoProducto: null,
            entregaItem: null,
          })
        }
      }
    }
  }
  return out
}

function PedidoPDF({ pedido, bodegaNombre, operadorRol }: Props) {
  const estadoNombre = pedido.estado.nombre
  const isEntregada = estadoNombre === 'Entregado'
  const isAprobadaPorBodega = estadoNombre === 'AprobadoPorBodega'
  const isCancelada = estadoNombre === 'Cancelado'

  const estadoStyle = isEntregada
    ? { bg: COLORS.aprobadoBg, fg: COLORS.aprobadoFg, label: 'Entregado' }
    : isAprobadaPorBodega
      ? { bg: COLORS.aprobadoBg, fg: COLORS.aprobadoFg, label: 'Aprobado (Bodega)' }
      : isCancelada
        ? { bg: COLORS.canceladoBg, fg: COLORS.canceladoFg, label: 'Cancelado' }
        : { bg: COLORS.pendienteBg, fg: COLORS.pendienteFg, label: 'Pendiente' }

  const operadorNombre = pedido.operador?.nombre ?? '—'
  const aprobadorNombre = pedido.aprobadaPor?.nombre ?? '—'
  const canceladorNombre = pedido.canceladaPor?.nombre ?? '—'

  const items = flatItems(pedido)
  const totalUnidades = items.reduce((acc, it) => acc + it.cantidad, 0)
  const unidadLabel = totalUnidades === 1 ? 'UNID.' : 'UNIDS.'

  return (
    <Document>
      <Page size="A4" style={s.page}>
        {/* Header */}
        <View style={s.header}>
          <View style={s.headerLeft}>
            <Text style={s.brand}>WINERY SMART</Text>
            <Text style={s.titulo}>Detalle de la Solicitud</Text>
          </View>
          <View style={s.headerRight}>
            <Text style={s.codigo}>{pedido.codigo}</Text>
            <View style={[s.badge, { backgroundColor: estadoStyle.bg, color: estadoStyle.fg }]}>
              <Text style={{ color: estadoStyle.fg }}>{estadoStyle.label}</Text>
            </View>
          </View>
        </View>

        {/* Info general */}
        <View style={s.infoGrid}>
          <View style={s.infoCell}>
            <Text style={s.infoLabel}>Estado</Text>
            <View style={[s.badge, { backgroundColor: estadoStyle.bg, marginTop: 2 }]}>
              <Text style={{ color: estadoStyle.fg }}>{estadoStyle.label}</Text>
            </View>
          </View>
          <View style={s.infoCell}>
            <Text style={s.infoLabel}>Bodega</Text>
            <Text style={s.infoValue}>{bodegaNombre}</Text>
          </View>
          <View style={s.infoCell}>
            <Text style={s.infoLabel}>Operador</Text>
            <Text style={s.infoValue}>{operadorNombre}</Text>
            <Text style={[s.infoValue, { fontSize: 8, color: COLORS.muted, marginTop: 1 }]}>
              {operadorRol}
            </Text>
          </View>
          <View style={s.infoCell}>
            <Text style={s.infoLabel}>Enviada</Text>
            <Text style={s.infoValue}>
              {new Date(pedido.createdAt).toLocaleString('es-CO', {
                dateStyle: 'short',
                timeStyle: 'short',
              })}
            </Text>
          </View>
          {(isAprobadaPorBodega || isEntregada) && pedido.aprobadaAt && (
            <View style={s.infoCell}>
              <Text style={s.infoLabel}>Aprobada por bodega</Text>
              <Text style={s.infoValue}>
                {new Date(pedido.aprobadaAt).toLocaleString('es-CO', {
                  dateStyle: 'short',
                  timeStyle: 'short',
                })}{' '}
                · por {aprobadorNombre}
              </Text>
            </View>
          )}
          {isEntregada && (
            <View style={s.infoCell}>
              <Text style={s.infoLabel}>Entregada</Text>
              <Text style={s.infoValue}>
                {new Date(pedido.updatedAt).toLocaleString('es-CO', {
                  dateStyle: 'short',
                  timeStyle: 'short',
                })}
              </Text>
            </View>
          )}
          {isCancelada && pedido.canceladaAt && (
            <View style={s.infoCell}>
              <Text style={s.infoLabel}>Cancelada</Text>
              <Text style={s.infoValue}>
                {new Date(pedido.canceladaAt).toLocaleString('es-CO', {
                  dateStyle: 'short',
                  timeStyle: 'short',
                })}{' '}
                · por {canceladorNombre}
              </Text>
            </View>
          )}
        </View>

        {/* Motivo */}
        {pedido.motivo && (
          <View style={s.section}>
            <Text style={s.sectionLabel}>Motivo</Text>
            <View style={s.motivoBox}>
              <Text style={s.motivoText}>{pedido.motivo}</Text>
            </View>
          </View>
        )}

        {/* Motivo cancelación */}
        {isCancelada && pedido.motivoCancelacion && (
          <View style={s.section}>
            <Text style={s.sectionLabel}>Motivo de cancelación</Text>
            <View style={s.motivoBox}>
              <Text style={s.motivoText}>{pedido.motivoCancelacion}</Text>
            </View>
          </View>
        )}

        {/* Ítems */}
        <View style={s.section}>
          <View style={s.itemsHeader}>
            <Text style={s.itemsTitle}>Ítems Solicitados</Text>
            <Text style={s.itemsCount}>
              {items.length} {items.length === 1 ? 'línea' : 'líneas'} ·{' '}
              {totalUnidades} {unidadLabel}
            </Text>
          </View>

          {/* Mini-tabla resumen Producto | Cantidad */}
          <View style={s.tableHeader}>
            <Text style={s.thProducto}>Producto</Text>
            <Text style={s.thCantidad}>Cantidad</Text>
          </View>
          {items.map((it, idx) => (
            <View key={`row-${it.detalleId}-${idx}`} style={s.tableRow} wrap={false}>
              <Text style={s.tdProducto}>
                {it.esDeKit ? `Kit: ${it.nombre}` : it.nombre}
                {it.esDeKit && it.nombreKit ? `  (de kit ${it.nombreKit})` : ''}
                <Text style={s.tdProductoSku}>
                  {`  · SKU ${it.sku}`}
                </Text>
              </Text>
              <Text style={s.tdCantidad}>×{it.cantidad}</Text>
            </View>
          ))}

          {/* Bloques de evidencia por producto (fotos bodega + técnico) */}
          {items.map((it, idx) => {
            const ei = it.entregaItem
            const fotoBodega = resolvePdfImageSrc(ei?.fotoBodegueroUrl ?? null)
            const fotoTecnico = resolvePdfImageSrc(ei?.fotoTecnicoUrl ?? null)
            const saltadoPorTecnico = !!ei?.saltadoPorTecnico
            const saltadoPorBodega = !!ei?.saltadoPorBodega

            // Si todavía no hay EntregaItem o el estado no requiere
            // evidencia, no mostramos el bloque.
            const mostrarBloque =
              !!ei && (isAprobadaPorBodega || isEntregada)

            if (!mostrarBloque) return null

            return (
              <View key={`${it.detalleId}-${idx}`} style={s.productBlock} wrap={false}>
                {/* Header del producto: nombre + SKU inline, ×cantidad a la derecha.
                    Una sola línea para que no se solape. */}
                <View style={s.productHeader}>
                  <Text style={s.productName}>
                    {it.esDeKit ? `Kit: ${it.nombre}` : it.nombre}
                    {it.esDeKit && it.nombreKit
                      ? `  (de kit ${it.nombreKit})`
                      : ''}
                    <Text style={s.productMeta}>
                      {`  · SKU ${it.sku}`}
                    </Text>
                  </Text>
                  <Text style={s.productCantidad}>×{it.cantidad}</Text>
                </View>

                {/* Si NO hay EntregaItem (caso borde legacy) o el estado es
                    Pendiente / Cancelado, no mostramos fotos — todavía no
                    existen. */}
                {ei && (isAprobadaPorBodega || isEntregada) && (
                  <View>
                    <View style={s.photosRow}>
                      {/* Foto del bodeguero */}
                      <View style={s.photoCellBodega}>
                        <View style={s.chipRow}>
                          <Text
                            style={[s.chip, saltadoPorBodega ? s.chipSaltado : s.chipBodega]}
                          >
                            {saltadoPorBodega ? 'BODEGA · SALTADO' : 'BODEGA'}
                          </Text>
                        </View>
                        {fotoBodega ? (
                          <Image src={fotoBodega} style={s.photoFrame} />
                        ) : (
                          <View style={s.photoEmpty}>
                            <Text style={s.photoEmptyText}>
                              {saltadoPorBodega
                                ? '— sin foto —'
                                : 'Foto no disponible'}
                            </Text>
                          </View>
                        )}
                        {saltadoPorBodega && ei.motivoSaltoBodega && (
                          <Text style={s.motivoSalto}>
                            Motivo: {ei.motivoSaltoBodega}
                          </Text>
                        )}
                      </View>

                      {/* Foto del técnico */}
                      <View style={s.photoCell}>
                        <View style={s.chipRow}>
                          <Text
                            style={[s.chip, saltadoPorTecnico ? s.chipSaltado : s.chipTecnico]}
                          >
                            {saltadoPorTecnico
                              ? 'TÉCNICO · SALTADO'
                              : isEntregada
                                ? 'TÉCNICO'
                                : 'TÉCNICO · PENDIENTE'}
                          </Text>
                        </View>
                        {isEntregada && fotoTecnico ? (
                          <Image src={fotoTecnico} style={s.photoFrame} />
                        ) : (
                          <View style={s.photoEmpty}>
                            <Text style={s.photoEmptyText}>
                              {saltadoPorTecnico
                                ? '— sin foto —'
                                : isEntregada
                                  ? 'Foto no disponible'
                                  : 'Aún no procesada por el técnico'}
                            </Text>
                          </View>
                        )}
                        {saltadoPorTecnico && ei.motivoSaltoTecnico && (
                          <Text style={s.motivoSalto}>
                            Motivo: {ei.motivoSaltoTecnico}
                          </Text>
                        )}
                      </View>
                    </View>
                  </View>
                )}
              </View>
            )
          })}
        </View>

        {/* Footer */}
        <View style={s.footer} fixed>
          <Text>WinerySmart</Text>
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

/* ─── API pública ───────────────────────────────────────── */

export class PedidoNoEntregadoError extends Error {
  constructor(estado: string) {
    super(
      `El PDF solo se puede generar cuando el técnico finalizó la revisión (estado actual: ${estado}).`,
    )
    this.name = 'PedidoNoEntregadoError'
  }
}

/**
 * Genera y descarga el PDF de un pedido.
 *
 * Reglas:
 *  - El pedido debe estar en estado `Entregado` (el técnico ya
 *    confirmó la revisión con fotos o saltos). Si no, lanza
 *    `PedidoNoEntregadoError` y NO descarga nada.
 *  - Recibe el `Pedido` completo (con `items.entregaItems` y
 *    `items.producto.documentos`), no solo el `PedidoListItem`.
 */
export async function downloadPedidoPDF(
  pedido: Pedido,
  ctx: PdfContext,
): Promise<void> {
  if (pedido.estado.nombre !== 'Entregado') {
    throw new PedidoNoEntregadoError(pedido.estado.nombre)
  }

  const blob = await pdf(
    <PedidoPDF
      pedido={pedido}
      bodegaNombre={ctx.bodegaNombre}
      operadorRol={ctx.operadorRol}
    />,
  ).toBlob()

  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `solicitud-${pedido.codigo}-entregado.pdf`
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 0)
}
