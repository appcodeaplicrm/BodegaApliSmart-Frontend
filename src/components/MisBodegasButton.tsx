import { useState, useEffect, useMemo } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Check, Warehouse, Plus, Search } from 'lucide-react'
import {
  useBodegasAccesibles,
  bodegasAccesiblesStore,
  type BodegaAccesible,
} from '../store/contextoBodega'
import { useBodegaActiva, bodegaActivaStore } from '../store/bodegaActiva'
import { permisosPorBodegaStore } from '../store/permisosPorBodega'
import { authStore, useAuth } from '../store/auth'
import { primeraRutaPermitida, permisoDeRuta } from '../lib/routing'
import { Modal } from './Modal'
import { AgregarBodegaModal } from './AgregarBodegaModal'

/**
 * Botón + modal de "Mis bodegas" para la parte baja del Sidebar.
 *
 * Diseño (Sprint 3 Fase 6 — refactor):
 *   - Reemplaza el viejo sub-menú "Mis bodegas" del nav. Ahora vive
 *     en la parte de abajo del Sidebar (sobre el perfil) como un
 *     trigger compacto: muestra el nombre de la bodega activa y un
 *     ícono de warehouse, click → modal.
 *   - El modal lista TODAS las bodegas accesibles del user (las
 *     asignadas vía `UsuarioBodega` si es delegado, o todas las del
 *     tenant si es el propietario), con buscador si hay 4+.
 *   - Click en una bodega → cambio ATÓMICO: descarga permisos de la
 *     nueva bodega ANTES de cambiar la activa, sincroniza la sesión
 *     global y valida la ruta actual. Si la nueva ruta no tiene
 *     permiso, redirige a la primera visible.
 *   - Botón "Crear bodega" al final del modal (solo visible para el
 *     dueño del tenant). Misma regla que antes.
 *
 * Por qué un componente aparte y no reusar el `BodegaListModal` del
 * `SelectorBodega`: este necesita la lógica de cambio atómico que
 * depende del Sidebar (carga de permisos, sync con auth, navigate).
 * Aislarlo acá evita acoplar el Sidebar al `SelectorBodega` y
 * viceversa.
 */
