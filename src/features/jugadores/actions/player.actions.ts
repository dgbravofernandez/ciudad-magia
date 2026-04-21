'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { sendHtmlEmail } from '@/lib/email/send'
import { generateTrialLetterPDF } from '@/lib/pdf/generate-trial-letter'

export async function updateInscriptionStatus(
  playerId: string,
  data: Partial<{
    meets_requirements: boolean
    made_reservation: boolean
    wants_to_continue: boolean
    team_id: string | null
    next_team_id: string | null
  }>
) {
  const supabase = await createClient()
  const { getClubId } = await import('@/lib/supabase/get-club-id')
  const clubId = await getClubId()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any

  // If toggling wants_to_continue, check previous value to avoid duplicate emails
  let autoEmailType: string | null = null
  if (data.wants_to_continue === true || data.wants_to_continue === false) {
    const { data: current } = await sb
      .from('players')
      .select('wants_to_continue, tutor_email')
      .eq('id', playerId)
      .eq('club_id', clubId)
      .single()
    // Only send if value is actually changing and player has a tutor email
    if (current && current.wants_to_continue !== data.wants_to_continue && current.tutor_email) {
      autoEmailType = data.wants_to_continue ? 'wants_to_continue_yes' : 'wants_to_continue_no'
    }
  }

  const { error } = await sb
    .from('players')
    .update(data)
    .eq('id', playerId)
    .eq('club_id', clubId)

  if (error) throw new Error(error.message)

  // Auto-send confirmation/rejection email
  if (autoEmailType) {
    await sendEmail(playerId, autoEmailType)
  }

  revalidatePath('/jugadores/inscripciones')
  return { success: true }
}

export async function sendEmail(playerId: string, emailType: string) {
  const supabase = await createClient()
  const { getClubId } = await import('@/lib/supabase/get-club-id')
  const clubId = await getClubId()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any

  // Get player + team info (including next_team for 26/27 assignment emails)
  const { data: player } = await sb
    .from('players')
    .select('*, teams:team_id(name), next_team:next_team_id(id, name)')
    .eq('id', playerId)
    .eq('club_id', clubId)
    .single()

  if (!player) return { success: false, error: 'Jugador no encontrado' }

  // Try to get template; fall back to built-in content
  const { data: template } = await sb
    .from('email_templates')
    .select('*')
    .eq('club_id', clubId)
    .eq('event_type', emailType)
    .eq('active', true)
    .single()

  const playerName = `${player.first_name} ${player.last_name}`
  const tutorName = player.tutor_name || playerName

  // For team_assignment emails, show the 26/27 (next) team; otherwise current team
  const isTeamAssignment = emailType === 'team_assignment'
  const teamName = isTeamAssignment
    ? (player.next_team?.name ?? player.teams?.name ?? 'Por confirmar')
    : (player.teams?.name ?? 'Por confirmar')

  // Fetch coach name: for team_assignment use next_team_id, otherwise current team_id
  let coachName: string | null = null
  const coachTeamId = isTeamAssignment ? (player.next_team_id ?? player.team_id) : player.team_id
  if (coachTeamId) {
    const { data: coachRow } = await sb
      .from('team_coaches')
      .select('club_members(full_name)')
      .eq('team_id', coachTeamId)
      .limit(1)
      .maybeSingle()
    coachName = coachRow?.club_members?.full_name ?? null
  }

  // Birth year is used to apply the juvenile-specific message variant
  // (born <= 2010 → cannot guarantee continuity until full juvenile renewal count is done)
  const birthYear = player.birth_date ? new Date(player.birth_date).getFullYear() : null

  const fallbacks = buildFallbackEmail(emailType, playerName, tutorName, teamName, player.forms_link, coachName, birthYear)

  const tokens: Record<string, string> = {
    '{{player_name}}': playerName,
    '{{tutor_name}}': tutorName,
    '{{team}}': teamName,
    '{{form_link}}': player.forms_link ?? '',
    '{{club_name}}': 'Escuela de Fútbol Ciudad de Getafe',
  }

  let subject = (template?.subject ?? fallbacks.subject) as string
  let body = (template?.body_html ?? fallbacks.body) as string
  for (const [token, value] of Object.entries(tokens)) {
    subject = subject.replaceAll(token, value)
    body = body.replaceAll(token, value)
  }

  // Determine recipient email (tutor preferred, player as fallback)
  const recipientEmail = player.tutor_email ?? null

  // Send the actual email
  let emailSent = false
  if (recipientEmail) {
    const { sent } = await sendHtmlEmail({ to: recipientEmail, subject, html: body })
    emailSent = sent
  }

  // Save communication record (status reflects whether email was actually delivered)
  const { error: commError } = await sb.from('communications').insert({
    club_id: clubId,
    subject,
    body_html: body,
    template_id: template?.id ?? null,
    recipient_type: 'individual',
    recipient_ids: [playerId],
    status: emailSent ? 'sent' : (recipientEmail ? 'error' : 'no_email'),
    sent_at: new Date().toISOString(),
  })

  if (commError) return { success: false, error: commError.message }

  // Mark email as sent in player record (mark even if email not configured, so it shows in the UI)
  const flagMap: Record<string, string> = {
    team_assignment: 'email_team_assignment_sent',
    request_docs: 'email_request_docs_sent',
    fill_form: 'email_fill_form_sent',
    admitted: 'email_admitted_sent',
  }

  const flag = flagMap[emailType]
  if (flag) {
    await sb.from('players').update({ [flag]: true }).eq('id', playerId)
  }

  revalidatePath('/jugadores/inscripciones')
  return { success: true, emailSent, recipientEmail }
}

