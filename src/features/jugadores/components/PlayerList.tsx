'use client'

import { useState, useMemo, useRef, useEffect } from 'react'
import Link from 'next/link'
import { Search, Plus, ChevronRight, ChevronDown, X, Download, FileText } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import type { Player } from '@/types/database.types'
import { RoleGuard } from '@/components/shared/RoleGuard'
import { driveImageUrl } from '@/lib/utils/drive'

const STATUS_LABELS: Record<string, string> = {
  active: 'Activo',
  injured: 'Lesionado',
  inactive: 'Inactivo',
  low: 'Baja',
}

const STATUS_COLORS: Record<string, string> = {
  active: 'badge-success',
  injured: 'badge-warning',
  inactive: 'badge-muted',
  low: 'badge-destructive',
}

const POSITIONS = ['Portero', 'Defensa', 'Centrocampista', 'Delantero']

interface PlayerWithTeam extends Player {
  teams?: { id: string; name: string; categories?: { name: string } | null } | null
  nextTeam?: { id: string; name: string } | null
}

function calcAge(birthDate: string | null): number | null {
  if (!birthDate) return null
  const today = new Date()
  const birth = new Date(birthDate)
  let age = today.getFullYear() - birth.getFullYear()
  const m = today.getMonth() - birth.getMonth()
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--
  return age
}

