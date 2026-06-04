/* ──────────────────────────────────────────────────────────────────────────
 * Outreach SMTP — envía emails de captación leyendo el Excel de seguimiento.
 *
 * Flujo:
 *   1. Lee docs/marketing/Seguimiento-Clubes-Cluberly.xlsx hoja "Seguimiento".
 *   2. Para cada fila con Estado ∈ {Nuevo, Email 1, Email 2} y Email válido:
 *      · Envía el template correspondiente (Email 1 / 2 / 3).
 *      · Actualiza la fila: Estado avanza, Fecha último contacto, Emails +1.
 *   3. Cap diario configurable (default 30, límite Gmail SMTP sin Workspace).
 *   4. Delay aleatorio 30-60s entre envíos (entregabilidad).
 *
 * Configuración (.env.outreach, NO commitear):
 *   GMAIL_USER=tu@gmail.com
 *   GMAIL_APP_PASSWORD=xxxx xxxx xxxx xxxx  (App Password de Gmail, requiere 2FA)
 *   FROM_NAME=Diego — Cluberly  (opcional)
 *
 * Uso:
 *   node scripts/outreach-send.cjs --dry-run         → simula sin enviar, imprime los 5 primeros
 *   node scripts/outreach-send.cjs --max 3           → envía solo 3 emails reales (test)
 *   node scripts/outreach-send.cjs                   → envía hasta 30 emails (default cap)
 *   node scripts/outreach-send.cjs --max 30          → envía hasta 30 emails
 *   node scripts/outreach-send.cjs --no-delay        → SIN delay entre envíos (peligroso, solo dry-run)
 * ────────────────────────────────────────────────────────────────────────── */

const fs = require('fs')
const path = require('path')
const XLSX = require('xlsx')

// ── .env.outreach loader (sin dependencia externa) ────────────────────────
const ENV_PATH = path.join(__dirname, '..', '.env.outreach')
if (fs.existsSync(ENV_PATH)) {
  fs.readFileSync(ENV_PATH, 'utf8').split('\n').forEach((line) => {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)\s*=\s*(.*)$/)
    if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
  })
}

// ── CLI args ──────────────────────────────────────────────────────────────
const args = process.argv.slice(2)
const DRY_RUN = args.includes('--dry-run')
const NO_DELAY = args.includes('--no-delay')
const MAX = (() => {
  const i = args.indexOf('--max')
  return i >= 0 ? parseInt(args[i + 1], 10) : 30
})()

const XLSX_PATH = path.join(__dirname, '..', 'docs', 'marketing', 'Seguimiento-Clubes-Cluberly.xlsx')

// ── Constants ─────────────────────────────────────────────────────────────
const STATE_NEW = 'Nuevo'
const STATE_E1 = 'Email 1'
const STATE_E2 = 'Email 2'
const STATE_E3 = 'Email 3'

const NEXT_STATE = {
  [STATE_NEW]: STATE_E1,
  [STATE_E1]: STATE_E2,
  [STATE_E2]: STATE_E3,
}

// ── Templates (extraídos de docs/marketing/emails-captacion.md) ───────────
const TEMPLATES = {
  [STATE_NEW]: {
    subject: ({ club }) => `Las cuotas de ${club}`,
    body: ({ nombre, club }) => `Hola ${nombre},

Te escribo directo: ¿cuántas horas a la semana se van en perseguir cuotas por
WhatsApp y cuadrar inscripciones en Excel en ${club}?

La E.F. Ciudad de Getafe tenía el mismo lío con 280 jugadores. Desde que usan
Cluberly, los recordatorios de cuota se envían solos y cobran el 95% sin tener
que llamar a nadie. La secretaría recuperó unas 6 horas a la semana.

Cluberly es un sistema pensado para clubes españoles: jugadores, cuotas,
asistencia, comunicaciones y contabilidad, en un solo sitio. Sin Excel.

¿Te viene bien que te lo enseñe en una llamada de 20 minutos esta semana?
Si lo prefieres, te paso acceso de prueba gratis 14 días y lo ves tú mismo.

Un saludo,
Diego — Cluberly
cluberly.vercel.app
`,
  },
  [STATE_E1]: {
    subject: ({ club }) => `Re: Las cuotas de ${club}`,
    body: ({ nombre }) => `Hola ${nombre},

Vuelvo a este por si se quedó en el tintero.

Lo que más valoran los clubes que usan Cluberly es esto: el día 5 de cada mes,
el sistema envía solo el aviso a las familias con cuota pendiente. Sin perseguir,
sin incomodar, sin que la secretaría pierda la mañana.

Y si una familia ya pagó, lo marca con un clic y deja de recibir avisos.

¿Te enseño cómo funciona en 20 minutos? Tú dime día y hora.

Un saludo,
Diego — Cluberly
`,
  },
  [STATE_E2]: {
    subject: ({ club }) => `¿Cierro la ficha de ${club}?`,
    body: ({ nombre }) => `Hola ${nombre},

No quiero ser pesado, así que este es mi último correo.

Te dejo dos cosas por si en algún momento os viene bien:

1. Prueba gratis 14 días, sin tarjeta: cluberly.vercel.app
2. Si migráis desde Excel, os paso yo mismo todos vuestros datos sin coste.

Si ahora no es el momento, sin problema — aquí me tienes cuando queráis dar el
salto. Mucho ánimo con la temporada.

Un saludo,
Diego — Cluberly
`,
  },
}