function buildFallbackEmail(
  type: string,
  playerName: string,
  tutorName: string,
  teamName: string,
  formsLink?: string | null,
  coachName?: string | null,
  birthYear?: number | null
): { subject: string; body: string } {
  // Players born in 2010 or earlier belong to the juvenile categories,
  // where the club cannot confirm continuity until all juvenile renewals
  // are tallied (limited training slots / teams).
  const isJuvenile = typeof birthYear === 'number' && birthYear <= 2010
  const CLUB = 'Escuela de Fútbol Ciudad de Getafe'
  const border = (color: string) =>
    `font-family:Arial,sans-serif;padding:25px;border:4px solid ${color};border-radius:15px;color:#333;`

  switch (type) {
    case 'fill_form':
      return {
        subject: `Confirmación de inscripción 26/27 - ${CLUB}`,
        body: `<div style="${border('#ffcc00')}">
          <h2 style="color:#000;text-align:center;">Proceso de Inscripción - Temporada 26/27</h2>
          <p>Estimado/a <strong>${tutorName}</strong>,</p>
          <p>Nos ponemos en contacto para conocer si <strong>${playerName}</strong> desea continuar en nuestra escuela la próxima temporada, con el objetivo de conocer las plazas disponibles y planificar la temporada 26/27.</p>
          <p>Por favor, rellena el siguiente formulario antes del <strong>8 de mayo de 2026</strong>:</p>
          ${formsLink
            ? `<div style="text-align:center;margin:25px 0;">
                <a href="${formsLink}" style="background:#ffcc00;color:#000;padding:14px 30px;border-radius:8px;font-weight:bold;text-decoration:none;font-size:16px;display:inline-block;">
                  Rellenar formulario
                </a>
              </div>
              <p style="font-size:0.85em;color:#888;text-align:center;">O copia este enlace en tu navegador:<br>${formsLink}</p>`
            : `<p><em>El enlace al formulario estará disponible próximamente. Si tienes dudas contacta con la secretaría.</em></p>`
          }
          <p>La fecha límite para responder es el <strong>8 de mayo de 2026</strong>. Esta información es imprescindible para gestionar correctamente las plazas disponibles en la escuela.</p>
          <hr style="border:none;border-top:1px solid #eee;margin:20px 0;">
          <p style="text-align:center;font-size:0.9em;">Atentamente,<br><strong>La Dirección - ${CLUB}</strong></p>
        </div>`,
      }
    case 'team_assignment':
      return {
        subject: `Asignación y Reserva de Plaza - ${CLUB}`,
        body: `<div style="${border('#ffcc00')}">
          <h2 style="color:#000;text-align:center;">Notificación de Asignación - Temporada 26/27</h2>
          <p>Estimado/a <strong>${tutorName}</strong>,</p>
          <p>Nos complace comunicarle la asignación oficial de <strong>${playerName}</strong> para la próxima temporada:</p>
          <div style="background:#f9f9f9;padding:15px;border-radius:10px;margin:20px 0;border-left:5px solid #ffcc00;">
            <p style="margin:5px 0;"><strong>Categoría:</strong> ${teamName}</p>
            <p style="margin:5px 0;"><strong>Cuerpo Técnico:</strong> ${coachName ?? 'Pendiente de asignar'}</p>
          </div>
          <div style="background:#000;color:#ffcc00;padding:20px;text-align:center;border-radius:10px;margin:20px 0;">
            <h3 style="margin:0;">IMPORTE RESERVA: 60,00€</h3>
            <p style="margin:10px 0 0 0;font-size:1.1em;"><strong>PLAZO LÍMITE: 15 de junio de 2026</strong></p>
          </div>
          <p style="font-size:0.9em;color:#666;"><em>Rogamos respeten los plazos establecidos para garantizar la correcta planificación deportiva. Ante cualquier duda, contacten con la secretaría.</em></p>
          <hr style="border:none;border-top:1px solid #eee;margin:20px 0;">
          <p style="text-align:center;"><strong>Atentamente,<br>La Dirección - ${CLUB}</strong></p>
        </div>`,
      }
    case 'dismissed_requirements':
      return {
        subject: `Baja confirmada - ${CLUB}`,
        body: `<div style="${border('#000')}">
          <h2>Baja Confirmada</h2>
          <p>Hola <strong>${tutorName}</strong>,</p>
          <p>Le informamos que <strong>${playerName}</strong> no cumple los requisitos para formar parte del equipo en la temporada 26/27. Cualquier duda puede acudir a la oficina del club.</p>
          <p>Atentamente,<br>${CLUB}</p>
        </div>`,
      }
    case 'dismissed_non_payment':
      return {
        subject: `Plaza liberada - ${CLUB}`,
        body: `<div style="${border('#000')}">
          <h2>Plaza Liberada</h2>
          <p>Hola <strong>${tutorName}</strong>,</p>
          <p>Le informamos que no se realizó el pago de la reserva de plaza de <strong>${playerName}</strong> en el plazo correspondiente, ni hemos recibido ninguna justificación, por lo que su plaza queda liberada.</p>
          <p>Atentamente,<br>${CLUB}</p>
        </div>`,
      }
    case 'request_docs': {
      // Fallback default upload link for Ciudad de Getafe if the player has no custom forms_link
      const DEFAULT_DOCS_LINK = 'https://forms.gle/NHvNQF6jYsG1oX8s9'
      const uploadLink = formsLink || DEFAULT_DOCS_LINK
      return {
        subject: `Documentación pendiente - ${CLUB}`,
        body: `<div style="${border('#ffcc00')}">
          <h2 style="color:#000;text-align:center;">Solicitud de Documentación</h2>
          <p>Estimado/a <strong>${tutorName}</strong>,</p>
          <p>Para completar la inscripción de <strong>${playerName}</strong> en la ${teamName ? `categoría <strong>${teamName}</strong> de la ` : ''}${CLUB}, necesitamos recibir la siguiente documentación:</p>
          <ul style="line-height:1.8;">
            <li><strong>DNI / NIE</strong> del jugador (por ambas caras)</li>
            <li><strong>Fotografía</strong> reciente del jugador (tipo carnet)</li>
            <li><strong>Certificado médico</strong> de aptitud deportiva</li>
            <li><strong>Justificante de pago</strong> de la reserva de plaza</li>
          </ul>
          <p>Por favor, suba los documentos en el siguiente enlace:</p>
          <div style="text-align:center;margin:25px 0;">
            <a href="${uploadLink}" style="background:#ffcc00;color:#000;padding:14px 30px;border-radius:8px;font-weight:bold;text-decoration:none;font-size:16px;display:inline-block;">
              Subir documentación
            </a>
          </div>
          <p style="font-size:0.85em;color:#888;text-align:center;">O copia este enlace en tu navegador:<br>${uploadLink}</p>
          <p style="font-size:0.9em;color:#666;"><em>Sin la documentación completa no podremos tramitar la ficha federativa del jugador. Si tiene dudas, contacte con la secretaría.</em></p>
          <hr style="border:none;border-top:1px solid #eee;margin:20px 0;">
          <p style="text-align:center;font-size:0.9em;">Atentamente,<br><strong>La Dirección - ${CLUB}</strong></p>
        </div>`,
      }
    }
    case 'wants_to_continue_yes':
      if (isJuvenile) {
        return {
          subject: `Hemos recibido su respuesta - ${CLUB}`,
          body: `<div style="${border('#ffcc00')}">
            <h2>Respuesta Recibida — Categoría Juvenil</h2>
            <p>Hola <strong>${tutorName}</strong>,</p>
            <p>Hemos recibido su respuesta indicando que <strong>${playerName}</strong> desea continuar con nosotros la próxima temporada.</p>
            <p>Como <strong>procedimiento del club</strong> en las categorías juveniles, donde tenemos una gran demanda de renovaciones y disponemos de un número limitado de equipos y franjas horarias, <strong>aún no podemos asegurarle la continuidad</strong>.</p>
            <p>Para poder optar a plaza, el jugador debe <strong>estar al corriente de pago</strong> y <strong>haber cumplido las normas internas de comportamiento</strong> del club.</p>
            <p>Una vez completemos el conteo total de renovaciones de juveniles, <strong>el coordinador se pondrá en contacto con ustedes</strong> para informarles personalmente de su situación. Lamentablemente, en algunos casos no podríamos dar continuidad a todos los jugadores de la escuela.</p>
            <p>Atentamente,<br>${CLUB}</p>
          </div>`,
        }
      }
      return {
        subject: `¡Contamos contigo! - ${CLUB}`,
        body: `<div style="${border('#ffcc00')}">
          <h2>¡Confirmación Recibida!</h2>
          <p>Hola <strong>${tutorName}</strong>,</p>
          <p>Hemos recibido su respuesta y nos alegra confirmar que contamos con <strong>${playerName}</strong> para la próxima temporada. En las próximas semanas recibirán un correo con la asignación de equipo y la información para reservar la plaza.</p>
          <p>Atentamente,<br>${CLUB}</p>
        </div>`,
      }
    case 'wants_to_continue_no':
      return {
        subject: `Baja confirmada - ${CLUB}`,
        body: `<div style="${border('#000')}">
          <h2>Baja Procesada</h2>
          <p>Hola <strong>${tutorName}</strong>,</p>
          <p>Hemos recibido su respuesta y confirmamos que la plaza de <strong>${playerName}</strong> queda liberada y que no contamos con el/la jugador/a para la próxima temporada.</p>
          <p>Atentamente,<br>${CLUB}</p>
        </div>`,
      }
    default:
      return {
        subject: `Notificación - ${CLUB}`,
        body: `<p>Hola ${tutorName}, le enviamos esta notificación sobre ${playerName}.</p>`,
      }
  }
}

