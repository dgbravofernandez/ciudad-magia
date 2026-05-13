import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'

const CLUB_NAME = 'Escuela de Futbol Ciudad de Getafe'

const COLOR_NAVY  = rgb(0.08, 0.12, 0.24)
const COLOR_GREEN = rgb(0.09, 0.55, 0.25)
const COLOR_RED   = rgb(0.75, 0.15, 0.15)
const COLOR_DARK  = rgb(0.2, 0.2, 0.2)
const COLOR_MID   = rgb(0.45, 0.45, 0.45)
const COLOR_LIGHT = rgb(0.85, 0.85, 0.85)
const COLOR_WHITE = rgb(1, 1, 1)
const COLOR_ALT   = rgb(0.96, 0.97, 0.99)
const COLOR_HDR   = rgb(0.22, 0.26, 0.42)
const COLOR_NET   = rgb(0.93, 0.96, 1.0)
const COLOR_SUB   = rgb(0.70, 0.78, 0.92)

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

export async function generateCashClosePDF(params: CashCloseParams): Promise<Buffer> {
  const doc  = await PDFDocument.create()
  const font = await doc.embedFont(StandardFonts.Helvetica)
  const bold = await doc.embedFont(StandardFonts.HelveticaBold)

  const W  = 595        // A4 width
  const H  = 842        // A4 height
  const ML = 42         // margin left/right
  const CW = W - ML * 2 // content width

  // ── Mutable draw state (closures update these) ──────────────────
  let page = doc.addPage([W, H])
  let y    = H - ML

  function newPage() {
    page = doc.addPage([W, H])
    y    = H - ML
    // mini header on continuation pages
    page.drawRectangle({ x: 0, y: H - 26, width: W, height: 26, color: COLOR_NAVY })
    const cont = `${CLUB_NAME.toUpperCase()} — ARQUEO ${dateES(params.periodStart)} a ${dateES(params.periodEnd)} (cont.)`
    page.drawText(cont, { x: ML, y: H - 17, size: 8, font: bold, color: COLOR_WHITE })
    y = H - 26 - 14
  }

  function checkBreak(needed = 60) {
    if (y < needed + 52) newPage()
  }

  // ── MAIN HEADER ─────────────────────────────────────────────────
  page.drawRectangle({ x: 0, y: H - 88, width: W, height: 88, color: COLOR_NAVY })

  page.drawText(CLUB_NAME.toUpperCase(), {
    x: ML, y: H - 24, size: 10, font: bold, color: COLOR_SUB,
  })
  page.drawText('ARQUEO DE CAJA', {
    x: ML, y: H - 48, size: 24, font: bold, color: COLOR_WHITE,
  })
  page.drawText(`Periodo: ${dateES(params.periodStart)} — ${dateES(params.periodEnd)}`, {
    x: ML, y: H - 66, size: 9, font, color: COLOR_SUB,
  })

  const cl  = `Cerrado el ${dateES(params.closedAt)}`
  const clW = font.widthOfTextAtSize(cl, 9)
  page.drawText(cl, { x: W - ML - clW, y: H - 66, size: 9, font, color: COLOR_SUB })

  y = H - 88 - 22

  // ── KPI SUMMARY BOXES ───────────────────────────────────────────
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
    page.drawText(title, { x: ML + 8, y: y - 13, size: 9, font: bold, color: COLOR_WHITE })
    y -= 20
  }

  type ColDef  = { label: string; x: number; align?: 'right' }
  type CellDef = { text: string; x: number; align?: 'right'; bold?: boolean; color?: ReturnType<typeof rgb> }

  function tableHeader(cols: ColDef[]) {
    page.drawRectangle({ x: ML, y: y - 17, width: CW, height: 17, color: COLOR_HDR })
    for (const c of cols) {
      const tw = c.align === 'right' ? bold.widthOfTextAtSize(c.label, 7.5) : 0
      page.drawText(c.label, {
        x: c.align === 'right' ? c.x - tw : c.x,
        y: y - 12, size: 7.5, font: bold, color: COLOR_WHITE,
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

    const xN  = ML + 6
    const xEq = ML + 196
    const xM  = ML + 326
    const xD  = ML + 394
    const xA  = ML + CW - 6

    tableHeader([
      { label: 'JUGADOR / DESCRIPCIÓN', x: xN  },
      { label: 'EQUIPO',                x: xEq },
      { label: 'F. PAGO',               x: xM  },
      { label: 'FECHA',                 x: xD  },
      { label: 'IMPORTE',               x: xA, align: 'right' },
    ])

    let incTotal = 0
    for (let i = 0; i < incomeMovs.length; i++) {
      const m = incomeMovs[i]
      incTotal += m.amount
      tableRow([
        { text: trunc(m.player_name || m.description, 30), x: xN  },
        { text: trunc(m.team_name || '—', 20),              x: xEq },
        { text: METHOD_LABELS[m.payment_method] ?? m.payment_method ?? '—', x: xM },
        { text: dateES(m.movement_date),                     x: xD  },
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
  page.drawRectangle({ x: ML, y: y - 38, width: CW, height: 38, color: COLOR_NET })
  page.drawRectangle({ x: ML, y: y - 38, width: 4, height: 38, color: net >= 0 ? COLOR_GREEN : COLOR_RED })
  page.drawText('BALANCE NETO DEL PERIODO', {
    x: ML + 14, y: y - 14, size: 9, font: bold, color: COLOR_NAVY,
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
