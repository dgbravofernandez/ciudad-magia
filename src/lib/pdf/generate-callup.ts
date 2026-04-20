import { PDFDocument, StandardFonts, rgb, PDFFont, PDFPage } from 'pdf-lib'

export interface CallupPlayer {
  dorsal_number: number | null
  first_name: string
  last_name: string
  position: string | null
  is_starter: boolean
}

export interface CallupPdfParams {
  clubName: string
  clubCif?: string | null
  primaryColor?: string | null // hex '#003087'
  logoPngBytes?: Uint8Array | null // optional PNG
  teamName: string
  matchDate: string // ISO or 'dd/mm/aaaa'
  opponent: string | null
  isHome: boolean
  kickoff?: string | null // 'HH:MM'
  venue?: string | null
  coachName?: string | null
  players: CallupPlayer[]
  sponsors?: Array<{ name: string; pngBytes?: Uint8Array | null }>
}

function hexToRgb(hex?: string | null): { r: number; g: number; b: number } {
  if (!hex) return { r: 0 / 255, g: 48 / 255, b: 135 / 255 }
  const h = hex.replace('#', '')
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16)
  return { r: ((n >> 16) & 255) / 255, g: ((n >> 8) & 255) / 255, b: (n & 255) / 255 }
}

function fmtSpanishDate(iso: string): string {
  // Accept YYYY-MM-DD or already-formatted
  if (/^\d{4}-\d{2}-\d{2}/.test(iso)) {
    const [y, m, d] = iso.substring(0, 10).split('-')
    return `${d}/${m}/${y}`
  }
  return iso
}

