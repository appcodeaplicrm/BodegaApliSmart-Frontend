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
import { createContext, useContext, useEffect, useState } from 'react'
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
import { dashboardStore } from '../store/dashboard'
import { kitsStore } from '../store/kits'
import { permisosStore } from '../store/permisos'
import { usuariosStore } from '../store/usuarios'
import { bodegasStore } from '../store/bodegas'

const RealtimeStatusContext = createContext<SocketStatus>('disconnected')

export function useRealtimeStatus(): SocketStatus {
  return useContext(RealtimeStatusContext)
}

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
    alertasStore.handleAlertaCreada(e as any)
    if (e.bodegaId) void alertasStore.refetch(e.bodegaId).catch(() => undefined)
    void dashboardStore.refetchActual(e.bodegaId).catch(() => undefined)
  })
  useRealtimeEvent('alerta.resolved', (e) => {
    alertasStore.handleAlertaResuelta(e)
    void dashboardStore.refetchActual(e.bodegaId).catch(() => undefined)
  })
  useRealtimeEvent('movimiento.created', (e) => {
    // Refetch silencioso de la lista de productos (la cantidad de stock
    // del producto afectado se actualiza en el back y se trae fresca).
    void productosStore.handleMovimientoCreado({ bodegaId: e.bodegaId })
    // Refetch de la lista de movimientos. NO insertamos el payload
    // directamente porque el socket emite una versión "delgada" (sin
    // cantidadBase, stockAnterior, fecha, observacion, usuario, etc.)
    // y el componente Movimientos.tsx lee todos esos campos → tira
    // error de render si los encuentra como undefined.
    // El refetch trae el movimiento completo desde /movimientos con la
    // forma que el componente ya sabe consumir.
    void movimientosStore.refetchActual()
    void dashboardStore.refetchActual(e.bodegaId).catch(() => undefined)
  })
  /**
   * `compra.creada` cubre el caso de Movimientos → "Registrar compra"
   * (multi-item). Una compra crea N MovimientoInventario pero emite UN
   * solo evento. El back se encarga de actualizar stock + costoPromedio
   * en la misma transacción. Acá disparamos UN refetch por cada store
   * afectado, en vez de N refetches si emitiéramos `movimiento.created`
   * por cada item.
   */
  useRealtimeEvent('compra.creada', (e) => {
    // Mismo handler que `movimiento.created` para el refetch de la
    // lista de productos: el stock de los productos afectados cambió.
    void productosStore.handleMovimientoCreado({ bodegaId: e.bodegaId })
    // Refetch de movimientos: aparecen N nuevos (uno por item).
    void movimientosStore.refetchActual()
    // Alertas: una compra puede subir el stock por encima del mínimo
    // y resolver alertas críticas. El back ya las marca como resueltas
    // si corresponde, pero el front necesita refetchear la lista para
    // que el conteo del chip y la grilla reflejen el cambio.
    if (e.bodegaId) {
      void alertasStore.refetch(e.bodegaId).catch(() => undefined)
    }
    void dashboardStore.refetchActual(e.bodegaId).catch(() => undefined)
  })
  useRealtimeEvent('producto.creado', (e) => {
    void productosStore.handleProductoCambiado({ bodegaId: e.bodegaId })
    void dashboardStore.refetchActual(e.bodegaId).catch(() => undefined)
  })
  useRealtimeEvent('producto.actualizado', (e) => {
    void productosStore.handleProductoCambiado({ bodegaId: e.bodegaId })
    void dashboardStore.refetchActual(e.bodegaId).catch(() => undefined)
  })
  useRealtimeEvent('producto.eliminado', (e) => {
    void productosStore.handleProductoCambiado({ bodegaId: e.bodegaId })
    void dashboardStore.refetchActual(e.bodegaId).catch(() => undefined)
  })
  useRealtimeEvent('pedido.creado', (e) => {
    const currentBodegaId = bodegaActivaStore.getSnapshot().bodegaId ?? undefined
    pedidosStore.handlePedidoCreado({
      bodegaId: e.bodegaId,
      payload: e.payload as any,
      currentBodegaId,
    })
    void dashboardStore.refetchActual(e.bodegaId).catch(() => undefined)
  })
  useRealtimeEvent('pedido.estado-cambiado', (e) => {
    pedidosStore.handleEstadoCambiado(e as any)
    void dashboardStore.refetchActual(e.bodegaId).catch(() => undefined)
  })
  useRealtimeEvent('entrega-item.cambiado', (e) => {
    pedidosStore.handleEntregaItemCambiado(e as any)
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
    devolucionesStore.handleDevolucionCambiada(e as any)
  })

  // ── Paso 3: cobertura completa de catálogos + multi-user ────
  // Para los stores globales (kit, usuario, rol, bodega) hacemos
  // refetch directo. Para los catálogos locales (categoría, marca,
  // proveedor, ubicación, unidad-medida) que NO tienen store global,
  // despachamos un CustomEvent en window. Cada pantalla que muestra
  // un catálogo escucha ese evento y refetchea en silencio.

  useRealtimeEvent('kit.creado', (e) => {
    if (e.bodegaId) {
      void kitsStore.cargar(e.bodegaId).catch(() => undefined)
    } else {
      void kitsStore.recargarSilencioso().catch(() => undefined)
    }
  })
  useRealtimeEvent('kit.actualizado', () => {
    void kitsStore.recargarSilencioso().catch(() => undefined)
  })
  useRealtimeEvent('kit.eliminado', () => {
    void kitsStore.recargarSilencioso().catch(() => undefined)
  })

  useRealtimeEvent('rol.creado', () => {
    void permisosStore.cargar().catch(() => undefined)
  })
  useRealtimeEvent('rol.actualizado', () => {
    void permisosStore.cargar().catch(() => undefined)
  })
  useRealtimeEvent('rol.eliminado', () => {
    void permisosStore.cargar().catch(() => undefined)
  })

  useRealtimeEvent('usuario.creado', () => {
    void usuariosStore.recargarSilencioso().catch(() => undefined)
  })
  useRealtimeEvent('usuario.actualizado', () => {
    void usuariosStore.recargarSilencioso().catch(() => undefined)
  })
  useRealtimeEvent('usuario.eliminado', () => {
    void usuariosStore.recargarSilencioso().catch(() => undefined)
  })

  useRealtimeEvent('bodega.creada', () => {
    // Sin bodegaId porque es broad del tenant. Forzamos recarga
    // completa (no tenemos lastQuery cacheado en bodegasStore).
    void bodegasStore.cargar({ force: true }).catch(() => undefined)
  })

  // Catálogos locales — disparan CustomEvent en window. Ver `useCatalogoRealtime`
  // (helper que las pantallas usan para escuchar).
  const dispatchCatalogo = (tipo: string) => {
    if (typeof window === 'undefined') return
    window.dispatchEvent(new CustomEvent('realtime:catalogo', { detail: { tipo } }))
  }
  useRealtimeEvent('categoria.creada', () => dispatchCatalogo('categoria'))
  useRealtimeEvent('categoria.actualizada', () => dispatchCatalogo('categoria'))
  useRealtimeEvent('categoria.eliminada', () => dispatchCatalogo('categoria'))
  useRealtimeEvent('marca.creada', () => dispatchCatalogo('marca'))
  useRealtimeEvent('marca.actualizada', () => dispatchCatalogo('marca'))
  useRealtimeEvent('marca.eliminada', () => dispatchCatalogo('marca'))
  useRealtimeEvent('proveedor.creado', () => dispatchCatalogo('proveedor'))
  useRealtimeEvent('proveedor.actualizado', () => dispatchCatalogo('proveedor'))
  useRealtimeEvent('proveedor.eliminado', () => dispatchCatalogo('proveedor'))
  useRealtimeEvent('ubicacion.creada', () => dispatchCatalogo('ubicacion'))
  useRealtimeEvent('ubicacion.actualizada', () => dispatchCatalogo('ubicacion'))
  useRealtimeEvent('ubicacion.eliminada', () => dispatchCatalogo('ubicacion'))
  useRealtimeEvent('unidad-medida.creada', () => dispatchCatalogo('unidad-medida'))
  useRealtimeEvent('unidad-medida.actualizada', () => dispatchCatalogo('unidad-medida'))
  useRealtimeEvent('unidad-medida.eliminada', () => dispatchCatalogo('unidad-medida'))

  return <RealtimeStatusContext.Provider value={status}>{children}</RealtimeStatusContext.Provider>
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
