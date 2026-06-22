'use server'

import { revalidatePath } from 'next/cache'
import { getScopedClient } from '@/lib/supabase/scoped-client'
import { sendHtmlEmail } from '@/lib/email/send'

/** Lee nombre del club + link de formulario de entrenadores desde club_settings.
 *  El form link puede ser null — en ese caso los emails no incluyen el botón. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getClubMeta(sb: any, clubId: string): Promise<{ clubName: string; coachesFormLink: string | null }> {
  const [{ data: clubRow }, { data: settingsRow }] = await Promise.all([
    sb.from('clubs').select('name').eq('id', clubId).single(),
    sb.from('club_settings').select('coaches_form_link').eq('club_id', clubId).single(),
  ])
  return {
    clubName: (clubRow as { name?: string } | null)?.name ?? 'El Club',
    coachesFormLink: (settingsRow as { coaches_form_link?: string | null } | null)?.coaches_form_link ?? null,
  }
}

function buildCoachFormBlock(formLink: string | null): string {
  if (!formLink) {
    return `<p style="background:#f9f9f9;padding:12px;border-radius:8px;font-size:0.9em;color:#666;text-align:center;">
      El coordinador del club se pondrá en contacto contigo para completar el proceso de inscripción.
    </p>`
  }
  return `<div style="text-align:center;margin:25px 0;">
    <a href="${formLink}" style="background:#ffcc00;color:#000;padding:14px 30px;border-radius:8px;font-weight:bold;text-decoration:none;font-size:16px;display:inline-block;">
      Rellenar formulario de inscripción
    </a>
  </div>
  <p style="font-size:0.85em;color:#888;text-align:center;">O copia este enlace: ${formLink}</p>`
}

export async function sendCoachInvitation(
  email: string,
  name?: string
): Promise<{ success: boolean; error?: string; emailSent?: boolean }> {
  const { sb, clubId } = await getScopedClient()
  if (!clubId) return { success: false, error: 'No autenticado' }

  const { clubName, coachesFormLink } = await getClubMeta(sb, clubId)
  const subject = `Formulario de inscripción para el cuerpo técnico - ${clubName}`
  const body = `<div style="font-family:Arial,sans-serif;padding:25px;border:4px solid #ffcc00;border-radius:15px;color:#333;">
    <h2 style="color:#000;text-align:center;">Bienvenido/a al Cuerpo Técnico - Temporada 26/27</h2>
    <p>Hola${name ? ` <strong>${name}</strong>` : ''},</p>
    <p>Nos ponemos en contacto para invitarte a formar parte del cuerpo técnico de la <strong>${clubName}</strong> la próxima temporada.</p>
    <p>Por favor, rellena el siguiente formulario con tus datos y documentación:</p>
    ${buildCoachFormBlock(coachesFormLink)}
    <hr style="border:none;border-top:1px solid #eee;margin:20px 0;">
    <p style="text-align:center;font-size:0.9em;">Atentamente,<br><strong>La Dirección - ${clubName}</strong></p>
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
  const { sb, clubId } = await getScopedClient()

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

  const { clubName, coachesFormLink } = await getClubMeta(sb, clubId!)
  const subject = `Formulario de inscripción para el cuerpo técnico - ${clubName}`
  const body = `<div style="font-family:Arial,sans-serif;padding:25px;border:4px solid #ffcc00;border-radius:15px;color:#333;">
    <h2 style="color:#000;text-align:center;">Bienvenido/a al Cuerpo Técnico</h2>
    <p>Hola <strong>${member.full_name}</strong>,</p>
    <p>Para completar tu inscripción como entrenador/a en la ${clubName}, necesitamos que rellenes el siguiente formulario con tus datos y documentación:</p>
    ${buildCoachFormBlock(coachesFormLink)}
    <hr style="border:none;border-top:1px solid #eee;margin:20px 0;">
    <p style="text-align:center;font-size:0.9em;">Atentamente,<br><strong>La Dirección - ${clubName}</strong></p>
  </div>`

  const { sent } = await sendHtmlEmail({ to: member.email, subject, html: body })

  // Guardar el form_link real (null si no configurado) en el miembro
  await sb.from('club_members').update({
    form_sent: true,
    form_sent_at: new Date().toISOString(),
    form_link: coachesFormLink,
  }).eq('id', memberId)

  revalidatePath('/entrenadores/staff')
  return { success: true, emailSent: sent }
}

/** Roles que pueden gestionar staff de equipos. */
function canManageStaff(roles: string[]): boolean {
  return roles.some((r) => ['admin', 'direccion', 'director_deportivo'].includes(r))
}

