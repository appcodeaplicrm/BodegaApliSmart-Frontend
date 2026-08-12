import { useState, useEffect, useMemo } from 'react'
import { Check, Warehouse, MapPin, Plus, Search, ChevronsUpDown } from 'lucide-react'
import {
  Combobox,
  ComboboxButton,
  ComboboxInput,
  ComboboxOption,
  ComboboxOptions,
} from '@headlessui/react'
import { useBodegas } from '../store/bodegas'
import { useBodegaActiva, bodegaActivaStore } from '../store/bodegaActiva'
import { useAuth } from '../store/auth'
import { useIsMobile } from '../hooks/useIsMobile'
import { AgregarBodegaModal } from './AgregarBodegaModal'
import { Modal } from './Modal'

/**
 * Selector de bodega activa del dashboard.
 *
 * UX adaptativa por viewport:
 *  - **PC (≥sm)**: `<select>` nativo estilado con el tema oscuro de
 *    la app. Es más rápido de usar (un solo click), familiar, y
 *    muestra todas las bodegas de un vistazo.
 *  - **Móvil (<sm)**: trigger + Modal bottom-sheet. El dropdown
 *    absoluto se desborda del topbar en mobile, así que el modal
 *    es la única opción que respeta safe-area y es cómodo al touch.
 *
 *  - Lista las bodegas reales del back (bodegasStore)
 *  - Persiste en localStorage (bodegaActivaStore)
 *  - Al cambiar, dispara el evento `onCambio` (lo consume el ToastBridge
 *    para mostrar el toast de éxito).
 *  - El superadmin no ve el botón "+" (no puede crear bodegas)
 */
