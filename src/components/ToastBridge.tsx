/**
 * ToastBridge — renderiza el <ToastContainer> de react-toastify con
 * posición responsive y monta las suscripciones a eventos realtime
 * que disparan toasts.
 *
 * Decisión de diseño:
 *  - El ToastContainer va en `App.tsx` (NO en RealtimeProvider) para
 *    que los toasts persistan entre navegaciones de módulo. Lo monta
 *    <AppLayout> por simplicidad.
 *  - La posición se decide por CSS (clases responsive de Tailwind)
 *    sobreescribiendo el `position` por defecto del container. Esto
 *    evita tener que desmontar/remontar el container al cambiar de
 *    breakpoint.
 *  - Los handlers de realtime van ACÁ, no en RealtimeProvider, para
 *    no acoplar la lógica de notificaciones al provider de conexión.
 *    El provider sigue siendo responsable solo del lifecycle del socket.
 */
import { useEffect } from 'react'
import { ToastContainer } from 'react-toastify'
import 'react-toastify/dist/ReactToastify.css'
import { useNavigate } from 'react-router-dom'
import { useRealtimeEvent, type RealtimeEvent } from '../hooks/useRealtimeEvent'
import { toast } from '../lib/toast.tsx'
import { useAuth } from '../store/auth'
import { bodegaActivaStore, useBodegaActiva } from '../store/bodegaActiva'

// ── Tipos de payload (subset de lo que el back emite) ────────

type AlertaPayload = {
  id: string
  nivel: 'Advertencia' | 'Critica'
  mensaje: string
  atendida: boolean
  producto: { id: string; nombre: string; codigo: string; stockMinimo: number }
  bodega?: { id: string; nombre: string }
}

type AlertaResolvedPayload = { id: string }

type PedidoPayload = {
  id: string
  estado: string
  cliente?: { nombre?: string; razonSocial?: string }
  total?: number
}

type DevolucionPayload = {
  id: string
  cliente?: { nombre?: string; razonSocial?: string }
  total?: number
}

type MovimientoPayload = {
  id: string
  cantidad: number
  tipo: { id: string; nombre: string; signo: string }
  producto: { id: string; nombre: string; codigo: string; unidad: string }
  bodegaOrigen?: { id: string; nombre: string } | null
  bodegaDestino?: { id: string; nombre: string } | null
}

// ── Componente ───────────────────────────────────────────────

