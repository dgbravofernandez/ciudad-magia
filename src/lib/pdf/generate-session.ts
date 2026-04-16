import { PDFDocument, PDFFont, PDFPage, StandardFonts, rgb } from 'pdf-lib'

interface SessionExerciseInput {
  slot_order: number
  notes: string | null
  duration_min: number | null
  exercise: {
    title: string
    description: string | null
    canvas_image_url: string | null
    category_name?: string | null
  } | null
}

interface SessionPdfParams {
  clubName: string
  clubLogoUrl: string | null
  teamName: string
  sessionTypeLabel: string
  sessionDate: string // ISO yyyy-mm-dd
  startTime: string | null
  endTime: string | null
  microcycle: string | null
  macrocycle: string | null
  sessionNumber: number | null
  opponent: string | null
  notes: string | null
  objectives: string[]
  exercises: SessionExerciseInput[]
}

const COLOR = {
  text: rgb(0.1, 0.1, 0.1),
  muted: rgb(0.4, 0.4, 0.4),
  accent: rgb(1.0, 0.8, 0.0), // amarillo Ciudad Magia
  divider: rgb(0.85, 0.85, 0.85),
  cardBg: rgb(0.97, 0.97, 0.97),
} as const

// pdf-lib's Helvetica uses WinAnsi encoding; replace characters that are
// not representable to avoid runtime errors on user-entered text.
function sanitize(input: string): string {
  return input
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/\u2013|\u2014/g, '-')
    .replace(/\u2026/g, '...')
    .replace(/[\u0000-\u0008\u000B-\u001F]/g, '')
}

function wrapText(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const words = sanitize(text).split(/\s+/)
  const lines: string[] = []
  let current = ''
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word
    if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
      current = candidate
    } else {
      if (current) lines.push(current)
      current = word
    }
  }
  if (current) lines.push(current)
  return lines
}

async function fetchImageBytes(url: string): Promise<{ bytes: Uint8Array; format: 'png' | 'jpg' } | null> {
  try {
    if (url.startsWith('data:')) {
      const match = url.match(/^data:image\/(png|jpeg|jpg);base64,(.+)$/i)
      if (!match) return null
      const format = match[1].toLowerCase() === 'png' ? 'png' : 'jpg'
      const buf = Buffer.from(match[2], 'base64')
      return { bytes: new Uint8Array(buf), format }
    }
    const res = await fetch(url)
    if (!res.ok) return null
    const ab = await res.arrayBuffer()
    const ct = (res.headers.get('content-type') ?? '').toLowerCase()
    const format: 'png' | 'jpg' = ct.includes('png') ? 'png' : 'jpg'
    return { bytes: new Uint8Array(ab), format }
  } catch {
    return null
  }
}

function formatSessionDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat('es-ES', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    }).format(new Date(iso))
  } catch {
    return iso
  }
}

