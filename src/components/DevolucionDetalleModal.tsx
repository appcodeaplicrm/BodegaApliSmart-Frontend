import { useEffect, useState } from 'react'
import {
  CheckCircle2,
  XCircle,
  Loader2,
  Camera,
  Send,
  Truck,
  Undo2,
} from 'lucide-react'
import {
  devolucionesStore,
  type DevolucionListItem,
  type Devolucion as DevolucionFull,
  type DevolucionItem as DevolucionItemType,
  type EstadoDevolucion,
  type EstadoDevolucionItem,
} from '../store/devoluciones'
import { useAuth } from '../store/auth'
import { useBodegaActiva } from '../store/bodegaActiva'
import { imageUrl } from '../lib/apiBase'
import { DevolucionWizard } from './DevolucionWizard'
import { Modal } from './Modal'

type Props = {
  devolucion: DevolucionListItem
  onClose: () => void
}

/**
 * Modal de detalle de una devolución.
 *
 * - Si es el técnico y está `pendiente` → botón "Enviar" que abre el wizard
 *   de operador (foto por item, finalizar → en_transito).
 * - Si es bodeguero y está `en_transito` → botón "Recibir" que abre el
 *   wizard de bodeguero (foto por item, finalizar → recibida, suma stock).
 * - En otros estados, solo muestra el detalle con las 2 fotos (operador
 *   y bodeguero) por cada item.
 */
