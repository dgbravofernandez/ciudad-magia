'use client'

import { useEffect, useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  detectClubBasicsAction,
  detectClubChunkAction,
  bulkInsertWizardResults,
  resetClubRffmConfig,
} from '@/features/rffm/actions/club-wizard.actions'
import {
  parseClubPdfAction,
  matchClubPdfRows,
  bulkInsertTrackedFromPdf,
  resolveRowWithUrl,
} from '@/features/rffm/actions/rffm.actions'

interface Props {
  open: boolean
  onClose: () => void
  trackedCompsCount: number   // para mostrar al usuario cuántas tiene ya
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyMatched = any

export function WizardModal({ open, onClose, trackedCompsCount }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  // Modo del modal: 'wizard' (auto-detect desde fichaclub) o 'pdf' (legacy fallback)
  const [mode, setMode] = useState<'wizard' | 'pdf'>('wizard')

  // Wizard state
  const [codigoClub, setCodigoClub] = useState('')
  const [wizardResult, setWizardResult] = useState<AnyMatched | null>(null)
  const [wizardSelected, setWizardSelected] = useState<Set<number>>(new Set())
  const [showWizardDetail, setShowWizardDetail] = useState(false)

  // Progreso del detect en chunks
  const [detectProgress, setDetectProgress] = useState<{
    phase: 'idle' | 'basics' | 'chunks' | 'done' | 'error'
    totalEquipos: number
    processedEquipos: number
    chunksDone: number
    chunksTotal: number
    currentMessage: string
  } | null>(null)

  // Reset state
  const [showResetConfirm, setShowResetConfirm] = useState(false)
  const [wipeAll, setWipeAll] = useState(false)

  // PDF fallback state
  const [pdfResult, setPdfResult] = useState<AnyMatched | null>(null)
  const [pdfMatchResult, setPdfMatchResult] = useState<AnyMatched | null>(null)
  const [pdfSelected, setPdfSelected] = useState<Set<number>>(new Set())
  const [resolvingIdx, setResolvingIdx] = useState<number | null>(null)
  const [resolvingUnparsed, setResolvingUnparsed] = useState<string | null>(null)
  const [urlInput, setUrlInput] = useState('')

  // Cuando se abre, intentar precargar codigoClub del config (sin lanzar detect)
  useEffect(() => {
    if (!open) return
    let cancelled = false
    ;(async () => {
      const r = await detectClubBasicsAction('').catch(() => null)
      if (cancelled || !r) return
      // Si hay código guardado en config, lo precargamos en el input
      if (r.usedCodigoClub && !codigoClub) setCodigoClub(r.usedCodigoClub)
    })()
    return () => { cancelled = true }
  }, [open, codigoClub])

  // Detect en 2 fases: basics + N chunks. Cliente orquesta el progreso.
  async function handleDetect() {
    if (!codigoClub.trim()) { toast.error('Pega el código del club RFFM (ej. 3824)'); return }

    setWizardResult(null)
    setWizardSelected(new Set())
    setDetectProgress({
      phase: 'basics',
      totalEquipos: 0,
      processedEquipos: 0,
      chunksDone: 0,
      chunksTotal: 0,
      currentMessage: 'Cargando lista de equipos del club…',
    })

    // ── Fase 1: basics ───────────────────────────────────────────
    const basicsRes = await detectClubBasicsAction(codigoClub.trim()).catch(e => ({
      success: false as const,
      error: (e as Error).message,
    }))

    if (!basicsRes.success || !('result' in basicsRes) || !basicsRes.result) {
      setDetectProgress({
        phase: 'error',
        totalEquipos: 0,
        processedEquipos: 0,
        chunksDone: 0,
        chunksTotal: 0,
        currentMessage: basicsRes.error ?? 'Error',
      })
      toast.error(basicsRes.error ?? 'Error cargando equipos del club')
      return
    }

    const basics = basicsRes.result
    const equipos = basics.equipos
    const CHUNK_SIZE = 12
    const chunks: string[][] = []
    for (let i = 0; i < equipos.length; i += CHUNK_SIZE) {
      chunks.push(equipos.slice(i, i + CHUNK_SIZE).map((e) => e.codigo_equipo))
    }

    setDetectProgress({
      phase: 'chunks',
      totalEquipos: equipos.length,
      processedEquipos: 0,
      chunksDone: 0,
      chunksTotal: chunks.length,
      currentMessage: `${equipos.length} equipos detectados. Resolviendo competiciones en ${chunks.length} pasadas…`,
    })

    // ── Fase 2: N chunks secuenciales ────────────────────────────
    const allMatched: AnyMatched[] = []
    const allWarnings: string[] = []
    const resolvedSet = new Set<string>()

    for (let i = 0; i < chunks.length; i++) {
      setDetectProgress({
        phase: 'chunks',
        totalEquipos: equipos.length,
        processedEquipos: i * CHUNK_SIZE,
        chunksDone: i,
        chunksTotal: chunks.length,
        currentMessage: `Resolviendo grupo ${i + 1} de ${chunks.length} (${chunks[i].length} equipos)…`,
      })

      const r = await detectClubChunkAction(codigoClub.trim(), chunks[i]).catch(e => ({
        success: false as const,
        error: (e as Error).message,
      }))

      if (!r.success || !('result' in r) || !r.result) {
        // Si falla un chunk concreto, seguimos con el resto pero anotamos
        allWarnings.push(`Chunk ${i + 1} falló: ${r.error ?? 'error'}`)
        continue
      }
      allMatched.push(...r.result.matched)
      for (const c of r.result.resolvedEquipoCodigos) resolvedSet.add(c)
      allWarnings.push(...r.result.warnings)
    }

    const okCount = resolvedSet.size
    const failedCount = equipos.length - okCount

    const totalResult = {
      matched: allMatched,
      total: equipos.length,
      okCount,
      failedCount,
      competitionCount: allMatched.length,
      durationMs: Date.now() - 0, // referencial, no exacto
      warnings: allWarnings,
      nombreClub: basics.nombreClub,
    }

    setWizardResult(totalResult)
    const all = new Set<number>(allMatched.map((_: AnyMatched, idx: number) => idx))
    setWizardSelected(all)
    setDetectProgress({
      phase: 'done',
      totalEquipos: equipos.length,
      processedEquipos: equipos.length,
      chunksDone: chunks.length,
      chunksTotal: chunks.length,
      currentMessage: `${allMatched.length} competiciones detectadas (${okCount}/${equipos.length} equipos OK)`,
    })
    toast.success(`✓ ${allMatched.length} competiciones detectadas`)
  }

  function handleCreateWizard() {
    if (!wizardResult || wizardSelected.size === 0) { toast.error('Selecciona al menos una competición'); return }
    const selected = [...wizardSelected]
      .sort((a, b) => a - b)
      .map(i => wizardResult.matched[i])
    startTransition(async () => {
      const toastId = toast.loading(`Creando ${selected.length} competiciones…`)
      const r = await bulkInsertWizardResults(selected)
      toast.dismiss(toastId)
      if (r.success) {
        toast.success(`✓ Creadas ${r.inserted} · Actualizadas ${r.updated}${r.skipped ? ` · Saltadas ${r.skipped}` : ''}`)
        onClose()
        router.refresh()
      } else {
        toast.error(r.error ?? 'Error creando')
      }
    })
  }

  function handleReset() {
    startTransition(async () => {
      const r = await resetClubRffmConfig({ wipeAll })
      if (r.success && r.deleted) {
        const summary = `Borradas ${r.deleted.tracked_competitions} competiciones, ${r.deleted.matches} partidos, ${r.deleted.standings} clasificaciones${
          wipeAll ? `, ${r.deleted.scouting_signals} señales y ${r.deleted.players} perfiles cache` : ''
        }`
        toast.success(summary)
        setShowResetConfirm(false)
        // Reset state local y refresh
        setWizardResult(null)
        setWizardSelected(new Set())
        router.refresh()
      } else {
        toast.error(r.error ?? 'Error en reset')
      }
    })
  }

  // ── PDF fallback handlers ──────────────────────────────────────────

  function handleParsePdf(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const file = fd.get('file') as File | null
    if (!file || !file.name) { toast.error('Selecciona un PDF'); return }
    setPdfResult(null)
    setPdfMatchResult(null)
    setPdfSelected(new Set())
    startTransition(async () => {
      const r = await parseClubPdfAction(fd)
      if (r.success && r.result) {
        setPdfResult(r.result)
        toast.success(`Detectadas ${r.result.rows.length} competiciones en el PDF`)
      } else {
        toast.error(r.error ?? 'Error parseando PDF')
      }
    })
  }

  function handleMatchPdf() {
    if (!pdfResult?.rows?.length) { toast.error('Parsea primero el PDF'); return }
    if (!codigoClub.trim()) { toast.error('Pega el código del club RFFM arriba'); return }
    startTransition(async () => {
      const toastId = toast.loading('Matcheando con RFFM (puede tardar 20-30s)…')
      const r = await matchClubPdfRows(pdfResult.rows, codigoClub.trim())
      toast.dismiss(toastId)
      if (r.success && r.result) {
        setPdfMatchResult(r.result)
        const ok = new Set<number>(
          r.result.matched
            .map((m: AnyMatched, i: number) => (m.cod_competicion && m.cod_grupo) ? i : -1)
            .filter((i: number) => i >= 0),
        )
        setPdfSelected(ok)
        toast.success(`OK: ${r.result.okCount} · Parcial: ${r.result.partialCount} · Sin match: ${r.result.failedCount}`)
      } else {
        toast.error(r.error ?? 'Error matcheando')
      }
    })
  }

  function handleResolveRow(idx: number, applyToSimilar: boolean) {
    if (!urlInput.trim()) { toast.error('Pega la URL primero'); return }
    if (!codigoClub.trim()) { toast.error('Pega el código del club arriba'); return }
    const target = pdfMatchResult?.matched[idx]
    if (!target) return
    startTransition(async () => {
      const r = await resolveRowWithUrl(target.pdf, urlInput.trim(), codigoClub.trim())
      if (!r.success || !r.row) { toast.error(r.error ?? 'No se pudo resolver'); return }
      const newMatched = [...pdfMatchResult.matched]
      newMatched[idx] = r.row
      const newSel = new Set(pdfSelected)
      if (r.row.cod_competicion && r.row.cod_grupo) newSel.add(idx)
      let count = 1

      if (applyToSimilar) {
        for (let i = 0; i < newMatched.length; i++) {
          if (i === idx) continue
          const m = newMatched[i]
          const same = m.pdf.categoria === target.pdf.categoria &&
                       m.pdf.competicion === target.pdf.competicion &&
                       m.pdf.grupo === target.pdf.grupo
          if (same && (!m.cod_competicion || !m.cod_grupo)) {
            const r2 = await resolveRowWithUrl(m.pdf, urlInput.trim(), codigoClub.trim())
            if (r2.success && r2.row) {
              newMatched[i] = r2.row
              if (r2.row.cod_competicion && r2.row.cod_grupo) newSel.add(i)
              count++
            }
          }
        }
      }

      setPdfMatchResult({ ...pdfMatchResult, matched: newMatched })
      setPdfSelected(newSel)
      setResolvingIdx(null)
      setUrlInput('')
      toast.success(count > 1 ? `${count} filas resueltas` : 'Resuelta')
    })
  }

  function handleResolveUnparsed(rawLine: string) {
    if (!urlInput.trim()) { toast.error('Pega la URL primero'); return }
    if (!codigoClub.trim()) { toast.error('Pega el código del club arriba'); return }
    const fabricated = {
      equipo: rawLine.length > 60 ? rawLine.slice(0, 60) + '…' : rawLine,
      categoria: '',
      competicion: '',
      grupo: '',
      raw: rawLine,
    }
    startTransition(async () => {
      const r = await resolveRowWithUrl(fabricated, urlInput.trim(), codigoClub.trim())
      if (!r.success || !r.row) { toast.error(r.error ?? 'Error resolviendo'); return }
      const newMatched = [...(pdfMatchResult?.matched ?? []), r.row]
      const newUnparsed = (pdfResult?.unparsed ?? []).filter((u: string) => u !== rawLine)
      const newSel = new Set(pdfSelected)
      if (r.row.cod_competicion && r.row.cod_grupo) newSel.add(newMatched.length - 1)
      setPdfMatchResult({
        ...(pdfMatchResult ?? { okCount: 0, partialCount: 0, failedCount: 0, total: 0 }),
        matched: newMatched,
      })
      setPdfResult({ ...pdfResult, unparsed: newUnparsed })
      setPdfSelected(newSel)
      setResolvingUnparsed(null)
      setUrlInput('')
      toast.success('Línea resuelta y añadida')
    })
  }

  function handleBulkInsertPdf() {
    if (!pdfMatchResult || pdfSelected.size === 0) { toast.error('Selecciona al menos una fila'); return }
    const selected = [...pdfSelected].sort((a, b) => a - b).map(i => pdfMatchResult.matched[i])
    startTransition(async () => {
      const toastId = toast.loading(`Insertando ${selected.length} competiciones…`)
      const r = await bulkInsertTrackedFromPdf(selected)
      toast.dismiss(toastId)
      if (r.success) {
        const errors = r.perRow?.filter(x => x.status === 'error') ?? []
        if (errors.length) {
          toast.error(`${errors.length} con error · ${r.inserted} creadas · ${r.updated} actualizadas`)
        } else {
          toast.success(`✓ ${r.inserted} creadas · ${r.updated} actualizadas`)
          onClose()
          router.refresh()
        }
      } else {
        toast.error(r.error ?? 'Error insertando')
      }
    })
  }

  const canShowReset = trackedCompsCount > 0

  if (!open) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl max-w-3xl w-full max-h-[92vh] flex flex-col" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="p-5 border-b border-gray-100 flex items-start justify-between gap-3">
          <div>
            <h3 className="font-semibold text-gray-900 text-base">⚡ Configurar competiciones del club</h3>
            <p className="text-xs text-gray-500 mt-0.5">
              Detecta automáticamente todos tus equipos y sus competiciones desde la web RFFM.
              No necesitas el PDF ni pegar URLs.
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
        </div>

        {/* Mode tabs */}
        <div className="flex border-b border-gray-100 px-5">
          <button
            onClick={() => setMode('wizard')}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px ${
              mode === 'wizard'
                ? 'border-blue-500 text-blue-700'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            ⚡ Auto-detectar (recomendado)
          </button>
          <button
            onClick={() => setMode('pdf')}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px ${
              mode === 'pdf'
                ? 'border-blue-500 text-blue-700'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            📄 Subir PDF (avanzado)
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Input código club (compartido por ambos modos) */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Código de tu club en RFFM
            </label>
            <div className="flex gap-2">
              <input
                value={codigoClub}
                onChange={e => setCodigoClub(e.target.value)}
                placeholder="3824 o https://www.rffm.es/fichaclub/3824"
                className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-md font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {mode === 'wizard' && (
                <button
                  onClick={handleDetect}
                  disabled={
                    !codigoClub.trim() ||
                    (detectProgress != null && detectProgress.phase !== 'idle' && detectProgress.phase !== 'done' && detectProgress.phase !== 'error')
                  }
                  className="px-4 py-2 text-sm rounded-md bg-blue-600 hover:bg-blue-700 text-white font-medium disabled:opacity-50 whitespace-nowrap"
                >
                  {detectProgress && (detectProgress.phase === 'basics' || detectProgress.phase === 'chunks')
                    ? 'Detectando…'
                    : '🔍 Detectar'}
                </button>
              )}
            </div>
            <p className="text-[11px] text-gray-500 mt-1">
              Lo encuentras en la URL de cualquier ficha de club: <code className="bg-gray-100 px-1 rounded">rffm.es/fichaclub/<strong>3824</strong></code>
            </p>
          </div>

          {/* MODO WIZARD */}
          {mode === 'wizard' && wizardResult && (
            <div className="space-y-3">
              {/* Resumen */}
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3">
                <p className="font-medium text-emerald-900 text-sm">
                  ✓ Detectadas {wizardResult.competitionCount} competiciones de {wizardResult.total} equipos del club
                </p>
                <p className="text-xs text-emerald-700 mt-0.5">
                  {wizardResult.okCount} equipos OK · {wizardResult.failedCount} sin detectar · {(wizardResult.durationMs / 1000).toFixed(1)}s
                </p>
                {wizardResult.warnings.length > 0 && (
                  <details className="mt-2">
                    <summary className="text-xs text-emerald-700 cursor-pointer">
                      Avisos ({wizardResult.warnings.length})
                    </summary>
                    <ul className="mt-1 space-y-0.5 text-[11px] text-emerald-800 max-h-32 overflow-y-auto">
                      {wizardResult.warnings.map((w: string, i: number) => (
                        <li key={i}>• {w}</li>
                      ))}
                    </ul>
                  </details>
                )}
              </div>

              {/* Selección + ver detalle */}
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm text-gray-700">
                  <strong>{wizardSelected.size}</strong> de {wizardResult.competitionCount} seleccionadas
                </p>
                <div className="flex gap-1 text-xs">
                  <button
                    onClick={() => setWizardSelected(new Set(wizardResult.matched.map((_: AnyMatched, i: number) => i)))}
                    className="text-blue-600 hover:underline"
                  >
                    Todas
                  </button>
                  <span className="text-gray-300">·</span>
                  <button
                    onClick={() => setWizardSelected(new Set())}
                    className="text-blue-600 hover:underline"
                  >
                    Ninguna
                  </button>
                  <span className="text-gray-300">·</span>
                  <button
                    onClick={() => setShowWizardDetail(v => !v)}
                    className="text-blue-600 hover:underline"
                  >
                    {showWizardDetail ? 'Ocultar detalle' : 'Ver detalle'}
                  </button>
                </div>
              </div>

              {/* Tabla de detalle */}
              {showWizardDetail && (
                <div className="border border-gray-200 rounded-md max-h-96 overflow-y-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-gray-50 text-gray-600 sticky top-0">
                      <tr>
                        <th className="text-center px-1 py-1.5 w-8"></th>
                        <th className="text-left px-2 py-1.5">Equipo</th>
                        <th className="text-left px-2 py-1.5">Competición · Grupo</th>
                      </tr>
                    </thead>
                    <tbody>
                      {wizardResult.matched.map((m: AnyMatched, i: number) => {
                        const checked = wizardSelected.has(i)
                        return (
                          <tr key={i} className={`border-t border-gray-100 ${checked ? 'bg-blue-50/40' : ''}`}>
                            <td className="text-center px-1 py-1.5">
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={(e) => {
                                  const next = new Set(wizardSelected)
                                  if (e.target.checked) next.add(i)
                                  else next.delete(i)
                                  setWizardSelected(next)
                                }}
                              />
                            </td>
                            <td className="px-2 py-1.5">
                              <div className="font-medium truncate max-w-[180px]">{m.nombre_equipo_nuestro}</div>
                              <div className="text-[10px] text-gray-500 font-mono">cod {m.codigo_equipo_nuestro}</div>
                            </td>
                            <td className="px-2 py-1.5">
                              <div className="truncate max-w-[280px]">{m.nombre_competicion}</div>
                              <div className="text-[10px] text-gray-500">{m.nombre_grupo}</div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* MODO WIZARD: progreso del detect en chunks */}
          {mode === 'wizard' && detectProgress && detectProgress.phase !== 'idle' && detectProgress.phase !== 'done' && (
            <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
              <div className="flex items-center gap-2 mb-2">
                {detectProgress.phase === 'error' ? (
                  <span className="text-red-600 text-lg">✕</span>
                ) : (
                  <span className="inline-block w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                )}
                <p className="text-sm font-medium text-blue-900">
                  {detectProgress.phase === 'error' ? 'Error' : 'Detectando…'}
                </p>
              </div>
              <p className="text-xs text-blue-800">{detectProgress.currentMessage}</p>
              {detectProgress.phase === 'chunks' && detectProgress.chunksTotal > 0 && (
                <>
                  <div className="mt-2 h-2 bg-blue-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-600 transition-all duration-300"
                      style={{ width: `${(detectProgress.chunksDone / detectProgress.chunksTotal) * 100}%` }}
                    />
                  </div>
                  <p className="text-[11px] text-blue-700 mt-1">
                    {detectProgress.chunksDone} / {detectProgress.chunksTotal} pasadas · {detectProgress.processedEquipos} / {detectProgress.totalEquipos} equipos
                  </p>
                </>
              )}
            </div>
          )}

          {/* MODO WIZARD: estado vacío inicial */}
          {mode === 'wizard' && !wizardResult && !detectProgress && (
            <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
              <p className="text-sm text-blue-900 font-medium">¿Qué hace este botón?</p>
              <ol className="text-xs text-blue-800 mt-2 space-y-1 list-decimal list-inside">
                <li>Descarga la lista de equipos de tu club desde RFFM</li>
                <li>Por cada equipo, busca su competición y grupo activos</li>
                <li>Verifica con la clasificación que tu equipo está en ese grupo</li>
                <li>Te muestra TODAS las competiciones detectadas para que confirmes y crees</li>
              </ol>
              <p className="text-xs text-blue-700 mt-2">
                Detecta competiciones múltiples por equipo (ej. Senior A en Liga + Copa) y subgrupos por fase (ej. Prebenjamines en Grupo 32 + Subgrupo 32A).
              </p>
              <p className="text-[11px] text-blue-700 mt-2 italic">
                Para clubes grandes (60+ equipos) la detección se divide en pasadas para no exceder el timeout de Vercel. Verás una barra de progreso.
              </p>
            </div>
          )}

          {/* MODO PDF */}
          {mode === 'pdf' && (
            <div className="space-y-3">
              <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
                Modo avanzado: parsea el PDF <code className="bg-white px-1 rounded">NFG_VisCompeticiones_Club</code> de RFFM.
                Solo úsalo si el modo automático no detecta alguna competición específica.
              </div>

              <form onSubmit={handleParsePdf} className="flex gap-2 items-center flex-wrap">
                <input
                  type="file"
                  name="file"
                  accept="application/pdf"
                  required
                  className="text-sm file:mr-3 file:rounded-md file:border-0 file:bg-slate-900 file:px-3 file:py-1.5 file:text-white file:cursor-pointer"
                />
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-3 py-1.5 text-sm rounded-md bg-emerald-600 hover:bg-emerald-700 text-white font-medium disabled:opacity-50"
                >
                  {isPending ? 'Parseando…' : 'Parsear PDF'}
                </button>
              </form>

              {pdfResult && (
                <>
                  <p className="text-sm text-gray-700">
                    {pdfResult.rows.length} filas detectadas en PDF
                    {pdfResult.unparsed.length > 0 && ` · ${pdfResult.unparsed.length} no parseadas`}
                  </p>

                  <button
                    onClick={handleMatchPdf}
                    disabled={isPending || !codigoClub.trim()}
                    className="w-full px-4 py-2 text-sm rounded-md bg-blue-600 hover:bg-blue-700 text-white font-medium disabled:opacity-50"
                  >
                    {isPending ? 'Matcheando…' : '🔗 Matchear con RFFM'}
                  </button>

                  {pdfResult.unparsed.length > 0 && (
                    <details open className="text-xs">
                      <summary className="cursor-pointer font-medium text-amber-700">
                        ⚠ Líneas no parseadas ({pdfResult.unparsed.length}) — pega URL para resolver
                      </summary>
                      <ul className="mt-2 space-y-2">
                        {pdfResult.unparsed.map((u: string, i: number) => (
                          <li key={i} className="bg-amber-50/60 border border-amber-200 px-2 py-1.5 rounded text-[11px]">
                            <div className="flex items-start justify-between gap-2 font-mono">
                              <span className="flex-1 break-all">{u}</span>
                              <button
                                onClick={() => setResolvingUnparsed(resolvingUnparsed === u ? null : u)}
                                className="shrink-0 text-blue-600 hover:underline whitespace-nowrap font-sans"
                              >
                                🔗 URL
                              </button>
                            </div>
                            {resolvingUnparsed === u && (
                              <div className="mt-1.5 space-y-1">
                                <input
                                  value={urlInput}
                                  onChange={(e) => setUrlInput(e.target.value)}
                                  placeholder="https://www.rffm.es/competicion/clasificaciones?..."
                                  className="w-full text-[10px] px-2 py-1 border border-gray-300 rounded font-mono"
                                  autoFocus
                                />
                                <div className="flex gap-1">
                                  <button
                                    onClick={() => handleResolveUnparsed(u)}
                                    disabled={isPending}
                                    className="text-[10px] px-2 py-0.5 bg-blue-600 hover:bg-blue-700 text-white rounded font-sans"
                                  >
                                    Resolver
                                  </button>
                                  <button
                                    onClick={() => { setResolvingUnparsed(null); setUrlInput('') }}
                                    className="text-[10px] px-2 py-0.5 text-gray-500 font-sans"
                                  >
                                    ×
                                  </button>
                                </div>
                              </div>
                            )}
                          </li>
                        ))}
                      </ul>
                    </details>
                  )}
                </>
              )}

              {pdfMatchResult && (
                <div className="space-y-2">
                  <p className="text-xs text-gray-600">
                    <span className="text-emerald-700">✓ {pdfMatchResult.okCount}</span> ·
                    <span className="text-amber-700"> ⚠ {pdfMatchResult.partialCount}</span> ·
                    <span className="text-red-700"> ✗ {pdfMatchResult.failedCount}</span> · {pdfSelected.size} seleccionadas
                  </p>
                  <div className="border border-gray-200 rounded-md max-h-72 overflow-y-auto">
                    <table className="w-full text-xs">
                      <thead className="bg-gray-50 text-gray-600 sticky top-0">
                        <tr>
                          <th className="text-center px-1 py-1.5 w-8"></th>
                          <th className="text-left px-2 py-1.5">Equipo</th>
                          <th className="text-left px-2 py-1.5">Comp · Grupo</th>
                          <th className="text-left px-2 py-1.5 w-32">Estado</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pdfMatchResult.matched.map((m: AnyMatched, i: number) => {
                          const ok = m.cod_competicion && m.cod_grupo
                          const eqOk = !!m.codigo_equipo_nuestro
                          const checked = pdfSelected.has(i)
                          return (
                            <tr key={i} className={`border-t border-gray-100 ${checked ? 'bg-blue-50/40' : ''}`}>
                              <td className="text-center px-1 py-1.5">
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  disabled={!ok}
                                  onChange={(e) => {
                                    const next = new Set(pdfSelected)
                                    if (e.target.checked) next.add(i)
                                    else next.delete(i)
                                    setPdfSelected(next)
                                  }}
                                />
                              </td>
                              <td className="px-2 py-1.5">
                                <div className="font-medium truncate max-w-[160px]">{m.pdf.equipo}</div>
                                {m.nombre_equipo_nuestro && m.nombre_equipo_nuestro !== m.pdf.equipo && (
                                  <div className="text-[10px] text-gray-500 truncate max-w-[160px]">→ {m.nombre_equipo_nuestro}</div>
                                )}
                              </td>
                              <td className="px-2 py-1.5">
                                <div className="truncate max-w-[260px]">{m.nombre_competicion ?? m.pdf.competicion}</div>
                                <div className="text-[10px] text-gray-500">{m.nombre_grupo ?? m.pdf.grupo}</div>
                              </td>
                              <td className="px-2 py-1.5">
                                <div className="flex items-center justify-between gap-1">
                                  <div>
                                    {ok && eqOk && <span className="text-emerald-700">✓</span>}
                                    {ok && !eqOk && <span className="text-amber-700">⚠</span>}
                                    {!ok && m.cod_competicion && <span className="text-amber-700">⚠ Sin grupo</span>}
                                    {!m.cod_competicion && <span className="text-red-700">✗ Sin comp</span>}
                                  </div>
                                  {!ok && (
                                    <button
                                      onClick={() => setResolvingIdx(resolvingIdx === i ? null : i)}
                                      className="text-[10px] text-blue-600 hover:underline whitespace-nowrap"
                                    >
                                      🔗
                                    </button>
                                  )}
                                </div>
                                {resolvingIdx === i && (
                                  <div className="mt-1 space-y-1">
                                    <input
                                      value={urlInput}
                                      onChange={(e) => setUrlInput(e.target.value)}
                                      placeholder="URL RFFM"
                                      className="w-full text-[10px] px-1 py-0.5 border border-gray-300 rounded font-mono"
                                      autoFocus
                                    />
                                    <div className="flex gap-1">
                                      <button onClick={() => handleResolveRow(i, false)} disabled={isPending} className="text-[10px] px-1.5 py-0.5 bg-blue-600 text-white rounded">OK</button>
                                      <button onClick={() => handleResolveRow(i, true)} disabled={isPending} className="text-[10px] px-1.5 py-0.5 bg-emerald-600 text-white rounded" title="Aplicar a similares">+sim</button>
                                      <button onClick={() => { setResolvingIdx(null); setUrlInput('') }} className="text-[10px] px-1.5 py-0.5 text-gray-500">×</button>
                                    </div>
                                  </div>
                                )}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer con acciones */}
        <div className="p-4 border-t border-gray-100 flex items-center justify-between gap-3 flex-wrap">
          <div>
            {canShowReset && !showResetConfirm && (
              <button
                onClick={() => setShowResetConfirm(true)}
                className="px-3 py-1.5 text-xs rounded-md border border-red-200 bg-red-50 hover:bg-red-100 text-red-700"
              >
                🗑 Empezar de cero ({trackedCompsCount})
              </button>
            )}
            {showResetConfirm && (
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs text-red-700">¿Borrar las {trackedCompsCount} competiciones?</span>
                <label className="flex items-center gap-1 text-[10px] text-red-700">
                  <input
                    type="checkbox"
                    checked={wipeAll}
                    onChange={e => setWipeAll(e.target.checked)}
                  />
                  + señales scouting
                </label>
                <button
                  onClick={handleReset}
                  disabled={isPending}
                  className="px-2 py-1 text-xs rounded bg-red-600 hover:bg-red-700 text-white font-medium"
                >
                  {isPending ? 'Borrando…' : 'Sí, borrar'}
                </button>
                <button
                  onClick={() => setShowResetConfirm(false)}
                  className="px-2 py-1 text-xs text-gray-600"
                >
                  Cancelar
                </button>
              </div>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm rounded-md border border-gray-300 hover:bg-gray-50"
            >
              Cerrar
            </button>
            {mode === 'wizard' && wizardResult && (
              <button
                onClick={handleCreateWizard}
                disabled={isPending || wizardSelected.size === 0}
                className="px-4 py-2 text-sm rounded-md bg-emerald-600 hover:bg-emerald-700 text-white font-medium disabled:opacity-50"
              >
                {isPending ? 'Creando…' : `Crear ${wizardSelected.size} competiciones`}
              </button>
            )}
            {mode === 'pdf' && pdfMatchResult && (
              <button
                onClick={handleBulkInsertPdf}
                disabled={isPending || pdfSelected.size === 0}
                className="px-4 py-2 text-sm rounded-md bg-emerald-600 hover:bg-emerald-700 text-white font-medium disabled:opacity-50"
              >
                {isPending ? 'Creando…' : `Crear ${pdfSelected.size} competiciones`}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
