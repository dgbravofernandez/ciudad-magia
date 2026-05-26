'use server'

import { createAdminClient } from '@/lib/supabase/admin'

function slugify(text: string) {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
}

export async function createClub(input: {
  userId: string
  fullName: string
  clubName: string
  sport: string
  city: string
  plan: string
}) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = createAdminClient() as any

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

    // Create club
    const { data: club, error: clubError } = await sb.from('clubs').insert({
      name: input.clubName,
      slug,
      city: input.city || null,
      plan: ['starter', 'pro', 'club', 'elite', 'ltd'].includes(input.plan) ? input.plan : 'starter',
      active: true,
      subscription_status: 'trial',
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

    // Create club_member (owner)
    const { data: member, error: memberError } = await sb.from('club_members').insert({
      club_id: clubId,
      user_id: input.userId,
      full_name: input.fullName,
      email: '',   // will be filled from auth
      active: true,
    }).select('id').single()

    if (memberError || !member) return { success: false, error: memberError?.message ?? 'Error creando miembro' }

    // Assign admin role
    await sb.from('club_member_roles').insert({
      member_id: member.id,
      role: 'admin',
      team_id: null,
    })

    return { success: true, clubId }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

export async function getClubMemberEmail(userId: string, clubId: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createAdminClient() as any
  const { data } = await sb.auth.admin.getUserById(userId)
  const email = data?.user?.email ?? ''
  if (email) {
    await sb.from('club_members').update({ email }).eq('user_id', userId).eq('club_id', clubId)
  }
  return email
}
