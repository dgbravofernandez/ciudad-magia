import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'

// ─── Color helpers ────────────────────────────────────────────────────────────

function hexToRgb(hex: string) {
  try {
    const h = hex.replace('#', '')
    return rgb(
      parseInt(h.slice(0, 2), 16) / 255,
      parseInt(h.slice(2, 4), 16) / 255,
      parseInt(h.slice(4, 6), 16) / 255,
    )
  } catch {
    return rgb(0.07, 0.20, 0.53)  // fallback azul EF Getafe
  }
}

// Luminancia percibida (0 = negro, 1 = blanco). Sirve para decidir contraste.
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

// Versión muy clara del color primario (fondo de cajas suaves)
function paleOf(hex: string) {
  try {
    const h = hex.replace('#', '')
    const r = Math.min(1, parseInt(h.slice(0, 2), 16) / 255 * 0.08 + 0.93)
    const g = Math.min(1, parseInt(h.slice(2, 4), 16) / 255 * 0.08 + 0.93)
    const b = Math.min(1, parseInt(h.slice(4, 6), 16) / 255 * 0.08 + 0.93)
    return rgb(r, g, b)
  } catch {
    return rgb(0.94, 0.96, 0.99)
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

// ─── Label helpers ────────────────────────────────────────────────────────────

const METHOD_LABELS: Record<string, string> = {
  cash: 'Efectivo',
  card: 'Tarjeta',
  transfer: 'Transferencia',
}

function eur(n: number) {
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(n)
}

function dateES(s: string) {
  try {
    return new Intl.DateTimeFormat('es-ES', {
      day: '2-digit', month: 'long', year: 'numeric',
    }).format(new Date(s))
  } catch { return s }
}

// ─── Params ───────────────────────────────────────────────────────────────────

export interface ReceiptParams {
  playerName: string
  teamName: string
  amount: number
  method: string
  date: string
  concept: string
  receiptNumber: string
  // Branding
  clubName?: string
  primaryColor?: string   // hex p.ej. '#003087'
  logoUrl?: string | null
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export async function generateReceiptPDF(params: ReceiptParams): Promise<Buffer> {
  const CLUB_NAME  = params.clubName ?? 'El Club'
  const primaryHex = params.primaryColor ?? '#0d2e6e'
  const COLOR_BRAND = hexToRgb(primaryHex)

  // ¿La marca es clara (amarillo, naranja claro...)? Si lo es, sobre ella el
  // texto blanco no se ve → usamos bandas NEGRAS con el color de marca encima.
  const brandIsLight = luminance(primaryHex) > 0.6

  // Paleta base
  const COLOR_INK    = rgb(0.11, 0.11, 0.13)   // negro suave
  const COLOR_DARK   = rgb(0.13, 0.13, 0.15)
  const COLOR_MID    = rgb(0.42, 0.45, 0.50)
  const COLOR_LIGHT  = rgb(0.88, 0.88, 0.90)
  const COLOR_WHITE  = rgb(1, 1, 1)
  const COLOR_GREEN  = rgb(0.07, 0.55, 0.24)
  const COLOR_PALE   = paleOf(primaryHex)

  // Bandas (cabecera/pie/título). Marca clara → fondo negro + texto de marca.
  //                               Marca oscura → fondo de marca + texto blanco.
  const COLOR_BAND_BG   = brandIsLight ? COLOR_INK   : COLOR_BRAND
  const COLOR_BAND_TEXT = brandIsLight ? COLOR_BRAND : COLOR_WHITE

  // Acento seguro sobre fondos claros (bordes finos, etiquetas). Marca clara
  // sería ilegible sobre blanco → usamos negro.
  const COLOR_ACCENT = brandIsLight ? COLOR_INK : COLOR_BRAND

  const doc  = await PDFDocument.create()
  const font = await doc.embedFont(StandardFonts.Helvetica)
  const bold = await doc.embedFont(StandardFonts.HelveticaBold)

  // Intentar cargar logo
  const logoImg = params.logoUrl ? await tryEmbedLogo(doc, params.logoUrl) : null

  const W  = 595   // A4 ancho
  const H  = 842   // A4 alto
  const ML = 48    // margen lateral
  const CW = W - ML * 2  // ancho de contenido

  const page = doc.addPage([W, H])

  // ── HEADER: zona blanca con logo + nombre club ────────────────────────────
  const WHITE_H = 64
  const BAND_H  = 40

  page.drawRectangle({
    x: 0, y: H - WHITE_H,
    width: W, height: WHITE_H,
    color: COLOR_WHITE,
  })

  if (logoImg) {
    const logoH = Math.min(48, WHITE_H - 10)
    const logoW = logoImg.width * (logoH / logoImg.height)
    page.drawImage(logoImg, {
      x: ML,
      y: H - WHITE_H + (WHITE_H - logoH) / 2,
      width: logoW,
      height: logoH,
    })
    const nameX = ML + logoW + 12
    const nameSize = 13
    const nameY = H - WHITE_H / 2 - nameSize / 2 + 2
    page.drawText(CLUB_NAME, {
      x: nameX, y: nameY,
      size: nameSize, font: bold,
      color: COLOR_INK,
    })
  } else {
    const nameSize = 15
    const nameW = bold.widthOfTextAtSize(CLUB_NAME, nameSize)
    page.drawText(CLUB_NAME, {
      x: (W - nameW) / 2,
      y: H - WHITE_H / 2 - nameSize / 2 + 2,
      size: nameSize, font: bold,
      color: COLOR_INK,
    })
  }

  page.drawLine({
    start: { x: 0, y: H - WHITE_H },
    end: { x: W, y: H - WHITE_H },
    thickness: 0.5, color: COLOR_LIGHT,
  })

  // ── BANDA DE COLOR: título ────────────────────────────────────────────────
  page.drawRectangle({
    x: 0, y: H - WHITE_H - BAND_H,
    width: W, height: BAND_H,
    color: COLOR_BAND_BG,
  })
  const titulo = 'JUSTIFICANTE DE PAGO'
  const tW = bold.widthOfTextAtSize(titulo, 14)
  page.drawText(titulo, {
    x: (W - tW) / 2,
    y: H - WHITE_H - BAND_H + (BAND_H - 14) / 2 + 2,
    size: 14, font: bold,
    color: COLOR_BAND_TEXT,
  })

  // ── CUERPO ────────────────────────────────────────────────────────────────
  let y = H - WHITE_H - BAND_H - 36

  // ── Número de recibo — tarjeta oscura, alto contraste ─────────────────────
  const recLabel = 'Nº DE RECIBO'
  const recValue = params.receiptNumber
  const recLabelSize = 7.5
  const recValueSize = 12
  const recPadX = 12
  const recBoxW = Math.max(
    font.widthOfTextAtSize(recLabel, recLabelSize),
    bold.widthOfTextAtSize(recValue, recValueSize),
  ) + recPadX * 2
  const recBoxH = 38
  const recBoxX = W - ML - recBoxW
  const recBoxY = y - recBoxH

  // Fondo oscuro
  page.drawRectangle({
    x: recBoxX, y: recBoxY,
    width: recBoxW, height: recBoxH,
    color: COLOR_INK,
  })
  // Filo de color de marca a la izquierda de la tarjeta
  page.drawRectangle({
    x: recBoxX, y: recBoxY,
    width: 3, height: recBoxH,
    color: COLOR_BRAND,
  })
  // Etiqueta (gris claro)
  page.drawText(recLabel, {
    x: recBoxX + recPadX, y: recBoxY + recBoxH - 14,
    size: recLabelSize, font,
    color: rgb(0.62, 0.63, 0.66),
  })
  // Valor (color de marca si es claro, blanco si no)
  page.drawText(recValue, {
    x: recBoxX + recPadX, y: recBoxY + 9,
    size: recValueSize, font: bold,
    color: COLOR_BAND_TEXT,
  })

  y -= recBoxH + 16

  // ── Tabla de detalles ─────────────────────────────────────────────────────
  const methodLabel = METHOD_LABELS[params.method] ?? params.method

  const rows: [string, string][] = [
    ['Fecha de pago', dateES(params.date)],
    ['Jugador / Participante', params.playerName],
    ['Equipo / Categoría', params.teamName],
    ['Concepto', params.concept],
    ['Forma de pago', methodLabel],
  ]

  const ROW_H    = 30
  const LABEL_W  = 175
  const VAL_X    = ML + LABEL_W + 16

  for (let i = 0; i < rows.length; i++) {
    const [label, value] = rows[i]
    const rowY = y - (i + 1) * ROW_H
    const isEven = i % 2 === 0

    page.drawRectangle({
      x: ML, y: rowY,
      width: CW, height: ROW_H,
      color: isEven ? rgb(0.975, 0.975, 0.978) : COLOR_WHITE,
    })

    if (isEven) {
      page.drawRectangle({
        x: ML, y: rowY,
        width: 3, height: ROW_H,
        color: COLOR_ACCENT,
      })
    }

    page.drawText(label, {
      x: ML + 12, y: rowY + (ROW_H - 10) / 2 + 1,
      size: 10, font,
      color: COLOR_MID,
    })

    const maxValW = CW - LABEL_W - 32
    let valText = value
    while (valText.length > 3 && bold.widthOfTextAtSize(valText, 10) > maxValW) {
      valText = valText.slice(0, -1)
    }
    if (valText !== value) valText = valText.slice(0, -1) + '…'

    page.drawText(valText, {
      x: VAL_X, y: rowY + (ROW_H - 10) / 2 + 1,
      size: 10, font: bold,
      color: COLOR_DARK,
    })
  }

  const tableY = y - rows.length * ROW_H
  page.drawLine({ start: { x: ML, y: tableY }, end: { x: ML + CW, y: tableY }, thickness: 0.8, color: COLOR_LIGHT })
  page.drawLine({ start: { x: ML, y }, end: { x: ML + CW, y }, thickness: 0.8, color: COLOR_LIGHT })
  page.drawLine({ start: { x: ML, y: tableY }, end: { x: ML, y }, thickness: 0.8, color: COLOR_LIGHT })
  page.drawLine({ start: { x: ML + CW, y: tableY }, end: { x: ML + CW, y }, thickness: 0.8, color: COLOR_LIGHT })

  y -= rows.length * ROW_H + 28

  // ── Caja TOTAL ────────────────────────────────────────────────────────────
  const TOTAL_H = 52

  page.drawRectangle({
    x: ML, y: y - TOTAL_H,
    width: CW, height: TOTAL_H,
    color: COLOR_PALE,
    borderColor: COLOR_ACCENT,
    borderWidth: 1.2,
  })

  page.drawText('TOTAL PAGADO', {
    x: ML + 20, y: y - TOTAL_H + (TOTAL_H - 12) / 2 + 2,
    size: 12, font: bold,
    color: COLOR_ACCENT,
  })

  const amountStr = eur(params.amount)
  const amountSize = 20
  const amountW = bold.widthOfTextAtSize(amountStr, amountSize)
  page.drawText(amountStr, {
    x: ML + CW - 20 - amountW,
    y: y - TOTAL_H + (TOTAL_H - amountSize) / 2 + 2,
    size: amountSize, font: bold,
    color: COLOR_GREEN,
  })

  y -= TOTAL_H + 24

  // ── Nota informativa ─────────────────────────────────────────────────────
  const nota = 'Este documento acredita que el pago indicado ha sido recibido correctamente.'
  const notaW = font.widthOfTextAtSize(nota, 9)
  page.drawText(nota, {
    x: (W - notaW) / 2, y,
    size: 9, font,
    color: COLOR_MID,
  })

  // ── FOOTER ────────────────────────────────────────────────────────────────
  page.drawRectangle({
    x: 0, y: 0, width: W, height: 36,
    color: COLOR_BAND_BG,
  })

  const footerText = `${CLUB_NAME}  ·  Conserve este documento como justificante de pago`
  const footerW = font.widthOfTextAtSize(footerText, 8)
  page.drawText(footerText, {
    x: (W - footerW) / 2, y: 12,
    size: 8, font,
    color: COLOR_BAND_TEXT,
  })

  const pdfBytes = await doc.save()
  return Buffer.from(pdfBytes)
}
