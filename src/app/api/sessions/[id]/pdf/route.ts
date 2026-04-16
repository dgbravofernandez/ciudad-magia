import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getClubContext } from '@/lib/supabase/get-club-id'
import { generateSessionPDF } from '@/lib/pdf/generate-session'

export const dynamic = 'force-dynamic'

const TYPE_LABELS: Record<string, string> = {
  training: 'Entrenamiento',
  match: 'Partido',
  futsal: 'Futbol sala',
  friendly: 'Amistoso',
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const { clubId } = await getClubContext()
    if (!clubId) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const supabase = createAdminClient()

    const { data: session, error: sErr } = await supabase
      .from('sessions')
      .select(`
        *,
        teams(id, name)
      `)
      .eq('id', id)
      .eq('club_id', clubId)
      .single()

    if (sErr || !session) {
      return NextResponse.json({ error: 'Sesion no encontrada' }, { status: 404 })
    }

    const [{ data: club }, { data: rawExercises }] = await Promise.all([
      supabase.from('clubs').select('name, logo_url').eq('id', clubId).single(),
      supabase
        .from('session_exercises')
        .select(`
          slot_order,
          notes,
          duration_min,
          exercises(title, description, canvas_image_url, exercise_categories:category_id(name))
        `)
        .eq('session_id', id)
        .order('slot_order'),
    ])

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const exercises = (rawExercises ?? []).map((row: any) => ({
      slot_order: row.slot_order,
      notes: row.notes ?? null,
      duration_min: row.duration_min ?? null,
      exercise: row.exercises
        ? {
            title: row.exercises.title,
            description: row.exercises.description ?? null,
            canvas_image_url: row.exercises.canvas_image_url ?? null,
            category_name: row.exercises.exercise_categories?.name ?? null,
          }
        : null,
    }))

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const s = session as any

    const pdf = await generateSessionPDF({
      clubName: club?.name ?? 'Club',
      clubLogoUrl: club?.logo_url ?? null,
      teamName: s.teams?.name ?? 'Equipo',
      sessionTypeLabel: TYPE_LABELS[s.session_type] ?? s.session_type,
      sessionDate: s.session_date,
      startTime: s.start_time ?? null,
      endTime: s.end_time ?? null,
      microcycle: s.microcycle ?? null,
      macrocycle: s.macrocycle ?? null,
      sessionNumber: s.session_number ?? null,
      opponent: s.opponent ?? null,
      notes: s.notes ?? null,
      objectives: Array.isArray(s.objectives) ? s.objectives : [],
      exercises,
    })

    const filename = `sesion-${(s.teams?.name ?? 'equipo')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')}-${s.session_date}.pdf`

    return new NextResponse(pdf, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (err) {
    console.error('[session pdf] error', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Error generando PDF' },
      { status: 500 },
    )
  }
}
