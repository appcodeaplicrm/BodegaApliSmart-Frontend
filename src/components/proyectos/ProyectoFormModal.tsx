/**
 * Modal de crear proyecto.
 *
 * Estructura del form (3 secciones visuales):
 *  1. Datos básicos: nombre, descripción, km, fechas, bodega, estado.
 *  2. Roles dirigidos: chips clickeables de los roles custom del tenant.
 *     Esto filtra los users que se pueden asignar después.
 *  3. Asignación de personal: 2 modales (encargado, técnicos) que se
 *     abren sobre este form y muestran la lista de usuarios
 *     filtrados por los roles elegidos.
 *
 * Reusa componentes del sistema:
 *  - `DateTimePicker` (calendario custom, mobile-friendly).
 *  - `SeleccionarEstadoModal` (modal con lista de estados del catálogo).
 *  - `SeleccionarUsuarioModal` (modal genérico para encargado y técnicos,
 *    parametrizable por `mode='single' | 'multi'`).
 *
 * Validaciones client-side:
 *  - nombre mínimo 1 carácter
 *  - km > 0
 *  - fechaInicio válida
 *  - al menos 1 rol dirigido
 *  - bodega activa seleccionada
 *
 * La validación real (tenant, técnicos ocupados, etc.) la hace el back.
 */
import { useEffect, useMemo, useState } from 'react'
import {
  AlertCircle,
  Calendar,
  FolderKanban,
  Loader2,
  MapPin,
  Package,
  Plus,
  User,
  Users,
  X,
  Route,
} from 'lucide-react'
import { Modal } from '../Modal'
import { DateTimePicker } from '../DateTimePicker'
import { useBodegaActiva } from '../../store/bodegaActiva'
import {
  crearProyecto,
  listarRoles,
  listarUsuariosParaAsignar,
  listarProductos,
  crearNodo,
  eliminarNodo,
} from './api'
import type {
  CrearProyectoInput,
  ProyectoRol,
  ProyectoUsuarioAsignable,
} from './types'
import { SeleccionarEstadoModal } from './SeleccionarEstadoModal'
import { SeleccionarUsuarioModal } from './SeleccionarUsuarioModal'
import {
  SeleccionarProductosInicialesModal,
  type ProductoInicialParaCrearModal,
} from './SeleccionarProductosInicialesModal'
import {
  MapaNodosEditor,
  type NodoEditable,
} from './MapaNodosEditor'
import { PlanificarRutaModal } from './PlanificarRutaModal'

type Props = {
  open: boolean
  onClose: () => void
  onCreated: () => void
}

