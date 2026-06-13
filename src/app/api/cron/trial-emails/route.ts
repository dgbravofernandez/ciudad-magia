import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendHtmlEmail } from '@/lib/email/send'
import { logger } from '@/lib/logger'

export const maxDuration = 60

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://cluberly.vercel.app'
const FROM_NAME = 'Cluberly'
const CONTACT_EMAIL = 'iakevoapp@gmail.com'

const DAY_MS = 86_400_000

type TrialEmailType = 'welcome' | 'import_help' | 'trial_ending'

function wrap(title: string, body: string): string {
  return `
  <div style="font-family:system-ui,-apple-system,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#0F172A">
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:24px">
      <div style="width:32px;height:32px;border-radius:8px;background:linear-gradient(135deg,#EC4899,#BE185D);color:#fff;font-weight:800;font-size:16px;text-align:center;line-height:32px">C</div>
      <span style="font-weight:800;font-size:18px">cluberly</span>
    </div>
    <h1 style="font-size:20px;font-weight:800;margin:0 0 16px">${title}</h1>
    ${body}
    <p style="font-size:13px;color:#64748B;margin-top:32px">
      ¿Dudas? Responde a este email o escríbenos a ${CONTACT_EMAIL}.<br/>
      — El equipo de Cluberly
    </p>
  </div>`
}

function buildEmail(type: TrialEmailType, clubName: string, trialEndsAt: string | null): { subject: string; html: string; text: string } {
  if (type === 'welcome') {
    return {
      subject: `Bienvenido a Cluberly, ${clubName} 👋`,
      html: wrap(`¡Tu club ya está en Cluberly!`, `
        <p style="font-size:15px;line-height:1.6">Tienes 14 días de prueba con todo incluido. Para tenerlo en marcha hoy, 3 pasos:</p>
        <ol style="font-size:15px;line-height:1.8">
          <li><strong>Importa tus jugadores desde el Excel de la federación</strong> — ve a <a href="${APP_URL}/jugadores" style="color:#EC4899">Jugadores</a>, pestaña <em>Importar</em>, y arrastra el archivo. Detecta categorías y equipos automáticamente.</li>
          <li><strong>Configura tus cuotas</strong> — en <a href="${APP_URL}/configuracion" style="color:#EC4899">Configuración → Cuotas</a> define importes y plazos de pago.</li>
          <li><strong>Registra tu primer cobro</strong> — en <a href="${APP_URL}/contabilidad/pagos" style="color:#EC4899">Contabilidad → Pagos</a>.</li>
        </ol>
        <p style="text-align:center;margin:28px 0">
          <a href="${APP_URL}/dashboard" style="background:#EC4899;color:#fff;padding:12px 28px;border-radius:10px;text-decoration:none;font-weight:700;font-size:15px">Entrar a mi club</a>
        </p>
        <p style="font-size:14px;line-height:1.6;color:#475569">¿Tienes el Excel pero prefieres que lo hagamos nosotros? Responde a este email y lo importamos en 24h sin coste.</p>`),
      text: `Bienvenido a Cluberly. Tienes 14 dias de prueba. Pasos: 1) Importa jugadores desde el Excel de la federacion en ${APP_URL}/jugadores (pestana Importar). 2) Configura cuotas en ${APP_URL}/configuracion. 3) Registra tu primer cobro. Si prefieres que importemos el Excel nosotros, responde a este email. Dudas: ${CONTACT_EMAIL}`,
    }
  }
  if (type === 'import_help') {
    return {
      subject: `¿Te ayudamos a importar los jugadores de ${clubName}?`,
      html: wrap(`Tu Excel, importado gratis`, `
        <p style="font-size:15px;line-height:1.6">Vimos que aún no has subido jugadores a tu club. Es el paso que más cuesta — y por eso lo hacemos nosotros.</p>
        <p style="font-size:15px;line-height:1.6"><strong>Responde a este email con tu Excel o lista de jugadores</strong> (nombre, fecha de nacimiento, contacto del tutor) y en menos de 24h los tienes cargados, organizados por equipos y listos para gestionar cuotas.</p>
        <p style="font-size:15px;line-height:1.6">Sin compromiso: si al final Cluberly no te encaja, te llevas el Excel ordenado.</p>
        <p style="text-align:center;margin:28px 0">
          <a href="${APP_URL}/jugadores" style="background:#EC4899;color:#fff;padding:12px 28px;border-radius:10px;text-decoration:none;font-weight:700;font-size:15px">O súbelos tú en 5 minutos</a>
        </p>`),
      text: `Aun no has subido jugadores a ${clubName}. Respondenos con tu Excel y los importamos gratis en 24h. O subelos tu en ${APP_URL}/jugadores. Dudas: ${CONTACT_EMAIL}`,
    }
  }
  const endDate = trialEndsAt
    ? new Date(trialEndsAt).toLocaleDateString('es-ES', { day: 'numeric', month: 'long' })
    : 'pronto'
  return {
    subject: `Tu prueba de Cluberly termina el ${endDate}`,
    html: wrap(`Quedan pocos días de prueba`, `
      <p style="font-size:15px;line-height:1.6">La prueba gratuita de <strong>${clubName}</strong> termina el <strong>${endDate}</strong>. Para no perder el acceso a tus datos ni interrumpir la gestión del club, elige tu plan:</p>
      <p style="text-align:center;margin:28px 0">
        <a href="${APP_URL}/upgrade" style="background:#EC4899;color:#fff;padding:12px 28px;border-radius:10px;text-decoration:none;font-weight:700;font-size:15px">Ver planes y precios</a>
      </p>
      <p style="font-size:15px;line-height:1.6">Si algo no te ha convencido o te falta alguna función, <strong>respóndenos a este email</strong> — leemos y contestamos todo.</p>`),
    text: `La prueba de ${clubName} termina el ${endDate}. Elige plan en ${APP_URL}/upgrade o respondenos si algo no te convence. Dudas: ${CONTACT_EMAIL}`,
  }
}