export async function generateCallupPDF(params: CallupPdfParams): Promise<Buffer> {
  const doc = await PDFDocument.create()
  const page: PDFPage = doc.addPage([595, 842]) // A4
  const font = await doc.embedFont(StandardFonts.Helvetica)
  const fontBold: PDFFont = await doc.embedFont(StandardFonts.HelveticaBold)

  const { width, height } = page.getSize()
  const margin = 50
  const color = hexToRgb(params.primaryColor)
  const primary = rgb(color.r, color.g, color.b)
  const grey = rgb(0.45, 0.45, 0.45)
  const dark = rgb(0.1, 0.1, 0.1)

  // ── Banda superior de color ───────────────────────────────
  page.drawRectangle({
    x: 0,
    y: height - 110,
    width,
    height: 110,
    color: primary,
  })

  let logoDrawn = false
  if (params.logoPngBytes) {
    try {
      const img = await doc.embedPng(params.logoPngBytes)
      const maxH = 80
      const scale = maxH / img.height
      const w = img.width * scale
      page.drawImage(img, {
        x: margin,
        y: height - 95,
        width: w,
        height: maxH,
      })
      logoDrawn = true
    } catch {
      // ignore invalid image
    }
  }

  page.drawText(params.clubName.toUpperCase(), {
    x: logoDrawn ? margin + 95 : margin,
    y: height - 55,
    size: 18,
    font: fontBold,
    color: rgb(1, 1, 1),
  })
  page.drawText('CONVOCATORIA OFICIAL', {
    x: logoDrawn ? margin + 95 : margin,
    y: height - 78,
    size: 11,
    font,
    color: rgb(0.9, 0.9, 0.9),
  })
  if (params.clubCif) {
    page.drawText(`CIF: ${params.clubCif}`, {
      x: logoDrawn ? margin + 95 : margin,
      y: height - 95,
      size: 9,
      font,
      color: rgb(0.85, 0.85, 0.85),
    })
  }

  let y = height - 150

  // ── Match info card ───────────────────────────────────────
  const cardH = 90
  page.drawRectangle({
    x: margin,
    y: y - cardH,
    width: width - margin * 2,
    height: cardH,
    color: rgb(0.96, 0.97, 0.99),
    borderColor: rgb(0.85, 0.87, 0.92),
    borderWidth: 1,
  })

  const padX = margin + 18
  page.drawText(params.teamName, {
    x: padX,
    y: y - 25,
    size: 14,
    font: fontBold,
    color: dark,
  })
  const rivalLabel = params.isHome
    ? `vs ${params.opponent ?? '—'}  (Local)`
    : `@ ${params.opponent ?? '—'}  (Visitante)`
  page.drawText(rivalLabel, {
    x: padX,
    y: y - 44,
    size: 11,
    font,
    color: grey,
  })

  // Right-side info
  const rightX = width - margin - 170
  page.drawText('Fecha', { x: rightX, y: y - 25, size: 9, font, color: grey })
  page.drawText(fmtSpanishDate(params.matchDate), {
    x: rightX + 55,
    y: y - 25,
    size: 11,
    font: fontBold,
    color: dark,
  })
  if (params.kickoff) {
    page.drawText('Hora', { x: rightX, y: y - 44, size: 9, font, color: grey })
    page.drawText(params.kickoff, {
      x: rightX + 55,
      y: y - 44,
      size: 11,
      font: fontBold,
      color: dark,
    })
  }
  if (params.venue) {
    page.drawText('Campo', { x: rightX, y: y - 63, size: 9, font, color: grey })
    page.drawText(params.venue, {
      x: rightX + 55,
      y: y - 63,
      size: 11,
      font,
      color: dark,
    })
  }

  y -= cardH + 30

  // ── Tabla de jugadores ───────────────────────────────────
  const starters = params.players.filter((p) => p.is_starter)
  const subs = params.players.filter((p) => !p.is_starter)

  function drawSectionTitle(text: string, yPos: number) {
    page.drawRectangle({
      x: margin,
      y: yPos - 4,
      width: width - margin * 2,
      height: 22,
      color: primary,
    })
    page.drawText(text, {
      x: margin + 10,
      y: yPos + 3,
      size: 11,
      font: fontBold,
      color: rgb(1, 1, 1),
    })
    return yPos - 28
  }

  function drawPlayerRow(
    p: CallupPlayer,
    yPos: number,
    idx: number
  ): number {
    const rowH = 22
    // Alternate bg
    if (idx % 2 === 0) {
      page.drawRectangle({
        x: margin,
        y: yPos - 4,
        width: width - margin * 2,
        height: rowH,
        color: rgb(0.98, 0.98, 0.98),
      })
    }
    // Dorsal
    page.drawText(
      p.dorsal_number != null ? String(p.dorsal_number).padStart(2, ' ') : '—',
      {
        x: margin + 12,
        y: yPos + 2,
        size: 11,
        font: fontBold,
        color: primary,
      }
    )
    // Name
    page.drawText(`${p.last_name.toUpperCase()}, ${p.first_name}`, {
      x: margin + 50,
      y: yPos + 2,
      size: 11,
      font: fontBold,
      color: dark,
    })
    // Position
    if (p.position) {
      page.drawText(p.position, {
        x: width - margin - 120,
        y: yPos + 2,
        size: 10,
        font,
        color: grey,
      })
    }
    return yPos - rowH
  }

  if (starters.length > 0) {
    y = drawSectionTitle(`TITULARES (${starters.length})`, y)
    starters.forEach((p, i) => {
      y = drawPlayerRow(p, y, i)
    })
    y -= 10
  }

  if (subs.length > 0) {
    y = drawSectionTitle(`SUPLENTES (${subs.length})`, y)
    subs.forEach((p, i) => {
      y = drawPlayerRow(p, y, i)
    })
    y -= 10
  }

  if (starters.length === 0 && subs.length === 0) {
    page.drawText('Sin jugadores convocados.', {
      x: margin,
      y: y - 20,
      size: 11,
      font,
      color: grey,
    })
    y -= 40
  }

  // ── Firma entrenador ─────────────────────────────────────
  if (y > 160) {
    const sigY = 140
    page.drawLine({
      start: { x: margin, y: sigY },
      end: { x: margin + 200, y: sigY },
      thickness: 0.6,
      color: grey,
    })
    page.drawText('Firma entrenador', {
      x: margin,
      y: sigY - 14,
      size: 9,
      font,
      color: grey,
    })
    if (params.coachName) {
      page.drawText(params.coachName, {
        x: margin,
        y: sigY + 4,
        size: 10,
        font: fontBold,
        color: dark,
      })
    }

    page.drawLine({
      start: { x: width - margin - 200, y: sigY },
      end: { x: width - margin, y: sigY },
      thickness: 0.6,
      color: grey,
    })
    page.drawText('Sello / Visto bueno', {
      x: width - margin - 200,
      y: sigY - 14,
      size: 9,
      font,
      color: grey,
    })
  }

  // ── Footer patrocinadores ────────────────────────────────
  const footerY = 60
  page.drawLine({
    start: { x: margin, y: footerY + 28 },
    end: { x: width - margin, y: footerY + 28 },
    thickness: 0.5,
    color: rgb(0.85, 0.85, 0.85),
  })
  page.drawText('PATROCINADORES', {
    x: margin,
    y: footerY + 14,
    size: 8,
    font: fontBold,
    color: grey,
  })
  if (params.sponsors && params.sponsors.length > 0) {
    const names = params.sponsors.map((s) => s.name).join('  ·  ')
    page.drawText(names, {
      x: margin,
      y: footerY - 2,
      size: 9,
      font,
      color: dark,
    })
  } else {
    page.drawText('Espacio reservado para patrocinadores del club.', {
      x: margin,
      y: footerY - 2,
      size: 9,
      font,
      color: grey,
    })
  }

  const bytes = await doc.save()
  return Buffer.from(bytes)
}
