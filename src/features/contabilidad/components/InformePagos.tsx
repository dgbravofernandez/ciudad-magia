'use client'

import { useState, useMemo } from 'react'
import { Search } from 'lucide-react'

export interface PlayerRow {
  id: string
  name: string
  teamId: string | null
  teamName: string
  totalDue: number
  totalPaid: number
}

export interface TeamRow {
  id: string
  name: string
  playerCount: number
  totalDue: number
  totalPaid: number
}

interface Props {
  players: PlayerRow[]
  teams: TeamRow[]
  season: string
}

function fmt(n: number) {
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(n)
}

function pct(paid: number, due: number) {
  if (due <= 0) return 100
  return Math.round((paid / due) * 100)
}

function StatusBadge({ paid, due }: { paid: number; due: number }) {
  const pending = due - paid
  if (pending <= 0) return <span className="badge badge-success">Al día</span>
  if (paid > 0) return <span className="badge badge-warning">Parcial</span>
  return <span className="badge badge-error">Pendiente</span>
}

export function InformePagos({ players, teams, season }: Props) {
  const [tab, setTab] = useState<'equipos' | 'jugadores'>('equipos')
  const [search, setSearch] = useState('')
  const [teamFilter, setTeamFilter] = useState('')

  const filteredPlayers = useMemo(() => {
    const q = search.toLowerCase().trim()
    return players.filter(p => {
      const matchName = !q || p.name.toLowerCase().includes(q)
      const matchTeam = !teamFilter || p.teamId === teamFilter
      return matchName && matchTeam
    })
  }, [players, search, teamFilter])

  const totalDue = players.reduce((s, p) => s + p.totalDue, 0)
  const totalPaid = players.reduce((s, p) => s + p.totalPaid, 0)
  const totalPending = totalDue - totalPaid
  const debtors = players.filter(p => p.totalDue - p.totalPaid > 0).length

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="card p-4">
          <p className="text-xs text-muted-foreground mb-1">Total recaudado</p>
          <p className="text-xl font-bold text-green-600">{fmt(totalPaid)}</p>
          <p className="text-xs text-muted-foreground mt-1">{pct(totalPaid, totalDue)}% del total</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-muted-foreground mb-1">Total pendiente</p>
          <p className="text-xl font-bold text-red-500">{fmt(totalPending)}</p>
          <p className="text-xs text-muted-foreground mt-1">{debtors} jugadores con deuda</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-muted-foreground mb-1">Total emitido</p>
          <p className="text-xl font-bold">{fmt(totalDue)}</p>
          <p className="text-xs text-muted-foreground mt-1">Temporada {season}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-muted-foreground mb-1">Tasa de cobro</p>
          <p className="text-xl font-bold">{pct(totalPaid, totalDue)}%</p>
          <div className="mt-2 h-1.5 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-green-500 rounded-full transition-all"
              style={{ width: `${pct(totalPaid, totalDue)}%` }}
            />
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border">
        <button
          onClick={() => setTab('equipos')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            tab === 'equipos'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          Resumen por equipo
        </button>
        <button
          onClick={() => setTab('jugadores')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            tab === 'jugadores'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          Detalle por jugador
        </button>
      </div>

      {tab === 'equipos' && (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Equipo</th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground">Jugadores</th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground">Emitido</th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground">Recaudado</th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground">Pendiente</th>
                  <th className="text-center px-4 py-3 font-medium text-muted-foreground w-32">% cobro</th>
                </tr>
              </thead>
              <tbody>
                {teams.length === 0 && (
                  <tr><td colSpan={6} className="text-center py-8 text-muted-foreground">Sin datos</td></tr>
                )}
                {teams
                  .sort((a, b) => (b.totalDue - b.totalPaid) - (a.totalDue - a.totalPaid))
                  .map(team => {
                    const pending = team.totalDue - team.totalPaid
                    const p = pct(team.totalPaid, team.totalDue)
                    return (
                      <tr key={team.id} className="border-b border-border last:border-0 hover:bg-muted/20">
                        <td className="px-4 py-3 font-medium">{team.name}</td>
                        <td className="px-4 py-3 text-right text-muted-foreground">{team.playerCount}</td>
                        <td className="px-4 py-3 text-right">{fmt(team.totalDue)}</td>
                        <td className="px-4 py-3 text-right text-green-600 font-medium">{fmt(team.totalPaid)}</td>
                        <td className={`px-4 py-3 text-right font-medium ${pending > 0 ? 'text-red-500' : 'text-muted-foreground'}`}>
                          {fmt(pending)}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                              <div className="h-full bg-green-500 rounded-full" style={{ width: `${p}%` }} />
                            </div>
                            <span className="text-xs w-8 text-right">{p}%</span>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
              </tbody>
              <tfoot>
                <tr className="bg-muted/40 font-semibold">
                  <td className="px-4 py-3">Total</td>
                  <td className="px-4 py-3 text-right text-muted-foreground">{players.length}</td>
                  <td className="px-4 py-3 text-right">{fmt(totalDue)}</td>
                  <td className="px-4 py-3 text-right text-green-600">{fmt(totalPaid)}</td>
                  <td className={`px-4 py-3 text-right ${totalPending > 0 ? 'text-red-500' : 'text-muted-foreground'}`}>{fmt(totalPending)}</td>
                  <td className="px-4 py-3 text-center text-sm">{pct(totalPaid, totalDue)}%</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {tab === 'jugadores' && (
        <div className="space-y-3">
          {/* Filtros */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Buscar por nombre…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="input pl-9 w-full"
              />
            </div>
            <select
              value={teamFilter}
              onChange={e => setTeamFilter(e.target.value)}
              className="input w-auto"
            >
              <option value="">Todos los equipos</option>
              {teams.map(t => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
            {(search || teamFilter) && (
              <button
                onClick={() => { setSearch(''); setTeamFilter('') }}
                className="btn btn-ghost text-sm"
              >
                Limpiar
              </button>
            )}
          </div>

          <p className="text-xs text-muted-foreground">
            {filteredPlayers.length} jugador{filteredPlayers.length !== 1 ? 'es' : ''}
            {(search || teamFilter) ? ' (filtrado)' : ''}
          </p>

          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/40">
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Jugador</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Equipo</th>
                    <th className="text-right px-4 py-3 font-medium text-muted-foreground">Emitido</th>
                    <th className="text-right px-4 py-3 font-medium text-muted-foreground">Pagado</th>
                    <th className="text-right px-4 py-3 font-medium text-muted-foreground">Pendiente</th>
                    <th className="text-center px-4 py-3 font-medium text-muted-foreground">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPlayers.length === 0 && (
                    <tr><td colSpan={6} className="text-center py-8 text-muted-foreground">Sin resultados</td></tr>
                  )}
                  {filteredPlayers
                    .sort((a, b) => (b.totalDue - b.totalPaid) - (a.totalDue - a.totalPaid))
                    .map(p => {
                      const pending = p.totalDue - p.totalPaid
                      return (
                        <tr key={p.id} className="border-b border-border last:border-0 hover:bg-muted/20">
                          <td className="px-4 py-3 font-medium">{p.name}</td>
                          <td className="px-4 py-3 text-muted-foreground text-xs">{p.teamName}</td>
                          <td className="px-4 py-3 text-right">{fmt(p.totalDue)}</td>
                          <td className="px-4 py-3 text-right text-green-600">{fmt(p.totalPaid)}</td>
                          <td className={`px-4 py-3 text-right ${pending > 0 ? 'text-red-500 font-medium' : 'text-muted-foreground'}`}>
                            {pending > 0 ? fmt(pending) : '—'}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <StatusBadge paid={p.totalPaid} due={p.totalDue} />
                          </td>
                        </tr>
                      )
                    })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
