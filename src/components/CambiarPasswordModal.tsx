import { useEffect, useState, type FormEvent } from 'react'
import { KeyRound, Loader2, CheckCircle2, Eye, EyeOff } from 'lucide-react'
import { usuariosStore, type Usuario } from '../store/usuarios'
import { useAuth } from '../store/auth'
import { ApiError } from '../lib/api'
import { Modal } from './Modal'

type Props = {
  usuario: Usuario
  onClose: () => void
  /**
   * Callback opcional cuando se cambia la pass OK. Útil para refrescar
   * la lista o mostrar un toast.
   */
  onChanged?: () => void
}

/**
 * Modal para que un admin (o el mismo usuario) cambie la contraseña
 * de un usuario.
 *
 * - Si el caller es el MISMO usuario que el target, el modal pide
 *   también la contraseña actual (defensa en profundidad: si te roban
 *   la sesión, no pueden cambiarte la pass sin saber la actual).
 * - El back se encarga de hashear con argon2. Acá solo mandamos el texto plano.
 */
export function CambiarPasswordModal({ usuario, onClose, onChanged }: Props) {
  const auth = useAuth()
  const esMiMismoUsuario =
    auth.status === 'autenticado' && auth.sesion.usuario.id === usuario.id

  const [actual, setActual] = useState('')
  const [nueva, setNueva] = useState('')
  const [confirmar, setConfirmar] = useState('')
  const [showActual, setShowActual] = useState(false)
  const [showNueva, setShowNueva] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  // Reset al cambiar de usuario
  useEffect(() => {
    setActual('')
    setNueva('')
    setConfirmar('')
    setError('')
    setSuccess(false)
  }, [usuario.id])

  const longitudMinima = 8
  const longitudOk = nueva.length >= longitudMinima
  const coinciden = nueva.length > 0 && nueva === confirmar
  const pedirActual = esMiMismoUsuario

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (submitting || success) return
    setError('')

    if (pedirActual && !actual) {
      setError('Ingresá tu contraseña actual.')
      return
    }
    if (!longitudOk) {
      setError(`La nueva contraseña debe tener al menos ${longitudMinima} caracteres.`)
      return
    }
    if (nueva !== confirmar) {
      setError('La confirmación no coincide.')
      return
    }
    if (pedirActual && actual === nueva) {
      setError('La nueva contraseña debe ser distinta de la actual.')
      return
    }

    setSubmitting(true)
    try {
      await usuariosStore.cambiarPassword(usuario.id, {
        actual: pedirActual ? actual : undefined,
        nueva,
      })
      setSuccess(true)
      onChanged?.()
      // Cerrar tras un breve delay para que se vea el check
      window.setTimeout(() => onClose(), 700)
    } catch (err) {
      const msg =
        err instanceof ApiError ? err.message : 'No se pudo cambiar la contraseña.'
      setError(msg)
    } finally {
      setSubmitting(false)
    }
  }

  const inputCls =
    'w-full px-3 py-2.5 min-h-[44px] pr-10 bg-muted border border-border text-sm text-foreground outline-none focus:border-primary/60 transition-colors'

  return (
    <Modal
      open
      onClose={onClose}
      title={usuario.nombre}
      description="Cambiar contraseña"
      icon={<KeyRound size={16} className="text-secondary" />}
      size="sm"
      footer={
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="flex-1 min-h-[44px] inline-flex items-center justify-center gap-2 py-2.5 border border-border text-sm hover:border-foreground/30 transition-colors"
            style={{ borderRadius: '0.25rem' }}
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={(e) => handleSubmit(e as unknown as FormEvent)}
            disabled={submitting || success}
            className="flex-1 min-h-[44px] inline-flex items-center justify-center gap-2 py-2.5 bg-secondary text-secondary-foreground text-sm font-semibold hover:bg-secondary/90 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            style={{ borderRadius: '0.25rem' }}
          >
            {submitting ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                Cambiando…
              </>
            ) : success ? (
              <>
                <CheckCircle2 size={14} />
                Listo
              </>
            ) : (
              <>
                <KeyRound size={14} />
                Cambiar contraseña
              </>
            )}
          </button>
        </div>
      }
    >
      <form onSubmit={handleSubmit} className="p-5 space-y-4">
        {/* Contraseña actual (solo si el caller es el mismo user) */}
        {pedirActual && (
          <div>
            <label
              className="text-[10px] text-muted-foreground tracking-widest uppercase mb-1.5 block"
              style={{ fontFamily: "'JetBrains Mono', monospace" }}
            >
              Contraseña actual
            </label>
            <div className="relative">
              <input
                type={showActual ? 'text' : 'password'}
                value={actual}
                onChange={(e) => setActual(e.target.value)}
                autoComplete="current-password"
                className={inputCls}
                style={{ borderRadius: '0.25rem', fontFamily: "'JetBrains Mono', monospace" }}
              />
              <button
                type="button"
                onClick={() => setShowActual((s) => !s)}
                className="absolute right-2 top-1/2 -translate-y-1/2 min-w-[44px] min-h-[44px] flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
                aria-label={showActual ? 'Ocultar contraseña' : 'Mostrar contraseña'}
              >
                {showActual ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
          </div>
        )}

        {/* Nueva contraseña */}
        <div>
          <label
            className="text-[10px] text-muted-foreground tracking-widest uppercase mb-1.5 block"
            style={{ fontFamily: "'JetBrains Mono', monospace" }}
          >
            Nueva contraseña
          </label>
          <div className="relative">
            <input
              type={showNueva ? 'text' : 'password'}
              value={nueva}
              onChange={(e) => setNueva(e.target.value)}
              autoComplete="new-password"
              className={inputCls}
              style={{ borderRadius: '0.25rem', fontFamily: "'JetBrains Mono', monospace" }}
            />
            <button
              type="button"
              onClick={() => setShowNueva((s) => !s)}
              className="absolute right-2 top-1/2 -translate-y-1/2 min-w-[44px] min-h-[44px] flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
              aria-label={showNueva ? 'Ocultar contraseña' : 'Mostrar contraseña'}
            >
              {showNueva ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          </div>
          {/* Indicador de longitud mínima */}
          <div
            className="mt-1.5 text-[10px] flex items-center gap-2"
            style={{ fontFamily: "'JetBrains Mono', monospace" }}
          >
            <span
              className={
                longitudOk ? 'text-secondary' : 'text-muted-foreground'
              }
            >
              {nueva.length}/{longitudMinima}+ caracteres
            </span>
            {nueva.length > 0 && !longitudOk && (
              <span className="text-primary">muy corta</span>
            )}
          </div>
        </div>

        {/* Confirmar */}
        <div>
          <label
            className="text-[10px] text-muted-foreground tracking-widest uppercase mb-1.5 block"
            style={{ fontFamily: "'JetBrains Mono', monospace" }}
          >
            Confirmar nueva contraseña
          </label>
          <input
            type="password"
            value={confirmar}
            onChange={(e) => setConfirmar(e.target.value)}
            autoComplete="new-password"
            className="w-full px-3 py-2.5 min-h-[44px] bg-muted border border-border text-sm text-foreground outline-none focus:border-primary/60 transition-colors"
            style={{ borderRadius: '0.25rem', fontFamily: "'JetBrains Mono', monospace" }}
          />
          {confirmar.length > 0 && !coinciden && (
            <div
              className="mt-1.5 text-[10px] text-primary"
              style={{ fontFamily: "'JetBrains Mono', monospace" }}
            >
              no coincide
            </div>
          )}
        </div>

        {/* Éxito */}
        {success && (
          <div
            className="flex items-center gap-2 text-xs text-secondary bg-secondary/10 border border-secondary/20 px-3 py-2"
            style={{ borderRadius: '0.25rem', fontFamily: "'JetBrains Mono', monospace" }}
          >
            <CheckCircle2 size={14} />
            Contraseña actualizada. El usuario deberá usar la nueva en el próximo login.
          </div>
        )}

        {/* Error */}
        {error && !success && (
          <div
            className="text-xs text-primary bg-primary/10 border border-primary/20 px-3 py-2"
            style={{ borderRadius: '0.25rem', fontFamily: "'JetBrains Mono', monospace" }}
          >
            ⚠ {error}
          </div>
        )}
      </form>
    </Modal>
  )
}