// Cron diario. Para cada club en trial decide qué email del ciclo toca:
//  - welcome:      club creado en las últimas 48h
//  - import_help:  club con 3-10 días de vida y 0 jugadores
//  - trial_ending: trial caduca en <=4 días
// Idempotencia: trial_emails UNIQUE(club_id, email_type) — se inserta ANTES de
// enviar; si el insert choca, ya se envió. Si el envío falla, se borra el
// registro para reintentar al día siguiente.
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  const cronHeader = req.headers.get('x-vercel-cron')
  const cronSecret = process.env.CRON_SECRET

  if (!cronSecret) {
    console.error('[CRON] CRON_SECRET not configured — refusing request')
    return NextResponse.json({ error: 'Server misconfiguration' }, { status: 500 })
  }
  if (!cronHeader && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = createAdminClient() as any

    const { data: clubs, error } = await sb
      .from('clubs')
      .select('id, name, created_at, trial_ends_at, subscription_status')
      .eq('active', true)
      .eq('subscription_status', 'trial')

    if (error) {
      logger.error({ action: 'trialEmails', error: error.message })
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const now = Date.now()
    const results: { club: string; type: TrialEmailType; sent: boolean; error?: string }[] = []

    for (const club of clubs ?? []) {
      try {
        const ageMs = now - new Date(club.created_at).getTime()
        const trialLeftMs = club.trial_ends_at ? new Date(club.trial_ends_at).getTime() - now : null

        let type: TrialEmailType | null = null
        if (ageMs <= 2 * DAY_MS) {
          type = 'welcome'
        } else if (trialLeftMs !== null && trialLeftMs > 0 && trialLeftMs <= 4 * DAY_MS) {
          // trial_ending tiene prioridad sobre import_help si coinciden
          type = 'trial_ending'
        } else if (ageMs >= 3 * DAY_MS && ageMs <= 10 * DAY_MS) {
          const { count: playerCount } = await sb
            .from('players')
            .select('id', { count: 'exact', head: true })
            .eq('club_id', club.id)
          if ((playerCount ?? 0) === 0) type = 'import_help'
        }
        if (!type) continue

        // Email del owner: primer miembro activo del club
        const { data: owner } = await sb
          .from('club_members')
          .select('email')
          .eq('club_id', club.id)
          .eq('active', true)
          .not('email', 'is', null)
          .order('created_at', { ascending: true })
          .limit(1)
          .maybeSingle()
        const to = owner?.email
        if (!to) continue

        // Reservar el envío (idempotencia) — si choca con UNIQUE, ya se envió
        const { error: insertError } = await sb
          .from('trial_emails')
          .insert({ club_id: club.id, email_type: type, sent_to: to })
        if (insertError) continue // duplicado u otro fallo: no enviar

        const { subject, html, text } = buildEmail(type, club.name, club.trial_ends_at)
        const { sent, error: sendError } = await sendHtmlEmail({ to, subject, html, text, fromName: FROM_NAME, replyTo: CONTACT_EMAIL })

        if (!sent) {
          // Liberar la reserva para reintentar mañana
          await sb.from('trial_emails').delete().eq('club_id', club.id).eq('email_type', type)
        }
        results.push({ club: club.name, type, sent, error: sendError })
      } catch (clubError) {
        // Un club roto no debe parar el ciclo de los demás
        logger.error({ action: 'trialEmails', clubId: club.id, error: (clubError as Error).message })
      }
    }

    logger.info({ action: 'trialEmails', sent: results.filter(r => r.sent).length, total: results.length })
    return NextResponse.json({ ok: true, results })
  } catch (e) {
    logger.error({ action: 'trialEmails', error: (e as Error).message })
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
