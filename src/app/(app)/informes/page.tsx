import { getTeamsForFilter } from '@/features/informes/actions/informes.actions'
import { getClubContext } from '@/lib/supabase/get-club-id'
import { createAdminClient } from '@/lib/supabase/admin'
import { InformesExplorer } from '@/features/informes/components/InformesExplorer'
import { BarChart3 } from 'lucide-react'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Informes',
}

export default async function InformesPage() {
  const { clubId } = await getClubContext()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createAdminClient() as any

  const [teams, { data: settings }] = await Promise.all([
    getTeamsForFilter(),
    sb.from('club_settings').select('current_season').eq('club_id', clubId).single(),
  ])

  const currentSeason = settings?.current_season ?? '2025/26'

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
          <BarChart3 className="w-5 h-5 text-primary-foreground" />
        </div>
        <div>
          <h1 className="text-xl font-semibold text-foreground">Informes</h1>
          <p className="text-sm text-muted-foreground">
            Explorador de datos del club — temporada {currentSeason}
          </p>
        </div>
      </div>

      <InformesExplorer teams={teams} currentSeason={currentSeason} />
    </div>
  )
}
