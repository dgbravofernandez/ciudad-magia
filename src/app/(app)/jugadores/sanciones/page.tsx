import { createAdminClient } from '@/lib/supabase/admin'
import { getClubContext } from '@/lib/supabase/get-club-id'
import { Topbar } from '@/components/layout/Topbar'
import { AlertTriangle } from 'lucide-react'
import { SanctionsTable } from '@/features/jugadores/components/SanctionsTable'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Sanciones' }
export const dynamic = 'force-dynamic'

export default async function SancionesPage() {
  const { clubId, roles } = await getClubContext()
  const canDelete = roles.some((r: string) => ['admin', 'direccion', 'director_deportivo'].includes(r))
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createAdminClient() as any

  const { data: sanctions } = await supabase
    .from('player_sanctions')
    .select(`
      id,
      player_id,
      season,
      competition,
      matches_banned,
      matches_served,
      start_date,
      active,
      players(id, first_name, last_name, team_id, teams(name))
    `)
    .eq('club_id', clubId)
    .eq('active', true)
    .order('start_date', { ascending: false })

  const rows = (sanctions ?? []).map((s: any) => ({
    ...s,
    remaining: (s.matches_banned ?? 1) - (s.matches_served ?? 0),
  })).filter((s: any) => s.remaining > 0)

  return (
    <div className="flex flex-col h-full">
      <Topbar title="Sanciones activas" />
      <div className="flex-1 p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold">Sanciones activas</h2>
            <p className="text-sm text-muted-foreground">{rows.length} jugador{rows.length !== 1 ? 'es' : ''} sancionado{rows.length !== 1 ? 's' : ''}</p>
          </div>
        </div>

        {rows.length === 0 ? (
          <div className="card p-12 text-center text-muted-foreground">
            <AlertTriangle className="w-8 h-8 mx-auto mb-2 opacity-30" />
            No hay sanciones activas actualmente
          </div>
        ) : (
          <SanctionsTable rows={rows} canDelete={canDelete} />
        )}
      </div>
    </div>
  )
}
