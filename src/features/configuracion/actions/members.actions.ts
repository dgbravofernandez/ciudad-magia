'use server'

import { getScopedClient } from '@/lib/supabase/scoped-client'
import { revalidatePath } from 'next/cache'
import { sendHtmlEmail } from '@/lib/email/send'
import type { Role } from '@/types/roles'

function requireAdmin(roles: string[]) {
  if (!roles.some((r) => ['admin', 'direccion'].includes(r))) {
    throw new Error('Solo administradores pueden gestionar miembros')
  }
}

/** Helper compartido: obtiene el nombre del club desde la BD.
 *  Todos los emails del módulo de miembros lo usan para evitar hardcodes. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getClubName(sb: any, clubId: string): Promise<string> {
  const { data } = await sb.from('clubs').select('name').eq('id', clubId).single()
  return (data as { name?: string } | null)?.name ?? 'El Club'
}

function randomPassword(len = 12) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%'
  let out = ''
  for (let i = 0; i < len; i++) out += chars[Math.floor(Math.random() * chars.length)]
  return out
}

export interface NewMemberInput {
  email: string
  full_name: string
  roles: Role[]
  team_id?: string | null
  phone?: string
}

/**
 * Crea un nuevo usuario en Supabase Auth + club_members + club_member_roles
 * y le envía las credenciales temporales por email.
 */
export async function createMember(
  input: NewMemberInput
): Promise<{ success: boolean; error?: string; memberId?: string; tempPassword?: string }> {
  try {
    const { sb, clubId, roles } = await getScopedClient()
    requireAdmin(roles)

    if (!input.email?.trim()) return { success: false, error: 'Email requerido' }
    if (!input.full_name?.trim()) return { success: false, error: 'Nombre requerido' }
    if (input.roles.length === 0) return { success: false, error: 'Asigna al menos un rol' }

    const tempPassword = randomPassword(14)

    const clubName = await getClubName(sb, clubId)

    // 1) Create auth user
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: authData, error: authErr } = await (sb as any).auth.admin.createUser({
      email: input.email.trim().toLowerCase(),
      password: tempPassword,
      email_confirm: true,
      user_metadata: { full_name: input.full_name.trim() },
    })
    if (authErr) return { success: false, error: authErr.message }
    const userId = authData.user.id

    // 2) Create club_members row
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: member, error: memErr } = await (sb as any)
      .from('club_members')
      .insert({
        user_id: userId,
        club_id: clubId,
        full_name: input.full_name.trim(),
        email: input.email.trim().toLowerCase(),
        phone: input.phone ?? null,
        active: true,
        must_change_password: true,  // fuerza cambio en primer login
      })
      .select('id')
      .single()
    if (memErr) {
      // rollback auth user
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (sb as any).auth.admin.deleteUser(userId)
      return { success: false, error: memErr.message }
    }

    // 3) Insert roles
    const roleRows = input.roles.map((r) => ({
      member_id: member.id,
      role: r,
      team_id: input.team_id ?? null,
    }))
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: rolesErr } = await (sb as any).from('club_member_roles').insert(roleRows)
    if (rolesErr) return { success: false, error: rolesErr.message }

    // 4) Send credentials email
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
    await sendHtmlEmail({
      to: input.email.trim(),
      subject: `Acceso al CRM — ${clubName}`,
      html: `
        <p>Hola <b>${input.full_name}</b>,</p>
        <p>Te hemos dado acceso al CRM del club. Tus credenciales:</p>
        <ul>
          <li><b>Email:</b> ${input.email}</li>
          <li><b>Contraseña temporal:</b> <code style="background:#f3f4f6;padding:2px 6px;border-radius:4px">${tempPassword}</code></li>
        </ul>
        <p>Entra en <a href="${appUrl}/login">${appUrl}/login</a> y cambia la contraseña en tu perfil lo antes posible.</p>
        <p>Un saludo,<br/>Dirección</p>
      `,
    })

    revalidatePath('/configuracion/roles')
    return { success: true, memberId: member.id, tempPassword }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

