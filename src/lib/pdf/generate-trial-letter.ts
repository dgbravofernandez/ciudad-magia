import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'

const CLUB_NAME = 'Escuela de Futbol Ciudad de Getafe'
const CIF = 'G-79896478'

interface TrialLetterParams {
  clubName: string
  playerName: string
  playerDob: string
  tutorName: string
  trialDate: string
  clubDestino: string
  currentDate: string
}

export async function generateTrialLetterPDF(params: TrialLetterParams): Promise<Buffer> {
  const doc = await PDFDocument.create()
  const page = doc.addPage([595, 842]) // A4
  const font = await doc.embedFont(StandardFonts.Helvetica)
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold)

  const { width, height } = page.getSize()
  const margin = 60
  const maxWidth = width - margin * 2
  let y = height - margin

  // Club name header
  page.drawText(CLUB_NAME, {
    x: margin,
    y,
    size: 16,
    font: fontBold,
    color: rgb(0.1, 0.1, 0.1),
  })
  y -= 18
  page.drawText(`CIF: ${CIF}`, {
    x: margin,
    y,
    size: 10,
    font,
    color: rgb(0.4, 0.4, 0.4),
  })
  y -= 15

  // Divider
  page.drawLine({
    start: { x: margin, y },
    end: { x: width - margin, y },
    thickness: 1,
    color: rgb(0.85, 0.85, 0.85),
  })
  y -= 30

  // Title
  const title = 'CARTA DE PRUEBAS'
  const titleW = fontBold.widthOfTextAtSize(title, 18)
  page.drawText(title, {
    x: (width - titleW) / 2,
    y,
    size: 18,
    font: fontBold,
    color: rgb(0.1, 0.1, 0.1),
  })
  y -= 35

  // Date
  page.drawText(`Getafe, a ${params.currentDate}`, {
    x: margin,
    y,
    size: 11,
    font,
    color: rgb(0.3, 0.3, 0.3),
  })
  y -= 30

  // Body text paragraphs
  const paragraphs = [
    `Por medio de la presente, la ${CLUB_NAME} (CIF: ${CIF}) hace constar que el jugador/a ${params.playerName}, nacido/a el ${formatDob(params.playerDob)}, perteneciente a nuestra escuela, tiene autorizacion para realizar una prueba en el club ${params.clubDestino} con fecha ${formatTrialDate(params.trialDate)}.`,
    `El tutor/a responsable, D/Da. ${params.tutorName}, ha sido informado/a y da su consentimiento para la realizacion de dicha prueba.`,
    `Se hace constar que, al expedir la presente carta de pruebas, el club se reserva el derecho de no ofrecer continuidad al jugador/a para la proxima temporada.`,
    `Asimismo, ${CLUB_NAME} no se hace responsable de las lesiones, accidentes o cualquier otro percance que pudiera producirse durante el periodo de prueba en las instalaciones del club de destino. La responsabilidad recae en el club organizador de la prueba y en los tutores legales del menor.`,
    `Se expide la presente carta a los efectos oportunos.`,
  ]

  for (const para of paragraphs) {
    const lines = wrapText(para, font, 11, maxWidth)
    for (const line of lines) {
      page.drawText(line, {
        x: margin,
        y,
        size: 11,
        font,
        color: rgb(0.15, 0.15, 0.15),
      })
      y -= 16
    }
    y -= 10 // paragraph spacing
  }

  // Signature area
  y -= 30
  page.drawText('Fdo.: La Direccion', {
    x: margin,
    y,
    size: 11,
    font: fontBold,
    color: rgb(0.2, 0.2, 0.2),
  })
  y -= 15
  page.drawText(CLUB_NAME, {
    x: margin,
    y,
    size: 10,
    font,
    color: rgb(0.4, 0.4, 0.4),
  })

  // Simulated signature scribble (simple lines)
  y -= 5
  const sigX = margin
  const sigY = y
  page.drawLine({ start: { x: sigX, y: sigY }, end: { x: sigX + 30, y: sigY - 8 }, thickness: 1.2, color: rgb(0.2, 0.2, 0.4) })
  page.drawLine({ start: { x: sigX + 30, y: sigY - 8 }, end: { x: sigX + 50, y: sigY + 3 }, thickness: 1.2, color: rgb(0.2, 0.2, 0.4) })
  page.drawLine({ start: { x: sigX + 50, y: sigY + 3 }, end: { x: sigX + 80, y: sigY - 5 }, thickness: 1.2, color: rgb(0.2, 0.2, 0.4) })
  page.drawLine({ start: { x: sigX + 80, y: sigY - 5 }, end: { x: sigX + 110, y: sigY + 2 }, thickness: 1, color: rgb(0.2, 0.2, 0.4) })
  page.drawLine({ start: { x: sigX + 110, y: sigY + 2 }, end: { x: sigX + 130, y: sigY - 3 }, thickness: 0.8, color: rgb(0.2, 0.2, 0.4) })

  // Footer
  const footerText = `${CLUB_NAME} — CIF: ${CIF}`
  const ftW = font.widthOfTextAtSize(footerText, 8)
  page.drawText(footerText, {
    x: (width - ftW) / 2,
    y: 40,
    size: 8,
    font,
    color: rgb(0.6, 0.6, 0.6),
  })

  const pdfBytes = await doc.save()
  return Buffer.from(pdfBytes)
}

function formatDob(dob: string): string {
  try {
    return new Intl.DateTimeFormat('es-ES', {
      day: '2-digit', month: 'long', year: 'numeric',
    }).format(new Date(dob))
  } catch {
    return dob
  }
}

function formatTrialDate(d: string): string {
  try {
    return new Intl.DateTimeFormat('es-ES', {
      day: '2-digit', month: 'long', year: 'numeric',
    }).format(new Date(d))
  } catch {
    return d
  }
}

function wrapText(text: string, font: { widthOfTextAtSize: (t: string, s: number) => number }, fontSize: number, maxWidth: number): string[] {
  const words = text.split(' ')
  const lines: string[] = []
  let current = ''

  for (const word of words) {
    const test = current ? `${current} ${word}` : word
    if (font.widthOfTextAtSize(test, fontSize) <= maxWidth) {
      current = test
    } else {
      if (current) lines.push(current)
      current = word
    }
  }
  if (current) lines.push(current)
  return lines
}
