import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'

const COLOR_GREEN = rgb(0.09, 0.55, 0.25)
const COLOR_RED   = rgb(0.75, 0.15, 0.15)
const COLOR_DARK  = rgb(0.18, 0.18, 0.18)
const COLOR_MID   = rgb(0.42, 0.42, 0.42)
const COLOR_LIGHT = rgb(0.82, 0.82, 0.82)
const COLOR_WHITE = rgb(1, 1, 1)
const COLOR_ALT   = rgb(0.96, 0.97, 0.99)
// Texto secundario en fondo blanco (gris medio-oscuro — siempre contrasta)
const COLOR_SECONDARY = rgb(0.38, 0.42, 0.50)

const SOURCE_LABELS: Record<string, string> = {
  cuota: 'Cuota',
  ropa: 'Ropa',
  torneo: 'Torneo',
  actividad: 'Actividad',
  gasto: 'Gasto',
  otro: 'Otro',
}

const METHOD_LABELS: Record<string, string> = {
  cash: 'Efectivo',
  card: 'Tarjeta',
  transfer: 'Transferencia',
}

export interface CashCloseMovement {
  player_name: string
  team_name: string
  amount: number
  payment_method: string
  movement_date: string
  description: string
  type: 'income' | 'expense'
  source?: string | null
  season?: string | null
}

export interface CashCloseParams {
  periodStart: string
  periodEnd: string
  closedAt: string
  systemCash: number
  realCash: number
  systemCard: number
  realCard: number
  notes: string | null
  movements: CashCloseMovement[]
  // Club branding
  clubName?: string
  primaryColor?: string   // hex e.g. '#003087'
  logoUrl?: string
}

function hexToRgbColor(hex: string) {
  try {
    const h = hex.replace('#', '')
    const r = parseInt(h.slice(0, 2), 16) / 255
    const g = parseInt(h.slice(2, 4), 16) / 255
    const b = parseInt(h.slice(4, 6), 16) / 255
    return rgb(r, g, b)
  } catch {
    return rgb(0.08, 0.12, 0.24)
  }
}

// Luminancia relativa (fórmula WCAG simplificada) — 0=negro, 1=blanco
function luminanceOf(hex: string): number {
  try {
    const h = hex.replace('#', '')
    const r = parseInt(h.slice(0, 2), 16) / 255
    const g = parseInt(h.slice(2, 4), 16) / 255
    const b = parseInt(h.slice(4, 6), 16) / 255
    return 0.2126 * r + 0.7152 * g + 0.0722 * b
  } catch { return 0 }
}

// Ligeramente más claro que primaryColor para el header de tabla
function lightenColor(hex: string) {
  try {
    const h = hex.replace('#', '')
    const r = Math.min(1, parseInt(h.slice(0, 2), 16) / 255 + 0.15)
    const g = Math.min(1, parseInt(h.slice(2, 4), 16) / 255 + 0.15)
    const b = Math.min(1, parseInt(h.slice(4, 6), 16) / 255 + 0.15)
    return rgb(r, g, b)
  } catch {
    return rgb(0.22, 0.26, 0.42)
  }
}

function netBg(hex: string) {
  try {
    const h = hex.replace('#', '')
    const r = Math.min(1, parseInt(h.slice(0, 2), 16) / 255 * 0.15 + 0.85)
    const g = Math.min(1, parseInt(h.slice(2, 4), 16) / 255 * 0.15 + 0.85)
    const b = Math.min(1, parseInt(h.slice(4, 6), 16) / 255 * 0.15 + 0.85)
    return rgb(r, g, b)
  } catch {
    return rgb(0.93, 0.96, 1.0)
  }
}

function subColor(hex: string) {
  try {
    const h = hex.replace('#', '')
    const r = Math.min(1, parseInt(h.slice(0, 2), 16) / 255 * 0.55 + 0.45)
    const g = Math.min(1, parseInt(h.slice(2, 4), 16) / 255 * 0.55 + 0.45)
    const b = Math.min(1, parseInt(h.slice(4, 6), 16) / 255 * 0.55 + 0.45)
    return rgb(r, g, b)
  } catch {
    return rgb(0.70, 0.78, 0.92)
  }
}

// Versión más oscura (70%) del color — para cabeceras de tabla cuando el primario es claro
function darkOf(hex: string) {
  try {
    const h = hex.replace('#', '')
    const r = Math.max(0, parseInt(h.slice(0, 2), 16) / 255 * 0.70)
    const g = Math.max(0, parseInt(h.slice(2, 4), 16) / 255 * 0.70)
    const b = Math.max(0, parseInt(h.slice(4, 6), 16) / 255 * 0.70)
    return rgb(r, g, b)
  } catch {
    return rgb(0.12, 0.16, 0.30)
  }
}

