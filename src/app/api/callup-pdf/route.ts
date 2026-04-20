import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getClubContext } from '@/lib/supabase/get-club-id'
import { generateCallupPDF, type CallupPlayer } from '@/lib/pdf/generate-callup'

export const dynamic = 'force-dynamic'

async function fetchPng(url: string | null | undefined): Promise<Uint8Array | null> {
  if (!url) return null
  try {
    const res = await fetch(url, { cache: 'no-store' })
    if (!res.ok) return null
    const ct = res.headers.get('content-type') ?? ''
    if (!ct.includes('png')) return null
    return new Uint8Array(await res.arrayBuffer())
  } catch {
    return null
  }
}

export async function GET(req: NextRequest) {
  try {
    const sessionId = req.nextUrl.searchParams.get('sessionId')
    if (!sessionId) {
      return NextResponse.json({ error: 'sessionId requerido' }, { status: 400 })
    }

    const { clubId } = await getClubContext()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = createAdminClient() as any

    // Club info
    const { data: club } = await sb
      .from('clubs')
      .select('name, primary_color, logo_url')
      .eq('id', clubId)
      .single()

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
        if (a.is_starter !== b.is_starter) return a.is_starter ? -1 : 1
        return (a.dorsal_number ?? 999) - (b.dorsal_number ?? 999)
      })

    // Entrenador del equipo
    let coachName: string | null = null
    try {
      const { data: coaches } = await sb
        .from('team_coaches')
        .select('role, club_members(full_name)')
        .eq('team_id', session.team_id)
        .limit(5)
      for (const c of (coaches ?? []) as Array<{ role: string | null; club_members: { full_name?: string } | Array<{ full_name?: string }> | null }>) {
        const m = Array.isArray(c.club_members) ? c.club_members[0] : c.club_members
        if (m?.full_name) {
          coachName = m.full_name
          if (c.role === 'entrenador' || c.role == null) break
        }
      }
    } catch {
      coachName = null
    }

    // Logo club
    const logoPngBytes = await fetchPng(club?.logo_url)

    // Patrocinadores activos
    const { data: sponsorRows } = await sb
      .from('club_sponsors')
      .select('name, logo_url, active, sort_order')
      .eq('club_id', clubId)
      .eq('active', true)
      .order('sort_order', { ascending: true })

    const sponsors = await Promise.all(
      ((sponsorRows ?? []) as Array<{ name: string; logo_url: string | null }>).map(async (s) => ({
        name: s.name,
        pngBytes: await fetchPng(s.logo_url),
      }))
    )

    const pdf = await generateCallupPDF({
      clubName: club?.name ?? 'Club',
      primaryColor: club?.primary_color ?? '#003087',
      logoPngBytes,
      teamName: team?.name ?? '',
      matchDate: session.session_date,
      opponent: session.opponent,
      isHome: session.is_home !== false,
      kickoff: session.start_time ? String(session.start_time).slice(0, 5) : null,
      venue: session.location ?? null,
      coachName,
      players,
      sponsors,
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
