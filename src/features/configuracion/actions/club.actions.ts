'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { getClubContext } from '@/lib/supabase/get-club-id'
import { revalidatePath } from 'next/cache'

export interface UpdateClubBasicsInput {
  name?: string
  city?: string | null
  logo_url?: string | null
  primary_color?: string
  secondary_color?: string | null
  sibling_discount_enabled?: boolean
  sibling_discount_percent?: number
}

/**
 * Persists club basics (clubs table) and the settings driven by the
 * configuration screen (club_settings). Uses the service-role client
 * because some users may not have direct UPDATE grants on clubs.
 */
export async function updateClubBasics(input: UpdateClubBasicsInput) {
  const { clubId } = await getClubContext()
  if (!clubId) return { success: false as const, error: 'No autenticado' }

  const supabase = createAdminClient()

  // ---- clubs table ----
  const clubUpdate: Record<string, string | null> = {}
  if (input.name !== undefined) clubUpdate.name = input.name.trim()
  if (input.city !== undefined) clubUpdate.city = input.city?.trim() || null
  if (input.logo_url !== undefined) clubUpdate.logo_url = input.logo_url?.trim() || null
  if (input.primary_color !== undefined) clubUpdate.primary_color = input.primary_color
  if (input.secondary_color !== undefined) clubUpdate.secondary_color = input.secondary_color

  if (Object.keys(clubUpdate).length > 0) {
    const { error } = await supabase.from('clubs').update(clubUpdate).eq('id', clubId)
    if (error) return { success: false as const, error: error.message }
  }

  // ---- club_settings (upsert) ----
  const settingsUpdate: Record<string, boolean | number> = {}
  if (input.sibling_discount_enabled !== undefined) {
    settingsUpdate.sibling_discount_enabled = input.sibling_discount_enabled
  }
  if (input.sibling_discount_percent !== undefined) {
    settingsUpdate.sibling_discount_percent = input.sibling_discount_percent
  }

  if (Object.keys(settingsUpdate).length > 0) {
    const { data: existing } = await supabase
      .from('club_settings')
      .select('id')
      .eq('club_id', clubId)
      .maybeSingle()

    if (existing) {
      const { error } = await supabase
        .from('club_settings')
        .update(settingsUpdate)
        .eq('club_id', clubId)
      if (error) return { success: false as const, error: error.message }
    } else {
      const { error } = await supabase
        .from('club_settings')
        .insert({ club_id: clubId, ...settingsUpdate })
      if (error) return { success: false as const, error: error.message }
    }
  }

  revalidatePath('/configuracion/club')
  revalidatePath('/configuracion')
  // Sidebar consumes clubs.* — nudge all pages
  revalidatePath('/', 'layout')
  return { success: true as const }
}

/**
 * Uploads a logo file to Supabase Storage (bucket "Logo") and stores
 * the resulting public URL in clubs.logo_url.
 */
export async function uploadClubLogo(formData: FormData) {
  const { clubId } = await getClubContext()
  if (!clubId) return { success: false as const, error: 'No autenticado' }

  const file = formData.get('file')
  if (!(file instanceof File) || file.size === 0) {
    return { success: false as const, error: 'No se recibio ningun archivo' }
  }
  if (file.size > 3 * 1024 * 1024) {
    return { success: false as const, error: 'El archivo supera los 3 MB' }
  }

  const supabase = createAdminClient()

  // Derive extension from mime type, fallback to .png
  const ext = (file.type.split('/')[1] ?? 'png').toLowerCase().replace('jpeg', 'jpg')
  const path = `club-logos/${clubId}-${Date.now()}.${ext}`

  const { error: uploadError } = await supabase.storage
    .from('Logo')
    .upload(path, file, {
      contentType: file.type || 'image/png',
      upsert: true,
    })

  if (uploadError) return { success: false as const, error: uploadError.message }

  const { data: urlData } = supabase.storage.from('Logo').getPublicUrl(path)
  const publicUrl = urlData?.publicUrl
  if (!publicUrl) return { success: false as const, error: 'No se pudo obtener la URL publica' }

  const { error: updateError } = await supabase
    .from('clubs')
    .update({ logo_url: publicUrl })
    .eq('id', clubId)

  if (updateError) return { success: false as const, error: updateError.message }

  revalidatePath('/configuracion/club')
  revalidatePath('/configuracion')
  revalidatePath('/', 'layout')
  return { success: true as const, logoUrl: publicUrl }
}
