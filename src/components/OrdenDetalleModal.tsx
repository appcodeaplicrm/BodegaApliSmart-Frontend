import { useEffect, useState } from 'react'
import {
  FileDown,
  Loader2,
  Camera,
  CheckCircle2,
  XCircle,
  Send,
  PackageOpen,
  FileCheck2,
} from 'lucide-react'
import { pedidosStore, type Pedido, type PedidoListItem } from '../store/pedidos'
import { useBodegas } from '../store/bodegas'
import { useAuth } from '../store/auth'
import { downloadPedidoPDF, PedidoNoEntregadoError } from '../lib/pdf'
import { imageUrl } from '../lib/apiBase'
import { Modal } from './Modal'
import { ReporteUsoModal } from './ReporteUsoModal'

type OrdenDetalleModalProps = {
  pedido: PedidoListItem
  onClose: () => void
  /**
   * Acciones contextuales del operador (mismas que en la tabla desktop).
   * Se usan en el footer del modal para que el usuario pueda actuar
   * desde el modal sin tener que volver a la lista.
   */
  onRevisarTecnico?: () => void
  onCancelar?: () => void
  /**
   * Acción del bodeguero: cuando un pedido está Pendiente, abre el
   * wizard de aprobación (AccionOrdenModal). Se muestra como botón
   * principal en el footer del modal.
   */
  onResolver?: () => void
}

/**
 * Modal de detalle de un pedido.
 *
 * Carga el pedido completo (con `items.entregaItems`) vía
 * `pedidosStore.findOne` para poder mostrar las fotos del bodeguero
 * y del técnico y habilitar el botón "PDF" sólo cuando el técnico
 * ya finalizó la revisión.
 */
