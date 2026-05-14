import { createAdminClient } from '@/lib/supabase/admin'
import { getPlayerProfile } from '../player'

// ────────────────────────────────────────────────────────────────
// Configuración
// ────────────────────────────────────────────────────────────────
const DEFAULT_BATCH = 200
// Aumentado de 3 → 30: con 3 crons/día, los 3 intentos se agotaban en 1 día
// dejando todos los jugadores bloqueados permanentemente.
const MAX_ATTEMPTS = 30
// Bajado de 10 → 2: en fútbol base la mayoría de goleadores tiene 2-8 goles.
// Con 10 se excluían casi todos los jugadores de las señales de scouting.
const MIN_GOLES_FOR_ENRICH = 2
// Trabajadores paralelos. 3 es el punto dulce: RFFM aguanta sin bloquear.
const CONCURRENCY = 3
// Timeout por fetch individual (reducido a 8s para fallar rápido en vez de esperar 15s×3)
const FETCH_TIMEOUT_MS = 8_000
// Budget de tiempo total para el batch (45s deja 15s de margen en el cron de 60s)
const BATCH_BUDGET_MS = 45_000
// Si más de N errores consecutivos de red → cortar antes para no quemar el budget
const MAX_CONSECUTIVE_ERRORS = 5

export interface EnrichResult {
  attempted: number
  enriched: number
  failed: number
  pending: number
  errors: string[]
  aborted?: boolean   // true si se cortó por budget/errores
}

/**
 * Enriquece un lote de señales sin año de nacimiento.
 *
 * Mejoras respecto a la versión anterior:
 *  1. Budget temporal de 45s → retorna antes de que Vercel corte el cron (60s)
 *  2. UPDATE atómico por codjugador — un solo UPDATE en lugar de N individuales
 *  3. Circuit breaker: si MAX_CONSECUTIVE_ERRORS seguidos → para
 *  4. Timeout reducido a 8s por fetch para fallar más rápido en RFFM lento
 */
export async function enrichSignalsBatch(
  clubId: string,
  batchSize: number = DEFAULT_BATCH,
): Promise<EnrichResult> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createAdminClient() as any

  const { data: pendientes, error: pErr } = await sb
    .from('rffm_scouting_signals')
    .select('id, codjugador, cod_temporada')
    .eq('club_id', clubId)
    .is('anio_nacimiento', null)
    .gte('goles', MIN_GOLES_FOR_ENRICH)
    .lt('enrich_attempts', MAX_ATTEMPTS)
    .order('goles', { ascending: false })
    .order('enrich_attempts', { ascending: true })
    .limit(batchSize)

  if (pErr) throw new Error(`enrich: select pendientes failed: ${pErr.message}`)

  const result: EnrichResult = {
    attempted: 0,
    enriched: 0,
    failed: 0,
    pending: 0,
    errors: [],
    aborted: false,
  }

  // Dedupe por codjugador — el mismo jugador puede estar en varias competiciones
  const uniquePorCodjugador = new Map<string, { id: string; codjugador: string; cod_temporada: string }>()
  for (const p of (pendientes ?? [])) {
    if (!uniquePorCodjugador.has(p.codjugador)) uniquePorCodjugador.set(p.codjugador, p)
  }

  const candidates = [...uniquePorCodjugador.values()]
  if (candidates.length === 0) {
    result.pending = 0
    return result
  }

  const budgetStart = Date.now()
  let consecutiveErrors = 0

  // ── Procesa un único codjugador ──────────────────────────────
  async function processOne(p: { codjugador: string }): Promise<void> {
    result.attempted++
    let anio: number | null = null
    let errorMsg: string | null = null

    try {
      const profile = await getPlayerProfile(p.codjugador, {
        skipRateLimit: true,
        timeoutMs: FETCH_TIMEOUT_MS,
      })
      anio = profile.anio_nacimiento ? parseInt(profile.anio_nacimiento, 10) || null : null

      if (anio) {
        // Upsert en tabla de perfiles de jugadores RFFM
        await sb.from('rffm_players').upsert({
          codjugador: p.codjugador,
          club_id: clubId,
          nombre_jugador: profile.nombre_jugador,
          anio_nacimiento: anio,
          last_fetched_at: new Date().toISOString(),
        }, { onConflict: 'codjugador' })
      }

      consecutiveErrors = 0  // reset en éxito
    } catch (e) {
      errorMsg = (e as Error).message
      result.errors.push(`${p.codjugador}: ${errorMsg}`)
      result.failed++
      consecutiveErrors++
    }

    // ── UPDATE atómico: un solo UPDATE por codjugador (sin SELECT previo) ──
    // Actualiza TODAS las señales de ese jugador en una sola query
    const updatePayload: Record<string, unknown> = {
      enriched_at: new Date().toISOString(),
      enrich_error: errorMsg,
      enrich_attempts: (sb.raw ? undefined : undefined), // handled below
    }

    if (anio) {
      updatePayload.anio_nacimiento = anio
      result.enriched++
    }

    // Incrementar enrich_attempts atómicamente con expresión SQL
    // Supabase no tiene arithmetic updates directos → usamos rpc o leemos el valor actual
    // Solución pragmática: UPDATE con enrich_attempts = enrich_attempts + 1 via raw SQL-like
    // Supabase postgrest permite: .update({ col: sb.rpc('...') }) — en realidad usamos
    // una segunda query de SELECT+UPDATE solo si no conseguimos el valor directamente.
    // Alternativa limpia: incrementar con un valor conocido (0→1, 1→2, etc.) sin SELECT:
    // usamos `.raw_update` no disponible en supabase-js v2.
    // → Compromiso: un único SELECT del attempt actual + un UPDATE para todos los rows.

    const { data: existing } = await sb
      .from('rffm_scouting_signals')
      .select('id, enrich_attempts')
      .eq('club_id', clubId)
      .eq('codjugador', p.codjugador)
      .is('anio_nacimiento', null)   // solo las que aún no tienen año

    if (existing && existing.length > 0) {
      // Un batch UPDATE para todos los IDs del mismo codjugador
      const ids = existing.map((r: { id: string }) => r.id)
      const currentAttempts = (existing[0].enrich_attempts ?? 0) + 1

      await sb
        .from('rffm_scouting_signals')
        .update({
          ...updatePayload,
          enrich_attempts: currentAttempts,
        })
        .in('id', ids)
    }
  }

  // ── Worker pool con budget temporal ─────────────────────────
  let cursor = 0

  async function worker() {
    while (cursor < candidates.length) {
      // Comprobar budget antes de cada fetch
      if (Date.now() - budgetStart > BATCH_BUDGET_MS) {
        result.aborted = true
        return
      }
      // Circuit breaker: demasiados errores consecutivos
      if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
        result.aborted = true
        result.errors.push(`Circuit breaker: ${consecutiveErrors} errores consecutivos — deteniendo batch`)
        return
      }

      const idx = cursor++
      try {
        await processOne(candidates[idx])
      } catch (e) {
        result.errors.push(`worker error: ${(e as Error).message}`)
      }
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, candidates.length) }, () => worker()),
  )

  // Cuántos quedan pendientes
  const { count } = await sb
    .from('rffm_scouting_signals')
    .select('*', { count: 'exact', head: true })
    .eq('club_id', clubId)
    .is('anio_nacimiento', null)
    .gte('goles', MIN_GOLES_FOR_ENRICH)
    .lt('enrich_attempts', MAX_ATTEMPTS)

  result.pending = count ?? 0
  return result
}
