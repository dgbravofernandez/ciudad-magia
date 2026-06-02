import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { getClubId } from '@/lib/supabase/get-club-id'
import { headers } from 'next/headers'
import { CuotasConfig } from '@/features/configuracion/components/CuotasConfig'
import { SeasonFeesManager } from '@/features/configuracion/components/SeasonFeesManager'
import { FeeCalculator } from '@/features/configuracion/components/FeeCalculator'
import { Topbar } from '@/components/layout/Topbar'
import { getActiveSeasons } from '@/lib/utils/currency'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Configuracion de Cuotas' }

export default async function CuotasPage() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createAdminClient() as any

  let clubId = await getClubId()
  if (!clubId) {
    const hdrs = await headers()
    clubId = hdrs.get('x-club-id') ?? ''
  }
  if (!clubId) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { data: member } = await sb
        .from('club_members').select('club_id').eq('user_id', user.id).eq('active', true).limit(1).single()
      clubId = member?.club_id ?? ''
    }
  }

  // Cargar TODOS los equipos (activos + borradores 26/27) para configurar cuotas por temporada
  const [settingsRes, teamsRes] = await Promise.all([
    sb.from('club_settings').select('*').eq('club_id', clubId).single(),
    sb.from('teams').select('id, name, active').eq('club_id', clubId).order('name'),
  ])

  return (
    <div className="flex flex-col h-full">
      <Topbar title="Configuracion de Cuotas" />
      <div className="flex-1 p-6 space-y-6 max-w-4xl">
        <CuotasConfig
          clubId={clubId}
          settings={settingsRes.data}
          teams={teamsRes.data ?? []}
        />
        <FeeCalculator />
        <SeasonFeesManager
          seasons={getActiveSeasons()}
          teams={teamsRes.data ?? []}
        />
      </div>
    </div>
  )
}
