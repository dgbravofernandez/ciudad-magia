import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendMarketingEmail } from '@/lib/email/marketing-send'

export const dynamic = 'force-dynamic'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://cluberly.club'

interface Counts {
  emails_sent: number
  emails_opened: number
  emails_clicked: number
  demos_booked: number
  trials_created: number
  paid_conversions: number
}

async function getYesterdayCounts(): Promise<Counts> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createAdminClient() as any
  const start = new Date()
  start.setDate(start.getDate() - 1)
  start.setHours(0, 0, 0, 0)
  const end = new Date()
  end.setHours(0, 0, 0, 0)
  const sIso = start.toISOString()
  const eIso = end.toISOString()

  const [sent, opened, clicked, demos, trials, paid] = await Promise.all([
    sb.from('marketing_email_sends').select('id', { count: 'exact', head: true }).gte('sent_at', sIso).lt('sent_at', eIso),
    sb.from('marketing_email_sends').select('id', { count: 'exact', head: true }).gte('opened_at', sIso).lt('opened_at', eIso),
    sb.from('marketing_email_sends').select('id', { count: 'exact', head: true }).gte('clicked_at', sIso).lt('clicked_at', eIso),
    sb.from('marketing_demos').select('id', { count: 'exact', head: true }).gte('created_at', sIso).lt('created_at', eIso),
    sb.from('clubs').select('id', { count: 'exact', head: true }).gte('created_at', sIso).lt('created_at', eIso),
    sb.from('clubs').select('id', { count: 'exact', head: true })
      .eq('subscription_status', 'active').gte('updated_at', sIso).lt('updated_at', eIso),
  ])

  return {
    emails_sent: sent.count ?? 0,
    emails_opened: opened.count ?? 0,
    emails_clicked: clicked.count ?? 0,
    demos_booked: demos.count ?? 0,
    trials_created: trials.count ?? 0,
    paid_conversions: paid.count ?? 0,
  }
}

async function getEmbudoTotals() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createAdminClient() as any
  const [total, pending, sent1, replied, demoBooked, customer] = await Promise.all([
    sb.from('marketing_clubs').select('id', { count: 'exact', head: true }),
    sb.from('marketing_clubs').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
    sb.from('marketing_clubs').select('id', { count: 'exact', head: true }).in('status', ['sent_1', 'sent_2', 'sent_3']),
    sb.from('marketing_clubs').select('id', { count: 'exact', head: true }).eq('status', 'replied'),
    sb.from('marketing_clubs').select('id', { count: 'exact', head: true }).eq('status', 'demo_booked'),
    sb.from('marketing_clubs').select('id', { count: 'exact', head: true }).eq('status', 'customer'),
  ])
  return {
    total: total.count ?? 0, pending: pending.count ?? 0, sent: sent1.count ?? 0,
    replied: replied.count ?? 0, demo: demoBooked.count ?? 0, customer: customer.count ?? 0,
  }
}

