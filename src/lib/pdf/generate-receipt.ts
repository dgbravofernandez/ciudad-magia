import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'

const CLUB_NAME = 'Escuela de Futbol Ciudad de Getafe'

const METHOD_LABELS: Record<string, string> = {
  cash: 'Efectivo',
  card: 'Tarjeta',
  transfer: 'Transferencia',
}

interface ReceiptParams {
  playerName: string
  teamName: string
  amount: number
  method: string
  date: string
  concept: string
  receiptNumber: string
}

export async function generateReceiptPDF(params: ReceiptParams): Promise<Buffer> {
  const doc = await PDFDocument.create()
  const page = doc.addPage([595, 842]) // A4
  const font = await doc.embedFont(StandardFonts.Helvetica)
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold)

  const { width, height } = page.getSize()
  const margin = 60
  let y = height - margin

  // Club name header
  page.drawText(CLUB_NAME, {
    x: margin,
    y,
    size: 18,
    font: fontBold,
    color: rgb(0.1, 0.1, 0.1),
  })
  y -= 20
  page.drawText('Justificante de pago', {
    x: margin,
    y,
    size: 11,
    font,
    color: rgb(0.4, 0.4, 0.4),
  })
  y -= 15

  // Divider line
  page.drawLine({
    start: { x: margin, y },
    end: { x: width - margin, y },
    thickness: 1,
    color: rgb(0.85, 0.85, 0.85),
  })
  y -= 35

  // Title
  const title = 'RECIBO DE PAGO'
  const titleWidth = fontBold.widthOfTextAtSize(title, 20)
  page.drawText(title, {
    x: (width - titleWidth) / 2,
    y,
    size: 20,
    font: fontBold,
    color: rgb(0.1, 0.1, 0.1),
  })
  y -= 40

  // Format values
  const formattedAmount = new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
  }).format(params.amount)

  const formattedDate = new Intl.DateTimeFormat('es-ES', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(new Date(params.date))

  const methodLabel = METHOD_LABELS[params.method] ?? params.method

  // Detail rows
  const rows = [
    ['N. Recibo:', params.receiptNumber],
    ['Fecha:', formattedDate],
    ['Jugador:', params.playerName],
    ['Equipo:', params.teamName],
    ['Concepto:', params.concept],
    ['Forma de pago:', methodLabel],
  ]

  for (const [label, value] of rows) {
    page.drawText(label, {
      x: margin,
      y,
      size: 11,
      font,
      color: rgb(0.35, 0.35, 0.35),
    })
    page.drawText(value, {
      x: margin + 180,
      y,
      size: 11,
      font: fontBold,
      color: rgb(0.15, 0.15, 0.15),
    })
    y -= 8
    // Row separator
    page.drawLine({
      start: { x: margin, y },
      end: { x: width - margin, y },
      thickness: 0.5,
      color: rgb(0.92, 0.92, 0.92),
    })
    y -= 18
  }

  // Amount total
  y -= 10
  page.drawLine({
    start: { x: margin, y: y + 5 },
    end: { x: width - margin, y: y + 5 },
    thickness: 2,
    color: rgb(0.2, 0.2, 0.2),
  })
  y -= 15
  page.drawText('TOTAL PAGADO:', {
    x: margin,
    y,
    size: 14,
    font: fontBold,
    color: rgb(0.15, 0.15, 0.15),
  })
  page.drawText(formattedAmount, {
    x: width - margin - fontBold.widthOfTextAtSize(formattedAmount, 14),
    y,
    size: 14,
    font: fontBold,
    color: rgb(0.09, 0.64, 0.25), // green
  })

  // Footer
  const footer1 = CLUB_NAME
  const footer2 = 'Este documento sirve como justificante de pago. Conservelo para sus registros.'
  const f1w = font.widthOfTextAtSize(footer1, 9)
  const f2w = font.widthOfTextAtSize(footer2, 9)
  page.drawText(footer1, {
    x: (width - f1w) / 2,
    y: 60,
    size: 9,
    font,
    color: rgb(0.6, 0.6, 0.6),
  })
  page.drawText(footer2, {
    x: (width - f2w) / 2,
    y: 46,
    size: 9,
    font,
    color: rgb(0.6, 0.6, 0.6),
  })

  const pdfBytes = await doc.save()
  return Buffer.from(pdfBytes)
}
