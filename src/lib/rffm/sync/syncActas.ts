import { createAdminClient } from '@/lib/supabase/admin'
import { getActa, cardTypeFromRaw } from '../acta'

/**
 * Processes pending actas for a club.
 * Inserts lineups, events; updates player stats; marks acta_synced_at.
 */
export async function syncActas(
  clubId: string,
  limit = 50
): Promise<{ processed: number; errors: number; errorDetail: string[] }> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createAdminClient() as any

  // Get pending actas (closed but not yet synced)
  const { data: pending, error: pendErr } = await sb
    .from('rffm_matches')
    .select('codacta, tracked_competition_id')
    .eq('club_id', clubId)
    .eq('acta_cerrada', true)
    .is('acta_synced_at', null)
    .limit(limit)

  if (pendErr) throw new Error(`syncActas: ${pendErr.message}`)
  if (!pending?.length) return { processed: 0, errors: 0, errorDetail: [] }

  let processed = 0
  let errors = 0
  const errorDetail: string[] = []

  for (const row of pending) {
    try {
      const game = await getActa(row.codacta)

      // ── Lineups ──────────────────────────────────────────────
      const lineupRows = [
        ...(game.jugadores_equipo_local ?? []).map(p => ({
          codacta: row.codacta,
          codjugador: p.codjugador,
          nombre_jugador: p.nombre_jugador,
          dorsal: p.dorsal || null,
          titular: p.titular === '1',
          capitan: p.capitan === '1',
          portero: p.portero === '1',
          lado: 'local' as const,
        })),
        ...(game.jugadores_equipo_visitante ?? []).map(p => ({
          codacta: row.codacta,
          codjugador: p.codjugador,
          nombre_jugador: p.nombre_jugador,
          dorsal: p.dorsal || null,
          titular: p.titular === '1',
          capitan: p.capitan === '1',
          portero: p.portero === '1',
          lado: 'visitante' as const,
        })),
      ]

      if (lineupRows.length) {
        await sb
          .from('rffm_match_lineups')
          .upsert(lineupRows, { onConflict: 'codacta,codjugador', ignoreDuplicates: true })
      }

      // ── Events (goals + cards) ────────────────────────────────
      const eventRows = [
        ...(game.goles_equipo_local ?? []).map(g => ({
          codacta: row.codacta,
          tipo: 'gol' as const,
          codjugador: g.codjugador,
          nombre_jugador: g.nombre_jugador,
          minuto: g.minuto ? parseInt(g.minuto, 10) : null,
          lado: 'local' as const,
          tipo_raw: g.tipo_gol,
        })),
        ...(game.goles_equipo_visitante ?? []).map(g => ({
          codacta: row.codacta,
          tipo: 'gol' as const,
          codjugador: g.codjugador,
          nombre_jugador: g.nombre_jugador,
          minuto: g.minuto ? parseInt(g.minuto, 10) : null,
          lado: 'visitante' as const,
          tipo_raw: g.tipo_gol,
        })),
        ...(game.tarjetas_equipo_local ?? []).map(t => ({
          codacta: row.codacta,
          tipo: cardTypeFromRaw(t.tipo_tarjeta),
          codjugador: t.codjugador,
          nombre_jugador: t.nombre_jugador,
          minuto: t.minuto ? parseInt(t.minuto, 10) : null,
          lado: 'local' as const,
          tipo_raw: t.tipo_tarjeta,
        })),
        ...(game.tarjetas_equipo_visitante ?? []).map(t => ({
          codacta: row.codacta,
          tipo: cardTypeFromRaw(t.tipo_tarjeta),
          codjugador: t.codjugador,
          nombre_jugador: t.nombre_jugador,
          minuto: t.minuto ? parseInt(t.minuto, 10) : null,
          lado: 'visitante' as const,
          tipo_raw: t.tipo_tarjeta,
        })),
      ]

      if (eventRows.length) {
        await sb.from('rffm_match_events').insert(eventRows)
      }

      // ── Mark synced + update acta_cerrada ─────────────────────
      await sb
        .from('rffm_matches')
        .update({
          acta_cerrada: game.acta_cerrada === '1',
          goles_local: game.goles_local !== '' ? parseInt(game.goles_local, 10) : null,
          goles_visitante: game.goles_visitante !== '' ? parseInt(game.goles_visitante, 10) : null,
          acta_synced_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('codacta', row.codacta)

      processed++
    } catch (e) {
      errors++
      errorDetail.push(`acta ${row.codacta}: ${(e as Error).message}`)
    }
  }

  return { processed, errors, errorDetail }
}
