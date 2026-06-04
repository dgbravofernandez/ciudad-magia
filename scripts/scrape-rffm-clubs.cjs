/* ──────────────────────────────────────────────────────────────────────────
 * RFFM clubs scraper — extrae los ~696 clubes federados con contacto real.
 *
 * Fuente: https://www.rffm.es/_next/data/{buildId}/competicion/clubes.json?p=N
 *         https://www.rffm.es/_next/data/{buildId}/fichaclub/{codigo}.json
 *
 * Uso:
 *   node scripts/scrape-rffm-clubs.cjs              → scrape completo (35 páginas)
 *   node scripts/scrape-rffm-clubs.cjs --limit 2    → solo las 2 primeras páginas (40 clubes)
 *   node scripts/scrape-rffm-clubs.cjs --resume     → reanudar desde scrape parcial (si existe)
 *
 * Output: actualiza docs/marketing/Seguimiento-Clubes-Cluberly.xlsx hoja "Seguimiento".
 *         Dedup por nombre normalizado; conserva fila de Ciudad de Getafe (Cliente).
 *         Conserva las fórmulas COUNTIF de la hoja "Resumen".
 * ────────────────────────────────────────────────────────────────────────── */

const fs = require('fs')
const path = require('path')
const XLSX = require('xlsx')

const BASE = 'https://www.rffm.es'
const UA = 'Mozilla/5.0 (compatible; CluberlyScraper/1.0; +https://cluberly.vercel.app)'
const RATE_LIMIT_MS = 400       // ~400ms entre requests (conservador, ~3 req/s)
const TIMEOUT_MS = 15_000
const XLSX_PATH = path.join(__dirname, '..', 'docs', 'marketing', 'Seguimiento-Clubes-Cluberly.xlsx')
const PROGRESS_PATH = path.join(__dirname, '..', '_tmp', 'rffm-scrape-progress.json')

// ── CLI args ──────────────────────────────────────────────────────────────
const args = process.argv.slice(2)
const LIMIT_PAGES = (() => {
  const i = args.indexOf('--limit')
  return i >= 0 ? parseInt(args[i + 1], 10) : null
})()
const RESUME = args.includes('--resume')

// ── Util ──────────────────────────────────────────────────────────────────
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

function decodeEntities(s) {
  if (typeof s !== 'string') return ''
  return s.replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>')
}

function firstPhone(raw) {
  if (!raw) return ''
  const cleaned = decodeEntities(raw).replace(/\(.*?\)/g, '').trim()
  // Buscar el primer número español de 9 dígitos (puede llevar +34 delante)
  const m = cleaned.match(/(?:\+?34\s*)?([6-9]\d{2}[\s.-]?\d{3}[\s.-]?\d{3})/)
  return m ? m[1].replace(/[\s.-]/g, '') : ''
}

