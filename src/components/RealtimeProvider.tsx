/**
 * RealtimeProvider — inicializa la conexión WebSocket cuando el usuario
 * está autenticado, y la cierra al hacer logout.
 *
 * También expone un indicador "🟢 En vivo" / "🟡 Conectando" en la
 * esquina superior derecha del layout.
 *
 * Decisión de diseño: usamos un componente "tonto" (no Context) porque
 * el socket es un singleton global. Los hooks (`useRealtimeEvent`)
 * acceden a él vía `getSocket()` directamente, sin necesidad de un
 * Context. Esto evita re-renders innecesarios en toda la app cuando
 * el socket se reconecta.
 *
 * El provider solo se encarga del lifecycle: connect al montar, disconnect
 * al desmontar, y exponer el status para el indicador.
 */
import { useEffect, useState } from 'react'
import {
  disconnectSocket,
  getSocket,
  setActiveBodega,
  setUserBodegas,
  subscribeSocketStatus,
  type SocketStatus,
} from '../lib/socket'
import { useRealtimeEvent } from '../hooks/useRealtimeEvent'
import { useAuth } from '../store/auth'
import { alertasStore } from '../store/alertas'
import { movimientosStore } from '../store/movimientos'
import { productosStore } from '../store/productos'
import { pedidosStore } from '../store/pedidos'
import { devolucionesStore } from '../store/devoluciones'
import { bodegaActivaStore, useBodegaActiva } from '../store/bodegaActiva'

export function RealtimeProvider({ children }: { children: React.ReactNode }) {
  const auth = useAuth()
  const bodegaActivaId = useBodegaActiva()
  const [status, setStatus] = useState<SocketStatus>('disconnected')

  // Conectar cuando el usuario se autentica, desconectar al logout.
  // También: pasarle al back las bodegas del user (para que joinee
  // a N rooms en el handshake) y la bodega activa (tracking).
  useEffect(() => {
    if (auth.status === 'autenticado') {
      // Las bodegas ya quedaron en sessionStorage vía /auth/me.
      // Forzamos el set para que el socket se re-conecte si cambiaron
      // (caso: admin acaba de agregar una bodega, la lista creció).
      const bodegas = auth.sesion.usuario.bodegas ?? []
      setUserBodegas(bodegas)
      // El getSocket() lee el token de sessionStorage y crea/conecta.
      getSocket()
    } else {
      disconnectSocket()
    }
    return () => {
      // NO desconectamos acá (socket compartido). Lo hace el effect
      // de arriba cuando auth pasa a 'anonimo'.
    }
  }, [auth.status])

  // Cada vez que cambia la bodega activa, avisarle al back
  useEffect(() => {
    if (auth.status === 'autenticado') {
      setActiveBodega(bodegaActivaId)
    }
    // También: si la bodega activa está en la lista del user, no hay
    // que hacer nada extra. Si NO está, podría ser un caso borde de
    // localStorage viejo — por ahora lo dejamos.
  }, [bodegaActivaId, auth.status])

  // Suscribirse al status para el indicador
  useEffect(() => {
    return subscribeSocketStatus(setStatus)
  }, [])

  // ── Suscripciones a eventos ────────────────────────────────
  // Estas suscripciones viven acá porque el provider está montado
  // mientras el usuario esté autenticado. Cada vez que llega un
  // evento, despachamos al store correspondiente.
  useRealtimeEvent('alerta.created', (e) => {
    alertasStore.handleAlertaCreada(e)
  })
  useRealtimeEvent('alerta.resolved', (e) => {
    alertasStore.handleAlertaResuelta(e)
  })
  useRealtimeEvent('movimiento.created', (e) => {
    // Refetch silencioso de la lista de productos (la cantidad de stock
    // del producto afectado se actualiza en el back y se trae fresca).
    void productosStore.handleMovimientoCreado({ bodegaId: e.bodegaId })
    // También actualizamos la lista de movimientos (insert arriba en pág 1)
    const currentBodegaId = bodegaActivaStore.getSnapshot().bodegaId ?? undefined
    movimientosStore.handleMovimientoCreado({
      bodegaId: e.bodegaId,
      payload: e.payload as any,
      currentBodegaId,
    })
  })
  useRealtimeEvent('producto.creado', (e) => {
    void productosStore.handleProductoCambiado({ bodegaId: e.bodegaId })
  })
  useRealtimeEvent('producto.actualizado', (e) => {
    void productosStore.handleProductoCambiado({ bodegaId: e.bodegaId })
  })
  useRealtimeEvent('producto.eliminado', (e) => {
    void productosStore.handleProductoCambiado({ bodegaId: e.bodegaId })
  })
  useRealtimeEvent('pedido.creado', (e) => {
    const currentBodegaId = bodegaActivaStore.getSnapshot().bodegaId ?? undefined
    pedidosStore.handlePedidoCreado({
      bodegaId: e.bodegaId,
      payload: e.payload as any,
      currentBodegaId,
    })
  })
  useRealtimeEvent('pedido.estado-cambiado', (e) => {
    pedidosStore.handleEstadoCambiado(e)
  })
  useRealtimeEvent('entrega-item.cambiado', (e) => {
    pedidosStore.handleEntregaItemCambiado(e)
  })
  useRealtimeEvent('devolucion.creada', (e) => {
    const currentBodegaId = bodegaActivaStore.getSnapshot().bodegaId ?? undefined
    devolucionesStore.handleDevolucionCreada({
      bodegaId: e.bodegaId,
      payload: e.payload as any,
      currentBodegaId,
    })
  })
  useRealtimeEvent('devolucion.cambiada', (e) => {
    devolucionesStore.handleDevolucionCambiada(e)
  })

  return (
    <>
      {children}
      <RealtimeIndicator status={status} />
    </>
  )
}

function RealtimeIndicator({ status }: { status: SocketStatus }) {
  // Solo mostrar si está autenticado (no en /login o /landing)
  const auth = useAuth()
  if (auth.status !== 'autenticado') return null

  const config: Record<SocketStatus, { dot: string; text: string; label: string }> = {
    connected: { dot: 'bg-emerald-500', text: 'text-emerald-500', label: 'EN VIVO' },
    connecting: { dot: 'bg-amber-500 animate-pulse', text: 'text-amber-500', label: 'CONECTANDO' },
    error: { dot: 'bg-red-500', text: 'text-red-500', label: 'SIN CONEXIÓN' },
    disconnected: { dot: 'bg-zinc-500', text: 'text-zinc-500', label: 'DESCONECTADO' },
  }
  const c = config[status]
  return (
    <div
      className="fixed bottom-3 right-3 z-50 flex items-center gap-2 px-2.5 py-1 rounded-full bg-background/80 backdrop-blur border border-border shadow-sm"
      style={{ fontFamily: "'JetBrains Mono', monospace" }}
      title={`WebSocket: ${c.label}`}
    >
      <span className={`w-2 h-2 rounded-full ${c.dot}`} aria-hidden />
      <span className={`text-[10px] tracking-widest ${c.text}`}>{c.label}</span>
    </div>
  )
}
