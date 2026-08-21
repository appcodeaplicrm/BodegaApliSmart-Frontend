import { useAuth } from '../store/auth'

/** Controla si una evidencia puede elegirse de la galería o debe capturarse ahora. */
export function useCapturaEvidencia() {
  const auth = useAuth()
  const puedeSubir = auth.status === 'autenticado'
    && auth.sesion.permisos.includes('evidencias.subir')
  return {
    puedeSubir,
    capture: 'environment' as const,
    accionFoto: 'Tomar foto',
    accionSubir: 'Subir foto',
  }
}
