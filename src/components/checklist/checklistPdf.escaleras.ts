/**
 * Template hardcodeado del PDF de "Escaleras de Tijera".
 *
 * La estructura y estilos están basados en el mockup original del
 * admin. Cada bloque de hasta 5 días es 1 hoja A4.
 *
 * Helpers exportados:
 *   - `buildPdfEscalerasPage(data, dias, items, pageNum, totalPages)`
 *       → string con el HTML completo de 1 hoja
 *   - `buildAllPagesEscaleras(data)`
 *       → array de HTMLs (1 por bloque de 5 días)
 *
 * `data.dias` viene del back (`pdfData`). Cada `dia` es una
 * asignación ejecutada ese día con sus items marcados.
 */

import type { CkPdfData, CkPdfDia, CkPdfItem } from './api'

/** Cuántas columnas FECHA caben en una hoja A4 letter. */
const COLS_PER_PAGE = 5

function escapeHtml(s: string | null | undefined): string {
  if (s == null) return ''
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function renderLogo(dataUrl: string | null, fallback: string): string {
  if (dataUrl) {
    return `<img src="${dataUrl}" alt="Logo" style="max-width:140px;max-height:90px;object-fit:contain;display:block;margin:0 auto;" />`
  }
  const parts = fallback.split(' ')
  const head = parts[0] ?? ''
  const tail = parts.slice(1).join(' ')
  return (
    `<div style="background:#e8402a;color:#fff;font-size:20px;font-weight:bold;text-align:center;padding:6px 0;">` +
    `<div>${escapeHtml(head)}</div>` +
    (tail ? `<small style="display:block;font-size:9px;font-weight:normal;">${escapeHtml(tail)}</small>` : '') +
    `</div>`
  )
}

function renderItemRowConDias(
  texto: string,
  oks: (boolean | null)[],
  esOperativa: boolean | null,
): string {
  const dayCells = oks
    .map((ok) => {
      if (ok === true) return '<td style="font-weight:bold;font-size:14px;color:#15803d;">X</td><td></td>'
      if (ok === false) return '<td></td><td style="font-weight:bold;font-size:14px;color:#b91c1c;">X</td>'
      return '<td></td><td></td>'
    })
    .join('')
  return (
    `<tr>` +
    `<td class="item-col">${escapeHtml(texto.toUpperCase())}</td>` +
    dayCells +
    `<td class="si-no-col operativa-si" style="font-weight:bold;font-size:14px;color:#15803d;">${esOperativa === true ? 'X' : ''}</td>` +
    `<td class="si-no-col operativa-no" style="font-weight:bold;font-size:14px;color:#b91c1c;">${esOperativa === false ? 'X' : ''}</td>` +
    `</tr>`
  )
}

function renderHeaderDias(
  dias: CkPdfDia[],
  tecnicoRealizador: string,
): string {
  const fechaHeaders = dias
    .map(
      (d) =>
        `<th colspan="2" style="text-align:center;font-size:9px;padding:2px;">FECHA: ${escapeHtml(d.fecha)}</th>`,
    )
    .join('')
  const siNoHeaders = dias
    .map(() => '<th class="si-no-col">SI</th><th class="si-no-col">NO</th>')
    .join('')
  return (
    `<tr>` +
    `<th rowspan="2" style="text-align:left;font-size:10px;vertical-align:top;">` +
    `<div style="font-weight:bold;">REALIZADO POR:</div>` +
    `<div style="font-weight:normal;margin:0 0 6px 0;">${escapeHtml(tecnicoRealizador || '—')}</div>` +
    `<hr style="margin:4px 0;border:0;border-top:1px solid #000;" />` +
    `<div style="font-weight:bold;">ITEM</div>` +
    `</th>` +
    fechaHeaders +
    `<th colspan="2" class="header-operativa">ESCALERA<br>OPERATIVA</th>` +
    `</tr>` +
    `<tr>` +
    siNoHeaders +
    `<th class="si-no-col operativa-si">SI</th>` +
    `<th class="si-no-col operativa-no">${dias.some((d) => d.objetoOperativo === false) ? 'NO' : ''}</th>` +
    `</tr>`
  )
}

export function buildPdfEscalerasPage(args: {
  data: CkPdfData
  dias: CkPdfDia[]
  items: CkPdfItem[]
  pageNum: number
  totalPages: number
}): string {
  const { data, dias, items, pageNum, totalPages } = args

  const itemsRows = items
    .map((it) => {
      const oks: (boolean | null)[] = dias.map((d) => {
        const found = d.items.find((x) => x.id === it.id)
        return found?.ok ?? null
      })
      return renderItemRowConDias(it.texto, oks, data.objetoOperativo)
    })
    .join('')

  const obsLines: string[] = []
  for (const d of dias) {
    for (const it of d.items) {
      if (it.ok === false && it.observacion) {
        const txt = it.observacion.length > 70 ? it.observacion.slice(0, 68) + '…' : it.observacion
        obsLines.push(`<div style="padding:0 6px;font-size:9px;line-height:20px;"><strong>[${escapeHtml(d.fecha)}] ${escapeHtml((it.texto || '').slice(0, 25))}:</strong> ${escapeHtml(txt)}</div>`)
      }
    }
    if (d.observacion) {
      obsLines.push(`<div style="padding:0 6px;font-size:9px;line-height:20px;"><em>[${escapeHtml(d.fecha)}] ${escapeHtml(d.observacion)}</em></div>`)
    }
  }
  const obsMax = 13
  const trimmed = obsLines.slice(0, obsMax)
  const emptyObsLines = Array.from({ length: Math.max(0, obsMax - trimmed.length) })
    .map(() => '<div></div>')
    .join('')

  const objetoFoto = data.objetoFotoDataUrl
    ? `<img class="partes-img" src="${data.objetoFotoDataUrl}" alt="Foto del objeto" />`
    : `<div style="text-align:center;color:#888;font-size:10px;padding:20px 0;">[Foto del objeto: pendiente de subir]</div>`

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>${escapeHtml(data.empresaFormato || 'Formato de Inspección')}</title>
<style>
  @page {
    size: letter portrait;
    margin: 10mm;
  }
  * { box-sizing: border-box; }
  body {
    font-family: Arial, Helvetica, sans-serif;
    font-size: 11px;
    color: #000;
    margin: 0;
    padding: 10px;
  }
  table {
    border-collapse: collapse;
    width: 100%;
  }
  td, th {
    border: 1.5px solid #000;
    padding: 3px 5px;
    vertical-align: middle;
  }
  .header-table td { text-align: center; font-weight: bold; }
  .logo-cell { width: 160px; padding: 4px; }
  .title-cell { font-size: 13px; }
  .subtitle-cell { font-size: 11px; }
  .mes-anio-cell { width: 110px; text-align: left; font-size: 11px; }
  .datos-table td { text-align: left; font-weight: bold; }
  .codigo-red { color: #e8402a; }
  .main-table th, .main-table td {
    text-align: center;
    font-size: 10px;
  }
  .item-col {
    width: 130px;
    text-align: left !important;
    font-weight: bold;
  }
  .si-no-col { width: 22px; }
  .operativa-si { background: #ffe14d; }
  .operativa-no { background: #f28080; }
  .header-operativa { background: #a9d6e5; font-weight: bold; }
  .tecnico-row td { font-size: 10px; }
  .footer-wrap { display: flex; gap: 8px; margin-top: 6px; }
  .observaciones-box { flex: 1; border: 1.5px solid #000; }
  .observaciones-title {
    font-weight: bold;
    padding: 4px 6px;
    border-bottom: 1.5px solid #000;
  }
  .observaciones-lines div {
    border-bottom: 1px solid #444;
    height: 20px;
  }
  .observaciones-lines div:last-child { border-bottom: none; }
  .partes-box { flex: 1.1; border: 1.5px solid #000; padding: 8px; }
  .partes-title {
    text-align: center;
    font-weight: bold;
    font-size: 14px;
    color: #12406e;
  }
  .partes-subtitle {
    text-align: center;
    font-weight: bold;
    font-size: 11px;
    color: #12406e;
    margin-bottom: 6px;
  }
  .partes-img {
    display: block;
    margin: 0 auto;
    max-width: 100%;
    max-height: 340px;
  }
  .page-footer {
    margin-top: 6px;
    text-align: center;
    font-size: 9px;
    color: #555;
  }
  @media print {
    body { padding: 0; }
    .page-footer { display: none; }
  }
</style>
</head>
<body>
  <table class="header-table">
    <tr>
      <td class="logo-cell" rowspan="3">${renderLogo(data.empresaLogoDataUrl, data.empresaNombre || 'VUELA')}</td>
      <td class="title-cell" colspan="2">${escapeHtml(data.empresaNombre || '—')}</td>
      <td class="mes-anio-cell" rowspan="3">Hoja ${pageNum} de ${totalPages}<br>${dias.length} día(s)</td>
    </tr>
    <tr>
      <td class="subtitle-cell" colspan="2">${escapeHtml(data.empresaDepartamento || 'SISTEMA DE GESTIÓN DE SEGURIDAD Y SALUD OCUPACIONAL')}</td>
    </tr>
    <tr>
      <td class="subtitle-cell" colspan="2">${escapeHtml(data.empresaFormato || 'FORMATO DE INSPECCIÓN')}</td>
    </tr>
  </table>
  <div style="height:6px;"></div>
  <table class="datos-table">
    <tr>
      <td style="width:22%;">${escapeHtml(data.objetoNombre || 'OBJETO')}</td>
      <td style="width:8%;">TIPO</td>
      ${['III', 'I', 'IA', 'IAA']
        .map(
          (t) => `<td style="width:8%; text-align:center;${data.objetoTipos.includes(t) ? 'background:#ffe14d;font-weight:bold;' : ''}">${
            data.objetoTipos.includes(t) ? '✓ ' + t : ''
          }</td>`,
        )
        .join('')}
      <td style="width:26%;">CÓDIGO: <span class="codigo-red">${escapeHtml(data.objetoCodigo || '')}</span></td>
    </tr>
    <tr>
      <td>LONGITUD: ${escapeHtml(data.objetoLongitud || '')}</td>
      <td colspan="6">CAPACIDAD DE CARGA: ${escapeHtml(data.objetoCapacidad || '')}</td>
    </tr>
  </table>
  <div style="height:6px;"></div>
  <table class="main-table">
    ${renderHeaderDias(dias, data.tecnico)}
    ${itemsRows}
  </table>
  <div class="footer-wrap">
    <div class="observaciones-box">
      <div class="observaciones-title">OBSERVACIONES:</div>
      <div class="observaciones-lines">
        ${trimmed.join('')}
        ${emptyObsLines}
      </div>
    </div>
    <div class="partes-box">
      <div class="partes-title">${escapeHtml((data.objetoNombre || 'PARTES DEL OBJETO').toUpperCase())}</div>
      <div class="partes-subtitle">${escapeHtml((data.empresaDepartamento || '').toUpperCase())}</div>
      ${objetoFoto}
    </div>
  </div>
  <div class="page-footer">Hoja ${pageNum} de ${totalPages} — ${escapeHtml(data.plantillaNombre)} — ${escapeHtml(data.tecnico)}</div>
</body>
</html>`
}

export function buildAllPagesEscaleras(data: CkPdfData): string[] {
  const dias = data.dias ?? []
  const diasEfectivos = dias.length > 0
    ? dias
    : [
        {
          fecha: '',
          asignacionId: data.id,
          items: data.items,
          resultado: data.resultado,
          observacion: data.observacion ?? '',
          objetoOperativo: data.objetoOperativo,
        } satisfies CkPdfDia,
      ]
  const items = diasEfectivos[0]?.items ?? data.items ?? []
  const totalPages = Math.max(1, Math.ceil(diasEfectivos.length / COLS_PER_PAGE))
  const pages: string[] = []
  for (let p = 0; p < totalPages; p++) {
    const desde = p * COLS_PER_PAGE
    const hasta = desde + COLS_PER_PAGE
    const diasPagina = diasEfectivos.slice(desde, hasta)
    pages.push(
      buildPdfEscalerasPage({
        data,
        dias: diasPagina,
        items,
        pageNum: p + 1,
        totalPages,
      }),
    )
  }
  return pages
}
