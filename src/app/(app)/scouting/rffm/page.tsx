import { createAdminClient } from '@/lib/supabase/admin'
import { getClubContext } from '@/lib/supabase/get-club-id'
import { Topbar } from '@/components/layout/Topbar'
import { RffmDashboard } from '@/features/rffm/components/RffmDashboard'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Scouting RFFM' }
export const dynamic = 'force-dynamic'
// Server actions (triggerRffmSync) corren en este segmento — subimos a 60s (máx Hobby).
export const maxDuration = 60

export default async function RffmPage() {
  const { clubId } = await getClubContext()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createAdminClient() as any

  const [
    { data: signals },
    { data: cardAlerts },
    { data: trackedComps },
    { data: lastSync },
  ] = await Promise.all([
    sb
      .from('rffm_scouting_signals')
      .select('*')
      .eq('club_id', clubId)
      .neq('estado', 'descartado')
      .gte('goles_por_partido', 0.8)   // pre-filtro DB para acotar
      .order('goles_por_partido', { ascending: false })  // columna real, indexable
      .limit(300),
    sb
      .from('rffm_card_alerts')
      .select('*, rffm_tracked_competitions(nombre_competicion, nombre_grupo)')
      .eq('club_id', clubId)
      .eq('alerta_activa', true)
      .order('amarillas_ciclo_actual', { ascending: false }),
    sb
      .from('rffm_tracked_competitions')
      .select('*')
      .eq('club_id', clubId)
      .order('nombre_competicion'),
    sb
      .from('rffm_sync_log')
      .select('*')
      .eq('club_id', clubId)
      .order('started_at', { ascending: false })
      .limit(5),
  ])

  return (
    <div className="flex flex-col h-full">
      <Topbar title="Scouting RFFM" />
      <div className="flex-1 overflow-auto">
        <RffmDashboard
          signals={(signals ?? []) as never[]}
          cardAlerts={(cardAlerts ?? []) as never[]}
          trackedComps={(trackedComps ?? []) as never[]}
          recentSyncs={(lastSync ?? []) as never[]}
        />
      </div>
    </div>
  )
}
