import { createAdminClient } from '@/lib/supabase/admin'
import { getPlayerProfile } from '../player'

// Cuántos perfiles enriquecer en una pasada del cron.
// 60s budget / ~0.4s por request RFFM (rate limit) ≈ 150 — dejamos margen.
// Vercel Hobby limita el cron a 1 ejecución diaria, así que apuramos el batch.
const DEFAULT_BATCH = 140
const MAX_ATTEMPTS = 3
// Solo enriquecemos goleadores relevantes (5+ goles en la temporada).
// Los demás se quedan en BD pero sin año hasta que sean interesantes.
// Threshold conservador para que el universo a enriquecer sea ~2-3k jugadores
// y se complete en ~1 semana con 3 crons/día × 140 perfiles.
const MIN_GOLES_FOR_ENRICH = 5

export interface EnrichResult {
  attempted: number
  enriched: number
  failed: number
  pending: number
  errors: string[]
}

/**
 * Enriquece un lote de señales sin año de nacimiento.
 * Idempotente: cada señal cuenta sus intentos en `enrich_attempts`,
 * a partir de MAX_ATTEMPTS se descarta para no reintentar infinitamente.
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
  }

  // Dedupe por codjugador (el mismo jugador puede estar en >1 competición)
  const uniquePorCodjugador = new Map<string, { id: string; codjugador: string; cod_temporada: string }>()
  for (const p of (pendientes ?? [])) {
    if (!uniquePorCodjugador.has(p.codjugador)) uniquePorCodjugador.set(p.codjugador, p)
  }

  for (const p of uniquePorCodjugador.values()) {
    result.attempted++
    let anio: number | null = null
    let errorMsg: string | null = null

    try {
      const profile = await getPlayerProfile(p.codjugador)
      anio = profile.anio_nacimiento ? parseInt(profile.anio_nacimiento, 10) || null : null

      // Guardar también en rffm_players (cache permanente del perfil)
      if (anio) {
        await sb.from('rffm_players').upsert({
          codjugador: p.codjugador,
          club_id: clubId,
          nombre_jugador: profile.nombre_jugador,
          anio_nacimiento: anio,
          last_fetched_at: new Date().toISOString(),
        }, { onConflict: 'codjugador' })
      }
    } catch (e) {
      errorMsg = (e as Error).message
      result.errors.push(`${p.codjugador}: ${errorMsg}`)
      result.failed++
    }

    // Actualizar TODAS las señales de ese jugador (puede estar en varias comps)
    const update: Record<string, unknown> = {
      enriched_at: new Date().toISOString(),
      enrich_error: errorMsg,
    }
    if (anio) {
      update.anio_nacimiento = anio
      result.enriched++
    }
    // increment attempts: usamos rpc-less manual update con +1
    const { data: rows } = await sb
      .from('rffm_scouting_signals')
      .select('id, enrich_attempts')
      .eq('club_id', clubId)
      .eq('codjugador', p.codjugador)
      .is('anio_nacimiento', null)

    for (const row of (rows ?? [])) {
      await sb
        .from('rffm_scouting_signals')
        .update({ ...update, enrich_attempts: (row.enrich_attempts ?? 0) + 1 })
        .eq('id', row.id)
    }
  }

  // Cuántos quedan pendientes (relevantes: 10+ goles) para informar al usuario
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
