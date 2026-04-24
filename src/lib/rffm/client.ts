// ──────────────────────────────────────────────────────────────
// RFFM HTTP client
// • Caches buildId (1h TTL) — refreshes on 404
// • Rate limits: 800ms between requests, sequential
// • Retry: 3 attempts, exponential backoff 2s/4s/8s
// ──────────────────────────────────────────────────────────────

const BASE_URL = 'https://www.rffm.es'
const RATE_LIMIT_MS = 800
const MAX_RETRIES = 3

// ── BuildId cache ──────────────────────────────────────────────

let cachedBuildId: string | null = null
let buildIdFetchedAt: number | null = null
const BUILD_ID_TTL_MS = 60 * 60 * 1000  // 1 hour

async function getBuildId(): Promise<string> {
  const now = Date.now()
  if (
    cachedBuildId &&
    buildIdFetchedAt &&
    now - buildIdFetchedAt < BUILD_ID_TTL_MS
  ) {
    return cachedBuildId
  }
  return refreshBuildId()
}

async function refreshBuildId(): Promise<string> {
  const res = await fetch(`${BASE_URL}/`, { headers: { 'User-Agent': 'Mozilla/5.0' } })
  const html = await res.text()
  const match = html.match(/"buildId"\s*:\s*"([^"]+)"/)
  if (!match) throw new Error('RFFM: no se pudo extraer buildId del HTML')
  cachedBuildId = match[1]
  buildIdFetchedAt = Date.now()
  return cachedBuildId
}

// ── Rate limiting (simple sequential queue) ───────────────────

let lastRequestAt = 0

async function waitRateLimit(): Promise<void> {
  const now = Date.now()
  const elapsed = now - lastRequestAt
  if (elapsed < RATE_LIMIT_MS) {
    await sleep(RATE_LIMIT_MS - elapsed)
  }
  lastRequestAt = Date.now()
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// ── Core SSR fetch ─────────────────────────────────────────────

/**
 * Fetches a Next.js SSR JSON endpoint from RFFM.
 * path: e.g. "competicion/calendario" or "acta-partido/5464590"
 * params: query string parameters
 */
export async function fetchRffmSSR<T>(
  path: string,
  params?: Record<string, string>
): Promise<T> {
  const qs = params ? '?' + new URLSearchParams(params).toString() : ''

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    await waitRateLimit()

    const buildId = await getBuildId()
    const url = `${BASE_URL}/_next/data/${buildId}/${path}.json${qs}`

    let res: Response
    try {
      res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; CiudadMagia/1.0)',
          'Accept': 'application/json',
        },
        // 15s timeout
        signal: AbortSignal.timeout(15_000),
      })
    } catch (err) {
      if (attempt === MAX_RETRIES) throw new Error(`RFFM fetch error (${path}): ${err}`)
      await sleep(2 ** attempt * 1000)
      continue
    }

    // BuildId expired → refresh and retry immediately
    if (res.status === 404) {
      await refreshBuildId()
      continue
    }

    if (!res.ok) {
      if (attempt === MAX_RETRIES) {
        throw new Error(`RFFM HTTP ${res.status} for ${path}`)
      }
      await sleep(2 ** attempt * 1000)
      continue
    }

    const json = await res.json()
    return json.pageProps as T
  }

  throw new Error(`RFFM: max retries exceeded for ${path}`)
}

/**
 * Fetches a direct /api/* endpoint from RFFM (for competition/group enumeration).
 */
export async function fetchRffmAPI<T>(
  apiPath: string,
  params?: Record<string, string>
): Promise<T> {
  const qs = params ? '?' + new URLSearchParams(params).toString() : ''

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    await waitRateLimit()

    const url = `${BASE_URL}/api/${apiPath}${qs}`

    let res: Response
    try {
      res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; CiudadMagia/1.0)',
          'Accept': 'application/json',
        },
        signal: AbortSignal.timeout(15_000),
      })
    } catch (err) {
      if (attempt === MAX_RETRIES) throw new Error(`RFFM API error (${apiPath}): ${err}`)
      await sleep(2 ** attempt * 1000)
      continue
    }

    if (!res.ok) {
      if (attempt === MAX_RETRIES) throw new Error(`RFFM API HTTP ${res.status} for ${apiPath}`)
      await sleep(2 ** attempt * 1000)
      continue
    }

    return res.json() as Promise<T>
  }

  throw new Error(`RFFM: max retries exceeded for api/${apiPath}`)
}