export async function generateSessionPDF(params: SessionPdfParams): Promise<Buffer> {
  const doc = await PDFDocument.create()
  const font = await doc.embedFont(StandardFonts.Helvetica)
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold)

  const pageWidth = 595
  const pageHeight = 842
  const margin = 45
  const contentWidth = pageWidth - margin * 2

  let page = doc.addPage([pageWidth, pageHeight])
  let y = pageHeight - margin

  function ensureSpace(needed: number) {
    if (y - needed < margin) {
      page = doc.addPage([pageWidth, pageHeight])
      y = pageHeight - margin
    }
  }

  function drawText(
    text: string,
    opts: { x?: number; size?: number; bold?: boolean; color?: ReturnType<typeof rgb> } = {},
  ) {
    const size = opts.size ?? 11
    const f = opts.bold ? fontBold : font
    page.drawText(sanitize(text), {
      x: opts.x ?? margin,
      y,
      size,
      font: f,
      color: opts.color ?? COLOR.text,
    })
  }

  // ---------- Header (logo top-left + club name) ----------
  let headerLogoHeight = 0
  if (params.clubLogoUrl) {
    const img = await fetchImageBytes(params.clubLogoUrl)
    if (img) {
      try {
        const embedded = img.format === 'png'
          ? await doc.embedPng(img.bytes)
          : await doc.embedJpg(img.bytes)
        const targetH = 55
        const ratio = embedded.width / embedded.height
        const targetW = Math.min(targetH * ratio, 110)
        page.drawImage(embedded, {
          x: margin,
          y: y - targetH,
          width: targetW,
          height: targetH,
        })
        headerLogoHeight = targetH
      } catch {
        // ignore logo errors; fallback to text only
      }
    }
  }

  // Right-side header text
  const headerRightX = margin + (headerLogoHeight ? 130 : 0)
  page.drawText(sanitize(params.clubName), {
    x: headerRightX,
    y: y - 14,
    size: 14,
    font: fontBold,
    color: COLOR.text,
  })
  page.drawText('Plan de sesion', {
    x: headerRightX,
    y: y - 30,
    size: 10,
    font,
    color: COLOR.muted,
  })

  y -= Math.max(headerLogoHeight, 36) + 12

  page.drawLine({
    start: { x: margin, y },
    end: { x: pageWidth - margin, y },
    thickness: 1.2,
    color: COLOR.accent,
  })
  y -= 22

  // ---------- Title ----------
  const titleText = 'PLAN DE SESION'
  const titleSize = 18
  const titleW = fontBold.widthOfTextAtSize(titleText, titleSize)
  page.drawText(titleText, {
    x: (pageWidth - titleW) / 2,
    y,
    size: titleSize,
    font: fontBold,
    color: COLOR.text,
  })
  y -= 26

  // ---------- Metadata block ----------
  const metaRows: Array<[string, string]> = [
    ['Equipo', params.teamName],
    ['Tipo', params.sessionTypeLabel],
    ['Fecha', formatSessionDate(params.sessionDate)],
  ]
  if (params.startTime || params.endTime) {
    metaRows.push([
      'Horario',
      `${params.startTime ?? '--:--'} - ${params.endTime ?? '--:--'}`,
    ])
  }
  if (params.macrocycle) metaRows.push(['Macrociclo', params.macrocycle])
  if (params.microcycle) metaRows.push(['Microciclo', params.microcycle])
  if (params.sessionNumber != null) metaRows.push(['Nº de sesion', String(params.sessionNumber)])
  if (params.opponent) metaRows.push(['Rival', params.opponent])

  const metaCardPadding = 12
  const metaLineH = 16
  const metaH = metaRows.length * metaLineH + metaCardPadding * 2
  ensureSpace(metaH + 12)
  page.drawRectangle({
    x: margin,
    y: y - metaH,
    width: contentWidth,
    height: metaH,
    color: COLOR.cardBg,
    borderColor: COLOR.divider,
    borderWidth: 0.5,
  })
  let rowY = y - metaCardPadding - 11
  for (const [label, value] of metaRows) {
    page.drawText(sanitize(`${label}:`), {
      x: margin + metaCardPadding,
      y: rowY,
      size: 10,
      font: fontBold,
      color: COLOR.muted,
    })
    page.drawText(sanitize(value), {
      x: margin + metaCardPadding + 95,
      y: rowY,
      size: 11,
      font,
      color: COLOR.text,
    })
    rowY -= metaLineH
  }
  y -= metaH + 18

  // ---------- Objectives ----------
  if (params.objectives.length > 0) {
    ensureSpace(40)
    drawText('OBJETIVOS', { size: 12, bold: true, color: COLOR.accent })
    y -= 18
    for (const obj of params.objectives) {
      const lines = wrapText(`• ${obj}`, font, 11, contentWidth - 12)
      for (const ln of lines) {
        ensureSpace(14)
        drawText(ln, { x: margin + 6, size: 11 })
        y -= 14
      }
    }
    y -= 8
  }

  // ---------- Notes ----------
  if (params.notes) {
    ensureSpace(40)
    drawText('NOTAS', { size: 12, bold: true, color: COLOR.accent })
    y -= 18
    const lines = wrapText(params.notes, font, 11, contentWidth)
    for (const ln of lines) {
      ensureSpace(14)
      drawText(ln, { size: 11 })
      y -= 14
    }
    y -= 8
  }

  // ---------- Exercises ----------
  if (params.exercises.length > 0) {
    ensureSpace(40)
    drawText('EJERCICIOS', { size: 12, bold: true, color: COLOR.accent })
    y -= 22

    const ordered = [...params.exercises].sort((a, b) => a.slot_order - b.slot_order)
    for (const item of ordered) {
      if (!item.exercise) continue

      // Pre-compute exercise card height to avoid splitting it across pages
      const titleStr = `${item.slot_order}. ${item.exercise.title}`
      const titleLines = wrapText(titleStr, fontBold, 12, contentWidth - 24)
      const description = item.exercise.description ?? ''
      const descLines = description ? wrapText(description, font, 10, contentWidth - 24) : []
      const hasImage = !!item.exercise.canvas_image_url
      const imageH = hasImage ? 180 : 0
      const metaLine = item.duration_min ? 14 : 0
      const cardH =
        16 /* top padding */ +
        titleLines.length * 14 +
        metaLine +
        (descLines.length ? 4 + descLines.length * 12 : 0) +
        (hasImage ? 8 + imageH : 0) +
        16 /* bottom padding */

      ensureSpace(cardH + 12)

      const cardTop = y
      page.drawRectangle({
        x: margin,
        y: y - cardH,
        width: contentWidth,
        height: cardH,
        color: COLOR.cardBg,
        borderColor: COLOR.divider,
        borderWidth: 0.5,
      })
      page.drawRectangle({
        x: margin,
        y: y - cardH,
        width: 4,
        height: cardH,
        color: COLOR.accent,
      })

      let cy = cardTop - 16
      for (const ln of titleLines) {
        page.drawText(sanitize(ln), {
          x: margin + 14,
          y: cy,
          size: 12,
          font: fontBold,
          color: COLOR.text,
        })
        cy -= 14
      }
      if (item.duration_min) {
        page.drawText(`Duracion: ${item.duration_min} min`, {
          x: margin + 14,
          y: cy,
          size: 9,
          font,
          color: COLOR.muted,
        })
        cy -= 14
      }
      if (descLines.length) {
        cy -= 4
        for (const ln of descLines) {
          page.drawText(sanitize(ln), {
            x: margin + 14,
            y: cy,
            size: 10,
            font,
            color: COLOR.text,
          })
          cy -= 12
        }
      }
      if (hasImage) {
        cy -= 8
        const img = await fetchImageBytes(item.exercise.canvas_image_url!)
        if (img) {
          try {
            const embedded = img.format === 'png'
              ? await doc.embedPng(img.bytes)
              : await doc.embedJpg(img.bytes)
            const maxW = contentWidth - 28
            const ratio = embedded.width / embedded.height
            let w = imageH * ratio
            let h = imageH
            if (w > maxW) {
              w = maxW
              h = w / ratio
            }
            page.drawImage(embedded, {
              x: margin + 14,
              y: cy - h,
              width: w,
              height: h,
            })
          } catch {
            // skip image on failure
          }
        }
      }

      y = cardTop - cardH - 12
    }
  }

  // ---------- Footer (date generated) ----------
  const generatedAt = new Intl.DateTimeFormat('es-ES', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date())
  const footerText = `Generado el ${generatedAt}`
  const totalPages = doc.getPageCount()
  for (let i = 0; i < totalPages; i++) {
    const p = doc.getPage(i)
    p.drawText(sanitize(footerText), {
      x: margin,
      y: 22,
      size: 8,
      font,
      color: COLOR.muted,
    })
    p.drawText(`Pagina ${i + 1} / ${totalPages}`, {
      x: pageWidth - margin - 60,
      y: 22,
      size: 8,
      font,
      color: COLOR.muted,
    })
  }

  const bytes = await doc.save()
  return Buffer.from(bytes)
}
