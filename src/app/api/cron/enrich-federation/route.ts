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

// Parsear la lista NFG y devolver { normName → codigo_club }
function parseNfgList(html: string): Map<string, string> {
  const map = new Map<string, string>()
  if (!html) return map

  // Tipo A: javascript:Ver(12345) en href
  const reA = /<a[^>]+href=["']javascript:Ver\((\d+)\)["'][^>]*>\s*([^<]+?)\s*<\/a>/gi
  for (const m of html.matchAll(reA)) {
    const code = m[1], name = m[2].trim()
    if (name && code) map.set(normName(name), code)
  }

  // Tipo B: codigo_club= en href
  const reB = /<a[^>]+href=["'][^"']*codigo_club=(\d+)[^"']*["'][^>]*>\s*([^<]+?)\s*<\/a>/gi
  for (const m of html.matchAll(reB)) {
    const code = m[1], name = m[2].trim()
    if (name && code) map.set(normName(name), code)
  }

  return map
}

// Parsear ficha NFG y extraer email
function parseNfgFicha(html: string): string | null {
  if (!html || html.length < 200) return null

  // Estrategia 1: <h5> con label Email
  const h5Re = /<h5[^>]*>.*?<strong[^>]*>Email[^<]*<\/strong>([^<]*)<\/h5>/gi
  for (const m of html.matchAll(h5Re)) {
    const emails = extractEmails(m[1])
    if (emails.length) return emails[0]
  }
  // Estrategia 2: La etiqueta y el valor pueden estar en nodos separados
  const emailLabelRe = /<strong[^>]*>[^<]*[Ee]mail[^<]*<\/strong>\s*([^<]{5,80})/gi
  for (const m of html.matchAll(emailLabelRe)) {
    const emails = extractEmails(m[1])
    if (emails.length) return emails[0]
  }
  // Estrategia 3: mailto:
  const mailtoRe = /href=["']mailto:([^"'?]+)/gi
  for (const m of html.matchAll(mailtoRe)) {
    const emails = extractEmails(m[1])
    if (emails.length) return emails[0]
  }
  // Estrategia 4: scan completo (solo zona de datos, no nav)
  const bodyStart = html.indexOf('<div') > 0 ? html.indexOf('<div') : 0
  const emails = extractEmails(html.slice(bodyStart, bodyStart + 30_000))
  return emails.length ? emails[0] : null
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
  // Primero las que tienen clubs sin federation_code (Fase 1)
  // Luego las que tienen federation_code pero sin email (Fase 2)

  // Contar clubes pendientes por federación
  const { data: countsRaw } = await sb
    .from('marketing_clubs')
    .select('federation, federation_code, status')
    .in('status', ['no_email'])
    .eq('excluded', false)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows = (countsRaw ?? []) as any[]
  const fedStats: Record<string, { needsMap: number; needsEmail: number }> = {}
  for (const r of rows) {
    const f = r.federation as string
    if (!f) continue
    const known = FEDERACIONES.find(fed => fed.name === f)
    if (!known) continue
    if (!fedStats[known.key]) fedStats[known.key] = { needsMap: 0, needsEmail: 0 }
    if (!r.federation_code) fedStats[known.key].needsMap++
    else fedStats[known.key].needsEmail++
  }

  // Elegir: primero fase 1 (mapear), luego fase 2 (emails)
  let chosenFed = FEDERACIONES.find(f => (fedStats[f.key]?.needsMap ?? 0) > 0)
  let phase: 'map' | 'email' = 'map'
  if (!chosenFed) {
    chosenFed = FEDERACIONES.find(f => (fedStats[f.key]?.needsEmail ?? 0) > 0)
    phase = 'email'
  }

  if (!chosenFed) {
    log('Nada que procesar — todos los clubs tienen email o están mapeados')
    return NextResponse.json({ success: true, message: 'Nada pendiente', stats })
  }

  stats.fedKey = chosenFed.key
  stats.phase = phase
  log(`Procesando ${chosenFed.name} | fase: ${phase} | needsMap=${fedStats[chosenFed.key]?.needsMap ?? 0} | needsEmail=${fedStats[chosenFed.key]?.needsEmail ?? 0}`)

  // ── FASE 1: CONSTRUIR MAPA ─────────────────────────────────────────────────
  if (phase === 'map') {
    const session = await getSession(chosenFed.list)
    const fedMap = new Map<string, string>()

    // Cargar todas las páginas del listado
    let page = 1
    while (Date.now() - startMs < BUDGET_MS - 30_000) {
      const listUrl = `${chosenFed.list}?cod_primaria=${chosenFed.cod}&NPcd_PageLines=999&NPcd_Page=${page}&Buscar=1`
      const { html } = await fetchHtml(listUrl, session)
      if (!html || html.length < 500) break
      const pageMap = parseNfgList(html)
      if (pageMap.size === 0) break
      for (const [k, v] of pageMap) fedMap.set(k, v)
      log(`  Lista pág ${page}: ${pageMap.size} clubs (total mapeado: ${fedMap.size})`)
      if (pageMap.size < 50) break  // última página
      page++
      await sleep(SLEEP_LIST)
    }

    log(`Mapa federación listo: ${fedMap.size} clubs`)

    // Cargar clubs sin federation_code de esta federación
    const { data: dbClubs } = await sb
      .from('marketing_clubs')
      .select('id, name')
      .eq('federation', chosenFed.name)
      .eq('status', 'no_email')
      .is('federation_code', null)
      .limit(5000)

    // Emparejar y actualizar en lotes
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updates: { id: string; code: string }[] = []
    for (const c of (dbClubs ?? []) as any[]) {
      const norm = normName(c.name)
      let code = fedMap.get(norm)

      // Fallback: variantes sin prefijo (C.D., A.D., etc.)
      if (!code) {
        const stripped = norm.replace(/^(c\.?d\.?|a\.?d\.?|e\.?f\.?|u\.?d\.?|s\.?d\.?|r\.?c\.?d\.?|c\.?f\.?|s\.?c\.?d\.?|c\.?d\.?b\.?)\s+/, '')
        for (const [k, v] of fedMap) {
          if (k.endsWith(stripped) || stripped.endsWith(k.slice(-stripped.length + 3 > 0 ? -stripped.length + 3 : -1))) {
            code = v; break
          }
        }
      }

      if (code) updates.push({ id: c.id, code })
    }

    // Actualizar en lotes de 100
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
        const email = parseNfgFicha(html)

        if (email) {
          await sb.from('marketing_clubs')
            .update({ email, status: 'pending', federation_code: club.federation_code })
            .eq('id', club.id)
          stats.found++
          log(`  OK ${club.name.slice(0, 40)} → ${email}`)
        } else {
          // Marcar con código negativo para no reprocesar (sin email en ficha)
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

    log(`Emails encontrados: ${stats.found} | sin email: ${stats.skipped} | errores: ${stats.failed}`)
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
    },
  })
}
