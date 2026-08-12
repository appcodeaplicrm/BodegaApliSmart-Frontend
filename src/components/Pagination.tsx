import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react'

type PaginationProps = {
  /** Página actual (1-indexed) */
  page: number
  /** Total de páginas */
  totalPages: number
  /** Total de registros (para el "Mostrando X-Y de Z") */
  total: number
  /** Tamaño de página actual (para mostrar el rango correcto) */
  pageSize: number
  /** Se llama cuando el user cambia de página (nueva página 1-indexed) */
  onChange: (page: number) => void
  /** Se llama cuando el user cambia el pageSize */
  onPageSizeChange?: (pageSize: number) => void
  /** Opciones del selector de pageSize. Default: [10, 20, 50, 100] */
  pageSizeOptions?: number[]
  /** Si es true, oculta el selector de pageSize */
  hidePageSize?: boolean
  /** Si es true, muestra el "Mostrando X-Y de Z" del propio componente. Default: true */
  showRange?: boolean
  /** Si es true, oculta el border-top y el fondo (para embeber dentro de otros containers). Default: false */
  embedded?: boolean
  /** Disabled (ej: mientras carga) */
  disabled?: boolean
}

/**
 * Paginación estándar para todas las vistas con tablas.
 *
 *  - "Mostrando 1-20 de 132" a la izquierda
 *  - Botones ‹‹ ‹ 1 2 3 ... 7 › ›› al centro
 *  - Selector de pageSize a la derecha (opcional)
 *
 * El componente es controlado: el padre maneja `page` y `pageSize`
 * en su store y le pasa los handlers.
 */
export function Pagination({
  page,
  totalPages,
  total,
  pageSize,
  onChange,
  onPageSizeChange,
  pageSizeOptions = [10, 20, 50, 100],
  hidePageSize = false,
  showRange = true,
  embedded = false,
  disabled = false,
}: PaginationProps) {
  if (total === 0) return null

  const first = (page - 1) * pageSize + 1
  const last = Math.min(page * pageSize, total)
  const safeTotalPages = Math.max(1, totalPages)

  // Construimos la lista de páginas a mostrar. Siempre: 1, …, actual-1,
  // actual, actual+1, …, total. Si todo es chico, mostramos todas.
  const pageNumbers = buildPageList(page, safeTotalPages)

  const go = (p: number) => {
    if (disabled) return
    const next = Math.max(1, Math.min(safeTotalPages, p))
    if (next !== page) onChange(next)
  }

  return (
    <div
      className={
        embedded
          ? 'flex flex-col sm:flex-row sm:flex-wrap sm:items-center sm:justify-between gap-2 sm:gap-3 py-2'
          : 'flex flex-col sm:flex-row sm:flex-wrap sm:items-center sm:justify-between gap-2 sm:gap-3 px-3 sm:px-4 py-3 border-t border-border bg-muted/20'
      }
    >
      {/* Centro: botones de página
          En mobile esta fila va PRIMERO y ocupa full-width para que
          los ‹ ‹ 1 2 3 … N › › tengan todo el espacio y no se
          monten con el range ni el pageSize. Los ‹‹ y ›› (saltar a
          primera/última) solo aparecen en sm+ para no saturar mobile. */}
      <div
        className="flex items-center gap-1 justify-center sm:justify-start order-1"
        role="navigation"
        aria-label="Paginación"
      >
        <div className="hidden sm:block">
          <PageBtn
            disabled={disabled || page <= 1}
            onClick={() => go(1)}
            aria-label="Primera página"
          >
            <ChevronsLeft size={13} />
          </PageBtn>
        </div>
        <PageBtn
          disabled={disabled || page <= 1}
          onClick={() => go(page - 1)}
          aria-label="Página anterior"
        >
          <ChevronLeft size={13} />
        </PageBtn>

        {pageNumbers.map((p, i) =>
          p === '…' ? (
            <span
              key={`g${i}`}
              className="px-2 text-muted-foreground text-xs"
              style={{ fontFamily: "'JetBrains Mono', monospace" }}
            >
              …
            </span>
          ) : (
            <button
              key={p}
              onClick={() => go(p)}
              disabled={disabled}
              aria-current={p === page ? 'page' : undefined}
              aria-label={`Página ${p}`}
              className={`min-w-[36px] min-h-[36px] sm:min-w-[28px] sm:min-h-[28px] px-2 text-xs border transition-colors ${
                p === page
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-card text-foreground border-border hover:border-foreground/40'
              }`}
              style={{ borderRadius: '0.15rem', fontFamily: "'JetBrains Mono', monospace" }}
            >
              {p}
            </button>
          ),
        )}

        <PageBtn
          disabled={disabled || page >= safeTotalPages}
          onClick={() => go(page + 1)}
          aria-label="Página siguiente"
        >
          <ChevronRight size={13} />
        </PageBtn>
        <div className="hidden sm:block">
          <PageBtn
            disabled={disabled || page >= safeTotalPages}
            onClick={() => go(safeTotalPages)}
            aria-label="Última página"
          >
            <ChevronsRight size={13} />
          </PageBtn>
        </div>
      </div>

      {/* Fila 2 en mobile: range (izq) + pageSize (der).
          En desktop vuelven a la misma fila que los botones (sm:order-*). */}
      <div className="flex items-center justify-between gap-2 order-2 w-full sm:w-auto sm:order-2">
        {showRange && (
          <div
            className="text-[11px] text-muted-foreground tracking-wider uppercase truncate"
            style={{ fontFamily: "'JetBrains Mono', monospace" }}
          >
            {first}-{last} de {total}
          </div>
        )}

        {/* Derecha: pageSize */}
        {!hidePageSize && onPageSizeChange && (
          <div className="flex items-center gap-2 ml-auto">
            <label
              htmlFor="pageSize"
              className="text-[10px] text-muted-foreground tracking-widest uppercase"
              style={{ fontFamily: "'JetBrains Mono', monospace" }}
            >
              Por pág.
            </label>
            <select
              id="pageSize"
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              disabled={disabled}
              className="bg-muted border border-border text-foreground text-xs px-2 min-h-[36px] sm:min-h-[32px] outline-none focus:border-primary/60 disabled:opacity-50"
              style={{ borderRadius: '0.15rem', fontFamily: "'JetBrains Mono', monospace" }}
            >
              {pageSizeOptions.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>
    </div>
  )
}

function PageBtn({
  children,
  disabled,
  onClick,
  'aria-label': ariaLabel,
}: {
  children: React.ReactNode
  disabled?: boolean
  onClick: () => void
  'aria-label'?: string
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      className="min-w-[36px] min-h-[36px] sm:min-w-[28px] sm:min-h-[28px] inline-flex items-center justify-center text-muted-foreground border border-border bg-card hover:border-foreground/40 hover:text-foreground transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
      style={{ borderRadius: '0.15rem' }}
    >
      {children}
    </button>
  )
}

/**
 * Genera la lista de páginas a mostrar en la barra.
 * - Si hay 7 o menos, muestra todas
 * - Si no, muestra: 1, …, (actual-1), actual, (actual+1), …, total
 */
function buildPageList(current: number, total: number): (number | '…')[] {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1)
  }
  const pages: (number | '…')[] = [1]
  if (current > 3) pages.push('…')
  for (let p = Math.max(2, current - 1); p <= Math.min(total - 1, current + 1); p++) {
    pages.push(p)
  }
  if (current < total - 2) pages.push('…')
  pages.push(total)
  return pages
}