// ── Util ──────────────────────────────────────────────────────────────────
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

function todayStr() {
  const d = new Date()
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const yyyy = d.getFullYear()
  return `${dd}/${mm}/${yyyy}`
}

function randDelayMs() {
  return 30_000 + Math.floor(Math.random() * 30_000)  // 30-60s
}

function isValidEmail(s) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test((s || '').trim())
}

function extractContactName(club, persona) {
  if (persona && persona.trim()) return persona.split(/\s+/)[0]
  // Si no hay persona, usar "equipo de [club]" → demasiado largo. Mejor "hola" sin nombre.
  // Pero el template usa "Hola {nombre}," así que devuelvo "equipo" como fallback razonable.
  return 'equipo'
}

// ── Excel I/O ─────────────────────────────────────────────────────────────
function loadSheet() {
  const wb = XLSX.readFile(XLSX_PATH)
  const seg = wb.Sheets['Seguimiento']
  if (!seg) throw new Error('Hoja "Seguimiento" no encontrada')
  const rows = XLSX.utils.sheet_to_json(seg, { header: 1, defval: '' })
  return { wb, seg, rows }
}

function saveSheet(wb, rows) {
  const newSeg = XLSX.utils.aoa_to_sheet(rows)
  newSeg['!cols'] = wb.Sheets['Seguimiento']['!cols']
  newSeg['!autofilter'] = { ref: `A1:N1` }
  newSeg['!freeze'] = { xSplit: 0, ySplit: 1 }
  wb.Sheets['Seguimiento'] = newSeg
  XLSX.writeFile(wb, XLSX_PATH)
}