export async function dismissPlayerInscription(
  playerId: string,
  reason: 'requirements' | 'non_payment'
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()
  const { getClubId } = await import('@/lib/supabase/get-club-id')
  const clubId = await getClubId()

  const updateData = reason === 'requirements'
    ? { meets_requirements: false }
    : { made_reservation: false }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any

  const { data: player, error } = await sb
    .from('players')
    .update(updateData)
    .eq('id', playerId)
    .eq('club_id', clubId)
    .select('id, first_name, last_name, tutor_name, tutor_email, teams(name)')
    .single()

  if (error) return { success: false, error: error.message }

  // Record the communication (email would be sent by the email service later)
  if (player?.tutor_email) {
    const playerName = `${player.first_name} ${player.last_name}`
    const tutorName = player.tutor_name || playerName
    const teamName = player.teams?.name ?? ''
    const emailType = reason === 'requirements' ? 'dismissed_requirements' : 'dismissed_non_payment'

    const { data: template } = await sb
      .from('email_templates')
      .select('*')
      .eq('club_id', clubId)
      .eq('event_type', emailType)
      .eq('active', true)
      .single()

    const fallback = buildFallbackEmail(emailType, playerName, tutorName, teamName)
    const subject = (template?.subject ?? fallback.subject) as string
    const body = (template?.body_html ?? fallback.body) as string

    // Send the actual email
    const { sent: emailSent } = await sendHtmlEmail({
      to: player.tutor_email,
      subject,
      html: body,
    })

    await sb.from('communications').insert({
      club_id: clubId,
      subject,
      body_html: body,
      template_id: template?.id ?? null,
      recipient_type: 'individual',
      recipient_ids: [playerId],
      status: emailSent ? 'sent' : 'error',
      sent_at: new Date().toISOString(),
    })
  }

  revalidatePath('/jugadores/inscripciones')
  return { success: true }
}

