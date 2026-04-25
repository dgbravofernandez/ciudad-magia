import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'

const CLUB_NAME = 'Escuela de Futbol Ciudad de Getafe'

export interface RffmSignalReportParams {
  nombreJugador: string
  nombreEquipo: string
  nombreCompeticion: string
  nombreGrupo: string
  goles: number
  partidosJugados: number
  golesPenalti: number
  golesPorPartido: number
  divisionLevel: number
  valorScore: number
  anioNacimiento: number | null
  codjugador: string
  generatedBy: string
  generatedAt: string
}

export async function generateRffmSignalPDF(p: RffmSignalReportParams): Promise<Buffer> {
  const doc = await PDFDocument.create()
  const page = doc.addPage([595, 842]) // A4
  const font = await doc.embedFont(StandardFonts.Helvetica)
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold)

  const { width, height } = page.getSize()
  const margin = 50
  let y = height - margin

  // ── Header band ──────────────────────────────────────────────
  page.drawRectangle({
    x: 0, y: height - 70, width, height: 70,
    color: rgb(0.07, 0.20, 0.43),
  })
  page.drawText('INFORME DE SCOUTING', {
    x: margin, y: height - 40,
    size: 18, font: fontBold, color: rgb(1, 1, 1),
  })
  page.drawText('Real Federacion de Futbol de Madrid', {
    x: margin, y: height - 58,
    size: 9, font, color: rgb(0.85, 0.88, 0.95),
  })

  const headerRight = `${formatDate(p.generatedAt)}`
  const hrW = font.widthOfTextAtSize(headerRight, 9)
  page.drawText(headerRight, {
    x: width - margin - hrW, y: height - 40,
    size: 9, font, color: rgb(0.85, 0.88, 0.95),
  })

  y = height - 100

  // ── Player name (large) ──────────────────────────────────────
  page.drawText(p.nombreJugador, {
    x: margin, y,
    size: 22, font: fontBold, color: rgb(0.1, 0.1, 0.1),
  })
  y -= 22

  if (p.anioNacimiento) {
    const age = new Date().getFullYear() - p.anioNacimiento
    page.drawText(`Año ${p.anioNacimiento}  ·  ${age} años`, {
      x: margin, y,
      size: 11, font, color: rgb(0.4, 0.4, 0.4),
    })
    y -= 18
  } else {
    y -= 4
  }

  // ── Team / competition box ──────────────────────────────────
  y -= 10
  page.drawRectangle({
    x: margin, y: y - 60, width: width - margin * 2, height: 60,
    color: rgb(0.96, 0.97, 0.99), borderColor: rgb(0.85, 0.88, 0.95), borderWidth: 1,
  })
  page.drawText('EQUIPO', { x: margin + 12, y: y - 14, size: 8, font: fontBold, color: rgb(0.4, 0.4, 0.4) })
  page.drawText(p.nombreEquipo, { x: margin + 12, y: y - 30, size: 12, font: fontBold, color: rgb(0.1, 0.1, 0.1) })
  page.drawText(`${p.nombreCompeticion}  ·  ${p.nombreGrupo}`, {
    x: margin + 12, y: y - 47, size: 9, font, color: rgb(0.4, 0.4, 0.4),
  })
  y -= 80

  // ── Stats grid (4 boxes) ────────────────────────────────────
  const boxW = (width - margin * 2 - 30) / 4
  const boxH = 70
  const stats: Array<[string, string, [number, number, number]]> = [
    ['GOLES',    String(p.goles),                                [0.85, 0.32, 0.20]],
    ['PARTIDOS', String(p.partidosJugados),                      [0.20, 0.40, 0.85]],
    ['G/PJ',     p.golesPorPartido.toFixed(2),                   [0.30, 0.65, 0.30]],
    ['VALOR',    p.valorScore.toFixed(1),                        [0.55, 0.30, 0.75]],
  ]
  stats.forEach(([label, val, [r,g,b]], i) => {
    const x = margin + i * (boxW + 10)
    page.drawRectangle({
      x, y: y - boxH, width: boxW, height: boxH,
      color: rgb(1, 1, 1), borderColor: rgb(0.88, 0.90, 0.93), borderWidth: 1,
    })
    page.drawRectangle({ x, y: y - 4, width: boxW, height: 4, color: rgb(r, g, b) })
    page.drawText(label, {
      x: x + 12, y: y - 22, size: 8, font: fontBold, color: rgb(0.4, 0.4, 0.4),
    })
    const valW = fontBold.widthOfTextAtSize(val, 24)
    page.drawText(val, {
      x: x + (boxW - valW) / 2, y: y - 55, size: 24, font: fontBold, color: rgb(r, g, b),
    })
  })
  y -= boxH + 25

  // ── Detail rows ──────────────────────────────────────────────
  const rows: Array<[string, string]> = [
    ['Goles de penalti',   String(p.golesPenalti)],
    ['Goles a balon parado/jugada', String(Math.max(0, p.goles - p.golesPenalti))],
    ['Nivel division (1-10)', `${p.divisionLevel}`],
    ['Codigo RFFM jugador', p.codjugador],
    ['Ficha publica',       `https://www.rffm.es/fichajugador/${p.codjugador}`],
  ]
  for (const [label, value] of rows) {
    page.drawText(label, { x: margin, y, size: 10, font, color: rgb(0.4, 0.4, 0.4) })
    page.drawText(value, { x: margin + 200, y, size: 10, font: fontBold, color: rgb(0.15, 0.15, 0.15) })
    y -= 16
  }

  // ── Interpretation block ─────────────────────────────────────
  y -= 15
  page.drawText('VALORACION', { x: margin, y, size: 9, font: fontBold, color: rgb(0.4, 0.4, 0.4) })
  y -= 14

  const interp = buildInterpretation(p)
  for (const line of wrapText(interp, font, 10, width - margin * 2)) {
    page.drawText(line, { x: margin, y, size: 10, font, color: rgb(0.15, 0.15, 0.15) })
    y -= 14
  }

  // ── Footer ───────────────────────────────────────────────────
  page.drawLine({
    start: { x: margin, y: 60 }, end: { x: width - margin, y: 60 },
    thickness: 0.5, color: rgb(0.85, 0.85, 0.85),
  })
  page.drawText(`Generado por ${p.generatedBy} · ${CLUB_NAME}`, {
    x: margin, y: 45, size: 8, font, color: rgb(0.5, 0.5, 0.5),
  })
  page.drawText('Datos extraidos de www.rffm.es — Informacion publica', {
    x: margin, y: 33, size: 7, font, color: rgb(0.6, 0.6, 0.6),
  })

  const bytes = await doc.save()
  return Buffer.from(bytes)
}

