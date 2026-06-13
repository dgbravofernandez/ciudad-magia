// Google Calendar — integración para crear eventos automáticamente
// cuando se reserva una demo. Reutiliza el OAuth ya configurado.
//
// SCOPE necesario: 'https://www.googleapis.com/auth/calendar.events'
//
// El refresh_token se guarda en platform_integrations al conectar.

import { google } from 'googleapis'
import { getOAuthClient } from './oauth'
import { createAdminClient } from '@/lib/supabase/admin'

export const GOOGLE_CALENDAR_SCOPES = [
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/userinfo.email',
]

export interface CalendarEventInput {
  summary: string
  description: string
  startISO: string
  durationMin: number
  attendeeEmail?: string
  attendeeName?: string
  withMeet?: boolean
}

/** Obtiene el refresh_token del superadmin que tenga Calendar conectado. */
async function getCalendarToken(): Promise<{ refreshToken: string; calendarId: string } | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createAdminClient() as any
  const { data } = await sb
    .from('platform_integrations')
    .select('refresh_token, calendar_id')
    .eq('provider', 'google_calendar')
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (!data?.refresh_token) return null
  return { refreshToken: data.refresh_token, calendarId: data.calendar_id ?? 'primary' }
}

/**
 * Crea un evento en Google Calendar del superadmin conectado.
 * Si NO hay nadie conectado, retorna null silenciosamente (graceful degradation).
 */
export async function createCalendarEvent(input: CalendarEventInput): Promise<{ eventId: string; meetLink?: string } | null> {
  const tok = await getCalendarToken()
  if (!tok) return null

  try {
    const oauth = getOAuthClient()
    oauth.setCredentials({ refresh_token: tok.refreshToken })
    const calendar = google.calendar({ version: 'v3', auth: oauth })

    const start = new Date(input.startISO)
    const end = new Date(start.getTime() + input.durationMin * 60_000)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const requestBody: any = {
      summary: input.summary,
      description: input.description,
      start: { dateTime: start.toISOString(), timeZone: 'Europe/Madrid' },
      end: { dateTime: end.toISOString(), timeZone: 'Europe/Madrid' },
      attendees: input.attendeeEmail ? [{ email: input.attendeeEmail, displayName: input.attendeeName }] : undefined,
      reminders: {
        useDefault: false,
        overrides: [
          { method: 'email', minutes: 60 * 24 },     // 24h antes email
          { method: 'popup', minutes: 30 },          // 30 min antes popup
        ],
      },
    }

    if (input.withMeet) {
      requestBody.conferenceData = {
        createRequest: {
          requestId: `cluberly-${Date.now()}`,
          conferenceSolutionKey: { type: 'hangoutsMeet' },
        },
      }
    }

    const res = await calendar.events.insert({
      calendarId: tok.calendarId,
      requestBody,
      conferenceDataVersion: input.withMeet ? 1 : 0,
      sendUpdates: 'all',
    })

    return {
      eventId: res.data.id ?? '',
      meetLink: res.data.hangoutLink ?? undefined,
    }
  } catch (err) {
    console.error('[gcal] createCalendarEvent failed:', (err as Error).message)
    return null
  }
}

/** Cancela un evento por id (para cuando se cancela una demo). */
export async function deleteCalendarEvent(eventId: string): Promise<boolean> {
  const tok = await getCalendarToken()
  if (!tok || !eventId) return false
  try {
    const oauth = getOAuthClient()
    oauth.setCredentials({ refresh_token: tok.refreshToken })
    const calendar = google.calendar({ version: 'v3', auth: oauth })
    await calendar.events.delete({ calendarId: tok.calendarId, eventId, sendUpdates: 'all' })
    return true
  } catch (err) {
    console.error('[gcal] deleteCalendarEvent failed:', (err as Error).message)
    return false
  }
}
