'use server'
/* eslint-disable no-restricted-imports -- superadmin platform-level operations, no club_id context */

import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { headers, cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { signValue } from '@/lib/utils/hmac'

/**
 * Verifica que el usuario actual es superadmin. Lanza (redirect) si no.
 * SEC C-1: el header x-platform-role es solo un fast-path — la fuente de verdad
 * es SIEMPRE la tabla platform_admins contra la sesión real. Aunque el middleware
 * sanea los headers entrantes, aquí no confiamos en el header para CONCEDER acceso.
 */
async function assertSuperAdmin() {
  const headersList = await headers()
  const platformRole = headersList.get('x-platform-role')
  if (platformRole !== 'superadmin') {
    redirect('/dashboard')
  }
  // Double-check en BD: el header solo evita la query cuando el middleware ya
  // negó el acceso; para concederlo exigimos fila en platform_admins.
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createAdminClient() as any
  const { data: adminRow } = await sb
    .from('platform_admins')
    .select('user_id')
    .eq('user_id', user.id)
    .maybeSingle()
  if (!adminRow) redirect('/dashboard')
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
  // Leads / ciclo de vida comercial
  subscription_status: string | null
  trial_ends_at: string | null
  acquisition_source: string | null
  acquisition_campaign: string | null
  acquisition_content: string | null
  contact_phone: string | null
  owner_email: string | null
  last_activity: string | null   // último jugador o pago creado — proxy de uso real
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
        subscription_status, trial_ends_at,
        acquisition_source, acquisition_campaign, acquisition_content, contact_phone,
        club_settings (
          backend_sheet_id, backend_sheet_last_sync, current_season
        )
      `)
      .order('created_at', { ascending: false })

    if (error) return { success: false, error: error.message }

    // Agregar conteos por club en paralelo
    const summaries: ClubSummary[] = await Promise.all(
      (clubs ?? []).map(async (club: any) => {
        const [
          { count: playerCount },
          { count: teamCount },
          { count: memberCount },
          { data: owner },
          { data: lastPlayer },
          { data: lastPayment },
        ] = await Promise.all([
          sb.from('players').select('id', { count: 'exact', head: true }).eq('club_id', club.id).eq('status', 'active'),
          sb.from('teams').select('id', { count: 'exact', head: true }).eq('club_id', club.id).eq('active', true),
          sb.from('club_members').select('id', { count: 'exact', head: true }).eq('club_id', club.id).eq('active', true),
          sb.from('club_members').select('email').eq('club_id', club.id).eq('active', true).order('created_at', { ascending: true }).limit(1).maybeSingle(),
          sb.from('players').select('created_at').eq('club_id', club.id).order('created_at', { ascending: false }).limit(1).maybeSingle(),
          sb.from('quota_payments').select('created_at').eq('club_id', club.id).order('created_at', { ascending: false }).limit(1).maybeSingle(),
        ])

        const activityDates = [lastPlayer?.created_at, lastPayment?.created_at].filter(Boolean) as string[]
        const lastActivity = activityDates.length > 0 ? activityDates.sort().at(-1)! : null

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
          subscription_status: club.subscription_status ?? null,
          trial_ends_at: club.trial_ends_at ?? null,
          acquisition_source: club.acquisition_source ?? null,
          acquisition_campaign: club.acquisition_campaign ?? null,
          acquisition_content: club.acquisition_content ?? null,
          contact_phone: club.contact_phone ?? null,
          owner_email: owner?.email ?? null,
          last_activity: lastActivity,
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

/** Inicia impersonación de un club: guarda cookie firmada con HMAC y redirige al dashboard */
export async function impersonateClub(clubId: string): Promise<void> {
  await assertSuperAdmin()

  // Obtener userId para incluirlo en la firma — impide reutilizar la cookie entre usuarios
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Firma HMAC: payload = "clubId:userId", clave = APP_SECRET
  const secret = process.env.APP_SECRET
  if (!secret) {
    console.error('[superadmin] APP_SECRET no configurado — impersonación rechazada')
    redirect('/superadmin?error=misconfiguration')
  }
  const payload = `${clubId}:${user.id}`
  const signed = await signValue(payload, secret)

  const cookieStore = await cookies()
  cookieStore.set('superadmin_impersonate', signed, {
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

// ─── Precios por plan (mensual) para MRR ────────────────────────────────────
const PLAN_PRICES: Record<string, number> = {
  basic: 39,
  starter: 39,
  pro: 89,
  club: 149,
  enterprise: 149,
  personalizado: 249,
}

/** Métricas de conversión: MRR, trials, pipeline */
export async function getConversionMetrics(): Promise<{
  success: boolean
  data?: {
    mrr: number
    arr: number
    activeCustomers: number
    trialActive: number
    trialUrgent: number   // expira ≤3 días
    trialExpired: number  // caducado sin convertir
    pastDue: number
    churnedThisMonth: number
    leadsTotal: number
    leadsSent: number
    leadsOpened: number
    demos: number
    conversionRate: number  // trials → activos (histórico)
    urgentClubs: Array<{
      id: string
      name: string
      owner_email: string | null
      trial_ends_at: string | null
      daysLeft: number
      last_activity: string | null
      player_count: number
    }>
  }
  error?: string
}> {
  try {
    await assertSuperAdmin()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = createAdminClient() as any

    const now = new Date()
    const threeDaysFromNow = new Date(now.getTime() + 3 * 86_400_000).toISOString()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()

    const [
      { data: activeClubs },
      { data: trialClubs },
      { count: pastDueCount },
      { count: churnCount },
      { count: leadsTotal },
      { count: leadsSentCount },
      { count: leadsOpenedCount },
      { count: demosCount },
    ] = await Promise.all([
      sb.from('clubs').select('plan').eq('subscription_status', 'active').eq('active', true),
      sb.from('clubs').select('id, name, trial_ends_at').eq('subscription_status', 'trial').eq('active', true),
      sb.from('clubs').select('id', { count: 'exact', head: true }).eq('subscription_status', 'past_due'),
      sb.from('clubs').select('id', { count: 'exact', head: true }).eq('subscription_status', 'canceled').gte('updated_at', startOfMonth),
      sb.from('marketing_clubs').select('id', { count: 'exact', head: true }),
      sb.from('marketing_clubs').select('id', { count: 'exact', head: true }).not('status', 'eq', 'pending').eq('excluded', false),
      sb.from('marketing_email_sends').select('id', { count: 'exact', head: true }).not('opened_at', 'is', null),
      sb.from('marketing_demos').select('id', { count: 'exact', head: true }).neq('status', 'canceled'),
    ])

    // MRR
    const mrr = (activeClubs ?? []).reduce((sum: number, c: { plan: string }) => sum + (PLAN_PRICES[c.plan] ?? 0), 0)

    // Trial stats
    const allTrials = trialClubs ?? []
    const trialActive = allTrials.filter((t: { trial_ends_at: string | null }) => {
      if (!t.trial_ends_at) return true
      return new Date(t.trial_ends_at) > now
    }).length
    const trialUrgent = allTrials.filter((t: { trial_ends_at: string | null }) => {
      if (!t.trial_ends_at) return false
      const d = new Date(t.trial_ends_at)
      return d > now && d <= new Date(threeDaysFromNow)
    }).length
    const trialExpired = allTrials.filter((t: { trial_ends_at: string | null }) => {
      if (!t.trial_ends_at) return false
      return new Date(t.trial_ends_at) <= now
    }).length

    // Clubs urgentes (trial expira ≤3d o ya caducó) con detalle
    const urgentTrialIds = allTrials
      .filter((t: { id: string; trial_ends_at: string | null }) => {
        if (!t.trial_ends_at) return false
        const d = new Date(t.trial_ends_at)
        return d <= new Date(threeDaysFromNow)
      })
      .map((t: { id: string }) => t.id)

    let urgentClubs: Array<{
      id: string; name: string; owner_email: string | null
      trial_ends_at: string | null; daysLeft: number; last_activity: string | null; player_count: number
    }> = []

    if (urgentTrialIds.length > 0) {
      const { data: urgentData } = await sb
        .from('clubs')
        .select('id, name, trial_ends_at')
        .in('id', urgentTrialIds)
        .order('trial_ends_at', { ascending: true })

      urgentClubs = await Promise.all(
        (urgentData ?? []).map(async (c: { id: string; name: string; trial_ends_at: string | null }) => {
          const [{ data: owner }, { count: playerCount }, { data: lastPlayer }] = await Promise.all([
            sb.from('club_members').select('email').eq('club_id', c.id).eq('active', true).order('created_at', { ascending: true }).limit(1).maybeSingle(),
            sb.from('players').select('id', { count: 'exact', head: true }).eq('club_id', c.id).eq('status', 'active'),
            sb.from('players').select('created_at').eq('club_id', c.id).order('created_at', { ascending: false }).limit(1).maybeSingle(),
          ])
          const daysLeft = c.trial_ends_at
            ? Math.ceil((new Date(c.trial_ends_at).getTime() - now.getTime()) / 86_400_000)
            : 99
          return {
            id: c.id,
            name: c.name,
            owner_email: owner?.email ?? null,
            trial_ends_at: c.trial_ends_at,
            daysLeft,
            last_activity: lastPlayer?.created_at ?? null,
            player_count: playerCount ?? 0,
          }
        })
      )
    }

    const totalHistoricTrials = (activeClubs?.length ?? 0) + allTrials.length
    const conversionRate = totalHistoricTrials > 0
      ? Math.round(((activeClubs?.length ?? 0) / totalHistoricTrials) * 100)
      : 0

    return {
      success: true,
      data: {
        mrr,
        arr: mrr * 12,
        activeCustomers: activeClubs?.length ?? 0,
        trialActive,
        trialUrgent,
        trialExpired,
        pastDue: pastDueCount ?? 0,
        churnedThisMonth: churnCount ?? 0,
        leadsTotal: leadsTotal ?? 0,
        leadsSent: leadsSentCount ?? 0,
        leadsOpened: leadsOpenedCount ?? 0,
        demos: demosCount ?? 0,
        conversionRate,
        urgentClubs,
      },
    }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
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