export async function createPlayer(formData: FormData) {
  const supabase = await createClient()
  const { getClubId } = await import('@/lib/supabase/get-club-id')
  const clubId = await getClubId()

  const sendDocsRequest = formData.get('send_docs_request') === 'on'
  const formsLink = (formData.get('forms_link') as string)?.trim() || null

  const data = {
    club_id: clubId,
    first_name: formData.get('first_name') as string,
    last_name: formData.get('last_name') as string,
    birth_date: (formData.get('birth_date') as string) || null,
    dni: (formData.get('dni') as string) || null,
    nationality: (formData.get('nationality') as string) || 'ES',
    tutor_name: (formData.get('tutor_name') as string) || null,
    tutor_email: (formData.get('tutor_email') as string) || null,
    tutor_phone: (formData.get('tutor_phone') as string) || null,
    position: (formData.get('position') as string) || null,
    dominant_foot: (formData.get('dominant_foot') as string) || null,
    team_id: (formData.get('team_id') as string) || null,
    dorsal_number: formData.get('dorsal_number') ? parseInt(formData.get('dorsal_number') as string) : null,
    forms_link: formsLink,
    status: 'active',
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: player, error } = await (supabase as any).from('players').insert(data).select().single()

  if (error) return { success: false, error: error.message }

  // Optionally email the tutor the documents-request message right away
  let docsEmailSent = false
  if (sendDocsRequest && player?.id && player?.tutor_email) {
    try {
      const r = await sendEmail(player.id, 'request_docs')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      docsEmailSent = !!(r as any)?.emailSent
    } catch {
      // non-fatal: creation already succeeded
      docsEmailSent = false
    }
  }

  revalidatePath('/jugadores')
  return { success: true, player, docsEmailSent }
}

export async function updatePlayer(playerId: string, formData: FormData) {
  const supabase = await createClient()
  const { getClubId } = await import('@/lib/supabase/get-club-id')
  const clubId = await getClubId()

  const data = {
    first_name: formData.get('first_name') as string,
    last_name: formData.get('last_name') as string,
    birth_date: (formData.get('birth_date') as string) || null,
    dni: (formData.get('dni') as string) || null,
    nationality: (formData.get('nationality') as string) || 'ES',
    tutor_name: (formData.get('tutor_name') as string) || null,
    tutor_email: (formData.get('tutor_email') as string) || null,
    tutor_phone: (formData.get('tutor_phone') as string) || null,
    tutor2_name: (formData.get('tutor2_name') as string) || null,
    tutor2_email: (formData.get('tutor2_email') as string) || null,
    position: (formData.get('position') as string) || null,
    dominant_foot: (formData.get('dominant_foot') as string) || null,
    height_cm: formData.get('height_cm') ? parseInt(formData.get('height_cm') as string) : null,
    weight_kg: formData.get('weight_kg') ? parseFloat(formData.get('weight_kg') as string) : null,
    team_id: (formData.get('team_id') as string) || null,
    dorsal_number: formData.get('dorsal_number') ? parseInt(formData.get('dorsal_number') as string) : null,
    status: formData.get('status') as string,
    notes: (formData.get('notes') as string) || null,
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from('players')
    .update(data)
    .eq('id', playerId)
    .eq('club_id', clubId)

  if (error) return { success: false, error: error.message }

  revalidatePath(`/jugadores/${playerId}`)
  revalidatePath('/jugadores')
  return { success: true }
}

export async function deletePlayer(playerId: string) {
  const { createAdminClient } = await import('@/lib/supabase/admin')
  const supabase = createAdminClient()
  const clubId = await getClubIdFromContext()
  if (!clubId) return { success: false, error: 'No autenticado' }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from('players').delete().eq('id', playerId).eq('club_id', clubId)

  if (error) return { success: false, error: error.message }
  revalidatePath('/jugadores')
  return { success: true }
}

const EMAIL_FLAGS = [
  'email_team_assignment_sent',
  'email_request_docs_sent',
  'email_fill_form_sent',
  'email_admitted_sent',
] as const
type EmailFlagName = (typeof EMAIL_FLAGS)[number]

export async function resetEmailFlag(
  playerId: string,
  flag: EmailFlagName
): Promise<{ success: boolean; error?: string }> {
  if (!EMAIL_FLAGS.includes(flag)) return { success: false, error: 'Invalid flag' }

  const supabase = await createClient()
  const { getClubId } = await import('@/lib/supabase/get-club-id')
  const clubId = await getClubId()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from('players')
    .update({ [flag]: false })
    .eq('id', playerId)
    .eq('club_id', clubId)

  if (error) return { success: false, error: error.message }
  revalidatePath('/jugadores/inscripciones')
  return { success: true }
}

export async function deleteAllPlayers() {
  const { createAdminClient } = await import('@/lib/supabase/admin')
  const supabase = createAdminClient()
  const clubId = await getClubIdFromContext()
  if (!clubId) return { success: false, error: 'No autenticado' }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error, count } = await (supabase as any)
    .from('players').delete().eq('club_id', clubId).select('id', { count: 'exact', head: true })

  if (error) return { success: false, error: error.message }
  revalidatePath('/jugadores')
  return { success: true, deleted: count ?? 0 }
}

