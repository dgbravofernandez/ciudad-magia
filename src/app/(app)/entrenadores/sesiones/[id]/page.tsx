import { createClient } from '@/lib/supabase/server'
import { headers } from 'next/headers'
import { Topbar } from '@/components/layout/Topbar'
import { AttendanceGrid } from '@/features/entrenadores/components/AttendanceGrid'
import { notFound } from 'next/navigation'
import { formatDate } from '@/lib/utils/currency'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Sesión' }

export default async function SessionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const headersList = await headers()
  const clubId = headersList.get('x-club-id')!

  const supabase = await createClient()

  const { data: session } = await supabase
    .from('sessions')
    .select(`
      *,
      teams(id, name)
    `)
    .eq('id', id)
    .eq('club_id', clubId)
    .single()

  if (!session) notFound()

  // Get players for the team
  const { data: players } = await supabase
    .from('players')
    .select('id, first_name, last_name, dorsal_number, position')
    .eq('team_id', session.team_id)
    .eq('status', 'active')
    .order('last_name')

  // Get existing attendance
  const { data: attendance } = await supabase
    .from('session_attendance')
    .select('*')
    .eq('session_id', id)

  // Get session exercises
  const { data: sessionExercises } = await supabase
    .from('session_exercises')
    .select(`
      *,
      exercises(id, title, description, category_id)
    `)
    .eq('session_id', id)
    .order('slot_order')

  // Available exercises
  const { data: exercises } = await supabase
    .from('exercises')
    .select('id, title, category_id')
    .eq('club_id', clubId)
    .order('title')
    .limit(100)

  const typeLabel: Record<string, string> = {
    training: 'Entrenamiento',
    match: 'Partido',
    futsal: 'Fútbol sala',
    friendly: 'Amistoso',
  }

  const attendanceMap: Record<string, any> = {}
  for (const a of attendance ?? []) {
    attendanceMap[a.player_id] = a
  }

  return (
    <div className="flex flex-col h-full">
      <Topbar title="Sesión" />
      <div className="flex-1 p-6 space-y-6">
        {/* Header */}
        <div className="card p-5">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-xl font-semibold">
                {(session as any).teams?.name} — {typeLabel[session.session_type] ?? session.session_type}
              </h2>
              <p className="text-muted-foreground mt-1">{formatDate(session.session_date)}</p>
              {session.opponent && (
                <p className="text-sm text-muted-foreground mt-1">vs {session.opponent}</p>
              )}
            </div>
            <div className="flex gap-2">
              <button className="btn-ghost text-sm">
                📄 Exportar PDF
              </button>
            </div>
          </div>
          {session.notes && (
            <div className="mt-3 p-3 bg-muted/50 rounded-lg text-sm">
              {session.notes}
            </div>
          )}
        </div>

        {/* Exercise slots */}
        <div className="card p-5 space-y-4">
          <h3 className="font-semibold">Ejercicios de la sesión</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[1, 2, 3, 4].map((slot) => {
              const ex = (sessionExercises ?? []).find((e: any) => e.slot_order === slot)
              return (
                <div
                  key={slot}
                  className="border rounded-lg p-3 min-h-[80px] flex flex-col gap-2"
                >
                  <p className="text-xs text-muted-foreground font-medium">Slot {slot}</p>
                  {ex ? (
                    <div>
                      <p className="font-medium text-sm">{ex.exercises?.title}</p>
                      {ex.exercises?.description && (
                        <p className="text-xs text-muted-foreground line-clamp-2">
                          {ex.exercises.description}
                        </p>
                      )}
                    </div>
                  ) : (
                    <select className="input text-sm flex-1">
                      <option value="">Seleccionar ejercicio...</option>
                      {(exercises ?? []).map((e) => (
                        <option key={e.id} value={e.id}>{e.title}</option>
                      ))}
                    </select>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* Attendance */}
        <AttendanceGrid
          sessionId={id}
          players={players ?? []}
          existingAttendance={attendanceMap}
          isCompleted={!session.is_live && Object.keys(attendanceMap).length > 0}
        />
      </div>
    </div>
  )
}
