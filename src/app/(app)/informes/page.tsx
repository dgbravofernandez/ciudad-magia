import { getTeamsForFilter } from '@/features/informes/actions/informes.actions'
import { getClubContext } from '@/lib/supabase/get-club-id'
import { InformesExplorer } from '@/features/informes/components/InformesExplorer'
import { getCurrentSeason } from '@/lib/utils/currency'
import { BarChart3 } from 'lucide-react'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Informes',
}

export default async function InformesPage() {
  await getClubContext() // valida que el usuario tiene acceso al club

  const [teams] = await Promise.all([
    getTeamsForFilter(),
  ])

  // Usar siempre el formato con guión (ej. '2025-26') que coincide con quota_payments
  const currentSeason = getCurrentSeason()

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
            Explorador de datos del club
          </p>
        </div>
      </div>

      <InformesExplorer teams={teams} currentSeason={currentSeason} />
    </div>
  )
}
