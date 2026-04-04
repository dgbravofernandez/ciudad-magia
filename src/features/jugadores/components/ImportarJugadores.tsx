'use client'

import { useState, useRef } from 'react'
import { Upload, FileSpreadsheet, CheckCircle, AlertCircle, X, Download, Users } from 'lucide-react'
import { toast } from 'sonner'
import { read, utils } from 'xlsx'
import { importPlayers, deleteAllPlayers } from '@/features/jugadores/actions/player.actions'

// ─── License → Category mapping ─────────────────────────────────────────────
const LICENSE_CATEGORY: Record<string, { category: string; gender: 'M' | 'F' }> = {
  'A':   { category: 'Aficionado',    gender: 'M' },
  'J':   { category: 'Juvenil',       gender: 'M' },
  'C':   { category: 'Cadete',        gender: 'M' },
  'I':   { category: 'Infantil',      gender: 'M' },
  'AL':  { category: 'Alevín',        gender: 'M' },
  'B':   { category: 'Benjamín',      gender: 'M' },
  'PB':  { category: 'Prebenjamín',   gender: 'M' },
  'DB':  { category: 'Debutante',     gender: 'M' },
  'db':  { category: 'Debutante',     gender: 'M' },
  'FA':  { category: 'Aficionado',    gender: 'F' },
  'FJ':  { category: 'Juvenil',       gender: 'F' },
  'FC':  { category: 'Cadete',        gender: 'F' },
  'FI':  { category: 'Infantil',      gender: 'F' },
  'FAL': { category: 'Alevín',        gender: 'F' },
  'FB':  { category: 'Benjamín',      gender: 'F' },
  'FPB': { category: 'Prebenjamín',   gender: 'F' },
  'FDB': { category: 'Debutante',     gender: 'F' },
}

// Staff license types (entrenadores, delegados, etc.) — skipped in player import
// E=Entrenador, E2=2º entrenador, Del=Delegado, Ay=Ayudante sanitario, EM=Encargado material
const SKIP_LICENSES = new Set(['DEL', 'Del', 'E', 'E2', 'EM', 'AUX', 'Ay', 'AY', 'T', 'TEC', 'ARB'])

export interface ParsedPlayer {
  dni: string
  first_name: string
  last_name: string
  date_of_birth: string | null
  license_type: string
  category: string
  gender: 'M' | 'F'
  team_letter: string          // A, B, C…
  team_label: string           // "Cadete B", "Alevín B F7"…
  format: string | null        // F7, F11, null
  status: 'new' | 'duplicate'
  mapped_team_id: string | null
}

interface Props {
  clubId: string
  teams: { id: string; name: string }[]
}

// ─── Helpers ────────────────────────────────────────────────────────────────
function extractTeamLetter(clubName: string): string {
  // Match last quoted letter: E.F. CIUDAD DE GETAFE "B" → B
  const quoted = clubName.match(/"([A-Z])"\s*$/i)
  if (quoted) return quoted[1].toUpperCase()
  // Match trailing space + letter: ... GETAFE B → B
  const trailing = clubName.match(/\s+([A-Z])\s*$/i)
  if (trailing) return trailing[1].toUpperCase()
  return 'A'
}

function parseName(raw: string): { first_name: string; last_name: string } {
  // "APELLIDO1 APELLIDO2, NOMBRE" or "APELLIDOS, NOMBRE SEGUNDO"
  const comma = raw.indexOf(',')
  if (comma === -1) return { last_name: toTitle(raw), first_name: '' }
  const last = raw.slice(0, comma).trim()
  const first = raw.slice(comma + 1).trim()
  return { last_name: toTitle(last), first_name: toTitle(first) }
}

function toTitle(s: string): string {
  return s.toLowerCase().replace(/\b\w/g, c => c.toUpperCase())
}

