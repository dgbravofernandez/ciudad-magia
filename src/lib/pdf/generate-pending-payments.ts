import { PDFDocument, StandardFonts, rgb, PDFPage, PDFFont } from 'pdf-lib'

// ─── Helpers (mismo estilo que generate-receipt) ──────────────────────────────

function hexToRgb(hex: string) {
  try {
    const h = hex.replace('#', '')
    return rgb(
      parseInt(h.slice(0, 2), 16) / 255,
      parseInt(h.slice(2, 4), 16) / 255,
      parseInt(h.slice(4, 6), 16) / 255,
    )
  } catch {
    return rgb(0.07, 0.20, 0.53)
  }
}

function luminance(hex: string): number {
  try {
    const h = hex.replace('#', '')
    const r = parseInt(h.slice(0, 2), 16) / 255
    const g = parseInt(h.slice(2, 4), 16) / 255
    const b = parseInt(h.slice(4, 6), 16) / 255
    return 0.299 * r + 0.587 * g + 0.114 * b
  } catch {
    return 0.2
  }
}

async function tryEmbedLogo(doc: PDFDocument, url: string) {
  try {
    const resp = await fetch(url, { signal: AbortSignal.timeout(5000) })
    if (!resp.ok) return null
    const buf = new Uint8Array(await resp.arrayBuffer())
    if (buf[0] === 0x89 && buf[1] === 0x50) return await doc.embedPng(buf)
    if (buf[0] === 0xFF && buf[1] === 0xD8) return await doc.embedJpg(buf)
    return null
  } catch {
    return null
  }
}

function eur(n: number) {
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(n)
}

function dateESShort(s: string | null) {
  if (!s) return '—'
  try {
    return new Intl.DateTimeFormat('es-ES', { day: '2-digit', month: '2-digit', year: '2-digit' }).format(new Date(s))
  } catch { return s }
}

// Trunca el texto si excede el ancho permitido. Devuelve el texto modificado.
function truncate(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text
  return text.slice(0, maxChars - 1) + '…'
}

// ─── Params ───────────────────────────────────────────────────────────────────

export interface PendingPaymentRow {
  player_name: string
  team_name: string
  tutor_email: string | null
  tutor_phone: string | null
  pending_amount: number
  last_payment_date: string | null
  admin_comment: string | null
  is_special_case: boolean
}

