'use client'
import { useState } from 'react'
import { Users, BarChart2, Calendar, GitBranch, Plus, Edit2, Check, X } from 'lucide-react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { toast } from 'sonner'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

interface Team { id: string; name: string; contact?: string }
interface Group { id: string; name: string }
interface Match {
  id: string
  home_team: { name: string } | null
  away_team: { name: string } | null
  group: { name: string } | null
  home_score: number | null
  away_score: number | null
  match_date: string | null
  status: 'scheduled' | 'played' | 'cancelled'
  round: string | null
}

interface Props { torneo: Record<string, unknown>; equipos: Team[]; grupos: Group[]; partidos: Match[] }

const FORMAT_LABELS: Record<string, string> = { league: 'Liga', cup: 'Copa', mixed: 'Liga + Eliminatorias' }

export function TorneoDetail({ torneo, equipos, grupos, partidos }: Props) {
  const [tab, setTab] = useState<'equipos' | 'grupos' | 'partidos' | 'eliminatorias'>('equipos')
  const [showAddTeam, setShowAddTeam] = useState(false)
  const [newTeamName, setNewTeamName] = useState('')
  const [localTeams, setLocalTeams] = useState(equipos)

  const tabs = [
    { key: 'equipos', label: 'Equipos', icon: Users },
    { key: 'grupos', label: 'Clasificación', icon: BarChart2 },
    { key: 'partidos', label: 'Partidos', icon: Calendar },
    { key: 'eliminatorias', label: 'Eliminatorias', icon: GitBranch },
  ] as const

  // Group partidos by group name
  const partidosByGroup = partidos.reduce<Record<string, Match[]>>((acc, m) => {
    const g = m.group?.name ?? 'Sin grupo'
    if (!acc[g]) acc[g] = []
    acc[g].push(m)
    return acc
  }, {})

  // Build mock standings for each group
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

  return (
    <div className="p-6">
      <div className="mb-6">
        <Link href="/torneos" className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-3">
          <ArrowLeft className="w-4 h-4" /> Volver a torneos
        </Link>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{torneo.name as string}</h1>
            <div className="flex items-center gap-3 mt-1 text-sm text-gray-500">
              {torneo.category && <span>{torneo.category as string}</span>}
              <span>{FORMAT_LABELS[torneo.format as string] ?? torneo.format as string}</span>
              {torneo.location && <span>{torneo.location as string}</span>}
            </div>
          </div>
        </div>
      </div>

      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 mb-6 w-fit">
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${tab === t.key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
            <t.icon className="w-4 h-4" />{t.label}
          </button>
        ))}
      </div>

      {tab === 'equipos' && (
        <div className="max-w-md space-y-3">
          {localTeams.map(t => (
            <div key={t.id} className="bg-white rounded-xl border border-gray-200 p-4 flex items-center justify-between">
              <div>
                <p className="font-medium text-gray-900">{t.name}</p>
                {t.contact && <p className="text-xs text-gray-500">{t.contact}</p>}
              </div>
              <Users className="w-4 h-4 text-gray-300" />
            </div>
          ))}
          {showAddTeam ? (
            <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-2">
              <input autoFocus value={newTeamName} onChange={e => setNewTeamName(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && newTeamName) { setLocalTeams(ts => [...ts, { id: Date.now().toString(), name: newTeamName }]); setNewTeamName(''); setShowAddTeam(false); toast.success('Equipo añadido') } if (e.key === 'Escape') setShowAddTeam(false) }} className="flex-1 border-0 outline-none text-sm" placeholder="Nombre del equipo..." />
              <button onClick={() => { if (newTeamName) { setLocalTeams(ts => [...ts, { id: Date.now().toString(), name: newTeamName }]); setNewTeamName(''); setShowAddTeam(false); toast.success('Equipo añadido') } }} className="text-green-600 hover:text-green-700"><Check className="w-4 h-4" /></button>
              <button onClick={() => setShowAddTeam(false)} className="text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>
            </div>
          ) : (
            <button onClick={() => setShowAddTeam(true)} className="w-full flex items-center justify-center gap-2 border-2 border-dashed border-gray-200 rounded-xl py-3 text-sm text-gray-400 hover:border-blue-300 hover:text-blue-500 transition-all">
              <Plus className="w-4 h-4" /> Añadir equipo
            </button>
          )}
        </div>
      )}

      {tab === 'grupos' && (
        <div className="space-y-6">
          {grupos.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-400">
              <BarChart2 className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p>No hay grupos configurados</p>
            </div>
          ) : grupos.map(g => {
            const gPartidos = partidosByGroup[g.name] ?? []
            const standings = buildStandings(gPartidos, localTeams)
            return (
              <div key={g.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className="px-4 py-3 bg-gray-50 border-b border-gray-100">
                  <h3 className="font-semibold text-gray-900">Grupo {g.name}</h3>
                </div>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs text-gray-500 uppercase tracking-wide">
                      <th className="text-left px-4 py-2">Equipo</th>
                      {['PJ','G','E','P','GF','GC','GD','Pts'].map(h => <th key={h} className="text-center px-2 py-2 w-8">{h}</th>)}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {standings.map((row, i) => (
                      <tr key={row.name} className={i === 0 ? 'bg-green-50' : ''}>
                        <td className="px-4 py-2.5 font-medium text-gray-900">{row.name}</td>
                        {[row.pj, row.g, row.e, row.p, row.gf, row.gc, row.gd].map((v, j) => <td key={j} className="text-center px-2 py-2.5 text-gray-600">{v}</td>)}
                        <td className="text-center px-2 py-2.5 font-bold text-gray-900">{row.pts}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          })}
        </div>
      )}

      {tab === 'partidos' && (
        <div className="space-y-6 max-w-2xl">
          {Object.entries(partidosByGroup).map(([groupName, gPartidos]) => (
            <div key={groupName}>
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">{groupName}</h3>
              <div className="space-y-2">
                {gPartidos.map(m => (
                  <div key={m.id} className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-4">
                    <div className="flex-1 text-right">
                      <p className="font-medium text-gray-900">{m.home_team?.name ?? 'TBD'}</p>
                    </div>
                    <div className="text-center min-w-[80px]">
                      {m.status === 'played' ? (
                        <span className="text-lg font-bold text-gray-900">{m.home_score} - {m.away_score}</span>
                      ) : (
                        <span className="text-sm text-gray-400">{m.match_date ? format(new Date(m.match_date), 'd MMM', { locale: es }) : 'vs'}</span>
                      )}
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-gray-900">{m.away_team?.name ?? 'TBD'}</p>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${m.status === 'played' ? 'bg-green-50 text-green-700' : m.status === 'cancelled' ? 'bg-red-50 text-red-700' : 'bg-gray-100 text-gray-500'}`}>
                      {m.status === 'played' ? 'Jugado' : m.status === 'cancelled' ? 'Cancelado' : 'Pendiente'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
          {partidos.length === 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-400">
              <Calendar className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p>No hay partidos registrados</p>
            </div>
          )}
        </div>
      )}

      {tab === 'eliminatorias' && (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-400">
          <GitBranch className="w-8 h-8 mx-auto mb-2 opacity-30" />
          <p>El cuadro de eliminatorias se genera automáticamente</p>
          <p className="text-sm mt-1">cuando finaliza la fase de grupos</p>
        </div>
      )}
    </div>
  )
}
