'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { sendMarketingEmail } from '@/lib/email/marketing-send'

interface ReferralInput {
  referrerClubId?: string | null
  referrerName: string
  referrals: Array<{
    clubName: string
    contactEmail?: string
    contactPhone?: string
    notes?: string
  }>
}

export async function submitReferrals(input: ReferralInput) {
  if (!input.referrerName?.trim()) return { success: false, error: 'Falta tu nombre' }
  const valid = (input.referrals ?? []).filter(r => r.clubName?.trim())
  if (valid.length === 0) return { success: false, error: 'Añade al menos un club' }
  if (valid.length > 10) return { success: false, error: 'Máximo 10 referidos por vez' }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createAdminClient() as any

  const rows = valid.map(r => ({
    referrer_club_id: input.referrerClubId || null,
    referrer_name: input.referrerName.trim(),
    referred_club_name: r.clubName.trim().slice(0, 200),
    referred_contact_email: r.contactEmail?.trim().toLowerCase().slice(0, 200) || null,
    referred_contact_phone: r.contactPhone?.trim().slice(0, 30) || null,
    notes: r.notes?.trim().slice(0, 500) || null,
  }))

  const { error } = await sb.from('marketing_referrals').insert(rows)
  if (error) return { success: false, error: error.message }

  // Notificación al admin
  const adminEmail = process.env.MARKETING_GMAIL_USER ?? 'iakevoapp@gmail.com'
  try {
    await sendMarketingEmail({
      to: adminEmail,
      subject: `🎁 ${valid.length} nuevo${valid.length > 1 ? 's' : ''} referido${valid.length > 1 ? 's' : ''} de ${input.referrerName}`,
      fromName: 'Cluberly Bot',
      html: `<div style="font-family:system-ui;font-size:14px;line-height:1.6">
<h2>${valid.length} nuevo${valid.length > 1 ? 's' : ''} referido${valid.length > 1 ? 's' : ''}</h2>
<p>De: <strong>${input.referrerName}</strong>${input.referrerClubId ? ` (cliente Cluberly)` : ''}</p>
<table cellpadding="6" style="border-collapse:collapse;border:1px solid #ddd">
<tr style="background:#f9fafb"><th>Club</th><th>Email</th><th>Teléfono</th><th>Notas</th></tr>
${rows.map(r => `<tr>
<td>${r.referred_club_name}</td>
<td>${r.referred_contact_email ?? '—'}</td>
<td>${r.referred_contact_phone ?? '—'}</td>
<td>${r.notes ?? '—'}</td>
</tr>`).join('')}
</table>
<p style="margin-top:16px"><strong>Acción recomendada:</strong> llama o escribe HOY mismo mencionando que ${input.referrerName} os recomendó. Conversión referidos × 4 vs cold email.</p>
<p><a href="https://cluberly.club/superadmin">Ver en panel</a></p>
</div>`,
    })
  } catch { /* nunca rompe el flujo */ }

  return { success: true, count: valid.length }
}
