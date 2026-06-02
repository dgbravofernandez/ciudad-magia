'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import { getClubId, getClubContext } from '@/lib/supabase/get-club-id'
import { COACHES_FORM_LINK } from '@/features/jugadores/constants'
import { sendHtmlEmail } from '@/lib/email/send'

export async function sendCoachInvitation(
  email: string,
  name?: string
): Promise<{ success: boolean; error?: string; emailSent?: boolean }> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const _sb = createAdminClient() as any
  const _clubId = await getClubId()
  const { data: _clubRow } = _clubId ? await _sb.from('clubs').select('name').eq('id', _clubId).single() : { data: null }
  const CLUB: string = (_clubRow as { name?: string } | null)?.name ?? 'El Club'
  const subject = `Formulario de inscripción para el cuerpo técnico - ${CLUB}`
  const body = `<div style="font-family:Arial,sans-serif;padding:25px;border:4px solid #ffcc00;border-radius:15px;color:#333;">
    <h2 style="color:#000;text-align:center;">Bienvenido/a al Cuerpo Técnico - Temporada 26/27</h2>
    <p>Hola${name ? ` <strong>${name}</strong>` : ''},</p>
    <p>Nos ponemos en contacto para invitarte a formar parte del cuerpo técnico de la <strong>${CLUB}</strong> la próxima temporada.</p>
    <p>Por favor, rellena el siguiente formulario con tus datos y documentación:</p>
    <div style="text-align:center;margin:25px 0;">
      <a href="${COACHES_FORM_LINK}" style="background:#ffcc00;color:#000;padding:14px 30px;border-radius:8px;font-weight:bold;text-decoration:none;font-size:16px;display:inline-block;">
        Rellenar formulario de inscripción
      </a>
    </div>
    <p style="font-size:0.85em;color:#888;text-align:center;">O copia este enlace: ${COACHES_FORM_LINK}</p>
    <hr style="border:none;border-top:1px solid #eee;margin:20px 0;">
    <p style="text-align:center;font-size:0.9em;">Atentamente,<br><strong>La Dirección - ${CLUB}</strong></p>
  </div>`

  try {
    const { sent } = await sendHtmlEmail({ to: email, subject, html: body })
    return { success: true, emailSent: sent }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Error al enviar' }
  }
}

export async function sendCoachFormLink(
  memberId: string
): Promise<{ success: boolean; error?: string; emailSent?: boolean }> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createAdminClient() as any
  const clubId = await getClubId()

  const { data: member } = await sb
    .from('club_members')
    .select('id, full_name, email, form_sent')
    .eq('id', memberId)
    .eq('club_id', clubId)
    .single()

  if (!member) return { success: false, error: 'Entrenador no encontrado' }
  if (!member.email || member.email.includes('@pendiente.local')) {
    return { success: false, error: 'Sin email válido' }
  }

  const { data: coachClubRow } = clubId ? await sb.from('clubs').select('name').eq('id', clubId).single() : { data: null }
  const CLUB: string = (coachClubRow as { name?: string } | null)?.name ?? 'El Club'
  const subject = `Formulario de inscripción para el cuerpo técnico - ${CLUB}`
  const body = `<div style="font-family:Arial,sans-serif;padding:25px;border:4px solid #ffcc00;border-radius:15px;color:#333;">
    <h2 style="color:#000;text-align:center;">Bienvenido/a al Cuerpo Técnico</h2>
    <p>Hola <strong>${member.full_name}</strong>,</p>
    <p>Para completar tu inscripción como entrenador/a en la ${CLUB}, necesitamos que rellenes el siguiente formulario con tus datos y documentación:</p>
    <div style="text-align:center;margin:25px 0;">
      <a href="${COACHES_FORM_LINK}" style="background:#ffcc00;color:#000;padding:14px 30px;border-radius:8px;font-weight:bold;text-decoration:none;font-size:16px;display:inline-block;">
        Rellenar formulario de inscripción
      </a>
    </div>
    <p style="font-size:0.85em;color:#888;text-align:center;">O copia este enlace: ${COACHES_FORM_LINK}</p>
    <hr style="border:none;border-top:1px solid #eee;margin:20px 0;">
    <p style="text-align:center;font-size:0.9em;">Atentamente,<br><strong>La Dirección - ${CLUB}</strong></p>
  </div>`

  const { sent } = await sendHtmlEmail({ to: member.email, subject, html: body })

  // Mark form as sent
  await sb.from('club_members').update({
    form_sent: true,
    form_sent_at: new Date().toISOString(),
    form_link: COACHES_FORM_LINK,
  }).eq('id', memberId)

  revalidatePath('/entrenadores/staff')
  return { success: true, emailSent: sent }
}

