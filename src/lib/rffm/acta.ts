import { fetchRffmSSR } from './client'
import type { RffmGame } from './types'

interface ActaPageProps {
  game: RffmGame
  seasonName: string
}

/**
 * Fetches a full match acta (report) from RFFM.
 * Returns players, goals, cards, substitutions.
 */
export async function getActa(codacta: string): Promise<RffmGame> {
  const data = await fetchRffmSSR<ActaPageProps>(
    `acta-partido/${codacta}`
  )
  if (!data.game) throw new Error(`RFFM: acta ${codacta} no encontrada`)
  return data.game
}

// ── Parsing helpers ────────────────────────────────────────────

/** Converts RFFM date string "DD-MM-YYYY" to ISO "YYYY-MM-DD" */
export function parseRffmDate(fecha: string): string | null {
  if (!fecha) return null
  const parts = fecha.split('-')
  if (parts.length !== 3) return null
  return `${parts[2]}-${parts[1]}-${parts[0]}`
}

/** Converts RFFM card type code to our internal type */
export function cardTypeFromRaw(tipoRaw: string): 'amarilla' | 'roja' | 'doble_amarilla' {
  if (tipoRaw === '101') return 'roja'
  if (tipoRaw === '102') return 'doble_amarilla'
  return 'amarilla'  // '100' or unknown
}

/** Converts RFFM goal type code to our internal type */
export function goalTypeLabel(tipoRaw: string): string {
  if (tipoRaw === '101') return 'penalti'
  if (tipoRaw === '102') return 'propia'
  return 'normal'
}