function buildInterpretation(p: RffmSignalReportParams): string {
  const ratio = p.golesPorPartido
  const tier =
    p.valorScore >= 12 ? 'EXCEPCIONAL' :
    p.valorScore >= 8  ? 'MUY ALTO' :
    p.valorScore >= 5  ? 'ALTO' :
    p.valorScore >= 3  ? 'INTERESANTE' : 'A SEGUIR'

  const ratioDesc =
    ratio >= 2 ? 'absolutamente dominante' :
    ratio >= 1.2 ? 'goleador prolifico' :
    ratio >= 0.8 ? 'rendimiento ofensivo notable' :
    'aportacion goleadora a confirmar'

  const divDesc =
    p.divisionLevel >= 8 ? 'maxima categoria autonomica' :
    p.divisionLevel >= 6 ? 'primera categoria' :
    p.divisionLevel >= 4 ? 'segunda categoria' :
    'categoria regional'

  const penaltiNote = p.goles > 0 && (p.golesPenalti / p.goles) > 0.4
    ? ` Conviene contextualizar: ${p.golesPenalti} de sus ${p.goles} goles son de penalti.`
    : ''

  return `Perfil ${tier}. Promedio de ${ratio.toFixed(2)} goles por partido en ${divDesc}, lo que se considera un ${ratioDesc} para su categoria.${penaltiNote} Recomendacion: ${tier === 'EXCEPCIONAL' || tier === 'MUY ALTO' ? 'observacion presencial prioritaria.' : 'mantener seguimiento durante las proximas jornadas.'}`
}

function formatDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat('es-ES', {
      day: '2-digit', month: 'long', year: 'numeric',
    }).format(new Date(iso))
  } catch { return iso }
}

function wrapText(text: string, font: { widthOfTextAtSize: (t: string, s: number) => number }, size: number, maxWidth: number): string[] {
  const words = text.split(' ')
  const lines: string[] = []
  let cur = ''
  for (const w of words) {
    const test = cur ? `${cur} ${w}` : w
    if (font.widthOfTextAtSize(test, size) <= maxWidth) cur = test
    else { if (cur) lines.push(cur); cur = w }
  }
  if (cur) lines.push(cur)
  return lines
}
