'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { getClubContext } from '@/lib/supabase/get-club-id'
import { sendHtmlEmail } from '@/lib/email/send'
import { resolveFee } from '@/features/configuracion/actions/season-fees.actions'
import { revalidatePath } from 'next/cache'

// ─── Tipos ────────────────────────────────────────────────────────────────────

export interface AssignmentEmailConfig {
  fees_image_url: string | null
  assignment_email_subject: string | null
  assignment_email_body: string | null
  reservation_deadline: string | null  // ISO date YYYY-MM-DD
}

export interface TeamRoster {
  team: { id: string; name: string; season: string }
  coach: { id: string; name: string } | null
  players: { id: string; first_name: string; last_name: string; email_team_assignment_sent: boolean }[]
}

export interface SeasonRostersResult {
  current: TeamRoster[]
  next: TeamRoster[]
  currentSeason: string
  nextSeason: string
}

// ─── Guardar configuración de email ──────────────────────────────────────────

export async function saveAssignmentEmailConfig(
  config: Partial<AssignmentEmailConfig>
): Promise<{ success: boolean; error?: string }> {
  try {
    const { clubId, roles } = await getClubContext()
    if (!roles.some(r => ['admin', 'direccion'].includes(r))) {
      return { success: false, error: 'Sin permisos' }
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = createAdminClient() as any

    const { error } = await sb
      .from('club_settings')
      .update({
        ...(config.fees_image_url !== undefined && { fees_image_url: config.fees_image_url }),
        ...(config.assignment_email_subject !== undefined && { assignment_email_subject: config.assignment_email_subject }),
        ...(config.assignment_email_body !== undefined && { assignment_email_body: config.assignment_email_body }),
        ...(config.reservation_deadline !== undefined && { reservation_deadline: config.reservation_deadline }),
      })
      .eq('club_id', clubId)

    if (error) return { success: false, error: error.message }
    revalidatePath('/configuracion/planificacion')
    return { success: true }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

// ─── Leer configuración de email ─────────────────────────────────────────────

export async function getAssignmentEmailConfig(): Promise<{ success: boolean; config?: AssignmentEmailConfig; error?: string }> {
  try {
    const { clubId } = await getClubContext()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = createAdminClient() as any

    const { data, error } = await sb
      .from('club_settings')
      .select('fees_image_url, assignment_email_subject, assignment_email_body, reservation_deadline')
      .eq('club_id', clubId)
      .single()

    if (error) return { success: false, error: error.message }
    return { success: true, config: data as AssignmentEmailConfig }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

// ─── Enviar email de asignación a un jugador ─────────────────────────────────

export async function sendTeamAssignmentEmail(
  playerId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { clubId, roles } = await getClubContext()
    if (!roles.some(r => ['admin', 'direccion', 'director_deportivo'].includes(r))) {
      return { success: false, error: 'Sin permisos' }
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = createAdminClient() as any

    // 1. Cargar datos del jugador con su equipo de la próxima temporada
    const { data: player, error: pErr } = await sb
      .from('players')
      .select('id, first_name, last_name, tutor_name, tutor_email, next_team_id, email_team_assignment_sent')
      .eq('id', playerId)
      .eq('club_id', clubId)
      .single()

    if (pErr || !player) return { success: false, error: 'Jugador no encontrado' }
    if (!player.tutor_email) return { success: false, error: 'El jugador no tiene email de tutor' }
    if (!player.next_team_id) return { success: false, error: 'El jugador no tiene equipo asignado para la próxima temporada' }

    // 2. Nombre del equipo 26/27
    const { data: team } = await sb
      .from('teams')
      .select('id, name, season')
      .eq('id', player.next_team_id)
      .single()

    if (!team) return { success: false, error: 'Equipo no encontrado' }

    // 3. Entrenador del equipo 26/27
    const { data: coachRows } = await sb
      .from('team_coaches')
      .select('club_members(full_name)')
      .eq('team_id', player.next_team_id)
      .limit(1)

    const entrenadorNombre: string = coachRows?.[0]?.club_members?.full_name ?? 'Por confirmar'

    // 4. Importe de reserva
    // season_fees puede guardar la temporada con guión (2026-27) o barra (2026/27)
    // → intentar ambos formatos
    let importeReserva = ''
    try {
      const seasonSlash = team.season                          // '2026/27'
      const seasonDash  = team.season.replace('/', '-')        // '2026-27'
      let fee = await resolveFee(seasonSlash, team.id, 'Reserva')
      if (fee === null) fee = await resolveFee(seasonDash, team.id, 'Reserva')
      if (fee !== null) importeReserva = `${fee.toFixed(2)} €`
    } catch {
      // fallback — la cuota puede no existir
    }

    // 5. Configuración del club
    const { data: settings } = await sb
      .from('club_settings')
      .select('fees_image_url, assignment_email_subject, assignment_email_body, reservation_deadline, club_name')
      .eq('club_id', clubId)
      .single()

    const subject = settings?.assignment_email_subject || `Equipo asignado temporada ${team.season}`
    const bodyTemplate = settings?.assignment_email_body || buildDefaultBody()
    const deadlineRaw = settings?.reservation_deadline as string | null
    const fechaLimite = deadlineRaw ? formatDate(deadlineRaw) : 'próximamente'
    const feesImageUrl = settings?.fees_image_url as string | null

    // 6. Reemplazar placeholders
    const playerName = `${player.first_name} ${player.last_name}`.trim()
    const tutorName = player.tutor_name || playerName

    const tokens: Record<string, string> = {
      '{jugador_nombre}': playerName,
      '{tutor_nombre}': tutorName,
      '{equipo}': team.name,
      '{entrenador_nombre}': entrenadorNombre,
      '{importe_reserva}': importeReserva || '—',
      '{fecha_limite}': fechaLimite,
      '{temporada}': team.season,
    }

    let html = bodyTemplate
    for (const [key, val] of Object.entries(tokens)) {
      html = html.replaceAll(key, val)
    }

    // 7. Insertar imagen de cuotas si existe
    if (feesImageUrl) {
      const imgTag = `<div style="text-align:center;margin:20px 0;">
  <img src="${feesImageUrl}" alt="Cuotas temporada ${team.season}" style="max-width:100%;border-radius:8px;" />
</div>`
      html = html.replace('</body>', `${imgTag}</body>`)
      if (!html.includes(imgTag)) {
        // Si no hay </body>, añadir al final
        html = html + imgTag
      }
    }

    // 8. Enviar email
    const { sent, error: sendErr } = await sendHtmlEmail({
      to: player.tutor_email,
      subject,
      html,
    })

    if (!sent) return { success: false, error: sendErr ?? 'Error al enviar el email' }

    // 9. Marcar como enviado + log en communications
    await sb
      .from('players')
      .update({ email_team_assignment_sent: true })
      .eq('id', playerId)

    await sb.from('communications').insert({
      club_id: clubId,
      player_id: playerId,
      subject,
      body: html,
      type: 'individual',
      status: 'sent',
      sent_at: new Date().toISOString(),
    })

    revalidatePath('/jugadores/inscripciones')
    return { success: true }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

// ─── Asignaciones actuales de entrenadores en equipos borrador ───────────────

export async function getDraftCoachAssignments(
  teamIds: string[]
): Promise<{ success: boolean; assignments?: { team_id: string; member_id: string }[]; error?: string }> {
  if (teamIds.length === 0) return { success: true, assignments: [] }
  try {
    const { clubId } = await getClubContext()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = createAdminClient() as any

    // Verificar que estos equipos pertenecen al club
    const { data, error } = await sb
      .from('team_coaches')
      .select('team_id, member_id')
      .in('team_id', teamIds)

    if (error) return { success: false, error: error.message }

    // Filter to only teams belonging to this club (extra safety)
    const { data: clubTeams } = await sb
      .from('teams')
      .select('id')
      .eq('club_id', clubId)
      .in('id', teamIds)

    const clubTeamIds = new Set((clubTeams ?? []).map((t: { id: string }) => t.id))
    const filtered = (data ?? []).filter((r: { team_id: string }) => clubTeamIds.has(r.team_id))

    return { success: true, assignments: filtered }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

// ─── Listado de plantillas por temporada ─────────────────────────────────────

export async function getSeasonRosters(): Promise<{ success: boolean; data?: SeasonRostersResult; error?: string }> {
  try {
    const { clubId } = await getClubContext()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = createAdminClient() as any

    // Temporada actual
    const { data: settings } = await sb
      .from('club_settings')
      .select('current_season')
      .eq('club_id', clubId)
      .single()

    const currentSeason: string = settings?.current_season ?? ''
    const nextSeason = bumpSeason(currentSeason)

    // Equipos activos (temporada actual)
    const { data: currentTeams } = await sb
      .from('teams')
      .select('id, name, season')
      .eq('club_id', clubId)
      .eq('active', true)
      .eq('season', currentSeason)
      .order('name')

    // Equipos borrador (próxima temporada)
    const { data: nextTeams } = await sb
      .from('teams')
      .select('id, name, season')
      .eq('club_id', clubId)
      .eq('season', nextSeason)
      .order('name')

    const allTeamIds = [
      ...(currentTeams ?? []).map((t: { id: string }) => t.id),
      ...(nextTeams ?? []).map((t: { id: string }) => t.id),
    ]

    if (allTeamIds.length === 0) {
      return { success: true, data: { current: [], next: [], currentSeason, nextSeason } }
    }

    // Entrenadores por equipo
    const { data: coachRows } = await sb
      .from('team_coaches')
      .select('team_id, member_id, club_members(id, full_name)')
      .in('team_id', allTeamIds)

    const coachByTeam: Record<string, { id: string; name: string }> = {}
    for (const row of (coachRows ?? [])) {
      if (!coachByTeam[row.team_id] && row.club_members) {
        coachByTeam[row.team_id] = { id: row.club_members.id, name: row.club_members.full_name }
      }
    }

    // Jugadores actuales (por team_id)
    const currentTeamIds = (currentTeams ?? []).map((t: { id: string }) => t.id)
    const { data: currentPlayers } = currentTeamIds.length
      ? await sb
          .from('players')
          .select('id, first_name, last_name, team_id, email_team_assignment_sent')
          .eq('club_id', clubId)
          .eq('status', 'active')
          .in('team_id', currentTeamIds)
          .order('last_name')
      : { data: [] }

    // Jugadores próxima temporada (por next_team_id)
    const nextTeamIds = (nextTeams ?? []).map((t: { id: string }) => t.id)
    const { data: nextPlayers } = nextTeamIds.length
      ? await sb
          .from('players')
          .select('id, first_name, last_name, next_team_id, email_team_assignment_sent')
          .eq('club_id', clubId)
          .eq('status', 'active')
          .in('next_team_id', nextTeamIds)
          .order('last_name')
      : { data: [] }

    // Construir rosters actuales
    const current: TeamRoster[] = (currentTeams ?? []).map((team: { id: string; name: string; season: string }) => ({
      team,
      coach: coachByTeam[team.id] ?? null,
      players: (currentPlayers ?? [])
        .filter((p: { team_id: string }) => p.team_id === team.id)
        .map((p: { id: string; first_name: string; last_name: string; email_team_assignment_sent: boolean }) => ({
          id: p.id,
          first_name: p.first_name,
          last_name: p.last_name,
          email_team_assignment_sent: p.email_team_assignment_sent ?? false,
        })),
    }))

    // Construir rosters próxima temporada
    const next: TeamRoster[] = (nextTeams ?? []).map((team: { id: string; name: string; season: string }) => ({
      team,
      coach: coachByTeam[team.id] ?? null,
      players: (nextPlayers ?? [])
        .filter((p: { next_team_id: string }) => p.next_team_id === team.id)
        .map((p: { id: string; first_name: string; last_name: string; email_team_assignment_sent: boolean }) => ({
          id: p.id,
          first_name: p.first_name,
          last_name: p.last_name,
          email_team_assignment_sent: p.email_team_assignment_sent ?? false,
        })),
    }))

    return { success: true, data: { current, next, currentSeason, nextSeason } }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Mismo formato que season.actions.ts: '2025/26' → '2026/27' */
function bumpSeason(season: string): string {
  const match = season.match(/^(\d{4})\/(\d{2})$/)
  if (match) {
    const y1 = parseInt(match[1]) + 1
    const y2 = parseInt(match[2])
    const y2full = y2 >= 90 ? 1900 + y2 : 2000 + y2
    return `${y1}/${String(y2full + 1).slice(-2)}`
  }
  const fullMatch = season.match(/^(\d{4})\/(\d{4})$/)
  if (fullMatch) {
    return `${parseInt(fullMatch[1]) + 1}/${parseInt(fullMatch[2]) + 1}`
  }
  return season
}

function formatDate(iso: string): string {
  const d = new Date(iso + 'T12:00:00')  // noon para evitar offset issues
  return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })
}

function buildDefaultBody(): string {
  return `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;border:3px solid #ffcc00;border-radius:12px;color:#333;">
  <h2 style="color:#000;text-align:center;margin-bottom:4px;">Asignación de equipo — Temporada {temporada}</h2>
  <p style="text-align:center;font-size:0.9em;color:#666;">Escuela de Fútbol Ciudad de Getafe</p>
  <hr style="border:none;border-top:1px solid #eee;margin:16px 0;" />
  <p>Hola <strong>{tutor_nombre}</strong>,</p>
  <p>Nos complace comunicaros que <strong>{jugador_nombre}</strong> ha sido asignado/a al equipo:</p>
  <div style="background:#fffbe6;border:2px solid #ffcc00;border-radius:8px;padding:14px;text-align:center;margin:16px 0;">
    <p style="margin:0;font-size:1.1em;font-weight:bold;">{equipo}</p>
    <p style="margin:4px 0 0;font-size:0.9em;color:#555;">Entrenador/a: {entrenador_nombre}</p>
  </div>
  <p>Para confirmar la plaza, os pedimos que realicéis el pago de la reserva de <strong>{importe_reserva}</strong> antes del <strong>{fecha_limite}</strong>.</p>
  <p>En caso de dudas, podéis poneros en contacto con nosotros respondiendo a este correo.</p>
  <hr style="border:none;border-top:1px solid #eee;margin:16px 0;" />
  <p style="text-align:center;font-size:0.85em;color:#888;">Un saludo,<br><strong>La Dirección — EF Ciudad de Getafe</strong></p>
</div>`
}
