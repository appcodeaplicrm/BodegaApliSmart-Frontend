/**
 * Helper "puro" (sin JSX) sobre react-toastify.
 *
 * Lo único que necesita api.ts son `exito` y `error` con los
 * colores de marca. No requieren render custom, así que no hace
 * falta JSX ni importar toast.tsx (que sí tiene JSX).
 *
 * Mantenemos la misma paleta y tipografía que en toast.tsx para
 * que los toasts de la API se vean consistentes con los del bridge
 * de realtime.
 */
import { toast as rtfToast, type ToastOptions } from 'react-toastify'

const C = {
  success: '#ABF768',
  danger: '#ef4444',
  bg: '#2E2E2E',
  fg: '#F5F2EC',
  fgMuted: '#888880',
  border: 'rgba(255,255,255,0.08)',
} as const

const buildStyle = (accent: string): React.CSSProperties => ({
  background: C.bg,
  color: C.fg,
  border: `1px solid ${C.border}`,
  borderLeft: `3px solid ${accent}`,
  borderRadius: '0.25rem',
  boxShadow: '0 10px 30px -10px rgba(0,0,0,0.5)',
  padding: '12px 14px',
  fontFamily: "'DM Sans', system-ui, sans-serif",
})

const baseOptions: ToastOptions = {
  position: 'top-right',
  theme: 'dark',
  hideProgressBar: false,
  closeOnClick: true,
  pauseOnHover: true,
  draggable: true,
}

export const apiToast = {
  exito(mensaje: string) {
    rtfToast.success(mensaje, { ...baseOptions, style: buildStyle(C.success), autoClose: 2500 })
  },
  error(mensaje: string) {
    rtfToast.error(mensaje, { ...baseOptions, style: buildStyle(C.danger), autoClose: 5500 })
  },
}
