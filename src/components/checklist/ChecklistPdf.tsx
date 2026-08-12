/**
 * Punto de entrada del PDF de checklist.
 *
 * Renderiza el PDF en un iframe con `srcdoc` y dispara `window.print()`.
 * Hay 2 templates hardcodeados (en archivos separados) y se eligen
 * según `data.htmlKind`:
 *  - "escaleras" → `checklistPdf.escaleras.ts`
 *  - "epp"       → `checklistPdf.epp.ts`
 *
 * Si por algún motivo el back devuelve un `htmlKind` desconocido,
 * cae a "escaleras" (default).
 *
 * Cada template puede paginarse (1 hoja por cada bloque de N días
 * o N filas, según corresponda). Entre hojas se muestra un overlay
 * con un botón "Continuar" para que el user le dé click entre
 * páginas (evita que Chrome abra varios diálogos de impresión al
 * mismo tiempo).
 */

import type { CkPdfData } from './api'
import { buildAllPagesEscaleras } from './checklistPdf.escaleras'
import { buildAllPagesEpp } from './checklistPdf.epp'

/**
 * Dispara la descarga del PDF. Elige el template según
 * `data.htmlKind` (default "escaleras") y delega la paginación al
 * template correspondiente.
 *
 * El patrón general (común a ambos templates) es:
 *  1) Construir el array de HTMLs (1 por hoja).
 *  2) Para cada HTML, crear un iframe oculto con `srcdoc`, esperar
 *     a que cargue, y llamar `contentWindow.print()`.
 *  3) Mostrar un overlay "Continuar" entre hojas para que el user
 *     le dé click cuando termine la impresión actual.
 */
export function descargarPdf(data: CkPdfData): Promise<void> {
  return new Promise((resolve) => {
    const htmlKind = data.htmlKind ?? 'escaleras'
    const pages =
      htmlKind === 'epp'
        ? buildAllPagesEpp(data)
        : buildAllPagesEscaleras(data)

    if (pages.length === 0) {
      resolve()
      return
    }

    const iframes: HTMLIFrameElement[] = []
    let i = 0

    const cleanupAll = () => {
      // Limpieza diferida después de 60s.
      setTimeout(() => {
        for (const f of iframes) {
          try { document.body.removeChild(f) } catch { /* ignore */ }
        }
      }, 60_000)
      resolve()
    }

    const printNext = () => {
      if (i >= pages.length) {
        cleanupAll()
        return
      }
      const html = pages[i]
      const pageNum = i + 1
      const iframe = document.createElement('iframe')
      iframe.setAttribute('aria-hidden', 'true')
      iframe.style.position = 'fixed'
      iframe.style.right = '0'
      iframe.style.bottom = '0'
      iframe.style.width = '0'
      iframe.style.height = '0'
      iframe.style.border = '0'
      iframe.srcdoc = html
      document.body.appendChild(iframe)
      iframes.push(iframe)

      let printed = false
      const trigger = () => {
        if (printed) return
        printed = true
        try {
          iframe.contentWindow?.focus()
          iframe.contentWindow?.print()
        } catch (e) {
          // eslint-disable-next-line no-console
          console.error('No se pudo disparar print():', e)
        }
        setTimeout(async () => {
          await showContinueOverlay(pageNum, pages.length)
          i++
          printNext()
        }, 200)
      }
      iframe.addEventListener('load', () => {
        // Pequeño delay para que los <img> base64 se terminen de decodificar.
        setTimeout(trigger, 300)
      })
    }
    printNext()
  })
}

/**
 * Muestra un overlay en el medio de la pantalla con el contador
 * "Hoja N de M" + un botón "Continuar" que el user clickea cuando
 * ya guardó la página actual.
 */
function showContinueOverlay(pageNum: number, totalPages: number): Promise<void> {
  return new Promise((resolve) => {
    const overlay = document.createElement('div')
    overlay.style.cssText = [
      'position:fixed',
      'inset:0',
      'z-index:2147483647',
      'background:rgba(0,0,0,0.7)',
      'display:flex',
      'align-items:center',
      'justify-content:center',
      'font-family:system-ui,-apple-system,sans-serif',
    ].join(';')
    overlay.innerHTML = `
      <div style="background:#1f1f1f;color:#fff;padding:24px 28px;border-radius:8px;max-width:380px;text-align:center;box-shadow:0 12px 40px rgba(0,0,0,0.4);">
        <div style="font-size:13px;opacity:0.7;margin-bottom:6px;font-family:'JetBrains Mono',monospace;">Imprimiendo hoja ${pageNum} de ${totalPages}</div>
        <div style="font-size:18px;font-weight:600;margin-bottom:14px;line-height:1.3;">¿Ya guardaste la hoja ${pageNum}?</div>
        <div style="font-size:12px;opacity:0.8;margin-bottom:18px;line-height:1.4;">En el diálogo de impresión elegí "Guardar como PDF" o tu impresora. Cuando termine, hace click en Continuar para la siguiente hoja${pageNum < totalPages ? '' : ' (o Cerrar si no hay más)'}.</div>
        <button id="pdf-continue" type="button" style="background:#e8593f;color:#fff;border:0;padding:11px 22px;font-size:14px;font-weight:600;border-radius:4px;cursor:pointer;font-family:inherit;min-height:44px;min-width:120px;">
          ${pageNum < totalPages ? 'Continuar → hoja ' + (pageNum + 1) : 'Cerrar'}
        </button>
      </div>
    `
    document.body.appendChild(overlay)
    overlay.querySelector('#pdf-continue')?.addEventListener('click', () => {
      try { document.body.removeChild(overlay) } catch { /* ignore */ }
      resolve()
    })
  })
}
