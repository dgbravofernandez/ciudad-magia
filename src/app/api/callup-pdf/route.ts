import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getClubContext } from '@/lib/supabase/get-club-id'
import { generateCallupPDF, type CallupPlayer } from '@/lib/pdf/generate-callup'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const sessionId = req.nextUrl.searchParams.get('sessionId')
    if (!sessionId) {
      return NextResponse.json({ error: 'sessionId requerido' }, { status: 400 })
    }

    const { clubId } = await getClubContext()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = createAdminClient() as any

    // Club info (nombre, colores, logo, cif)
    const { data: club } = await sb
      .from('clubs')
      .select('name, primary_color, logo_url')
      .eq('id', clubId)
      .single()

    // Settings (cif puede estar aquí o en clubs; intento ambas)
    let clubCif: string | null = null
    try {
      const { data: settings } = await sb
        .from('club_settings')
        .select('cif')
        .eq('club_id', clubId)
        .single()
      clubCif = settings?.cif ?? null
    } catch {
      clubCif = null
    }

    // Sesión + equipo
    const { data: session } = await sb
      .from('sessions')
      .select('id, team_id, session_date, start_time, opponent, is_home, location, teams(id, name)')
      .eq('id', sessionId)
      .eq('club_id', clubId)
      .single()
    if (!session) {
      return NextResponse.json({ error: 'Partido no encontrado' }, { status: 404 })
    }
    const team = Array.isArray(session.teams) ? session.teams[0] : session.teams

    // Convocatoria
    const { data: callups } = await sb
      .from('match_callups')
      .select('is_starter, players(id, first_name, last_name, dorsal_number, position)')
      .eq('session_id', sessionId)
      .eq('club_id', clubId)

    const players: CallupPlayer[] = (callups ?? [])
      .map((c: { is_starter: boolean; players: { first_name?: string; last_name?: string; dorsal_number?: number | null; position?: string | null } | Array<{ first_name?: string; last_name?: string; dorsal_number?: number | null; position?: string | null }> | null }) => {
        const p = Array.isArray(c.players) ? c.players[0] : c.players
        if (!p) return null
        return {
          dorsal_number: p.dorsal_number ?? null,
          first_name: p.first_name ?? '',
          last_name: p.last_name ?? '',
          position: p.position ?? null,
          is_starter: c.is_starter,
        }
      })
      .filter((p: CallupPlayer | null): p is CallupPlayer => p != null)
      .sort((a: CallupPlayer, b: CallupPlayer) => {
        // Titulares primero, luego dorsal
        if (a.is_starter !== b.is_starter) return a.is_starter ? -1 : 1
        return (a.dorsal_number ?? 999) - (b.dorsal_number ?? 999)
      })

    // Logo → bytes (si es PNG público). Si falla, se omite sin romper.
    let logoPngBytes: Uint8Array | null = null
    if (club?.logo_url && typeof club.logo_url === 'string') {
      try {
        const res = await fetch(club.logo_url, { cache: 'no-store' })
        if (res.ok) {
          const ct = res.headers.get('content-type') ?? ''
          if (ct.includes('png')) {
            logoPngBytes = new Uint8Array(await res.arrayBuffer())
          }
        }
      } catch {
        logoPngBytes = null
      }
    }

    const pdf = await generateCallupPDF({
      clubName: club?.name ?? 'Club',
      clubCif,
      primaryColor: club?.primary_color ?? '#003087',
      logoPngBytes,
      teamName: team?.name ?? '',
      matchDate: session.session_date,
      opponent: session.opponent,
      isHome: session.is_home !== false,
      kickoff: session.start_time ? String(session.start_time).slice(0, 5) : null,
      venue: session.location ?? null,
      coachName: null, // TODO: enriquecer con team_coaches
      players,
      sponsors: [], // TODO: leer de una tabla club_sponsors o similar
    })

    return new NextResponse(new Uint8Array(pdf), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="convocatoria-${session.session_date}.pdf"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