async function tryEmbedLogo(doc: PDFDocument, url: string) {
  try {
    const resp = await fetch(url, { signal: AbortSignal.timeout(5000) })
    if (!resp.ok) return null
    const buf = new Uint8Array(await resp.arrayBuffer())
    // PNG: 89 50 4E 47
    if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4E && buf[3] === 0x47) {
      return await doc.embedPng(buf)
    }
    // JPEG: FF D8
    if (buf[0] === 0xFF && buf[1] === 0xD8) {
      return await doc.embedJpg(buf)
    }
    return null
  } catch {
    return null
  }
}

function eur(n: number) {
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(n)
}

function dateES(s: string) {
  try {
    return new Intl.DateTimeFormat('es-ES', {
      day: '2-digit', month: '2-digit', year: 'numeric',
    }).format(new Date(s))
  } catch { return s }
}

function trunc(str: string, max: number) {
  return str.length > max ? str.slice(0, max - 1) + '…' : str
}

function getSourceLabel(m: CashCloseMovement): string {
  const baseLabel = (() => {
    if (m.source && SOURCE_LABELS[m.source]) return SOURCE_LABELS[m.source]
    const desc = m.description.toLowerCase()
    if (desc.startsWith('pago cuota') || desc.includes('cuota')) return 'Cuota'
    if (desc.startsWith('ropa')) return 'Ropa'
    if (desc.includes('torneo')) return 'Torneo'
    if (desc.includes('actividad')) return 'Actividad'
    return 'Otro'
  })()
  // Añadir temporada para cuotas, p.ej. "Cuota 25/26"
  if (baseLabel === 'Cuota' && m.season) {
    // Convertir "2025/26" → "25/26" para que quepa en la columna
    const short = m.season.replace(/^20(\d{2})\/(\d{2,4})$/, (_: string, a: string, b: string) => `${a}/${b.slice(-2)}`)
    return `Cuota ${short}`
  }
  return baseLabel
}