export function SelectorBodega() {
  const bodegasState = useBodegas()
  const activaId = useBodegaActiva()
  const auth = useAuth()
  const isMobile = useIsMobile()
  const [open, setOpen] = useState(false)
  const [showCrearBodega, setShowCrearBodega] = useState(false)
  const [query, setQuery] = useState('')

  const esSuperadmin =
    auth.status === 'autenticado' && auth.sesion.usuario.rol === 'superadmin'

  // Auto-seleccionar la única bodega si no hay elección o la elección no existe
  const bodegas = bodegasState.status === 'listo' ? bodegasState.bodegas : []
  useEffect(() => {
    if (bodegasState.status !== 'listo') return
    if (bodegas.length === 0) return
    const primeraId = bodegas[0].id
    if (bodegas.length === 1 && activaId !== primeraId) {
      bodegaActivaStore.set(primeraId)
      return
    }
    if (activaId && !bodegas.some((b) => b.id === activaId)) {
      bodegaActivaStore.set(primeraId)
      return
    }
    if (!activaId) {
      bodegaActivaStore.set(primeraId)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bodegasState.status, bodegasState.status === 'listo' ? bodegasState.bodegas : null, activaId])

  // Mientras carga la lista, mostramos "Cargando..."
  if (bodegasState.status === 'idle' || bodegasState.status === 'cargando') {
    return (
      <div
        className="inline-flex items-center gap-2 px-3 py-1.5 border border-border bg-muted"
        style={{ borderRadius: '0.25rem' }}
      >
        <Warehouse size={13} className="text-muted-foreground" />
        <span
          className="text-xs text-muted-foreground"
          style={{ fontFamily: "'JetBrains Mono', monospace" }}
        >
          Cargando bodegas…
        </span>
      </div>
    )
  }

  if (bodegasState.status === 'error') {
    return (
      <div
        className="inline-flex items-center gap-2 px-3 py-1.5 border border-primary/30 bg-primary/5"
        style={{ borderRadius: '0.25rem' }}
      >
        <Warehouse size={13} className="text-primary" />
        <span
          className="text-xs text-primary"
          style={{ fontFamily: "'JetBrains Mono', monospace" }}
        >
          Error al cargar
        </span>
      </div>
    )
  }

  if (bodegas.length === 0) {
    return (
      <div
        className="inline-flex items-center gap-2 px-3 py-1.5 border border-border bg-muted"
        style={{ borderRadius: '0.25rem' }}
      >
        <Warehouse size={13} className="text-muted-foreground" />
        <span
          className="text-xs text-muted-foreground"
          style={{ fontFamily: "'JetBrains Mono', monospace" }}
        >
          Sin bodegas asignadas
        </span>
      </div>
    )
  }

  const activa = bodegas.find((b) => b.id === activaId) ?? bodegas[0]

  return (
    <div className="inline-flex items-center gap-1.5">
      {/* ─── PC: dropdown nativo ─────────────────────── */}
      {!isMobile && (
        <NativeBodegaSelect
          bodegas={bodegas}
          activaId={activaId ?? ''}
          onSelect={(id) => {
            const b = bodegas.find((x) => x.id === id)
            bodegaActivaStore.set(id, b?.nombre ?? null)
          }}
        />
      )}

      {/* ─── Móvil: trigger + modal ──────────────────── */}
      {isMobile && (
        <>
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-haspopup="dialog"
            aria-expanded={open}
            className="inline-flex items-center gap-2 min-h-[44px] max-w-[60vw] sm:max-w-none px-3 py-1.5 border border-border bg-muted hover:border-primary/40 transition-colors"
            style={{ borderRadius: '0.25rem' }}
          >
            <Warehouse size={13} className="text-primary shrink-0" />
            <div className="text-left min-w-0">
              <div
                className="text-[9px] text-muted-foreground uppercase tracking-widest leading-none"
                style={{ fontFamily: "'JetBrains Mono', monospace" }}
              >
                Viendo
              </div>
              <div
                className="text-sm font-semibold text-foreground truncate max-w-[200px]"
                style={{ fontFamily: "'Barlow Condensed', sans-serif" }}
              >
                {activa.nombre}
              </div>
            </div>
            <Plus size={14} className="text-muted-foreground" />
          </button>

          <BodegaListModal
            open={open}
            onClose={() => setOpen(false)}
            bodegas={bodegas}
            activaId={activaId ?? ''}
            onSelect={(id) => {
              const b = bodegas.find((x) => x.id === id)
              bodegaActivaStore.set(id, b?.nombre ?? null)
              setOpen(false)
            }}
          />
        </>
      )}

      {/* ===== Botón "+" para crear una bodega nueva (universal) ===== */}
      {!esSuperadmin && (
        <button
          type="button"
          onClick={() => setShowCrearBodega(true)}
          title="Crear nueva bodega"
          aria-label="Crear nueva bodega"
          className="inline-flex items-center justify-center self-stretch min-w-[44px] min-h-[44px] sm:min-h-0 sm:w-10 border border-border bg-muted text-muted-foreground hover:border-primary/40 hover:text-primary transition-colors"
          style={{ borderRadius: '0.25rem' }}
        >
          <Plus size={15} />
        </button>
      )}

      {showCrearBodega && (
        <AgregarBodegaModal
          onClose={() => setShowCrearBodega(false)}
          onCreated={({ id }) => {
            // Al crear la bodega, la marcamos como activa automáticamente
            // para que el dashboard entre directo a esa bodega.
            bodegaActivaStore.set(id)
          }}
        />
      )}
    </div>
  )
}

/**
 * Dropdown custom para PC, basado en `@headlessui/react` Combobox.
 *
 * Por qué Combobox y no <select> nativo:
 *  - El <select> nativo usa los colores del SO (azul brillante en
 *    la opción seleccionada, fondo gris del SO) y rompe la estética
 *    industrial oscura de StockPro.
 *  - Con Headless UI el render es 100% nuestro: tipografía Barlow
 *    Condensed / DM Sans, color de fondo card #2E2E2E, borde
 *    con acento, etc.
 *  - El Combobox trae búsqueda integrada (input arriba) que aparece
 *    automáticamente cuando hay 4+ bodegas — mismo UX que el modal
 *    móvil pero sin overlay.
 *
 * Mantiene las ventajas del <select> nativo:
 *  - Accesibilidad (teclado, screen reader, foco, typeahead).
 *  - Cierre con Escape, click-outside.
 *  - Scroll automático de la opción activa.
 */
function NativeBodegaSelect({
  bodegas,
  activaId,
  onSelect,
}: {
  bodegas: { id: string; nombre: string; direccion?: string | null }[]
  activaId: string
  onSelect: (id: string) => void
}) {
  const [query, setQuery] = useState('')
  const showSearch = bodegas.length >= 4

  const filtradas = useMemo(() => {
    if (!query.trim()) return bodegas
    const q = query.toLowerCase()
    return bodegas.filter(
      (b) =>
        b.nombre.toLowerCase().includes(q) ||
        (b.direccion ?? '').toLowerCase().includes(q),
    )
  }, [bodegas, query])

  const activa = bodegas.find((b) => b.id === activaId) ?? bodegas[0]

  return (
    <Combobox
      value={activaId}
      onChange={(id: string | null) => {
        if (!id) return
        onSelect(id)
        setQuery('')
      }}
    >
      {/* Wrapper `relative` alrededor de TODO el Combobox (trigger + options).
          Esto ancla el panel al trigger manualmente con `position: absolute;
          top: calc(100% + 6px); right: 0;` y nos saca de Floating UI / Headless
          UI 2.x portal, que estaba eligiendo placements raros ("right" en vez
          de "bottom") cuando el header tiene `flex-wrap` y queda poco espacio
          vertical antes del wrap.

          Trade-off conocido: como el panel es absolute relativo al wrapper,
          queda confinado dentro del contenedor padre (el header). En esta
          vista el header es alto (h-14) y siempre hay espacio debajo, así
          que no se ve cortado. Si en otra vista se rompe, mover a portal. */}
      <div className="relative">
        {showSearch ? (
          <div className="relative" style={{ borderRadius: '0.25rem' }}>
            <Warehouse
              size={13}
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-primary pointer-events-none z-10"
            />
            <ComboboxInput
              type="text"
              aria-label="Cambiar bodega activa"
              displayValue={(id: string) =>
                bodegas.find((b) => b.id === id)?.nombre ?? ''
              }
              onChange={(e) => setQuery(e.target.value)}
              placeholder={activa?.nombre}
              className="
                w-full
                pl-8 pr-12 py-1.5
                bg-muted border border-border
                text-sm font-semibold text-foreground
                hover:border-primary/40
                focus:outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/40
                transition-colors
                min-w-[220px] max-w-[340px]
                text-left cursor-pointer
              "
              style={{
                borderRadius: '0.25rem',
                fontFamily: "'Barlow Condensed', sans-serif",
                letterSpacing: '0.01em',
              }}
            />
            <ComboboxButton
              className="absolute right-0 top-0 h-full w-10 flex items-center justify-center text-muted-foreground"
              aria-label="Abrir lista de bodegas"
            >
              <ChevronsUpDown size={13} />
            </ComboboxButton>
          </div>
        ) : (
          <ComboboxButton
            className="
              relative
              pl-8 pr-10 py-1.5
              bg-muted border border-border
              text-sm font-semibold text-foreground
              hover:border-primary/40
              focus:outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/40
              transition-colors
              min-w-[220px] max-w-[340px]
              text-left
            "
            style={{
              borderRadius: '0.25rem',
              fontFamily: "'Barlow Condensed', sans-serif",
              letterSpacing: '0.01em',
            }}
            aria-label={`Cambiar bodega activa. Bodega actual: ${activa?.nombre ?? ''}`}
          >
            <Warehouse
              size={13}
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-primary pointer-events-none"
            />
            <span className="block truncate">{activa?.nombre ?? 'Elegir bodega'}</span>
            <ChevronsUpDown
              size={13}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
            />
          </ComboboxButton>
        )}

        {/* ─── Options panel ───
            Posicionamiento manual: `top-full` = justo debajo del trigger,
            `right-0` = alineado al borde derecho del trigger (no del viewport).
            Esto se va a desplegar SIEMPRE hacia abajo del botón, sin importar
            el `flex-wrap` del header ni el contexto de posicionamiento. */}
        <ComboboxOptions
          // `modal={false}` evita que Headless UI bloquee el scroll o
          // renderice en portal — queremos que el panel viva dentro del
          // wrapper relative de arriba.
          modal={false}
          className="
            absolute z-50
            top-full right-0 mt-1.5
            w-[var(--button-width)]
            min-w-[260px]
            max-h-80
            overflow-y-auto
            bg-card border border-border
            shadow-2xl
            p-1
            origin-top transition duration-100 ease-out
            data-[closed]:scale-95 data-[closed]:opacity-0
            empty:hidden
          "
          style={{ borderRadius: '0.25rem' }}
        >
          {showSearch && (
            <div className="px-1 pt-1 pb-2 sticky top-0 bg-card z-10">
              <div className="relative">
                <Search
                  size={13}
                  className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
                />
                <input
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Buscar por nombre o dirección…"
                  autoComplete="off"
                  className="w-full pl-8 pr-3 py-1.5 bg-muted border border-border text-xs text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/60 transition-colors"
                  style={{ borderRadius: '0.25rem' }}
                />
              </div>
            </div>
          )}

          {filtradas.length === 0 ? (
            <div className="px-3 py-4 text-center text-xs text-muted-foreground">
              No hay coincidencias para "{query}".
            </div>
          ) : (
            filtradas.map((b) => (
              <ComboboxOption
                key={b.id}
                value={b.id}
                className={({ focus, selected }) => `
                  group flex items-start gap-2.5 px-3 py-2
                  cursor-pointer select-none
                  transition-colors
                  ${focus ? 'bg-muted' : ''}
                  ${selected ? 'bg-secondary/10' : ''}
                `}
                style={{ borderRadius: '0.25rem' }}
              >
                {({ focus, selected }) => (
                  <>
                    <Warehouse
                      size={14}
                      className={`shrink-0 mt-0.5 ${
                        selected ? 'text-secondary' : 'text-muted-foreground'
                      }`}
                    />
                    <div className="flex-1 min-w-0">
                      <div
                        className={`text-sm leading-tight ${
                          selected
                            ? 'text-secondary font-semibold'
                            : 'text-foreground font-medium'
                        }`}
                        style={{
                          fontFamily: "'Barlow Condensed', sans-serif",
                          letterSpacing: '0.01em',
                        }}
                      >
                        {b.nombre}
                      </div>
                      {b.direccion && (
                        <div
                          className="text-[10px] text-muted-foreground flex items-center gap-1 mt-0.5"
                          style={{ fontFamily: "'JetBrains Mono', monospace" }}
                        >
                          <MapPin size={9} />
                          <span className="truncate">{b.direccion}</span>
                        </div>
                      )}
                    </div>
                    {selected && (
                      <Check
                        size={14}
                        className="text-secondary shrink-0 mt-0.5"
                      />
                    )}
                  </>
                )}
              </ComboboxOption>
            ))
          )}
        </ComboboxOptions>
      </div>
    </Combobox>
  )
}

/**
 * Modal con la lista de bodegas. Si hay 4+ muestra un input
 * de búsqueda para filtrar por nombre/dirección.
 */
function BodegaListModal({
  open,
  onClose,
  bodegas,
  activaId,
  onSelect,
}: {
  open: boolean
  onClose: () => void
  bodegas: { id: string; nombre: string; direccion?: string | null }[]
  activaId: string
  onSelect: (id: string) => void
}) {
  const [query, setQuery] = useState('')

  // Reset query al cerrar
  useEffect(() => {
    if (!open) setQuery('')
  }, [open])

  const filtradas = useMemo(() => {
    if (!query.trim()) return bodegas
    const q = query.toLowerCase()
    return bodegas.filter(
      (b) =>
        b.nombre.toLowerCase().includes(q) ||
        (b.direccion ?? '').toLowerCase().includes(q),
    )
  }, [bodegas, query])

  const showSearch = bodegas.length >= 4

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Mis bodegas"
      description={`${bodegas.length} disponibles`}
      icon={<Warehouse size={16} className="text-primary" />}
      size="sm"
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
              placeholder="Buscar por nombre o dirección…"
              autoComplete="off"
              className="w-full pl-9 pr-3 py-2 min-h-[44px] bg-muted border border-border text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/60 transition-colors"
              style={{ borderRadius: '0.25rem' }}
            />
          </div>
        </div>
      )}

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
                  className={`w-full min-h-[56px] flex items-start gap-3 px-4 py-3 text-left transition-colors border-b border-border last:border-b-0 ${
                    isActive
                      ? 'bg-primary/10 text-foreground'
                      : 'text-foreground hover:bg-muted active:bg-muted'
                  }`}
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
                    <div className="text-sm font-semibold break-words">
                      {b.nombre}
                    </div>
                    {b.direccion && (
                      <div
                        className="text-[10px] text-muted-foreground flex items-center gap-1 mt-1"
                        style={{ fontFamily: "'JetBrains Mono', monospace" }}
                      >
                        <MapPin size={9} />
                        <span className="truncate">{b.direccion}</span>
                      </div>
                    )}
                  </div>
                  {isActive && (
                    <Check size={18} className="text-primary shrink-0 mt-1" />
                  )}
                </button>
              </li>
            )
          })
        )}
      </ul>
    </Modal>
  )
}