// Multi-select dropdown component
function MultiSelectDropdown({
  options,
  selected,
  onChange,
  placeholder,
}: {
  options: { value: string; label: string }[]
  selected: string[]
  onChange: (values: string[]) => void
  placeholder: string
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    if (open) document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const toggle = (value: string) => {
    onChange(selected.includes(value)
      ? selected.filter(v => v !== value)
      : [...selected, value])
  }

  const label = selected.length === 0
    ? placeholder
    : selected.length === 1
      ? options.find(o => o.value === selected[0])?.label ?? selected[0]
      : `${selected.length} seleccionados`

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className={cn(
          'input flex items-center justify-between gap-2 w-auto min-w-40 text-sm',
          selected.length > 0 && 'border-primary/60'
        )}
      >
        <span className="truncate">{label}</span>
        <div className="flex items-center gap-1 shrink-0">
          {selected.length > 0 && (
            <button
              type="button"
              onClick={e => { e.stopPropagation(); onChange([]) }}
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="w-3 h-3" />
            </button>
          )}
          <ChevronDown className="w-3 h-3 text-muted-foreground" />
        </div>
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-1 z-50 bg-background border rounded-md shadow-lg min-w-48 max-h-56 overflow-y-auto">
          {options.map(opt => (
            <label
              key={opt.value}
              className="flex items-center gap-2 px-3 py-2 hover:bg-muted cursor-pointer"
            >
              <input
                type="checkbox"
                checked={selected.includes(opt.value)}
                onChange={() => toggle(opt.value)}
                className="cursor-pointer"
              />
              <span className="text-sm">{opt.label}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  )
}

function downloadCsv(rows: Record<string, unknown>[], filename: string) {
  if (!rows.length) return
  const headers = Object.keys(rows[0])
  const csv = [headers, ...rows.map(r => headers.map(h => {
    const v = r[h] ?? ''
    const s = String(v)
    return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s
  }))].map(row => row.join(',')).join('\n')
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = filename
  a.click()
  URL.revokeObjectURL(a.href)
}

interface PayState { due: number; paid: number }
type PaymentsByPlayer = Record<string, Record<string, PayState>>

/** Estado de pago de un jugador para una temporada concreta. */
function getPaymentStatus(playerId: string, season: string, payments: PaymentsByPlayer):
  { label: 'Al día' | 'Parcial' | 'Sin pagar' | 'Sin cuotas'; due: number; paid: number; pending: number } {
  const s = payments[playerId]?.[season]
  if (!s || s.due === 0) return { label: 'Sin cuotas', due: 0, paid: 0, pending: 0 }
  const pending = Math.max(0, s.due - s.paid)
  if (pending <= 0.01) return { label: 'Al día', due: s.due, paid: s.paid, pending: 0 }
  if (s.paid > 0.01) return { label: 'Parcial', due: s.due, paid: s.paid, pending }
  return { label: 'Sin pagar', due: s.due, paid: 0, pending }
}

export function PlayerList({
  players,
  teams,
  nextTeams = [],
  currentSeason = '2025/26',
  nextSeason = '2026/27',
  activeSanctions = {},
  paymentsByPlayer = {},
  clubName = '',
  clubLogoUrl = null,
  clubPrimaryColor = '#EC4899',
}: {
  players: PlayerWithTeam[]
  teams: { id: string; name: string }[]
  nextTeams?: { id: string; name: string }[]
  currentSeason?: string
  nextSeason?: string
  activeSanctions?: Record<string, number>
  paymentsByPlayer?: PaymentsByPlayer
  clubName?: string
  clubLogoUrl?: string | null
  clubPrimaryColor?: string
}) {
  const [search, setSearch] = useState('')
  const [filterTeams, setFilterTeams] = useState<string[]>([])
  const [filterStatuses, setFilterStatuses] = useState<string[]>([])
  const [filterPositions, setFilterPositions] = useState<string[]>([])
  const [filterYears, setFilterYears] = useState<string[]>([])
  const [view, setView] = useState<'cards' | 'table'>('cards')
  const [selectedSeason, setSelectedSeason] = useState<string>(currentSeason)

  const isNextSeason = selectedSeason === nextSeason
  // Equipos activos según la temporada seleccionada
  const activeTeams = isNextSeason ? nextTeams : teams

  // Extract unique birth years from players
  const birthYears = useMemo(() => {
    const years = players
      .map(p => p.birth_date ? new Date(p.birth_date).getFullYear() : null)
      .filter((y): y is number => y !== null)
    return [...new Set(years)].sort((a, b) => b - a)
  }, [players])

  const filtered = useMemo(() => {
    return players.filter((p) => {
      // Vista 26/27 → solo jugadores con next_team_id (confirmados próxima temporada)
      if (isNextSeason && !p.next_team_id) return false

      const fullName = `${p.first_name} ${p.last_name}`.toLowerCase()
      const matchSearch = !search || fullName.includes(search.toLowerCase()) ||
        p.dni?.toLowerCase().includes(search.toLowerCase()) ||
        p.tutor_name?.toLowerCase().includes(search.toLowerCase())

      // Filtro de equipo según la temporada
      const relevantTeamId = isNextSeason ? p.next_team_id : p.team_id
      const matchTeam = filterTeams.length === 0 || (relevantTeamId !== null && filterTeams.includes(relevantTeamId))

      const matchStatus = filterStatuses.length === 0 || filterStatuses.includes(p.status)
      const matchPos = filterPositions.length === 0 || (p.position !== null && filterPositions.includes(p.position))
      const matchYear = filterYears.length === 0 || (
        p.birth_date !== null && filterYears.includes(
          new Date(p.birth_date).getFullYear().toString()
        )
      )
      return matchSearch && matchTeam && matchStatus && matchPos && matchYear
    })
  }, [players, search, filterTeams, filterStatuses, filterPositions, filterYears, isNextSeason])

  const activeFilters = filterTeams.length + filterStatuses.length + filterPositions.length + filterYears.length

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Libro Maestro de Jugadores</h2>
          <p className="text-sm text-muted-foreground">
            {filtered.length} jugadores{isNextSeason ? ` confirmados ${nextSeason}` : ''}
            {activeFilters > 0 && <span className="text-primary"> (filtrado)</span>}
          </p>
        </div>
        <div className="flex gap-2 items-center">
          {/* Selector de temporada */}
          <select
            value={selectedSeason}
            onChange={e => { setSelectedSeason(e.target.value); setFilterTeams([]) }}
            className="input text-sm font-medium"
          >
            <option value={currentSeason}>Temporada {currentSeason}</option>
            <option value={nextSeason}>Temporada {nextSeason}</option>
          </select>

          <button
            onClick={async () => {
              const fmtDate = (d: string | null) => {
                if (!d) return ''
                const [y, m, day] = d.slice(0, 10).split('-')
                return y && m && day ? `${day}/${m}/${y}` : d
              }
              const rows = filtered.map(p => {
                const pay = getPaymentStatus(p.id, selectedSeason, paymentsByPlayer)
                return {
                  Nombre: p.first_name ?? '',
                  Apellidos: p.last_name ?? '',
                  'DNI/NIE': p.dni ?? '',
                  'Fecha nacimiento': fmtDate(p.birth_date),
                  Edad: calcAge(p.birth_date) ?? '',
                  Nacionalidad: p.nationality ?? '',
                  'Tipo licencia': p.license_type ?? '',
                  Equipo: isNextSeason ? (p.nextTeam?.name ?? '') : (p.teams?.name ?? ''),
                  Dorsal: p.dorsal_number ?? '',
                  Posición: p.position ?? '',
                  'Pie dominante': p.dominant_foot ?? '',
                  Estado: STATUS_LABELS[p.status] ?? p.status,
                  'Estado pago': pay.label,
                  'Cuota total (€)': pay.due,
                  'Pagado (€)': pay.paid,
                  'Pendiente (€)': pay.pending,
                  'Tutor 1': p.tutor_name ?? '',
                  'Email tutor 1': p.tutor_email ?? '',
                  'Tel. tutor 1': p.tutor_phone ?? '',
                  'Tutor 2': p.tutor2_name ?? '',
                  'Email tutor 2': p.tutor2_email ?? '',
                  Notas: p.notes ?? '',
                }
              })
              const XLSX = await import('xlsx')
              const wb = XLSX.utils.book_new()
              const ws = XLSX.utils.json_to_sheet(rows)
              if (rows.length > 0) {
                ws['!cols'] = Object.keys(rows[0]).map(k => ({ wch: Math.max(12, k.length + 2) }))
              }
              XLSX.utils.book_append_sheet(wb, ws, `Jugadores ${selectedSeason.replace('/', '-')}`)
              XLSX.writeFile(wb, `Jugadores_${selectedSeason.replace('/', '-')}_${new Date().toISOString().slice(0, 10)}.xlsx`)
            }}
            className="btn-secondary gap-2 flex items-center text-sm"
            title={`Exportar a Excel — temporada ${selectedSeason}`}
          >
            <Download className="w-4 h-4" />
            Excel
          </button>
          <button
            onClick={async () => {
              const { generatePlayerListPdf } = await import('@/lib/pdf/playerListPdf')
              const blob = await generatePlayerListPdf({
                clubName, clubLogoUrl, clubPrimaryColor,
                season: selectedSeason,
                players: filtered.map(p => ({
                  id: p.id,
                  fullName: `${p.first_name ?? ''} ${p.last_name ?? ''}`.trim(),
                  dni: p.dni ?? '',
                  birthDate: p.birth_date,
                  teamName: isNextSeason ? (p.nextTeam?.name ?? '') : (p.teams?.name ?? ''),
                  position: p.position ?? '',
                  status: STATUS_LABELS[p.status] ?? p.status,
                  payment: getPaymentStatus(p.id, selectedSeason, paymentsByPlayer),
                })),
              })
              const url = URL.createObjectURL(blob)
              const a = document.createElement('a')
              a.href = url
              a.download = `Listado_${(clubName || 'Club').replace(/\s+/g, '_')}_${selectedSeason.replace('/', '-')}.pdf`
              a.click()
              URL.revokeObjectURL(url)
            }}
            className="btn-secondary gap-2 flex items-center text-sm"
            title={`Exportar PDF corporativo — temporada ${selectedSeason}`}
          >
            <FileText className="w-4 h-4" />
            PDF
          </button>
          <RoleGuard roles={['admin', 'direccion', 'coordinador', 'director_deportivo']}>
            <Link href="/jugadores/nuevo" className="btn-primary gap-2 flex items-center">
              <Plus className="w-4 h-4" />
              Nuevo jugador
            </Link>
          </RoleGuard>
        </div>
      </div>

      {/* Filters */}
      <div className="card p-4 flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            className="input pl-9 w-full"
            placeholder="Buscar por nombre, DNI o tutor..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <MultiSelectDropdown
          options={activeTeams.map(t => ({ value: t.id, label: t.name }))}
          selected={filterTeams}
          onChange={setFilterTeams}
          placeholder="Todos los equipos"
        />

        <MultiSelectDropdown
          options={Object.entries(STATUS_LABELS).map(([k, v]) => ({ value: k, label: v }))}
          selected={filterStatuses}
          onChange={setFilterStatuses}
          placeholder="Todos los estados"
        />

        <MultiSelectDropdown
          options={POSITIONS.map(p => ({ value: p, label: p }))}
          selected={filterPositions}
          onChange={setFilterPositions}
          placeholder="Todas las posiciones"
        />

        <MultiSelectDropdown
          options={birthYears.map(y => ({ value: y.toString(), label: y.toString() }))}
          selected={filterYears}
          onChange={setFilterYears}
          placeholder="Año nacimiento"
        />

        {activeFilters > 0 && (
          <button
            onClick={() => {
              setFilterTeams([])
              setFilterStatuses([])
              setFilterPositions([])
              setFilterYears([])
            }}
            className="text-xs text-muted-foreground hover:text-destructive flex items-center gap-1 transition-colors"
          >
            <X className="w-3 h-3" /> Limpiar filtros
          </button>
        )}

        <div className="flex rounded-md border overflow-hidden ml-auto">
          <button
            onClick={() => setView('cards')}
            className={cn('px-3 py-1.5 text-sm transition-colors', view === 'cards' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted')}
          >
            Tarjetas
          </button>
          <button
            onClick={() => setView('table')}
            className={cn('px-3 py-1.5 text-sm transition-colors', view === 'table' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted')}
          >
            Tabla
          </button>
        </div>
      </div>

      {/* Players */}
      {view === 'cards' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map((player) => (
            <PlayerCard
              key={player.id}
              player={player}
              sanctionedMatches={activeSanctions[player.id]}
              displayTeam={isNextSeason ? player.nextTeam : player.teams}
            />
          ))}
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Jugador</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                    Equipo {isNextSeason ? <span className="text-xs text-primary">({nextSeason})</span> : ''}
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Posición</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Edad</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Estado</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Tutor</th>
                  <th className="w-8" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((player) => {
                  const age = calcAge(player.birth_date)
                  const teamName = isNextSeason ? (player.nextTeam?.name ?? '—') : (player.teams?.name ?? '—')
                  return (
                    <tr key={player.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3">
                        <Link href={`/jugadores/${player.id}`} className="flex items-center gap-3 hover:underline">
                          <PlayerAvatar player={player} size="sm" />
                          <span className="font-medium">{player.first_name} {player.last_name}</span>
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {teamName}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{player.position ?? '—'}</td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {age !== null ? `${age} años` : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          <span className={cn('badge', STATUS_COLORS[player.status])}>
                            {STATUS_LABELS[player.status] ?? player.status}
                          </span>
                          {activeSanctions[player.id] !== undefined && (
                            <span className="badge badge-destructive">
                              Sancionado ({activeSanctions[player.id]}p)
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">{player.tutor_name ?? '—'}</td>
                      <td className="px-4 py-3">
                        <Link href={`/jugadores/${player.id}`}>
                          <ChevronRight className="w-4 h-4 text-muted-foreground" />
                        </Link>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          {filtered.length === 0 && (
            <div className="py-12 text-center text-muted-foreground">
              No se encontraron jugadores
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function PlayerAvatar({ player, size = 'md' }: { player: PlayerWithTeam; size?: 'sm' | 'md' | 'lg' }) {
  const sizes = { sm: 'w-8 h-8 text-xs', md: 'w-12 h-12 text-sm', lg: 'w-20 h-20 text-xl' }
  const [imgError, setImgError] = useState(false)

  const initials = (
    <div className={cn(sizes[size], 'rounded-full bg-primary/10 text-primary flex items-center justify-center font-semibold')}>
      {player.first_name.charAt(0)}{player.last_name.charAt(0)}
    </div>
  )

  if (player.photo_url && !imgError) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={driveImageUrl(player.photo_url)}
        alt={`${player.first_name} ${player.last_name}`}
        className={cn(sizes[size], 'rounded-full object-cover')}
        onError={() => setImgError(true)}
      />
    )
  }

  return initials
}

function PlayerCard({
  player,
  sanctionedMatches,
  displayTeam,
}: {
  player: PlayerWithTeam
  sanctionedMatches?: number
  displayTeam?: { id: string; name: string } | null
}) {
  const age = calcAge(player.birth_date)
  return (
    <Link href={`/jugadores/${player.id}`}>
      <div className="card p-4 hover:shadow-md transition-shadow cursor-pointer group">
        <div className="flex items-start gap-3">
          <div className="relative">
            <PlayerAvatar player={player} size="md" />
            {player.dorsal_number && (
              <span className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center">
                {player.dorsal_number}
              </span>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm truncate group-hover:text-primary transition-colors">
              {player.first_name} {player.last_name}
            </p>
            <p className="text-xs text-muted-foreground truncate">
              {displayTeam?.name ?? player.teams?.name ?? 'Sin equipo'}
            </p>
            {age !== null && (
              <p className="text-xs text-muted-foreground">{age} años</p>
            )}
            <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
              {player.position && (
                <span className="badge-muted">{player.position}</span>
              )}
              <span className={cn('badge', STATUS_COLORS[player.status])}>
                {STATUS_LABELS[player.status]}
              </span>
              {sanctionedMatches !== undefined && (
                <span className="badge badge-destructive">
                  Sancionado ({sanctionedMatches}p)
                </span>
              )}
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>
        {player.tutor_name && (
          <p className="text-xs text-muted-foreground mt-2 truncate">
            Tutor: {player.tutor_name}
          </p>
        )}
      </div>
    </Link>
  )
}
