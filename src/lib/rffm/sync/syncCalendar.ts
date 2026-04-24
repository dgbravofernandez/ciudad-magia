import { createAdminClient } from '@/lib/supabase/admin'
import { getCalendar } from '../calendar'
import { parseRffmDate } from '../acta'

/**
 * For each tracked competition, fetches the RFFM calendar and
 * upserts rffm_matches rows. Marks is_our_match = true when one
 * of the sides is our team.
 */
export async function syncCalendar(clubId: string): Promise<{
  processed: number
  errors: number
  errorDetail: string[]
}> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createAdminClient() as any

  const { data: competitions, error: compErr } = await sb
    .from('rffm_tracked_competitions')
    .select('*')
    .eq('club_id', clubId)
    .eq('active', true)

  if (compErr) throw new Error(`syncCalendar: ${compErr.message}`)
  if (!competitions?.length) return { processed: 0, errors: 0, errorDetail: [] }

  let processed = 0
  let errors = 0
  const errorDetail: string[] = []

  for (const comp of competitions) {
    try {
      const matches = await getCalendar(
        comp.cod_temporada,
        comp.cod_tipojuego,
        comp.cod_competicion,
        comp.cod_grupo
      )

      if (!matches.length) continue

      const rows = matches
        .filter(m => m.codacta && m.codacta !== '0')
        .map(m => ({
          club_id: clubId,
          tracked_competition_id: comp.id,
          codacta: m.codacta,
          jornada: null as number | null,
          fecha: parseRffmDate(m.fecha),
          hora: m.hora || null,
          codigo_equipo_local: m.codigo_equipo_local,
          equipo_local: m.equipo_local,
          codigo_equipo_visitante: m.codigo_equipo_visitante,
          equipo_visitante: m.equipo_visitante,
          goles_local: m.goles_casa !== '' ? parseInt(m.goles_casa, 10) : null,
          goles_visitante: m.goles_visitante !== '' ? parseInt(m.goles_visitante, 10) : null,
          campo: m.campo || null,
          acta_cerrada: m.goles_casa !== '' && m.goles_visitante !== '',
          is_our_match:
            m.codigo_equipo_local === comp.codigo_equipo_nuestro ||
            m.codigo_equipo_visitante === comp.codigo_equipo_nuestro,
          updated_at: new Date().toISOString(),
        }))

      // upsert — on conflict(codacta) update result fields
      const { error: upsertErr } = await sb
        .from('rffm_matches')
        .upsert(rows, {
          onConflict: 'codacta',
          ignoreDuplicates: false,
        })

      if (upsertErr) {
        errors++
        errorDetail.push(`comp ${comp.cod_competicion}/${comp.cod_grupo}: ${upsertErr.message}`)
        continue
      }

      // Update last_calendar_sync
      await sb
        .from('rffm_tracked_competitions')
        .update({ last_calendar_sync: new Date().toISOString() })
        .eq('id', comp.id)

      processed += rows.length
    } catch (e) {
      errors++
      errorDetail.push(`comp ${comp.cod_competicion}/${comp.cod_grupo}: ${(e as Error).message}`)
    }
  }

  return { processed, errors, errorDetail }
}
