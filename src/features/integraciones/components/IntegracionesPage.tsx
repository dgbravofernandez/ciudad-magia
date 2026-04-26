'use client'

import { useEffect, useState, useTransition } from 'react'
import { toast } from 'sonner'
import { ExternalLink, FileSpreadsheet, CheckCircle, AlertCircle, Loader2, Copy, Save } from 'lucide-react'
import {
  exportToBackendSheet,
  checkBackendSheet,
  saveBackendSheetId,
  getBackendSheetConfig,
  type BackendSheetConfig,
} from '@/features/integraciones/actions/backend-sheet.actions'

export function IntegracionesPage() {
  const [config, setConfig] = useState<BackendSheetConfig | null>(null)
  const [draftId, setDraftId] = useState('')
  const [isPending, startTransition] = useTransition()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [lastExport, setLastExport] = useState<any>(null)
  const [meta, setMeta] = useState<{ title: string; url: string; tabs: string[] } | null>(null)
  const [loading, setLoading] = useState(true)

  // Cargar config inicial
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const r = await getBackendSheetConfig()
      if (cancelled) return
      if (r.success && r.config) {
        setConfig(r.config)
        setDraftId(r.config.sheetId ?? '')
      } else if (r.error) {
        toast.error(r.error)
      }
      setLoading(false)
    })()
    return () => { cancelled = true }
  }, [])

  function handleSave() {
    if (!draftId.trim()) { toast.error('Pega el ID o la URL primero'); return }
    startTransition(async () => {
      const r = await saveBackendSheetId(draftId.trim())
      if (r.success && r.sheetId) {
        setConfig(c => c ? { ...c, sheetId: r.sheetId! } : c)
        setDraftId(r.sheetId)
        toast.success('ID guardado')
      } else {
        toast.error(r.error ?? 'Error guardando')
      }
    })
  }

  function handleCheck() {
    if (!config?.sheetId) { toast.error('Guarda el ID primero'); return }
    startTransition(async () => {
      const r = await checkBackendSheet()
      if (r.success && r.data) {
        setMeta(r.data)
        toast.success(`Acceso OK a "${r.data.title}"`)
      } else {
        setMeta(null)
        toast.error(r.error ?? 'Sin acceso. ¿Has compartido la hoja con el email de la service account?')
      }
    })
  }

  function handleExport() {
    if (!config?.sheetId) { toast.error('Guarda el ID primero'); return }
    startTransition(async () => {
      const toastId = toast.loading('Exportando todas las tablas a Sheets…')
      const r = await exportToBackendSheet()
      toast.dismiss(toastId)
      if (r.success && r.result) {
        setLastExport(r.result)
        // Recargar config para tener el lastSync nuevo
        const c = await getBackendSheetConfig()
        if (c.success && c.config) setConfig(c.config)
        toast.success(`Exportadas ${r.result.tabs.length} pestañas · ${r.result.totalRows} filas · ${r.result.errorCount} errores`)
      } else {
        toast.error(r.error ?? 'Error en exportación')
      }
    })
  }

  function copyEmail() {
    if (!config?.serviceAccountEmail) return
    navigator.clipboard.writeText(config.serviceAccountEmail)
    toast.success('Email copiado al portapapeles')
  }

  const sheetUrl = config?.sheetId ? `https://docs.google.com/spreadsheets/d/${config.sheetId}` : null
  const draftDiffersFromSaved = draftId.trim() && draftId.trim() !== (config?.sheetId ?? '')

  if (loading) {
    return <div className="text-sm text-slate-500">Cargando configuración…</div>
  }

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Sección: Backend Sheet */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <div className="flex items-start gap-3 mb-4">
          <FileSpreadsheet className="w-6 h-6 text-emerald-600 mt-0.5" />
          <div>
            <h2 className="text-base font-semibold text-slate-900">Backend en Google Sheets</h2>
            <p className="text-sm text-slate-500 mt-0.5">
              Vuelca todas las tablas importantes (jugadores, pagos, gastos, transferencias,
              cierres caja, lesiones, sanciones, cartas de prueba…) a una hoja de cálculo
              como respaldo y para consulta. Configuración guardada en BD.
            </p>
          </div>
        </div>

        {/* PASO 1: Compartir hoja con service account */}
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3">
          <p className="text-sm font-medium text-amber-900 mb-1.5">
            Paso 1 · Comparte la hoja con esta cuenta como <strong>Editor</strong>:
          </p>
          {config?.serviceAccountEmail ? (
            <div className="flex items-center gap-2">
              <code className="flex-1 px-2 py-1.5 text-xs bg-white border border-amber-300 rounded font-mono text-slate-800 truncate" title={config.serviceAccountEmail}>
                {config.serviceAccountEmail}
              </code>
              <button
                onClick={copyEmail}
                className="px-2.5 py-1.5 text-xs rounded-md bg-amber-600 hover:bg-amber-700 text-white flex items-center gap-1"
              >
                <Copy className="w-3 h-3" /> Copiar
              </button>
            </div>
          ) : (
            <p className="text-xs text-amber-800">
              ⚠️ No encuentro el email de la service account en las variables de entorno.
              Necesitas <code>GOOGLE_SERVICE_ACCOUNT_EMAIL</code> o <code>GOOGLE_SERVICE_ACCOUNT_KEY</code>.
            </p>
          )}
          <p className="text-xs text-amber-800 mt-2">
            En la hoja → <strong>Compartir</strong> (arriba derecha) → pega el email → cambia a <strong>Editor</strong> → Enviar.
          </p>
        </div>

        {/* PASO 2: Pegar ID o URL */}
        <label className="block text-xs font-medium text-slate-600 mb-1">
          Paso 2 · ID o URL completa de la hoja
        </label>
        <div className="flex gap-2 mb-3">
          <input
            value={draftId}
            onChange={e => setDraftId(e.target.value)}
            placeholder="https://docs.google.com/spreadsheets/d/..."
            className="flex-1 px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
          />
          <button
            onClick={handleSave}
            disabled={isPending || !draftDiffersFromSaved}
            className="px-3 py-2 text-sm rounded-md bg-slate-900 hover:bg-slate-800 text-white disabled:opacity-40 flex items-center gap-1.5"
          >
            {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Guardar
          </button>
          {sheetUrl && (
            <a
              href={sheetUrl}
              target="_blank"
              rel="noreferrer"
              className="px-3 py-2 text-sm border border-slate-300 rounded-md hover:bg-slate-50 flex items-center gap-1.5"
            >
              <ExternalLink className="w-4 h-4" /> Abrir
            </a>
          )}
        </div>

        {config?.sheetId && (
          <p className="text-xs text-slate-500 mb-3 font-mono break-all">
            Guardado: {config.sheetId}
            {config.lastSync && (
              <span className="text-slate-400 ml-2">
                · último export: {new Date(config.lastSync).toLocaleString('es-ES')}
              </span>
            )}
          </p>
        )}

        {/* PASO 3: Exportar */}
        <div className="border-t border-slate-100 pt-4 mt-4">
          <p className="text-xs font-medium text-slate-600 mb-2">Paso 3 · Comprobar y exportar</p>
          <div className="flex gap-2">
            <button
              onClick={handleCheck}
              disabled={isPending || !config?.sheetId}
              className="px-4 py-2 text-sm rounded-md border border-slate-300 hover:bg-slate-50 disabled:opacity-50 flex items-center gap-2"
            >
              {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
              Comprobar acceso
            </button>
            <button
              onClick={handleExport}
              disabled={isPending || !config?.sheetId}
              className="px-4 py-2 text-sm rounded-md bg-emerald-600 hover:bg-emerald-700 text-white font-medium disabled:opacity-50 flex items-center gap-2"
            >
              {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileSpreadsheet className="w-4 h-4" />}
              Exportar ahora
            </button>
          </div>
        </div>

        {/* Resultado check */}
        {meta && (
          <div className="mt-4 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm">
            <div className="flex items-center gap-2 font-medium text-emerald-900">
              <CheckCircle className="w-4 h-4" /> Acceso confirmado a &quot;{meta.title}&quot;
            </div>
            {meta.tabs.length > 0 && (
              <p className="text-xs text-emerald-800 mt-1">
                Pestañas existentes: {meta.tabs.join(', ')}
              </p>
            )}
          </div>
        )}

        {/* Resultado export */}
        {lastExport && (
          <div className={`mt-4 rounded-md border p-3 text-sm ${
            lastExport.errorCount === 0
              ? 'border-emerald-200 bg-emerald-50'
              : 'border-amber-200 bg-amber-50'
          }`}>
            <div className="flex items-center gap-2 font-medium mb-2">
              {lastExport.errorCount === 0
                ? <CheckCircle className="w-4 h-4 text-emerald-700" />
                : <AlertCircle className="w-4 h-4 text-amber-700" />
              }
              Última exportación: {lastExport.totalRows} filas en {lastExport.tabs.length} pestañas
              {' · '}{(lastExport.durationMs / 1000).toFixed(1)}s
            </div>
            <table className="w-full text-xs">
              <thead className="text-slate-500">
                <tr><th className="text-left">Pestaña</th><th className="text-right">Filas</th><th className="text-left pl-3">Estado</th></tr>
              </thead>
              <tbody>
                {lastExport.tabs.map((t: { tab: string; rows: number; error?: string }) => (
                  <tr key={t.tab}>
                    <td className="py-0.5 font-medium">{t.tab}</td>
                    <td className="py-0.5 text-right">{t.rows}</td>
                    <td className="py-0.5 pl-3">
                      {t.error ? <span className="text-red-700">❌ {t.error}</span> : <span className="text-emerald-700">✓</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