async function getClubIdFromContext(): Promise<string> {
  const { getClubId } = await import('@/lib/supabase/get-club-id')
  return getClubId()
}

export async function importPlayers(
  _clubIdUnused: string,
  players: Array<{
    dni: string
    first_name: string
    last_name: string
    date_of_birth: string | null
    gender: 'M' | 'F'
    team_id: string | null
    team_label?: string       // used to auto-create teams if they don't exist
    status: 'active'
    position: null
    license_type: string
  }>
) {
  const { createAdminClient } = await import('@/lib/supabase/admin')
  const supabase = createAdminClient()
  const clubId = await getClubIdFromContext()
  if (!clubId) return { success: false, imported: 0, skipped: 0, error: 'No se pudo identificar el club. Recarga la página.' }

  // 0. Auto-create any teams that don't exist yet
  //    Group players by team_label, check which exist, create missing ones
  const SEASON = '2025/26'
  const labelMap = new Map<string, string | null>() // team_label → team_id (filled below)

  const uniqueLabels = [...new Set(players.map(p => p.team_label).filter(Boolean))] as string[]
  if (uniqueLabels.length > 0) {
    const { data: existingTeams } = await supabase
      .from('teams').select('id, name').eq('club_id', clubId).eq('active', true)
    const existingTeamMap = new Map((existingTeams ?? []).map((t: {id: string; name: string}) => [t.name.toLowerCase(), t.id]))

    const toCreate = uniqueLabels.filter(l => !existingTeamMap.has(l.toLowerCase()))
    if (toCreate.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: created } = await (supabase as any).from('teams').insert(
        toCreate.map(name => ({ club_id: clubId, name, season: SEASON, active: true }))
      ).select('id, name')
      ;(created ?? []).forEach((t: {id: string; name: string}) => existingTeamMap.set(t.name.toLowerCase(), t.id))
    }

    uniqueLabels.forEach(l => labelMap.set(l, existingTeamMap.get(l.toLowerCase()) ?? null))
  }

  // Merge resolved team IDs back into player data
  const playersWithTeams = players.map(p => ({
    ...p,
    team_id: p.team_id ?? (p.team_label ? (labelMap.get(p.team_label) ?? null) : null),
  }))

  // 1. Fetch ALL existing players from this club (avoid .in() URL limit with large batches)
  const { data: existing } = await supabase
    .from('players')
    .select('id, dni, team_id')
    .eq('club_id', clubId)

  type ExistingRow = { id: string; dni: string | null; team_id: string | null }
  const existingRows = (existing ?? []) as unknown as ExistingRow[]
  // Normalize DNIs for reliable matching (trim + uppercase)
  const normDni = (s: string | null) => (s ?? '').trim().toUpperCase()
  const existingMap = new Map(existingRows.map(r => [normDni(r.dni), r]))

  const newPlayers = playersWithTeams.filter(p => !existingMap.has(normDni(p.dni)))
  const skipped = playersWithTeams.length - newPlayers.length

  // 1b. Update team_id for existing players that still have team_id = null
  let teamUpdated = 0
  // Build import map normalized for matching
  const importMap = new Map(playersWithTeams.map(p => [normDni(p.dni), p]))
  const needsTeam = existingRows
    .filter(r => !r.team_id)
    .map(r => ({ row: r, imported: importMap.get(normDni(r.dni)) }))
    .filter((x): x is { row: ExistingRow; imported: typeof players[0] } => !!x.imported?.team_id)

  const BATCH = 25
  for (let i = 0; i < needsTeam.length; i += BATCH) {
    const batch = needsTeam.slice(i, i + BATCH)
    const results = await Promise.all(
      batch.map(({ row, imported }) =>
        (supabase as any).from('players')
          .update({ team_id: imported.team_id })
          .eq('id', row.id)
          .eq('club_id', clubId)
      )
    )
    for (const { error } of results) {
      if (error) console.error('team update error:', error.message)
      else teamUpdated++
    }
  }
  console.log(`importPlayers: needsTeam=${needsTeam.length}, teamUpdated=${teamUpdated}, skipped=${skipped}`)

  if (newPlayers.length === 0) {
    revalidatePath('/jugadores')
    return { success: true, imported: 0, skipped, teamUpdated }
  }

  // 2. Batch insert all new players in one query
  const { error } = await (supabase as any).from('players').insert(
    newPlayers.map(player => ({
      club_id: clubId,
      first_name: player.first_name,
      last_name: player.last_name,
      birth_date: player.date_of_birth,
      dni: player.dni,
      team_id: player.team_id,
      status: player.status,
      position: player.position,
      nationality: 'ES',
      license_type: player.license_type,
    }))
  )

  if (error) {
    console.error('importPlayers insert error:', error)
    return { success: false, imported: 0, skipped, error: error.message }
  }

  revalidatePath('/jugadores')
  return { success: true, imported: newPlayers.length, skipped, teamUpdated }
}

