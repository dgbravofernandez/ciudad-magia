'use client'
import { useState } from 'react'
import { Printer, Download, Plus, X, Shield } from 'lucide-react'

interface Player {
  id: string
  first_name: string
  last_name: string
  dorsal_number: number | null
  position: string | null
  photo_url: string | null
}

interface Props {
  matchId: string
  teamName: string
  opponent: string
  matchDate: string
  location: string
  players: Player[]
  clubName: string
  clubColor: string
}

const POSITION_ABBR: Record<string, string> = {
  'Portero': 'POR',
  'Defensa': 'DEF',
  'Centrocampista': 'MED',
  'Delantero': 'DEL',
}

export function Convocatoria({ matchId, teamName, opponent, matchDate, matchTime, location, players, clubName, clubColor }: Props & { matchTime?: string }) {
  const [selected, setSelected] = useState<Set<string>>(new Set(players.slice(0, 16).map(p => p.id)))
  const [notes, setNotes] = useState('')

  const selectedPlayers = players.filter(p => selected.has(p.id)).sort((a, b) => (a.dorsal_number ?? 99) - (b.dorsal_number ?? 99))

  function toggle(id: string) {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function handlePrint() {
    window.print()
  }

  return (
    <div className="space-y-6">
      {/* Controls - hidden on print */}
      <div className="print:hidden space-y-4">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="font-semibold text-gray-900 mb-3">Seleccionar convocados ({selected.size})</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
            {players.map(p => (
              <button
                key={p.id}
                onClick={() => toggle(p.id)}
                className={`flex items-center gap-2 p-2 rounded-lg border text-sm transition-all ${selected.has(p.id) ? 'border-blue-500 bg-blue-50 text-blue-800' : 'border-gray-200 text-gray-500 hover:border-gray-300'}`}
              >
                <span className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0" style={{ backgroundColor: selected.has(p.id) ? clubColor : '#e5e7eb', color: selected.has(p.id) ? '#000' : '#6b7280' }}>
                  {p.dorsal_number ?? '—'}
                </span>
                <span className="truncate font-medium">{p.last_name}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={handlePrint} className="flex items-center gap-2 px-5 py-2.5 text-white rounded-lg text-sm font-medium" style={{ backgroundColor: 'var(--color-primary)', color: '#000' }}>
            <Printer className="w-4 h-4" /> Imprimir / Guardar PDF
          </button>
        </div>
      </div>

      {/* ── PRINTABLE CONVOCATORIA ── */}
      <div className="bg-white rounded-2xl border-2 border-gray-200 overflow-hidden print:border-0 print:rounded-none" id="convocatoria-print">
        {/* Header */}
        <div className="p-6 text-white" style={{ backgroundColor: '#111111' }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Shield className="w-12 h-12 opacity-80" style={{ color: clubColor }} />
              <div>
                <h1 className="text-2xl font-black tracking-tight" style={{ color: clubColor }}>{clubName}</h1>
                <p className="text-gray-400 text-sm uppercase tracking-widest">Convocatoria Oficial</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-lg font-bold text-white">{teamName}</p>
              <p className="text-gray-400 text-sm">{new Date(matchDate).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
            </div>
          </div>
          {/* Match info bar */}
          <div className="mt-5 flex flex-wrap gap-6 pt-5 border-t border-white/10">
            <div>
              <p className="text-gray-500 text-xs uppercase tracking-wide">Rival</p>
              <p className="text-white font-semibold">{opponent}</p>
            </div>
            {matchTime && <div>
              <p className="text-gray-500 text-xs uppercase tracking-wide">Hora</p>
              <p className="text-white font-semibold">{matchTime}</p>
            </div>}
            <div>
              <p className="text-gray-500 text-xs uppercase tracking-wide">Campo</p>
              <p className="text-white font-semibold">{location}</p>
            </div>
            <div>
              <p className="text-gray-500 text-xs uppercase tracking-wide">Convocados</p>
              <p className="font-bold text-lg" style={{ color: clubColor }}>{selectedPlayers.length}</p>
            </div>
          </div>
        </div>

        {/* Players grid */}
        <div className="p-6">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {selectedPlayers.map((p, i) => (
              <div key={p.id} className="flex items-center gap-3 p-3 rounded-xl border-2" style={{ borderColor: i === 0 ? clubColor : '#f3f4f6' }}>
                {/* Jersey number */}
                <div className="w-10 h-12 rounded-lg flex items-center justify-center text-lg font-black flex-shrink-0 relative" style={{ backgroundColor: '#111111', color: clubColor }}>
                  {p.dorsal_number ?? '?'}
                  {/* Jersey silhouette decoration */}
                  <div className="absolute inset-0 opacity-10" style={{ background: 'linear-gradient(135deg, transparent 30%, rgba(255,255,255,0.3) 50%, transparent 70%)' }} />
                </div>
                <div className="min-w-0">
                  <p className="font-bold text-gray-900 text-sm leading-tight truncate">{p.last_name.toUpperCase()}</p>
                  <p className="text-gray-500 text-xs truncate">{p.first_name}</p>
                  {p.position && <span className="text-xs font-mono" style={{ color: '#9ca3af' }}>{POSITION_ABBR[p.position] ?? p.position.slice(0, 3).toUpperCase()}</span>}
                </div>
              </div>
            ))}
          </div>

          {/* Footer */}
          <div className="mt-6 pt-4 border-t border-gray-100 flex items-center justify-between text-xs text-gray-400">
            <span>{clubName} © {new Date().getFullYear()}</span>
            <div className="flex gap-1">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: i < 2 ? clubColor : '#e5e7eb' }} />
              ))}
            </div>
            <span>Documento interno — No distribuir</span>
          </div>
        </div>
      </div>
    </div>
  )
}
