import { useEffect, useRef, useState } from 'react'
import { Camera, Trash2, Upload, X, Loader2 } from 'lucide-react'
import { eliminarFoto, getMiFoto, subirFoto } from './api'
import { imageUrl } from '../../lib/apiBase'
import { apiToast } from '../../lib/apiToasts'
import { ConfirmModal } from '../../components/ConfirmModal'

/**
 * Componente de foto de perfil.
 *
 * - Si NO hay foto: muestra un cuadro con "Subir foto" y un input file
 *   con `capture="user"` (cámara frontal en mobile, abrir diálogo en desktop).
 * - Si HAY foto: muestra la imagen con un botón de cámara flotante para
 *   reemplazarla, y un botón de papelera para eliminarla.
 *
 * El componente notifica al padre cuando cambia la foto con `onChange(url)`,
 * así el `ProfileCard` puede re-renderizar el avatar del header con la nueva
 * imagen sin tener que refetchar `/perfil`.
 *
 * Tamaño máximo: 10MB (lo valida el back). Mime types: image/png, image/jpeg,
 * image/webp (lo valida el back).
 */
export function FotoPerfil({
  urlInicial,
  nombre,
  onChange,
}: {
  /** URL pública actual de la foto, o null si no hay. */
  urlInicial: string | null
  /** Nombre del user, para iniciales de fallback (no se usa acá, queda para el padre). */
  nombre: string
  /** Se llama con la nueva URL (o null) cuando el user sube/elimina la foto. */
  onChange: (newUrl: string | null) => void
}) {
  const [currentUrl, setCurrentUrl] = useState<string | null>(urlInicial)
  const [previewLocal, setPreviewLocal] = useState<string | null>(null)
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmRemove, setConfirmRemove] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Si el padre nos pasa otra URL (ej. refetch), sincronizamos.
  useEffect(() => {
    setCurrentUrl(urlInicial)
  }, [urlInicial])

  // Limpia el blob URL cuando se cambia de archivo o se desmonta.
  useEffect(() => {
    return () => {
      if (previewLocal) URL.revokeObjectURL(previewLocal)
    }
  }, [previewLocal])

  function handlePick() {
    setError(null)
    fileInputRef.current?.click()
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    // Reseteamos el value para permitir re-seleccionar el MISMO archivo después.
    e.target.value = ''
    if (!file) return

    // Validación cliente (rápida). El back valida de nuevo.
    if (!/^image\/(png|jpe?g|webp)$/i.test(file.type)) {
      const msg = 'Formato no soportado. Usa PNG, JPG o WEBP.'
      setError(msg)
      apiToast.error(msg)
      return
    }
    if (file.size > 10 * 1024 * 1024) {
      const msg = 'La foto no puede pesar más de 10 MB.'
      setError(msg)
      apiToast.error(msg)
      return
    }

    setError(null)
    if (previewLocal) URL.revokeObjectURL(previewLocal)
    setPreviewLocal(URL.createObjectURL(file))
    setPendingFile(file)
  }

  function cancelarPreview() {
    if (previewLocal) URL.revokeObjectURL(previewLocal)
    setPreviewLocal(null)
    setPendingFile(null)
    setError(null)
  }

  async function confirmarSubida() {
    if (!pendingFile) return
    setUploading(true)
    setError(null)
    try {
      const res = await subirFoto(pendingFile)
      const finalUrl = imageUrl(res.url) ?? res.url
      setCurrentUrl(finalUrl)
      setPendingFile(null)
      if (previewLocal) URL.revokeObjectURL(previewLocal)
      setPreviewLocal(null)
      onChange(finalUrl)
      apiToast.exito('Foto de perfil actualizada.')
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'No se pudo subir la foto.'
      setError(msg)
      apiToast.error(msg)
    } finally {
      setUploading(false)
    }
  }

  async function handleEliminar() {
    setError(null)
    try {
      await eliminarFoto()
      setCurrentUrl(null)
      onChange(null)
      apiToast.exito('Foto de perfil quitada.')
      setConfirmRemove(false)
    } catch (e) {
      // Re-lanzamos para que el ConfirmModal muestre el error inline.
      // El toast rojo lo evita acá para no duplicar con el banner del modal.
      throw e instanceof Error ? e : new Error('No se pudo quitar la foto.')
    }
  }

  // Lo que se muestra: la preview local (si hay pending) tiene prioridad
  // sobre la foto del server. Si no hay ninguna, mostramos el input vacío.
  const showing = previewLocal ?? currentUrl

  return (
    <div className="flex flex-col items-center gap-3">
      {/* Avatar grande con botones flotantes */}
      <div className="relative">
        <div
          className="w-32 h-32 rounded-2xl overflow-hidden border-4 border-card bg-muted flex items-center justify-center"
          style={{ boxShadow: '0 4px 20px rgba(0,0,0,0.35)' }}
        >
          {showing ? (
            <img
              src={showing}
              alt="Foto de perfil"
              className="w-full h-full object-cover"
              onError={(e) => {
                // Si la URL se rompió (ej. archivo borrado del server),
                // caemos al placeholder para que no quede roto.
                ;(e.target as HTMLImageElement).style.display = 'none'
              }}
            />
          ) : (
            <div
              className="w-full h-full flex items-center justify-center bg-primary text-primary-foreground"
              style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: 48 }}
            >
              {getInitials(nombre)}
            </div>
          )}
        </div>

        {/* Botón flotante: cambiar foto */}
        <button
          onClick={handlePick}
          title="Cambiar foto"
          className="absolute -bottom-1 -right-1 w-9 h-9 rounded-full bg-secondary text-secondary-foreground border-2 border-card flex items-center justify-center hover:opacity-90 transition-opacity"
        >
          <Camera size={15} strokeWidth={2.5} />
        </button>

        {/* Si hay foto del server, botón de papelera flotante */}
        {currentUrl && !previewLocal && (
          <button
            onClick={() => setConfirmRemove(true)}
            title="Quitar foto"
            className="absolute -top-1 -right-1 w-7 h-7 rounded-full bg-primary text-primary-foreground border-2 border-card flex items-center justify-center hover:opacity-90 transition-opacity"
          >
            <Trash2 size={12} strokeWidth={2.5} />
          </button>
        )}
      </div>

      {/* Input file invisible. capture="user" prioriza la cámara frontal
          en mobile; en desktop abre el diálogo normal. */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        capture="user"
        onChange={handleFileChange}
        className="hidden"
      />

      {/* Si hay preview local (archivo elegido pero no subido): mostrar
          acciones de "Subir" y "Cancelar" para confirmar. */}
      {pendingFile ? (
        <div className="flex flex-col items-center gap-2 w-full">
          <div
            className="text-xs text-muted-foreground truncate max-w-[260px]"
            style={{ fontFamily: "'JetBrains Mono', monospace" }}
          >
            {pendingFile.name} · {(pendingFile.size / 1024).toFixed(0)} KB
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={cancelarPreview}
              disabled={uploading}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-border text-xs hover:border-foreground/30 transition-colors disabled:opacity-60"
              style={{ borderRadius: '0.25rem' }}
            >
              <X size={12} />
              Cancelar
            </button>
            <button
              onClick={confirmarSubida}
              disabled={uploading}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground text-xs font-semibold hover:opacity-90 transition-opacity disabled:opacity-60"
              style={{ borderRadius: '0.25rem' }}
            >
              {uploading ? (
                <>
                  <Loader2 size={12} className="animate-spin" />
                  Subiendo…
                </>
              ) : (
                <>
                  <Upload size={12} />
                  Subir foto
                </>
              )}
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={handlePick}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-border text-xs hover:border-foreground/30 transition-colors"
          style={{ borderRadius: '0.25rem' }}
        >
          <Camera size={12} />
          {currentUrl ? 'Cambiar foto' : 'Subir foto'}
        </button>
      )}

      {error && (
        <div
          className="text-xs text-primary bg-primary/10 border border-primary/20 px-3 py-2 w-full text-center"
          style={{ borderRadius: '0.25rem' }}
        >
          ⚠ {error}
        </div>
      )}

      {/* Modal de confirmación para quitar la foto */}
      <ConfirmModal
        open={confirmRemove}
        onClose={() => setConfirmRemove(false)}
        onConfirm={handleEliminar}
        title="¿Quitar tu foto de perfil?"
        description="Volverás a ver tus iniciales en el avatar."
        confirmLabel="Quitar foto"
        tone="danger"
      />
    </div>
  )
}

function getInitials(nombre: string): string {
  return nombre
    .split(' ')
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase()
}
