/**
 * Template hardcodeado del PDF de "Inspección Semanal de EPP".
 *
 * Estructura:
 *  - 1 fila por FECHA (cada `dia` del CkPdfData es una fila).
 *  - Columnas: BUEN ESTADO / MAL ESTADO / NO PRESENTA, una terna
 *    por cada EPP de la plantilla (los `items` del CkPdfData son
 *    los EPPs: CASCO, BARBIQUEJO, GAFAS, GUANTES, etc.).
 *  - Última columna: RESULTADO GENERAL (colapsado de
 *    `data.objetoOperativo` por día: si todos los items del día
 *    están en BUEN ESTADO → SI, si alguno está MAL → NO, si todos
 *    NO PRESENTA → null).
 *  - Última columna: OBSERVACIONES (la `observacion` del día).
 *
 * Convención de `ok` por (item, dia):
 *   - `true`  = BUEN ESTADO
 *   - `false` = MAL ESTADO
 *   - `null`  = NO PRESENTA
 *
 * Página: A4 letter portrait, N filas (1 por día, hasta ~26 en
 * el original).
 */

import type { CkPdfData, CkPdfDia, CkPdfItem } from './api'

/** Cuántas filas de FECHA caben en una hoja A4 letter. */
const ROWS_PER_PAGE = 14

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
    return `<img src="${dataUrl}" alt="Logo" style="max-width:200px;max-height:60px;object-fit:contain;display:block;margin:0 auto;" />`
  }
  const parts = fallback.split(' ')
  const head = parts[0] ?? ''
  const tail = parts.slice(1).join(' ')
  return (
    `<div style="color:#e84c1e;font-size:26px;font-weight:800;letter-spacing:1px;text-align:center;">` +
    `<div>${escapeHtml(head)}</div>` +
    (tail ? `<small style="display:block;font-size:8px;color:#333;letter-spacing:3px;font-weight:400;">${escapeHtml(tail)}</small>` : '') +
    `</div>`
  )
}

/**
 * Devuelve el "resultado general" de un día: si TODOS los items
 * del día están en BUEN ESTADO (true) → "SI". Si ALGUNO está en
 * MAL ESTADO (false) → "NO". Si todo es null (NO PRESENTA) → null.
 */
function resultadoGeneralDelDia(items: { ok: boolean | null }[]): boolean | null {
  let anyOk = false
  let anyMal = false
  for (const it of items) {
    if (it.ok === true) anyOk = true
    if (it.ok === false) anyMal = true
  }
  if (anyMal) return false
  if (anyOk) return true
  return null
}

function renderFila(items: CkPdfItem[], dia: CkPdfDia): string {
  // Para cada EPP, renderizamos 3 celdas (BUEN/MAL/NO PRESENTA).
  const eppCells = items
    .map((it) => {
      const ej = dia.items.find((x) => x.id === it.id)
      const ok = ej?.ok ?? null
      const buen = ok === true
        ? '<td style="font-weight:bold;font-size:14px;color:#15803d;">X</td>'
        : '<td></td>'
      const mal = ok === false
        ? '<td style="font-weight:bold;font-size:14px;color:#b91c1c;">X</td>'
        : '<td></td>'
      const noPres = ok === null
        ? '<td style="font-weight:bold;font-size:14px;color:#555;">X</td>'
        : '<td></td>'
      return buen + mal + noPres
    })
    .join('')

  const resultado = resultadoGeneralDelDia(dia.items)
  const resultadoCell = resultado === true
    ? '<td style="font-weight:bold;color:#15803d;">SI</td>'
    : resultado === false
      ? '<td style="font-weight:bold;color:#b91c1c;">NO</td>'
      : '<td></td>'

  const obsHtml = (dia.observacion ?? '').trim() || ''
  return (
    `<tr>` +
    `<td class="fecha-cell" style="text-align:center;font-family:'Courier New',monospace;font-size:12px;">${escapeHtml(dia.fecha)}</td>` +
    eppCells +
    resultadoCell +
    `<td class="obs-cell" style="text-align:left;font-size:9px;padding:4px;">${escapeHtml(obsHtml)}</td>` +
    `</tr>`
  )
}

