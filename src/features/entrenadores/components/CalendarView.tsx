'use client'

import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { ChevronLeft, ChevronRight } from 'lucide-react'

export interface CalendarEvent {
  id: string
  date: string // YYYY-MM-DD
  time: string | null
  type: string
  opponent: string | null
  teamName: string
  href: string
}

interface Props {
  year: number
  month: number // 0-11
  events: CalendarEvent[]
  teams: Array<{ id: string; name: string }>
  selectedTeam: string
}

const MONTH_LABELS = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]

const DAY_LABELS = ['L', 'M', 'X', 'J', 'V', 'S', 'D']

const TYPE_STYLES: Record<string, { bg: string; fg: string; label: string }> = {
  training: { bg: 'bg-violet-100', fg: 'text-violet-800', label: 'Entreno' },
  match: { bg: 'bg-red-100', fg: 'text-red-800', label: 'Partido' },
  friendly: { bg: 'bg-amber-100', fg: 'text-amber-800', label: 'Amistoso' },
  futsal: { bg: 'bg-blue-100', fg: 'text-blue-800', label: 'Futsal' },
}

function toKey(y: number, m: number): string {
  return `${y}-${String(m + 1).padStart(2, '0')}`
}

export function CalendarView({ year, month, events, teams, selectedTeam }: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const first = new Date(year, month, 1)
  const last = new Date(year, month + 1, 0)
  const startOffset = (first.getDay() + 6) % 7 // lunes=0

  const cells: Array<Date> = []
  for (let i = 0; i < startOffset; i++) {
    cells.push(new Date(year, month, 1 - (startOffset - i)))
  }
  for (let d = 1; d <= last.getDate(); d++) {
    cells.push(new Date(year, month, d))
  }
  while (cells.length % 7 !== 0) {
    const lastCell = cells[cells.length - 1]
    cells.push(new Date(lastCell.getFullYear(), lastCell.getMonth(), lastCell.getDate() + 1))
  }

  const eventsByDay: Record<string, CalendarEvent[]> = {}
  for (const e of events) {
    if (!eventsByDay[e.date]) eventsByDay[e.date] = []
    eventsByDay[e.date].push(e)
  }
  for (const k of Object.keys(eventsByDay)) {
    eventsByDay[k].sort((a, b) => (a.time ?? '').localeCompare(b.time ?? ''))
  }

  const prev = toKey(year, month - 1)
  const next = toKey(year, month + 1)
  const todayKey = (() => {
    const t = new Date()
    return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`
  })()

  function buildHref(monthStr: string, team: string = selectedTeam): string {
    const sp = new URLSearchParams(searchParams.toString())
    sp.set('month', monthStr)
    if (team) sp.set('team', team)
    else sp.delete('team')
    return `?${sp.toString()}`
  }

  function handleTeamChange(e: React.ChangeEvent<HTMLSelectElement>) {
    router.push(buildHref(toKey(year, month), e.target.value))
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <Link href={buildHref(prev)} className="p-2 rounded-lg border hover:bg-gray-50">
            <ChevronLeft className="w-4 h-4" />
          </Link>
          <h2 className="text-xl font-semibold capitalize min-w-[180px] text-center">
            {MONTH_LABELS[month]} {year}
          </h2>
          <Link href={buildHref(next)} className="p-2 rounded-lg border hover:bg-gray-50">
            <ChevronRight className="w-4 h-4" />
          </Link>
          <Link
            href={buildHref(toKey(new Date().getFullYear(), new Date().getMonth()))}
            className="ml-2 text-xs px-3 py-1.5 rounded-lg border hover:bg-gray-50"
          >
            Hoy
          </Link>
        </div>

        <div className="flex items-center gap-3">
          <select
            value={selectedTeam}
            onChange={handleTeamChange}
            className="input w-auto text-sm"
          >
            <option value="">Todos los equipos</option>
            {teams.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>

          <div className="hidden sm:flex items-center gap-3 text-xs">
            {Object.entries(TYPE_STYLES).map(([k, s]) => (
              <div key={k} className="flex items-center gap-1.5">
                <span className={`w-3 h-3 rounded ${s.bg}`} />
                <span className="text-gray-600">{s.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Grid */}
      <div className="bg-white rounded-xl border overflow-hidden">
        {/* Day headers */}
        <div className="grid grid-cols-7 bg-gray-50 border-b">
          {DAY_LABELS.map((d) => (
            <div key={d} className="p-2 text-xs font-semibold text-gray-600 text-center">
              {d}
            </div>
          ))}
        </div>

        {/* Cells */}
        <div className="grid grid-cols-7">
          {cells.map((d, idx) => {
            const inMonth = d.getMonth() === month
            const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
            const isToday = key === todayKey
            const dayEvents = eventsByDay[key] ?? []
            return (
              <div
                key={idx}
                className={`min-h-[110px] border-r border-b p-1.5 ${
                  inMonth ? 'bg-white' : 'bg-gray-50/50'
                } ${(idx + 1) % 7 === 0 ? 'border-r-0' : ''}`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span
                    className={`text-xs font-medium ${
                      isToday
                        ? 'bg-blue-600 text-white rounded-full w-5 h-5 flex items-center justify-center'
                        : inMonth
                          ? 'text-gray-900'
                          : 'text-gray-400'
                    }`}
                  >
                    {d.getDate()}
                  </span>
                </div>
                <div className="space-y-1">
                  {dayEvents.slice(0, 4).map((e) => {
                    const style = TYPE_STYLES[e.type] ?? { bg: 'bg-gray-100', fg: 'text-gray-800', label: e.type }
                    return (
                      <Link
                        key={e.id}
                        href={e.href}
                        className={`block ${style.bg} ${style.fg} text-[10px] leading-tight rounded px-1.5 py-0.5 hover:opacity-80 truncate`}
                        title={`${e.teamName}${e.opponent ? ` vs ${e.opponent}` : ''}${e.time ? ` · ${e.time}` : ''}`}
                      >
                        {e.time && <span className="font-mono font-semibold mr-1">{e.time}</span>}
                        {e.teamName}
                        {e.opponent ? ` · ${e.opponent}` : ''}
                      </Link>
                    )
                  })}
                  {dayEvents.length > 4 && (
                    <p className="text-[10px] text-gray-500 px-1">+{dayEvents.length - 4} más</p>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