/** Verifica que un member pertenece al club (multi-tenant). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function memberInClub(sb: any, memberId: string, clubId: string): Promise<boolean> {
  const { data } = await sb
    .from('club_members').select('id').eq('id', memberId).eq('club_id', clubId).maybeSingle()
  return !!data
}

export async function assignCoachToTeam(
  memberId: string,
  teamId: string
): Promise<{ success: boolean; error?: string }> {
  const { sb, clubId, roles } = await getScopedClient()
  if (!canManageStaff(roles)) return { success: false, error: 'Sin permisos' }

  const { data: team } = await sb
    .from('teams').select('id').eq('id', teamId).eq('club_id', clubId).single()
  if (!team) return { success: false, error: 'Equipo no encontrado' }
  if (!(await memberInClub(sb, memberId, clubId))) return { success: false, error: 'Miembro no encontrado' }

  const { error } = await sb
    .from('team_coaches')
    .upsert({ team_id: teamId, member_id: memberId, role: 'entrenador' }, { onConflict: 'team_id,member_id' })
  if (error) return { success: false, error: error.message }

  await sb.from('club_member_roles').upsert(
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
  const { sb, clubId, roles } = await getScopedClient()
  if (!canManageStaff(roles)) return { success: false, error: 'Sin permisos' }

  const { data: team } = await sb
    .from('teams').select('id').eq('id', teamId).eq('club_id', clubId).single()
  if (!team) return { success: false, error: 'Equipo no encontrado' }

  const { error } = await sb
    .from('team_coaches').delete().eq('team_id', teamId).eq('member_id', memberId)
  if (error) return { success: false, error: error.message }

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

export async function getCoachesForPlanning(): Promise<{ success: boolean; coaches?: CoachForPlanning[]; error?: string }> {
  const { sb, clubId } = await getScopedClient()

  if (!clubId) return { success: false, error: 'No se pudo obtener el club' }

  const { data: clubMemberRows } = await sb
    .from('club_members').select('id').eq('club_id', clubId).eq('active', true)
  const clubMemberIds: string[] = (clubMemberRows ?? []).map((m: { id: string }) => m.id)

  const { data: roleRows } = await sb
    .from('club_member_roles')
    .select('member_id')
    .in('member_id', clubMemberIds.length > 0 ? clubMemberIds : ['__no_match__'])
    .in('role', ['entrenador', 'coordinador'])
  const roleIds: string[] = (roleRows ?? []).map((r: { member_id: string }) => r.member_id)

  const { data: clubTeams } = await sb.from('teams').select('id').eq('club_id', clubId)
  const teamIds = (clubTeams ?? []).map((t: { id: string }) => t.id)

  let tcIds: string[] = []
  if (teamIds.length > 0) {
    const { data: tcRows } = await sb.from('team_coaches').select('member_id').in('team_id', teamIds)
    tcIds = (tcRows ?? []).map((r: { member_id: string }) => r.member_id)
  }

  const allIds = [...new Set([...roleIds, ...tcIds])]

  if (allIds.length === 0) {
    const { data, error } = await sb
      .from('club_members').select('id, full_name, email').eq('club_id', clubId).order('full_name')
    if (error) return { success: false, error: error.message }
    return { success: true, coaches: (data ?? []).map((c: { id: string; full_name: string; email: string | null }) => ({ ...c, role: 'entrenador' })) }
  }

  const { data, error } = await sb
    .from('club_members').select('id, full_name, email').eq('club_id', clubId).in('id', allIds).order('full_name')
  if (error) return { success: false, error: error.message }
  return { success: true, coaches: (data ?? []).map((c: { id: string; full_name: string; email: string | null }) => ({ ...c, role: 'entrenador' })) }
}

export async function assignCoordinatorToTeam(
  memberId: string,
  teamId: string
): Promise<{ success: boolean; error?: string }> {
  const { sb, clubId, roles } = await getScopedClient()
  if (!canManageStaff(roles)) return { success: false, error: 'Sin permisos' }

  const { data: team } = await sb.from('teams').select('id').eq('id', teamId).eq('club_id', clubId).single()
  if (!team) return { success: false, error: 'Equipo no encontrado' }
  if (!(await memberInClub(sb, memberId, clubId))) return { success: false, error: 'Miembro no encontrado' }

  const { error } = await sb.from('team_coaches').upsert(
    { team_id: teamId, member_id: memberId, role: 'coordinador' },
    { onConflict: 'team_id,member_id' }
  )
  if (error) return { success: false, error: error.message }

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
  const { sb, clubId, roles } = await getScopedClient()
  if (!canManageStaff(roles)) return { success: false, error: 'Sin permisos' }

  const { data: team } = await sb.from('teams').select('id').eq('id', teamId).eq('club_id', clubId).single()
  if (!team) return { success: false, error: 'Equipo no encontrado' }

  await sb.from('team_coaches').delete().eq('member_id', memberId).eq('team_id', teamId).eq('role', 'coordinador')
  revalidatePath('/entrenadores/staff')
  revalidatePath('/entrenadores')
  return { success: true }
}

export async function saveEvaluation(data: {
  memberId: string
  observerId: string
  teamId: string
  period: 'P1' | 'P2' | 'P3'
  season: string
  nivelRating: number
  ajenoRating: number
  notes: string
  clubId?: string // ignorado: el club se deriva del contexto (multi-tenant)
}): Promise<{ success: boolean; error?: string }> {
  // SEC: club del contexto + validación de roles y pertenencia, nunca del input.
  const { sb, clubId, roles } = await getScopedClient()
  if (!clubId) return { success: false, error: 'Sin club' }
  if (!roles.some((r) => ['admin', 'direccion', 'director_deportivo', 'coordinador'].includes(r))) {
    return { success: false, error: 'Sin permisos' }
  }

  // Verificar que equipo y entrenador evaluado pertenecen al club
  const [{ data: team }, coachOk] = await Promise.all([
    sb.from('teams').select('id').eq('id', data.teamId).eq('club_id', clubId).maybeSingle(),
    memberInClub(sb, data.memberId, clubId),
  ])
  if (!team) return { success: false, error: 'Equipo no encontrado' }
  if (!coachOk) return { success: false, error: 'Entrenador no encontrado' }

  const { error } = await sb.from('coordinator_observations').upsert({
    club_id: clubId, team_id: data.teamId, observer_id: data.observerId,
    coach_id: data.memberId, period: data.period, season: data.season,
    nivel_rating: data.nivelRating, ajeno_rating: data.ajenoRating, notes: data.notes,
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
  const { sb, clubId } = await getScopedClient()
  const { error } = await sb
    .from('club_members').update(data).eq('id', memberId).eq('club_id', clubId)
  if (error) return { success: false, error: error.message }
  revalidatePath('/entrenadores/staff')
  return { success: true }
}