// ─── Carta de pruebas ──────────────────────────────────────────────────────

export async function sendTrialLetter(
  playerId: string,
  clubDestino: string,
  trialDate: string
): Promise<{ success: boolean; error?: string; emailSent?: boolean }> {
  const { createAdminClient } = await import('@/lib/supabase/admin')
  const { getClubId } = await import('@/lib/supabase/get-club-id')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createAdminClient() as any
  let clubId = await getClubId()
  if (!clubId) {
    const { data: anyClub } = await sb.from('clubs').select('id').limit(1).single()
    clubId = anyClub?.id ?? ''
  }

  const { data: player } = await sb
    .from('players')
    .select('first_name, last_name, birth_date, tutor_name, tutor_email')
    .eq('id', playerId)
    .eq('club_id', clubId)
    .single()

  if (!player) return { success: false, error: 'Jugador no encontrado' }

  const { data: club } = await sb
    .from('clubs')
    .select('name')
    .eq('id', clubId)
    .single()

  const clubName = club?.name ?? 'Escuela de Fútbol Ciudad de Getafe'
  const playerName = `${player.first_name} ${player.last_name}`
  const currentDate = new Date().toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' })

  // Generate PDF using pdf-lib (pure JS, no native deps — works on Vercel serverless)
  let pdfBuffer: Buffer | null = null
  try {
    pdfBuffer = await generateTrialLetterPDF({
      clubName,
      playerName,
      playerDob: player.birth_date,
      tutorName: player.tutor_name,
      trialDate,
      clubDestino,
      currentDate,
    })
  } catch (pdfErr) {
    console.error('[sendTrialLetter] PDF generation failed:', pdfErr)
    // Continue without PDF — email will still be sent
  }

  // Save to trial_letters
  await sb.from('trial_letters').insert({
    club_id: clubId,
    player_id: playerId,
    player_name: playerName,
    player_dob: player.birth_date,
    tutor_name: player.tutor_name,
    tutor_email: player.tutor_email,
    trial_date: trialDate,
    location: clubDestino,
    sent_at: new Date().toISOString(),
  })

  let emailSent = false
  if (player.tutor_email) {
    const subject = `Carta de pruebas — ${playerName}`
    const html = `<div style="font-family:Arial,sans-serif;padding:25px;border:4px solid #ffcc00;border-radius:15px;color:#333;">
      <p>Estimado/a Familia:</p>
      <p>Como es de su conocimiento, al expedir la carta de pruebas, el club se reserva el derecho de no ofrecer continuidad al jugador para la temporada 26/27. Agradecemos su comprensión respecto a esta política de la entidad.</p>
      <p>Adjuntamos la carta de pruebas correspondiente a <strong>${playerName}</strong> para su constancia.</p>
      <p>Quedamos a su disposición para cualquier duda o aclaración adicional.</p>
      <hr style="border:none;border-top:1px solid #eee;margin:20px 0;">
      <p style="text-align:center;font-size:0.9em;">Atentamente,<br><strong>Ciudad de Getafe</strong></p>
    </div>`

    const attachments = pdfBuffer
      ? [{ filename: `Carta_Pruebas_${playerName.replace(/\s+/g, '_')}.pdf`, content: pdfBuffer, contentType: 'application/pdf' }]
      : undefined

    const { sent } = await sendHtmlEmail({ to: player.tutor_email, subject, html, attachments })
    emailSent = sent
  }

  revalidatePath(`/jugadores/${playerId}`)
  revalidatePath('/jugadores/inscripciones')
  return { success: true, emailSent }
}

export async function getTrialLetterPlayerIds(
  clubId: string
): Promise<Set<string>> {
  const { createAdminClient } = await import('@/lib/supabase/admin')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createAdminClient() as any
  const { data } = await sb
    .from('trial_letters')
    .select('player_id')
    .eq('club_id', clubId)
  return new Set((data ?? []).map((r: { player_id: string }) => r.player_id))
}

// ─── Añadir lesión ─────────────────────────────────────────────────────────

