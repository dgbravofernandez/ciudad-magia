import { createAdminClient } from '@/lib/supabase/admin'
import { getStandings } from '../standings'

/**
 * Para cada competición seguida, descarga la clasificación actual
 * desde RFFM y la upserta en rffm_standings.
 * Una llamada HTTP por competición (rápido, ~N×0.4s con rate limit).
 */
export async function syncStandings(clubId: string): Promise<{
  processed: number
  totalRows: number
  errors: number
  errorDetail: string[]
}> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createAdminClient() as any

  const { data: comps, error: cErr } = await sb
    .from('rffm_tracked_competitions')
    .select('id, cod_temporada, cod_tipojuego, cod_competicion, cod_grupo, nombre_competicion, nombre_grupo, active')
    .eq('club_id', clubId)
    .eq('active', true)

  if (cErr) throw new Error(`syncStandings: ${cErr.message}`)
  if (!comps?.length) return { processed: 0, totalRows: 0, errors: 0, errorDetail: [] }

  let processed = 0
  let totalRows = 0
  let errors = 0
  const errorDetail: string[] = []

  for (const c of comps) {
    try {
      const rows = await getStandings(
        c.cod_temporada,
        c.cod_tipojuego,
        c.cod_competicion,
        c.cod_grupo,
      )

      // Borramos las filas anteriores de esa competición y volvemos a
      // insertar las actuales — más simple que manejar bajas/altas.
      await sb
        .from('rffm_standings')
        .delete()
        .eq('tracked_competition_id', c.id)

      if (rows.length) {
        const insertRows = rows.map(r => ({
          club_id: clubId,
          tracked_competition_id: c.id,
          jornada: null,
          posicion: r.posicion,
          codigo_equipo: r.codigo_equipo,
          nombre_equipo: r.nombre_equipo,
          pj: r.pj, pg: r.pg, pe: r.pe, pp: r.pp,
          gf: r.gf, gc: r.gc, pts: r.pts,
          fetched_at: new Date().toISOString(),
        }))
        const { error: iErr } = await sb.from('rffm_standings').insert(insertRows)
        if (iErr) throw iErr
        totalRows += rows.length
      }

      await sb
        .from('rffm_tracked_competitions')
        .update({ last_standings_sync: new Date().toISOString(), standings_error: null })
        .eq('id', c.id)

      processed++
    } catch (e) {
      errors++
      const msg = (e as Error).message
      errorDetail.push(`${c.nombre_competicion} / ${c.nombre_grupo}: ${msg}`)
      // Registrar el error en la fila de la competición
      await sb
        .from('rffm_tracked_competitions')
        .update({ standings_error: msg.slice(0, 500) })
        .eq('id', c.id)
    }
  }

  return { processed, totalRows, errors, errorDetail }
}
