import { createAdminClient } from '@/lib/supabase/admin'

/**
 * Recomputes yellow card cycle alerts for all tracked competitions.
 * Counts yellows from rffm_match_events, checks against umbral_amarillas.
 * Sets alerta_activa = true when player is at (umbral - 1) yellows in cycle.
 */
export async function syncCardAlerts(
  clubId: string
): Promise<{ updated: number; errors: number }> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createAdminClient() as any

  const { data: competitions } = await sb
    .from('rffm_tracked_competitions')
    .select('id, cod_competicion, cod_grupo, cod_temporada, codigo_equipo_nuestro, umbral_amarillas')
    .eq('club_id', clubId)
    .eq('active', true)

  if (!competitions?.length) return { updated: 0, errors: 0 }

  let updated = 0
  let errors = 0

  for (const comp of competitions) {
    try {
      // Get all our matches in this competition
      const { data: ourMatches } = await sb
        .from('rffm_matches')
        .select('codacta')
        .eq('club_id', clubId)
        .eq('tracked_competition_id', comp.id)
        .eq('is_our_match', true)
        .not('acta_synced_at', 'is', null)

      if (!ourMatches?.length) continue

      const codactas = ourMatches.map((m: { codacta: string }) => m.codacta)

      // Count yellows per player from events
      const { data: yellowEvents } = await sb
        .from('rffm_match_events')
        .select('codjugador, nombre_jugador, codacta')
        .in('codacta', codactas)
        .eq('tipo', 'amarilla')

      if (!yellowEvents?.length) continue

      // Group by player
      const playerYellows: Record<string, { nombre: string; count: number; lastActa: string }> = {}
      for (const ev of yellowEvents) {
        if (!playerYellows[ev.codjugador]) {
          playerYellows[ev.codjugador] = { nombre: ev.nombre_jugador, count: 0, lastActa: ev.codacta }
        }
        playerYellows[ev.codjugador].count++
        playerYellows[ev.codjugador].lastActa = ev.codacta
      }

      const umbral = comp.umbral_amarillas ?? 5

      for (const [codjugador, { nombre, count, lastActa }] of Object.entries(playerYellows)) {
        // Yellows in current cycle (mod umbral)
        const ciclo = count % umbral === 0 ? umbral : count % umbral
        const alertaActiva = ciclo === umbral - 1  // one away from suspension

        const { error } = await sb
          .from('rffm_card_alerts')
          .upsert({
            club_id: clubId,
            tracked_competition_id: comp.id,
            codjugador,
            nombre_jugador: nombre,
            amarillas_ciclo_actual: ciclo,
            ultimo_codacta: lastActa,
            proximo_umbral: Math.ceil(count / umbral) * umbral,
            alerta_activa: alertaActiva,
            updated_at: new Date().toISOString(),
          }, { onConflict: 'tracked_competition_id,codjugador' })

        if (!error) updated++
      }
    } catch (e) {
      errors++
    }
  }

  return { updated, errors }
}
