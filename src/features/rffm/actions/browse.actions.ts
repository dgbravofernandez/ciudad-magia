'use server'

import { getScopedClient } from '@/lib/supabase/scoped-client'
import { parseRffmCompetitionUrl, type RffmCompetition, type RffmGroup } from '@/lib/rffm/club-importer'
import { fetchRffmAPI } from '@/lib/rffm/client'
import { getStandings } from '@/lib/rffm/standings'

const TIPOJUEGO_LABELS: Record<string, string> = {
  '1': 'F-11',
  '2': 'F-7',
  '4': 'F-5 / Sala',
}

export interface ResolvedCompetition {
  cod_temporada: string
  cod_tipojuego: string
  cod_competicion: string
  cod_grupo: string
  label_tipojuego: string
  nombre_competicion: string
  nombre_grupo: string
}

export interface ResolvedTeam {
  codigo_equipo: string
  nombre_equipo: string
  posicion: number
}

export async function resolveCompetitionUrlAction(url: string): Promise<{
  success: boolean
  error?: string
  parsed?: ResolvedCompetition
  teams?: ResolvedTeam[]
}> {
  try {
    const { roles } = await getScopedClient()
    if (!roles.some(r => ['admin', 'direccion', 'director_deportivo'].includes(r))) {
      return { success: false, error: 'Sin permisos' }
    }

    const codes = parseRffmCompetitionUrl(url.trim())

    const missing: string[] = []
    if (!codes.cod_temporada) missing.push('temporada')
    if (!codes.cod_tipojuego) missing.push('tipojuego')
    if (!codes.cod_competicion) missing.push('competicion')
    if (!codes.cod_grupo) missing.push('grupo')

    if (missing.length > 0) {
      return {
        success: false,
        error: `URL incompleta. Faltan parámetros: ${missing.join(', ')}. Copia la URL desde la página de calendario o clasificación de RFFM.`,
      }
    }

    const codTemporada = codes.cod_temporada!
    const codTipojuego = codes.cod_tipojuego!
    const codCompeticion = codes.cod_competicion!
    const codGrupo = codes.cod_grupo!

    // Fetch competition name
    let nombreCompeticion = codCompeticion
    try {
      const comps = await fetchRffmAPI<RffmCompetition[]>('competitions', {
        temporada: codTemporada,
        tipojuego: codTipojuego,
      })
      const arr = Array.isArray(comps) ? comps : []
      const found = arr.find(c => String(c.codigo) === codCompeticion)
      if (found) nombreCompeticion = found.nombre
    } catch { /* leave as code */ }

    // Fetch group name
    let nombreGrupo = codGrupo
    try {
      const groups = await fetchRffmAPI<RffmGroup[]>('groups', { competicion: codCompeticion })
      const arr = Array.isArray(groups) ? groups : []
      const found = arr.find(g => String(g.codigo) === codGrupo)
      if (found) nombreGrupo = found.nombre
    } catch { /* leave as code */ }

    // Fetch standings (validates codes + gets team list)
    const standings = await getStandings(codTemporada, codTipojuego, codCompeticion, codGrupo)
    if (standings.length === 0) {
      return {
        success: false,
        error: 'No se encontró clasificación para esta competición/grupo. Verifica que la URL sea correcta y que la temporada esté activa.',
      }
    }

    const teams: ResolvedTeam[] = standings.map(r => ({
      codigo_equipo: r.codigo_equipo,
      nombre_equipo: r.nombre_equipo,
      posicion: r.posicion,
    }))

    // Determine temporada label
    const TEMPORADA_LABELS: Record<string, string> = {
      '21': '2025-2026',
      '20': '2024-2025',
      '19': '2023-2024',
    }

    return {
      success: true,
      parsed: {
        cod_temporada: codTemporada,
        cod_tipojuego: codTipojuego,
        cod_competicion: codCompeticion,
        cod_grupo: codGrupo,
        label_tipojuego: TIPOJUEGO_LABELS[codTipojuego] ?? `Tipo ${codTipojuego}`,
        nombre_competicion: nombreCompeticion,
        nombre_grupo: nombreGrupo,
      },
      teams,
    }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}


