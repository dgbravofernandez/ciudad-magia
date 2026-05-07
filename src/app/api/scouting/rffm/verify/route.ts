import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'

// Verifies connectivity to RFFM data for the current club and fetches a small
// set of representative data to ensure the integration works end-to-end.
// This is read-only and does not alter any data.

export async function GET(req: Request) {
  try {
    // Expect middleware to inject context headers
    const clubId = req.headers.get('x-club-id')
    const clubSlug = req.headers.get('x-club-slug')

    if (!clubId) {
      return NextResponse.json({ ok: false, error: 'missing_club_context' }, { status: 401 })
    }

    // Initialize service-role client to bypass RLS for read-only diagnostics
    const sb = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { cookies: { getAll: () => [], setAll: () => {} } }
    ) as any

    // 1) Club basic info
    const { data: club } = await sb
      .from('clubs')
      .select('id, name, city, slug')
      .eq('id', clubId)
      .single()

    // If club is not found, return a clear error but do not crash
    if (!club) {
      return NextResponse.json({ ok: false, error: 'club_not_found' }, { status: 404 })
    }

    // 2) Last few RFFM matches for this club
    const { data: lastMatches } = await sb
      .from('rffm_matches')
      .select('codacta, fecha, equipo_local, equipo_visitante, goles_local, goles_visitante, acta_cerrada')
      .eq('club_id', clubId)
      .order('fecha', { ascending: false })
      .limit(5)

    // 3) Current/foundation season: find latest cod_temporada in player_stats for this club
    const { data: seasons } = await sb
      .from('rffm_player_stats')
      .select('cod_temporada')
      .eq('club_id', clubId)
      .order('cod_temporada', { ascending: false })
      .limit(1)

    const currentSeason = seasons?.[0]?.cod_temporada

    // 4) Goleadores del club para la temporada actual (si hay temporada detectada)
    let clubGoleadores: Array<any> = []
    if (currentSeason) {
      // Build a simple fetch for stats of the current season for Madrid clubs
      // First, find Madrid clubs IDs
      const { data: madridClubs } = await sb
        .from('clubs')
        .select('id')
        .ilike('city', '%Madrid%')

      const madridIds = (madridClubs ?? []).map((c: any) => c.id)

      if (madridIds.length > 0) {
        const { data: madridStats } = await sb
          .from('rffm_player_stats')
          .select('codjugador, goles')
          .in('club_id', madridIds)
          .eq('cod_temporada', currentSeason)

        // Aggregate by codjugador locally, then resolve names from rffm_players
        const totalsByJugador: Record<string, number> = {}
        madridStats?.forEach((row: any) => {
          const g = Number(row.goles ?? 0)
          totalsByJugador[row.codjugador] = (totalsByJugador[row.codjugador] ?? 0) + g
        })

        // Attach player details
        clubGoleadores = Object.entries(totalsByJugador).map(([codjugador, total]) => ({
          codjugador,
          total_goals: total,
        }))

        // Resolve names via rffm_players
        if (clubGoleadores.length > 0) {
          const playerIds = clubGoleadores.map((g) => g.codjugador)
          const { data: players } = await sb
            .from('rffm_players')
            .select('codjugador, nombre_jugador, anio_nacimiento')
            .in('codjugador', playerIds)
          const mapName = new Map<string, any>()
          players?.forEach((p: any) => mapName.set(p.codjugador, p))
          clubGoleadores = clubGoleadores.map((g) => ({
            codjugador: g.codjugador,
            nombre_jugador: mapName.get(g.codjugador)?.nombre_jugador,
            anio_nacimiento: mapName.get(g.codjugador)?.anio_nacimiento,
            total_goals: g.total_goals,
          }))
        }
      }
    }

    // 5) Build a compact response
    const response = {
      ok: true,
      club: {
        id: club?.id ?? clubId,
        name: club?.name ?? 'Unknown',
        city: club?.city ?? null,
        slug: club?.slug ?? clubSlug ?? null,
      },
      lastMatches: (lastMatches ?? []).map((m: any) => ({
        codacta: m.codacta,
        date: m.fecha,
        home: m.equipo_local,
        away: m.equipo_visitante,
        score: `${m.goles_local ?? 0} - ${m.goles_visitante ?? 0}`,
        acta_cerrada: m.acta_cerrada,
      })),
      currentSeason: currentSeason ?? null,
      goleadMadrid: clubGoleadores,
    }

    return NextResponse.json(response, { status: 200 })
  } catch (e) {
    // Always return a safe error in production-like environments
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 })
  }
}
