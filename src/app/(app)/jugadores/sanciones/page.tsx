import { createClient } from '@/lib/supabase/server'
import { getClubId } from '@/lib/supabase/get-club-id'
import { Topbar } from '@/components/layout/Topbar'
import { AlertTriangle } from 'lucide-react'
import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Sanciones' }

export default async function SancionesPage() {
  const clubId = await getClubId()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = await createClient() as any

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
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Jugador</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Equipo</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Competición</th>
                    <th className="text-center px-4 py-3 font-medium text-muted-foreground">Partidos sanción</th>
                    <th className="text-center px-4 py-3 font-medium text-muted-foreground">Cumplidos</th>
                    <th className="text-center px-4 py-3 font-medium text-muted-foreground">Restantes</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Fecha inicio</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Temporada</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((s: any) => (
                    <tr key={s.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3">
                        <Link
                          href={`/jugadores/${s.players?.id}`}
                          className="font-medium hover:underline hover:text-primary"
                        >
                          {s.players?.first_name} {s.players?.last_name}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {s.players?.teams?.name ?? '—'}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground capitalize">
                        {s.competition ?? 'Liga'}
                      </td>
                      <td className="px-4 py-3 text-center font-medium">
                        {s.matches_banned ?? 1}
                      </td>
                      <td className="px-4 py-3 text-center text-muted-foreground">
                        {s.matches_served ?? 0}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="badge badge-destructive font-semibold">
                          {s.remaining}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {s.start_date
                          ? new Date(s.start_date).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' })
                          : '—'}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{s.season}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
