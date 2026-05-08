'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { X, ArrowLeft, Loader2, Check } from 'lucide-react'
import {
  resolveCompetitionUrlAction,
  type ResolvedCompetition,
  type ResolvedTeam,
} from '@/features/rffm/actions/browse.actions'
import { addTrackedCompetition, updateTrackedCompetition, triggerRffmSync } from '@/features/rffm/actions/rffm.actions'

interface Props {
  open: boolean
  onClose: () => void
  editId?: string  // when set: repair mode (update existing row)
}

const TEMPORADA_LABELS: Record<string, string> = {
  '21': '2025-2026',
  '20': '2024-2025',
  '19': '2023-2024',
}

export function AddCompetitionModal({ open, onClose, editId }: Props) {
  const isRepair = !!editId
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const [step, setStep] = useState<1 | 2>(1)
  const [urlInput, setUrlInput] = useState('')
  const [parsed, setParsed] = useState<ResolvedCompetition | null>(null)
  const [teams, setTeams] = useState<ResolvedTeam[]>([])
  const [selectedTeam, setSelectedTeam] = useState<ResolvedTeam | null>(null)
  const [isAdding, setIsAdding] = useState(false)

  if (!open) return null

  function reset() {
    setStep(1)
    setUrlInput('')
    setParsed(null)
    setTeams([])
    setSelectedTeam(null)
  }

  function handleClose() {
    reset()
    onClose()
  }

  function handleResolve() {
    if (!urlInput.trim()) return
    startTransition(async () => {
      const res = await resolveCompetitionUrlAction(urlInput.trim())
      if (!res.success || !res.parsed) {
        toast.error(res.error ?? 'Error al resolver la URL')
        return
      }
      setParsed(res.parsed)
      setTeams(res.teams ?? [])
      setSelectedTeam(null)
      setStep(2)
    })
  }

  function handleAdd() {
    if (!parsed || !selectedTeam) return
    setIsAdding(true)
    startTransition(async () => {
      const fields = {
        cod_temporada: parsed.cod_temporada,
        cod_tipojuego: parsed.cod_tipojuego,
        cod_competicion: parsed.cod_competicion,
        cod_grupo: parsed.cod_grupo,
        nombre_competicion: parsed.nombre_competicion,
        nombre_grupo: parsed.nombre_grupo,
        codigo_equipo_nuestro: selectedTeam.codigo_equipo,
        nombre_equipo_nuestro: selectedTeam.nombre_equipo,
      }

      const res = isRepair
        ? await updateTrackedCompetition(editId!, fields)
        : await addTrackedCompetition(fields)

      if (!res.success) {
        toast.error(res.error ?? (isRepair ? 'Error al actualizar' : 'Error al añadir competición'))
        setIsAdding(false)
        return
      }

      toast.promise(
        Promise.all([
          triggerRffmSync('calendar'),
          triggerRffmSync('standings'),
        ]),
        {
          loading: 'Sincronizando calendario y clasificación…',
          success: isRepair ? 'Competición reparada y sincronizada' : 'Competición añadida y sincronizada',
          error: 'Guardado. Sincronización parcial — lanza sync manual si faltan datos.',
        }
      )
      router.refresh()
      setIsAdding(false)
      handleClose()
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-labelledby="add-competition-modal-title">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 id="add-competition-modal-title" className="text-lg font-semibold text-gray-900">{isRepair ? 'Reparar competición' : 'Añadir competición'}</h2>
          <button onClick={handleClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Step 1 — Paste URL */}
        {step === 1 && (
          <div className="p-6 flex flex-col gap-4">
            <p className="text-sm text-gray-600">
              Copia la URL de cualquier página de la competición en RFFM
              (calendario, clasificación, goleadores…) y pégala aquí.
            </p>

            {/* URL anatomy hint */}
            <div className="bg-gray-50 rounded-lg p-3 text-xs font-mono text-gray-500 leading-relaxed">
              <span className="text-gray-400">https://www.rffm.es/competicion/calendario</span>
              <br />
              <span className="text-blue-600">?temporada=</span><span className="text-blue-800 font-bold">21</span>
              <span className="text-gray-400"> → temporada</span>
              <br />
              <span className="text-green-600">&amp;tipojuego=</span><span className="text-green-800 font-bold">2</span>
              <span className="text-gray-400"> → F-11 / F-7 / F-5</span>
              <br />
              <span className="text-purple-600">&amp;competicion=</span><span className="text-purple-800 font-bold">24037913</span>
              <span className="text-gray-400"> → código competición</span>
              <br />
              <span className="text-orange-600">&amp;grupo=</span><span className="text-orange-800 font-bold">24037915</span>
              <span className="text-gray-400"> → código grupo</span>
            </div>

            <textarea
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows={3}
              placeholder="https://www.rffm.es/competicion/calendario?temporada=21&tipojuego=2&competicion=...&grupo=..."
              value={urlInput}
              onChange={e => setUrlInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleResolve() } }}
            />

            <div className="flex justify-end">
              <button
                onClick={handleResolve}
                disabled={!urlInput.trim() || isPending}
                className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                Resolver →
              </button>
            </div>
          </div>
        )}

        {/* Step 2 — Confirm codes + pick team */}
        {step === 2 && parsed && (
          <div className="p-6 flex flex-col gap-5">
            <button
              onClick={() => setStep(1)}
              className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 w-fit transition-colors"
            >
              <ArrowLeft className="w-4 h-4" /> Cambiar URL
            </button>

            {/* Parsed codes breakdown */}
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
                Datos extraídos del link
              </p>
              <div className="bg-gray-50 rounded-lg divide-y divide-gray-100 text-sm overflow-hidden">
                <div className="flex items-center gap-2 px-4 py-2">
                  <span className="font-mono text-blue-600 text-xs w-32 shrink-0">?temporada={parsed.cod_temporada}</span>
                  <span className="text-gray-400">→</span>
                  <span className="text-gray-700 font-medium">
                    Temporada {TEMPORADA_LABELS[parsed.cod_temporada] ?? parsed.cod_temporada}
                  </span>
                </div>
                <div className="flex items-center gap-2 px-4 py-2">
                  <span className="font-mono text-green-600 text-xs w-32 shrink-0">&amp;tipojuego={parsed.cod_tipojuego}</span>
                  <span className="text-gray-400">→</span>
                  <span className="text-gray-700 font-medium">{parsed.label_tipojuego}</span>
                </div>
                <div className="flex items-center gap-2 px-4 py-2">
                  <span className="font-mono text-purple-600 text-xs w-32 shrink-0 truncate">&amp;competicion={parsed.cod_competicion}</span>
                  <span className="text-gray-400">→</span>
                  <span className="text-gray-700 font-medium truncate" title={parsed.nombre_competicion}>
                    {parsed.nombre_competicion}
                  </span>
                </div>
                <div className="flex items-center gap-2 px-4 py-2">
                  <span className="font-mono text-orange-600 text-xs w-32 shrink-0 truncate">&amp;grupo={parsed.cod_grupo}</span>
                  <span className="text-gray-400">→</span>
                  <span className="text-gray-700 font-medium">{parsed.nombre_grupo}</span>
                </div>
              </div>
            </div>

            {/* Team picker */}
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
                ¿Cuál es nuestro equipo? ({teams.length} equipos en este grupo)
              </p>
              <div className="border border-gray-200 rounded-lg overflow-hidden max-h-56 overflow-y-auto">
                {teams.map(t => (
                  <button
                    key={t.codigo_equipo}
                    onClick={() => setSelectedTeam(t)}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm text-left hover:bg-blue-50 transition-colors border-b border-gray-100 last:border-0 ${
                      selectedTeam?.codigo_equipo === t.codigo_equipo
                        ? 'bg-blue-50 text-blue-800'
                        : 'text-gray-700'
                    }`}
                  >
                    <span className="text-gray-400 font-mono text-xs w-5 text-center shrink-0">{t.posicion}</span>
                    <span className="flex-1">{t.nombre_equipo}</span>
                    {selectedTeam?.codigo_equipo === t.codigo_equipo && (
                      <Check className="w-4 h-4 text-blue-600 shrink-0" />
                    )}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex justify-end">
              <button
                onClick={handleAdd}
                disabled={!selectedTeam || isPending || isAdding}
                className="flex items-center gap-2 bg-green-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {(isPending || isAdding) ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                {isRepair ? 'Guardar cambios' : 'Añadir competición'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
