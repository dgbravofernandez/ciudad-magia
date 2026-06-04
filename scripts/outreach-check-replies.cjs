/* ──────────────────────────────────────────────────────────────────────────
 * Outreach IMAP — marca como "Respondió" los clubes que han contestado.
 *
 * Flujo:
 *   1. Conecta a imap.gmail.com:993 con tu Gmail + App Password.
 *   2. Carga el Excel y crea un set con los emails a los que escribimos
 *      (filas con Estado ∈ {Email 1, Email 2, Email 3}).
 *   3. Busca emails NO LEÍDOS en INBOX cuya dirección emisora esté en ese set.
 *   4. Para cada match:
 *      · Marca la fila como Estado = "Respondió".
 *      · Añade en Notas: "Respondió dd/mm".
 *      · Marca el email como leído en Gmail (para no procesarlo dos veces).
 *
 * Uso:
 *   node scripts/outreach-check-replies.cjs              → procesa
 *   node scripts/outreach-check-replies.cjs --dry-run    → solo lista matches, no marca nada
 *
 * Requiere .env.outreach con GMAIL_USER + GMAIL_APP_PASSWORD.
 * ────────────────────────────────────────────────────────────────────────── */

const fs = require('fs')
const path = require('path')
const XLSX = require('xlsx')
const { ImapFlow } = require('imapflow')

// ── .env.outreach loader ──────────────────────────────────────────────────
const ENV_PATH = path.join(__dirname, '..', '.env.outreach')
if (fs.existsSync(ENV_PATH)) {
  fs.readFileSync(ENV_PATH, 'utf8').split('\n').forEach((line) => {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)\s*=\s*(.*)$/)
    if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
  })
}

const args = process.argv.slice(2)
const DRY_RUN = args.includes('--dry-run')

const XLSX_PATH = path.join(__dirname, '..', 'docs', 'marketing', 'Seguimiento-Clubes-Cluberly.xlsx')

const ENGAGED_STATES = new Set(['Email 1', 'Email 2', 'Email 3'])

// ── Util ──────────────────────────────────────────────────────────────────
function todayShort() {
  const d = new Date()
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`
}

function normalizeEmail(s) {
  if (!s) return ''
  // "Foo Bar <foo@bar.com>" → "foo@bar.com"
  const m = s.match(/<([^>]+)>/)
  const addr = m ? m[1] : s
  return addr.trim().toLowerCase()
}

// ── Main ──────────────────────────────────────────────────────────────────
;(async () => {
  if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
    console.error('[replies] ERROR: faltan GMAIL_USER y/o GMAIL_APP_PASSWORD en .env.outreach')
    process.exit(1)
  }

  // 1. Cargar Excel
  const wb = XLSX.readFile(XLSX_PATH)
  const seg = wb.Sheets['Seguimiento']
  if (!seg) throw new Error('Hoja "Seguimiento" no encontrada')
  const rows = XLSX.utils.sheet_to_json(seg, { header: 1, defval: '' })
  const data = rows.slice(1)

  const COL = {
    club: 0, ubicacion: 1, web: 2, email: 3, telefono: 4, deporte: 5,
    estado: 6, persona: 7, fecha1: 8, emails_enviados: 9,
    fecha_ult: 10, prox_accion: 11, fecha_prox: 12, notas: 13,
  }

  // Construir map: email_lowercase → idx en data[]
  const byEmail = new Map()
  data.forEach((row, idx) => {
    const estado = (row[COL.estado] || '').toString().trim()
    if (!ENGAGED_STATES.has(estado)) return
    const e = (row[COL.email] || '').toString().trim().toLowerCase()
    if (e && e.includes('@')) byEmail.set(e, idx)
  })

  console.log(`[replies] clubes con outreach activo en Excel: ${byEmail.size}`)
  if (byEmail.size === 0) {
    console.log('[replies] no hay nadie a quien escuchar todavía. Lanza primero scripts/outreach-send.cjs.')
    return
  }

  // 2. Conectar IMAP
  const client = new ImapFlow({
    host: process.env.IMAP_HOST || 'imap.gmail.com',
    port: parseInt(process.env.IMAP_PORT || '993', 10),
    secure: true,
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASSWORD,
    },
    logger: false,
  })

  try {
    await client.connect()
  } catch (err) {
    console.error('[replies] ERROR conectando IMAP:', err.message)
    console.error('           ¿Está activado IMAP en Gmail (Configuración → Reenvío y POP/IMAP)?')
    process.exit(1)
  }
  console.log('[replies] ✓ IMAP conectado')

  let lock
  let matches = 0
  let processed = 0
  try {
    lock = await client.getMailboxLock('INBOX')

    // 3. Buscar TODOS los no-leídos (Gmail no permite filtrar por múltiples emails)
    const unseen = await client.search({ seen: false })
    console.log(`[replies] mensajes no leídos en INBOX: ${unseen?.length || 0}`)

    if (!unseen || unseen.length === 0) {
      console.log('[replies] nada que procesar.')
      return
    }

    // 4. Por cada mensaje, comparar emisor con nuestro set
    for await (const msg of client.fetch(unseen, { envelope: true, uid: true, source: false })) {
      const from = msg.envelope?.from?.[0]
      if (!from) continue
      const fromEmail = normalizeEmail(`${from.mailbox}@${from.host}`)
      if (!byEmail.has(fromEmail)) continue

      const idx = byEmail.get(fromEmail)
      const row = data[idx]
      const club = row[COL.club]
      const noteAdd = `Respondió ${todayShort()}`
      const currentNotes = (row[COL.notas] || '').toString().trim()

      matches++

      if (DRY_RUN) {
        console.log(`  [DRY] ${fromEmail} (${club}) → marcaría Respondió`)
      } else {
        row[COL.estado] = 'Respondió'
        row[COL.fecha_ult] = `${String(new Date().getDate()).padStart(2, '0')}/${String(new Date().getMonth() + 1).padStart(2, '0')}/${new Date().getFullYear()}`
        row[COL.prox_accion] = 'Contestar / agendar demo'
        row[COL.notas] = currentNotes ? `${currentNotes} · ${noteAdd}` : noteAdd

        // Marcar el email como leído en Gmail (por UID)
        try {
          await client.messageFlagsAdd({ uid: msg.uid }, ['\\Seen'], { uid: true })
        } catch (err) {
          console.warn(`  [warn] no pude marcar UID ${msg.uid} como leído: ${err.message}`)
        }
        console.log(`  ✓ ${fromEmail} (${club}) → Respondió`)
        processed++
      }
    }
  } finally {
    if (lock) lock.release()
    await client.logout()
  }

  // 5. Guardar Excel si hubo cambios
  if (!DRY_RUN && processed > 0) {
    const newSeg = XLSX.utils.aoa_to_sheet(rows)
    newSeg['!cols'] = seg['!cols']
    newSeg['!autofilter'] = { ref: `A1:N1` }
    newSeg['!freeze'] = { xSplit: 0, ySplit: 1 }
    wb.Sheets['Seguimiento'] = newSeg
    XLSX.writeFile(wb, XLSX_PATH)
    console.log('')
    console.log(`[replies] HECHO. ${processed} respuestas marcadas. Excel actualizado.`)
  } else if (DRY_RUN) {
    console.log('')
    console.log(`[replies] DRY-RUN COMPLETO: habría marcado ${matches} respuestas.`)
  } else if (matches === 0) {
    console.log('[replies] no hay respuestas nuevas.')
  }
})().catch((err) => {
  console.error('[replies] FATAL:', err.message)
  process.exit(1)
})
