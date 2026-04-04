'use client'

import { useState } from 'react'
import { RefreshCw, CheckCircle, AlertCircle, Users, FileText, Mail, Phone, Image, ChevronDown, ChevronUp } from 'lucide-react'
import { toast } from 'sonner'
import { matchAndPreview, applySheetSync, type SyncMatch } from '@/features/jugadores/actions/sync-docs.actions'

const DOCS_SHEET_ID   = '1KnZXtnMK28HgIjNSsp6tnXzDry_lWlvvFTR7O_DNOjc'
const TUTORS_SHEET_ID = '15YzC25MdHBJ3OGbtAS77xc5lTsw9yamxkDRjTMbNyXc'

function parseCSV(text: string): string[][] {
  const rows: string[][] = []
  const lines = text.split('\n')
  for (const line of lines) {
    if (!line.trim()) continue
    const cols: string[] = []
    let cur = ''
    let inQuote = false
    for (let i = 0; i < line.length; i++) {
      const ch = line[i]
      if (ch === '"') {
        if (inQuote && line[i + 1] === '"') { cur += '"'; i++ }
        else inQuote = !inQuote
      } else if (ch === ',' && !inQuote) {
        cols.push(cur.trim()); cur = ''
      } else {
        cur += ch
      }
    }
    cols.push(cur.trim())
    rows.push(cols)
  }
  return rows
}

const FIELD_LABELS: Record<string, string> = {
  tutor_email:         'Email tutor',
  tutor_name:          'Nombre tutor',
  tutor_phone:         'Teléfono tutor',
  photo_url:           'Foto jugador',
  dni_front_url:       'DNI cara 1',
  dni_back_url:        'DNI cara 2',
  birth_cert_url:      'Cert. nacimiento',
  residency_cert_url:  'Cert. empadronamiento',
  passport_url:        'Pasaporte',
  nie_url:             'NIE',
  spanish_nationality: 'Nacionalidad española',
  position:            'Posición',
}

const FIELD_ICONS: Record<string, React.ReactNode> = {
  tutor_email:   <Mail className="w-3 h-3" />,
  tutor_name:    <Users className="w-3 h-3" />,
  tutor_phone:   <Phone className="w-3 h-3" />,
  photo_url:     <Image className="w-3 h-3" />,
}

interface Props { clubId: string }