export async function addInjury(
  playerId: string,
  data: { injury_type: string; description?: string; injured_at: string }
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()
  const { getClubId } = await import('@/lib/supabase/get-club-id')
  const clubId = await getClubId()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any

  const { error } = await sb.from('injuries').insert({
    club_id: clubId,
    player_id: playerId,
    injury_type: data.injury_type,
    description: data.description || null,
    injured_at: data.injured_at,
    status: 'active',
  })

  if (error) return { success: false, error: error.message }

  revalidatePath(`/jugadores/${playerId}`)
  return { success: true }
}

// ─── Actualizar lesión ─────────────────────────────────────────────────────

export async function updateInjury(
  injuryId: string,
  data: {
    injury_type?: string
    description?: string | null
    injured_at?: string
    recovered_at?: string | null
    status?: 'active' | 'recovered'
  }
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()
  const { getClubId } = await import('@/lib/supabase/get-club-id')
  const clubId = await getClubId()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any

  const patch: Record<string, unknown> = {}
  if (data.injury_type !== undefined) patch.injury_type = data.injury_type
  if (data.description !== undefined) patch.description = data.description
  if (data.injured_at !== undefined) patch.injured_at = data.injured_at
  if (data.recovered_at !== undefined) patch.recovered_at = data.recovered_at
  if (data.status !== undefined) patch.status = data.status

  const { data: injury, error: findErr } = await sb
    .from('injuries')
    .select('player_id')
    .eq('id', injuryId)
    .eq('club_id', clubId)
    .single()
  if (findErr || !injury) return { success: false, error: 'Lesión no encontrada' }

  const { error } = await sb.from('injuries').update(patch).eq('id', injuryId).eq('club_id', clubId)
  if (error) return { success: false, error: error.message }

  revalidatePath(`/jugadores/${injury.player_id}`)
  return { success: true }
}

export async function deleteInjury(injuryId: string): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()
  const { getClubId } = await import('@/lib/supabase/get-club-id')
  const clubId = await getClubId()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any

  const { data: injury } = await sb
    .from('injuries')
    .select('player_id')
    .eq('id', injuryId)
    .eq('club_id', clubId)
    .single()

  const { error } = await sb.from('injuries').delete().eq('id', injuryId).eq('club_id', clubId)
  if (error) return { success: false, error: error.message }

  if (injury?.player_id) revalidatePath(`/jugadores/${injury.player_id}`)
  return { success: true }
}

// ─── Observaciones de jugador ──────────────────────────────────────────────

export async function addPlayerObservation(
  playerId: string,
  data: { category: string; comment: string; author_name: string }
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()
  const { getClubId } = await import('@/lib/supabase/get-club-id')
  const clubId = await getClubId()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any

  const { error } = await sb.from('player_observations').insert({
    club_id: clubId,
    player_id: playerId,
    category: data.category,
    comment: data.comment,
    author_name: data.author_name,
  })

  if (error) return { success: false, error: error.message }

  revalidatePath(`/jugadores/${playerId}`)
  return { success: true }
}

export async function updatePlayerObservation(
  observationId: string,
  data: { category?: string; comment?: string }
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()
  const { getClubId } = await import('@/lib/supabase/get-club-id')
  const clubId = await getClubId()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any

  const patch: Record<string, unknown> = {}
  if (data.category !== undefined) patch.category = data.category
  if (data.comment !== undefined) patch.comment = data.comment

  const { data: obs } = await sb
    .from('player_observations')
    .select('player_id')
    .eq('id', observationId)
    .eq('club_id', clubId)
    .single()

  const { error } = await sb
    .from('player_observations')
    .update(patch)
    .eq('id', observationId)
    .eq('club_id', clubId)
  if (error) return { success: false, error: error.message }

  if (obs?.player_id) revalidatePath(`/jugadores/${obs.player_id}`)
  return { success: true }
}

export async function deletePlayerObservation(
  observationId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()
  const { getClubId } = await import('@/lib/supabase/get-club-id')
  const clubId = await getClubId()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any

  const { data: obs } = await sb
    .from('player_observations')
    .select('player_id')
    .eq('id', observationId)
    .eq('club_id', clubId)
    .single()

  const { error } = await sb
    .from('player_observations')
    .delete()
    .eq('id', observationId)
    .eq('club_id', clubId)
  if (error) return { success: false, error: error.message }

  if (obs?.player_id) revalidatePath(`/jugadores/${obs.player_id}`)
  return { success: true }
}

export async function getPlayerObservations(
  playerId: string
): Promise<{ id: string; category: string; comment: string; author_name: string | null; created_at: string }[]> {
  const supabase = await createClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any

  const { data } = await sb
    .from('player_observations')
    .select('id, category, comment, author_name, created_at')
    .eq('player_id', playerId)
    .order('created_at', { ascending: false })

  return data ?? []
}

/**
 * Aggregated performance for a player in a given season.
 * Season format: 'YYYY/YY' → dates July 1 YYYY to June 30 (YYYY+1).
 * - Training: % asistencia (present / scheduled for player's team)
 * - Match: minutos totales, % minutos sobre partidos del equipo jugados por él (× avg_match_duration)
 * - Goles, asistencias, amarillas, rojas, valoración media
 */
