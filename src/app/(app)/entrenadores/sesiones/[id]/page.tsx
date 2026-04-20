import { createAdminClient } from '@/lib/supabase/admin'
import { getClubContext } from '@/lib/supabase/get-club-id'
import { Topbar } from '@/components/layout/Topbar'
import { AttendanceGrid } from '@/features/entrenadores/components/AttendanceGrid'
import { SessionExercisePicker } from '@/features/entrenadores/components/SessionExercisePicker'
import { PlayerBibDistribution } from '@/features/entrenadores/components/PlayerBibDistribution'
import { SessionObjectives } from '@/features/entrenadores/components/SessionObjectives'
import { SessionPlanningHeader } from '@/features/entrenadores/components/SessionPlanningHeader'
import { SessionDirectorComments } from '@/features/entrenadores/components/SessionDirectorComments'
import { SessionHeaderEdit } from '@/features/entrenadores/components/SessionHeaderEdit'
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
  const { clubId, roles } = await getClubContext()
  const supabase = createAdminClient()
  const isDirector = roles.some((r) => ['admin', 'direccion', 'director_deportivo'].includes(r))
  const isCoach = roles.some((r) => ['entrenador', 'coordinador'].includes(r))

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
    { data: directorComments },
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
    // Director comments
    supabase
      .from('session_director_comments')
      .select(`
        id, comment, visible_to_coach, created_at,
        author:author_id(full_name)
      `)
      .eq('session_id', id)
      .order('created_at', { ascending: false }),
  ])

  // Teams for edit modal
  const { data: allTeams } = await supabase
    .from('teams')
    .select('id, name')
    .eq('club_id', clubId)
    .eq('active', true)
    .order('name')

  // Hide private comments from coaches
  const visibleComments = (directorComments ?? []).filter((c: { visible_to_coach: boolean }) =>
    isDirector || !isCoach || c.visible_to_coach
  )

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
            <div className="flex gap-2 items-start">
              {isCompleted && (
                <span className="badge badge-success text-xs">Completada</span>
              )}
              <SessionHeaderEdit
                sessionId={id}
                session_date={session.session_date}
                /* eslint-disable @typescript-eslint/no-explicit-any */
                end_time={(session as any).end_time ?? null}
                opponent={session.opponent ?? null}
                score_home={(session as any).score_home ?? null}
                score_away={(session as any).score_away ?? null}
                notes={session.notes ?? null}
                session_type={session.session_type}
                teams={allTeams ?? []}
                currentTeamId={session.team_id ?? null}
                /* eslint-enable @typescript-eslint/no-explicit-any */
              />
            </div>
          </div>
          {session.notes && (
            <div className="mt-3 p-3 bg-muted/50 rounded-lg text-sm">
              {session.notes}
            </div>
          )}
        </div>

        {/* Planning + PDF export */}
        <SessionPlanningHeader
          sessionId={id}
          /* eslint-disable @typescript-eslint/no-explicit-any */
          microcycle={(session as any).microcycle ?? null}
          macrocycle={(session as any).macrocycle ?? null}
          sessionNumber={(session as any).session_number ?? null}
          /* eslint-enable @typescript-eslint/no-explicit-any */
        />

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

        {/* Director comments */}
        <SessionDirectorComments
          sessionId={id}
          comments={visibleComments as never}
          canWrite={isDirector}
        />
      </div>
    </div>
  )
}
