'use client'

import { useState, useMemo, useTransition, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Search, ArrowUpDown, Bell, BellOff, Download, FileText, ChevronDown, Wand2 } from 'lucide-react'
import { toast } from 'sonner'
import { sendPendingReminders } from '@/features/contabilidad/actions/accounting.actions'
import { generateMissingNextSeasonFees } from '@/features/jugadores/actions/player.actions'

export interface PlayerRow {
  id: string
  name: string
  teamId: string | null
  teamName: string
  totalDue: number
  totalPaid: number
  hasCuota?: boolean
}

export interface ReminderRecord {
  lastSent: string
  count: number
  history: string[]
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
  globalTotalPaid: number
  globalTotalDue: number
  reminderHistory?: Record<string, ReminderRecord>
  clubName?: string
  isNextSeason?: boolean
}

function fmt(n: number) {
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(n)
}

function pct(paid: number, due: number) {
  if (due <= 0) return 0
  return Math.round((paid / due) * 100)
}

type StatusFilter = 'todos' | 'aldia' | 'parcial' | 'pendiente' | 'sincuota'
type SortBy = 'deuda' | 'nombre' | 'equipo' | 'pagado' | 'emitido'
type TeamSort = 'deuda' | 'nombre'

function getStatus(p: PlayerRow): StatusFilter {
  if (!p.hasCuota && p.totalDue === 0 && p.totalPaid === 0) return 'sincuota'
  const pending = p.totalDue - p.totalPaid
  if (pending <= 0) return 'aldia'
  if (p.totalPaid > 0) return 'parcial'
  return 'pendiente'
}

function StatusBadge({ player }: { player: PlayerRow }) {
  const status = getStatus(player)
  if (status === 'sincuota') return <span className="badge badge-ghost text-xs">Sin cuota</span>
  if (status === 'aldia') return <span className="badge badge-success text-xs">Al día</span>
  if (status === 'parcial') return <span className="badge badge-warning text-xs">Parcial</span>
  return <span className="badge badge-error text-xs">Pendiente</span>
}

const STATUS_LABELS: Record<StatusFilter, string> = {
  todos: 'Todos',
  aldia: 'Al día',
  parcial: 'Parcial',
  pendiente: 'Con deuda',
  sincuota: 'Sin cuota',
}

function daysSince(iso: string): string {
  const d = new Date(iso)
  const days = Math.floor((Date.now() - d.getTime()) / 86400000)
  if (days === 0) return 'hoy'
  if (days === 1) return 'ayer'
  return d.toLocaleDateString('es-ES')  // dd/mm/aaaa
}