export async function assignCoachToTeam(
  memberId: string,
  teamId: string
): Promise<{ success: boolean; error?: string }> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createAdminClient() as any
  const clubId = await getClubId()

  // Verify team belongs to this club
  const { data: team } = await sb
    .from('teams')
    .select('id')
    .eq('id', teamId)
    .eq('club_id', clubId)
    .single()
  if (!team) return { success: false, error: 'Equipo no encontrado' }

  // Upsert into team_coaches (drives sessions, lineup, roster access)
  const { error } = await sb
    .from('team_coaches')
    .upsert({ team_id: teamId, member_id: memberId, role: 'entrenador' }, { onConflict: 'team_id,member_id' })
  if (error) return { success: false, error: error.message }

  // Ensure entrenador role exists — constraint is UNIQUE(member_id, role)
  await sb
    .from('club_member_roles')
    .upsert(
      { member_id: memberId, role: 'entrenador' },
      { onConflict: 'member_id,role', ignoreDuplicates: true }
    )

  revalidatePath('/entrenadores/staff')
  revalidatePath('/entrenadores')
  revalidatePath('/jugadores/inscripciones')
  return { success: true }
}

export async function removeCoachFromTeam(
  memberId: string,
  teamId: string
): Promise<{ success: boolean; error?: string }> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createAdminClient() as any
  const clubId = await getClubId()

  // Verify team belongs to this club
  const { data: team } = await sb
    .from('teams')
    .select('id')
    .eq('id', teamId)
    .eq('club_id', clubId)
    .single()
  if (!team) return { success: false, error: 'Equipo no encontrado' }

  const { error } = await sb
    .from('team_coaches')
    .delete()
    .eq('team_id', teamId)
    .eq('member_id', memberId)
  if (error) return { success: false, error: error.message }

  // Keep the entrenador role in club_member_roles — only remove the team assignment
  revalidatePath('/entrenadores/staff')
  revalidatePath('/entrenadores')
  revalidatePath('/jugadores/inscripciones')
  return { success: true }
}

export interface CoachForPlanning {
  id: string
  full_name: string
  role?: string
  email: string | null
}

/**
 * Lista los entrenadores disponibles para asignar a equipos borrador de la próxima temporada.
 *
 * Estrategia (UNION):
 *  1. Miembros con rol 'entrenador' o 'coordinador' en club_member_roles → incluye coaches nuevos
 *     que aún no tienen equipo asignado pero ya rellenaron el formulario.
 *  2. Miembros que aparecen en team_coaches de algún equipo del club → incluye coaches
 *     que fueron asignados directamente sin pasar por club_member_roles.
 *  Resultado: la unión de ambos conjuntos, sin duplicados.
 */