export function OrdenDetalleModal({
  pedido,
  onClose,
  onRevisarTecnico,
  onCancelar,
  onResolver,
}: OrdenDetalleModalProps) {
  const auth = useAuth()
  const bodegasState = useBodegas()
  const [completo, setCompleto] = useState<Pedido | null>(null)
  const [cargando, setCargando] = useState(false)
  const [errorCarga, setErrorCarga] = useState<string | null>(null)
  const [downloading, setDownloading] = useState(false)
  const [pdfError, setPdfError] = useState<string | null>(null)
  const [reporteOpen, setReporteOpen] = useState(false)

  const bodega =
    bodegasState.status === 'listo'
      ? bodegasState.bodegas.find((b) => b.id === pedido.bodegaId)
      : null
  const bodegaNombre = bodega?.nombre ?? pedido.bodegaId

  const operadorDisplay = pedido.operadorNombre ?? '—'
  const operadorRol =
    auth.status === 'autenticado' && auth.sesion.usuario.id === pedido.operadorId
      ? auth.sesion.usuario.rol
      : '—'

  useEffect(() => {
    let cancelado = false
    setCargando(true)
    setErrorCarga(null)
    pedidosStore
      .findOne(pedido.id)
      .then((p) => {
        if (!cancelado) setCompleto(p)
      })
      .catch((err) => {
        if (!cancelado) {
          const msg = err instanceof Error ? err.message : 'No se pudo cargar el pedido.'
          setErrorCarga(msg)
        }
      })
      .finally(() => {
        if (!cancelado) setCargando(false)
      })
    return () => {
      cancelado = true
    }
  }, [pedido.id])

  const puedeDescargarPdf = completo?.estado.nombre === 'Entregado'

  async function handleDownload() {
    if (downloading || !completo) return
    setDownloading(true)
    setPdfError(null)
    try {
      await downloadPedidoPDF(completo, { bodegaNombre, operadorRol })
    } catch (err) {
      if (err instanceof PedidoNoEntregadoError) {
        setPdfError(err.message)
      } else {
        const msg = err instanceof Error ? err.message : 'No se pudo generar el PDF.'
        setPdfError(msg)
      }
    } finally {
      setDownloading(false)
    }
  }

  /**
   * Acción contextual según el estado (espejo de `AccionOperador`
   * de Ordenes.tsx). Se muestra como botón principal en el footer
   * para que el usuario pueda actuar directamente desde el modal
   * (importante en mobile, donde la tabla muestra filas compactas
   * sin acciones).
   *
   * Prioridad:
   *  1. Bodeguero con `onResolver` y pedido Pendiente → "Resolver" (primary)
   *  2. Operador con `onRevisarTecnico` y pedido AprobadoPorBodega → "Revisar" (secondary)
   *  3. Operador con `onCancelar` y pedido Pendiente → "Cancelar" (outline)
   */
  const accionContextual = (() => {
    if (pedido.estadoNombre === 'Pendiente' && onResolver) {
      return {
        key: 'resolver',
        label: 'Resolver',
        icon: <PackageOpen size={14} />,
        onClick: onResolver,
        variant: 'primary' as const,
      }
    }
    if (pedido.estadoNombre === 'AprobadoPorBodega' && onRevisarTecnico) {
      return {
        key: 'revisar',
        label: 'Revisar',
        icon: <Send size={14} />,
        onClick: onRevisarTecnico,
        variant: 'secondary' as const,
      }
    }
    if (pedido.estadoNombre === 'Pendiente' && onCancelar) {
      return {
        key: 'cancelar',
        label: 'Cancelar solicitud',
        icon: <XCircle size={14} />,
        onClick: onCancelar,
        variant: 'outline' as const,
      }
    }
    return null
  })()

  return (
    <Modal
      open
      onClose={onClose}
      title="Detalle de la solicitud"
      description={pedido.codigo}
      icon={<FileDown size={16} className="text-primary" />}
      size="lg"
      footer={
        <div className="space-y-2">
          {completo?.estado.nombre === 'Entregado' && (
            <button
              type="button"
              onClick={() => setReporteOpen(true)}
              className="w-full min-h-[44px] inline-flex items-center justify-center gap-2 py-2.5 border border-primary/50 text-primary text-sm font-semibold hover:bg-primary/5 transition-colors"
            >
              <FileCheck2 size={14} />
              {completo.operadorId === (auth.status === 'autenticado' ? auth.sesion.usuario.id : null)
                ? 'Subir / ver reporte de uso'
                : 'Ver reporte de uso'}
            </button>
          )}
          {accionContextual && (
            <button
              type="button"
              onClick={accionContextual.onClick}
              className={`w-full min-h-[44px] inline-flex items-center justify-center gap-2 py-2.5 text-sm font-semibold transition-colors ${
                accionContextual.variant === 'primary'
                  ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                  : accionContextual.variant === 'secondary'
                    ? 'bg-secondary text-secondary-foreground hover:bg-secondary/90'
                    : 'border border-border text-foreground hover:border-primary/40 hover:text-primary'
              }`}
              style={{ borderRadius: '0.25rem' }}
            >
              {accionContextual.icon}
              {accionContextual.label}
            </button>
          )}
          <div
            title={
              !puedeDescargarPdf
                ? 'El PDF se habilita cuando el técnico finaliza la revisión (estado Entregado).'
                : undefined
            }
          >
            <button
              onClick={handleDownload}
              disabled={downloading || !puedeDescargarPdf || cargando}
              className="w-full min-h-[44px] inline-flex items-center justify-center gap-2 py-2.5 bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ borderRadius: '0.25rem' }}
            >
              {downloading ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  Generando PDF…
                </>
              ) : (
                <>
                  <FileDown size={14} />
                  {puedeDescargarPdf
                    ? 'Imprimir / Guardar PDF'
                    : 'PDF disponible al finalizar el técnico'}
                </>
              )}
            </button>
            {!puedeDescargarPdf && !cargando && (
              <p
                className="mt-2 text-[10px] text-muted-foreground text-center"
                style={{ fontFamily: "'JetBrains Mono', monospace" }}
              >
                El PDF incluye las fotos del bodeguero y del técnico, y solo
                se genera una vez que la solicitud está en estado
                <span className="text-foreground"> ENTREGADO</span>.
              </p>
            )}
            {pdfError && (
              <p
                className="mt-2 text-xs text-primary bg-primary/10 border border-primary/20 px-3 py-2"
                style={{ fontFamily: "'JetBrains Mono', monospace", borderRadius: '0.25rem' }}
              >
                ⚠ {pdfError}
              </p>
            )}
          </div>
        </div>
      }
    >
      <div className="p-5 space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Cell label="Estado">
            <span
              className={`text-xs px-2 py-0.5 border ${
                pedido.estadoNombre === 'Pendiente'
                  ? 'border-primary/40 text-primary bg-primary/10'
                  : pedido.estadoNombre === 'AprobadoPorBodega'
                    ? 'border-secondary/40 text-secondary bg-secondary/10'
                    : pedido.estadoNombre === 'Entregado'
                      ? 'border-foreground/30 text-foreground bg-muted/40'
                      : 'border-muted text-muted-foreground bg-muted/30'
              }`}
              style={{
                borderRadius: '0.15rem',
                fontFamily: "'JetBrains Mono', monospace",
                fontWeight: 500,
              }}
            >
              {pedido.estadoNombre.toUpperCase()}
            </span>
          </Cell>
          <Cell label="Bodega" value={bodegaNombre} />
          <Cell label="Operador" value={operadorDisplay} />
          <Cell label="Enviada" value={pedido.createdAtLabel} />
          {(pedido.estadoNombre === 'AprobadoPorBodega' ||
            pedido.estadoNombre === 'Entregado') && (
            <Cell
              label="Aprobada por bodega"
              value={
                pedido.aprobadaAtLabel
                  ? `${pedido.aprobadaAtLabel}${pedido.aprobadaPorNombre ? ` · por ${pedido.aprobadaPorNombre}` : ''}`
                  : '—'
              }
            />
          )}
          {pedido.estadoNombre === 'Cancelado' && (
            <Cell
              label="Cancelada"
              value={
                pedido.canceladaAtLabel
                  ? `${pedido.canceladaAtLabel}${pedido.canceladaPorNombre ? ` · por ${pedido.canceladaPorNombre}` : ''}`
                  : '—'
              }
            />
          )}
        </div>

        {pedido.motivo && (
          <div>
            <CellLabel>Motivo</CellLabel>
            <p
              className="mt-1 text-sm text-foreground"
              style={{ fontFamily: "'DM Sans', sans-serif" }}
            >
              {pedido.motivo}
            </p>
          </div>
        )}

        {pedido.estadoNombre === 'Cancelado' && pedido.motivoCancelacion && (
          <div
            className="bg-muted border border-border p-3"
            style={{ borderRadius: '0.25rem' }}
          >
            <CellLabel>Motivo de cancelación</CellLabel>
            <p
              className="mt-1 text-sm text-foreground"
              style={{ fontFamily: "'DM Sans', sans-serif" }}
            >
              {pedido.motivoCancelacion}
            </p>
          </div>
        )}

        <div>
          <CellLabel>Ítems solicitados</CellLabel>
          {cargando && (
            <div className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 size={14} className="animate-spin" />
              Cargando detalle…
            </div>
          )}
          {errorCarga && (
            <p
              className="mt-2 text-xs text-primary bg-primary/10 border border-primary/20 px-3 py-2"
              style={{ fontFamily: "'JetBrains Mono', monospace", borderRadius: '0.25rem' }}
            >
              ⚠ {errorCarga}
            </p>
          )}
          {completo && (
            <ul
              className="mt-2 divide-y divide-border border border-border"
              style={{ borderRadius: '0.25rem' }}
            >
              {completo.items.flatMap((it) => {
                if (it.producto) {
                  const ei = (it.entregaItems ?? [])[0] ?? null
                  return [
                    <ItemRow
                      key={it.id}
                      nombre={it.producto.nombre}
                      sku={it.producto.codigo}
                      cantidad={Number(it.cantidad)}
                      esDeKit={false}
                      entregaItem={ei}
                    />,
                  ]
                }
                if (it.kit) {
                  const eis = it.entregaItems ?? []
                  if (eis.length > 0) {
                    return eis.map((ei) => (
                      <ItemRow
                        key={`${it.id}-${ei.id}`}
                        nombre={ei.producto.nombre}
                        sku={ei.producto.codigo}
                        cantidad={Number(ei.cantidad)}
                        esDeKit
                        nombreKit={it.kit!.nombre}
                        entregaItem={ei}
                      />
                    ))
                  }
                  // Sin EntregaItem (caso borde)
                  const kitCant = Number(it.cantidad)
                  return it.kit.items.map((ki, idx) => (
                    <ItemRow
                      key={`${it.id}-${idx}`}
                      nombre={ki.producto.nombre}
                      sku={ki.producto.codigo}
                      cantidad={kitCant * Number(ki.cantidad)}
                      esDeKit
                      nombreKit={it.kit!.nombre}
                      entregaItem={null}
                    />
                  ))
                }
                return []
              })}
            </ul>
          )}
        </div>
      </div>
      {reporteOpen && completo && (
        <ReporteUsoModal
          pedido={completo}
          onClose={() => setReporteOpen(false)}
          onCreated={() => void pedidosStore.recargarSilencioso()}
        />
      )}
    </Modal>
  )
}