export interface PendingPaymentsPDFParams {
  rows: PendingPaymentRow[]
  season: string
  filters: {
    teams: string[]      // nombres de equipos seleccionados (vacío = todos)
    concepts: string[]   // conceptos seleccionados (vacío = todos)
  }
  clubName: string
  primaryColor?: string
  logoUrl?: string | null
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export async function generatePendingPaymentsPDF(params: PendingPaymentsPDFParams): Promise<Buffer> {
  const CLUB_NAME = params.clubName || 'Escuela de Fútbol Ciudad de Getafe'
  const primaryHex = params.primaryColor ?? '#f2eb07'
  const COLOR_BRAND = hexToRgb(primaryHex)
  const brandIsLight = luminance(primaryHex) > 0.6

  // Paleta
  const COLOR_INK = rgb(0.11, 0.11, 0.13)
  const COLOR_DARK = rgb(0.13, 0.13, 0.15)
  const COLOR_MID = rgb(0.42, 0.45, 0.50)
  const COLOR_LIGHT = rgb(0.88, 0.88, 0.90)
  const COLOR_WHITE = rgb(1, 1, 1)
  const COLOR_RED = rgb(0.75, 0.10, 0.10)
  const COLOR_AMBER_BG = rgb(0.99, 0.95, 0.85)

  // Bandas: si marca clara → fondo negro + texto marca
  const COLOR_BAND_BG = brandIsLight ? COLOR_INK : COLOR_BRAND
  const COLOR_BAND_TEXT = brandIsLight ? COLOR_BRAND : COLOR_WHITE
  const COLOR_ACCENT = brandIsLight ? COLOR_INK : COLOR_BRAND

  const doc = await PDFDocument.create()
  const font = await doc.embedFont(StandardFonts.Helvetica)
  const bold = await doc.embedFont(StandardFonts.HelveticaBold)
  const italic = await doc.embedFont(StandardFonts.HelveticaOblique)

  const logoImg = params.logoUrl ? await tryEmbedLogo(doc, params.logoUrl) : null

  const W = 595
  const H = 842
  const ML = 36
  const MR = 36
  const CW = W - ML - MR

  // ── Anchos de columnas (suman CW=523) ───────────────────────────────────────
  const COL_JUGADOR = 145
  const COL_EQUIPO = 80
  const COL_DEUDA = 60
  const COL_CONTACTO = 140
  const COL_ULTIMO = 50
  const COL_NOTA = CW - COL_JUGADOR - COL_EQUIPO - COL_DEUDA - COL_CONTACTO - COL_ULTIMO

  // ── Helper: dibujar cabecera de página ──────────────────────────────────────
  function drawPageHeader(page: PDFPage, pageNum: number, totalPages: number) {
    // Banda cabecera
    const HEAD_H = 56
    page.drawRectangle({ x: 0, y: H - HEAD_H, width: W, height: HEAD_H, color: COLOR_BAND_BG })

    if (logoImg) {
      const lh = 38
      const lw = logoImg.width * (lh / logoImg.height)
      page.drawImage(logoImg, { x: ML, y: H - HEAD_H + (HEAD_H - lh) / 2, width: lw, height: lh })
    }

    page.drawText('PAGOS PENDIENTES', {
      x: ML + (logoImg ? 70 : 0), y: H - HEAD_H / 2 - 4,
      size: 16, font: bold, color: COLOR_BAND_TEXT,
    })

    const seasonText = `Temporada ${params.season}`
    const tw = font.widthOfTextAtSize(seasonText, 10)
    page.drawText(seasonText, {
      x: W - MR - tw, y: H - HEAD_H / 2 + 6,
      size: 10, font, color: COLOR_BAND_TEXT,
    })
    const dateText = new Date().toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' })
    const dw = font.widthOfTextAtSize(dateText, 9)
    page.drawText(dateText, {
      x: W - MR - dw, y: H - HEAD_H / 2 - 8,
      size: 9, font, color: COLOR_BAND_TEXT,
    })

    // Pie de página (núm de página)
    const pageFooter = `Página ${pageNum} de ${totalPages}`
    const pfw = font.widthOfTextAtSize(pageFooter, 8)
    page.drawText(pageFooter, {
      x: (W - pfw) / 2, y: 18,
      size: 8, font, color: COLOR_MID,
    })
    page.drawText(CLUB_NAME, {
      x: ML, y: 18,
      size: 8, font, color: COLOR_MID,
    })
  }

  // ── Helper: dibujar fila de cabecera de tabla ───────────────────────────────
  function drawTableHeader(page: PDFPage, y: number): number {
    page.drawRectangle({ x: ML, y: y - 22, width: CW, height: 22, color: COLOR_INK })
    let cx = ML + 8
    const drawHead = (txt: string, w: number) => {
      page.drawText(txt, { x: cx, y: y - 15, size: 8.5, font: bold, color: COLOR_BAND_TEXT })
      cx += w
    }
    drawHead('JUGADOR', COL_JUGADOR)
    drawHead('EQUIPO', COL_EQUIPO)
    drawHead('PENDIENTE', COL_DEUDA)
    drawHead('CONTACTO', COL_CONTACTO)
    drawHead('ÚLT.PAGO', COL_ULTIMO)
    drawHead('NOTA', COL_NOTA)
    return y - 22
  }

  // ── Helper: dibujar fila de datos ───────────────────────────────────────────
  function drawDataRow(page: PDFPage, y: number, row: PendingPaymentRow, even: boolean): number {
    const ROW_H = row.admin_comment && row.admin_comment.length > 35 ? 38 : 26
    if (even) {
      page.drawRectangle({ x: ML, y: y - ROW_H, width: CW, height: ROW_H, color: rgb(0.975, 0.975, 0.978) })
    }
    if (row.is_special_case) {
      page.drawRectangle({ x: ML, y: y - ROW_H, width: 3, height: ROW_H, color: rgb(0.95, 0.65, 0.10) })
    }

    let cx = ML + 8
    const baseY = y - 14

    // JUGADOR
    page.drawText(truncate(row.player_name, 28), {
      x: cx, y: baseY, size: 9, font: bold, color: COLOR_DARK,
    })
    cx += COL_JUGADOR

    // EQUIPO
    page.drawText(truncate(row.team_name, 16), {
      x: cx, y: baseY, size: 9, font, color: COLOR_DARK,
    })
    cx += COL_EQUIPO

    // PENDIENTE (rojo, negrita)
    page.drawText(eur(row.pending_amount), {
      x: cx, y: baseY, size: 9.5, font: bold, color: COLOR_RED,
    })
    cx += COL_DEUDA

    // CONTACTO (email + tel apilados)
    const emailTxt = row.tutor_email ? truncate(row.tutor_email, 26) : '—'
    page.drawText(emailTxt, {
      x: cx, y: baseY + 4, size: 7.5, font, color: COLOR_MID,
    })
    if (row.tutor_phone) {
      page.drawText(row.tutor_phone, {
        x: cx, y: baseY - 6, size: 7.5, font, color: COLOR_MID,
      })
    }
    cx += COL_CONTACTO

    // ÚLT.PAGO
    page.drawText(dateESShort(row.last_payment_date), {
      x: cx, y: baseY, size: 8.5, font, color: COLOR_MID,
    })
    cx += COL_ULTIMO

    // NOTA (puede ocupar 2 líneas)
    if (row.admin_comment) {
      const maxChars = 28
      const txt = row.admin_comment.length > maxChars
        ? row.admin_comment.slice(0, maxChars) + '\n' + truncate(row.admin_comment.slice(maxChars), maxChars)
        : row.admin_comment
      const lines = txt.split('\n')
      lines.forEach((line, i) => {
        page.drawText(line, {
          x: cx, y: baseY - i * 9, size: 7.5, font: italic, color: COLOR_MID,
        })
      })
    } else if (row.is_special_case) {
      page.drawText('Caso especial', {
        x: cx, y: baseY, size: 7.5, font: italic, color: rgb(0.85, 0.55, 0.10),
      })
    }

    // Separador inferior
    page.drawLine({
      start: { x: ML, y: y - ROW_H },
      end: { x: ML + CW, y: y - ROW_H },
      thickness: 0.3, color: COLOR_LIGHT,
    })

    return y - ROW_H
  }

  // ── Construir todas las páginas ─────────────────────────────────────────────
  // Primera pasada: calcular cuántas páginas necesitamos
  const PAGE_TOP_Y_FIRST = H - 56 - 100  // Header + box filtros + box resumen
  const PAGE_TOP_Y_NEXT = H - 56 - 30    // Solo header
  const PAGE_BOTTOM_Y = 40                // espacio para footer
  const HEADER_ROW_H = 22

  type RowEstimate = { row: PendingPaymentRow; height: number }
  const rowsWithHeight: RowEstimate[] = params.rows.map(r => ({
    row: r,
    height: r.admin_comment && r.admin_comment.length > 35 ? 38 : 26,
  }))

  // Calcular saltos de página
  const pagesContent: RowEstimate[][] = []
  let currentPage: RowEstimate[] = []
  let yCursor = PAGE_TOP_Y_FIRST - HEADER_ROW_H
  let isFirst = true
  for (const rec of rowsWithHeight) {
    if (yCursor - rec.height < PAGE_BOTTOM_Y) {
      pagesContent.push(currentPage)
      currentPage = []
      isFirst = false
      yCursor = PAGE_TOP_Y_NEXT - HEADER_ROW_H
    }
    currentPage.push(rec)
    yCursor -= rec.height
  }
  if (currentPage.length > 0) pagesContent.push(currentPage)
  // Caso 0 filas: una página vacía
  if (pagesContent.length === 0) pagesContent.push([])
  const totalPages = pagesContent.length

  // Segunda pasada: dibujar cada página
  for (let pageIdx = 0; pageIdx < totalPages; pageIdx++) {
    const page = doc.addPage([W, H])
    drawPageHeader(page, pageIdx + 1, totalPages)

    let yCursorPage: number

    if (pageIdx === 0) {
      // Resumen + filtros en la primera página
      const summaryY = H - 56 - 18
      const totalRows = params.rows.length
      const totalAmount = params.rows.reduce((s, r) => s + r.pending_amount, 0)
      const specialCount = params.rows.filter(r => r.is_special_case).length

      // Caja resumen
      page.drawRectangle({
        x: ML, y: summaryY - 70, width: CW, height: 70,
        color: COLOR_AMBER_BG, borderColor: COLOR_ACCENT, borderWidth: 1,
      })
      page.drawText('RESUMEN', {
        x: ML + 12, y: summaryY - 18, size: 9, font: bold, color: COLOR_ACCENT,
      })
      // Métricas en una fila
      const metrics = [
        ['Jugadores', `${totalRows}`],
        ['Total pendiente', eur(totalAmount)],
        ['Casos especiales', `${specialCount}`],
      ]
      let mx = ML + 12
      const mw = (CW - 24) / metrics.length
      for (const [label, value] of metrics) {
        page.drawText(label.toUpperCase(), {
          x: mx, y: summaryY - 38, size: 7.5, font, color: COLOR_MID,
        })
        page.drawText(value, {
          x: mx, y: summaryY - 55, size: 14, font: bold, color: COLOR_DARK,
        })
        mx += mw
      }

      // Filtros aplicados
      const filtersY = summaryY - 86
      const filterParts: string[] = []
      if (params.filters.teams.length > 0) {
        const teamsTxt = params.filters.teams.length > 4
          ? `${params.filters.teams.slice(0, 4).join(', ')} (+${params.filters.teams.length - 4})`
          : params.filters.teams.join(', ')
        filterParts.push(`Equipos: ${teamsTxt}`)
      } else {
        filterParts.push('Equipos: todos')
      }
      if (params.filters.concepts.length > 0) {
        filterParts.push(`Concepto: ${params.filters.concepts.join(', ')}`)
      }
      page.drawText(`Filtros — ${filterParts.join('   ·   ')}`, {
        x: ML, y: filtersY, size: 8.5, font: italic, color: COLOR_MID,
      })

      yCursorPage = drawTableHeader(page, filtersY - 8)
    } else {
      // Páginas siguientes — sin resumen, solo header de tabla
      yCursorPage = drawTableHeader(page, PAGE_TOP_Y_NEXT)
    }

    // Dibujar filas de esta página
    const rowsOnPage = pagesContent[pageIdx]
    if (rowsOnPage.length === 0) {
      page.drawText('Sin pagos pendientes que coincidan con los filtros aplicados.', {
        x: ML, y: yCursorPage - 30, size: 11, font: italic, color: COLOR_MID,
      })
    } else {
      let y = yCursorPage
      rowsOnPage.forEach((rec, i) => {
        y = drawDataRow(page, y, rec.row, i % 2 === 0)
      })
    }
  }

  const bytes = await doc.save()
  return Buffer.from(bytes)
}