export function InformePagos({ players, teams, season, globalTotalPaid, globalTotalDue, reminderHistory = {}, clubName = '', isNextSeason = false }: Props) {
  const router = useRouter()
  const [generatingFees, setGeneratingFees] = useState(false)
  const [tab, setTab] = useState<'equipos' | 'jugadores'>('equipos')
  const [search, setSearch] = useState('')
  const [teamFilter, setTeamFilter] = useState<string[]>([])   // multi-selección
  const [teamMenuOpen, setTeamMenuOpen] = useState(false)
  const teamMenuRef = useRef<HTMLDivElement>(null)
  const [exporting, setExporting] = useState(false)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('todos')
  const [sortBy, setSortBy] = useState<SortBy>('deuda')
  const [sortAsc, setSortAsc] = useState(false)
  const [teamSort, setTeamSort] = useState<TeamSort>('nombre')
  const [isPending, startTransition] = useTransition()
  const [sendingIds, setSendingIds] = useState<Set<string>>(new Set())
  const [localHistory, setLocalHistory] = useState<Record<string, ReminderRecord>>(reminderHistory)

  function sendReminder(playerIds: string[]) {
    setSendingIds(prev => new Set([...prev, ...playerIds]))
    startTransition(async () => {
      const res = await sendPendingReminders(playerIds)
      if ((res as { success?: boolean })?.success) {
        const now = new Date().toISOString()
        setLocalHistory(prev => {
          const next = { ...prev }
          for (const id of playerIds) {
            const existing = next[id]
            next[id] = {
              lastSent: now,
              count: (existing?.count ?? 0) + 1,
              history: [now, ...(existing?.history ?? [])],
            }
          }
          return next
        })
        toast.success(`Aviso enviado a ${playerIds.length} jugador${playerIds.length !== 1 ? 'es' : ''}`)
      } else {
        toast.error('Error al enviar el aviso')
      }
      setSendingIds(prev => { const s = new Set(prev); playerIds.forEach(id => s.delete(id)); return s })
    })
  }

  // Counts per status for pills
  const statusCounts = useMemo(() => {
    const counts: Record<StatusFilter, number> = { todos: players.length, aldia: 0, parcial: 0, pendiente: 0, sincuota: 0 }
    for (const p of players) counts[getStatus(p)]++
    return counts
  }, [players])

  const filteredPlayers = useMemo(() => {
    const q = search.toLowerCase().trim()
    let list = players.filter(p => {
      const matchName = !q || p.name.toLowerCase().includes(q)
      const matchTeam = teamFilter.length === 0 || (p.teamId !== null && teamFilter.includes(p.teamId))
      const matchStatus = statusFilter === 'todos' || getStatus(p) === statusFilter
      return matchName && matchTeam && matchStatus
    })

    list = [...list].sort((a, b) => {
      let diff = 0
      if (sortBy === 'deuda')    diff = (b.totalDue - b.totalPaid) - (a.totalDue - a.totalPaid)
      else if (sortBy === 'nombre') diff = a.name.localeCompare(b.name, 'es')
      else if (sortBy === 'equipo') diff = a.teamName.localeCompare(b.teamName, 'es')
      else if (sortBy === 'pagado') diff = b.totalPaid - a.totalPaid
      else if (sortBy === 'emitido') diff = b.totalDue - a.totalDue
      return sortAsc ? -diff : diff
    })

    return list
  }, [players, search, teamFilter, statusFilter, sortBy, sortAsc])

  // Cerrar el menú de equipos al hacer click fuera
  useEffect(() => {
    if (!teamMenuOpen) return
    function onClick(e: MouseEvent) {
      if (teamMenuRef.current && !teamMenuRef.current.contains(e.target as Node)) setTeamMenuOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [teamMenuOpen])

  function toggleTeam(id: string) {
    setTeamFilter(prev => prev.includes(id) ? prev.filter(t => t !== id) : [...prev, id])
  }

  // ── Exportaciones (sobre los jugadores ya filtrados) ──
  function exportRows() {
    return filteredPlayers.map(p => ({
      Jugador: p.name,
      Equipo: p.teamName,
      'Emitido (€)': p.hasCuota ? p.totalDue : 0,
      'Pagado (€)': p.hasCuota ? p.totalPaid : 0,
      'Pendiente (€)': Math.max(0, p.totalDue - p.totalPaid),
      Estado: STATUS_LABELS[getStatus(p)],
    }))
  }

  async function exportExcel() {
    const rows = exportRows()
    const XLSX = await import('xlsx')
    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.json_to_sheet(rows)
    if (rows.length > 0) ws['!cols'] = Object.keys(rows[0]).map(k => ({ wch: Math.max(12, k.length + 2) }))
    XLSX.utils.book_append_sheet(wb, ws, `Pagos ${season}`.slice(0, 31))
    XLSX.writeFile(wb, `Informe_Pagos_${season}_${new Date().toISOString().slice(0, 10)}.xlsx`)
  }

  function pdfLabel(p: PlayerRow): 'Al día' | 'Parcial' | 'Sin pagar' | 'Sin cuotas' {
    const s = getStatus(p)
    if (s === 'sincuota') return 'Sin cuotas'
    if (s === 'aldia') return 'Al día'
    if (s === 'parcial') return 'Parcial'
    return 'Sin pagar'
  }

  async function exportPdf() {
    setExporting(true)
    try {
      const { generatePlayerListPdf } = await import('@/lib/pdf/playerListPdf')
      const blob = await generatePlayerListPdf({
        clubName: clubName || 'Club',
        clubLogoUrl: null,
        clubPrimaryColor: '#EC4899',
        season,
        players: filteredPlayers.map(p => ({
          id: p.id, fullName: p.name, dni: '', birthDate: null,
          teamName: p.teamName, position: '', status: 'active',
          payment: {
            label: pdfLabel(p),
            due: p.hasCuota ? p.totalDue : 0,
            paid: p.hasCuota ? p.totalPaid : 0,
            pending: Math.max(0, p.totalDue - p.totalPaid),
          },
        })),
      })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `Informe_Pagos_${season}.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      toast.error('No se pudo generar el PDF')
    } finally {
      setExporting(false)
    }
  }

  async function handleGenerateFees() {
    setGeneratingFees(true)
    const res = await generateMissingNextSeasonFees()
    setGeneratingFees(false)
    if (res.success) {
      const fixed = res.playersFixed ?? 0
      const skipped = res.skippedNoFees ?? 0
      toast.success(
        `Cuotas generadas para ${fixed} jugador${fixed !== 1 ? 'es' : ''}` +
        (skipped > 0 ? ` · ${skipped} sin tarifa de equipo configurada` : '')
      )
      router.refresh()
    } else {
      toast.error(res.error ?? 'Error generando cuotas')
    }
  }

  const activeTotalDue = players.reduce((s, p) => s + p.totalDue, 0)
  const activeTotalPaid = players.reduce((s, p) => s + p.totalPaid, 0)
  const activeTotalPending = activeTotalDue - activeTotalPaid
  const debtors = players.filter(p => p.totalDue - p.totalPaid > 0).length

  // Teams sorted
  const sortedTeams = useMemo(() => {
    return [...teams].sort((a, b) =>
      teamSort === 'nombre'
        ? a.name.localeCompare(b.name, 'es')
        : (b.totalDue - b.totalPaid) - (a.totalDue - a.totalPaid)
    )
  }, [teams, teamSort])

  // Team dropdown sorted A-Z
  const teamsAlphabetical = useMemo(() =>
    [...teams].sort((a, b) => a.name.localeCompare(b.name, 'es')),
    [teams]
  )

  function toggleSort(col: SortBy) {
    if (sortBy === col) setSortAsc(v => !v)
    else { setSortBy(col); setSortAsc(false) }
  }

  function SortIcon({ col }: { col: SortBy }) {
    if (sortBy !== col) return <ArrowUpDown className="w-3 h-3 opacity-30 inline ml-1" />
    return <span className="inline ml-1 text-primary">{sortAsc ? '↑' : '↓'}</span>
  }

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="card p-4">
          <p className="text-xs text-muted-foreground mb-1">Total recaudado</p>
          <p className="text-xl font-bold text-green-600">{fmt(globalTotalPaid)}</p>
          <p className="text-xs text-muted-foreground mt-1">Toda la temporada</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-muted-foreground mb-1">Pendiente (activos)</p>
          <p className="text-xl font-bold text-red-500">{fmt(activeTotalPending)}</p>
          <p className="text-xs text-muted-foreground mt-1">{debtors} jugadores con deuda</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-muted-foreground mb-1">Emitido (activos)</p>
          <p className="text-xl font-bold">{fmt(activeTotalDue)}</p>
          <p className="text-xs text-muted-foreground mt-1">Temporada {season}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-muted-foreground mb-1">Tasa de cobro</p>
          <p className="text-xl font-bold">{pct(globalTotalPaid, globalTotalDue)}%</p>
          <div className="mt-2 h-1.5 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-green-500 rounded-full transition-all"
              style={{ width: `${Math.min(100, pct(globalTotalPaid, globalTotalDue))}%` }}
            />
          </div>
        </div>
      </div>

      {/* Aviso: confirmados sin cuota en temporada siguiente → generar */}
      {isNextSeason && statusCounts.sincuota > 0 && (
        <div className="flex items-center justify-between gap-3 p-3 rounded-lg border border-amber-300 bg-amber-50 flex-wrap">
          <p className="text-sm text-amber-800">
            <strong>{statusCounts.sincuota}</strong> jugador{statusCounts.sincuota !== 1 ? 'es' : ''} confirmado{statusCounts.sincuota !== 1 ? 's' : ''} para {season} sin cuota asignada (se añadieron a su equipo después de generar las cuotas).
          </p>
          <button
            onClick={handleGenerateFees}
            disabled={generatingFees}
            className="btn btn-sm flex items-center gap-2 text-sm disabled:opacity-50 whitespace-nowrap"
          >
            <Wand2 className="w-4 h-4" />
            {generatingFees ? 'Generando…' : `Generar cuotas faltantes (${statusCounts.sincuota})`}
          </button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border">
        <button
          onClick={() => setTab('equipos')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            tab === 'equipos' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          Resumen por equipo
        </button>
        <button
          onClick={() => setTab('jugadores')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            tab === 'jugadores' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          Detalle por jugador ({players.length})
        </button>
      </div>

      {/* ── EQUIPOS ── */}
      {tab === 'equipos' && (
        <div className="space-y-3">
          <div className="flex items-center gap-3 justify-end">
            <span className="text-xs text-muted-foreground">Ordenar por:</span>
            <div className="flex gap-1">
              {(['nombre', 'deuda'] as TeamSort[]).map(s => (
                <button
                  key={s}
                  onClick={() => setTeamSort(s)}
                  className={`px-3 py-1 rounded text-xs border transition-colors ${
                    teamSort === s ? 'bg-primary text-primary-foreground border-primary' : 'border-border hover:border-primary'
                  }`}
                >
                  {s === 'nombre' ? 'Nombre A-Z' : 'Mayor deuda'}
                </button>
              ))}
            </div>
          </div>
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
                  {sortedTeams.length === 0 && (
                    <tr><td colSpan={6} className="text-center py-8 text-muted-foreground">Sin datos</td></tr>
                  )}
                  {sortedTeams.map(team => {
                    const pending = team.totalDue - team.totalPaid
                    const p = pct(team.totalPaid, team.totalDue)
                    return (
                      <tr key={team.id} className="border-b border-border last:border-0 hover:bg-muted/20">
                        <td className="px-4 py-3 font-medium">{team.name}</td>
                        <td className="px-4 py-3 text-right text-muted-foreground">{team.playerCount}</td>
                        <td className="px-4 py-3 text-right">{fmt(team.totalDue)}</td>
                        <td className="px-4 py-3 text-right text-green-600 font-medium">{fmt(team.totalPaid)}</td>
                        <td className={`px-4 py-3 text-right font-medium ${pending > 0 ? 'text-red-500' : 'text-muted-foreground'}`}>
                          {pending > 0 ? fmt(pending) : '—'}
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
                    <td className="px-4 py-3 text-right text-muted-foreground">{players.filter(p => p.hasCuota).length}</td>
                    <td className="px-4 py-3 text-right">{fmt(activeTotalDue)}</td>
                    <td className="px-4 py-3 text-right text-green-600">{fmt(activeTotalPaid)}</td>
                    <td className={`px-4 py-3 text-right ${activeTotalPending > 0 ? 'text-red-500' : 'text-muted-foreground'}`}>{fmt(activeTotalPending)}</td>
                    <td className="px-4 py-3 text-center text-sm">{pct(activeTotalPaid, activeTotalDue)}%</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── JUGADORES ── */}
      {tab === 'jugadores' && (
        <div className="space-y-3">
          {/* Filtros */}
          <div className="flex flex-col sm:flex-row gap-3 flex-wrap items-start">
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Buscar por nombre…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="input pl-9 w-full"
              />
            </div>

            {/* Multi-selección de equipos */}
            <div className="relative" ref={teamMenuRef}>
              <button
                type="button"
                onClick={() => setTeamMenuOpen(o => !o)}
                className="input w-auto flex items-center gap-2 min-w-[180px] justify-between"
              >
                <span className="truncate">
                  {teamFilter.length === 0
                    ? 'Todos los equipos'
                    : `${teamFilter.length} equipo${teamFilter.length !== 1 ? 's' : ''}`}
                </span>
                <ChevronDown className="w-4 h-4 opacity-60 shrink-0" />
              </button>
              {teamMenuOpen && (
                <div className="absolute z-20 mt-1 w-64 max-h-72 overflow-auto rounded-md border border-border bg-background shadow-lg p-1">
                  <div className="flex items-center justify-between px-2 py-1">
                    <button type="button" className="text-xs text-primary hover:underline"
                      onClick={() => setTeamFilter(teamsAlphabetical.map(t => t.id))}>Todos</button>
                    <button type="button" className="text-xs text-muted-foreground hover:underline"
                      onClick={() => setTeamFilter([])}>Ninguno</button>
                  </div>
                  {teamsAlphabetical.map(t => (
                    <label key={t.id} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted/40 cursor-pointer text-sm">
                      <input type="checkbox" checked={teamFilter.includes(t.id)} onChange={() => toggleTeam(t.id)} />
                      <span className="truncate">{t.name}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>

            {/* Exportar */}
            <div className="flex gap-2">
              <button type="button" onClick={exportExcel} className="btn btn-ghost text-sm flex items-center gap-1.5" title="Exportar a Excel">
                <Download className="w-4 h-4" /> Excel
              </button>
              <button type="button" onClick={exportPdf} disabled={exporting} className="btn btn-ghost text-sm flex items-center gap-1.5 disabled:opacity-50" title="Exportar a PDF">
                <FileText className="w-4 h-4" /> {exporting ? 'PDF…' : 'PDF'}
              </button>
            </div>

            {(search || teamFilter.length > 0 || statusFilter !== 'todos') && (
              <button
                onClick={() => { setSearch(''); setTeamFilter([]); setStatusFilter('todos') }}
                className="btn btn-ghost text-sm"
              >
                Limpiar
              </button>
            )}
          </div>

          {/* Pills de estado */}
          <div className="flex flex-wrap gap-2">
            {(['todos', 'aldia', 'parcial', 'pendiente', 'sincuota'] as StatusFilter[]).map(s => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-3 py-1 rounded-full text-xs border transition-colors ${
                  statusFilter === s
                    ? s === 'aldia' ? 'bg-green-100 border-green-400 text-green-700'
                    : s === 'parcial' ? 'bg-yellow-100 border-yellow-400 text-yellow-700'
                    : s === 'pendiente' ? 'bg-red-100 border-red-400 text-red-700'
                    : s === 'sincuota' ? 'bg-gray-100 border-gray-400 text-gray-700'
                    : 'bg-primary text-primary-foreground border-primary'
                    : 'border-border hover:border-primary text-muted-foreground'
                }`}
              >
                {STATUS_LABELS[s]} ({statusCounts[s]})
              </button>
            ))}
          </div>

          <div className="flex items-center justify-between flex-wrap gap-2">
            <p className="text-xs text-muted-foreground">
              {filteredPlayers.length} de {players.length} jugador{players.length !== 1 ? 'es' : ''}
            </p>
            {(() => {
              const deudores = filteredPlayers.filter(p => (p.totalDue - p.totalPaid) > 0)
              if (deudores.length === 0) return null
              return (
                <button
                  onClick={() => sendReminder(deudores.map(p => p.id))}
                  disabled={isPending}
                  className="btn btn-sm flex items-center gap-2 text-xs"
                >
                  <Bell className="w-3.5 h-3.5" />
                  Avisar a {deudores.length} deudor{deudores.length !== 1 ? 'es' : ''}
                </button>
              )
            })()}
          </div>

          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/40">
                    <th
                      className="text-left px-4 py-3 font-medium text-muted-foreground cursor-pointer hover:text-foreground select-none"
                      onClick={() => toggleSort('nombre')}
                    >
                      Jugador <SortIcon col="nombre" />
                    </th>
                    <th
                      className="text-left px-4 py-3 font-medium text-muted-foreground cursor-pointer hover:text-foreground select-none"
                      onClick={() => toggleSort('equipo')}
                    >
                      Equipo <SortIcon col="equipo" />
                    </th>
                    <th
                      className="text-right px-4 py-3 font-medium text-muted-foreground cursor-pointer hover:text-foreground select-none"
                      onClick={() => toggleSort('emitido')}
                    >
                      Emitido <SortIcon col="emitido" />
                    </th>
                    <th
                      className="text-right px-4 py-3 font-medium text-muted-foreground cursor-pointer hover:text-foreground select-none"
                      onClick={() => toggleSort('pagado')}
                    >
                      Pagado <SortIcon col="pagado" />
                    </th>
                    <th
                      className="text-right px-4 py-3 font-medium text-muted-foreground cursor-pointer hover:text-foreground select-none"
                      onClick={() => toggleSort('deuda')}
                    >
                      Pendiente <SortIcon col="deuda" />
                    </th>
                    <th className="text-center px-4 py-3 font-medium text-muted-foreground">Estado</th>
                    <th className="text-center px-4 py-3 font-medium text-muted-foreground">Avisos</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPlayers.length === 0 && (
                    <tr><td colSpan={7} className="text-center py-8 text-muted-foreground">Sin resultados</td></tr>
                  )}
                  {filteredPlayers.map(p => {
                    const pending = p.totalDue - p.totalPaid
                    const rec = localHistory[p.id]
                    const hasDebt = pending > 0
                    const isSending = sendingIds.has(p.id)
                    return (
                      <tr key={p.id} className="border-b border-border last:border-0 hover:bg-muted/20">
                        <td className="px-4 py-3 font-medium">{p.name}</td>
                        <td className="px-4 py-3 text-muted-foreground text-xs">{p.teamName}</td>
                        <td className="px-4 py-3 text-right">{p.hasCuota ? fmt(p.totalDue) : '—'}</td>
                        <td className="px-4 py-3 text-right text-green-600">{p.hasCuota ? fmt(p.totalPaid) : '—'}</td>
                        <td className={`px-4 py-3 text-right ${pending > 0 ? 'text-red-500 font-medium' : 'text-muted-foreground'}`}>
                          {!p.hasCuota ? '—' : pending > 0 ? fmt(pending) : '—'}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <StatusBadge player={p} />
                        </td>
                        <td className="px-4 py-3 text-center">
                          {hasDebt ? (
                            <div className="flex flex-col items-center gap-0.5">
                              <button
                                onClick={() => sendReminder([p.id])}
                                disabled={isSending || isPending}
                                title={rec ? `${rec.count} aviso${rec.count !== 1 ? 's' : ''} · último: ${new Date(rec.lastSent).toLocaleString('es-ES')}` : 'Enviar aviso de deuda'}
                                className="text-muted-foreground hover:text-primary disabled:opacity-40 transition-colors"
                              >
                                {isSending
                                  ? <BellOff className="w-4 h-4 animate-pulse" />
                                  : <Bell className="w-4 h-4" />
                                }
                              </button>
                              {rec && (
                                <span className="text-[10px] text-muted-foreground leading-none">
                                  {rec.count}× {daysSince(rec.lastSent)}
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-muted-foreground/30">—</span>
                          )}
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
