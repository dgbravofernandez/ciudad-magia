'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

function slugify(text: string) {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
}

/** Sanea un valor de tracking que viene del cliente: string corta o null. */
function cleanTag(v: unknown, max = 100): string | null {
  if (typeof v !== 'string') return null
  const t = v.trim().slice(0, max)
  return t.length > 0 ? t : null
}

export async function createClub(input: {
  userId: string
  fullName: string
  clubName: string
  sport: string
  city: string
  plan: string
  contactPhone?: string
  acquisition?: { source?: string | null; campaign?: string | null; content?: string | null }
}) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = createAdminClient() as any

    if (!input.userId) return { success: false, error: 'ID de usuario inválido' }
    const { data: authCheck } = await sb.auth.admin.getUserById(input.userId)
    const targetUser = authCheck?.user
    if (!targetUser) return { success: false, error: 'Usuario no encontrado. Por favor vuelve al paso anterior.' }

    // SEC: el userId viene del cliente — verificar que pertenece a quien hace la petición.
    // Camino 1 (login previo): hay sesión → debe coincidir con el userId.
    // Camino 2 (signup nuevo): no hay sesión porque la confirmación de email está activa.
    //   Solo se acepta una cuenta RECIÉN creada (<15 min), sin confirmar y sin clubs —
    //   un atacante no puede usar el userId de una cuenta establecida.
    const supabase = await createClient()
    const { data: { user: sessionUser } } = await supabase.auth.getUser()

    if (sessionUser) {
      if (sessionUser.id !== input.userId) {
        return { success: false, error: 'No autorizado: el usuario no coincide con la sesión activa' }
      }
    } else {
      const createdAt = targetUser.created_at ? new Date(targetUser.created_at).getTime() : 0
      const isFresh = Date.now() - createdAt < 15 * 60 * 1000
      const isUnconfirmed = !targetUser.email_confirmed_at
      const { count: membershipCount } = await sb
        .from('club_members')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', input.userId)
      if (!isFresh || !isUnconfirmed || (membershipCount ?? 0) > 0) {
        return { success: false, error: 'No autorizado: inicia sesión para crear un club con esta cuenta' }
      }
    }

    // Generate unique slug
    const baseSlug = slugify(input.clubName)
    let slug = baseSlug
    let attempt = 0
    while (attempt < 5) {
      const { data: existing } = await sb.from('clubs').select('id').eq('slug', slug).maybeSingle()
      if (!existing) break
      attempt++
      slug = `${baseSlug}-${attempt}`
    }

    // Sport: el cliente lo manda como "⚽ Fútbol", guardamos solo "Fútbol"
    const cleanSport = (input.sport ?? '').replace(/[\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}]/gu, '').trim() || 'Otro'

    // Plan válido (basic/pro/club/personalizado) — caer en basic si llega algo desconocido
    const validPlan = ['basic', 'pro', 'club', 'personalizado'].includes(input.plan) ? input.plan : 'basic'

    // Trial 14 días desde HOY — CRÍTICO para que el cron de aviso "queda X días" se dispare
    const trialEndsAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString()

    // Create club
    const { data: club, error: clubError } = await sb.from('clubs').insert({
      name: input.clubName,
      slug,
      city: input.city || null,
      sport: cleanSport,
      plan: validPlan,
      active: true,
      subscription_status: 'trial',
      trial_ends_at: trialEndsAt,
      contact_phone: cleanTag(input.contactPhone, 30),
      acquisition_source: cleanTag(input.acquisition?.source),
      acquisition_campaign: cleanTag(input.acquisition?.campaign),
      acquisition_content: cleanTag(input.acquisition?.content),
    }).select('id').single()

    if (clubError || !club) return { success: false, error: clubError?.message ?? 'Error creando club' }

    const clubId = club.id

    // Create default club_settings
    await sb.from('club_settings').insert({
      club_id: clubId,
      inscription_open: false,
      sanction_yellow_threshold: 5,
      sanction_matches: 1,
    })

    // Create club_member (owner) — email directo de auth, sin action separada
    const { data: member, error: memberError } = await sb.from('club_members').insert({
      club_id: clubId,
      user_id: input.userId,
      full_name: input.fullName,
      email: targetUser.email ?? '',
      active: true,
    }).select('id').single()

    if (memberError || !member) return { success: false, error: memberError?.message ?? 'Error creando miembro' }

    // Assign admin role
    await sb.from('club_member_roles').insert({
      member_id: member.id,
      role: 'admin',
      team_id: null,
    })

    // Auto-confirmar el email para que el usuario pueda hacer login sin confirmar
    // Necesario cuando Supabase tiene "Email Confirmation" habilitado
    await sb.auth.admin.updateUserById(input.userId, { email_confirm: true })

    // Notificación interna: si viene de campaña outbound, avisar al admin
    const fromOutbound = input.acquisition?.source === 'email'
    if (fromOutbound) {
      try {
        const { sendMarketingEmail } = await import('@/lib/email/marketing-send')
        const adminEmail = process.env.MARKETING_GMAIL_USER ?? 'iakevoapp@gmail.com'
        await sendMarketingEmail({
          to: adminEmail,
          subject: `🎯 Lead caliente: ${input.clubName} acaba de crear cuenta`,
          fromName: 'Cluberly Bot',
          html: `<div style="font-family:system-ui;font-size:14px;line-height:1.5">
<h2>Nueva alta desde campaña outbound</h2>
<p><strong>Llámalo en las próximas 2 horas</strong> — la conversión cae 80% pasadas 24h.</p>
<table cellpadding="6" style="border-collapse:collapse">
<tr><td><strong>Club:</strong></td><td>${input.clubName}</td></tr>
<tr><td><strong>Contacto:</strong></td><td>${input.fullName}</td></tr>
<tr><td><strong>Email:</strong></td><td><a href="mailto:${targetUser.email}">${targetUser.email}</a></td></tr>
<tr><td><strong>Teléfono:</strong></td><td>${input.contactPhone ? `<a href="tel:${input.contactPhone}">${input.contactPhone}</a>` : '— (no facilitado)'}</td></tr>
<tr><td><strong>Plan:</strong></td><td>${validPlan}</td></tr>
<tr><td><strong>Campaña:</strong></td><td>${input.acquisition?.campaign ?? 'directa'}</td></tr>
<tr><td><strong>Club fuente:</strong></td><td>${input.acquisition?.content ?? '—'}</td></tr>
</table>
<p><a href="https://cluberly.vercel.app/superadmin">Ver en panel superadmin</a></p>
</div>`,
        })
      } catch (err) {
        console.warn('[onboarding] notificación admin falló:', (err as Error).message)
      }
    }

    return { success: true, clubId }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

