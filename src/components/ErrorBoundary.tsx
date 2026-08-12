/**
 * ErrorBoundary global — atrapa errores de render de cualquier
 * componente hijo y muestra una pantalla de fallback con el error
 * y un botón "Reintentar" que recarga la página.
 *
 * Sin esto, un error de runtime en cualquier componente tira abajo
 * todo el árbol de React y deja la pantalla en negro (sin forma de
 * ver el error ni recuperarse sin abrir la consola).
 */
import { Component, type ErrorInfo, type ReactNode } from 'react'

type Props = { children: ReactNode }
type State = { error: Error | null; info: ErrorInfo | null }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null, info: null }

  static getDerivedStateFromError(error: Error): State {
    return { error, info: null }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // eslint-disable-next-line no-console
    console.error('[ErrorBoundary] error capturado:', error, info)
    this.setState({ error, info })
  }

  private handleReset = (): void => {
    this.setState({ error: null, info: null })
    // Recarga forzada para limpiar cualquier estado corrupto
    window.location.reload()
  }

  render() {
    if (!this.state.error) return this.props.children
    const err = this.state.error
    return (
      <div
        className="min-h-dvh w-screen flex items-center justify-center p-6 bg-background"
        style={{ fontFamily: "'DM Sans', system-ui, sans-serif" }}
      >
        <div className="max-w-2xl w-full bg-card border border-border p-6" style={{ borderRadius: '0.25rem' }}>
          <div className="flex items-center gap-2 mb-3">
            <span
              className="text-[9px] uppercase tracking-widest font-mono text-muted-foreground"
            >
              Error de render
            </span>
            <span className="flex-1 h-px bg-border" />
          </div>
          <h1
            className="text-2xl font-semibold text-foreground mb-2"
            style={{ fontFamily: "'Barlow Condensed', sans-serif" }}
          >
            Algo explotó en la vista
          </h1>
          <p className="text-xs text-muted-foreground mb-4">
            Un componente tiró un error de runtime. La vista se cayó para
            evitar mostrar datos corruptos. Recargá la página; si vuelve
            a pasar, mandame el mensaje de abajo.
          </p>
          <pre className="bg-muted border border-border p-3 text-[11px] text-foreground overflow-auto max-h-64 mb-4 whitespace-pre-wrap break-words" style={{ borderRadius: '0.25rem', fontFamily: "'JetBrains Mono', monospace" }}>
            <strong>{err.name}:</strong> {err.message}
            {this.state.info?.componentStack && (
              <>
                {'\n\n'}ComponentStack:
                {this.state.info.componentStack}
              </>
            )}
          </pre>
          <div className="flex gap-2">
            <button
              onClick={this.handleReset}
              className="inline-flex items-center gap-2 bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
              style={{ borderRadius: '0.25rem' }}
            >
              ↻ Recargar página
            </button>
            <button
              onClick={() => navigator.clipboard?.writeText(`${err.name}: ${err.message}\n\n${this.state.info?.componentStack ?? ''}`)}
              className="inline-flex items-center gap-2 border border-border px-3 py-2 text-xs text-foreground transition-colors hover:border-foreground/30"
              style={{ borderRadius: '0.25rem' }}
            >
              📋 Copiar error
            </button>
          </div>
        </div>
      </div>
    )
  }
}