export function buildPdfEppPage(args: {
  data: CkPdfData
  dias: CkPdfDia[]
  items: CkPdfItem[]
  pageNum: number
  totalPages: number
}): string {
  const { data, dias, items, pageNum, totalPages } = args

  // Header de los EPPs: una columna por cada estado de cada EPP.
  const eppHeaderCells = items
    .map(
      (it) =>
        `<th colspan="3" class="col-group-header">${escapeHtml(it.texto.toUpperCase())}</th>`,
    )
    .join('')
  const eppSubHeaderCells = items
    .map(
      () =>
        '<th>BUEN ESTADO</th><th>MAL ESTADO</th><th>NO PRESENTA</th>',
    )
    .join('')

  const filas = dias.map((d) => renderFila(items, d)).join('')
  // Rellenar filas vacías hasta ROWS_PER_PAGE.
  const emptyRows = Array.from({
    length: Math.max(0, ROWS_PER_PAGE - dias.length),
  })
    .map(
      () =>
        `<tr class="empty-row">` +
        `<td class="fecha-cell" style="text-align:center;color:#aaa;font-size:10px;">__ /__ /__</td>` +
        items.map(() => '<td></td><td></td><td></td>').join('') +
        '<td></td>' +
        '<td></td>' +
        `</tr>`,
    )
    .join('')

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>${escapeHtml(data.empresaFormato || 'Formato de Inspección Semanal de EPP')}</title>
<style>
  @page {
    size: letter landscape;
    margin: 8mm;
  }
  * { box-sizing: border-box; }
  body {
    font-family: Arial, Helvetica, sans-serif;
    font-size: 11px;
    margin: 20px;
    color: #000;
  }
  table { border-collapse: collapse; width: 100%; }
  td, th {
    border: 1px solid #000;
    text-align: center;
    vertical-align: middle;
    padding: 3px 4px;
  }
  .header-table td { padding: 4px 6px; text-align: left; }
  .logo-cell { width: 220px; text-align: center; vertical-align: middle; }
  .titulo-principal { font-weight: bold; font-size: 12px; }
  .titulo-secundario { text-align: center; font-weight: bold; font-size: 12px; }
  .mes-cell { width: 140px; font-weight: bold; }
  .codigo-epp { color: #c0392b; font-weight: bold; }
  .datos-colaborador td {
    text-align: left;
    font-weight: bold;
    padding: 5px 6px;
  }
  .main-table th { background-color: #f2f2f2; font-weight: bold; font-size: 10px; }
  .main-table td.fecha-cell { width: 90px; height: 22px; }
  .col-group-header { background-color: #e8e8e8; }
  .resultado-col { width: 110px; }
  .obs-col { width: 130px; }
  .empty-row td { height: 22px; }
  .page-footer {
    margin-top: 6px;
    text-align: center;
    font-size: 9px;
    color: #555;
  }
  @media print {
    body { margin: 0; }
    .page-footer { display: none; }
  }
</style>
</head>
<body>
  <table class="header-table">
    <tr>
      <td class="logo-cell" rowspan="3">${renderLogo(data.empresaLogoDataUrl, data.empresaNombre || 'VUELA')}</td>
      <td class="titulo-principal">FORMATO DE INSPECCIÓN SEMANAL DE EPP DE USO DIARIO</td>
      <td class="mes-cell">MES:</td>
    </tr>
    <tr>
      <td class="titulo-secundario">${escapeHtml(data.empresaNombre || '—')}</td>
      <td class="mes-cell">ANEXO 1</td>
    </tr>
    <tr>
      <td class="titulo-secundario">${escapeHtml(data.empresaDepartamento || 'SISTEMA DE GESTIÓN DE SEGURIDAD Y SALUD OCUPACIONAL')}</td>
      <td class="mes-cell">AÑO: 2026</td>
    </tr>
  </table>
  <table class="datos-colaborador">
    <tr>
      <td style="width:22%;">Colaborador: <strong>${escapeHtml(data.tecnico || '—')}</strong></td>
      <td style="width:26%;">Cédula</td>
      <td style="width:18%;">Cargo : Técnico</td>
      <td style="width:16%;">Área: Técnica</td>
      <td style="width:18%;">Código EPP: <span class="codigo-epp">${escapeHtml(data.objetoCodigo || '')}</span></td>
    </tr>
  </table>
  <table class="main-table">
    <thead>
      <tr>
        <th rowspan="2" style="width:90px;">FECHA</th>
        ${eppHeaderCells}
        <th rowspan="2" class="resultado-col">RESULTADO GENERAL</th>
        <th rowspan="2" class="obs-col">OBSERVACIONES</th>
      </tr>
      <tr>
        ${eppSubHeaderCells}
      </tr>
    </thead>
    <tbody>
      ${filas}
      ${emptyRows}
    </tbody>
  </table>
  <div class="page-footer">Hoja ${pageNum} de ${totalPages} — ${escapeHtml(data.plantillaNombre)} — ${escapeHtml(data.tecnico)}</div>
</body>
</html>`
}

export function buildAllPagesEpp(data: CkPdfData): string[] {
  const dias = data.dias ?? []
  const items = dias[0]?.items ?? data.items ?? []
  if (items.length === 0) {
    // Sin EPPs definidos, no hay nada que imprimir.
    return []
  }
  const totalPages = Math.max(1, Math.ceil(dias.length / ROWS_PER_PAGE))
  const pages: string[] = []
  for (let p = 0; p < totalPages; p++) {
    const desde = p * ROWS_PER_PAGE
    const hasta = desde + ROWS_PER_PAGE
    const diasPagina = dias.slice(desde, hasta)
    pages.push(
      buildPdfEppPage({
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
