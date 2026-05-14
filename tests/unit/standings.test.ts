/**
 * Tests para buildStandings — lógica de clasificación en TorneoDetail.
 * Extraída como función pura para testearla aislada.
 */
import { describe, it, expect } from 'vitest'

interface Team { id: string; name: string }
interface Match {
  id: string
  home_team: { name: string } | null
  away_team: { name: string } | null
  home_score: number | null
  away_score: number | null
  status: 'scheduled' | 'played' | 'cancelled'
}

function buildStandings(groupPartidos: Match[], groupTeams: Team[]) {
  const stats: Record<string, { pj: number; g: number; e: number; p: number; gf: number; gc: number }> = {}
  groupTeams.forEach(t => { stats[t.name] = { pj: 0, g: 0, e: 0, p: 0, gf: 0, gc: 0 } })
  groupPartidos.filter(m => m.status === 'played' && m.home_score != null).forEach(m => {
    const h = m.home_team?.name ?? '', a = m.away_team?.name ?? ''
    const hs = m.home_score ?? 0, as_ = m.away_score ?? 0
    if (stats[h]) { stats[h].pj++; stats[h].gf += hs; stats[h].gc += as_; if (hs > as_) stats[h].g++; else if (hs === as_) stats[h].e++; else stats[h].p++ }
    if (stats[a]) { stats[a].pj++; stats[a].gf += as_; stats[a].gc += hs; if (as_ > hs) stats[a].g++; else if (hs === as_) stats[a].e++; else stats[a].p++ }
  })
  return Object.entries(stats).map(([name, s]) => ({ name, ...s, gd: s.gf - s.gc, pts: s.g * 3 + s.e })).sort((a, b) => b.pts - a.pts || b.gd - a.gd)
}

const teams: Team[] = [
  { id: '1', name: 'Equipo A' },
  { id: '2', name: 'Equipo B' },
  { id: '3', name: 'Equipo C' },
]

describe('buildStandings', () => {
  it('todos a 0 sin partidos', () => {
    const standings = buildStandings([], teams)
    expect(standings).toHaveLength(3)
    standings.forEach(row => {
      expect(row.pts).toBe(0)
      expect(row.pj).toBe(0)
    })
  })

  it('victoria suma 3 puntos al ganador, 0 al perdedor', () => {
    const matches: Match[] = [{
      id: '1',
      home_team: { name: 'Equipo A' },
      away_team: { name: 'Equipo B' },
      home_score: 2,
      away_score: 0,
      status: 'played',
    }]
    const standings = buildStandings(matches, teams)
    const a = standings.find(r => r.name === 'Equipo A')!
    const b = standings.find(r => r.name === 'Equipo B')!
    expect(a.pts).toBe(3)
    expect(a.g).toBe(1)
    expect(a.p).toBe(0)
    expect(b.pts).toBe(0)
    expect(b.p).toBe(1)
  })

  it('empate suma 1 punto a cada equipo', () => {
    const matches: Match[] = [{
      id: '1',
      home_team: { name: 'Equipo A' },
      away_team: { name: 'Equipo B' },
      home_score: 1,
      away_score: 1,
      status: 'played',
    }]
    const standings = buildStandings(matches, teams)
    const a = standings.find(r => r.name === 'Equipo A')!
    const b = standings.find(r => r.name === 'Equipo B')!
    expect(a.pts).toBe(1)
    expect(a.e).toBe(1)
    expect(b.pts).toBe(1)
    expect(b.e).toBe(1)
  })

  it('partidos no jugados no computan', () => {
    const matches: Match[] = [{
      id: '1',
      home_team: { name: 'Equipo A' },
      away_team: { name: 'Equipo B' },
      home_score: null,
      away_score: null,
      status: 'scheduled',
    }]
    const standings = buildStandings(matches, teams)
    standings.forEach(r => expect(r.pj).toBe(0))
  })

  it('partidos cancelados no computan', () => {
    const matches: Match[] = [{
      id: '1',
      home_team: { name: 'Equipo A' },
      away_team: { name: 'Equipo B' },
      home_score: 3,
      away_score: 0,
      status: 'cancelled',
    }]
    const standings = buildStandings(matches, teams)
    standings.forEach(r => expect(r.pts).toBe(0))
  })

  it('diferencia de goles positiva sube en clasificación', () => {
    const matches: Match[] = [
      { id: '1', home_team: { name: 'Equipo A' }, away_team: { name: 'Equipo C' }, home_score: 3, away_score: 0, status: 'played' },
      { id: '2', home_team: { name: 'Equipo B' }, away_team: { name: 'Equipo C' }, home_score: 1, away_score: 0, status: 'played' },
    ]
    const standings = buildStandings(matches, teams)
    // A y B tienen 3 pts cada uno, pero A tiene +3 GD y B tiene +1 GD → A primero
    expect(standings[0].name).toBe('Equipo A')
    expect(standings[1].name).toBe('Equipo B')
  })

  it('goles a favor y en contra se contabilizan correctamente', () => {
    const matches: Match[] = [{
      id: '1',
      home_team: { name: 'Equipo A' },
      away_team: { name: 'Equipo B' },
      home_score: 3,
      away_score: 1,
      status: 'played',
    }]
    const standings = buildStandings(matches, teams)
    const a = standings.find(r => r.name === 'Equipo A')!
    const b = standings.find(r => r.name === 'Equipo B')!
    expect(a.gf).toBe(3)
    expect(a.gc).toBe(1)
    expect(a.gd).toBe(2)
    expect(b.gf).toBe(1)
    expect(b.gc).toBe(3)
    expect(b.gd).toBe(-2)
  })

  it('equipo no registrado en el grupo se ignora', () => {
    const matches: Match[] = [{
      id: '1',
      home_team: { name: 'Equipo Fantasma' },
      away_team: { name: 'Equipo A' },
      home_score: 2,
      away_score: 0,
      status: 'played',
    }]
    const standings = buildStandings(matches, teams)
    // Equipo A tiene pj=1 pero perdió — no crashea por Equipo Fantasma
    const a = standings.find(r => r.name === 'Equipo A')!
    expect(a.pj).toBe(1)
    expect(a.p).toBe(1)
    // No hay fila para Equipo Fantasma
    expect(standings.find(r => r.name === 'Equipo Fantasma')).toBeUndefined()
  })

  it('múltiples jornadas acumulan correctamente', () => {
    const matches: Match[] = [
      { id: '1', home_team: { name: 'Equipo A' }, away_team: { name: 'Equipo B' }, home_score: 2, away_score: 0, status: 'played' },
      { id: '2', home_team: { name: 'Equipo A' }, away_team: { name: 'Equipo C' }, home_score: 1, away_score: 1, status: 'played' },
      { id: '3', home_team: { name: 'Equipo B' }, away_team: { name: 'Equipo C' }, home_score: 0, away_score: 1, status: 'played' },
    ]
    const standings = buildStandings(matches, teams)
    const a = standings.find(r => r.name === 'Equipo A')!
    expect(a.pj).toBe(2)
    expect(a.g).toBe(1)
    expect(a.e).toBe(1)
    expect(a.pts).toBe(4)
  })
})