export function DevolucionDetalleModal({ devolucion, onClose }: Props) {
  const auth = useAuth()
  const bodegaId = useBodegaActiva()
  const [completo, setCompleto] = useState<DevolucionFull | null>(null)
  const [cargando, setCargando] = useState(true)
  const [errorCarga, setErrorCarga] = useState<string | null>(null)
  const [wizardOperador, setWizardOperador] = useState(false)
  const [wizardBodeguero, setWizardBodeguero] = useState(false)

  useEffect(() => {
    let cancelado = false
    setCargando(true)
    devolucionesStore
      .findOne(devolucion.id)
      .then((d) => {
        if (!cancelado) setCompleto(d)
      })
      .catch((err) => {
        if (!cancelado) {
          const msg =
            err instanceof Error ? err.message : 'No se pudo cargar la devolución.'
          setErrorCarga(msg)
        }
      })
      .finally(() => {
        if (!cancelado) setCargando(false)
      })
    return () => {
      cancelado = true
    }
  }, [devolucion.id])

  /**
   * Refetch silencioso del `completo` desde el back. Se llama cuando
   * el DevolucionWizard termina (operador envía, bodeguero recibe) para
   * que la lista de items del modal refleje el nuevo estado de cada
   * item (pendiente → en_transito → recibido/rechazado). Si no, el
   * botón "Enviar X productos" puede seguir mostrando items que ya
   * están en tránsito hasta que se cierre y reabra el modal.
   */
  function recargarCompleto() {
    if (cargando) return
    setCargando(true)
    devolucionesStore
      .findOne(devolucion.id)
      .then((d) => setCompleto(d))
      .catch((err) => {
        const msg =
          err instanceof Error ? err.message : 'No se pudo refrescar la devolución.'
        setErrorCarga(msg)
      })
      .finally(() => setCargando(false))
  }

  const permisosUsuario = new Set<string>(
    auth.status === 'autenticado' ? auth.sesion.permisos : [],
  )
  const puedeRecibir = permisosUsuario.has('tecnicos.devoluciones.editar')
  const usuarioId = auth.status === 'autenticado' ? auth.sesion.usuario.id : null
  const esDueno = devolucion.operadorId === usuarioId

  // Botones de acción según rol + estado
  const puedeEnviarOperador =
    completo?.estado === 'pendiente' && esDueno &&
    completo.items.some((it) => it.estado === 'pendiente')

  const puedeRecibirBodeguero =
    completo?.estado === 'en_transito' && puedeRecibir &&
    completo.items.some((it) => it.estado === 'en_transito')

  if (cargando) {
    return (
      <Modal
        open
        onClose={onClose}
        title="Detalle de la devolución"
        description={devolucion.codigo}
        icon={<Undo2 size={16} className="text-primary" />}
        size="lg"
      >
        <div className="p-6 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 size={14} className="animate-spin" /> Cargando detalle…
        </div>
      </Modal>
    )
  }

  if (errorCarga) {
    return (
      <Modal
        open
        onClose={onClose}
        title="Detalle de la devolución"
        description={devolucion.codigo}
        icon={<Undo2 size={16} className="text-primary" />}
        size="lg"
      >
        <p
          className="m-5 text-sm text-primary bg-primary/10 border border-primary/20 px-3 py-2"
          style={{ fontFamily: "'JetBrains Mono', monospace", borderRadius: '0.25rem' }}
        >
          ⚠ {errorCarga}
        </p>
      </Modal>
    )
  }

  if (wizardOperador && completo) {
    return (
      <DevolucionWizard
        devolucion={completo}
        rol="operador"
        onClose={() => setWizardOperador(false)}
        onResolved={() => {
          setWizardOperador(false)
          if (bodegaId) {
            void devolucionesStore
              .cargarPaginado({ bodegaId, page: 1, pageSize: 20 })
              .catch(() => undefined)
          }
          // Re-trae el `completo` para que el modal muestre el estado
          // nuevo de cada item (los pendientes pasaron a en_transito).
          recargarCompleto()
        }}
      />
    )
  }

  if (wizardBodeguero && completo) {
    return (
      <DevolucionWizard
        devolucion={completo}
        rol="bodeguero"
        onClose={() => setWizardBodeguero(false)}
        onResolved={() => {
          setWizardBodeguero(false)
          if (bodegaId) {
            void devolucionesStore
              .cargarPaginado({ bodegaId, page: 1, pageSize: 20 })
              .catch(() => undefined)
          }
          // Re-trae el `completo` para que el modal muestre el estado
          // nuevo de cada item (los en_transito pasaron a recibido/rechazado).
          recargarCompleto()
        }}
      />
    )
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Detalle de la devolución"
      description={devolucion.codigo}
      icon={<Undo2 size={16} className="text-primary" />}
      size="lg"
    >
      <div className="p-5 space-y-4">
        {/* Info general */}
        <div className="grid grid-cols-2 gap-3">
          <Cell label="Estado">
            <EstadoBadge estado={devolucion.estadoNombre} />
          </Cell>
          <Cell label="Pedido original">{devolucion.pedidoCodigo ?? '—'}</Cell>
          <Cell label="Operador">{devolucion.operadorNombre ?? '—'}</Cell>
          <Cell label="Enviada">{devolucion.createdAtLabel}</Cell>
          {devolucion.recibidaAt && (
            <Cell label="Recibida">
              {`${devolucion.recibidaAtLabel ?? ''}${
                devolucion.recibidaPorNombre ? ' · por ' + devolucion.recibidaPorNombre : ''
              }`}
            </Cell>
          )}
          {devolucion.canceladaAt && (
            <Cell label="Cancelada">
              {`${devolucion.canceladaAtLabel ?? ''}${
                devolucion.motivoCancelacion ? ' · ' + devolucion.motivoCancelacion : ''
              }`}
            </Cell>
          )}
        </div>

        {devolucion.motivo && (
          <div>
            <CellLabel>Motivo</CellLabel>
            <p
              className="mt-1 text-sm text-foreground"
              style={{ fontFamily: "'DM Sans', sans-serif" }}
            >
              {devolucion.motivo}
            </p>
          </div>
        )}

        {/* Items */}
        {completo && (
          <div>
            <CellLabel>Productos de la devolución</CellLabel>
            <ul
              className="mt-2 divide-y divide-border border border-border"
              style={{ borderRadius: '0.25rem' }}
            >
              {completo.items.map((it) => (
                <DevolucionItemRow key={it.id} item={it} />
              ))}
            </ul>
          </div>
        )}

        {/* Botón wizard */}
        {(puedeEnviarOperador || puedeRecibirBodeguero) && (
          <div className="border-t border-border pt-4">
            {puedeEnviarOperador && (
              <button
                onClick={() => setWizardOperador(true)}
                className="w-full min-h-[44px] inline-flex items-center justify-center gap-2 py-2.5 bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors"
                style={{ borderRadius: '0.25rem' }}
              >
                <Send size={14} />
                Enviar {completo?.items.filter((i) => i.estado === 'pendiente').length}{' '}
                {completo?.items.filter((i) => i.estado === 'pendiente').length === 1
                  ? 'producto'
                  : 'productos'}{' '}
                (con foto)
              </button>
            )}
            {puedeRecibirBodeguero && (
              <button
                onClick={() => setWizardBodeguero(true)}
                className="w-full min-h-[44px] inline-flex items-center justify-center gap-2 py-2.5 bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors"
                style={{ borderRadius: '0.25rem' }}
              >
                <Camera size={14} />
                Recibir {completo?.items.filter((i) => i.estado === 'en_transito').length}{' '}
                {completo?.items.filter((i) => i.estado === 'en_transito').length === 1
                  ? 'producto'
                  : 'productos'}{' '}
                (con foto)
              </button>
            )}
          </div>
        )}
      </div>
    </Modal>
  )
}

