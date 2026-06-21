import { createAdminClient } from '@/lib/supabase/admin'
import { getClubContext } from '@/lib/supabase/get-club-id'
import { fetchAllRows } from '@/lib/supabase/paginate'
import { Topbar } from '@/components/layout/Topbar'
import { RffmDashboard } from '@/features/rffm/components/RffmDashboard'
import { getRffmHealth } from '@/features/rffm/actions/health.actions'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Scouting RFFM' }
export const dynamic = 'force-dynamic'
// Server actions (triggerRffmSync) corren en este segmento — subimos a 60s (máx Hobby).
export const maxDuration = 60

export default async function RffmPage() {
  const { clubId } = await getClubContext()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createAdminClient() as any

  const SIGNAL_COLS = 'id,codjugador,nombre_jugador,nombre_equipo,nombre_competicion,nombre_grupo,cod_tipojuego,goles,partidos_jugados,goles_por_partido,anio_nacimiento,division_level,valor_score,estado'

  const [
    signals,
    { data: cardAlerts },
    { data: trackedComps },
    { data: lastSync },
    { data: matches },
    { data: standings },
  ] = await Promise.all([
    // Goleadores: ordenar por GOLES TOTALES (no por ratio goles/partido, que
    // colaba a quien mete 5 en 1 partido por delante de quien mete 50). Paginado
    // hasta 5000 para que los cracks reales (F7 y F11) entren — PostgREST corta a 1000.
    fetchAllRows(() => sb
      .from('rffm_scouting_signals')
      .select(SIGNAL_COLS)
      .eq('club_id', clubId)
      .neq('estado', 'descartado')
      .order('goles', { ascending: false })
      .order('id', { ascending: true }), 1000, 5000),
    sb
      .from('rffm_card_alerts')
      .select('id,codjugador,nombre_jugador,amarillas_ciclo_actual,proximo_umbral,alerta_activa,tracked_competition_id,rffm_tracked_competitions(nombre_competicion,nombre_grupo)')
      .eq('club_id', clubId)
      .eq('alerta_activa', true)
      .order('amarillas_ciclo_actual', { ascending: false })
      .limit(100),
    sb
      .from('rffm_tracked_competitions')
      .select('id,nombre_competicion,nombre_grupo,nombre_equipo_nuestro,codigo_equipo_nuestro,cod_tipojuego,umbral_amarillas,last_calendar_sync,last_acta_sync,active')
      .eq('club_id', clubId)
      .order('nombre_competicion'),
    sb
      .from('rffm_sync_log')
      .select('id,sync_type,status,competitions_processed,actas_processed,signals_created,errors_count,started_at,finished_at')
      .eq('club_id', clubId)
      .order('started_at', { ascending: false })
      .limit(5),
    sb
      .from('rffm_matches')
      .select('id,codacta,tracked_competition_id,jornada,fecha,hora,codigo_equipo_local,equipo_local,codigo_equipo_visitante,equipo_visitante,goles_local,goles_visitante,acta_cerrada,is_our_match,campo')
      .eq('club_id', clubId)
      .order('fecha', { ascending: false })
      .limit(2000),
    sb
      .from('rffm_standings')
      .select('id,tracked_competition_id,posicion,codigo_equipo,nombre_equipo,pj,pg,pe,pp,gf,gc,pts,fetched_at')
      .eq('club_id', clubId)
      .order('posicion', { ascending: true }),
  ])

  // Eventos de partido (goles + tarjetas) de los últimos 90 días, solo para
  // partidos donde estamos involucrados (is_our_match). Se necesita el codacta
  // que está en rffm_matches.
  const cutoff90 = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
  const recentMatchCodactas: string[] = []
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: recentMatchesForEvents } = await sb
    .from('rffm_matches')
    .select('codacta')
    .eq('club_id', clubId)
    .eq('is_our_match', true)
    .gte('fecha', cutoff90)
    .limit(500)
  for (const m of (recentMatchesForEvents ?? [])) recentMatchCodactas.push(m.codacta)

  let matchEvents: Array<{ codacta: string; tipo: string; codjugador: string; nombre_jugador: string; lado: string; minuto: number | null }> = []
  if (recentMatchCodactas.length > 0) {
    const { data: ev } = await sb
      .from('rffm_match_events')
      .select('codacta, tipo, codjugador, nombre_jugador, lado, minuto')
      .in('codacta', recentMatchCodactas)
      .limit(5000)
    matchEvents = ev ?? []
  }

  // Pendientes de enrich: goleadores con ≥2 goles, sin año, con menos de 30 intentos.
  // (MIN_GOLES_FOR_ENRICH=2, MAX_ATTEMPTS=30 en syncEnrich.ts)
  const [
    { count: enrichPendingCount },
    { count: enrichExhaustedCount },
    { count: signalsTotalCount },
  ] = await Promise.all([
    sb.from('rffm_scouting_signals')
      .select('*', { count: 'exact', head: true })
      .eq('club_id', clubId)
      .neq('estado', 'descartado')
      .is('anio_nacimiento', null)
      .gte('goles', 2)
      .lt('enrich_attempts', 30),
    sb.from('rffm_scouting_signals')
      .select('*', { count: 'exact', head: true })
      .eq('club_id', clubId)
      .neq('estado', 'descartado')
      .is('anio_nacimiento', null)
      .gte('goles', 2)
      .gte('enrich_attempts', 30),
    sb.from('rffm_scouting_signals')
      .select('*', { count: 'exact', head: true })
      .eq('club_id', clubId)
      .neq('estado', 'descartado')
      .gte('goles', 2),
  ])

  // Snapshot agregado de salud del módulo
  const health = await getRffmHealth()

  return (
    <div className="flex flex-col h-full">
      <Topbar title="Scouting RFFM" />
      <div className="flex-1 overflow-auto">
        <RffmDashboard
          signals={(signals ?? []) as never[]}
          cardAlerts={(cardAlerts ?? []) as never[]}
          trackedComps={(trackedComps ?? []) as never[]}
          recentSyncs={(lastSync ?? []) as never[]}
          matches={(matches ?? []) as never[]}
          standings={(standings ?? []) as never[]}
          matchEvents={matchEvents as never[]}
          enrichPending={enrichPendingCount ?? 0}
          enrichExhausted={enrichExhaustedCount ?? 0}
          signalsTotal={signalsTotalCount ?? 0}
          health={health}
        />
      </div>
    </div>
  )
}