function normalizeWeb(raw) {
  let s = decodeEntities(raw || '').trim()
  if (!s) return ''
  // Corrige formatos raros del directorio RFFM tipo "www://dominio.com" o "www.://"
  s = s.replace(/^www:\/\//i, 'www.').replace(/^https?:\/\/www:\/\//i, 'https://www.')
  if (/^https?:\/\//i.test(s)) return s
  if (/^www\./i.test(s)) return 'https://' + s
  if (s.includes('.')) return 'https://' + s
  return s
}

function normalizeName(s) {
  return (s || '').toString()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

let lastRequestAt = 0
async function waitRateLimit() {
  const now = Date.now()
  const elapsed = now - lastRequestAt
  if (elapsed < RATE_LIMIT_MS) await sleep(RATE_LIMIT_MS - elapsed)
  lastRequestAt = Date.now()
}

// ── BuildId ───────────────────────────────────────────────────────────────
async function getBuildId() {
  const res = await fetch(`${BASE}/`, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(TIMEOUT_MS) })
  const html = await res.text()
  const m = html.match(/"buildId"\s*:\s*"([^"]+)"/)
  if (!m) throw new Error('No se pudo extraer buildId del HTML raíz')
  return m[1]
}

// ── Fetchers ──────────────────────────────────────────────────────────────
async function fetchJSON(url, retries = 3) {
  for (let i = 1; i <= retries; i++) {
    await waitRateLimit()
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': UA, 'Accept': 'application/json' },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      })
      if (res.status === 429 || res.status === 503) {
        const wait = i * 5000
        console.warn(`[rffm] HTTP ${res.status} en ${url} → esperando ${wait}ms`)
        await sleep(wait)
        continue
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return await res.json()
    } catch (err) {
      if (i === retries) throw err
      await sleep(2 ** i * 1000)
    }
  }
}

async function getPage(buildId, p) {
  const url = `${BASE}/_next/data/${buildId}/competicion/clubes.json?p=${p}`
  const data = await fetchJSON(url)
  return {
    clubs: data.pageProps?.clubs?.clubes ?? [],
    totalPages: data.pageProps?.totalPages ?? 1,
  }
}

async function getFicha(buildId, codigo) {
  const url = `${BASE}/_next/data/${buildId}/fichaclub/${codigo}.json`
  const data = await fetchJSON(url)
  return data.pageProps?.club ?? null
}

// ── Excel update ──────────────────────────────────────────────────────────
const HEADERS = [
  'Club', 'Ubicación', 'Web', 'Email', 'Teléfono', 'Deporte / Federación',
  'Estado', 'Persona contacto', 'Fecha 1er contacto', 'Emails enviados',
  'Fecha último contacto', 'Próxima acción', 'Fecha próx. acción', 'Notas',
]

function buildRowFromClub(c) {
  // c contiene: nombre, codigo, localidad, provincia, total_equipos, portal_web,
  // email_correspondencia, telefonos, domicilio, codigo_postal, presidente, facebook, instagram
  const ubic = [c.localidad, c.provincia].filter(Boolean).join(', ').trim() || 'Madrid'
  const web = normalizeWeb(c.portal_web)
  const email = decodeEntities(c.email_correspondencia || '').trim() || 'verificar'
  const tel = firstPhone(c.telefonos) || 'verificar'
  const equipos = c.equipos_club?.length || c.total_equipos || ''
  const notas = [
    equipos ? `${equipos} equipos` : '',
    c.presidente ? `Pres: ${decodeEntities(c.presidente)}` : '',
    c.facebook ? `FB:${c.facebook}` : '',
    c.instagram ? `IG:${c.instagram}` : '',
  ].filter(Boolean).join(' · ').slice(0, 140)
  return [
    decodeEntities(c.nombre_club || c.nombre || ''),
    ubic, web || 'verificar', email, tel, 'Fútbol · RFFM',
    'Nuevo', '', '', '0', '', 'Enviar Email 1', '', notas,
  ]
}

function updateXlsx(allFichas) {
  if (!fs.existsSync(XLSX_PATH)) {
    throw new Error(`No existe ${XLSX_PATH}. Ejecuta primero scripts/gen-tracker.cjs.`)
  }
  const wb = XLSX.readFile(XLSX_PATH)
  const seg = wb.Sheets['Seguimiento']
  if (!seg) throw new Error('Hoja "Seguimiento" no encontrada en el Excel')

  // Leer filas existentes (preservando cabecera + ejemplos previos)
  const existing = XLSX.utils.sheet_to_json(seg, { header: 1, defval: '' })
  const existingHeader = existing[0]
  const existingRows = existing.slice(1).filter((r) => r[0]) // filas con club

  // Index por nombre normalizado
  const byName = new Map()
  existingRows.forEach((row, idx) => byName.set(normalizeName(row[0]), idx))

  // Procesar fichas: si existe → actualizar campos vacíos; si no → añadir
  let added = 0
  let updated = 0
  let preservedClient = 0

  for (const ficha of allFichas) {
    const newRow = buildRowFromClub(ficha)
    const key = normalizeName(newRow[0])
    if (byName.has(key)) {
      // Existe — completar solo campos vacíos / "verificar"; NUNCA tocar fila Cliente
      const idx = byName.get(key)
      const cur = existingRows[idx]
      const isClient = (cur[6] || '').toString().toLowerCase() === 'cliente'
      if (isClient) { preservedClient++; continue }
      // Completar Ubicación, Web, Email, Teléfono, Notas si están vacíos o "verificar"
      let wasUpdated = false
      const FILL = [1, 2, 3, 4, 13] // índices: Ubicación, Web, Email, Teléfono, Notas
      for (const i of FILL) {
        const v = (cur[i] || '').toString().trim()
        if (!v || v === 'verificar' || v.startsWith('verificar')) {
          if (newRow[i] && newRow[i] !== 'verificar') { cur[i] = newRow[i]; wasUpdated = true }
        }
      }
      if (wasUpdated) updated++
    } else {
      existingRows.push(newRow)
      byName.set(key, existingRows.length - 1)
      added++
    }
  }

  // Reescribir hoja Seguimiento (cabecera + filas)
  const newRows = [existingHeader, ...existingRows]
  const newSeg = XLSX.utils.aoa_to_sheet(newRows)
  newSeg['!cols'] = seg['!cols']  // preservar anchos
  newSeg['!autofilter'] = { ref: `A1:N1` }
  newSeg['!freeze'] = { xSplit: 0, ySplit: 1 }
  wb.Sheets['Seguimiento'] = newSeg

  // El Resumen sigue funcionando: COUNTIF sobre Seguimiento!G:G no depende de número de filas
  XLSX.writeFile(wb, XLSX_PATH)
  return { added, updated, preservedClient, total: existingRows.length }
}

// ── Main ──────────────────────────────────────────────────────────────────
;(async () => {
  fs.mkdirSync(path.dirname(PROGRESS_PATH), { recursive: true })
  console.log('[rffm] obteniendo buildId…')
  const buildId = await getBuildId()
  console.log(`[rffm] buildId: ${buildId}`)

  // Cargar progreso anterior si --resume
  let progress = { fichas: [], lastPage: 0, lastClub: null }
  if (RESUME && fs.existsSync(PROGRESS_PATH)) {
    progress = JSON.parse(fs.readFileSync(PROGRESS_PATH, 'utf8'))
    console.log(`[rffm] resume: ${progress.fichas.length} fichas previas, última página ${progress.lastPage}`)
  }

  // Sacar lista de páginas
  const { totalPages } = await getPage(buildId, 1)
  const maxPage = LIMIT_PAGES ? Math.min(LIMIT_PAGES, totalPages) : totalPages
  console.log(`[rffm] totalPages: ${totalPages}, procesando ${maxPage}`)

  // Recolectar lista de clubes (paginado)
  const allClubsList = []
  for (let p = 1; p <= maxPage; p++) {
    process.stdout.write(`[rffm] página ${p}/${maxPage}… `)
    const { clubs } = await getPage(buildId, p)
    allClubsList.push(...clubs)
    console.log(`+${clubs.length} (total ${allClubsList.length})`)
  }

  // Filtrar los que ya estén en progress (si --resume)
  const doneCodes = new Set(progress.fichas.map((f) => f.codigo))
  const pending = allClubsList.filter((c) => !doneCodes.has(c.codigo_club))
  console.log(`[rffm] fichas pendientes: ${pending.length} (ya teníamos ${progress.fichas.length})`)

  // Recorrer fichas — guardando progreso cada 25
  let errors = 0
  for (let i = 0; i < pending.length; i++) {
    const c = pending[i]
    try {
      const ficha = await getFicha(buildId, c.codigo_club)
      if (ficha) {
        progress.fichas.push({
          codigo: c.codigo_club,
          nombre: ficha.nombre_club || c.nombre,
          localidad: ficha.localidad || c.localidad,
          provincia: ficha.provincia || c.provincia,
          total_equipos: c.total_equipos,
          portal_web: ficha.portal_web,
          email_correspondencia: ficha.email_correspondencia,
          telefonos: ficha.telefonos,
          domicilio: ficha.domicilio,
          codigo_postal: ficha.codigo_postal,
          presidente: ficha.presidente,
          facebook: ficha.facebook,
          instagram: ficha.instagram,
          equipos_club: ficha.equipos_club ? ficha.equipos_club.length : null,
        })
      }
    } catch (err) {
      errors++
      console.warn(`  [error] ${c.codigo_club} ${c.nombre}: ${err.message}`)
    }
    if ((i + 1) % 25 === 0 || i === pending.length - 1) {
      fs.writeFileSync(PROGRESS_PATH, JSON.stringify(progress, null, 2))
      process.stdout.write(`\r[rffm] fichas: ${progress.fichas.length}/${allClubsList.length} (errores: ${errors})        `)
    }
  }
  console.log('')

  // Estadísticas
  const withEmail = progress.fichas.filter((f) => f.email_correspondencia && f.email_correspondencia.trim()).length
  const withPhone = progress.fichas.filter((f) => firstPhone(f.telefonos)).length
  const withWeb = progress.fichas.filter((f) => f.portal_web && f.portal_web.trim()).length
  console.log(`[rffm] resultados: ${progress.fichas.length} clubes · ${withEmail} con email · ${withPhone} con teléfono · ${withWeb} con web · ${errors} errores`)

  // Actualizar Excel
  console.log('[rffm] actualizando Excel…')
  const stats = updateXlsx(progress.fichas)
  console.log(`[rffm] Excel OK · ${stats.added} clubes nuevos · ${stats.updated} actualizados · ${stats.preservedClient} cliente preservado · total filas: ${stats.total}`)
  console.log(`[rffm] HECHO. Excel actualizado en: ${XLSX_PATH}`)
})().catch((err) => {
  console.error('[rffm] FATAL:', err.message)
  process.exit(1)
})