export function ProyectoFormModal({ open, onClose, onCreated }: Props) {
  const bodegaId = useBodegaActiva()
  const bodegaIdStr = bodegaId ?? ''

  // ── Catálogos ─────────────────────────────────────────────
  const [roles, setRoles] = useState<ProyectoRol[]>([])
  const [productos, setProductos] = useState<
    Array<{
      id: string
      codigo: string
      nombre: string
      costoPromedio?: number | string | null
      stockBodega?: number | string | null
      unidadMedida?: { abreviatura: string } | null
    }>
  >([])
  const [loadingCatalogos, setLoadingCatalogos] = useState(false)

  useEffect(() => {
    if (!open) return
    setLoadingCatalogos(true)
    void Promise.allSettled([listarRoles(), bodegaIdStr ? listarProductos(bodegaIdStr) : Promise.resolve([])])
      .then(([r, p]) => {
        if (r.status === 'fulfilled') setRoles(r.value)
        if (p.status === 'fulfilled') setProductos(p.value)
      })
      .finally(() => setLoadingCatalogos(false))
  }, [open, bodegaIdStr])

  // ── Form state ────────────────────────────────────────────
  const [nombreProyecto, setNombreProyecto] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [kmATrabajar, setKmATrabajar] = useState('')
  const [fechaInicio, setFechaInicio] = useState(() =>
    new Date().toISOString().slice(0, 10),
  )
  const [fechaFinEstimada, setFechaFinEstimada] = useState('')
  const [estadoId, setEstadoId] = useState('')
  // Para mostrar el resumen (bolita + nombre) en el trigger del modal.
  // El id se mantiene acá; el nombre/color se setea cuando el modal
  // confirma la selección.
  const [estadoResumen, setEstadoResumen] = useState<{
    nombre: string
    colorHex: string
  } | null>(null)
  const [rolesDirigidos, setRolesDirigidos] = useState<string[]>([])
  const [encargadoId, setEncargadoId] = useState('')
  const [tecnicosIds, setTecnicosIds] = useState<string[]>([])

  // Productos iniciales (dotación) que se crean junto con el proyecto.
  // El user los elige desde el modal `SeleccionarProductosInicialesModal`,
  // que también le deja setear cantidad y receptor. Acá solo guardamos
  // el resultado final (mismo shape que ya espera el back).
  const [productosIniciales, setProductosIniciales] = useState<ProductoInicialParaCrearModal[]>([])
  const [productosModalOpen, setProductosModalOpen] = useState(false)

  // Recorrido del proyecto (nodos del mapa). El user los arma
  // desde `MapaNodosEditor` y se persisten después de crear el
  // proyecto, en la misma transacción lógica (secuencia de POSTs).
  const [nodosRecorrido, setNodosRecorrido] = useState<NodoEditable[]>([])
  const [mapaNodosOpen, setMapaNodosOpen] = useState(false)
  const [planificarRutaOpen, setPlanificarRutaOpen] = useState(false)

  // Default: el modal de selección setea el estadoId. No hay catálogo
  // que cargar acá — el modal lo trae él mismo. Si el user abre el
  // modal y elige "Planificado", queda ese id.

  // ── Users filtrados por roles ────────────────────────────
  const [usuarios, setUsuarios] = useState<ProyectoUsuarioAsignable[]>([])
  const [loadingUsuarios, setLoadingUsuarios] = useState(false)
  useEffect(() => {
    if (!open || rolesDirigidos.length === 0 || !bodegaIdStr) {
      setUsuarios([])
      return
    }
    setLoadingUsuarios(true)
    void listarUsuariosParaAsignar({
      rolIds: rolesDirigidos,
      bodegaId: bodegaIdStr,
    })
      .then(setUsuarios)
      .catch(() => setUsuarios([]))
      .finally(() => setLoadingUsuarios(false))
  }, [open, rolesDirigidos, bodegaIdStr])

  // ── Modales auxiliares ────────────────────────────────────
  const [estadoModalOpen, setEstadoModalOpen] = useState(false)
  const [encargadoModalOpen, setEncargadoModalOpen] = useState(false)
  const [tecnicosModalOpen, setTecnicosModalOpen] = useState(false)

  // Reset al cerrar
  useEffect(() => {
    if (!open) {
      setNombreProyecto('')
      setDescripcion('')
      setKmATrabajar('')
      setFechaInicio(new Date().toISOString().slice(0, 10))
      setFechaFinEstimada('')
      setEstadoId('')
      setEstadoResumen(null)
      setRolesDirigidos([])
      setEncargadoId('')
      setTecnicosIds([])
      setProductosIniciales([])
      setProductosModalOpen(false)
      setNodosRecorrido([])
      setMapaNodosOpen(false)
      setPlanificarRutaOpen(false)
      setUsuarios([])
      setEstadoModalOpen(false)
      setEncargadoModalOpen(false)
      setTecnicosModalOpen(false)
    }
  }, [open])

  // ── Submit ────────────────────────────────────────────────
  const [submitting, setSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  // Validaciones client-side
  const errores = useMemo<string[]>(() => {
    const e: string[] = []
    if (!nombreProyecto.trim()) e.push('El nombre es obligatorio.')
    const km = Number(kmATrabajar)
    if (!kmATrabajar || isNaN(km) || km <= 0)
      e.push('Los km a trabajar deben ser un número mayor a 0.')
    if (!fechaInicio) e.push('La fecha de inicio es obligatoria.')
    if (!bodegaIdStr) e.push('Selecciona una bodega activa.')
    if (!estadoId) e.push('Selecciona un estado inicial.')
    if (rolesDirigidos.length === 0)
      e.push('Indicá al menos un rol al que está dirigido el proyecto.')
    return e
  }, [nombreProyecto, kmATrabajar, fechaInicio, bodegaIdStr, estadoId, rolesDirigidos])

  const puedeSubmit = errores.length === 0 && !submitting

  async function handleSubmit() {
    if (!puedeSubmit) return
    setSubmitting(true)
    setErrorMsg(null)
    try {
      const input: CrearProyectoInput = {
        nombreProyecto: nombreProyecto.trim(),
        descripcion: descripcion.trim() || undefined,
        kmATrabajar: Number(kmATrabajar),
        fechaInicio: new Date(fechaInicio).toISOString(),
        fechaFinEstimada: fechaFinEstimada
          ? new Date(fechaFinEstimada).toISOString()
          : undefined,
        bodegaId: bodegaIdStr,
        estadoId,
        rolesDirigidos,
        encargadoId: encargadoId || undefined,
        tecnicosIds: tecnicosIds.length > 0 ? tecnicosIds : undefined,
        productosIniciales:
          productosIniciales.length > 0
            ? productosIniciales
                .filter((p) => p.productoId && p.cantidad > 0)
                .map((p) => ({
                  productoId: p.productoId,
                  cantidad: p.cantidad,
                  tecnicoReceptorId: p.tecnicoReceptorId,
                }))
            : undefined,
      }
      const creado = await crearProyecto(input)

      // Persistir los nodos del recorrido. El back recalcula
      // `kmAcumulado` y `orden` automáticamente — solo mandamos
      // Crear los nodos del recorrido. Si alguno falla, lo
      // reportamos en pantalla y seguimos (el proyecto ya se creó;
      // los nodos que sí se pudieron persistir quedan, los fallidos
      // los podés agregar desde la tab "Mapa" del detalle).
      const nodosFallidos: string[] = []
      if (nodosRecorrido.length > 0) {
        for (let i = 0; i < nodosRecorrido.length; i++) {
          const n = nodosRecorrido[i]
          try {
            await crearNodo(creado.id, {
              latitud: n.latitud,
              longitud: n.longitud,
              nombre: n.nombre || undefined,
              tipo: n.tipo,
              orden: i + 1,
              notas: n.notas,
              // Si el nodo viene del planificador OSRM, respeta su
              // `kmAcumulado` (distancia REAL de la polyline). Si
              // no, el back recalcula con Haversine.
              kmAcumulado: n.kmAcumulado,
            })
          } catch (errNodo) {
            // eslint-disable-next-line no-console
            console.error('No se pudo crear nodo:', errNodo)
            nodosFallidos.push(n.nombre || `Nodo ${i + 1}`)
          }
        }
      }

      // Si falló algún nodo, lo reportamos al user. Pero igual
      // dejamos que el modal se cierre (el proyecto ya se creó).
      if (nodosFallidos.length > 0) {
        setErrorMsg(
          `El proyecto se creó, pero no se pudieron persistir ${nodosFallidos.length} nodo(s) del recorrido: ${nodosFallidos.join(', ')}. Podés agregarlos después desde la tab "Mapa" del detalle.`,
        )
        // No llamamos onCreated acá para que el user vea el error
        // antes de que se cierre el modal.
        return
      }

      onCreated()
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : 'No se pudo crear el proyecto.'
      setErrorMsg(msg)
    } finally {
      setSubmitting(false)
    }
  }

  // Estado seleccionado (para mostrar resumen en el trigger)
  const encargadoSeleccionado = usuarios.find((u) => u.id === encargadoId)
  const tecnicosSeleccionados = usuarios.filter((u) =>
    tecnicosIds.includes(u.id),
  )

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Nuevo proyecto"
      description="Asigná técnicos y dirigilo a los roles del tenant."
      icon={<FolderKanban size={18} />}
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
            disabled={!puedeSubmit}
            className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
            style={{ borderRadius: '0.25rem' }}
          >
            {submitting && <Loader2 size={13} className="animate-spin" />}
            Crear proyecto
          </button>
        </div>
      }
    >
      {loadingCatalogos ? (
        <div className="p-6 flex items-center justify-center text-muted-foreground">
          <Loader2 size={18} className="animate-spin mr-2" />
          Cargando catálogos…
        </div>
      ) : (
        <div className="p-5 sm:p-6 space-y-5">
          {/* ── Errores ──────────────────────────────────────── */}
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

          {/* ── Datos básicos ────────────────────────────────── */}
          <section>
            <h3
              className="text-xs uppercase tracking-widest text-muted-foreground mb-3"
              style={{ fontFamily: "'JetBrains Mono', monospace" }}
            >
              Datos básicos
            </h3>
            <div className="space-y-3">
              <Field label="Nombre del proyecto" required>
                <input
                  type="text"
                  value={nombreProyecto}
                  onChange={(e) => setNombreProyecto(e.target.value)}
                  placeholder="Tendido fibra óptica Zona Norte"
                  className="w-full px-3 py-2 bg-background border border-border text-sm focus:outline-none focus:border-foreground/40"
                  style={{ borderRadius: '0.25rem' }}
                />
              </Field>

              <Field label="Descripción (opcional)">
                <textarea
                  value={descripcion}
                  onChange={(e) => setDescripcion(e.target.value)}
                  rows={2}
                  placeholder="Detalles del proyecto, ubicación, observaciones…"
                  className="w-full px-3 py-2 bg-background border border-border text-sm focus:outline-none focus:border-foreground/40 resize-none"
                  style={{ borderRadius: '0.25rem' }}
                />
              </Field>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <Field label="Km a trabajar" required>
                  <input
                    type="number"
                    step="0.001"
                    min="0"
                    value={kmATrabajar}
                    onChange={(e) => setKmATrabajar(e.target.value)}
                    placeholder="0.000"
                    className="w-full px-3 py-2 bg-background border border-border text-sm focus:outline-none focus:border-foreground/40"
                    style={{ borderRadius: '0.25rem' }}
                  />
                </Field>
                <Field label="Fecha de inicio" required>
                  <DateTimePicker
                    mode="date"
                    value={fechaInicio}
                    onChange={setFechaInicio}
                    placeholder="Seleccionar fecha…"
                  />
                </Field>
                <Field label="Fin estimado (opcional)">
                  <DateTimePicker
                    mode="date"
                    value={fechaFinEstimada}
                    onChange={setFechaFinEstimada}
                    placeholder="Seleccionar fecha…"
                  />
                </Field>
              </div>

              <Field label="Estado inicial" required>
                <button
                  type="button"
                  onClick={() => setEstadoModalOpen(true)}
                  className="w-full min-h-[44px] bg-background border border-border px-3 text-sm text-left text-foreground hover:border-foreground/30 focus:border-primary/60 focus:outline-none transition-colors flex items-center gap-2"
                  style={{ borderRadius: '0.25rem' }}
                >
                  {estadoResumen ? (
                    <>
                      <span
                        className="inline-block w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: estadoResumen.colorHex || '#6b7280' }}
                      />
                      <span className="font-medium">{estadoResumen.nombre}</span>
                    </>
                  ) : (
                    <>
                      <span className="w-2.5 h-2.5 rounded-full bg-muted shrink-0" />
                      <span className="text-muted-foreground">
                        Elegir estado…
                      </span>
                    </>
                  )}
                </button>
              </Field>
            </div>
          </section>

          {/* ── Roles dirigidos ──────────────────────────────── */}
          <section>
            <h3
              className="text-xs uppercase tracking-widest text-muted-foreground mb-1"
              style={{ fontFamily: "'JetBrains Mono', monospace" }}
            >
              Roles dirigidos
            </h3>
            <p className="text-xs text-muted-foreground mb-3">
              Elegí los roles del tenant a los que va dirigido este proyecto.
              Esto filtra los usuarios que vas a poder asignar como encargado
              y técnicos.
            </p>
            {roles.length === 0 ? (
              <div className="text-xs text-muted-foreground border border-dashed border-border p-3">
                Tu tenant no tiene roles personalizados creados. Andá a
                "Roles y Permisos" y creá al menos uno (ej: "Técnico cableado").
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {roles.map((r) => {
                  const activo = rolesDirigidos.includes(r.id)
                  return (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() =>
                        setRolesDirigidos((prev) =>
                          activo ? prev.filter((x) => x !== r.id) : [...prev, r.id],
                        )
                      }
                      className={`px-3 py-1.5 text-xs font-medium border transition-colors ${
                        activo
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'bg-background text-foreground border-border hover:border-foreground/40'
                      }`}
                      style={{ borderRadius: '0.25rem' }}
                    >
                      {r.nombre}
                    </button>
                  )
                })}
              </div>
            )}
          </section>

          {/* ── Productos iniciales (dotación) ───────────────── */}
          <section>
            <h3
              className="text-xs uppercase tracking-widest text-muted-foreground mb-1"
              style={{ fontFamily: "'JetBrains Mono', monospace" }}
            >
              Productos iniciales
            </h3>
            <p className="text-xs text-muted-foreground mb-3">
              Dotación del proyecto. Se descuentan del stock de la bodega
              al guardar. Si no querés asignar ahora, podés hacerlo
              después desde la tab "Productos iniciales" del detalle.
            </p>

            {/* Trigger: abre el modal de selección */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setProductosModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-border hover:border-foreground/40 text-xs font-medium transition-colors"
                style={{ borderRadius: '0.25rem' }}
              >
                <Plus size={12} />
                {productosIniciales.length === 0
                  ? 'Elegir productos'
                  : 'Editar productos'}
              </button>
              {productosIniciales.length > 0 && (
                <span className="text-xs text-muted-foreground">
                  {productosIniciales.length}{' '}
                  {productosIniciales.length === 1
                    ? 'producto seleccionado'
                    : 'productos seleccionados'}
                </span>
              )}
            </div>

            {/* Chips de productos seleccionados (read-only) */}
            {productosIniciales.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {productosIniciales.map((p) => {
                  const receptor = p.tecnicoReceptorId
                    ? usuarios.find((u) => u.id === p.tecnicoReceptorId)?.nombre
                    : null
                  return (
                    <span
                      key={p.productoId}
                      className="inline-flex items-center gap-1.5 px-2 py-1 text-xs bg-muted text-foreground border border-border"
                      style={{ borderRadius: '0.125rem' }}
                      title={
                        receptor
                          ? `Receptor: ${receptor}`
                          : 'Receptor: uso común'
                      }
                    >
                      <Package size={11} className="text-muted-foreground shrink-0" />
                      <span className="font-medium">{p.nombre}</span>
                      <span
                        className="text-muted-foreground"
                        style={{ fontFamily: "'JetBrains Mono', monospace" }}
                      >
                        ×{p.cantidad} {p.unidad}
                      </span>
                      {receptor && (
                        <span className="text-[10px] text-muted-foreground">
                          → {receptor}
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() =>
                          setProductosIniciales((prev) =>
                            prev.filter((x) => x.productoId !== p.productoId),
                          )
                        }
                        className="ml-0.5 hover:text-destructive"
                        title="Quitar de la lista"
                      >
                        <X size={11} />
                      </button>
                    </span>
                  )
                })}
              </div>
            )}
          </section>

          {/* ── Recorrido en el mapa (estudio previo) ────────────── */}
          <section>
            <h3
              className="text-xs uppercase tracking-widest text-muted-foreground mb-1"
              style={{ fontFamily: "'JetBrains Mono', monospace" }}
            >
              Recorrido en el mapa
            </h3>
            <p className="text-xs text-muted-foreground mb-3">
              Marcá los nodos del recorrido (inicio, intermedios, fin).
              Se persiguen al crear el proyecto y después podés editarlos
              desde la tab "Mapa" del detalle.
            </p>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setPlanificarRutaOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground text-xs font-medium hover:opacity-90 transition-opacity"
                style={{ borderRadius: '0.25rem' }}
              >
                <Route size={12} />
                Planificar ruta
              </button>
              <button
                type="button"
                onClick={() => setMapaNodosOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-border hover:border-foreground/40 text-xs font-medium transition-colors"
                style={{ borderRadius: '0.25rem' }}
              >
                <MapPin size={12} />
                {nodosRecorrido.length === 0
                  ? 'Marcar manual'
                  : 'Editar manual'}
              </button>
              {nodosRecorrido.length > 0 && (
                <span className="text-xs text-muted-foreground">
                  {nodosRecorrido.length}{' '}
                  {nodosRecorrido.length === 1
                    ? 'nodo marcado'
                    : 'nodos marcados'}
                </span>
              )}
            </div>

            {/* Chips de los nodos seleccionados (read-only) */}
            {nodosRecorrido.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {nodosRecorrido.map((n, idx) => {
                  const colorTipo =
                    n.tipo === 'inicio'
                      ? '#22c55e'
                      : n.tipo === 'fin'
                        ? '#ef4444'
                        : '#3b82f6'
                  return (
                    <span
                      key={n.localId}
                      className="inline-flex items-center gap-1.5 px-2 py-1 text-xs bg-muted text-foreground border border-border"
                      style={{ borderRadius: '0.125rem' }}
                    >
                      <span
                        className="w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold text-white shrink-0"
                        style={{ background: colorTipo }}
                      >
                        {idx + 1}
                      </span>
                      <span className="font-medium">{n.nombre}</span>
                      <span
                        className="text-[10px] text-muted-foreground"
                        style={{ fontFamily: "'JetBrains Mono', monospace" }}
                      >
                        ({n.tipo})
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          setNodosRecorrido((prev) =>
                            prev.filter((x) => x.localId !== n.localId),
                          )
                        }
                        className="ml-0.5 hover:text-destructive"
                        title="Quitar de la lista"
                      >
                        <X size={11} />
                      </button>
                    </span>
                  )
                })}
              </div>
            )}
          </section>

          {/* ── Asignación de personal ──────────────────────── */}
          <section>
            <h3
              className="text-xs uppercase tracking-widest text-muted-foreground mb-3"
              style={{ fontFamily: "'JetBrains Mono', monospace" }}
            >
              Asignación de personal
            </h3>
            {rolesDirigidos.length === 0 ? (
              <div className="text-xs text-muted-foreground border border-dashed border-border p-3">
                Seleccioná al menos un rol dirigido para ver los usuarios disponibles.
              </div>
            ) : loadingUsuarios ? (
              <div className="flex items-center justify-center py-6 text-muted-foreground">
                <Loader2 size={16} className="animate-spin mr-2" />
                Buscando usuarios…
              </div>
            ) : usuarios.length === 0 ? (
              <div className="text-xs text-muted-foreground border border-dashed border-border p-3">
                No hay usuarios activos con esos roles en esta bodega. Asigná
                los roles en el módulo Usuarios primero.
              </div>
            ) : (
              <div className="space-y-3">
                {/* Encargado */}
                <Field
                  label="Encargado del proyecto (opcional)"
                  hint="Responsable principal. Aparece en reportes y aprueba productos usados."
                >
                  <button
                    type="button"
                    onClick={() => setEncargadoModalOpen(true)}
                    className="w-full min-h-[44px] bg-background border border-border px-3 text-sm text-left text-foreground hover:border-foreground/30 focus:border-primary/60 focus:outline-none transition-colors flex items-center gap-2"
                    style={{ borderRadius: '0.25rem' }}
                  >
                    {encargadoSeleccionado ? (
                      <>
                        <span
                          className="w-7 h-7 rounded-full bg-foreground/10 flex items-center justify-center text-[10px] font-medium text-foreground shrink-0"
                          style={{ fontFamily: "'JetBrains Mono', monospace" }}
                        >
                          {encargadoSeleccionado.nombre
                            .split(' ')
                            .map((p) => p[0])
                            .slice(0, 2)
                            .join('')
                            .toUpperCase()}
                        </span>
                        <span className="flex-1 font-medium">
                          {encargadoSeleccionado.nombre}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          Cambiar
                        </span>
                      </>
                    ) : (
                      <>
                        <User size={14} className="text-muted-foreground shrink-0" />
                        <span className="flex-1 text-muted-foreground">
                          Elegir encargado…
                        </span>
                        <Plus size={14} className="text-muted-foreground shrink-0" />
                      </>
                    )}
                  </button>
                </Field>

                {/* Técnicos */}
                <Field
                  label="Operadores / Técnicos / Obreros asignados"
                  hint="Podés elegir varios. Los que ya están en otro proyecto activo aparecen deshabilitados."
                >
                  <button
                    type="button"
                    onClick={() => setTecnicosModalOpen(true)}
                    className="w-full min-h-[44px] bg-background border border-border px-3 text-sm text-left text-foreground hover:border-foreground/30 focus:border-primary/60 focus:outline-none transition-colors flex items-center gap-2"
                    style={{ borderRadius: '0.25rem' }}
                  >
                    <Users size={14} className="text-muted-foreground shrink-0" />
                    <span className="flex-1">
                      {tecnicosIds.length === 0 ? (
                        <span className="text-muted-foreground">
                          Elegir técnicos…
                        </span>
                      ) : (
                        <span className="font-medium">
                          {tecnicosIds.length}{' '}
                          {tecnicosIds.length === 1
                            ? 'técnico seleccionado'
                            : 'técnicos seleccionados'}
                        </span>
                      )}
                    </span>
                    <Plus size={14} className="text-muted-foreground shrink-0" />
                  </button>

                  {/* Chips de técnicos seleccionados */}
                  {tecnicosSeleccionados.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {tecnicosSeleccionados.map((t) => (
                        <span
                          key={t.id}
                          className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-muted text-foreground"
                          style={{ borderRadius: '0.125rem' }}
                        >
                          {t.nombre}
                          <button
                            type="button"
                            onClick={() =>
                              setTecnicosIds((prev) =>
                                prev.filter((x) => x !== t.id),
                              )
                            }
                            className="hover:text-destructive"
                          >
                            <X size={11} />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </Field>
              </div>
            )}
          </section>
        </div>
      )}

      {/* ── Modales auxiliares ──────────────────────────── */}
      {productosModalOpen && (
        <SeleccionarProductosInicialesModal
          open={productosModalOpen}
          bodegaId={bodegaIdStr}
          tecnicosAsignados={tecnicosSeleccionados}
          initialItems={productosIniciales}
          onConfirm={setProductosIniciales}
          onClose={() => setProductosModalOpen(false)}
        />
      )}
      {estadoModalOpen && (
        <SeleccionarEstadoModal
          open={estadoModalOpen}
          selectedId={estadoId}
          onSelect={(e) => {
            setEstadoId(e.id)
            setEstadoResumen({ nombre: e.nombre, colorHex: e.colorHex || '#6b7280' })
          }}
          onClose={() => setEstadoModalOpen(false)}
        />
      )}
      {encargadoModalOpen && (
        <SeleccionarUsuarioModal
          open={encargadoModalOpen}
          mode="single"
          usuarios={usuarios}
          loading={loadingUsuarios}
          selectedIds={encargadoId ? [encargadoId] : []}
          title="Elegir encargado"
          description="Responsable principal del proyecto. Aparece en reportes."
          onConfirm={(ids) => setEncargadoId(ids[0] ?? '')}
          onClose={() => setEncargadoModalOpen(false)}
        />
      )}
      {tecnicosModalOpen && (
        <SeleccionarUsuarioModal
          open={tecnicosModalOpen}
          mode="multi"
          usuarios={usuarios}
          loading={loadingUsuarios}
          selectedIds={tecnicosIds}
          // Excluimos al encargado actual (no se puede asignar a sí
          // mismo como técnico además de encargado).
          excludedIds={encargadoId ? [encargadoId] : []}
          title="Elegir técnicos"
          description="Los que ya están en otro proyecto activo se muestran deshabilitados."
          onConfirm={setTecnicosIds}
          onClose={() => setTecnicosModalOpen(false)}
        />
      )}
      {mapaNodosOpen && (
        <MapaNodosEditor
          open={mapaNodosOpen}
          bodegaId={bodegaIdStr}
          initialNodos={nodosRecorrido}
          onConfirm={(nodos) => {
            setNodosRecorrido(nodos)
            setMapaNodosOpen(false)
          }}
          onClose={() => setMapaNodosOpen(false)}
        />
      )}
      {planificarRutaOpen && (
        <PlanificarRutaModal
          open={planificarRutaOpen}
          // En modo crear, el proyecto todavía no existe, así que
          // pasamos `''` como id. El modal lo detecta y entra en
          // modo preview: OSRM calcula la ruta y devuelve los
          // nodos, pero el back NO persiste nada. Después los
          // persistimos nosotros en el loop POST post-crear.
          proyectoId=""
          initialNodos={nodosRecorrido as any}
          onClose={() => setPlanificarRutaOpen(false)}
          onPlanned={(resultado) => {
            // Mapear el shape del back (`PlanificarRutaResultado`)
            // al `NodoEditable` que ya usa el form. Como el back
            // devuelve ids tipo "preview-N", los reescribimos a
            // `localId` únicos y marcamos `esNuevo: true` para
            // que el loop POST los cree.
            const mapeados: NodoEditable[] = resultado.nodos.map((n) => ({
              localId: `plan-${n.orden}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
              latitud: n.latitud,
              longitud: n.longitud,
              nombre: n.nombre,
              tipo: n.tipo,
              // Guardamos el `kmAcumulado` que viene del planificador
              // OSRM (distancia REAL recorrida por la polyline).
              // El back lo respeta al crear el nodo y NO lo
              // recalcula con Haversine, que subestima en rutas
              // con curvas.
              kmAcumulado: n.kmAcumulado,
              esNuevo: true,
            }))
            setNodosRecorrido(mapeados)
            // Si el form tiene un input de `kmATrabajar`, lo
            // actualizamos con la distancia de la ruta. Lo
            // buscamos en el state del form por nombre.
            setKmATrabajar(resultado.kmTotalRuta.toString())
            setPlanificarRutaOpen(false)
          }}
        />
      )}
    </Modal>
  )
}

// ─────────────────────────────────────────────────────────────
//  Field wrapper (label + contenido + hint)
// ─────────────────────────────────────────────────────────────

function Field({
  label,
  required,
  hint,
  children,
}: {
  label: string
  required?: boolean
  hint?: string
  children: React.ReactNode
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-foreground mb-1">
        {label}
        {required && <span className="text-destructive ml-0.5">*</span>}
      </label>
      {children}
      {hint && (
        <p className="mt-1 text-[10px] text-muted-foreground">{hint}</p>
      )}
    </div>
  )
}
