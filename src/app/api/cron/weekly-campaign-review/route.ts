import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendMarketingEmail } from '@/lib/email/marketing-send'

export const dynamic = 'force-dynamic'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://cluberly.club'
// A dónde llega el resumen. Configurable; por defecto el correo de marca, NO el Gmail antiguo.
const REPORT_EMAIL = process.env.CAMPAIGN_REPORT_EMAIL ?? 'diego@cluberly.club'

interface WeekStats {
  sent: number
  opened: number
  clicked: number
  bounced: number
  demos: number
  trials: number
  paid: number
}

/** Stats de los últimos 7 días sobre marketing_email_sends + clubs. */
async function getWeekStats(): Promise<WeekStats> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createAdminClient() as any
  const since = new Date(Date.now() - 7 * 86400_000).toISOString()
  const now = new Date().toISOString()

  const [sent, opened, clicked, bounced, demos, trials, paid] = await Promise.all([
    sb.from('marketing_email_sends').select('id', { count: 'exact', head: true }).gte('sent_at', since).lt('sent_at', now),
    sb.from('marketing_email_sends').select('id', { count: 'exact', head: true }).gte('opened_at', since).lt('opened_at', now),
    sb.from('marketing_email_sends').select('id', { count: 'exact', head: true }).gte('clicked_at', since).lt('clicked_at', now),
    sb.from('marketing_email_sends').select('id', { count: 'exact', head: true }).eq('bounced', true).gte('sent_at', since).lt('sent_at', now),
    sb.from('marketing_demos').select('id', { count: 'exact', head: true }).gte('created_at', since).lt('created_at', now),
    sb.from('clubs').select('id', { count: 'exact', head: true }).gte('created_at', since).lt('created_at', now),
    sb.from('clubs').select('id', { count: 'exact', head: true }).eq('subscription_status', 'active').gte('updated_at', since).lt('updated_at', now),
  ])

  return {
    sent: sent.count ?? 0,
    opened: opened.count ?? 0,
    clicked: clicked.count ?? 0,
    bounced: bounced.count ?? 0,
    demos: demos.count ?? 0,
    trials: trials.count ?? 0,
    paid: paid.count ?? 0,
  }
}

/** Embudo acumulado. */
async function getFunnel() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createAdminClient() as any
  const [total, withEmail, pending, contacted, replied, demo, customer] = await Promise.all([
    sb.from('marketing_clubs').select('id', { count: 'exact', head: true }),
    sb.from('marketing_clubs').select('id', { count: 'exact', head: true }).not('email', 'is', null),
    sb.from('marketing_clubs').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
    sb.from('marketing_clubs').select('id', { count: 'exact', head: true }).in('status', ['sent_1', 'sent_2', 'sent_3']),
    sb.from('marketing_clubs').select('id', { count: 'exact', head: true }).eq('status', 'replied'),
    sb.from('marketing_clubs').select('id', { count: 'exact', head: true }).eq('status', 'demo_booked'),
    sb.from('marketing_clubs').select('id', { count: 'exact', head: true }).eq('status', 'customer'),
  ])
  return {
    total: total.count ?? 0,
    withEmail: withEmail.count ?? 0,
    pending: pending.count ?? 0,
    contacted: contacted.count ?? 0,
    replied: replied.count ?? 0,
    demo: demo.count ?? 0,
    customer: customer.count ?? 0,
  }
}

/**
 * Reglas heurísticas → recomendaciones accionables.
 * Estos umbrales son los típicos de cold email B2B; ajústalos con datos reales.
 */
function buildRecommendations(s: WeekStats): string[] {
  const recs: string[] = []
  const openRate = s.sent > 0 ? (s.opened / s.sent) * 100 : 0
  const clickRate = s.sent > 0 ? (s.clicked / s.sent) * 100 : 0
  const bounceRate = s.sent > 0 ? (s.bounced / s.sent) * 100 : 0

  if (s.sent === 0) {
    recs.push('⏸️ Esta semana no se envió ningún email. ¿La campaña está en pausa o el cap a 0? Revisa el panel.')
    return recs
  }
  if (bounceRate > 5) {
    recs.push(`🔴 Rebote alto (${bounceRate.toFixed(1)}%). Más de 5% daña la reputación del dominio. Limpia emails inválidos antes de seguir enviando.`)
  }
  if (openRate < 30) {
    recs.push(`📬 Apertura baja (${openRate.toFixed(0)}%). El asunto no engancha. Prueba una variante A/B nueva del asunto del Email 1.`)
  } else if (openRate >= 45) {
    recs.push(`✅ Apertura buena (${openRate.toFixed(0)}%). Los asuntos funcionan, no los toques.`)
  }
  if (s.opened > 20 && clickRate < 2) {
    recs.push(`🖱️ Abren pero no hacen clic (${clickRate.toFixed(1)}%). El cuerpo o el CTA no convencen. Replantea el cuerpo o destaca más el enlace al vídeo/demo.`)
  }
  if (s.demos === 0 && s.sent > 0) {
    recs.push('📞 0 demos esta semana. Considera reescribir el Email 1 o subir prioridad a clubes pequeños (100-200 jugadores).')
  }
  if (s.clicked > 10 && s.demos === 0) {
    recs.push('🎬 Hay clics pero 0 demos: la gente ve el vídeo/demo pero no reserva. Revisa la página /demo y el CTA de "reservar".')
  }
  if (recs.length === 0) {
    recs.push('👍 Métricas dentro de lo normal. Mantén el ritmo y vuelve a revisar la semana que viene.')
  }
  return recs
}

