import { createAdminClient } from '@/lib/supabase/admin'
import { getClubContext } from '@/lib/supabase/get-club-id'
import { Topbar } from '@/components/layout/Topbar'
import { AttendanceGrid } from '@/features/entrenadores/components/AttendanceGrid'
import { SessionExercisePicker } from '@/features/entrenadores/components/SessionExercisePicker'
import { PlayerBibDistribution } from '@/features/entrenadores/components/PlayerBibDistribution'
import { SessionObjectives } from '@/features/entrenadores/components/SessionObjectives'
import { notFound } from 'next/navigation'
import { formatDate } from '@/lib/utils/currency'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Sesion' }

export const dynamic = 'force-dynamic'

export default async function SessionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const { clubId } = await getClubContext()
  const supabase = createAdminClient()

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

  // Fetch everything in parallel
  const [
    { data: players },
    { data: attendance },
    { data: sessionExercises },
    { data: allExercises },
  ] = await Promise.all([
    // Get players for the team
    session.team_id
      ? supabase
          .from('players')
          .select('id, first_name, last_name, dorsal_number, position')
          .eq('team_id', session.team_id)
          .or('status.is.null,status.neq.low')
          .order('last_name')
      : Promise.resolve({ data: [] as any[] }), // eslint-disable-line @typescript-eslint/no-explicit-any
    // Get existing attendance
    supabase
      .from('session_attendance')
      .select('*')
      .eq('session_id', id),
    // Get session exercises
    supabase
      .from('session_exercises')
      .select(`
        *,
        exercises(id, title, description, canvas_image_url, category_id)
      `)
      .eq('session_id', id)
      .order('slot_order'),
    // Available exercises for picker
    supabase
      .from('exercises')
      .select(`
        *,
        exercise_categories:category_id(name, color)
      `)
      .eq('club_id', clubId)
      .order('title')
      .limit(200),
  ])

  const typeLabel: Record<string, string> = {
    training: 'Entrenamiento',
    match: 'Partido',
    futsal: 'Futbol sala',
    friendly: 'Amistoso',
  }

  const attendanceMap: Record<string, any> = {} // eslint-disable-line @typescript-eslint/no-explicit-any
  for (const a of attendance ?? []) {
    attendanceMap[a.player_id] = a
  }

  const isCompleted = !session.is_live && Object.keys(attendanceMap).length > 0

  // Session objectives
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const objectives: string[] = (session as any).objectives ?? []

  return (
    <div className="flex flex-col h-full">
      <Topbar title="Sesion" />
      <div className="flex-1 p-6 space-y-6 max-w-5xl">
        {/* Header */}
        <div className="card p-5">
          <div className="flex items-start justify-between flex-wrap gap-3">
            <div>
              <h2 className="text-xl font-semibold">
                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                {(session as any).teams?.name ?? 'Equipo'} — {typeLabel[session.session_type] ?? session.session_type}
              </h2>
              <p className="text-muted-foreground mt-1">{formatDate(session.session_date)}</p>
              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
              {(session as any).end_time && (
                <p className="text-sm text-muted-foreground">
                  {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                  Fin: {(session as any).end_time}
                </p>
              )}
              {session.opponent && (
                <p className="text-sm text-muted-foreground mt-1">vs {session.opponent}</p>
              )}
            </div>
            <div className="flex gap-2">
              {isCompleted && (
                <span className="badge badge-success text-xs">Completada</span>
              )}
            </div>
          </div>
          {session.notes && (
            <div className="mt-3 p-3 bg-muted/50 rounded-lg text-sm">
              {session.notes}
            </div>
          )}
        </div>

        {/* Objectives */}
        <SessionObjectives
          sessionId={id}
          objectives={objectives}
          isCompleted={isCompleted}
        />

        {/* Exercise slots */}
        <SessionExercisePicker
          sessionId={id}
          sessionExercises={sessionExercises ?? []}
          allExercises={allExercises ?? []}
          isCompleted={isCompleted}
        />

        {/* Player bib distribution */}
        {session.session_type === 'training' && (players ?? []).length > 0 && (
          <PlayerBibDistribution
            sessionId={id}
            players={players ?? []}
            existingData={attendanceMap}
            isCompleted={isCompleted}
          />
        )}

        {/* Attendance */}
        <AttendanceGrid
          sessionId={id}
          players={players ?? []}
          existingAttendance={attendanceMap}
          isCompleted={isCompleted}
        />
      </div>
    </div>
  )
}
