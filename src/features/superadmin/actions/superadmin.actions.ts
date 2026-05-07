'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { headers, cookies } from 'next/headers'
import { redirect } from 'next/navigation'

/** Verifica que el usuario actual es superadmin. Lanza si no. */
async function assertSuperAdmin() {
  const headersList = await headers()
  const platformRole = headersList.get('x-platform-role')
  if (platformRole !== 'superadmin') {
    redirect('/dashboard')
  }
}

export type ClubSummary = {
  id: string
  name: string
  slug: string
  logo_url: string | null
  plan: string
  active: boolean
  created_at: string
  notes: string | null
  player_count: number
  team_count: number
  member_count: number
  has_google_sheet: boolean
  last_sheet_sync: string | null
  current_season: string | null
}

/** Devuelve todos los clubs con métricas agregadas para el panel superadmin */
export async function getAllClubsWithMetrics(): Promise<{
  success: boolean
  clubs?: ClubSummary[]
  error?: string
}> {
  try {
    await assertSuperAdmin()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = createAdminClient() as any

    const { data: clubs, error } = await sb
      .from('clubs')
      .select(`
        id, name, slug, logo_url, plan, active, created_at, notes,
        club_settings (
          backend_sheet_id, backend_sheet_last_sync, current_season
        )
      `)
      .order('created_at', { ascending: false })

    if (error) return { success: false, error: error.message }

    // Agregar conteos por club en paralelo
    const summaries: ClubSummary[] = await Promise.all(
      (clubs ?? []).map(async (club: any) => {
        const [{ count: playerCount }, { count: teamCount }, { count: memberCount }] =
          await Promise.all([
            sb.from('players').select('id', { count: 'exact', head: true }).eq('club_id', club.id).eq('status', 'active'),
            sb.from('teams').select('id', { count: 'exact', head: true }).eq('club_id', club.id).eq('active', true),
            sb.from('club_members').select('id', { count: 'exact', head: true }).eq('club_id', club.id).eq('active', true),
          ])

        const settings = club.club_settings?.[0] ?? club.club_settings ?? null
        return {
          id: club.id,
          name: club.name,
          slug: club.slug,
          logo_url: club.logo_url,
          plan: club.plan ?? 'starter',
          active: club.active,
          created_at: club.created_at,
          notes: club.notes,
          player_count: playerCount ?? 0,
          team_count: teamCount ?? 0,
          member_count: memberCount ?? 0,
          has_google_sheet: !!settings?.backend_sheet_id,
          last_sheet_sync: settings?.backend_sheet_last_sync ?? null,
          current_season: settings?.current_season ?? null,
        }
      })
    )

    return { success: true, clubs: summaries }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

/** Métricas globales de la plataforma */
export async function getPlatformMetrics(): Promise<{
  success: boolean
  metrics?: {
    total_clubs: number
    active_clubs: number
    total_players: number
    total_members: number
    clubs_with_sheets: number
  }
  error?: string
}> {
  try {
    await assertSuperAdmin()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = createAdminClient() as any

    const [
      { count: totalClubs },
      { count: activeClubs },
      { count: totalPlayers },
      { count: totalMembers },
      { count: clubsWithSheets },
    ] = await Promise.all([
      sb.from('clubs').select('id', { count: 'exact', head: true }),
      sb.from('clubs').select('id', { count: 'exact', head: true }).eq('active', true),
      sb.from('players').select('id', { count: 'exact', head: true }).eq('status', 'active'),
      sb.from('club_members').select('id', { count: 'exact', head: true }).eq('active', true),
      sb.from('club_settings').select('id', { count: 'exact', head: true }).not('backend_sheet_id', 'is', null),
    ])

    return {
      success: true,
      metrics: {
        total_clubs: totalClubs ?? 0,
        active_clubs: activeClubs ?? 0,
        total_players: totalPlayers ?? 0,
        total_members: totalMembers ?? 0,
        clubs_with_sheets: clubsWithSheets ?? 0,
      },
    }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

/** Inicia impersonación de un club: guarda cookie y redirige al dashboard de ese club */
export async function impersonateClub(clubId: string): Promise<void> {
  await assertSuperAdmin()
  const cookieStore = await cookies()
  cookieStore.set('superadmin_impersonate', clubId, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 60 * 60 * 8, // 8 horas
    path: '/',
  })
  redirect('/dashboard')
}

/**
 * Termina la impersonación y vuelve al panel superadmin.
 *
 * Diseño intencional: NO se llama a assertSuperAdmin() aquí.
 * Cualquier usuario (incluido un admin de club mientras se le impersona)
 * debe poder salir de la impersonación. La acción es segura porque solo
 * elimina la cookie — nunca escribe datos ni eleva privilegios.
 */
export async function stopImpersonation(): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.delete('superadmin_impersonate')
  redirect('/superadmin')
}

/** Actualiza las notas internas de un club */
export async function updateClubNotes(clubId: string, notes: string): Promise<{ success: boolean; error?: string }> {
  try {
    await assertSuperAdmin()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = createAdminClient() as any
    const { error } = await sb.from('clubs').update({ notes }).eq('id', clubId)
    if (error) return { success: false, error: error.message }
    return { success: true }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

/** Activa o desactiva un club */
export async function toggleClubActive(clubId: string, active: boolean): Promise<{ success: boolean; error?: string }> {
  try {
    await assertSuperAdmin()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = createAdminClient() as any
    const { error } = await sb.from('clubs').update({ active }).eq('id', clubId)
    if (error) return { success: false, error: error.message }
    return { success: true }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

/** Detalle completo de un club para el superadmin */
export async function getClubDetail(clubId: string): Promise<{
  success: boolean
  data?: {
    club: any
    settings: any
    recentSessions: any[]
    recentPayments: any[]
    recentErrors: any[]
  }
  error?: string
}> {
  try {
    await assertSuperAdmin()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = createAdminClient() as any

    const [
      { data: club },
      { data: settings },
      { data: recentSessions },
      { data: recentPayments },
    ] = await Promise.all([
      sb.from('clubs').select('*').eq('id', clubId).single(),
      sb.from('club_settings').select('*').eq('club_id', clubId).single(),
      sb.from('sessions').select('id, session_date, session_type, teams(name)').eq('club_id', clubId).order('session_date', { ascending: false }).limit(10),
      sb.from('quota_payments').select('id, amount, method, status, created_at').eq('club_id', clubId).order('created_at', { ascending: false }).limit(10),
    ])

    return {
      success: true,
      data: {
        club,
        settings,
        recentSessions: recentSessions ?? [],
        recentPayments: recentPayments ?? [],
        recentErrors: [],
      },
    }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}