export async function updateMemberRoles(
  memberId: string,
  newRoles: Role[],
  teamId: string | null = null
): Promise<{ success: boolean; error?: string }> {
  try {
    const { sb, clubId, roles } = await getScopedClient()
    requireAdmin(roles)

    // verify club
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: m } = await (sb as any).from('club_members').select('club_id').eq('id', memberId).single()
    if (!m || m.club_id !== clubId) return { success: false, error: 'Miembro no encontrado' }

    // wipe + reinsert
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (sb as any).from('club_member_roles').delete().eq('member_id', memberId)
    if (newRoles.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (sb as any).from('club_member_roles').insert(
        newRoles.map((r) => ({ member_id: memberId, role: r, team_id: teamId }))
      )
      if (error) return { success: false, error: error.message }
    }

    revalidatePath('/configuracion/roles')
    return { success: true }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

export async function updateMemberProfile(
  memberId: string,
  patch: { full_name?: string; phone?: string | null; email?: string }
): Promise<{ success: boolean; error?: string }> {
  try {
    const { sb, clubId, roles } = await getScopedClient()
    requireAdmin(roles)

    const { data: m } = await (sb as any)
      .from('club_members')
      .select('club_id, user_id')
      .eq('id', memberId)
      .single()
    if (!m || m.club_id !== clubId) return { success: false, error: 'Miembro no encontrado' }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (sb as any).from('club_members').update(patch).eq('id', memberId)
    if (error) return { success: false, error: error.message }

    // Sync email in auth if changed
    if (patch.email && m.user_id) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (sb as any).auth.admin.updateUserById(m.user_id, { email: patch.email })
    }

    revalidatePath('/configuracion/roles')
    return { success: true }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

export async function setMemberActive(
  memberId: string,
  active: boolean
): Promise<{ success: boolean; error?: string }> {
  try {
    const { sb, clubId, roles } = await getScopedClient()
    requireAdmin(roles)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: m } = await (sb as any).from('club_members').select('club_id').eq('id', memberId).single()
    if (!m || m.club_id !== clubId) return { success: false, error: 'Miembro no encontrado' }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (sb as any).from('club_members').update({ active }).eq('id', memberId)
    if (error) return { success: false, error: error.message }

    revalidatePath('/configuracion/roles')
    return { success: true }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

export async function resetMemberPassword(
  memberId: string,
  sendEmail: boolean = true
): Promise<{ success: boolean; error?: string; tempPassword?: string }> {
  try {
    const { sb, clubId, roles } = await getScopedClient()
    requireAdmin(roles)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: m } = await (sb as any)
      .from('club_members')
      .select('club_id, user_id, email, full_name')
      .eq('id', memberId)
      .single()
    if (!m || m.club_id !== clubId) return { success: false, error: 'Miembro no encontrado' }
    if (!m.user_id) return { success: false, error: 'Miembro sin usuario de acceso' }

    const tempPassword = randomPassword(14)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (sb as any).auth.admin.updateUserById(m.user_id, {
      password: tempPassword,
    })
    if (error) return { success: false, error: error.message }

    // Forzar cambio de contraseña tras un reset administrativo
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (sb as any).from('club_members').update({ must_change_password: true }).eq('id', memberId)

    if (sendEmail && m.email) {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
      await sendHtmlEmail({
        to: m.email,
        subject: 'Tu contraseña del CRM ha sido restablecida',
        html: `
          <p>Hola <b>${m.full_name}</b>,</p>
          <p>Un administrador ha restablecido tu contraseña. Tu nueva contraseña temporal es:</p>
          <p><code style="background:#f3f4f6;padding:4px 8px;border-radius:4px;font-size:16px">${tempPassword}</code></p>
          <p>Entra en <a href="${appUrl}/login">${appUrl}/login</a> y cámbiala cuanto antes.</p>
        `,
      })
    }

    revalidatePath('/configuracion/roles')
    return { success: true, tempPassword }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

export async function deleteMember(
  memberId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { sb, clubId, roles, memberId: myId } = await getScopedClient()
    requireAdmin(roles)
    if (memberId === myId) return { success: false, error: 'No puedes eliminarte a ti mismo' }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: m } = await (sb as any)
      .from('club_members')
      .select('club_id, user_id')
      .eq('id', memberId)
      .single()
    if (!m || m.club_id !== clubId) return { success: false, error: 'Miembro no encontrado' }

    // cascade: roles + team_coaches
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (sb as any).from('club_member_roles').delete().eq('member_id', memberId)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (sb as any).from('team_coaches').delete().eq('member_id', memberId)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: delErr } = await (sb as any).from('club_members').delete().eq('id', memberId)
    if (delErr) return { success: false, error: delErr.message }

    if (m.user_id) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (sb as any).auth.admin.deleteUser(m.user_id)
    }

    revalidatePath('/configuracion/roles')
    return { success: true }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

/**
 * Crea una cuenta de acceso (Supabase Auth) para un club_member EXISTENTE
 * que todavía no la tiene. Contraseña temporal aleatoria + email + flag de
 * cambio obligatorio. No toca roles (se gestionan aparte).
 */
export async function createAccountForMember(
  memberId: string,
): Promise<{ success: boolean; error?: string; tempPassword?: string; skipped?: boolean; reason?: string }> {
  try {
    const { sb, clubId, roles } = await getScopedClient()
    requireAdmin(roles)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: m } = await (sb as any)
      .from('club_members')
      .select('id, club_id, user_id, email, full_name')
      .eq('id', memberId)
      .single()
    if (!m || m.club_id !== clubId) return { success: false, error: 'Miembro no encontrado' }
    if (m.user_id) return { success: true, skipped: true, reason: 'Ya tiene cuenta' }
    if (!m.email?.trim()) return { success: false, error: 'El miembro no tiene email; añádelo primero' }

    const tempPassword = randomPassword(14)

    const clubName2 = await getClubName(sb, clubId)

    // 1) Crear usuario auth
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: authData, error: authErr } = await (sb as any).auth.admin.createUser({
      email: m.email.trim().toLowerCase(),
      password: tempPassword,
      email_confirm: true,
      user_metadata: { full_name: m.full_name },
    })
    if (authErr) {
      // Email ya existe en auth: intentar vincular el user_id existente
      if (/already.*registered|exists/i.test(authErr.message)) {
        return { success: false, error: `El email ${m.email} ya está registrado en Auth. Revisa duplicados.` }
      }
      return { success: false, error: authErr.message }
    }
    const userId = authData.user.id

    // 2) Vincular user_id + flag de cambio
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: updErr } = await (sb as any)
      .from('club_members')
      .update({ user_id: userId, must_change_password: true })
      .eq('id', memberId)
    if (updErr) {
      // rollback auth
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (sb as any).auth.admin.deleteUser(userId)
      return { success: false, error: updErr.message }
    }

    // 3) Email con credenciales
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
    try {
      await sendHtmlEmail({
        to: m.email.trim(),
        subject: `Acceso al CRM — ${clubName2}`,
        html: `
          <p>Hola <b>${m.full_name}</b>,</p>
          <p>Te hemos creado un acceso al CRM del club. Tus credenciales:</p>
          <ul>
            <li><b>Email:</b> ${m.email}</li>
            <li><b>Contraseña temporal:</b> <code style="background:#f3f4f6;padding:2px 6px;border-radius:4px">${tempPassword}</code></li>
          </ul>
          <p>Entra en <a href="${appUrl}/login">${appUrl}/login</a>. Te pediremos que cambies la contraseña en el primer inicio de sesión.</p>
          <p>Un saludo,<br/>Dirección</p>
        `,
      })
    } catch { /* email no fatal */ }

    revalidatePath('/configuracion/roles')
    revalidatePath('/entrenadores/staff')
    return { success: true, tempPassword }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

/**
 * Crea cuentas de acceso en bloque para TODOS los club_members activos del
 * club que tengan email pero no user_id. Devuelve un resumen.
 */
export async function bulkCreateAccountsForMembers(): Promise<{
  success: boolean
  error?: string
  created?: number
  skippedNoEmail?: number
  failed?: number
  errors?: string[]
}> {
  try {
    const { sb, clubId, roles } = await getScopedClient()
    requireAdmin(roles)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: members } = await (sb as any)
      .from('club_members')
      .select('id, email, user_id')
      .eq('club_id', clubId)
      .eq('active', true)
      .is('user_id', null)

    let created = 0
    let skippedNoEmail = 0
    let failed = 0
    const errors: string[] = []

    for (const m of (members ?? [])) {
      if (!m.email?.trim()) { skippedNoEmail++; continue }
      const res = await createAccountForMember(m.id)
      if (res.success && !res.skipped) created++
      else if (!res.success) { failed++; if (res.error) errors.push(res.error) }
    }

    revalidatePath('/configuracion/roles')
    revalidatePath('/entrenadores/staff')
    return { success: failed === 0, created, skippedNoEmail, failed, errors: errors.slice(0, 5) }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}