export async function getCoachesForPlanning(): Promise<{ success: boolean; coaches?: CoachForPlanning[]; error?: string }> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createAdminClient() as any
  const { clubId } = await getClubContext()

  if (!clubId) return { success: false, error: 'No se pudo obtener el club' }

  // Obtener IDs de miembros activos del club — necesario para filtrar club_member_roles
  // (que no tiene club_id directamente) y garantizar aislamiento multi-tenant
  const { data: clubMemberRows } = await sb
    .from('club_members')
    .select('id')
    .eq('club_id', clubId)
    .eq('active', true)
  const clubMemberIds: string[] = (clubMemberRows ?? []).map((m: { id: string }) => m.id)

  // Set 1: miembros con rol entrenador/coordinador en club_member_roles
  // Filtramos por member_id ∈ clubMemberIds para garantizar que son de este club
  const { data: roleRows } = await sb
    .from('club_member_roles')
    .select('member_id')
    .in('member_id', clubMemberIds.length > 0 ? clubMemberIds : ['__no_match__'])
    .in('role', ['entrenador', 'coordinador'])

  const roleIds: string[] = (roleRows ?? []).map((r: { member_id: string }) => r.member_id)

  // Set 2: miembros asignados a algún equipo del club (team_coaches)
  const { data: clubTeams } = await sb
    .from('teams')
    .select('id')
    .eq('club_id', clubId)

  const teamIds = (clubTeams ?? []).map((t: { id: string }) => t.id)

  let tcIds: string[] = []
  if (teamIds.length > 0) {
    const { data: tcRows } = await sb
      .from('team_coaches')
      .select('member_id')
      .in('team_id', teamIds)
    tcIds = (tcRows ?? []).map((r: { member_id: string }) => r.member_id)
  }

  // Unión sin duplicados
  const allIds = [...new Set([...roleIds, ...tcIds])]

  if (allIds.length === 0) {
    // Último fallback: cualquier miembro activo del club
    const { data, error } = await sb
      .from('club_members')
      .select('id, full_name, email')
      .eq('club_id', clubId)
      .order('full_name')
    if (error) return { success: false, error: error.message }
    return { success: true, coaches: (data ?? []).map((c: { id: string; full_name: string; email: string | null }) => ({ ...c, role: 'entrenador' })) }
  }

  const { data, error } = await sb
    .from('club_members')
    .select('id, full_name, email')
    .eq('club_id', clubId)
    .in('id', allIds)
    .order('full_name')

  if (error) return { success: false, error: error.message }
  return { success: true, coaches: (data ?? []).map((c: { id: string; full_name: string; email: string | null }) => ({ ...c, role: 'entrenador' })) }
}

export async function assignCoordinatorToTeam(
  memberId: string,
  teamId: string
): Promise<{ success: boolean; error?: string }> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createAdminClient() as any
  const clubId = await getClubId()

  const { data: team } = await sb.from('teams').select('id').eq('id', teamId).eq('club_id', clubId).single()
  if (!team) return { success: false, error: 'Equipo no encontrado' }

  // Use team_coaches for the team assignment (supports multiple teams)
  const { error } = await sb.from('team_coaches').upsert(
    { team_id: teamId, member_id: memberId, role: 'coordinador' },
    { onConflict: 'team_id,member_id' }
  )
  if (error) return { success: false, error: error.message }

  // Ensure coordinador base role exists in club_member_roles (no team_id)
  await sb.from('club_member_roles').upsert(
    { member_id: memberId, role: 'coordinador' },
    { onConflict: 'member_id,role', ignoreDuplicates: true }
  )

  revalidatePath('/entrenadores/staff')
  revalidatePath('/entrenadores')
  return { success: true }
}

export async function removeCoordinatorFromTeam(
  memberId: string,
  teamId: string
): Promise<{ success: boolean; error?: string }> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createAdminClient() as any

  // Remove from team_coaches (the team assignment)
  await sb.from('team_coaches').delete().eq('member_id', memberId).eq('team_id', teamId).eq('role', 'coordinador')

  // Keep the coordinador role in club_member_roles — don't delete it
  revalidatePath('/entrenadores/staff')
  revalidatePath('/entrenadores')
  return { success: true }
}

export async function saveEvaluation(data: {
  memberId: string  // coach being evaluated
  observerId: string // coordinator doing the evaluation
  teamId: string
  period: 'P1' | 'P2' | 'P3'
  season: string
  nivelRating: number
  ajenoRating: number
  notes: string
  clubId: string
}): Promise<{ success: boolean; error?: string }> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createAdminClient() as any

  const { error } = await sb.from('coordinator_observations').upsert({
    club_id: data.clubId,
    team_id: data.teamId,
    observer_id: data.observerId,
    coach_id: data.memberId,
    period: data.period,
    season: data.season,
    nivel_rating: data.nivelRating,
    ajeno_rating: data.ajenoRating,
    notes: data.notes,
  }, { onConflict: 'observer_id,team_id,period,season' })

  if (error) return { success: false, error: error.message }
  revalidatePath('/entrenadores/staff')
  revalidatePath('/entrenadores/observaciones')
  return { success: true }
}

export async function updateCoachProfile(
  memberId: string,
  data: { phone?: string; avatar_url?: string }
): Promise<{ success: boolean; error?: string }> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createAdminClient() as any
  const clubId = await getClubId()
  const { error } = await sb
    .from('club_members')
    .update(data)
    .eq('id', memberId)
    .eq('club_id', clubId)
  if (error) return { success: false, error: error.message }
  revalidatePath('/entrenadores/staff')
  return { success: true }
}
