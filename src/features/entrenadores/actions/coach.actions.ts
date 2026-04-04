'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { getClubId } from '@/lib/supabase/get-club-id'
import { COACHES_FORM_LINK } from '@/features/jugadores/constants'
import { sendHtmlEmail } from '@/lib/email/send'

export async function sendCoachInvitation(
  email: string,
  name?: string
): Promise<{ success: boolean; error?: string; emailSent?: boolean }> {
  const CLUB = 'Escuela de Fútbol Ciudad de Getafe'
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
  const supabase = await createClient()
  const clubId = await getClubId()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any

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

  const CLUB = 'Escuela de Fútbol Ciudad de Getafe'
  const subject = `Formulario de inscripción para el cuerpo técnico - ${CLUB}`
  const body = `<div style="font-family:Arial,sans-serif;padding:25px;border:4px solid #ffcc00;border-radius:15px;color:#333;">
    <h2 style="color:#000;text-align:center;">Bienvenido/a al Cuerpo Técnico - Temporada 26/27</h2>
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
  const supabase = await createClient()
  const clubId = await getClubId()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any

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

  // Ensure entrenador role exists for this member (with team context)
  await sb
    .from('club_member_roles')
    .upsert(
      { member_id: memberId, role: 'entrenador', team_id: teamId },
      { onConflict: 'member_id,role,team_id', ignoreDuplicates: true }
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
  const supabase = await createClient()
  const clubId = await getClubId()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any

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

  // Also remove the team-specific role entry
  await sb
    .from('club_member_roles')
    .delete()
    .eq('member_id', memberId)
    .eq('role', 'entrenador')
    .eq('team_id', teamId)

  revalidatePath('/entrenadores/staff')
  revalidatePath('/entrenadores')
  revalidatePath('/jugadores/inscripciones')
  return { success: true }
}

export async function assignCoordinatorToTeam(
  memberId: string,
  teamId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()
  const clubId = await getClubId()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any

  const { data: team } = await sb.from('teams').select('id').eq('id', teamId).eq('club_id', clubId).single()
  if (!team) return { success: false, error: 'Equipo no encontrado' }

  // coordinator_team_assignments: drives what teams the coordinator sees/evaluates
  const { error } = await sb
    .from('coordinator_team_assignments')
    .upsert({ club_id: clubId, member_id: memberId, team_id: teamId }, { onConflict: 'member_id,team_id', ignoreDuplicates: true })
  if (error) return { success: false, error: error.message }

  // Ensure coordinador role exists for this member
  await sb.from('club_member_roles').upsert(
    { member_id: memberId, role: 'coordinador', team_id: teamId },
    { onConflict: 'member_id,role,team_id', ignoreDuplicates: true }
  )

  revalidatePath('/entrenadores/staff')
  revalidatePath('/entrenadores')
  return { success: true }
}

export async function removeCoordinatorFromTeam(
  memberId: string,
  teamId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()
  const clubId = await getClubId()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any

  await sb.from('coordinator_team_assignments').delete().eq('member_id', memberId).eq('team_id', teamId)
  await sb.from('club_member_roles').delete().eq('member_id', memberId).eq('role', 'coordinador').eq('team_id', teamId)

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
  const supabase = await createClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any

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
  const supabase = await createClient()
  const clubId = await getClubId()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from('club_members')
    .update(data)
    .eq('id', memberId)
    .eq('club_id', clubId)
  if (error) return { success: false, error: error.message }
  revalidatePath('/entrenadores/staff')
  return { success: true }
}
