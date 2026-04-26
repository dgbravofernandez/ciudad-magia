'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { ExternalLink, FileSpreadsheet, CheckCircle, AlertCircle, Loader2 } from 'lucide-react'
import { exportToBackendSheet, checkBackendSheet } from '@/features/integraciones/actions/backend-sheet.actions'

const STORAGE_KEY = 'cm_backend_sheet_id'

export function IntegracionesPage() {
  const [sheetId, setSheetId] = useState<string>(() => {
    if (typeof window !== 'undefined') return localStorage.getItem(STORAGE_KEY) ?? ''
    return ''
  })
  const [isPending, startTransition] = useTransition()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [lastExport, setLastExport] = useState<any>(null)
  const [meta, setMeta] = useState<{ title: string; url: string; tabs: string[] } | null>(null)

  function persistId() {
    localStorage.setItem(STORAGE_KEY, sheetId.trim())
  }

  function handleCheck() {
    if (!sheetId.trim()) { toast.error('Pega el ID de la hoja primero'); return }
    persistId()
    startTransition(async () => {
      const r = await checkBackendSheet(sheetId.trim())
      if (r.success && r.data) {
        setMeta(r.data)
        toast.success(`Acceso OK a "${r.data.title}"`)
      } else {
        setMeta(null)
        toast.error(r.error ?? 'Sin acceso')
      }
    })
  }

  function handleExport() {
    if (!sheetId.trim()) { toast.error('Pega el ID de la hoja primero'); return }
    persistId()
    startTransition(async () => {
      const toastId = toast.loading('Exportando todas las tablas a Sheets…')
      const r = await exportToBackendSheet(sheetId.trim())
      toast.dismiss(toastId)
      if (r.success && r.result) {
        setLastExport(r.result)
        toast.success(`Exportadas ${r.result.tabs.length} pestañas · ${r.result.totalRows} filas · ${r.result.errorCount} errores`)
      } else {
        toast.error(r.error ?? 'Error en exportación')
      }
    })
  }

  const sheetUrl = sheetId.trim() ? `https://docs.google.com/spreadsheets/d/${sheetId.trim()}` : null

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
              como respaldo y para consulta.
            </p>
          </div>
        </div>

        {/* Setup */}
        <details className="mb-4 bg-slate-50 rounded-lg p-3 text-sm text-slate-700">
          <summary className="font-medium cursor-pointer">¿Cómo lo configuro? (primera vez)</summary>
          <ol className="list-decimal list-inside mt-2 space-y-1.5 text-sm">
            <li>Crea una hoja de cálculo nueva en <a href="https://sheets.new" target="_blank" rel="noreferrer" className="text-blue-600 underline">sheets.new</a></li>
            <li>Pulsa <strong>Compartir</strong> arriba a la derecha</li>
            <li>
              Comparte con la cuenta de servicio (busca este email en tu .env como
              <code className="bg-white px-1 mx-1 rounded">GOOGLE_SERVICE_ACCOUNT_EMAIL</code>)
              dándole permiso <strong>Editor</strong>
            </li>
            <li>Copia el ID de la URL: en <code className="bg-white px-1 mx-1 rounded">.../spreadsheets/d/<strong>ESTE_ES_EL_ID</strong>/edit</code></li>
            <li>Pégalo abajo, dale a <strong>Comprobar</strong> y luego <strong>Exportar ahora</strong></li>
          </ol>
        </details>

        {/* Input ID */}
        <label className="block text-xs font-medium text-slate-600 mb-1">ID de la hoja</label>
        <div className="flex gap-2 mb-3">
          <input
            value={sheetId}
            onChange={e => setSheetId(e.target.value)}
            placeholder="1AbCdEf...xyz"
            className="flex-1 px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
          />
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

        {/* Botones */}
        <div className="flex gap-2">
          <button
            onClick={handleCheck}
            disabled={isPending}
            className="px-4 py-2 text-sm rounded-md border border-slate-300 hover:bg-slate-50 disabled:opacity-50 flex items-center gap-2"
          >
            {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
            Comprobar acceso
          </button>
          <button
            onClick={handleExport}
            disabled={isPending}
            className="px-4 py-2 text-sm rounded-md bg-emerald-600 hover:bg-emerald-700 text-white font-medium disabled:opacity-50 flex items-center gap-2"
          >
            {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileSpreadsheet className="w-4 h-4" />}
            Exportar ahora
          </button>
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
