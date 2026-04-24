import { fetchRffmSSR } from './client'
import type { RffmCalendarMatch } from './types'

interface CalendarPageProps {
  calendar: {
    estado: string
    sesion_ok: string
    rounds: Array<{
      codjornada: string
      jornada: string
      equipos: RffmCalendarMatch[]
    }>
  }
  currentRound: string
}

/**
 * Returns all matches (across all rounds) for a competition group.
 * Each match has codacta, teams, scores, date, and field.
 */
export async function getCalendar(
  codTemporada: string,
  codTipojuego: string,
  codCompeticion: string,
  codGrupo: string
): Promise<RffmCalendarMatch[]> {
  const data = await fetchRffmSSR<CalendarPageProps>(
    'competicion/calendario',
    {
      temporada: codTemporada,
      tipojuego: codTipojuego,
      competicion: codCompeticion,
      grupo: codGrupo,
    }
  )

  if (!data.calendar?.rounds) return []
  return data.calendar.rounds.flatMap(r => r.equipos ?? [])
}

/**
 * Returns matches round by round (preserves jornada number).
 */
export async function getCalendarByRound(
  codTemporada: string,
  codTipojuego: string,
  codCompeticion: string,
  codGrupo: string
): Promise<Array<{ jornada: number; matches: RffmCalendarMatch[] }>> {
  const data = await fetchRffmSSR<CalendarPageProps>(
    'competicion/calendario',
    {
      temporada: codTemporada,
      tipojuego: codTipojuego,
      competicion: codCompeticion,
      grupo: codGrupo,
    }
  )

  if (!data.calendar?.rounds) return []
  return data.calendar.rounds.map(r => ({
    jornada: parseInt(r.jornada, 10),
    matches: r.equipos ?? [],
  }))
}