export function MisBodegasButton({ collapsed = false }: { collapsed?: boolean }) {
  const auth = useAuth()
  const bodegasState = useBodegasAccesibles()
  const activaId = useBodegaActiva()
  const navigate = useNavigate()
  const location = useLocation()
  const [open, setOpen] = useState(false)
  const [showCrearBodega, setShowCrearBodega] = useState(false)
  const [query, setQuery] = useState('')
  const [cambiando, setCambiando] = useState(false)

  // Cargar bodegas accesibles si todavía no se cargaron (al primer
  // render el Sidebar ya suele haberlas pedido, pero por las dudas).
  useEffect(() => {
    if (auth.status !== 'autenticado') return
    if (bodegasState.status === 'idle' || bodegasState.status === 'error') {
      void bodegasAccesiblesStore.cargar().catch(() => {
        /* estado 'error' ya seteado */
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth.status])

  // Determinar si el user es el dueño del tenant (puede crear bodegas).
  // NO se infiere del rol: si un delegado conserva `admin` global,
  // eso NO significa que sea propietario. La fuente de verdad es
  // `permisosDeBodega.esPropietario`, pero como acá todavía no
  // tenemos el cache de permisos de la activa, usamos el primer
  // item de `bodegasAccesibles` (solo los del propietario tienen
  // `esPropietario: true` en ese store).
  const esDuenoTenant = useMemo(() => {
    if (bodegasState.status !== 'listo') return false
    return bodegasState.bodegas.some((b) => b.esPropietario === true)
  }, [bodegasState])

  const bodegas = useMemo(
    () => (bodegasState.status === 'listo' ? bodegasState.bodegas : []),
    [bodegasState],
  )

  const activa = useMemo(
    () => bodegas.find((b) => b.id === activaId) ?? null,
    [bodegas, activaId],
  )

  async function handleSelect(id: string) {
    if (cambiando) return
    if (id === activaId) {
      setOpen(false)
      return
    }
    const b = bodegas.find((x) => x.id === id)
    if (!b) return
    setCambiando(true)
    try {
      // Cambio ATÓMICO: descargar permisos ANTES de cambiar la activa.
      const nuevos = await permisosPorBodegaStore.cargar(id, { force: true })
      // Confirmar el cambio de bodega activa.
      bodegaActivaStore.set(id, b.nombre)
      // Sincronizar la sesión global con los permisos de la nueva bodega.
      authStore.actualizarPermisos(
        nuevos.permisos,
        nuevos.modulePermissions,
      )
      // Validar la ruta actual: si ya no tiene permiso, redirigir.
      const requerido = permisoDeRuta(location.pathname)
      const sigueVisible = !requerido || nuevos.permisos.includes(requerido)
      if (!sigueVisible) {
        const destino = primeraRutaPermitida(nuevos.permisos) ?? '/sin-permisos'
        navigate(destino, { replace: true })
      }
      setOpen(false)
    } catch {
      /* el estado 'error' ya se seteó; bodega activa y permisos
         anteriores quedan intactos */
    } finally {
      setCambiando(false)
    }
  }

  // ─── Render del trigger ──────────────────────────────────────
  // Variante "expandida" (sidebar abierto): muestra la bodega
  // activa con un look de "selector activo" + label "Mis bodegas"
  // arriba.
  // Variante "colapsada": solo el ícono con tooltip.
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title={collapsed ? 'Mis bodegas' : undefined}
        aria-haspopup="dialog"
        aria-expanded={open}
        className={
          collapsed
            ? 'w-full flex items-center justify-center py-2 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors'
            : 'w-full flex items-center gap-2.5 px-3 py-2 bg-muted/50 border border-border hover:border-primary/40 hover:bg-muted transition-colors text-left'
        }
        style={{ borderRadius: '0.25rem' }}
      >
        <Warehouse
          size={collapsed ? 16 : 14}
          className="text-primary shrink-0"
        />
        {!collapsed && (
          <>
            <div className="flex-1 min-w-0">
              <div
                className="text-[9px] text-muted-foreground uppercase tracking-widest leading-none"
                style={{ fontFamily: "'JetBrains Mono', monospace" }}
              >
                Viendo
              </div>
              <div
                className="text-sm font-semibold text-foreground truncate mt-0.5"
                style={{
                  fontFamily: "'Barlow Condensed', sans-serif",
                  letterSpacing: '0.01em',
                }}
                title={activa?.nombre ?? 'Sin bodega activa'}
              >
                {activa?.nombre ?? 'Sin bodega activa'}
              </div>
            </div>
            <Plus
              size={14}
              className="text-muted-foreground shrink-0"
              aria-hidden
            />
          </>
        )}
      </button>

      {/* ─── Modal con la lista completa ─── */}
      <MisBodegasModal
        open={open}
        onClose={() => setOpen(false)}
        bodegas={bodegas}
        activaId={activaId}
        onSelect={handleSelect}
        cambiando={cambiando}
        esDuenoTenant={esDuenoTenant}
        onCrear={() => {
          setOpen(false)
          setShowCrearBodega(true)
        }}
      />

      {showCrearBodega && (
        <AgregarBodegaModal
          onClose={() => setShowCrearBodega(false)}
          onCreated={({ id }) => {
            // Al crear la bodega, la marcamos como activa para que el
            // admin entre directo a la nueva bodega.
            bodegaActivaStore.set(id)
            setShowCrearBodega(false)
          }}
        />
      )}
    </>
  )
}

/**
 * Modal con la lista de bodegas. Si hay 4+ muestra un input
 * de búsqueda. La bodega activa se marca con check.
 */
function MisBodegasModal({
  open,
  onClose,
  bodegas,
  activaId,
  onSelect,
  cambiando,
  esDuenoTenant,
  onCrear,
}: {
  open: boolean
  onClose: () => void
  bodegas: BodegaAccesible[]
  activaId: string | null
  onSelect: (id: string) => void
  cambiando: boolean
  esDuenoTenant: boolean
  onCrear: () => void
}) {
  const [query, setQuery] = useState('')

  // Reset query al cerrar
  useEffect(() => {
    if (!open) setQuery('')
  }, [open])

  const filtradas = useMemo(() => {
    if (!query.trim()) return bodegas
    const q = query.toLowerCase()
    return bodegas.filter((b) => b.nombre.toLowerCase().includes(q))
  }, [bodegas, query])

  const showSearch = bodegas.length >= 4

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Mis bodegas"
      description={
        cambiando
          ? 'Cambiando…'
          : `${bodegas.length} ${bodegas.length === 1 ? 'disponible' : 'disponibles'}`
      }
      icon={<Warehouse size={16} className="text-primary" />}
      size="md"
    >
      {showSearch && (
        <div className="px-4 pt-3">
          <div className="relative">
            <Search
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
            />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar bodega por nombre…"
              autoComplete="off"
              className="w-full pl-9 pr-3 py-2 min-h-[44px] bg-muted border border-border text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/60 transition-colors"
              style={{ borderRadius: '0.25rem' }}
            />
          </div>
        </div>
      )}

      {bodegas.length === 0 ? (
        <div className="px-4 py-10 text-center text-sm text-muted-foreground">
          {cambiando
            ? 'Cargando…'
            : 'No tenés bodegas asignadas todavía.'}
        </div>
      ) : (
        <ul className="py-1 max-h-[60dvh] overflow-y-auto">
          {filtradas.length === 0 ? (
            <li className="px-4 py-6 text-center text-sm text-muted-foreground">
              No hay coincidencias para "{query}".
            </li>
          ) : (
            filtradas.map((b) => {
              const isActive = b.id === activaId
              return (
                <li key={b.id}>
                  <button
                    type="button"
                    onClick={() => onSelect(b.id)}
                    disabled={cambiando}
                    className={`w-full min-h-[56px] flex items-start gap-3 px-4 py-3 text-left transition-colors border-b border-border last:border-b-0 ${
                      isActive
                        ? 'bg-primary/10 text-foreground'
                        : 'text-foreground hover:bg-muted active:bg-muted'
                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                  >
                    <Warehouse
                      size={16}
                      className={
                        isActive
                          ? 'text-primary mt-1 shrink-0'
                          : 'text-muted-foreground mt-1 shrink-0'
                      }
                    />
                    <div className="flex-1 min-w-0">
                      <div
                        className="text-sm font-semibold break-words"
                        style={{
                          fontFamily: "'Barlow Condensed', sans-serif",
                        }}
                      >
                        {b.nombre}
                      </div>
                      {b.esPropietario && (
                        <div
                          className="text-[10px] text-muted-foreground mt-0.5"
                          style={{ fontFamily: "'JetBrains Mono', monospace" }}
                        >
                          Propietario del tenant
                        </div>
                      )}
                    </div>
                    {isActive && (
                      <Check
                        size={18}
                        className="text-primary shrink-0 mt-1"
                      />
                    )}
                  </button>
                </li>
              )
            })
          )}
        </ul>
      )}

      {esDuenoTenant && (
        <div className="p-3 border-t border-border">
          <button
            type="button"
            onClick={onCrear}
            disabled={cambiando}
            className="w-full min-h-[44px] inline-flex items-center justify-center gap-2 px-3 py-2 border border-border bg-muted text-foreground hover:border-primary/40 hover:text-primary transition-colors disabled:opacity-50 text-sm"
            style={{ borderRadius: '0.25rem' }}
          >
            <Plus size={14} />
            Crear bodega nueva
          </button>
        </div>
      )}
    </Modal>
  )
}
