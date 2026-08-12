/**
 * Toast helper — wrapper tipado sobre react-toastify con los colores
 * y la tipografía de StockPro.
 *
 * Usar SIEMPRE este módulo en vez de `toast()` directo para que
 * los toasts respeten el tema de la app (no terminen con el
 * estilo por defecto de la librería).
 *
 * API:
 *   toast.alertaCritica({ producto, bodega })
 *   toast.alertaAdvertencia({ producto, bodega })
 *   toast.alertaResuelta({ producto })
 *   toast.pedidoCreado({ cliente })
 *   toast.pedidoEstadoCambiado({ estado, pedidoId })
 *   toast.devolucionCreada({ cliente, total })
 *   toast.movimientoCreado({ tipo, producto })
 *   toast.exito(mensaje) / toast.error(mensaje)  ← genéricos
 */
import { toast as rtfToast, type ToastOptions } from 'react-toastify'

// Paleta de StockPro (tailwind.config.js) — replicada acá para que
// el toast se vea igual aunque el theme CSS no haya cargado.
const C = {
  bg: '#2E2E2E',         // card
  bgAlt: '#333333',      // muted
  border: 'rgba(255,255,255,0.08)',
  fg: '#F5F2EC',         // foreground
  fgMuted: '#888880',
  primary: '#E8593F',    // naranja
  secondary: '#ABF768',  // lima
  danger: '#ef4444',
  warn: '#f59e0b',
  info: '#3b82f6',
  success: '#ABF768',
} as const

const baseOptions: ToastOptions = {
  position: 'top-right',
  autoClose: 5000,
  hideProgressBar: false,
  closeOnClick: true,
  pauseOnHover: true,
  draggable: true,
  theme: 'dark',
  // icon: false  → lo desactivamos y dibujamos el nuestro en `render`
}

const renderContent = (params: {
  icon: string
  iconBg: string
  eyebrow: string
  title: string
  body?: string
  onClick?: () => void
}) => {
  const { icon, iconBg, eyebrow, title, body, onClick } = params
  return (
    <div
      onClick={onClick}
      className="flex items-start gap-3 w-full cursor-pointer"
    >
      <div
        className="flex-shrink-0 w-9 h-9 flex items-center justify-center font-mono text-sm font-bold"
        style={{ backgroundColor: iconBg, color: C.bg, borderRadius: '0.25rem' }}
        aria-hidden
      >
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div
          className="text-[9px] uppercase tracking-widest font-mono"
          style={{ color: C.fgMuted }}
        >
          {eyebrow}
        </div>
        <div
          className="text-sm font-semibold leading-tight mt-0.5"
          style={{ color: C.fg, fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: '0.01em' }}
        >
          {title}
        </div>
        {body && (
          <div
            className="text-xs mt-1 leading-snug"
            style={{ color: C.fgMuted }}
          >
            {body}
          </div>
        )}
      </div>
    </div>
  )
}

const buildStyle = (accent: string): React.CSSProperties => ({
  background: C.bg,
  color: C.fg,
  border: `1px solid ${C.border}`,
  borderLeft: `3px solid ${accent}`,
  borderRadius: '0.25rem',
  boxShadow: '0 10px 30px -10px rgba(0,0,0,0.5)',
  padding: '12px 14px',
  fontFamily: "'DM Sans', system-ui, sans-serif",
  // En móvil queremos que se vea más compacto
  minHeight: 'auto',
})

// ── API pública ──────────────────────────────────────────────

