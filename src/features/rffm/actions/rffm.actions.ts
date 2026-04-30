'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { getClubContext } from '@/lib/supabase/get-club-id'
import { revalidatePath } from 'next/cache'
import { runSync, type SyncType } from '@/lib/rffm/sync'

// ── Sync ──────────────────────────────────────────────────────

export async function triggerRffmSync(
  syncType: SyncType = 'full',
  codTemporada?: string
): Promise<{ success: boolean; error?: string; result?: Record<string, unknown> }> {
  try {
    const { clubId, roles } = await getClubContext()
    if (!roles.some(r => ['admin', 'direccion', 'director_deportivo'].includes(r))) {
      return { success: false, error: 'Sin permisos' }
    }
    const result = await runSync(clubId, syncType, { codTemporada })
    revalidatePath('/scouting/rffm')
    return { success: true, result: result as unknown as Record<string, unknown> }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

// ── Tracked competitions CRUD ─────────────────────────────────

export async function addTrackedCompetition(input: {
  cod_temporada: string
  cod_tipojuego: string
  cod_competicion: string
  cod_grupo: string
  nombre_competicion: string
  nombre_grupo: string
  codigo_equipo_nuestro: string
  nombre_equipo_nuestro: string
  umbral_amarillas?: number
}): Promise<{ success: boolean; error?: string; id?: string }> {
  try {
    const { clubId, roles } = await getClubContext()
    if (!roles.some(r => ['admin', 'direccion', 'director_deportivo'].includes(r))) {
      return { success: false, error: 'Sin permisos' }
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = createAdminClient() as any
    const { data, error } = await sb
      .from('rffm_tracked_competitions')
      .insert({ club_id: clubId, ...input, umbral_amarillas: input.umbral_amarillas ?? 5 })
      .select('id')
      .single()
    if (error) return { success: false, error: error.message }
    const newId = (data as { id: string }).id

    // Auto-rellenar codigo_equipo_nuestro si el usuario no lo puso
    // (best-effort — silenciamos errores para no romper el insert)
    if (!input.codigo_equipo_nuestro) {
      try {
        await autoDetectOurTeamCode(newId)
      } catch { /* no-op */ }
    }

    revalidatePath('/scouting/rffm')
    return { success: true, id: newId }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

export async function updateTrackedCompetition(
  id: string,
  fields: Partial<{
    nombre_competicion: string
    nombre_grupo: string
    codigo_equipo_nuestro: string
    nombre_equipo_nuestro: string
    umbral_amarillas: number
    active: boolean
  }>,
): Promise<{ success: boolean; error?: string }> {
  try {
    const { clubId, roles } = await getClubContext()
    if (!roles.some(r => ['admin', 'direccion', 'director_deportivo'].includes(r))) {
      return { success: false, error: 'Sin permisos' }
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = createAdminClient() as any
    const { error } = await sb
      .from('rffm_tracked_competitions')
      .update(fields)
      .eq('id', id)
      .eq('club_id', clubId)
    if (error) return { success: false, error: error.message }
    revalidatePath('/scouting/rffm')
    return { success: true }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

/**
 * Tokeniza un nombre de equipo/club en palabras significativas (>=3 letras),
 * sin acentos, sin puntuación, sin stopwords típicas del fútbol español.
 */
function tokenize(name: string): string[] {
  const STOPWORDS = new Set([
    'CF', 'FC', 'EF', 'AD', 'CD', 'CDE', 'UD', 'CP', 'AC', 'SAD', 'SD', 'AGR',
    'DE', 'DEL', 'LA', 'EL', 'LOS', 'LAS', 'Y', 'I',
    'AT', 'ATCO', 'CLUB', 'DEPORTIVO', 'POL', 'POLIDEPORTIVO',
  ])
  return (name ?? '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '') // quita tildes
    .toUpperCase()
    .replace(/[^A-Z0-9 ]+/g, ' ')                     // solo alfanumérico
    .split(/\s+/)
    .filter(w => w.length >= 3 && !STOPWORDS.has(w) && !/^\d+$/.test(w))
}

/**
 * Score = número de tokens significativos del club que aparecen en el nombre del equipo.
 * Más tokens coincidentes = mejor match.
 */
function scoreCandidate(clubTokens: string[], teamName: string): number {
  const teamTokens = tokenize(teamName)
  const teamSet = new Set(teamTokens)
  let score = 0
  for (const t of clubTokens) if (teamSet.has(t)) score++
  return score
}

/**
 * Auto-detecta el código del equipo nuestro en una competición seguida
 * buscando en el calendario el equipo cuyo nombre se parezca MÁS al
 * nombre del club configurado (no hardcodeado).
 *
 * Ej: club "E.F. Ciudad de Getafe" → tokens [CIUDAD, GETAFE]
 *  - "E.F. CIUDAD DE GETAFE 'A'" matchea 2 tokens → score 2
 *  - "SANTA BARBARA GETAFE" matchea 1 → score 1
 *  - Gana el de score más alto.
 *
 * `needle` es opcional: si se pasa, se usa en lugar del nombre del club.
 */
export async function autoDetectOurTeamCode(
  trackedCompId: string,
  needle?: string,
): Promise<{ success: boolean; error?: string; codigo?: string; nombre?: string; runnerUps?: Array<{ codigo: string; nombre: string; score: number }> }> {
  try {
    const { clubId, roles } = await getClubContext()
    if (!roles.some(r => ['admin', 'direccion', 'director_deportivo'].includes(r))) {
      return { success: false, error: 'Sin permisos' }
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = createAdminClient() as any

    // Nombre del club desde BD (no hardcodeado)
    const { data: club } = await sb.from('clubs').select('name').eq('id', clubId).single()
    const clubName = needle ?? (club?.name as string | undefined) ?? ''
    const clubTokens = tokenize(clubName)
    if (clubTokens.length === 0) {
      return { success: false, error: 'No se pudo extraer nombre significativo del club. Configúralo en /configuracion/club.' }
    }

    const { data: comp, error: cErr } = await sb
      .from('rffm_tracked_competitions')
      .select('cod_temporada, cod_tipojuego, cod_competicion, cod_grupo')
      .eq('id', trackedCompId)
      .eq('club_id', clubId)
      .single()
    if (cErr || !comp) return { success: false, error: 'Competición no encontrada' }

    const { getCalendar } = await import('@/lib/rffm/calendar')
    const matches = await getCalendar(comp.cod_temporada, comp.cod_tipojuego, comp.cod_competicion, comp.cod_grupo)
    if (!matches.length) return { success: false, error: 'No hay partidos en esta competición. Lanza primero "Sync nuestros equipos".' }

    // Recolectar candidatos únicos con score
    const ranked = new Map<string, { codigo: string; nombre: string; score: number }>()
    for (const m of matches) {
      if (m.codigo_equipo_local && m.equipo_local) {
        const sc = scoreCandidate(clubTokens, m.equipo_local)
        if (sc > 0) {
          const existing = ranked.get(m.codigo_equipo_local)
          if (!existing || sc > existing.score) {
            ranked.set(m.codigo_equipo_local, { codigo: m.codigo_equipo_local, nombre: m.equipo_local, score: sc })
          }
        }
      }
      if (m.codigo_equipo_visitante && m.equipo_visitante) {
        const sc = scoreCandidate(clubTokens, m.equipo_visitante)
        if (sc > 0) {
          const existing = ranked.get(m.codigo_equipo_visitante)
          if (!existing || sc > existing.score) {
            ranked.set(m.codigo_equipo_visitante, { codigo: m.codigo_equipo_visitante, nombre: m.equipo_visitante, score: sc })
          }
        }
      }
    }
    if (ranked.size === 0) {
      return { success: false, error: `No se encontró ningún equipo parecido a "${clubName}" en el calendario` }
    }

    const sorted = [...ranked.values()].sort((a, b) => b.score - a.score)
    const best = sorted[0]
    const runnerUps = sorted.slice(1, 5)

    const { data: updated, error: uErr } = await sb
      .from('rffm_tracked_competitions')
      .update({ codigo_equipo_nuestro: best.codigo, nombre_equipo_nuestro: best.nombre })
      .eq('id', trackedCompId)
      .eq('club_id', clubId)
      .select('id, codigo_equipo_nuestro, nombre_equipo_nuestro')

    if (uErr) {
      return { success: false, error: `Detectado pero no se pudo guardar: ${uErr.message}` }
    }
    if (!updated || (updated as unknown[]).length === 0) {
      return { success: false, error: 'Detectado pero el UPDATE no afectó a ninguna fila (¿permisos / RLS?)' }
    }

    revalidatePath('/scouting/rffm')
    return { success: true, codigo: best.codigo, nombre: best.nombre, runnerUps }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

export async function removeTrackedCompetition(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    const { clubId, roles } = await getClubContext()
    if (!roles.some(r => ['admin', 'direccion', 'director_deportivo'].includes(r))) {
      return { success: false, error: 'Sin permisos' }
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = createAdminClient() as any
    const { error } = await sb
      .from('rffm_tracked_competitions')
      .delete()
      .eq('id', id)
      .eq('club_id', clubId)
    if (error) return { success: false, error: error.message }
    revalidatePath('/scouting/rffm')
    return { success: true }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

// ── Enrich on-demand ───────────────────────────────────────────

import { enrichSignalsBatch } from '@/lib/rffm/sync/syncEnrich'
import { syncStandings } from '@/lib/rffm/sync/syncStandings'
import { parseClubCompetitionsPdf, type PdfParseResult } from '@/lib/rffm/parse-club-pdf'

/**
 * Parsea el PDF "NFG_VisCompeticiones_Club" del club y devuelve la lista
 * de competiciones detectadas. NO crea nada en BD — solo lee.
 * El usuario después puede usar la lista para crear tracked_competitions
 * a mano (una a una) o, en el futuro, en bulk con matching automático
 * contra los endpoints de RFFM.
 */
export async function parseClubPdfAction(formData: FormData): Promise<{
  success: boolean
  error?: string
  result?: PdfParseResult
}> {
  try {
    const { clubId, roles } = await getClubContext()
    if (!roles.some(r => ['admin', 'direccion', 'director_deportivo'].includes(r))) {
      return { success: false, error: 'Sin permisos' }
    }
    const file = formData.get('file') as File | null
    if (!file) return { success: false, error: 'Falta el PDF' }
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      return { success: false, error: 'El archivo debe ser PDF' }
    }
    if (file.size > 5 * 1024 * 1024) {
      return { success: false, error: 'PDF demasiado grande (>5 MB)' }
    }

    // Pasar nombre del club desde BD para que el parser detecte el prefijo de fila
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = createAdminClient() as any
    const { data: club } = await sb.from('clubs').select('name').eq('id', clubId).single()
    const clubNameHint = (club?.name as string | undefined) ?? undefined

    const buffer = Buffer.from(await file.arrayBuffer())
    const result = await parseClubCompetitionsPdf(buffer, clubNameHint)
    return { success: true, result }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

export async function refreshStandingsNow(): Promise<{
  success: boolean; error?: string;
  result?: { processed: number; totalRows: number; errors: number }
}> {
  try {
    const { clubId, roles } = await getClubContext()
    if (!roles.some(r => ['admin', 'direccion', 'director_deportivo'].includes(r))) {
      return { success: false, error: 'Sin permisos' }
    }
    const r = await syncStandings(clubId)
    revalidatePath('/scouting/rffm')
    return {
      success: true,
      result: { processed: r.processed, totalRows: r.totalRows, errors: r.errors },
    }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

export async function enrichSignalsNow(
  batchSize: number = 50,
): Promise<{ success: boolean; error?: string; result?: { attempted: number; enriched: number; failed: number; pending: number } }> {
  try {
    const { clubId, roles } = await getClubContext()
    if (!roles.some(r => ['admin', 'direccion', 'director_deportivo'].includes(r))) {
      return { success: false, error: 'Sin permisos' }
    }
    // Cap razonable: 100 perfiles ≈ 50s con rate limit, deja margen para Vercel 60s
    const safeBatch = Math.max(1, Math.min(batchSize, 100))
    const r = await enrichSignalsBatch(clubId, safeBatch)
    revalidatePath('/scouting/rffm')
    return {
      success: true,
      result: { attempted: r.attempted, enriched: r.enriched, failed: r.failed, pending: r.pending },
    }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

// ── Scouting signals management ───────────────────────────────

export async function updateSignalStatus(
  id: string,
  estado: 'nuevo' | 'visto' | 'descartado' | 'captado'
): Promise<{ success: boolean; error?: string }> {
  try {
    const { clubId } = await getClubContext()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = createAdminClient() as any
    const { error } = await sb
      .from('rffm_scouting_signals')
      .update({ estado, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('club_id', clubId)
    if (error) return { success: false, error: error.message }
    revalidatePath('/scouting/rffm')
    return { success: true }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

export async function captureSignalToScouting(signalId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const { clubId, memberId, roles } = await getClubContext()
    if (!roles.some(r => ['admin', 'direccion', 'director_deportivo', 'coordinador'].includes(r))) {
      return { success: false, error: 'Sin permisos' }
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = createAdminClient() as any

    const { data: signal, error: sigErr } = await sb
      .from('rffm_scouting_signals')
      .select('*')
      .eq('id', signalId)
      .eq('club_id', clubId)
      .single()

    if (sigErr || !signal) return { success: false, error: 'Señal no encontrada' }

    // Create scouting report
    const { data: report, error: repErr } = await sb
      .from('scouting_reports')
      .insert({
        club_id: clubId,
        reported_by: memberId,
        rival_team: signal.nombre_equipo,
        player_name: signal.nombre_jugador,
        position: null,
        comment: `Señal RFFM: ${signal.goles} goles en ${signal.partidos_jugados} partidos (${signal.goles_por_partido}/p) — ${signal.nombre_competicion} ${signal.nombre_grupo}. Año nac: ${signal.anio_nacimiento ?? 'desconocido'}`,
        interest_level: 4,
        status: 'watching',
      })
      .select('id')
      .single()

    if (repErr) return { success: false, error: repErr.message }

    // Link signal to report
    await sb
      .from('rffm_scouting_signals')
      .update({
        estado: 'captado',
        scouting_report_id: (report as { id: string }).id,
        updated_at: new Date().toISOString(),
      })
      .eq('id', signalId)

    revalidatePath('/scouting')
    revalidatePath('/scouting/rffm')
    return { success: true }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

// ── Sync status (last log entry) ──────────────────────────────

export async function getLastSyncStatus(syncType?: string): Promise<{
  success: boolean
  data?: Record<string, unknown>
  error?: string
}> {
  try {
    const { clubId } = await getClubContext()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = createAdminClient() as any
    let q = sb
      .from('rffm_sync_log')
      .select('*')
      .eq('club_id', clubId)
      .order('started_at', { ascending: false })
      .limit(1)
    if (syncType) q = q.eq('sync_type', syncType)
    const { data, error } = await q.single()
    if (error && error.code !== 'PGRST116') return { success: false, error: error.message }
    return { success: true, data: data as Record<string, unknown> }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

// ── PDF export ────────────────────────────────────────────────

export async function exportSignalPdf(signalId: string): Promise<{
  success: boolean
  error?: string
  filename?: string
  base64?: string
}> {
  try {
    const { clubId, memberId } = await getClubContext()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = createAdminClient() as any

    const { data: signal, error } = await sb
      .from('rffm_scouting_signals')
      .select('*')
      .eq('id', signalId)
      .eq('club_id', clubId)
      .single()

    if (error || !signal) return { success: false, error: error?.message ?? 'No encontrado' }

    let generatedBy = 'Equipo de scouting'
    if (memberId) {
      const { data: member } = await sb
        .from('club_members')
        .select('name')
        .eq('id', memberId)
        .single()
      if (member?.name) generatedBy = member.name
    }

    const { generateRffmSignalPDF } = await import('@/lib/pdf/generate-rffm-signal')
    const pdf = await generateRffmSignalPDF({
      nombreJugador: signal.nombre_jugador,
      nombreEquipo: signal.nombre_equipo,
      nombreCompeticion: signal.nombre_competicion,
      nombreGrupo: signal.nombre_grupo ?? '',
      goles: Number(signal.goles ?? 0),
      partidosJugados: Number(signal.partidos_jugados ?? 0),
      golesPenalti: Number(signal.goles_penalti ?? 0),
      golesPorPartido: Number(signal.goles_por_partido ?? 0),
      divisionLevel: Number(signal.division_level ?? 0),
      valorScore: Number(signal.valor_score ?? 0),
      anioNacimiento: signal.anio_nacimiento ?? null,
      codjugador: signal.codjugador,
      generatedBy,
      generatedAt: new Date().toISOString(),
    })

    const safeName = (signal.nombre_jugador as string).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9]+/g, '_')
    return {
      success: true,
      filename: `scouting_${safeName}.pdf`,
      base64: pdf.toString('base64'),
    }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}