export interface PlayerPerformance {
  season: string
  trainings_scheduled: number
  trainings_attended: number
  trainings_justified: number
  trainings_absent: number
  attendance_pct: number // 0..100
  matches_team_total: number // partidos del equipo en la temporada
  matches_played: number // partidos donde el jugador tiene minutos_played > 0
  minutes_played: number
  minutes_pct: number // sobre matches_played * 90
  goals: number
  assists: number
  yellow_cards: number
  red_cards: number
  rating_avg: number | null
}

function seasonRange(season: string): { start: string; end: string } {
  // '2025/26' → start 2025-07-01, end 2026-06-30
  const [yStart] = season.split('/')
  const startYear = parseInt(yStart, 10)
  if (Number.isNaN(startYear)) {
    const now = new Date().getFullYear()
    return { start: `${now}-07-01`, end: `${now + 1}-06-30` }
  }
  return { start: `${startYear}-07-01`, end: `${startYear + 1}-06-30` }
}

export async function getPlayerPerformance(
  playerId: string,
  season?: string
): Promise<{ success: boolean; error?: string; data?: PlayerPerformance }> {
  try {
    const supabase = await createClient()
    const { getClubId } = await import('@/lib/supabase/get-club-id')
    const clubId = await getClubId()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = supabase as any

    // Resolve season: prefer arg, then club_settings.current_season
    let currentSeason = season
    if (!currentSeason) {
      const { data: settings } = await sb
        .from('club_settings')
        .select('current_season')
        .eq('club_id', clubId)
        .single()
      currentSeason = (settings?.current_season as string | undefined) ?? '2025/26'
    }
    const { start, end } = seasonRange(currentSeason)

    // Player's team
    const { data: player } = await sb
      .from('players')
      .select('team_id')
      .eq('id', playerId)
      .eq('club_id', clubId)
      .single()

    const teamId = player?.team_id as string | null

    // Count scheduled trainings for player's team in season
    let trainings_scheduled = 0
    let matches_team_total = 0
    if (teamId) {
      const { count: tCount } = await sb
        .from('sessions')
        .select('id', { count: 'exact', head: true })
        .eq('club_id', clubId)
        .eq('team_id', teamId)
        .eq('session_type', 'training')
        .gte('session_date', start)
        .lte('session_date', end)
      trainings_scheduled = tCount ?? 0

      const { count: mCount } = await sb
        .from('sessions')
        .select('id', { count: 'exact', head: true })
        .eq('club_id', clubId)
        .eq('team_id', teamId)
        .in('session_type', ['match', 'friendly'])
        .gte('session_date', start)
        .lte('session_date', end)
      matches_team_total = mCount ?? 0
    }

    // All attendance rows for this player in season, joined with session type/date
    const { data: rows } = await sb
      .from('session_attendance')
      .select('status, minutes_played, goals, assists, yellow_cards, red_cards, rating, sessions!inner(session_type, session_date, team_id, club_id)')
      .eq('player_id', playerId)
      .gte('sessions.session_date', start)
      .lte('sessions.session_date', end)
      .eq('sessions.club_id', clubId)

    let trainings_attended = 0
    let trainings_justified = 0
    let trainings_absent = 0
    let matches_played = 0
    let minutes_played = 0
    let goals = 0
    let assists = 0
    let yellow_cards = 0
    let red_cards = 0
    let ratingSum = 0
    let ratingCount = 0

    for (const r of (rows ?? []) as Array<{
      status: string
      minutes_played: number | null
      goals: number | null
      assists: number | null
      yellow_cards: number | null
      red_cards: number | null
      rating: number | null
      sessions: { session_type: string } | { session_type: string }[]
    }>) {
      const s = Array.isArray(r.sessions) ? r.sessions[0] : r.sessions
      const type = s?.session_type
      if (type === 'training') {
        if (r.status === 'present') trainings_attended++
        else if (r.status === 'justified') trainings_justified++
        else if (r.status === 'absent') trainings_absent++
      } else if (type === 'match' || type === 'friendly' || type === 'futsal') {
        const mins = r.minutes_played ?? 0
        if (mins > 0) matches_played++
        minutes_played += mins
        goals += r.goals ?? 0
        assists += r.assists ?? 0
        yellow_cards += r.yellow_cards ?? 0
        red_cards += r.red_cards ?? 0
        if (r.rating != null) {
          ratingSum += r.rating
          ratingCount++
        }
      }
    }

    const attendance_pct = trainings_scheduled > 0
      ? Math.round((trainings_attended / trainings_scheduled) * 1000) / 10
      : 0

    // % minutos sobre partidos realmente jugados × 90 (excluye partidos donde no estuvo convocado/no jugó)
    const minutes_pct = matches_played > 0
      ? Math.round((minutes_played / (matches_played * 90)) * 1000) / 10
      : 0

    return {
      success: true,
      data: {
        season: currentSeason,
        trainings_scheduled,
        trainings_attended,
        trainings_justified,
        trainings_absent,
        attendance_pct,
        matches_team_total,
        matches_played,
        minutes_played,
        minutes_pct,
        goals,
        assists,
        yellow_cards,
        red_cards,
        rating_avg: ratingCount > 0 ? Math.round((ratingSum / ratingCount) * 10) / 10 : null,
      },
    }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}
