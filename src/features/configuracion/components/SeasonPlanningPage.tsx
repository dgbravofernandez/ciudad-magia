'use client'

import { useState, useEffect, useTransition, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  CalendarRange, Users, UserCheck, Loader2, AlertTriangle,
  CheckCircle2, Plus, ArrowRight, RefreshCw, Upload,
} from 'lucide-react'
import { initNextSeasonPlanning, activateNextSeason, getSeasonPreview, addDraftTeam } from '@/features/configuracion/actions/season.actions'
import {
  previewNewInscriptions,
  importNewInscriptions,
  saveNewInscriptionsSheetId,
  getNewInscriptionsSheetId,
  type NewPlayerRow,
} from '@/features/jugadores/actions/sync-new-inscriptions.actions'
import { getDraftCoachAssignments } from '@/features/configuracion/actions/assignment-email.actions'
import { CoachDraftAssignment } from './CoachDraftAssignment'
import { AssignmentEmailConfig } from './AssignmentEmailConfig'
import { SeasonRosters } from './SeasonRosters'

interface DraftTeam { id: string; name: string; season: string }
interface SeasonPreview {
  currentSeason: string; nextSeason: string
  activeTeams: number; totalPlayers: number
  continuingWithTeam: number; continuingWithoutTeam: number; notContinuing: number
}

// ─── Sección: Equipos borrador ────────────────────────────────────────────────
function TeamsSection({ teams, nextSeason, onRefresh }: { teams: DraftTeam[]; nextSeason: string; onRefresh: () => void }) {
  const [isPending, startTransition] = useTransition()
  const [newName, setNewName] = useState('')

  function handleAddTeam() {
    if (!newName.trim()) return
    startTransition(async () => {
      const res = await addDraftTeam(newName.trim())
      if (res.success) {
        setNewName('')
        onRefresh()
        toast.success('Equipo añadido')
      } else {
        toast.error(res.error ?? 'Error añadiendo equipo')
      }
    })
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5">
      <div className="flex items-center gap-2 mb-4">
        <Users className="w-5 h-5 text-blue-600" aria-hidden="true" />
        <h2 className="font-semibold text-slate-900">Equipos {nextSeason}</h2>
        <span className="text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">{teams.length} equipos</span>
      </div>

      {teams.length === 0 ? (
        <p className="text-sm text-slate-500 italic">Sin equipos aún. Se crearán como copia de los actuales al iniciar la planificación.</p>
      ) : (
        <div className="flex flex-wrap gap-2 mb-4">
          {teams.map(t => (
            <span key={t.id} className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800 font-medium">
              {t.name}
            </span>
          ))}
        </div>
      )}

      <div className="flex gap-2 mt-2">
        <input
          value={newName}
          onChange={e => setNewName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleAddTeam()}
          placeholder="Nombre del nuevo equipo..."
          className="flex-1 px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          onClick={handleAddTeam}
          disabled={isPending || !newName.trim()}
          className="px-3 py-2 text-sm rounded-md bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-40 flex items-center gap-1.5"
        >
          {isPending ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> : <Plus className="w-4 h-4" aria-hidden="true" />}
          Añadir
        </button>
      </div>
      <p className="text-xs text-slate-400 mt-2">
        Los equipos marcados como borrador solo se activan al pulsar &quot;Activar temporada&quot;.
      </p>
    </div>
  )
}