export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) return NextResponse.json({ error: 'Server misconfiguration' }, { status: 500 })
  const authHeader = req.headers.get('authorization')
  const isVercelCron = req.headers.get('x-vercel-cron') === '1'
  if (!isVercelCron && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const s = await getWeekStats()
  const f = await getFunnel()

  const openRate = s.sent > 0 ? Math.round((s.opened / s.sent) * 100) : 0
  const clickRate = s.sent > 0 ? Math.round((s.clicked / s.sent) * 1000) / 10 : 0
  const recs = buildRecommendations(s)

  const today = new Date().toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })

  await sendMarketingEmail({
    to: REPORT_EMAIL,
    subject: `📈 Revisión semanal de la campaña — ${today}`,
    fromName: 'Cluberly Bot',
    html: `
<div style="font-family:system-ui;font-size:14px;line-height:1.6;color:#1f2937;max-width:620px">
<h2 style="color:#BE185D;margin-bottom:4px">📈 Revisión semanal de la campaña</h2>
<p style="color:#6b7280;margin-top:0">Últimos 7 días · ${today}</p>

<h3 style="color:#374151;margin-top:24px">Actividad de la semana</h3>
<table cellpadding="8" style="border-collapse:collapse;width:100%;margin:8px 0;background:#FDF2F8;border-radius:8px">
<tr><td><strong>📧 Emails enviados</strong></td><td style="text-align:right;font-size:18px;font-weight:700">${s.sent}</td></tr>
<tr><td><strong>👀 Aperturas</strong></td><td style="text-align:right;font-size:18px;font-weight:700">${s.opened} <span style="color:#888;font-size:13px">(${openRate}%)</span></td></tr>
<tr><td><strong>🖱️ Clics</strong></td><td style="text-align:right;font-size:18px;font-weight:700">${s.clicked} <span style="color:#888;font-size:13px">(${clickRate}%)</span></td></tr>
<tr><td><strong>↩️ Rebotes</strong></td><td style="text-align:right;font-size:18px;font-weight:700;color:${s.bounced > 0 ? '#dc2626' : '#374151'}">${s.bounced}</td></tr>
<tr><td><strong>📞 Demos reservadas</strong></td><td style="text-align:right;font-size:18px;font-weight:700;color:#BE185D">${s.demos}</td></tr>
<tr><td><strong>🆕 Trials nuevos</strong></td><td style="text-align:right;font-size:18px;font-weight:700;color:#BE185D">${s.trials}</td></tr>
<tr><td><strong>💰 Conversiones a pago</strong></td><td style="text-align:right;font-size:18px;font-weight:700;color:#10b981">${s.paid}</td></tr>
</table>

<h3 style="color:#374151;margin-top:24px">Embudo acumulado</h3>
<table cellpadding="6" style="border-collapse:collapse;font-size:13px">
<tr><td>Leads con email</td><td><strong>${f.withEmail}</strong> / ${f.total} totales</td></tr>
<tr><td>Pendientes de contactar</td><td><strong>${f.pending}</strong></td></tr>
<tr><td>Contactados (en secuencia)</td><td><strong>${f.contacted}</strong></td></tr>
<tr><td>Respondieron</td><td><strong>${f.replied}</strong></td></tr>
<tr><td>Demo reservada</td><td><strong>${f.demo}</strong></td></tr>
<tr><td>🎉 Clientes</td><td><strong>${f.customer}</strong></td></tr>
</table>

<h3 style="color:#374151;margin-top:24px">🧠 Recomendaciones</h3>
<ul style="padding-left:18px">
${recs.map(r => `<li style="margin-bottom:8px">${r}</li>`).join('')}
</ul>

<p style="margin-top:16px;padding:12px;background:#eff6ff;border-radius:8px;font-size:13px;color:#1e40af">
💡 <strong>Para una revisión a fondo</strong> (reescribir asuntos, cuerpo o el vídeo de demo), pídeselo a Claude con estos números delante.
</p>

<p style="text-align:center;margin-top:20px">
  <a href="${APP_URL}/superadmin/campanas" style="background:#EC4899;color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none;font-weight:600">Ver panel de campañas</a>
</p>
</div>`,
  })

  return NextResponse.json({ success: true, report_sent_to: REPORT_EMAIL, week_stats: s, funnel: f, recommendations: recs })
}