export function ToastBridge() {
  const navigate = useNavigate()
  const auth = useAuth()
  const bodegaActivaId = useBodegaActiva()

  // Si no está autenticado, no tiene sentido escuchar
  const skip = auth.status !== 'autenticado'

  // 0) Cambio de bodega activa — toast de éxito
  // El store dispara `onCambio` en CADA set(), incluyendo los auto-sets
  // del SelectorBodega (primera bodega al cargar, fallback, etc.).
  // Para no spammear al usuario con toasts durante la carga inicial,
  // guardamos la bodega que había al montar y solo mostramos el toast
  // si cambia respecto a esa.
  useEffect(() => {
    const bodegaInicial = bodegaActivaStore.getId()
    return bodegaActivaStore.onCambio(({ nueva, nombreNueva }) => {
      // Ignorar el primer cambio si es la bodega inicial (auto-set al cargar)
      if (nueva === bodegaInicial) return
      // Ignorar reset (logout)
      if (nueva === null) return
      toast.cambioBodega({ nombre: nombreNueva })
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth.status])
  useRealtimeEvent<AlertaPayload>(
    'alerta.created',
    (e: RealtimeEvent<AlertaPayload>) => {
      try {
        // Solo alertar si la bodega activa coincide (o si no hay activa
        // y el evento trae bodega — en ese caso somos permisivos).
        if (bodegaActivaId && e.bodegaId && e.bodegaId !== bodegaActivaId) return
        if (!e.payload?.producto?.nombre) return
        const goToAlertas = () => navigate('/alertas')
        if (e.payload.nivel === 'Critica') {
          toast.alertaCritica({
            producto: e.payload.producto.nombre,
            bodega: e.payload.bodega?.nombre,
            onVer: goToAlertas,
          })
        } else {
          toast.alertaAdvertencia({
            producto: e.payload.producto.nombre,
            bodega: e.payload.bodega?.nombre,
            onVer: goToAlertas,
          })
        }
      } catch (err) {
        // eslint-disable-next-line no-console
        console.warn('[toast-bridge] alerta.created falló:', err)
      }
    },
    { skip },
  )

  useRealtimeEvent<AlertaResolvedPayload>(
    'alerta.resolved',
    (e: RealtimeEvent<AlertaResolvedPayload>) => {
      try {
        if (bodegaActivaId && e.bodegaId && e.bodegaId !== bodegaActivaId) return
        toast.alertaResuelta({ producto: 'Producto' })
      } catch (err) {
        // eslint-disable-next-line no-console
        console.warn('[toast-bridge] alerta.resolved falló:', err)
      }
    },
    { skip },
  )

  // 2) Pedidos
  useRealtimeEvent<PedidoPayload>(
    'pedido.creado',
    (e: RealtimeEvent<PedidoPayload>) => {
      try {
        if (bodegaActivaId && e.bodegaId && e.bodegaId !== bodegaActivaId) return
        if (!e.payload) return
        toast.pedidoCreado({
          cliente: e.payload.cliente?.nombre ?? e.payload.cliente?.razonSocial ?? 'Cliente',
          total: e.payload.total,
        })
      } catch (err) {
        // eslint-disable-next-line no-console
        console.warn('[toast-bridge] pedido.creado falló:', err)
      }
    },
    { skip },
  )

  useRealtimeEvent<PedidoPayload>(
    'pedido.estado-cambiado',
    (e: RealtimeEvent<PedidoPayload>) => {
      try {
        if (bodegaActivaId && e.bodegaId && e.bodegaId !== bodegaActivaId) return
        if (!e.payload) return
        toast.pedidoEstadoCambiado({
          estado: e.payload.estado,
          pedidoId: e.payload.id,
        })
      } catch (err) {
        // eslint-disable-next-line no-console
        console.warn('[toast-bridge] pedido.estado-cambiado falló:', err)
      }
    },
    { skip },
  )

  // 3) Devoluciones
  useRealtimeEvent<DevolucionPayload>(
    'devolucion.creada',
    (e: RealtimeEvent<DevolucionPayload>) => {
      try {
        if (bodegaActivaId && e.bodegaId && e.bodegaId !== bodegaActivaId) return
        if (!e.payload) return
        toast.devolucionCreada({
          cliente: e.payload.cliente?.nombre ?? e.payload.cliente?.razonSocial ?? 'Cliente',
          total: e.payload.total,
          onVer: () => navigate('/devoluciones'),
        })
      } catch (err) {
        // eslint-disable-next-line no-console
        console.warn('[toast-bridge] devolucion.creada falló:', err)
      }
    },
    { skip },
  )

  // 4) Movimientos de stock (entrada, salida, ajuste, transferencia, etc.)
  useRealtimeEvent<MovimientoPayload>(
    'movimiento.created',
    (e: RealtimeEvent<MovimientoPayload>) => {
      if (bodegaActivaId && e.bodegaId && e.bodegaId !== bodegaActivaId) return
      toast.movimientoCreado({
        tipo: e.payload.tipo.nombre,
        signo: e.payload.tipo.signo,
        producto: e.payload.producto.nombre,
        cantidad: e.payload.cantidad,
        unidad: e.payload.producto.unidad,
        onVer: () => navigate('/movimientos'),
      })
    },
    { skip },
  )

  return (
    <ToastContainer
      // position se redefine por CSS para soportar responsive
      position="top-right"
      autoClose={5000}
      hideProgressBar={false}
      newestOnTop
      closeOnClick
      rtl={false}
      pauseOnFocusLoss
      draggable
      pauseOnHover
      theme="dark"
      // Responsive: top-right en desktop, top-center en móvil (<sm)
      // Lo hacemos con una clase custom que sobreescribe el style inline
      // de react-toastify.
      className="sp-toast-container"
    />
  )
}