function ItemRow({
  nombre,
  sku,
  cantidad,
  esDeKit,
  nombreKit,
  entregaItem,
}: {
  nombre: string
  sku: string
  cantidad: number
  esDeKit: boolean
  nombreKit?: string
  entregaItem: {
    fotoBodegueroUrl: string | null
    fotoTecnicoUrl: string | null
    fotoBodegueroImageUrl?: string | null
    fotoTecnicoImageUrl?: string | null
    saltadoPorBodega: boolean
    saltadoPorTecnico: boolean
    motivoSaltoBodega: string | null
    motivoSaltoTecnico: string | null
  } | null
}) {
  // El back ahora manda `fotoBodegueroImageUrl` / `fotoTecnicoImageUrl`
  // ya armados. Si por alguna razón no vinieran, caemos al `*Url` legacy.
  const fotoBodega = imageUrl(
    entregaItem?.fotoBodegueroImageUrl ?? entregaItem?.fotoBodegueroUrl ?? null,
  )
  const fotoTecnico = imageUrl(
    entregaItem?.fotoTecnicoImageUrl ?? entregaItem?.fotoTecnicoUrl ?? null,
  )

  return (
    <li className="p-3 bg-card">
      <div className="flex items-center justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            {esDeKit && <span>📦</span>}
            <span
              className="text-sm text-foreground"
              style={{ fontFamily: "'DM Sans', sans-serif" }}
            >
              {nombre}
            </span>
            {esDeKit && nombreKit && (
              <span
                className="text-[10px] text-muted-foreground"
                style={{ fontFamily: "'JetBrains Mono', monospace" }}
              >
                de {nombreKit}
              </span>
            )}
          </div>
          <div
            className="text-[10px] text-muted-foreground mt-0.5"
            style={{ fontFamily: "'JetBrains Mono', monospace" }}
          >
            SKU {sku}
          </div>
        </div>
        <span
          className="text-sm text-primary shrink-0 ml-2"
          style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 500 }}
        >
          × {cantidad}
        </span>
      </div>

      {/* Fotos si hay EntregaItem */}
      {entregaItem && (
        <div className="mt-3 grid grid-cols-2 gap-2">
          <PhotoBlock
            label="Bodega"
            color="primary"
            url={fotoBodega}
            saltado={entregaItem.saltadoPorBodega}
            motivoSalto={entregaItem.motivoSaltoBodega}
          />
          <PhotoBlock
            label="Técnico"
            color="secondary"
            url={fotoTecnico}
            saltado={entregaItem.saltadoPorTecnico}
            motivoSalto={entregaItem.motivoSaltoTecnico}
          />
        </div>
      )}
    </li>
  )
}