export const toast = {
  alertaCritica(params: { producto: string; bodega?: string; onVer?: () => void }) {
    return rtfToast(
      renderContent({
        icon: '!',
        iconBg: C.danger,
        eyebrow: 'Stock crítico',
        title: params.producto,
        body: params.bodega ? `En ${params.bodega} · requiere atención inmediata` : 'Requiere atención inmediata',
        onClick: params.onVer,
      }),
      { ...baseOptions, style: buildStyle(C.danger), autoClose: 7000 }
    )
  },

  alertaAdvertencia(params: { producto: string; bodega?: string; onVer?: () => void }) {
    return rtfToast(
      renderContent({
        icon: '⚠',
        iconBg: C.warn,
        eyebrow: 'Stock bajo',
        title: params.producto,
        body: params.bodega ? `En ${params.bodega} · cerca del mínimo` : 'Cerca del mínimo configurado',
        onClick: params.onVer,
      }),
      { ...baseOptions, style: buildStyle(C.warn), autoClose: 6000 }
    )
  },

  alertaResuelta(params: { producto: string }) {
    return rtfToast(
      renderContent({
        icon: '✓',
        iconBg: C.success,
        eyebrow: 'Alerta resuelta',
        title: params.producto,
        body: 'Volvió a estar sobre el mínimo',
      }),
      { ...baseOptions, style: buildStyle(C.success), autoClose: 3500 }
    )
  },

  pedidoCreado(params: { cliente: string; total?: number }) {
    return rtfToast(
      renderContent({
        icon: '↗',
        iconBg: C.info,
        eyebrow: 'Nuevo pedido',
        title: params.cliente,
        body: params.total != null ? `Total $${params.total.toLocaleString('es-CO')}` : undefined,
      }),
      { ...baseOptions, style: buildStyle(C.info) }
    )
  },

  pedidoEstadoCambiado(params: { estado: string; pedidoId: string }) {
    return rtfToast(
      renderContent({
        icon: '↻',
        iconBg: C.info,
        eyebrow: 'Pedido actualizado',
        title: `Estado: ${params.estado}`,
        body: `Pedido #${params.pedidoId.slice(0, 8)}`,
      }),
      { ...baseOptions, style: buildStyle(C.info) }
    )
  },

  devolucionCreada(params: { cliente: string; total?: number; onVer?: () => void }) {
    return rtfToast(
      renderContent({
        icon: '↩',
        iconBg: C.warn,
        eyebrow: 'Nueva devolución',
        title: params.cliente,
        body: params.total != null ? `Por $${params.total.toLocaleString('es-CO')}` : 'Pendiente de revisión',
        onClick: params.onVer,
      }),
      { ...baseOptions, style: buildStyle(C.warn) }
    )
  },

  movimientoCreado(params: { tipo: string; signo: string; producto: string; cantidad?: number; unidad?: string; onVer?: () => void }) {
    // Color según signo:
    //   E = Entrada (verde)   S = Salida (naranja)
    //   = = Ajuste (lima)     otros (Transferencia, Devolución, Compra, Pedido) → info
    const esEntrada = params.signo === 'E'
    const esSalida = params.signo === 'S'
    const esAjuste = params.signo === '='
    const accent = esEntrada ? C.success : esSalida ? C.primary : esAjuste ? C.secondary : C.info
    const icon = esEntrada ? '↗' : esSalida ? '↘' : esAjuste ? '±' : '↔'
    const verb = esEntrada ? 'Entrada' : esSalida ? 'Salida' : esAjuste ? 'Ajuste' : params.tipo
    const body = params.cantidad != null
      ? `${esEntrada ? '+' : esSalida ? '−' : ''}${params.cantidad}${params.unidad ? ` ${params.unidad}` : ''}`
      : undefined
    return rtfToast(
      renderContent({
        icon,
        iconBg: accent,
        eyebrow: verb,
        title: params.producto,
        body,
        onClick: params.onVer,
      }),
      { ...baseOptions, style: buildStyle(accent), autoClose: 4000 }
    )
  },

  cambioBodega(params: { nombre: string | null }) {
    const nombre = params.nombre || 'la bodega'
    return rtfToast(
      renderContent({
        icon: '⇄',
        iconBg: C.secondary,
        eyebrow: 'Bodega activa',
        title: nombre,
        body: 'Cambiaste de bodega',
      }),
      { ...baseOptions, style: buildStyle(C.secondary), autoClose: 2500 }
    )
  },

  exito(mensaje: string) {
    return rtfToast.success(mensaje, { ...baseOptions, style: buildStyle(C.success), autoClose: 3000 })
  },

  error(mensaje: string) {
    return rtfToast.error(mensaje, { ...baseOptions, style: buildStyle(C.danger), autoClose: 6000 })
  },

  info(mensaje: string) {
    return rtfToast.info(mensaje, { ...baseOptions, style: buildStyle(C.info) })
  },
}
