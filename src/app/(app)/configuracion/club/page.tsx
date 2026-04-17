import { createAdminClient } from '@/lib/supabase/admin'
import { getClubContext } from '@/lib/supabase/get-club-id'
import { Topbar } from '@/components/layout/Topbar'
import { ClubSettingsForm } from '@/features/configuracion/components/ClubSettingsForm'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Configuracion del club' }
export const dynamic = 'force-dynamic'

export default async function ClubConfigPage() {
  const { clubId } = await getClubContext()
  if (!clubId) {
    return (
      <div className="flex flex-col h-full">
        <Topbar title="Configuracion del club" />
        <div className="p-6 text-sm text-muted-foreground">No autenticado.</div>
      </div>
    )
  }

  const supabase = createAdminClient()

  const [{ data: club }, { data: settings }] = await Promise.all([
    supabase.from('clubs').select('name, city, logo_url, primary_color, secondary_color').eq('id', clubId).single(),
    supabase.from('club_settings').select('sibling_discount_enabled, sibling_discount_percent').eq('club_id', clubId).maybeSingle(),
  ])

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const c = (club ?? {}) as any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const s = (settings ?? {}) as any

  return (
    <div className="flex flex-col h-full">
      <Topbar title="Configuracion del club" />
      <div className="flex-1 p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold">Configuracion del club</h1>
          <p className="text-sm text-muted-foreground">
            Datos generales, escudo, colores y descuentos.
          </p>
        </div>

        <ClubSettingsForm
          initial={{
            name: c.name ?? '',
            city: c.city ?? null,
            logo_url: c.logo_url ?? null,
            primary_color: c.primary_color ?? '#003087',
            secondary_color: c.secondary_color ?? '#FFFFFF',
            sibling_discount_enabled: !!s.sibling_discount_enabled,
            sibling_discount_percent: Number(s.sibling_discount_percent ?? 40),
          }}
        />
      </div>
    </div>
  )
}
