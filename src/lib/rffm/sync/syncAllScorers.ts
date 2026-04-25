import { createAdminClient } from '@/lib/supabase/admin'
import { sweepAllGroupScorers } from '../scorers'
import { getPlayerProfile } from '../player'
import { getDivisionLevel } from '../division-levels'
import { SCORER_SWEEP_TIPOJUEGOS, CURRENT_SEASON } from '../constants'

// Minimum filter: only store players above this threshold
const MIN_GOLES_POR_PARTIDO = 0.5
// Max players to enrich with birth year per sync run (to control API calls)
const MAX_PROFILE_FETCHES_PER_RUN = 200

/**
 * Global scouting sweep:
 * 1. Fetches scorers from ALL RFFM groups
 * 2. Filters by goles_por_partido >= threshold
 * 3. Upserts rffm_scouting_signals
 * 4. Enriches top candidates with birth year (from player profile)
 */
export async function syncAllScorers(
  clubId: string,
  codTemporada: string = CURRENT_SEASON,
  tiposjuego: string[] = SCORER_SWEEP_TIPOJUEGOS,  // F7 + F11 only
  options: { enrich?: boolean } = {}
): Promise<{ signalsCreated: number; playersFetched: number; errors: number; errorDetail: string[] }> {
  const enrich = options.enrich ?? true
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createAdminClient() as any

  let signalsCreated = 0
  let playersFetched = 0
  let errors = 0
  const errorDetail: string[] = []

  // ── Step 1: Sweep all groups ──────────────────────────────────
  let allResults
  try {
    allResults = await sweepAllGroupScorers(codTemporada, tiposjuego)
  } catch (e) {
    throw new Error(`syncAllScorers: sweep failed: ${(e as Error).message}`)
  }

  // ── Step 2: Build upsert rows ─────────────────────────────────
  const rows: Record<string, unknown>[] = []

  for (const { codCompeticion, codGrupo, nombreCompeticion, nombreGrupo, codTipojuego, scorers } of allResults) {
    const divisionLevel = getDivisionLevel(nombreCompeticion)

    for (const s of scorers) {
      const golesNum = parseInt(s.goles, 10) || 0
      const pjNum = parseInt(s.partidos_jugados, 10) || 1
      const ratio = parseFloat(s.goles_por_partidos) || golesNum / pjNum

      if (ratio < MIN_GOLES_POR_PARTIDO) continue
      if (golesNum < 2) continue  // at least 2 goals total

      rows.push({
        club_id: clubId,
        codjugador: s.codigo_jugador,
        nombre_jugador: s.jugador,
        nombre_equipo: s.nombre_equipo,
        codigo_equipo: s.codigo_equipo,
        cod_temporada: codTemporada,
        cod_competicion: codCompeticion,
        cod_grupo: codGrupo,
        nombre_competicion: nombreCompeticion,
        nombre_grupo: nombreGrupo,
        goles: golesNum,
        partidos_jugados: pjNum,
        goles_penalti: parseInt(s.goles_penalti, 10) || 0,
        goles_por_partido: ratio.toFixed(2),
        division_level: divisionLevel,
        updated_at: new Date().toISOString(),
      })
    }
  }

  // ── Step 3: Upsert signals ────────────────────────────────────
  // Batch in groups of 100
  const BATCH = 100
  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH)
    const { error } = await sb
      .from('rffm_scouting_signals')
      .upsert(batch, {
        onConflict: 'club_id,codjugador,cod_temporada,cod_competicion,cod_grupo',
        ignoreDuplicates: false,
      })
    if (error) {
      errors++
      errorDetail.push(`upsert batch ${i}: ${error.message}`)
    } else {
      signalsCreated += batch.length
    }
  }

  // ── Step 4: Enrich top candidates with birth year ─────────────
  // Skipped on manual runs (too slow for Vercel Hobby 60s). Only in cron.
  if (!enrich) {
    return { signalsCreated, playersFetched, errors, errorDetail }
  }

  // Only enrich signals where anio_nacimiento is null, sorted by valor_score desc
  const { data: toEnrich } = await sb
    .from('rffm_scouting_signals')
    .select('id, codjugador')
    .eq('club_id', clubId)
    .eq('cod_temporada', codTemporada)
    .is('anio_nacimiento', null)
    .order('goles_por_partido', { ascending: false })
    .limit(MAX_PROFILE_FETCHES_PER_RUN)

  for (const signal of (toEnrich ?? [])) {
    try {
      const profile = await getPlayerProfile(signal.codjugador)
      const anio = profile.anio_nacimiento ? parseInt(profile.anio_nacimiento, 10) : null

      if (anio) {
        await sb
          .from('rffm_scouting_signals')
          .update({ anio_nacimiento: anio })
          .eq('club_id', clubId)
          .eq('codjugador', signal.codjugador)
          .eq('cod_temporada', codTemporada)

        // Also upsert into rffm_players registry
        await sb
          .from('rffm_players')
          .upsert({
            codjugador: signal.codjugador,
            club_id: clubId,
            nombre_jugador: profile.nombre_jugador,
            anio_nacimiento: anio,
            last_fetched_at: new Date().toISOString(),
          }, { onConflict: 'codjugador' })

        playersFetched++
      }
    } catch (e) {
      errors++
      errorDetail.push(`profile ${signal.codjugador}: ${(e as Error).message}`)
    }
  }

  return { signalsCreated, playersFetched, errors, errorDetail }
}
