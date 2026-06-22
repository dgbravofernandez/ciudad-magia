'use server'

import { getScopedClient } from '@/lib/supabase/scoped-client'
import { revalidatePath } from 'next/cache'
import {
  detectClubBasics,
  detectClubChunk,
  type DetectBasicsResult,
  type DetectChunkResult,
} from '@/lib/rffm/club-wizard'
import { getClubRffmCodigo, saveRffmCodigoClub } from '@/features/integraciones/actions/rffm-config.actions'

// NOTA: el maxDuration se hereda de la page que invoca las actions
// (/scouting/rffm tiene `export const maxDuration = 60`).

function normalizeCodigoClub(input: string): string {
  let v = input.trim()
  const urlMatch = v.match(/\/fichaclub\/(\d+)/)
  if (urlMatch) v = urlMatch[1]
  return v
}

/**
 * STEP 1 del wizard: lista de equipos del club.
 * Rápido (~10s). Llama una vez al abrir el modal.
 */
export async function detectClubBasicsAction(
  codigoClub?: string,
): Promise<{ success: boolean; error?: string; result?: DetectBasicsResult; usedCodigoClub?: string }> {
  try {
    const { roles } = await getScopedClient()
    if (!roles.some(r => ['admin', 'direccion', 'director_deportivo'].includes(r))) {
      return { success: false, error: 'Sin permisos' }
    }

    let used = normalizeCodigoClub(codigoClub ?? '')
    if (!used) used = (await getClubRffmCodigo()) ?? ''
    if (!used || !/^\d{2,8}$/.test(used)) {
      return { success: false, error: 'Pega el código del club RFFM (ej. 3824) o configúralo en /configuracion/integraciones' }
    }

    // Auto-guardar el código si no estaba
    const stored = await getClubRffmCodigo()
    if (!stored) await saveRffmCodigoClub(used).catch(() => undefined)

    const result = await detectClubBasics(used)
    return { success: true, result, usedCodigoClub: used }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

/**
 * STEP 2 del wizard: resuelve grupos de un subset de equipos.
 * Cliente lo llama N veces hasta cubrir todos los equipos.
 */
export async function detectClubChunkAction(
  codigoClub: string,
  equipoCodigos: string[],
): Promise<{ success: boolean; error?: string; result?: DetectChunkResult }> {
  try {
    const { roles } = await getScopedClient()
    if (!roles.some(r => ['admin', 'direccion', 'director_deportivo'].includes(r))) {
      return { success: false, error: 'Sin permisos' }
    }
    const used = normalizeCodigoClub(codigoClub)
    if (!used || !/^\d{2,8}$/.test(used)) {
      return { success: false, error: 'Código de club inválido' }
    }
    if (!Array.isArray(equipoCodigos) || equipoCodigos.length === 0) {
      return { success: false, error: 'Lista de equipos vacía' }
    }
    const result = await detectClubChunk(used, equipoCodigos)
    return { success: true, result }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

/**
 * Borra TODA la configuración RFFM del club (tracked_competitions y todos
 * los datos asociados via cascade). Por defecto preserva las señales de
 * scouting (goleadores rivales) y el cache de perfiles. Con `wipeAll: true`
 * borra TODO incluyendo señales y perfiles.
 *
 * SIEMPRE preserva rffm_sync_log (historial).
 */
export async function resetClubRffmConfig(
  options: { wipeAll?: boolean } = {},
): Promise<{
  success: boolean
  error?: string
  deleted?: {
    tracked_competitions: number
    matches: number
    standings: number
    card_alerts: number
    scouting_signals: number
    players: number
  }
}> {
  try {
    const { sb, clubId, roles } = await getScopedClient()
    if (!roles.some(r => ['admin', 'direccion'].includes(r))) {
      return { success: false, error: 'Solo admin / dirección puede resetear' }
    }

    // Contamos antes para devolver al usuario
    const counts = await Promise.all([
      sb.from('rffm_tracked_competitions').select('*', { count: 'exact', head: true }).eq('club_id', clubId),
      sb.from('rffm_matches').select('*', { count: 'exact', head: true }).eq('club_id', clubId),
      sb.from('rffm_standings').select('*', { count: 'exact', head: true }).eq('club_id', clubId),
      sb.from('rffm_card_alerts').select('*', { count: 'exact', head: true }).eq('club_id', clubId),
      sb.from('rffm_scouting_signals').select('*', { count: 'exact', head: true }).eq('club_id', clubId),
      sb.from('rffm_players').select('*', { count: 'exact', head: true }).eq('club_id', clubId),
    ])
    const beforeCounts = {
      tracked_competitions: counts[0].count ?? 0,
      matches: counts[1].count ?? 0,
      standings: counts[2].count ?? 0,
      card_alerts: counts[3].count ?? 0,
      scouting_signals: counts[4].count ?? 0,
      players: counts[5].count ?? 0,
    }

    // Borramos en orden — los CASCADE hacen el resto
    // tracked_competitions tiene ON DELETE CASCADE en matches/lineups/events/card_alerts/standings
    const { error: e1 } = await sb
      .from('rffm_tracked_competitions')
      .delete()
      .eq('club_id', clubId)
    if (e1) return { success: false, error: `tracked_competitions: ${e1.message}` }

    // Limpieza adicional por si quedan filas huérfanas (sin tracked_competition_id)
    await sb.from('rffm_matches').delete().eq('club_id', clubId)
    await sb.from('rffm_standings').delete().eq('club_id', clubId)
    await sb.from('rffm_card_alerts').delete().eq('club_id', clubId)

    let deletedSignals = 0
    let deletedPlayers = 0
    if (options.wipeAll) {
      const { count: c1 } = await sb
        .from('rffm_scouting_signals')
        .delete({ count: 'exact' })
        .eq('club_id', clubId)
      deletedSignals = c1 ?? beforeCounts.scouting_signals
      const { count: c2 } = await sb
        .from('rffm_players')
        .delete({ count: 'exact' })
        .eq('club_id', clubId)
      deletedPlayers = c2 ?? beforeCounts.players
    }

    revalidatePath('/scouting/rffm')

    return {
      success: true,
      deleted: {
        tracked_competitions: beforeCounts.tracked_competitions,
        matches: beforeCounts.matches,
        standings: beforeCounts.standings,
        card_alerts: beforeCounts.card_alerts,
        scouting_signals: options.wipeAll ? deletedSignals : 0,
        players: options.wipeAll ? deletedPlayers : 0,
      },
    }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

/**
 * Inserta competiciones detectadas por el wizard. Idempotente: si ya existe
 * la combinación (club_id, cod_competicion, cod_grupo) hace UPDATE.
 *
 * Devuelve detalle por fila para señalar errores específicos.
 */
export async function bulkInsertWizardResults(
  matched: Array<{
    cod_temporada: string
    cod_tipojuego: string
    cod_competicion: string | null
    cod_grupo: string | null
    nombre_competicion: string | null
    nombre_grupo: string | null
    codigo_equipo_nuestro: string | null
    nombre_equipo_nuestro: string | null
  }>,
): Promise<{
  success: boolean
  error?: string
  inserted?: number
  updated?: number
  skipped?: number
}> {
  try {
    const { sb, clubId, roles } = await getScopedClient()
    if (!roles.some(r => ['admin', 'direccion', 'director_deportivo'].includes(r))) {
      return { success: false, error: 'Sin permisos' }
    }
    if (!matched?.length) return { success: false, error: 'No hay competiciones para crear' }

    let inserted = 0
    let updated = 0
    let skipped = 0

    for (const m of matched) {
      if (!m.cod_competicion || !m.cod_grupo) {
        skipped++
        continue
      }

      const payload = {
        club_id: clubId,
        cod_temporada: m.cod_temporada,
        cod_tipojuego: m.cod_tipojuego,
        cod_competicion: m.cod_competicion,
        cod_grupo: m.cod_grupo,
        nombre_competicion: m.nombre_competicion,
        nombre_grupo: m.nombre_grupo,
        codigo_equipo_nuestro: m.codigo_equipo_nuestro,
        nombre_equipo_nuestro: m.nombre_equipo_nuestro,
        umbral_amarillas: 5,
        active: true,
      }

      // Buscar si ya existe
      const { data: existing } = await sb
        .from('rffm_tracked_competitions')
        .select('id')
        .eq('club_id', clubId)
        .eq('cod_competicion', m.cod_competicion)
        .eq('cod_grupo', m.cod_grupo)
        .maybeSingle()

      if (existing) {
        const { error } = await sb
          .from('rffm_tracked_competitions')
          .update(payload)
          .eq('id', existing.id)
        if (!error) updated++
        else skipped++
      } else {
        const { error } = await sb
          .from('rffm_tracked_competitions')
          .insert(payload)
        if (!error) inserted++
        else skipped++
      }
    }

    revalidatePath('/scouting/rffm')
    return { success: true, inserted, updated, skipped }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}