export async function generateCashClosePDF(params: CashCloseParams): Promise<Buffer> {
  const CLUB_NAME = params.clubName ?? 'Escuela de Futbol Ciudad de Getafe'
  const primaryHex = params.primaryColor ?? '#003087'
  const COLOR_NAVY  = hexToRgbColor(primaryHex)
  const COLOR_HDR   = lightenColor(primaryHex)
  const COLOR_NET   = netBg(primaryHex)

  // ── Contraste adaptativo ─────────────────────────────────────────────────
  // Si el color primario del club es claro (p.ej. amarillo), el texto blanco
  // sobre ese fondo es ilegible. Detectamos con luminancia y usamos negro.
  const primaryIsLight = luminanceOf(primaryHex) > 0.45
  // Texto sobre fondo de color primario
  const COLOR_ON_BRAND = primaryIsLight ? rgb(0.08, 0.08, 0.10) : COLOR_WHITE
  // Subtítulos/secondary sobre fondo de color primario
  const COLOR_ON_BRAND_SUB = primaryIsLight ? rgb(0.22, 0.22, 0.25) : rgb(0.80, 0.87, 0.95)
  // Fondo de cabeceras de tabla: si primario es claro, usar versión oscura del color
  const COLOR_HDR_BG = primaryIsLight ? darkOf(primaryHex) : COLOR_HDR
  // Fondo del balance neto: si primario es claro, usar gris neutro (evitar pale-yellow)
  const COLOR_NET_BG   = primaryIsLight ? rgb(0.94, 0.94, 0.96) : COLOR_NET
  // Texto del label "BALANCE NETO" sobre ese fondo
  const COLOR_NET_LABEL = primaryIsLight ? rgb(0.10, 0.10, 0.12) : COLOR_NAVY

  const doc  = await PDFDocument.create()
  const font = await doc.embedFont(StandardFonts.Helvetica)
  const bold = await doc.embedFont(StandardFonts.HelveticaBold)

  // Intentar cargar logo del club
  const logoImg = params.logoUrl ? await tryEmbedLogo(doc, params.logoUrl) : null

  const W  = 595
  const H  = 842
  const ML = 42
  const CW = W - ML * 2

  // Header en dos zonas:
  //   ZONA BLANCA (arriba): logo + nombre del club
  //   ZONA COLOR  (abajo):  título + periodo
  const WHITE_H = 54   // zona blanca
  const NAVY_H  = 48   // zona de color
  const HEADER_H = WHITE_H + NAVY_H

  let page = doc.addPage([W, H])
  let y    = H - ML

  function newPage() {
    page = doc.addPage([W, H])
    y    = H - ML
    // Cabecera compacta de continuación (zona color)
    page.drawRectangle({ x: 0, y: H - 28, width: W, height: 28, color: COLOR_NAVY })
    const cont = `${CLUB_NAME.toUpperCase()} — ARQUEO ${dateES(params.periodStart)} a ${dateES(params.periodEnd)} (cont.)`
    page.drawText(cont, { x: ML, y: H - 18, size: 8, font: bold, color: COLOR_ON_BRAND })
    y = H - 28 - 14
  }

  function checkBreak(needed = 60) {
    if (y < needed + 52) newPage()
  }

  // ── MAIN HEADER ──────────────────────────────────────────────────
  // Zona blanca: fondo blanco con borde inferior sutil
  page.drawRectangle({ x: 0, y: H - WHITE_H, width: W, height: WHITE_H, color: COLOR_WHITE })
  page.drawLine({
    start: { x: 0, y: H - WHITE_H },
    end:   { x: W, y: H - WHITE_H },
    thickness: 0.8, color: COLOR_LIGHT,
  })

  // Logo en zona blanca — derecha
  const LOGO_ZONE_W = logoImg ? 100 : 0
  if (logoImg) {
    const maxH = 42
    const maxW = 88
    const scale = Math.min(maxH / logoImg.height, maxW / logoImg.width)
    const lw = logoImg.width * scale
    const lh = logoImg.height * scale
    page.drawImage(logoImg, {
      x: W - ML - lw,
      y: H - WHITE_H / 2 - lh / 2,
      width: lw,
      height: lh,
    })
  }

  // Nombre del club en zona blanca — izquierda
  const clubTextMaxW = W - ML * 2 - LOGO_ZONE_W - 10
  page.drawText(CLUB_NAME.toUpperCase(), {
    x: ML, y: H - 20, size: 10, font: bold, color: COLOR_NAVY,
    maxWidth: clubTextMaxW,
  })
  page.drawText('Gestión Deportiva', {
    x: ML, y: H - 36, size: 8, font, color: COLOR_SECONDARY,
  })

  // Zona de color (navy)
  page.drawRectangle({ x: 0, y: H - HEADER_H, width: W, height: NAVY_H, color: COLOR_NAVY })

  // Título "ARQUEO DE CAJA" en zona navy — izquierda
  page.drawText('ARQUEO DE CAJA', {
    x: ML, y: H - WHITE_H - 20, size: 20, font: bold, color: COLOR_ON_BRAND,
  })

  // Periodo y fecha de cierre en zona navy
  const periodoTxt = `Periodo: ${dateES(params.periodStart)} — ${dateES(params.periodEnd)}`
  page.drawText(periodoTxt, {
    x: ML, y: H - WHITE_H - 40, size: 8, font, color: COLOR_ON_BRAND_SUB,
  })
  const clTxt = `Cerrado: ${dateES(params.closedAt)}`
  const clW   = font.widthOfTextAtSize(clTxt, 8)
  page.drawText(clTxt, {
    x: W - ML - clW, y: H - WHITE_H - 40, size: 8, font, color: COLOR_ON_BRAND_SUB,
  })

  y = H - HEADER_H - 22

  // ── KPI BOXES ────────────────────────────────────────────────────
  const incomeMovs  = params.movements.filter(m => m.type === 'income')
  const expenseMovs = params.movements.filter(m => m.type === 'expense')
  const totalIncome  = incomeMovs.reduce((s, m) => s + m.amount, 0)
  const totalExpense = expenseMovs.reduce((s, m) => s + Math.abs(m.amount), 0)
  const net = totalIncome - totalExpense

  const boxes = [
    { label: 'Total Ingresos',   val: eur(totalIncome),        col: COLOR_GREEN },
    { label: 'Total Gastos',     val: eur(totalExpense),        col: COLOR_RED   },
    { label: 'Efectivo sistema', val: eur(params.systemCash),  col: COLOR_NAVY  },
    { label: 'Tarjeta sistema',  val: eur(params.systemCard),  col: COLOR_NAVY  },
  ]
  const bw = (CW - 9) / 4
  for (let i = 0; i < boxes.length; i++) {
    const bx = ML + i * (bw + 3)
    const bh = 50
    page.drawRectangle({ x: bx, y: y - bh, width: bw, height: bh, color: COLOR_ALT })
    page.drawRectangle({ x: bx, y: y - bh, width: 3.5, height: bh, color: boxes[i].col })
    page.drawText(boxes[i].label, { x: bx + 9, y: y - 16, size: 7.5, font, color: COLOR_MID })
    const vw = bold.widthOfTextAtSize(boxes[i].val, 12)
    page.drawText(boxes[i].val, {
      x: Math.min(bx + 9, bx + bw - vw - 5),
      y: y - 36, size: 12, font: bold, color: boxes[i].col,
    })
  }
  y -= 62

  // ── HELPERS ──────────────────────────────────────────────────────
  function sectionTitle(title: string) {
    checkBreak(40)
    page.drawRectangle({ x: ML, y: y - 20, width: CW, height: 20, color: COLOR_NAVY })
    page.drawText(title, { x: ML + 8, y: y - 13, size: 9, font: bold, color: COLOR_ON_BRAND })
    y -= 20
  }

  type ColDef  = { label: string; x: number; align?: 'right' }
  type CellDef = { text: string; x: number; align?: 'right'; bold?: boolean; color?: ReturnType<typeof rgb> }

  function tableHeader(cols: ColDef[]) {
    page.drawRectangle({ x: ML, y: y - 17, width: CW, height: 17, color: COLOR_HDR_BG })
    for (const c of cols) {
      const tw = c.align === 'right' ? bold.widthOfTextAtSize(c.label, 7.5) : 0
      page.drawText(c.label, {
        x: c.align === 'right' ? c.x - tw : c.x,
        y: y - 12, size: 7.5, font: bold, color: COLOR_ON_BRAND,
      })
    }
    y -= 17
  }

  function tableRow(cells: CellDef[], i: number) {
    checkBreak(18)
    if (i % 2 === 0) {
      page.drawRectangle({ x: ML, y: y - 15, width: CW, height: 15, color: COLOR_ALT })
    }
    for (const c of cells) {
      const f  = c.bold ? bold : font
      const tw = c.align === 'right' ? f.widthOfTextAtSize(c.text, 8) : 0
      page.drawText(c.text, {
        x: c.align === 'right' ? c.x - tw : c.x,
        y: y - 10, size: 8, font: f, color: c.color ?? COLOR_DARK,
      })
    }
    y -= 15
  }

  function totalLine(label: string, value: string, color: ReturnType<typeof rgb>, rightX: number) {
    page.drawLine({ start: { x: ML, y: y + 2 }, end: { x: ML + CW, y: y + 2 }, thickness: 0.8, color: COLOR_LIGHT })
    y -= 4
    page.drawText(label, { x: ML + 6, y: y - 10, size: 8.5, font: bold, color: COLOR_NAVY })
    page.drawText(value, {
      x: rightX - bold.widthOfTextAtSize(value, 8.5),
      y: y - 10, size: 8.5, font: bold, color,
    })
    y -= 20
  }

  // ── INCOME TABLE ─────────────────────────────────────────────────
  if (incomeMovs.length > 0) {
    y -= 8
    sectionTitle('DETALLE DE INGRESOS')

    // Columnas: TIPO | JUGADOR | EQUIPO | F.PAGO | FECHA | IMPORTE
    const xTipo = ML + 6
    const xN    = ML + 58
    const xEq   = ML + 248
    const xM    = ML + 338
    const xD    = ML + 398
    const xA    = ML + CW - 6

    tableHeader([
      { label: 'TIPO',                   x: xTipo },
      { label: 'JUGADOR / DESCRIPCIÓN',  x: xN    },
      { label: 'EQUIPO',                 x: xEq   },
      { label: 'F. PAGO',                x: xM    },
      { label: 'FECHA',                  x: xD    },
      { label: 'IMPORTE',                x: xA, align: 'right' },
    ])

    let incTotal = 0
    for (let i = 0; i < incomeMovs.length; i++) {
      const m = incomeMovs[i]
      incTotal += m.amount
      tableRow([
        { text: getSourceLabel(m),                                            x: xTipo, color: COLOR_NAVY, bold: true },
        { text: trunc(m.player_name || m.description, 32),                   x: xN    },
        { text: trunc(m.team_name || '—', 12),                               x: xEq   },
        { text: METHOD_LABELS[m.payment_method] ?? m.payment_method ?? '—',  x: xM    },
        { text: dateES(m.movement_date),                                      x: xD    },
        { text: eur(m.amount), x: xA, align: 'right', bold: true, color: COLOR_GREEN },
      ], i)
    }
    totalLine('TOTAL INGRESOS', eur(incTotal), COLOR_GREEN, xA)
  }

  // ── EXPENSE TABLE ─────────────────────────────────────────────────
  if (expenseMovs.length > 0) {
    y -= 8
    sectionTitle('DETALLE DE GASTOS')

    const xD2 = ML + 6
    const xM2 = ML + 342
    const xF2 = ML + 404
    const xA2 = ML + CW - 6

    tableHeader([
      { label: 'DESCRIPCIÓN', x: xD2 },
      { label: 'F. PAGO',     x: xM2 },
      { label: 'FECHA',       x: xF2 },
      { label: 'IMPORTE',     x: xA2, align: 'right' },
    ])

    let expTotal = 0
    for (let i = 0; i < expenseMovs.length; i++) {
      const m   = expenseMovs[i]
      const amt = Math.abs(m.amount)
      expTotal += amt
      tableRow([
        { text: trunc(m.description || '—', 50),    x: xD2 },
        { text: METHOD_LABELS[m.payment_method] ?? m.payment_method ?? '—', x: xM2 },
        { text: dateES(m.movement_date),              x: xF2 },
        { text: eur(amt), x: xA2, align: 'right', bold: true, color: COLOR_RED },
      ], i)
    }
    totalLine('TOTAL GASTOS', eur(expTotal), COLOR_RED, xA2)
  }

  // ── CONTROL DE CAJA ───────────────────────────────────────────────
  y -= 8
  checkBreak(110)
  sectionTitle('CONTROL DE CAJA')

  const xConcept = ML + 6
  const xSist    = ML + 264
  const xReal    = ML + 368
  const xDiff    = ML + CW - 6

  tableHeader([
    { label: 'CONCEPTO',         x: xConcept },
    { label: 'SISTEMA',          x: xSist,  align: 'right' },
    { label: 'REAL (CONTADO)',   x: xReal,  align: 'right' },
    { label: 'DIFERENCIA',       x: xDiff,  align: 'right' },
  ])

  const ctrlRows = [
    { concept: 'Efectivo', sist: params.systemCash, real: params.realCash },
    { concept: 'Tarjeta',  sist: params.systemCard, real: params.realCard },
  ]
  for (let i = 0; i < ctrlRows.length; i++) {
    const r    = ctrlRows[i]
    const diff = r.real - r.sist
    const dc   = Math.abs(diff) < 0.01 ? COLOR_GREEN : COLOR_RED
    const ds   = (diff >= 0 ? '+' : '') + eur(diff)
    tableRow([
      { text: r.concept,    x: xConcept, bold: true },
      { text: eur(r.sist),  x: xSist,  align: 'right' },
      { text: eur(r.real),  x: xReal,  align: 'right' },
      { text: ds,           x: xDiff,  align: 'right', bold: true, color: dc },
    ], i)
  }

  // ── BALANCE NETO ──────────────────────────────────────────────────
  y -= 14
  checkBreak(50)
  page.drawRectangle({ x: ML, y: y - 38, width: CW, height: 38, color: COLOR_NET_BG })
  page.drawRectangle({ x: ML, y: y - 38, width: 4, height: 38, color: net >= 0 ? COLOR_GREEN : COLOR_RED })
  page.drawText('BALANCE NETO DEL PERIODO', {
    x: ML + 14, y: y - 14, size: 9, font: bold, color: COLOR_NET_LABEL,
  })
  const netStr = eur(net)
  page.drawText(netStr, {
    x: ML + CW - 12 - bold.widthOfTextAtSize(netStr, 16),
    y: y - 28, size: 16, font: bold,
    color: net >= 0 ? COLOR_GREEN : COLOR_RED,
  })
  y -= 52

  // ── NOTES ─────────────────────────────────────────────────────────
  if (params.notes?.trim()) {
    y -= 8
    checkBreak(30)
    page.drawText('Notas del cierre:', { x: ML, y, size: 8.5, font: bold, color: COLOR_DARK })
    y -= 14
    page.drawText(trunc(params.notes, 130), { x: ML, y, size: 8.5, font, color: COLOR_MID })
  }

  // ── PAGE FOOTERS ──────────────────────────────────────────────────
  const pageCount = doc.getPageCount()
  for (let pi = 0; pi < pageCount; pi++) {
    const pg  = doc.getPage(pi)
    const ftx = `${CLUB_NAME} — Documento generado automáticamente — Página ${pi + 1} de ${pageCount}`
    const fw  = font.widthOfTextAtSize(ftx, 7.5)
    pg.drawLine({ start: { x: ML, y: 40 }, end: { x: W - ML, y: 40 }, thickness: 0.5, color: COLOR_LIGHT })
    pg.drawText(ftx, { x: (W - fw) / 2, y: 28, size: 7.5, font, color: COLOR_LIGHT })
  }

  const pdfBytes = await doc.save()
  return Buffer.from(pdfBytes)
}