function PhotoBlock({
  label,
  color,
  url,
  saltado,
  motivoSalto,
}: {
  label: string
  color: 'primary' | 'secondary'
  url: string | null
  saltado: boolean
  motivoSalto: string | null
}) {
  const colorClasses =
    color === 'primary'
      ? 'border-primary/30 bg-primary/5 text-primary'
      : 'border-secondary/30 bg-secondary/5 text-secondary'

  return (
    <div
      className={`border ${colorClasses} p-2`}
      style={{ borderRadius: '0.25rem' }}
    >
      <div
        className="flex items-center justify-between text-[10px] tracking-widest uppercase mb-1.5"
        style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 600 }}
      >
        <span>{label}</span>
        {saltado ? (
          <span className="inline-flex items-center gap-1 text-muted-foreground">
            <XCircle size={11} /> Saltado
          </span>
        ) : url ? (
          <span className="inline-flex items-center gap-1">
            <CheckCircle2 size={11} /> OK
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-muted-foreground">
            <Camera size={11} /> —
          </span>
        )}
      </div>
      {url ? (
        <img
          src={url}
          alt={`Foto ${label}`}
          className="w-full h-32 object-cover bg-muted"
          style={{ borderRadius: '0.15rem' }}
        />
      ) : (
        <div
          className="w-full h-32 bg-muted flex items-center justify-center text-xs text-muted-foreground"
          style={{ borderRadius: '0.15rem' }}
        >
          {saltado ? 'Sin foto (saltado)' : 'Sin foto'}
        </div>
      )}
      {saltado && motivoSalto && (
        <p
          className="mt-1 text-[10px] text-muted-foreground"
          style={{ fontFamily: "'DM Sans', sans-serif" }}
        >
          Motivo: {motivoSalto}
        </p>
      )}
    </div>
  )
}

function Cell({ label, value, children }: { label: string; value?: string; children?: React.ReactNode }) {
  return (
    <div
      className="bg-muted border border-border p-2.5"
      style={{ borderRadius: '0.25rem' }}
    >
      <CellLabel>{label}</CellLabel>
      {children ?? (
        <div
          className="text-sm text-foreground mt-1 truncate"
          style={{ fontFamily: "'DM Sans', sans-serif" }}
        >
          {value}
        </div>
      )}
    </div>
  )
}

function CellLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="text-[10px] text-muted-foreground tracking-widest uppercase"
      style={{ fontFamily: "'JetBrains Mono', monospace" }}
    >
      {children}
    </div>
  )
}