// ─── Sección: Nuevas inscripciones ───────────────────────────────────────────
function NewInscriptionsSection() {
  const [sheetUrl, setSheetUrl] = useState('')
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [savedSheetId, setSavedSheetId] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [preview, setPreview] = useState<{ toCreate: NewPlayerRow[]; alreadyExist: { name: string; reason: string }[]; sheetRows: number } | null>(null)
  const [importDone, setImportDone] = useState<{ created: number; skipped: number } | null>(null)

  useEffect(() => {
    getNewInscriptionsSheetId().then(r => {
      if (r.sheetId) {
        setSavedSheetId(r.sheetId)
        setSheetUrl(`https://docs.google.com/spreadsheets/d/${r.sheetId}`)
      }
    })
  }, [])

  function handlePreview() {
    if (!sheetUrl.trim()) { toast.error('Pega la URL del Sheet'); return }
    startTransition(async () => {
      await saveNewInscriptionsSheetId(sheetUrl.trim())
      const res = await previewNewInscriptions(sheetUrl.trim())
      if (res.error) { toast.error(res.error); return }
      setPreview(res)
      setSavedSheetId(sheetUrl.trim())
      setImportDone(null)
    })
  }

  function handleImport() {
    if (!preview?.toCreate.length) return
    startTransition(async () => {
      const res = await importNewInscriptions(preview.toCreate)
      if (res.success) {
        setImportDone({ created: res.created, skipped: res.skipped })
        setPreview(null)
        toast.success(`${res.created} jugadores importados`)
      } else {
        toast.error(res.error ?? 'Error importando')
      }
    })
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5">
      <div className="flex items-center gap-2 mb-1">
        <Upload className="w-5 h-5 text-emerald-600" aria-hidden="true" />
        <h2 className="font-semibold text-slate-900">Nuevas inscripciones</h2>
      </div>
      <p className="text-xs text-slate-500 mb-4">
        Jugadores nuevos que no están en el club. Pega la URL del Google Sheet con las respuestas del formulario.
      </p>

      <div className="flex gap-2 mb-3">
        <input
          value={sheetUrl}
          onChange={e => setSheetUrl(e.target.value)}
          placeholder="https://docs.google.com/spreadsheets/d/..."
          className="flex-1 px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
        />
        <button
          onClick={handlePreview}
          disabled={isPending || !sheetUrl.trim()}
          className="px-3 py-2 text-sm rounded-md border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 disabled:opacity-40 flex items-center gap-1.5"
        >
          {isPending ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> : <RefreshCw className="w-4 h-4" aria-hidden="true" />}
          Previsualizar
        </button>
      </div>

      {preview && (
        <div className="space-y-3">
          <div className="text-xs text-slate-500">
            {preview.sheetRows} filas leídas · <span className="text-emerald-700 font-medium">{preview.toCreate.length} nuevos</span> · {preview.alreadyExist.length} ya existen
          </div>

          {preview.toCreate.length > 0 && (
            <div className="border border-slate-200 rounded-lg overflow-hidden">
              <table className="w-full text-xs">
                <thead className="bg-slate-50 text-slate-600">
                  <tr>
                    <th className="text-left px-3 py-2">Nombre</th>
                    <th className="text-left px-3 py-2">Email tutor</th>
                    <th className="text-left px-3 py-2">Categoría</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {preview.toCreate.slice(0, 10).map((p, i) => (
                    <tr key={i}>
                      <td className="px-3 py-2 font-medium">{p.last_name}, {p.first_name}</td>
                      <td className="px-3 py-2 text-slate-500">{p.tutor_email || '—'}</td>
                      <td className="px-3 py-2 text-slate-500">{p.categoria || '—'}</td>
                    </tr>
                  ))}
                  {preview.toCreate.length > 10 && (
                    <tr><td colSpan={3} className="px-3 py-2 text-slate-400 italic">... y {preview.toCreate.length - 10} más</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {preview.alreadyExist.length > 0 && (
            <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              <p className="font-medium mb-1">Ya existen en la app ({preview.alreadyExist.length}):</p>
              <p>{preview.alreadyExist.map(e => e.name).join(', ')}</p>
            </div>
          )}

          <button
            onClick={handleImport}
            disabled={isPending || preview.toCreate.length === 0}
            className="px-4 py-2 text-sm rounded-md bg-emerald-600 hover:bg-emerald-700 text-white font-medium disabled:opacity-50 flex items-center gap-2"
          >
            {isPending ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> : <UserCheck className="w-4 h-4" aria-hidden="true" />}
            Importar {preview.toCreate.length} jugadores nuevos
          </button>
        </div>
      )}

      {importDone && (
        <div className="flex items-center gap-2 text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2 text-sm">
          <CheckCircle2 className="w-4 h-4" />
          {importDone.created} jugadores importados · {importDone.skipped} omitidos
        </div>
      )}
    </div>
  )
}

// ─── Sección: Activación ─────────────────────────────────────────────────────
function ActivationSection({ preview, draftTeams }: { preview: SeasonPreview; draftTeams: DraftTeam[] }) {
  const [showConfirm, setShowConfirm] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [done, setDone] = useState<{ nextSeason: string; playersUpdated: number; lowPlayers: number } | null>(null)
  const router = useRouter()

  function handleActivate() {
    startTransition(async () => {
      const res = await activateNextSeason()
      if (res.success) {
        setDone({ nextSeason: res.nextSeason!, playersUpdated: res.playersUpdated!, lowPlayers: res.lowPlayers! })
        setShowConfirm(false)
        toast.success(`¡Temporada ${res.nextSeason} activada!`)
        setTimeout(() => router.push('/configuracion'), 1500)
      } else {
        toast.error(res.error ?? 'Error activando temporada')
      }
    })
  }

  if (done) {
    return (
      <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-5 space-y-2">
        <div className="flex items-center gap-2 text-emerald-800 font-semibold">
          <CheckCircle2 className="w-5 h-5" aria-hidden="true" /> ¡Temporada {done.nextSeason} activada!
        </div>
        <ul className="text-sm text-emerald-700 ml-7 space-y-1">
          <li>✓ {done.playersUpdated} jugadores actualizados</li>
          <li>✓ {done.lowPlayers} jugadores marcados como baja</li>
        </ul>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5">
      <div className="flex items-center gap-2 mb-3">
        <ArrowRight className="w-5 h-5 text-slate-700" aria-hidden="true" />
        <h2 className="font-semibold text-slate-900">Activar temporada {preview.nextSeason}</h2>
      </div>

      <div className="bg-slate-50 rounded-lg p-3 text-sm space-y-1.5 mb-4">
        <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Qué ocurrirá</p>
        <div className="flex justify-between text-slate-700">
          <span>Equipos que se activarán</span>
          <span className="font-semibold text-blue-700">{draftTeams.length}</span>
        </div>
        <div className="flex justify-between text-slate-700">
          <span>Jugadores con equipo {preview.nextSeason}</span>
          <span className="font-semibold text-emerald-700">{preview.continuingWithTeam}</span>
        </div>
        <div className="flex justify-between text-slate-700">
          <span>Jugadores sin equipo asignado</span>
          <span className="font-semibold text-amber-600">{preview.continuingWithoutTeam}</span>
        </div>
        <div className="flex justify-between text-slate-700">
          <span>Jugadores que pasan a baja</span>
          <span className="font-semibold text-red-600">{preview.notContinuing}</span>
        </div>
      </div>

      {draftTeams.length === 0 && (
        <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800 mb-4">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" aria-hidden="true" />
          No hay equipos configurados para {preview.nextSeason}. Crea al menos uno antes de activar.
        </div>
      )}

      {!showConfirm ? (
        <button
          onClick={() => setShowConfirm(true)}
          disabled={draftTeams.length === 0}
          className="w-full px-4 py-2.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-semibold text-sm disabled:opacity-40 flex items-center justify-center gap-2"
        >
          <ArrowRight className="w-4 h-4" aria-hidden="true" />
          Activar temporada {preview.nextSeason}
        </button>
      ) : (
        <div className="space-y-3">
          <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-800">
            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" aria-hidden="true" />
            <div>
              <p className="font-semibold">Esta acción no se puede deshacer fácilmente</p>
              <p className="text-xs mt-0.5">La temporada {preview.currentSeason} quedará como histórico. Los equipos actuales se desactivarán.</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={handleActivate} disabled={isPending}
              className="flex-1 px-4 py-2.5 rounded-lg bg-red-600 hover:bg-red-700 text-white font-semibold text-sm disabled:opacity-50">
              {isPending ? 'Activando...' : `Confirmar — activar ${preview.nextSeason}`}
            </button>
            <button onClick={() => setShowConfirm(false)} className="px-4 py-2.5 rounded-lg border border-slate-300 text-slate-700 text-sm hover:bg-slate-50">
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Componente principal ─────────────────────────────────────────────────────
export function SeasonPlanningPage() {
  const [preview, setPreview] = useState<SeasonPreview | null>(null)
  const [draftTeams, setDraftTeams] = useState<DraftTeam[]>([])
  const [draftAssignments, setDraftAssignments] = useState<{ team_id: string; member_id: string }[]>([])
  const [loading, setLoading] = useState(true)

  const loadData = useCallback(async () => {
    const [prevRes, initRes] = await Promise.all([
      getSeasonPreview(),
      initNextSeasonPlanning(),
    ])
    setPreview(prevRes)
    if (initRes.success && initRes.teams) {
      setDraftTeams(initRes.teams)
      // Load current coach assignments for draft teams
      const teamIds = initRes.teams.map((t: DraftTeam) => t.id)
      if (teamIds.length > 0) {
        const assignRes = await getDraftCoachAssignments(teamIds)
        if (assignRes.success && assignRes.assignments) {
          setDraftAssignments(assignRes.assignments)
        }
      }
    }
    setLoading(false)
  }, [])

  useEffect(() => { loadData() }, [loadData])

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto p-6 space-y-4">
        <div className="h-8 bg-slate-100 rounded animate-pulse w-64" />
        <div className="h-40 bg-slate-100 rounded animate-pulse" />
      </div>
    )
  }

  if (!preview) return null

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center shrink-0">
          <CalendarRange className="w-5 h-5 text-blue-700" aria-hidden="true" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-slate-900">Planificación {preview.nextSeason}</h1>
          <p className="text-sm text-slate-500">
            Temporada activa: <span className="font-semibold text-slate-700">{preview.currentSeason}</span>
            {' '}· Sigue en marcha mientras planificas la siguiente
          </p>
        </div>
      </div>

      {/* Equipos borrador */}
      <TeamsSection teams={draftTeams} nextSeason={preview.nextSeason} onRefresh={loadData} />

      {/* Cuerpo técnico 26/27 */}
      <CoachDraftAssignment
        draftTeams={draftTeams}
        initialAssignments={draftAssignments}
        nextSeason={preview.nextSeason}
      />

      {/* Nuevas inscripciones */}
      <NewInscriptionsSection />

      {/* Email de asignación */}
      <AssignmentEmailConfig />

      {/* Listado de plantillas */}
      <SeasonRosters />

      {/* Activación */}
      <ActivationSection preview={preview} draftTeams={draftTeams} />
    </div>
  )
}