function DevolucionItemRow({ item }: { item: DevolucionItemType }) {
  const itemEstado = item.estado as EstadoDevolucionItem
  const color = itemEstadoColor(itemEstado)

  return (
    <li className="p-3 bg-card">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div
            className="text-sm text-foreground"
            style={{ fontFamily: "'DM Sans', sans-serif" }}
          >
            {item.producto.nombre}
          </div>
          <div
            className="text-[10px] text-muted-foreground"
            style={{ fontFamily: "'JetBrains Mono', monospace" }}
          >
            SKU {item.producto.codigo} · ×{Number(item.cantidad)}
          </div>
        </div>
        <span
          className={`text-[10px] px-2 py-0.5 border ${color}`}
          style={{
            borderRadius: '0.15rem',
            fontFamily: "'JetBrains Mono', monospace",
            fontWeight: 500,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
          }}
        >
          {itemEstadoLabel(itemEstado)}
        </span>
      </div>

      {/* 2 fotos: operador y bodeguero */}
      {(item.fotoOperadorUrl || item.fotoRecibidoUrl) && (
        <div className="mt-3 grid grid-cols-2 gap-2">
          <FotoMini
            label="Operador"
            color="primary"
            url={imageUrl(item.fotoOperadorImageUrl ?? item.fotoOperadorUrl ?? null)}
          />
          <FotoMini
            label="Bodega"
            color="secondary"
            url={imageUrl(item.fotoRecibidoImageUrl ?? item.fotoRecibidoUrl ?? null)}
          />
        </div>
      )}

      {item.estado === 'rechazado' && item.motivoRechazo && (
        <p
          className="mt-1 text-[10px] text-muted-foreground italic"
          style={{ fontFamily: "'DM Sans', sans-serif" }}
        >
          Motivo: {item.motivoRechazo}
        </p>
      )}
    </li>
  )
}

function FotoMini({
  label,
  color,
  url,
}: {
  label: string
  color: 'primary' | 'secondary'
  url: string | null
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
        {url ? (
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
          Sin foto
        </div>
      )}
    </div>
  )
}

function itemEstadoColor(estado: EstadoDevolucionItem): string {
  if (estado === 'recibido')
    return 'border-secondary/30 bg-secondary/5 text-secondary'
  if (estado === 'rechazado')
    return 'border-muted bg-muted/30 text-muted-foreground'
  if (estado === 'en_transito')
    return 'border-amber-500/40 bg-amber-500/10 text-amber-500'
  return 'border-border bg-muted/40 text-foreground'
}

function itemEstadoLabel(estado: EstadoDevolucionItem): string {
  if (estado === 'recibido') return 'RECIBIDO'
  if (estado === 'rechazado') return 'RECHAZADO'
  if (estado === 'en_transito') return 'EN TRÁNSITO'
  return 'PENDIENTE'
}

function Cell({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div
      className="bg-muted border border-border p-2.5"
      style={{ borderRadius: '0.25rem' }}
    >
      <CellLabel>{label}</CellLabel>
      <div className="text-sm text-foreground mt-1">{children}</div>
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

function EstadoBadge({ estado }: { estado: EstadoDevolucion }) {
  if (estado === 'pendiente') {
    return (
      <span
        className="inline-flex items-center px-2 py-0.5 text-[10px] border border-primary/40 text-primary bg-primary/10"
        style={{
          borderRadius: '0.15rem',
          fontFamily: "'JetBrains Mono', monospace",
          fontWeight: 500,
        }}
      >
        PENDIENTE
      </span>
    )
  }
  if (estado === 'en_transito') {
    return (
      <span
        className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] border border-amber-500/40 text-amber-500 bg-amber-500/10"
        style={{
          borderRadius: '0.15rem',
          fontFamily: "'JetBrains Mono', monospace",
          fontWeight: 500,
        }}
      >
        <Truck size={10} /> EN TRÁNSITO
      </span>
    )
  }
  if (estado === 'recibida') {
    return (
      <span
        className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] border border-secondary/40 text-secondary bg-secondary/10"
        style={{
          borderRadius: '0.15rem',
          fontFamily: "'JetBrains Mono', monospace",
          fontWeight: 500,
        }}
      >
        <CheckCircle2 size={10} /> RECIBIDA
      </span>
    )
  }
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] border border-muted text-muted-foreground bg-muted/30"
      style={{
        borderRadius: '0.15rem',
        fontFamily: "'JetBrains Mono', monospace",
        fontWeight: 500,
      }}
    >
      <XCircle size={10} /> CANCELADA
    </span>
  )
}