function parseDate(raw: unknown): string | null {
  if (!raw) return null
  // JS Date object (when cellDates:true)
  if (raw instanceof Date) {
    const y = raw.getFullYear()
    const m = String(raw.getMonth() + 1).padStart(2, '0')
    const d = String(raw.getDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
  }
  // Excel serial number — convert manually
  if (typeof raw === 'number') {
    // Excel epoch: Jan 1 1900 = serial 1 (with leap year bug, serial 60 skipped)
    const date = new Date(Math.round((raw - 25569) * 86400 * 1000))
    const y = date.getUTCFullYear()
    const m = String(date.getUTCMonth() + 1).padStart(2, '0')
    const d = String(date.getUTCDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
  }
  // String formats: M/D/YY or DD/MM/YYYY or YYYY-MM-DD
  if (typeof raw === 'string') {
    const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})/)
    if (iso) return raw.slice(0, 10)
    const parts = raw.split('/')
    if (parts.length === 3) {
      const [a, b, c] = parts.map(Number)
      // If first part > 12 it's DD/MM/YYYY, else M/D/YY
      if (a > 12) {
        const year = c < 100 ? (c > 30 ? 1900 + c : 2000 + c) : c
        return `${year}-${String(b).padStart(2,'0')}-${String(a).padStart(2,'0')}`
      } else {
        const year = c < 100 ? (c > 30 ? 1900 + c : 2000 + c) : c
        return `${year}-${String(a).padStart(2,'0')}-${String(b).padStart(2,'0')}`
      }
    }
  }
  return null
}

// Returns birth year from a parsed ISO date string
function birthYear(dob: string | null): number | null {
  if (!dob) return null
  return parseInt(dob.slice(0, 4))
}

// Alevín: born in current season's 1st year → F7, 2nd year → F11
// Season 2025/26: 1st year = 2015, 2nd year = 2014
// We detect by: the YOUNGER cohort (higher year) = F7, OLDER cohort (lower year) = F11
function alevinFormat(dob: string | null, allAlevinDobs: (string | null)[]): 'F7' | 'F11' {
  const year = birthYear(dob)
  if (!year) return 'F7'
  const years = allAlevinDobs.map(birthYear).filter((y): y is number => y !== null)
  const maxYear = Math.max(...years)  // youngest = 1st year = F7
  return year >= maxYear ? 'F7' : 'F11'
}

