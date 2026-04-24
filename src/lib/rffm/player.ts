import { fetchRffmSSR } from './client'
import type { RffmPlayer } from './types'

interface FichaPageProps {
  player: RffmPlayer
}

/**
 * Fetches a player profile from RFFM.
 * Key field: anio_nacimiento (birth year for age filtering).
 */
export async function getPlayerProfile(codjugador: string): Promise<RffmPlayer> {
  const data = await fetchRffmSSR<FichaPageProps>(
    `fichajugador/${codjugador}`
  )
  if (!data.player) throw new Error(`RFFM: jugador ${codjugador} no encontrado`)
  return data.player
}

/** Extracts total yellows/reds from a player profile tarjetas array */
export function extractCardTotals(player: RffmPlayer): {
  amarillas: number
  rojas: number
  dobleAmarillas: number
} {
  const get = (code: string) => {
    const t = player.tarjetas.find(t => t.codigo_tipo_tarjeta === code)
    return t ? parseInt(t.valor, 10) || 0 : 0
  }
  return {
    amarillas: get('100'),
    rojas: get('101'),
    dobleAmarillas: get('102'),
  }
}

/** Extracts season stats from player partidos array */
export function extractSeasonStats(player: RffmPlayer): {
  convocados: number
  titular: number
  suplente: number
  jugados: number
  goles: number
} {
  const get = (nombre: string) => {
    const p = player.partidos.find(p => p.nombre === nombre)
    return p ? parseInt(p.valor, 10) || 0 : 0
  }
  return {
    convocados: get('Convocados'),
    titular: get('Titular'),
    suplente: get('Suplente'),
    jugados: get('Jugados'),
    goles: get('Total Goles'),
  }
}
