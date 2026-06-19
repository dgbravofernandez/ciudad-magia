/**
 * /api/cron/enrich-federation
 *
 * Scraper de fichas NFG de federaciones de fútbol españolas.
 * Opera en 2 fases automáticas:
 *
 * Fase 1 — BUILD MAP:
 *   Para cada federación, descarga la lista de clubs (NFG_Clubes) y
 *   empareja los nombres con los clubs sin email de la BD.
 *   Guarda el código interno de la federación en marketing_clubs.federation_code.
 *
 * Fase 2 — FETCH EMAILS:
 *   Para clubs con federation_code pero sin email, descarga su ficha
 *   NFG_VerClub y extrae el email. Actualiza la BD.
 *
 * Cada ejecución del cron procesa ~40 clubs (≈120s a 3s/ficha).
 * El cron corre cada 20 min → ~120 clubs/hora → ~7.600 clubs en ~2.5 días.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

// ─── FEDERACIONES NFG ────────────────────────────────────────────────────────
const FEDERACIONES = [
  { key: 'FFCM',  name: 'FFCM Castilla LM',   list: 'https://www.ffcm.es/pnfg/NPcd/NFG_Clubes',                      ficha: 'https://www.ffcm.es/pnfg/NPcd/NFG_VerClub',                      cod: '1000118' },
  { key: 'RFAF',  name: 'RFAF Andalucia',      list: 'https://www.rfaf.es/pnfg/NPcd/NFG_Clubes',                      ficha: 'https://www.rfaf.es/pnfg/NPcd/NFG_VerClub',                      cod: '1000118' },
  { key: 'FFCV',  name: 'FFCV Valencia',       list: 'https://www.ffcv.es/pnfg/NPcd/NFG_Clubes',                      ficha: 'https://www.ffcv.es/pnfg/NPcd/NFG_VerClub',                      cod: '1000118' },
  { key: 'FEXF',  name: 'FEXF Extremadura',    list: 'https://www.fexfutbol.com/pnfg/NPcd/NFG_Clubes',                ficha: 'https://www.fexfutbol.com/pnfg/NPcd/NFG_VerClub',                cod: '1000118' },
  { key: 'IFCF',  name: 'IFCF Canarias',       list: 'https://www.federacioncanariafutbol.es/pnfg/NPcd/NFG_Clubes',   ficha: 'https://www.federacioncanariafutbol.es/pnfg/NPcd/NFG_VerClub',   cod: '1000118' },
  { key: 'FAF',   name: 'FAF Aragon',           list: 'https://www.futbolaragon.com/pnfg/NPcd/NFG_Clubes',             ficha: 'https://www.futbolaragon.com/pnfg/NPcd/NFG_VerClub',             cod: '1000118' },
  { key: 'FFRM',  name: 'FFRM Murcia',         list: 'https://www.ffrm.es/pnfg/NPcd/NFG_Clubes',                      ficha: 'https://www.ffrm.es/pnfg/NPcd/NFG_VerClub',                      cod: '3001859' },
  { key: 'FNF',   name: 'FNF Navarra',          list: 'https://www.futnavarra.es/pnfg/NPcd/NFG_LstEquipos',            ficha: 'https://www.futnavarra.es/pnfg/NPcd/NFG_VerClub',                cod: '1000119' },
  { key: 'FFPA',  name: 'FFPA Asturias',        list: 'https://www.asturfutbol.es/pnfg/NPcd/NFG_LstEquipos',           ficha: 'https://www.asturfutbol.es/pnfg/NPcd/NFG_VerClub',               cod: '1000119' },
  { key: 'FFIB',  name: 'FFIB Baleares',        list: 'https://www.ffib.es/Fed/NPcd/NFG_Clubes',                       ficha: 'https://www.ffib.es/Fed/NPcd/NFG_VerClub',                       cod: '1000108' },
  { key: 'FCYLF', name: 'FCYLF Castilla Leon',  list: 'https://www.rfcylf.es/pnfg/NPcd/NFG_LstEquipos',               ficha: 'https://www.rfcylf.es/pnfg/NPcd/NFG_VerClub',                    cod: '1000119' },
  { key: 'FCF',   name: 'FCF Cantabria',        list: 'https://www.rfcf.es/pnfg/NPcd/NFG_Clubes',                     ficha: 'https://www.rfcf.es/pnfg/NPcd/NFG_VerClub',                      cod: '1000118' },
  { key: 'FRF',   name: 'FRF La Rioja',         list: 'https://www.frfutbol.com/pnfg/NPcd/NFG_Clubes',                 ficha: 'https://www.frfutbol.com/pnfg/NPcd/NFG_VerClub',                  cod: '1000118' },
  { key: 'FGF',   name: 'FGF Galicia',          list: 'https://www.futgal.es/pnfg/NPcd/NFG_Clubes',                   ficha: 'https://www.futgal.es/pnfg/NPcd/NFG_VerClub',                    cod: '1000118' },
  { key: 'RFMF',  name: 'RFMF Melilla',         list: 'https://www.rfmf.es/pnfg/NPcd/NFG_Clubes',                     ficha: 'https://www.rfmf.es/pnfg/NPcd/NFG_VerClub',                      cod: '1000118' },
  { key: 'RFFM',  name: 'RFFM Madrid',          list: 'https://www.rffm.es/pnfg/NPcd/NFG_Clubes',                     ficha: 'https://www.rffm.es/pnfg/NPcd/NFG_VerClub',                      cod: '1000118' },
]

// ─── UTILS ────────────────────────────────────────────────────────────────────
const EMAIL_RE = /[\w.\-+]{2,}@[\w.\-]+\.[a-z]{2,6}/gi
const PHONE_RE = /(?:\+34[\s.]?)?(?:[67]\d{2}[\s.\-]?\d{3}[\s.\-]?\d{3}|[89]\d{2}[\s.\-]?\d{3}[\s.\-]?\d{3})/g
const EMAIL_BLACKLIST = new Set([
  'rfef.es','rfaf.es','ffcm.es','ffrm.es','futgal.es','futbolaragon.com',
  'ffib.es','federacioncanariafutbol.es','rfcf.es','frfutbol.com','fexfutbol.com',
  'rffm.es','rfmf.es','asturfutbol.es','futnavarra.es','rfcylf.es',
  'google.com','facebook.com','instagram.com','twitter.com','example.com',
  'sentry.io','wixpress.com','w3.org','schema.org',
])

function normName(s: string): string {
  return s.trim().toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ').trim()
}

function extractPhone(text: string): string | null {
  // Find Spanish phone numbers (mobile 6xx/7xx, fixed 8xx/9xx)
  const matches = [...text.matchAll(PHONE_RE)]
  for (const m of matches) {
    const digits = m[0].replace(/[\s.\-+]/g, '').replace(/^34/, '')
    if (digits.length === 9) return digits
  }
  return null
}

function extractEmails(text: string): string[] {
  const found: string[] = []
  const seen = new Set<string>()
  for (const m of text.matchAll(EMAIL_RE)) {
    const e = m[0].toLowerCase().replace(/[.,;:)>"']+$/, '')
    if (seen.has(e)) continue
    seen.add(e)
    const dom = e.split('@')[1]
    if (!dom) continue
    if (EMAIL_BLACKLIST.has(dom)) continue
    if (/\.(png|jpg|gif|css|js|webp)$/.test(dom)) continue
    if (e.includes('sentry') || e.includes('wixpress')) continue
    found.push(e)
  }
  return found
}

function sleep(ms: number) {
  return new Promise(r => setTimeout(r, ms))
}

// HTTP con gestión de cookies manual
async function fetchHtml(url: string, cookies = ''): Promise<{ html: string; cookies: string }> {
  const headers: Record<string, string> = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'es-ES,es;q=0.9',
    'Accept-Encoding': 'gzip, deflate',
    'Connection': 'keep-alive',
  }
  if (cookies) headers['Cookie'] = cookies

  const res = await fetch(url, { headers, redirect: 'follow', signal: AbortSignal.timeout(20_000) })
  const newCookies = res.headers.getSetCookie?.()?.join('; ') ?? ''
  const html = res.ok ? await res.text() : ''
  return { html, cookies: newCookies || cookies }
}

// Obtener session cookies visitando la base de la federación primero
async function getSession(baseUrl: string): Promise<string> {
  try {
    const { cookies } = await fetchHtml(baseUrl)
    return cookies
  } catch { return '' }
}

// Parsear la lista NFG y devolver { normName → {code, originalName} }
function parseNfgList(html: string): Map<string, { code: string; name: string }> {
  const map = new Map<string, { code: string; name: string }>()
  if (!html) return map

  // Tipo A: javascript:Ver(12345) en href
  const reA = /<a[^>]+href=["']javascript:Ver\((\d+)\)["'][^>]*>\s*([^<]+?)\s*<\/a>/gi
  for (const m of html.matchAll(reA)) {
    const code = m[1], name = m[2].trim()
    if (name && code) map.set(normName(name), { code, name })
  }

  // Tipo B: codigo_club= en href
  const reB = /<a[^>]+href=["'][^"']*codigo_club=(\d+)[^"']*["'][^>]*>\s*([^<]+?)\s*<\/a>/gi
  for (const m of html.matchAll(reB)) {
    const code = m[1], name = m[2].trim()
    if (name && code) map.set(normName(name), { code, name })
  }

  return map
}

// Parsear ficha NFG y extraer email + teléfono
function parseNfgFicha(html: string): { email: string | null; phone: string | null } {
  if (!html || html.length < 200) return { email: null, phone: null }

  let email: string | null = null

  // Estrategia 1: <h5> con label Email
  const h5Re = /<h5[^>]*>.*?<strong[^>]*>Email[^<]*<\/strong>([^<]*)<\/h5>/gi
  for (const m of html.matchAll(h5Re)) {
    const emails = extractEmails(m[1])
    if (emails.length) { email = emails[0]; break }
  }
  if (!email) {
    // Estrategia 2: La etiqueta y el valor pueden estar en nodos separados
    const emailLabelRe = /<strong[^>]*>[^<]*[Ee]mail[^<]*<\/strong>\s*([^<]{5,80})/gi
    for (const m of html.matchAll(emailLabelRe)) {
      const emails = extractEmails(m[1])
      if (emails.length) { email = emails[0]; break }
    }
  }
  if (!email) {
    // Estrategia 3: mailto:
    const mailtoRe = /href=["']mailto:([^"'?]+)/gi
    for (const m of html.matchAll(mailtoRe)) {
      const emails = extractEmails(m[1])
      if (emails.length) { email = emails[0]; break }
    }
  }
  if (!email) {
    // Estrategia 4: scan completo (solo zona de datos, no nav)
    const bodyStart = html.indexOf('<div') > 0 ? html.indexOf('<div') : 0
    const emails = extractEmails(html.slice(bodyStart, bodyStart + 30_000))
    if (emails.length) email = emails[0]
  }

  // Extraer teléfono: buscar cerca del label "Teléfono" o "Tlf" en la ficha
  let phone: string | null = null
  const phoneLabelRe = /<strong[^>]*>[^<]*(?:[Tt]el[eéf]|Tlf|Fono)[^<]*<\/strong>\s*([^<]{4,30})/gi
  for (const m of html.matchAll(phoneLabelRe)) {
    phone = extractPhone(m[1])
    if (phone) break
  }
  if (!phone) {
    // Fallback: scan zona de datos
    const bodyStart = html.indexOf('<div') > 0 ? html.indexOf('<div') : 0
    phone = extractPhone(html.slice(bodyStart, bodyStart + 30_000))
  }

  return { email, phone }
}

// ─── HANDLER ─────────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) return NextResponse.json({ error: 'Server misconfiguration' }, { status: 500 })
  const authHeader = req.headers.get('authorization')
  const isVercelCron = req.headers.get('x-vercel-cron') === '1'
  if (!isVercelCron && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const startMs = Date.now()
  const BUDGET_MS = 240_000  // 4 min, dentro del maxDuration de 5
  const BATCH_FICHAS = 40    // fichas por ejecución
  const SLEEP_FICHA = 3_000  // 3s entre fichas (respetuoso con los servidores)
  const SLEEP_LIST  = 1_500

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createAdminClient() as any
  const log = (msg: string) => console.log(`[enrich-federation] ${msg}`)

  const stats = { fedKey: '', phase: '', mapped: 0, found: 0, failed: 0, skipped: 0 }

  // ── DECIDIR QUÉ FEDERACIÓN PROCESAR ───────────────────────────────────────
  // Fase 0 (bootstrap): federaciones sin ningún club en BD → descargar lista e insertar
  // Fase 1 (map):       clubs sin federation_code → emparejar nombre con código
  // Fase 2 (email):     clubs con federation_code pero sin email → fetch ficha
  // Fase 3 (phone):     clubs con email + federation_code válido pero sin teléfono → fetch ficha

  const [{ data: countsRaw }, { data: phoneRaw }] = await Promise.all([
    sb
      .from('marketing_clubs')
      .select('federation, federation_code, status')
      .in('status', ['no_email'])
      .eq('excluded', false),
    // Fase 3: clubs con email pero sin teléfono y con federation_code real (no _checked)
    sb
      .from('marketing_clubs')
      .select('federation, federation_code')
      .neq('status', 'no_email')
      .not('federation_code', 'is', null)
      .not('federation_code', 'like', '%_checked%')
      .is('phone', null)
      .eq('excluded', false)
      .limit(2000),
  ])

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows = (countsRaw ?? []) as any[]
  const fedInDb = new Set(rows.map((r: { federation: string }) => r.federation))
  const fedStats: Record<string, { needsMap: number; needsEmail: number; needsPhone: number }> = {}
  for (const r of rows) {
    const f = r.federation as string
    if (!f) continue
    const known = FEDERACIONES.find(fed => fed.name === f)
    if (!known) continue
    if (!fedStats[known.key]) fedStats[known.key] = { needsMap: 0, needsEmail: 0, needsPhone: 0 }
    if (!r.federation_code) fedStats[known.key].needsMap++
    else fedStats[known.key].needsEmail++
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const r of (phoneRaw ?? []) as any[]) {
    const f = r.federation as string
    if (!f) continue
    const known = FEDERACIONES.find(fed => fed.name === f)
    if (!known) continue
    if (!fedStats[known.key]) fedStats[known.key] = { needsMap: 0, needsEmail: 0, needsPhone: 0 }
    fedStats[known.key].needsPhone++
  }

  // Prioridad 0: federación no está en BD en absoluto → bootstrap
  let chosenFed = FEDERACIONES.find(f => !fedInDb.has(f.name))
  let phase: 'bootstrap' | 'map' | 'email' | 'phone' = 'bootstrap'
  if (!chosenFed) {
    // Prioridad 1: mapear names → codes
    chosenFed = FEDERACIONES.find(f => (fedStats[f.key]?.needsMap ?? 0) > 0)
    phase = 'map'
  }
  if (!chosenFed) {
    // Prioridad 2: fetch emails
    chosenFed = FEDERACIONES.find(f => (fedStats[f.key]?.needsEmail ?? 0) > 0)
    phase = 'email'
  }
  if (!chosenFed) {
    // Prioridad 3: fetch teléfonos de clubs que ya tienen email
    chosenFed = FEDERACIONES.find(f => (fedStats[f.key]?.needsPhone ?? 0) > 0)
    phase = 'phone'
  }

  if (!chosenFed) {
    log('Nada que procesar — todos los clubs tienen email, teléfono o están mapeados')
    return NextResponse.json({ success: true, message: 'Nada pendiente', stats })
  }

  stats.fedKey = chosenFed.key
  stats.phase = phase
  log(`Procesando ${chosenFed.name} | fase: ${phase} | needsMap=${fedStats[chosenFed.key]?.needsMap ?? 0} | needsEmail=${fedStats[chosenFed.key]?.needsEmail ?? 0} | needsPhone=${fedStats[chosenFed.key]?.needsPhone ?? 0}`)

  // ── HELPER: descargar lista completa NFG ─────────────────────────────────
  async function downloadFedList() {
    const session = await getSession(chosenFed!.list)
    const fedMap = new Map<string, { code: string; name: string }>()
    let page = 1
    while (Date.now() - startMs < BUDGET_MS - 30_000) {
      const listUrl = `${chosenFed!.list}?cod_primaria=${chosenFed!.cod}&NPcd_PageLines=999&NPcd_Page=${page}&Buscar=1`
      const { html } = await fetchHtml(listUrl, session)
      if (!html || html.length < 500) break
      const pageMap = parseNfgList(html)
      if (pageMap.size === 0) break
      for (const [k, v] of pageMap) fedMap.set(k, v)
      log(`  Lista pág ${page}: ${pageMap.size} clubs`)
      if (pageMap.size < 50) break
      page++
      await sleep(SLEEP_LIST)
    }
    return fedMap
  }

  // ── FASE 0: BOOTSTRAP ─────────────────────────────────────────────────────
  // Federación sin ningún club en BD → descargar lista completa e insertar todos
  if (phase === 'bootstrap') {
    const fedMap = await downloadFedList()
    log(`Bootstrap ${chosenFed.name}: ${fedMap.size} clubs en federación`)

    if (fedMap.size === 0) {
      log('Lista vacía — federación no responde o no usa NFG estándar')
      return NextResponse.json({ success: true, message: 'Lista vacía', stats })
    }

    const toInsert: Record<string, string | boolean>[] = []
    for (const [, { code, name }] of fedMap) {
      toInsert.push({ name, federation: chosenFed.name, status: 'no_email', federation_code: code, excluded: false })
    }

    for (let i = 0; i < toInsert.length; i += 200) {
      const { error } = await sb.from('marketing_clubs').insert(toInsert.slice(i, i + 200))
      if (!error) stats.mapped += Math.min(200, toInsert.length - i)
      else log(`  Error batch insert ${i}: ${error.message}`)
    }
    log(`Insertados ${stats.mapped} clubs nuevos de ${chosenFed.name}`)
  }

  // ── FASE 1: CONSTRUIR MAPA ─────────────────────────────────────────────────
  if (phase === 'map') {
    const fedMap = await downloadFedList()
    log(`Mapa federación listo: ${fedMap.size} clubs`)

    const { data: dbClubs } = await sb
      .from('marketing_clubs')
      .select('id, name')
      .eq('federation', chosenFed.name)
      .eq('status', 'no_email')
      .is('federation_code', null)
      .limit(5000)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updates: { id: string; code: string }[] = []
    for (const c of (dbClubs ?? []) as any[]) {
      const norm = normName(c.name)
      let entry = fedMap.get(norm)

      if (!entry) {
        const stripped = norm.replace(/^(c\.?d\.?|a\.?d\.?|e\.?f\.?|u\.?d\.?|s\.?d\.?|r\.?c\.?d\.?|c\.?f\.?|s\.?c\.?d\.?|c\.?d\.?b\.?)\s+/, '')
        for (const [k, v] of fedMap) {
          if (k.endsWith(stripped) || stripped.endsWith(k.slice(-stripped.length + 3 > 0 ? -stripped.length + 3 : -1))) {
            entry = v; break
          }
        }
      }

      if (entry) updates.push({ id: c.id, code: entry.code })
    }

    for (let i = 0; i < updates.length; i += 100) {
      const batch = updates.slice(i, i + 100)
      for (const u of batch) {
        await sb.from('marketing_clubs').update({ federation_code: u.code }).eq('id', u.id)
      }
      stats.mapped += batch.length
    }
    log(`Mapeados: ${stats.mapped} / ${(dbClubs ?? []).length} clubs de BD`)
  }

  // ── FASE 2: FETCH EMAILS ──────────────────────────────────────────────────
  if (phase === 'email') {
    // Cargar batch de clubs con federation_code pero sin email
    const { data: toProcess } = await sb
      .from('marketing_clubs')
      .select('id, name, federation_code')
      .eq('federation', chosenFed.name)
      .eq('status', 'no_email')
      .not('federation_code', 'is', null)
      .eq('excluded', false)
      .limit(BATCH_FICHAS)

    log(`Fichas a procesar: ${(toProcess ?? []).length}`)

    const session = await getSession(chosenFed.ficha)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const club of (toProcess ?? []) as any[]) {
      if (Date.now() - startMs > BUDGET_MS) break

      const fichaUrl = `${chosenFed.ficha}?cod_primaria=${chosenFed.cod}&codigo_club=${club.federation_code}`
      try {
        const { html } = await fetchHtml(fichaUrl, session)
        const { email, phone } = parseNfgFicha(html)

        if (email) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const update: Record<string, any> = { email, status: 'pending', federation_code: club.federation_code }
          if (phone) update.phone = phone
          await sb.from('marketing_clubs').update(update).eq('id', club.id)
          stats.found++
          log(`  OK ${club.name.slice(0, 40)} → ${email}${phone ? ` | ${phone}` : ''}`)
        } else {
          // Si encontró teléfono aunque no email, guardarlo igualmente
          if (phone) {
            await sb.from('marketing_clubs')
              .update({ phone, federation_code: `${club.federation_code}_checked` })
              .eq('id', club.id)
          } else {
            await sb.from('marketing_clubs')
              .update({ federation_code: `${club.federation_code}_checked` })
              .eq('id', club.id)
          }
          stats.skipped++
        }
      } catch (e) {
        stats.failed++
        log(`  ERR ${club.name.slice(0, 40)}: ${(e as Error).message}`)
      }

      await sleep(SLEEP_FICHA + Math.random() * 1000)
    }

    log(`Emails encontrados: ${stats.found} | sin email: ${stats.skipped} | errores: ${stats.failed}`)
  }

  // ── FASE 3: FETCH TELÉFONOS (clubs con email pero sin teléfono) ───────────
  if (phase === 'phone') {
    const { data: toProcess } = await sb
      .from('marketing_clubs')
      .select('id, name, federation_code')
      .eq('federation', chosenFed.name)
      .neq('status', 'no_email')
      .not('federation_code', 'is', null)
      .not('federation_code', 'like', '%_checked%')
      .is('phone', null)
      .eq('excluded', false)
      .limit(BATCH_FICHAS)

    log(`Fichas para teléfono: ${(toProcess ?? []).length}`)

    const session = await getSession(chosenFed.ficha)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const club of (toProcess ?? []) as any[]) {
      if (Date.now() - startMs > BUDGET_MS) break

      const fichaUrl = `${chosenFed.ficha}?cod_primaria=${chosenFed.cod}&codigo_club=${club.federation_code}`
      try {
        const { html } = await fetchHtml(fichaUrl, session)
        const { phone } = parseNfgFicha(html)

        if (phone) {
          await sb.from('marketing_clubs')
            .update({ phone })
            .eq('id', club.id)
          stats.found++
          log(`  TEL ${club.name.slice(0, 40)} → ${phone}`)
        } else {
          // Marcar federation_code como ya comprobado para no repetir
          await sb.from('marketing_clubs')
            .update({ federation_code: `${club.federation_code}_checked` })
            .eq('id', club.id)
          stats.skipped++
        }
      } catch (e) {
        stats.failed++
        log(`  ERR ${club.name.slice(0, 40)}: ${(e as Error).message}`)
      }

      await sleep(SLEEP_FICHA + Math.random() * 1000)
    }

    log(`Teléfonos encontrados: ${stats.found} | sin teléfono: ${stats.skipped} | errores: ${stats.failed}`)
  }

  const elapsed = ((Date.now() - startMs) / 1000).toFixed(1)
  log(`Completado en ${elapsed}s`)

  return NextResponse.json({
    success: true,
    stats,
    elapsed: `${elapsed}s`,
    remaining: {
      needsMap: fedStats[chosenFed.key]?.needsMap ?? 0,
      needsEmail: fedStats[chosenFed.key]?.needsEmail ?? 0,
      needsPhone: fedStats[chosenFed.key]?.needsPhone ?? 0,
    },
  })
}
