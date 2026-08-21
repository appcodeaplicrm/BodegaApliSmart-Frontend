/**
 * Modal para crear una solicitud a bodega (técnico/encargado).
 *
 * El bodeguero la aprueba/rechaza/entrega desde la bandeja (Cap 8 UI
 * del bodeguero queda para iteración, el back ya está).
 */
import { useEffect, useMemo, useState } from 'react'
import {
  AlertCircle,
  Loader2,
  Plus,
  Send,
  Trash2,
} from 'lucide-react'
import { Modal } from '../Modal'
import { crearSolicitud, listarProductos } from './api'
import type { ProductoCatalogoT } from './api'

type Props = {
  open: boolean
  proyectoId: string
  bodegaId: string
  onClose: () => void
  onCreated: () => void
}

type Item = {
  productoId: string
  cantidadSolicitada: number
  nombre: string
  unidad: string
}

export function SolicitudBodegaModal({
  open,
  proyectoId,
  bodegaId,
  onClose,
  onCreated,
}: Props) {
  const [productos, setProductos] = useState<ProductoCatalogoT[]>([])
  const [items, setItems] = useState<Item[]>([])
  const [comentario, setComentario] = useState('')
  const [loadingCatalogos, setLoadingCatalogos] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  useEffect(() => {
    if (!open || !bodegaId) return
    setLoadingCatalogos(true)
    void listarProductos(bodegaId)
      .then(setProductos)
      .catch(() => setProductos([]))
      .finally(() => setLoadingCatalogos(false))
  }, [open, bodegaId])

  useEffect(() => {
    if (!open) {
      setItems([])
      setComentario('')
      setErrorMsg(null)
    }
  }, [open])

  const errores = useMemo<string[]>(() => {
    const e: string[] = []
    if (!items.some((it) => it.productoId && it.cantidadSolicitada > 0)) {
      e.push('Agregá al menos un producto con cantidad > 0.')
    }
    return e
  }, [items])

  function addItem() {
    setItems((prev) => [
      ...prev,
      { productoId: '', cantidadSolicitada: 0, nombre: '', unidad: '' },
    ])
  }
  function updateItem(idx: number, patch: Partial<Item>) {
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)))
  }
  function removeItem(idx: number) {
    setItems((prev) => prev.filter((_, i) => i !== idx))
  }

  async function handleSubmit() {
    if (errores.length > 0 || submitting) return
    setSubmitting(true)
    setErrorMsg(null)
    try {
      const itemsValidos = items
        .filter((it) => it.productoId && it.cantidadSolicitada > 0)
        .map((it) => ({
          productoId: it.productoId,
          cantidadSolicitada: it.cantidadSolicitada,
        }))
      await crearSolicitud(proyectoId, {
        items: itemsValidos,
        comentario: comentario.trim() || undefined,
      })
      onCreated()
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'No se pudo crear la solicitud.'
      setErrorMsg(msg)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Nueva solicitud a bodega"
      description="El bodeguero la revisa y aprueba. Cuando la entrega, se descuenta el stock y se suma al costo del proyecto."
      icon={<Send size={18} />}
      size="xl"
      footer={
        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 text-sm border border-border hover:border-foreground/40 transition-colors"
            style={{ borderRadius: '0.25rem' }}
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={errores.length > 0 || submitting}
            className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
            style={{ borderRadius: '0.25rem' }}
          >
            {submitting && <Loader2 size={13} className="animate-spin" />}
            Enviar solicitud
          </button>
        </div>
      }
    >
      {loadingCatalogos ? (
        <div className="p-6 flex items-center justify-center text-muted-foreground">
          <Loader2 size={18} className="animate-spin mr-2" />
          Cargando productos…
        </div>
      ) : (
        <div className="p-5 sm:p-6 space-y-4">
          {errores.length > 0 && (
            <div className="border border-destructive/30 bg-destructive/5 p-3 space-y-1">
              {errores.map((e, i) => (
                <div key={i} className="flex items-start gap-2 text-xs text-destructive">
                  <AlertCircle size={12} className="mt-0.5 shrink-0" />
                  <span>{e}</span>
                </div>
              ))}
            </div>
          )}
          {errorMsg && (
            <div className="border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">
              {errorMsg}
            </div>
          )}

          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              {items.length} {items.length === 1 ? 'producto' : 'productos'} en la solicitud
            </p>
            <button
              type="button"
              onClick={addItem}
              className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
            >
              <Plus size={12} /> Agregar producto
            </button>
          </div>

          {items.length === 0 ? (
            <div className="border border-dashed border-border p-8 text-center text-xs text-muted-foreground">
              Empezá agregando productos a solicitar.
            </div>
          ) : (
            <div className="space-y-2">
              {items.map((it, idx) => (
                <div
                  key={idx}
                  className="grid grid-cols-12 gap-2 p-2 border border-border bg-muted/20 items-center"
                  style={{ borderRadius: '0.25rem' }}
                >
                  <div className="col-span-7">
                    <select
                      value={it.productoId}
                      onChange={(e) => {
                        const p = productos.find((x) => x.id === e.target.value)
                        updateItem(idx, {
                          productoId: e.target.value,
                          nombre: p?.nombre ?? '',
                          unidad: p?.unidadMedida?.abreviatura ?? '',
                        })
                      }}
                      className="w-full px-2 py-1.5 bg-background border border-border text-xs"
                      style={{ borderRadius: '0.25rem' }}
                    >
                      <option value="">Producto…</option>
                      {productos.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.nombre} ({p.codigo})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="col-span-3">
                    <input
                      type="number"
                      step="0.001"
                      min="0"
                      value={it.cantidadSolicitada || ''}
                      onChange={(e) =>
                        updateItem(idx, {
                          cantidadSolicitada: Number(e.target.value) || 0,
                        })
                      }
                      placeholder="Cant."
                      className="w-full px-2 py-1.5 bg-background border border-border text-xs"
                      style={{ borderRadius: '0.25rem' }}
                    />
                  </div>
                  <div className="col-span-1 text-[10px] text-muted-foreground px-1">
                    {it.unidad || '—'}
                  </div>
                  <div className="col-span-1 flex justify-end">
                    <button
                      type="button"
                      onClick={() => removeItem(idx)}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-foreground mb-1">
              Comentario (opcional)
            </label>
            <textarea
              value={comentario}
              onChange={(e) => setComentario(e.target.value)}
              rows={2}
              placeholder="Para qué se necesita el material…"
              className="w-full px-3 py-2 bg-background border border-border text-sm focus:outline-none focus:border-foreground/40 resize-none"
              style={{ borderRadius: '0.25rem' }}
            />
          </div>
        </div>
      )}
    </Modal>
  )
}