export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) return NextResponse.json({ error: 'Server misconfiguration' }, { status: 500 })
  const authHeader = req.headers.get('authorization')
  const isVercelCron = req.headers.get('x-vercel-cron') === '1'
  if (!isVercelCron && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const adminEmail = process.env.MARKETING_GMAIL_USER ?? 'iakevoapp@gmail.com'
  const counts = await getYesterdayCounts()
  const totals = await getEmbudoTotals()

  const openRate = counts.emails_sent > 0 ? Math.round((counts.emails_opened / counts.emails_sent) * 100) : 0
  const clickRate = counts.emails_sent > 0 ? Math.round((counts.emails_clicked / counts.emails_sent) * 100) : 0
  const yesterdayLabel = new Date(Date.now() - 86400_000).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })

  const totalContactados = totals.total - totals.pending
  const convPctTotal = totals.total > 0 ? Math.round((totals.customer / totals.total) * 1000) / 10 : 0

  await sendMarketingEmail({
    to: adminEmail,
    subject: `📊 Recap diario Cluberly — ${yesterdayLabel}`,
    fromName: 'Cluberly Bot',
    html: `
<div style="font-family:system-ui;font-size:14px;line-height:1.6;color:#1f2937;max-width:600px">
<h2 style="color:#BE185D">📊 Resumen de ayer (${yesterdayLabel})</h2>

<table cellpadding="8" style="border-collapse:collapse;width:100%;margin:16px 0;background:#FDF2F8;border-radius:8px">
<tr><td><strong>📧 Emails enviados</strong></td><td style="text-align:right;font-size:18px;font-weight:700">${counts.emails_sent}</td></tr>
<tr><td><strong>👀 Abiertos</strong></td><td style="text-align:right;font-size:18px;font-weight:700">${counts.emails_opened} <span style="color:#888;font-size:13px">(${openRate}%)</span></td></tr>
<tr><td><strong>🖱 Clics en links</strong></td><td style="text-align:right;font-size:18px;font-weight:700">${counts.emails_clicked} <span style="color:#888;font-size:13px">(${clickRate}%)</span></td></tr>
<tr><td><strong>📞 Demos reservadas</strong></td><td style="text-align:right;font-size:18px;font-weight:700;color:#BE185D">${counts.demos_booked}</td></tr>
<tr><td><strong>🆕 Trials creados</strong></td><td style="text-align:right;font-size:18px;font-weight:700;color:#BE185D">${counts.trials_created}</td></tr>
<tr><td><strong>💰 Conversiones a pago</strong></td><td style="text-align:right;font-size:18px;font-weight:700;color:#10b981">${counts.paid_conversions}</td></tr>
</table>

<h3 style="color:#374151;margin-top:24px">Embudo acumulado</h3>
<table cellpadding="6" style="border-collapse:collapse;font-size:13px">
<tr><td>Total leads</td><td><strong>${totals.total}</strong></td></tr>
<tr><td>Contactados</td><td><strong>${totalContactados}</strong> (${totals.total > 0 ? Math.round(totalContactados/totals.total*100):0}%)</td></tr>
<tr><td>Respondieron</td><td><strong>${totals.replied}</strong></td></tr>
<tr><td>Demo reservada</td><td><strong>${totals.demo}</strong></td></tr>
<tr><td>🎉 Clientes</td><td><strong>${totals.customer}</strong> (${convPctTotal}% sobre total)</td></tr>
</table>

<p style="margin-top:24px;padding:12px;background:${counts.demos_booked > 0 ? '#dcfce7' : '#fef3c7'};border-radius:8px;font-size:13px">
${counts.demos_booked > 0
  ? `<strong>🎯 ACCIÓN HOY:</strong> tienes ${counts.demos_booked} demo(s) reservada(s) ayer. Confirma teléfono y prepara la llamada.`
  : `<strong>⚠️</strong> Ayer 0 demos. Sube prioridad a clubes pequeños 100-200 jugadores o reescribe asunto.`}
</p>

<p style="text-align:center;margin-top:20px">
  <a href="${APP_URL}/superadmin/campanas" style="background:#EC4899;color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none;font-weight:600">Ver panel completo</a>
</p>
</div>`,
  })

  // Pedir referidos a clientes nuevos que llevan 7+ días pagando y aún no han recibido petición
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createAdminClient() as any
  const sevenDaysAgo = new Date(Date.now() - 7 * 86400_000).toISOString()
  const { data: candidates } = await sb
    .from('clubs')
    .select('id, name, slug')
    .eq('subscription_status', 'active')
    .lte('updated_at', sevenDaysAgo)
    .limit(20)

  let referralAsked = 0
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const club of (candidates ?? []) as any[]) {
    // ¿Ya le hemos preguntado?
    const { data: already } = await sb.from('marketing_referral_requests').select('club_id').eq('club_id', club.id).maybeSingle()
    if (already) continue

    // Email del owner
    const { data: owner } = await sb.from('club_members').select('full_name, email')
      .eq('club_id', club.id).eq('active', true).not('email', 'is', null)
      .order('created_at', { ascending: true }).limit(1).maybeSingle()
    if (!owner?.email) continue

    const firstName = (owner.full_name ?? '').split(' ')[0] || ''
    const sent = await sendMarketingEmail({
      to: owner.email,
      subject: `${firstName ? firstName + ', ¿' : '¿'}conoces otros clubes a los que les pueda ayudar?`,
      fromName: 'Diego Bravo · Cluberly',
      html: `
<div style="font-family:Georgia,serif;color:#222;line-height:1.55;font-size:15px;max-width:560px">
<p>Hola ${firstName || 'qué tal'},</p>
<p>Diego de Cluberly. Veo que ${club.name} lleva ya una semana con nosotros y eso me hace muchísima ilusión.</p>
<p>Te quería pedir un favor pequeño, sin compromiso: ¿conoces otros 2 clubes parecidos al vuestro a los que crees que Cluberly les podría ahorrar tiempo?</p>
<p>Si te animas, déjame los nombres aquí: <a href="${APP_URL}/recomendar?c=${club.id}">cluberly.club/recomendar</a></p>
<p>Una recomendación tuya vale más que 100 emails fríos. Lo agradezco un montón.</p>
<p>Un saludo,<br/>Diego Bravo<br/>665 676 341</p>
</div>`,
    })
    if (sent.sent) {
      await sb.from('marketing_referral_requests').insert({ club_id: club.id })
      referralAsked++
    }
  }

  return NextResponse.json({ success: true, recap_sent: true, referrals_asked: referralAsked, counts, totals })
}