export function SincronizarDocumentos({ clubId }: Props) {
  const [step, setStep] = useState<'idle' | 'loading' | 'preview' | 'applying' | 'done'>('idle')
  const [preview, setPreview] = useState<SyncMatch[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [unmatched, setUnmatched] = useState({ docs: 0, tutors: 0 })
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [doneCount, setDoneCount] = useState(0)

  async function handleLoad() {
    setStep('loading')
    try {
      // Fetch both CSVs from the browser (bypasses middleware completely)
      const [csv1, csv2] = await Promise.all([
        fetch(`https://docs.google.com/spreadsheets/d/${DOCS_SHEET_ID}/export?format=csv`).then(r => {
          if (!r.ok) throw new Error(`Error al cargar hoja de documentos (${r.status})`)
          return r.text()
        }),
        fetch(`https://docs.google.com/spreadsheets/d/${TUTORS_SHEET_ID}/export?format=csv`).then(r => {
          if (!r.ok) throw new Error(`Error al cargar hoja de inscripciones (${r.status})`)
          return r.text()
        }),
      ])

      const docsRows   = parseCSV(csv1)
      const tutorsRows = parseCSV(csv2)

      // Server action only does fast DB lookups — no external HTTP
      const result = await matchAndPreview(clubId, docsRows, tutorsRows)

      if (result.error === 'no_players') {
        toast.error('No hay jugadores en la base de datos. Importa primero el Excel de la federación.')
        setStep('idle')
        return
      }
      if (result.error) {
        toast.error(`Error: ${result.error}`)
        setStep('idle')
        return
      }

      setPreview(result.matches)
      setSelected(new Set(result.matches.map(m => m.player_id)))
      setUnmatched({ docs: result.unmatched_docs, tutors: result.unmatched_tutors })
      setStep('preview')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al conectar con Google Sheets')
      setStep('idle')
    }
  }

  async function handleApply() {
    const toApply = preview.filter(m => selected.has(m.player_id))
    if (toApply.length === 0) { toast.error('Selecciona al menos un jugador'); return }
    setStep('applying')
    const result = await applySheetSync(clubId, toApply)
    if (result.error) {
      toast.error(`Error al aplicar: ${result.error}`)
      setStep('preview')
      return
    }
    setDoneCount(result.updated)
    setStep('done')
    toast.success(`${result.updated} jugadores actualizados`)
  }

  function toggleExpand(id: string) {
    setExpanded(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function fieldValue(val: string | boolean | null): string {
    if (val === null || val === undefined || val === '') return '—'
    if (typeof val === 'boolean') return val ? 'Sí' : 'No'
    if (val.startsWith('http')) return '🔗 (enlace Drive)'
    return val
  }

  // ── Done ──────────────────────────────────────────────────────────────────
  if (step === 'done') {
    return (
      <div className="flex flex-col items-center justify-center min-h-64 text-center p-6">
        <CheckCircle className="w-16 h-16 text-green-500 mb-4" />
        <h2 className="text-2xl font-bold mb-2">Sincronización completada</h2>
        <p className="text-gray-500 mb-6">{doneCount} jugadores actualizados con datos de Google Sheets</p>
        <button
          onClick={() => { setStep('idle'); setPreview([]) }}
          className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50"
        >
          Volver a sincronizar
        </button>
      </div>
    )
  }

  // ── Preview ───────────────────────────────────────────────────────────────
  if (step === 'preview') {
    const fieldCounts: Record<string, number> = {}
    preview.forEach(m => Object.keys(m.updates).forEach(k => { fieldCounts[k] = (fieldCounts[k] ?? 0) + 1 }))

    return (
      <div className="p-6 space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Previsualización de sincronización</h1>
            <p className="text-sm text-gray-500">
              <span className="text-green-600 font-medium">{preview.length} jugadores</span> con datos nuevos encontrados
              {(unmatched.docs + unmatched.tutors) > 0 && (
                <span className="text-gray-400"> · {unmatched.docs + unmatched.tutors} filas sin coincidencia</span>
              )}
            </p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => setStep('idle')}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50"
            >
              Cancelar
            </button>
            <button
              onClick={handleApply}
              disabled={selected.size === 0 || step === 'applying'}
              className="flex items-center gap-2 px-5 py-2 text-black rounded-lg text-sm font-semibold disabled:opacity-50"
              style={{ backgroundColor: 'var(--color-primary)' }}
            >
              <RefreshCw className={`w-4 h-4 ${step === 'applying' ? 'animate-spin' : ''}`} />
              Aplicar {selected.size} actualizaciones
            </button>
          </div>
        </div>

        {/* Summary pills */}
        <div className="flex flex-wrap gap-2">
          {Object.entries(fieldCounts).map(([field, count]) => (
            <span key={field} className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-50 text-blue-700 rounded-full text-xs font-medium">
              {FIELD_ICONS[field] ?? <FileText className="w-3 h-3" />}
              {FIELD_LABELS[field] ?? field}: {count}
            </span>
          ))}
        </div>

        {/* Select all / none */}
        <div className="flex items-center gap-3 text-sm">
          <button onClick={() => setSelected(new Set(preview.map(m => m.player_id)))} className="text-blue-600 hover:underline">Seleccionar todos</button>
          <span className="text-gray-300">|</span>
          <button onClick={() => setSelected(new Set())} className="text-gray-500 hover:underline">Deseleccionar todos</button>
          <span className="text-gray-400">{selected.size} de {preview.length} seleccionados</span>
        </div>

        {/* Player list */}
        <div className="space-y-2">
          {preview.map(match => {
            const isSelected = selected.has(match.player_id)
            const isExpanded = expanded.has(match.player_id)
            return (
              <div key={match.player_id} className={`bg-white rounded-xl border transition-all ${isSelected ? 'border-gray-200' : 'border-gray-100 opacity-50'}`}>
                <div className="flex items-center gap-3 px-4 py-3">
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => {
                      const next = new Set(selected)
                      isSelected ? next.delete(match.player_id) : next.add(match.player_id)
                      setSelected(next)
                    }}
                  />
                  <div className="flex-1 min-w-0">
                    <span className="font-semibold text-gray-900">{match.player_name}</span>
                    <span className="ml-2 text-xs text-gray-400">
                      {match.match_method === 'dni' ? 'coincidencia DNI' : 'coincidencia nombre+fecha'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <span className="bg-gray-100 px-1.5 py-0.5 rounded font-medium">
                      {Object.keys(match.updates).length} campo{Object.keys(match.updates).length !== 1 ? 's' : ''}
                    </span>
                    {match.source === 'both' && (
                      <span className="bg-purple-50 text-purple-600 px-1.5 py-0.5 rounded">ambas hojas</span>
                    )}
                    {match.source === 'docs' && (
                      <span className="bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded">documentos</span>
                    )}
                    {match.source === 'tutors' && (
                      <span className="bg-green-50 text-green-600 px-1.5 py-0.5 rounded">tutores</span>
                    )}
                    <button
                      onClick={() => toggleExpand(match.player_id)}
                      className="text-gray-400 hover:text-gray-600 p-0.5"
                    >
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {isExpanded && (
                  <div className="border-t border-gray-50 px-4 py-3">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-gray-400 uppercase tracking-wide">
                          <th className="text-left py-1 pr-4 w-40">Campo</th>
                          <th className="text-left py-1 pr-4">Valor actual</th>
                          <th className="text-left py-1">Nuevo valor</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {Object.entries(match.updates).map(([field, newVal]) => (
                          <tr key={field}>
                            <td className="py-1 pr-4 text-gray-500 font-medium">{FIELD_LABELS[field] ?? field}</td>
                            <td className="py-1 pr-4 text-gray-400">{fieldValue(match.current[field] ?? null)}</td>
                            <td className="py-1 text-green-700 font-medium">{fieldValue(newVal)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {preview.length === 0 && (
          <div className="text-center py-12 text-gray-400">
            <CheckCircle className="w-10 h-10 mx-auto mb-3 text-green-400" />
            <p>Todo al día — no hay datos nuevos para sincronizar</p>
          </div>
        )}
      </div>
    )
  }

  // ── Idle / loading ────────────────────────────────────────────────────────
  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Sincronizar desde Google Sheets</h1>
        <p className="text-sm text-gray-500">
          Importa emails, teléfonos y documentos (fotos, DNI, certificados) desde los formularios de Google.
          Los datos de federación (nombre, DNI, fecha de nacimiento) nunca se sobreescriben.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div className="bg-blue-50 rounded-xl p-4 border border-blue-100">
          <h3 className="font-semibold text-blue-900 mb-1">Hoja de documentos</h3>
          <p className="text-xs text-blue-700">Fotos, DNI (cara 1 y 2), certificado de nacimiento, empadronamiento, pasaporte, NIE. Email del tutor/a.</p>
        </div>
        <div className="bg-green-50 rounded-xl p-4 border border-green-100">
          <h3 className="font-semibold text-green-900 mb-1">Hoja de inscripciones</h3>
          <p className="text-xs text-green-700">Nombre del tutor/a, email, teléfono y posición del jugador.</p>
        </div>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6 text-sm text-amber-800">
        <strong>Regla de prioridad:</strong> Solo se actualizan campos que están vacíos en la base de datos.
        Los datos importados de la federación (nombre, DNI, fecha de nacimiento, categoría) no se modifican nunca.
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6 text-sm text-blue-800 flex gap-2">
        <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
        <span>Asegúrate de haber importado primero el Excel de la federación. La sincronización solo completa datos de jugadores ya existentes.</span>
      </div>

      <button
        onClick={handleLoad}
        disabled={step === 'loading'}
        className="flex items-center gap-3 px-6 py-3 text-black rounded-xl font-semibold text-sm disabled:opacity-50"
        style={{ backgroundColor: 'var(--color-primary)' }}
      >
        <RefreshCw className={`w-5 h-5 ${step === 'loading' ? 'animate-spin' : ''}`} />
        {step === 'loading' ? 'Cargando desde Google Sheets…' : 'Cargar y previsualizar cambios'}
      </button>

      {step === 'loading' && (
        <p className="mt-3 text-sm text-gray-400">Descargando hojas de Google Sheets y buscando coincidencias…</p>
      )}
    </div>
  )
}
