'use server'
/* eslint-disable no-restricted-imports -- acción PÚBLICA (sin sesión): admin client + token. */

// Acciones PÚBLICAS de la página de renovación nativa /renovacion/[token].
// La familia abre el link, marca SÍ/NO con consentimiento RGPD, y aquí:
//   1) Resolvemos el token (HMAC del playerId).
//   2) Validamos consent.
//   3) Marcamos players.wants_to_continue + disparamos el email
//      `wants_to_continue_yes`/`_no` que YA EXISTE en player.actions.ts (`sendEmail`).
//      Así reusamos toda la lógica de Getafe (idéntica) sin duplicar.

import { createAdminClient } from '@/lib/supabase/admin'
import { verifyRenewalToken } from '@/lib/utils/renewal-token'
import { revalidatePath } from 'next/cache'

export interface PlayerRenewalInfo {
  ok: boolean
  error?: string
  playerName?: string
  clubName?: string
  clubLogo?: string | null
  brand?: string
  nextSeasonLabel?: string  // texto humano: "26/27" o "2026/27" según current_season
  // Estado actual (null = aún no contestaron). Si ya tiene respuesta, la mostramos
  // y permitimos cambiarla, no es "denegado".
  currentChoice?: boolean | null
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function resolvePlayer(sb: any, token: string) {
  const playerId = verifyRenewalToken(token)
  if (!playerId) return { error: 'Enlace no válido o caducado' as const }
  const { data: player } = await sb.from('players')
    .select('id, club_id, first_name, last_name, wants_to_continue')
    .eq('id', playerId).maybeSingle()
  if (!player) return { error: 'No encontramos a este jugador. Pide al club un enlace nuevo.' as const }
  return { player }
}

/** Datos para la página: nombre jugador + club + branding + temporada destino. */
export async function getPlayerRenewalInfo(token: string): Promise<PlayerRenewalInfo> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = createAdminClient() as any
    const r = await resolvePlayer(sb, token)
    if (r.error || !r.player) return { ok: false, error: r.error }
    const p = r.player
    const [{ data: club }, { data: settings }] = await Promise.all([
      sb.from('clubs').select('name, logo_url, primary_color').eq('id', p.club_id).maybeSingle(),
      sb.from('club_settings').select('current_season').eq('club_id', p.club_id).maybeSingle(),
    ])
    // Etiqueta de temporada destino — reusa bumpSeason si current_season existe.
    let nextSeasonLabel: string | undefined
    if (settings?.current_season) {
      try {
        const { bumpSeason } = await import('@/lib/utils/season')
        nextSeasonLabel = bumpSeason(settings.current_season)
      } catch { /* sin etiqueta — la página cae a "la próxima temporada" */ }
    }
    return {
      ok: true,
      playerName: `${p.first_name ?? ''} ${p.last_name ?? ''}`.trim(),
      clubName: club?.name ?? 'el club',
      clubLogo: club?.logo_url ?? null,
      brand: club?.primary_color || '#2563eb',
      nextSeasonLabel,
      currentChoice: p.wants_to_continue ?? null,
    }
  } catch (e) {
    return { ok: false, error: (e as Error).message }
  }
}

/**
 * Marca wants_to_continue en el jugador y dispara el email automático.
 * Reusa `sendEmail` de player.actions.ts (idéntico a lo de Getafe) — la única
 * diferencia es que aquí entramos sin sesión, así que pasamos por admin client
 * directamente y replicamos su comportamiento clave (insert en communications +
 * marcado en players + revalidate). No tocamos team_id/next_team_id desde aquí:
 * eso lo decide el club en su panel.
 */
export async function submitRenewal(
  token: string,
  wants: boolean,
  consent: boolean,
): Promise<{ success: boolean; error?: string }> {
  try {
    if (consent !== true) {
      return { success: false, error: 'Debes aceptar el tratamiento de datos para continuar.' }
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = createAdminClient() as any
    const r = await resolvePlayer(sb, token)
    if (r.error || !r.player) return { success: false, error: r.error }
    const { id: playerId, club_id: clubId } = r.player

    // 1) Marcar wants_to_continue (solo si cambia — evita doble email)
    const previous = r.player.wants_to_continue
    const changed = previous !== wants
    const { error: upErr } = await sb.from('players')
      .update({ wants_to_continue: wants })
      .eq('id', playerId).eq('club_id', clubId)
    if (upErr) return { success: false, error: upErr.message }

    // 2) Si cambió la respuesta, disparar el email acuse de recibo
    //    (`wants_to_continue_yes` / `_no`). Reusa `sendEmail` exactamente como
    //    Getafe; usa plantilla del club si tiene, fallback genérico si no.
    if (changed) {
      try {
        const { sendEmail } = await import('@/features/jugadores/actions/player.actions')
        const emailType = wants ? 'wants_to_continue_yes' : 'wants_to_continue_no'
        // clubIdOverride: flujo sin sesión. Reusa TODA la lógica de Getafe.
        await sendEmail(playerId, emailType, clubId)
      } catch (e) {
        // No bloqueamos a la familia si el email falla — quedó marcada la opción.
        console.warn('[submitRenewal] email no enviado:', (e as Error).message)
      }
    }

    revalidatePath('/jugadores/inscripciones')
    revalidatePath(`/jugadores/${playerId}`)
    return { success: true }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}