// ─── Main component ──────────────────────────────────────────────────────────
export function ImportarJugadores({ clubId, teams }: Props) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [players, setPlayers] = useState<ParsedPlayer[]>([])
  const [skipped, setSkipped] = useState<number>(0)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [importing, setImporting] = useState(false)
  const [clearing, setClearing] = useState(false)
  const [step, setStep] = useState<'upload' | 'preview' | 'done'>('upload')

  // Build quick lookup: "Cadete B" → team_id
  function findTeamId(category: string, letter: string): string | null {
    const labelFull = `${category} ${letter}`.toLowerCase()   // "Cadete A", "Cadete B"
    const labelNoLetter = category.toLowerCase()              // "Cadete" (fallback)
    const found = teams.find(t => {
      const tn = t.name.toLowerCase()
      return tn === labelFull || tn === labelNoLetter
    })
    return found?.id ?? null
  }

  function handleFile(file: File) {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const wb = read(e.target!.result, { type: 'array', cellDates: true })
        const ws = wb.Sheets[wb.SheetNames[0]]

        // The file has a title in row 1, headers in row 2
        const rows: Record<string, unknown>[] = utils.sheet_to_json(ws, {
          header: 1,
          defval: '',
          raw: true,
        }) as Record<string, unknown>[]

        // Find the header row (contains "Código" or "Nombre")
        let headerIdx = -1
        for (let i = 0; i < Math.min(5, rows.length); i++) {
          const row = rows[i] as unknown[]
          if (row.some(c => String(c).toLowerCase().includes('código') || String(c).toLowerCase().includes('nombre'))) {
            headerIdx = i
            break
          }
        }
        if (headerIdx === -1) headerIdx = 1

        const headerRow = rows[headerIdx] as unknown[]
        // Map column names to indices
        const colIdx: Record<string, number> = {}
        headerRow.forEach((h, i) => {
          const name = String(h).toLowerCase().trim()
          if (name.includes('código') || name.includes('codigo') || name.includes('dni')) colIdx.dni = i
          else if (name.includes('nombre')) colIdx.nombre = i
          else if (name.includes('equipo')) colIdx.equipo = i
          else if (name.includes('licencia')) colIdx.licencia = i
          else if (name.includes('nacimiento')) colIdx.nacimiento = i
          else if (name.includes('estado')) colIdx.estado = i
          else if (name.includes('final')) colIdx.final = i
        })

        const parsed: ParsedPlayer[] = []
        let skippedCount = 0

        for (let i = headerIdx + 1; i < rows.length; i++) {
          const row = rows[i] as unknown[]
          const dni = String(row[colIdx.dni] ?? '').trim()

          // Skip empty or sub-header rows
          if (!dni || dni === 'Código' || dni.toLowerCase() === 'código') continue

          const estado = String(row[colIdx.estado] ?? '').trim()
          // Only import active licenses
          if (!estado.toLowerCase().includes('activa')) { skippedCount++; continue }

          const licencia = String(row[colIdx.licencia] ?? '').trim().toUpperCase()
          // Skip non-player licenses
          if (SKIP_LICENSES.has(licencia)) { skippedCount++; continue }

          const catInfo = LICENSE_CATEGORY[licencia] ?? LICENSE_CATEGORY[licencia.toLowerCase()]
          if (!catInfo) { skippedCount++; continue }

          const clubName = String(row[colIdx.equipo] ?? '').trim()
          const teamLetter = extractTeamLetter(clubName)

          const { first_name, last_name } = parseName(String(row[colIdx.nombre] ?? ''))
          const dob = parseDate(row[colIdx.nacimiento])

          parsed.push({
            dni,
            first_name,
            last_name,
            date_of_birth: dob,
            license_type: licencia,
            category: catInfo.category,
            gender: catInfo.gender,
            team_letter: teamLetter,
            team_label: '',   // computed below
            format: null,     // computed below
            status: 'new',
            mapped_team_id: null, // computed below
          })
        }

        // ── Post-process: compute F7/F11 for Alevín masculino only ──
        // Group ONLY masculino alevín by team_letter to detect cohorts
        const alevinGroups: Record<string, string[]> = {}
        for (const p of parsed) {
          if (p.license_type === 'AL') {  // only masculino
            const key = p.team_letter
            if (!alevinGroups[key]) alevinGroups[key] = []
            alevinGroups[key].push(p.date_of_birth)
          }
        }

        for (const p of parsed) {
          const isAlevinMasc = p.license_type === 'AL'
          // FAL (femenino) no tiene F7/F11 — se deja como está
          const femSuffix = p.gender === 'F' ? ' Fem.' : ''
          let format: string | null = null
          let teamLabel: string

          if (isAlevinMasc) {
            format = alevinFormat(p.date_of_birth, alevinGroups[p.team_letter] ?? [])
            teamLabel = `Alevín ${p.team_letter} ${format}`
          } else {
            teamLabel = `${p.category}${femSuffix} ${p.team_letter}`.trim()
          }

          p.format = format
          p.team_label = teamLabel
          p.mapped_team_id = findTeamId(p.category, p.team_letter)
        }

        setPlayers(parsed)
        setSelected(new Set(parsed.map(p => p.dni)))
        setSkipped(skippedCount)
        setStep('preview')
      } catch (err) {
        toast.error('Error al leer el archivo Excel')
        console.error(err)
      }
    }
    reader.readAsArrayBuffer(file)
  }

  function toggleSelect(dni: string) {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(dni) ? next.delete(dni) : next.add(dni)
      return next
    })
  }

  async function handleImport() {
    const toImport = players.filter(p => selected.has(p.dni))
    if (toImport.length === 0) { toast.error('Selecciona al menos un jugador'); return }

    setImporting(true)
    try {
      const result = await importPlayers(clubId, toImport.map(p => ({
        dni: p.dni,
        first_name: p.first_name,
        last_name: p.last_name,
        date_of_birth: p.date_of_birth,
        gender: p.gender,
        team_id: p.mapped_team_id,
        team_label: p.team_label,   // sent so server can auto-create missing teams
        status: 'active' as const,
        position: null,
        license_type: p.license_type,
      })))

      if (result.success) {
        const parts = []
        if (result.imported > 0) parts.push(`${result.imported} importados`)
        if ((result as any).teamUpdated > 0) parts.push(`${(result as any).teamUpdated} equipos asignados`)
        if (result.skipped && result.skipped > 0) parts.push(`${result.skipped} ya existían`)
        toast.success(parts.join(' · ') || 'Sin cambios')
        setStep('done')
      } else {
        toast.error(`Error al importar: ${result.error ?? 'Error desconocido'}`)
      }
    } finally {
      setImporting(false)
    }
  }

  // Group players by category+team for display
  const groups = players.reduce<Record<string, ParsedPlayer[]>>((acc, p) => {
    const key = p.team_label
    if (!acc[key]) acc[key] = []
    acc[key].push(p)
    return acc
  }, {})

  if (step === 'done') {
    return (
      <div className="p-6 flex flex-col items-center justify-center min-h-64 text-center">
        <CheckCircle className="w-16 h-16 text-green-500 mb-4" />
        <h2 className="text-2xl font-bold text-gray-900 mb-2">¡Importación completada!</h2>
        <p className="text-gray-500 mb-6">{selected.size} jugadores importados correctamente</p>
        <div className="flex gap-3">
          <button onClick={() => { setStep('upload'); setPlayers([]) }} className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50">
            Importar otro archivo
          </button>
          <a href="/jugadores" className="px-4 py-2 text-white rounded-lg text-sm font-medium" style={{ backgroundColor: 'var(--color-primary)' }}>
            Ver jugadores
          </a>
        </div>
      </div>
    )
  }

  if (step === 'preview') {
    return (
      <div className="p-6 space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Previsualización de importación</h1>
            <p className="text-sm text-gray-500">
              <span className="text-green-600 font-medium">{players.length} jugadores activos</span> encontrados
              {skipped > 0 && <span className="text-gray-400"> · {skipped} omitidos (inactivos, delegados, etc.)</span>}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => setStep('upload')} className="px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50 flex items-center gap-1.5">
              <X className="w-4 h-4" /> Cambiar archivo
            </button>
            <button
              onClick={handleImport}
              disabled={importing || selected.size === 0}
              className="flex items-center gap-2 px-5 py-2 text-white rounded-lg text-sm font-medium disabled:opacity-50"
              style={{ backgroundColor: 'var(--color-primary)' }}
            >
              <Users className="w-4 h-4" />
              {importing ? 'Importando...' : `Importar ${selected.size} jugadores`}
            </button>
          </div>
        </div>

        {/* Select all / none */}
        <div className="flex items-center gap-3 text-sm">
          <button onClick={() => setSelected(new Set(players.map(p => p.dni)))} className="text-blue-600 hover:underline">Seleccionar todos</button>
          <span className="text-gray-300">|</span>
          <button onClick={() => setSelected(new Set())} className="text-gray-500 hover:underline">Deseleccionar todos</button>
          <span className="text-gray-400">{selected.size} de {players.length} seleccionados</span>
        </div>

        {/* Groups */}
        <div className="space-y-4">
          {Object.entries(groups).sort(([a], [b]) => a.localeCompare(b)).map(([groupName, groupPlayers]) => {
            const groupSelected = groupPlayers.filter(p => selected.has(p.dni)).length
            return (
              <div key={groupName} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className="px-4 py-3 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
                  <h3 className="font-semibold text-gray-900">{groupName}</h3>
                  <div className="flex items-center gap-3 text-sm">
                    <span className="text-gray-500">{groupSelected}/{groupPlayers.length} seleccionados</span>
                    {groupPlayers[0]?.mapped_team_id
                      ? <span className="text-green-600 text-xs flex items-center gap-1"><CheckCircle className="w-3 h-3" /> Equipo encontrado</span>
                      : <span className="text-yellow-600 text-xs flex items-center gap-1"><AlertCircle className="w-3 h-3" /> Sin equipo asignado</span>
                    }
                  </div>
                </div>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs text-gray-500 uppercase tracking-wide border-b border-gray-100">
                      <th className="px-4 py-2 w-8"><input type="checkbox" checked={groupPlayers.every(p => selected.has(p.dni))} onChange={e => { const next = new Set(selected); groupPlayers.forEach(p => e.target.checked ? next.add(p.dni) : next.delete(p.dni)); setSelected(next) }} /></th>
                      <th className="text-left px-4 py-2">Nombre</th>
                      <th className="text-left px-4 py-2">DNI/NIE</th>
                      <th className="text-left px-4 py-2">F. Nacimiento</th>
                      <th className="text-left px-4 py-2">Licencia</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {groupPlayers.map(p => (
                      <tr key={p.dni} className={`hover:bg-gray-50 ${!selected.has(p.dni) ? 'opacity-40' : ''}`}>
                        <td className="px-4 py-2">
                          <input type="checkbox" checked={selected.has(p.dni)} onChange={() => toggleSelect(p.dni)} />
                        </td>
                        <td className="px-4 py-2 font-medium text-gray-900">{p.first_name} {p.last_name}</td>
                        <td className="px-4 py-2 text-gray-500 font-mono text-xs">{p.dni}</td>
                        <td className="px-4 py-2 text-gray-500">{p.date_of_birth ? p.date_of_birth.split('-').reverse().join('/') : '—'}</td>
                        <td className="px-4 py-2">
                          <span className="text-xs bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded font-mono">{p.license_type}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Importar jugadores desde Excel</h1>
        <p className="text-sm text-gray-500">Formato de la federación madrileña de fútbol</p>
      </div>

      <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-between gap-4">
        <div className="text-sm text-amber-800">
          <strong>¿Tienes jugadores importados sin equipo?</strong> Borra todos y reimporta el Excel para que los equipos se asignen correctamente.
        </div>
        <button
          onClick={async () => {
            if (!confirm('¿Borrar TODOS los jugadores del club? Esta acción no se puede deshacer.')) return
            setClearing(true)
            const r = await deleteAllPlayers()
            setClearing(false)
            if (r.success) toast.success(`${r.deleted ?? 'Todos los'} jugadores eliminados`)
            else toast.error(`Error: ${r.error}`)
          }}
          disabled={clearing}
          className="shrink-0 px-3 py-2 text-sm font-medium text-red-600 border border-red-200 rounded-lg hover:bg-red-50 disabled:opacity-50 whitespace-nowrap"
        >
          {clearing ? 'Borrando...' : 'Borrar todos los jugadores'}
        </button>
      </div>

      <div
        className="border-2 border-dashed border-gray-300 rounded-2xl p-16 text-center hover:border-blue-400 hover:bg-blue-50/30 transition-all cursor-pointer"
        onClick={() => fileRef.current?.click()}
        onDragOver={e => e.preventDefault()}
        onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFile(f) }}
      >
        <FileSpreadsheet className="w-14 h-14 text-gray-300 mx-auto mb-4" />
        <p className="text-lg font-semibold text-gray-700 mb-1">Arrastra el archivo Excel aquí</p>
        <p className="text-sm text-gray-400 mb-4">o haz clic para seleccionarlo</p>
        <button className="inline-flex items-center gap-2 px-5 py-2.5 text-white rounded-lg text-sm font-medium" style={{ backgroundColor: 'var(--color-primary)' }}>
          <Upload className="w-4 h-4" /> Seleccionar archivo .xlsx
        </button>
        <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }} />
      </div>

      <div className="mt-8 bg-gray-50 rounded-xl p-5">
        <h3 className="font-semibold text-gray-900 mb-3">Lógica de importación</h3>
        <div className="grid grid-cols-2 gap-4 text-sm text-gray-600">
          <div>
            <p className="font-medium text-gray-800 mb-1">Tipos de licencia:</p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
              {Object.entries(LICENSE_CATEGORY).slice(0, 8).map(([k, v]) => (
                <span key={k}><code className="bg-white px-1 rounded text-xs">{k}</code> → {v.category}</span>
              ))}
            </div>
          </div>
          <div>
            <p className="font-medium text-gray-800 mb-1">Femenino (prefijo F):</p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
              {Object.entries(LICENSE_CATEGORY).slice(8).map(([k, v]) => (
                <span key={k}><code className="bg-white px-1 rounded text-xs">{k}</code> → {v.category} F</span>
              ))}
            </div>
          </div>
        </div>
        <p className="text-xs text-gray-400 mt-3">Solo se importan licencias en estado <strong>Activa</strong>. Las licencias de técnicos, delegados y árbitros se omiten automáticamente.</p>
      </div>
    </div>
  )
}