// ── Main ──────────────────────────────────────────────────────────────────
;(async () => {
  // Validar config solo si NO es dry-run
  if (!DRY_RUN) {
    if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
      console.error('[outreach] ERROR: faltan GMAIL_USER y/o GMAIL_APP_PASSWORD en .env.outreach')
      console.error('           Crea el archivo a partir de .env.outreach.example')
      process.exit(1)
    }
  }

  const { wb, rows } = loadSheet()
  const header = rows[0]
  const data = rows.slice(1)

  // Columnas (índices en header)
  const COL = {
    club: 0, ubicacion: 1, web: 2, email: 3, telefono: 4, deporte: 5,
    estado: 6, persona: 7, fecha1: 8, emails_enviados: 9,
    fecha_ult: 10, prox_accion: 11, fecha_prox: 12, notas: 13,
  }

  // Cola de candidatos
  const queue = []
  data.forEach((row, idx) => {
    if (!row[COL.club]) return
    const estado = (row[COL.estado] || '').toString().trim()
    if (!NEXT_STATE[estado]) return       // estado no procesable (Cliente, Respondió, etc.)
    const email = (row[COL.email] || '').toString().trim()
    if (!isValidEmail(email)) return       // sin email válido
    queue.push({ idx, row, estado, email })
  })

  console.log(`[outreach] candidatos: ${queue.length}`)
  console.log(`[outreach] modo: ${DRY_RUN ? 'DRY-RUN (no envía)' : 'REAL'} · max envíos: ${MAX} · delay: ${NO_DELAY ? 'NO' : '30-60s'}`)
  console.log('')

  // Preparar transporter solo si NO dry-run
  let transporter = null
  if (!DRY_RUN) {
    const nodemailer = require('nodemailer')
    transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD,
      },
    })
    try {
      await transporter.verify()
      console.log('[outreach] ✓ SMTP Gmail conectado correctamente')
    } catch (err) {
      console.error('[outreach] ERROR conectando a Gmail SMTP:', err.message)
      console.error('           Comprueba que tienes 2FA activado y la App Password es válida.')
      process.exit(1)
    }
    console.log('')
  }

  const fromName = process.env.FROM_NAME || 'Diego — Cluberly'
  const fromEmail = process.env.GMAIL_USER || 'diego@cluberly.app'

  let sent = 0
  let errors = 0

  for (const item of queue) {
    if (sent >= MAX) {
      console.log(`[outreach] alcanzado max=${MAX}, parando`)
      break
    }

    const club = item.row[COL.club]
    const persona = item.row[COL.persona]
    const nombre = extractContactName(club, persona)
    const tmpl = TEMPLATES[item.estado]
    const ctx = { club, nombre }
    const subject = tmpl.subject(ctx)
    const body = tmpl.body(ctx)

    if (DRY_RUN) {
      if (sent < 5) {
        console.log(`─── [${sent + 1}] DRY-RUN ───────────────────────────────────────`)
        console.log(`Para: ${item.email} (${club})`)
        console.log(`Estado actual: ${item.estado} → ${NEXT_STATE[item.estado]}`)
        console.log(`Asunto: ${subject}`)
        console.log(`Cuerpo (primeros 200 chars):`)
        console.log('  ' + body.slice(0, 200).split('\n').join('\n  ') + '...')
        console.log('')
      }
      sent++
      continue
    }

    // ENVÍO REAL
    try {
      await transporter.sendMail({
        from: `"${fromName}" <${fromEmail}>`,
        to: item.email,
        subject,
        text: body,
        replyTo: fromEmail,
      })
      sent++
      // Actualizar fila in-memory
      item.row[COL.estado] = NEXT_STATE[item.estado]
      item.row[COL.fecha_ult] = todayStr()
      if (item.estado === STATE_NEW) item.row[COL.fecha1] = todayStr()
      item.row[COL.emails_enviados] = String((parseInt(item.row[COL.emails_enviados], 10) || 0) + 1)
      item.row[COL.prox_accion] = NEXT_STATE[NEXT_STATE[item.estado]]
        ? `Enviar ${NEXT_STATE[NEXT_STATE[item.estado]]}`
        : 'Esperar respuesta'
      console.log(`[${sent}/${Math.min(MAX, queue.length)}] ✓ ${item.email} (${club.slice(0, 35)}) — ${item.estado} → ${NEXT_STATE[item.estado]}`)
    } catch (err) {
      errors++
      console.error(`[${sent + errors}] ✗ ${item.email} (${club.slice(0, 35)}): ${err.message}`)
      continue
    }

    // Guardar Excel cada 5 envíos (resistente a interrupción)
    if (sent % 5 === 0) {
      saveSheet(wb, rows)
    }

    // Delay aleatorio
    if (sent < MAX && !NO_DELAY) {
      const wait = randDelayMs()
      process.stdout.write(`  esperando ${Math.round(wait / 1000)}s antes del siguiente…\r`)
      await sleep(wait)
      process.stdout.write(''.padEnd(60) + '\r')
    }
  }

  // Guardar Excel final
  if (!DRY_RUN && sent > 0) {
    saveSheet(wb, rows)
    console.log('')
    console.log(`[outreach] HECHO. Enviados: ${sent} · errores: ${errors}`)
    console.log(`[outreach] Excel actualizado. Recuerda correr scripts/outreach-check-replies.cjs en unas horas para marcar respuestas.`)
  } else if (DRY_RUN) {
    console.log('')
    console.log(`[outreach] DRY-RUN COMPLETO: habría enviado ${sent} emails.`)
    console.log(`[outreach] Para enviar de verdad: quita --dry-run.`)
  } else {
    console.log('[outreach] No hay emails que enviar.')
  }
})().catch((err) => {
  console.error('[outreach] FATAL:', err.message)
  process.exit(1)
})
