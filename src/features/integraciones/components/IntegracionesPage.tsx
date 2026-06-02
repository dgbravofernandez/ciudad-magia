'use client'

import { useEffect, useState, useTransition, useCallback } from 'react'
import { toast } from 'sonner'
import { ExternalLink, FileSpreadsheet, CheckCircle, AlertCircle, Loader2, Save, Sparkles, LogOut, Mail } from 'lucide-react'
import {
  exportToBackendSheet,
  saveBackendSheetId,
  getBackendSheetConfig,
  createBackendSheet,
  getGoogleAuthUrl,
  disconnectGoogle,
  type BackendSheetConfig,
} from '@/features/integraciones/actions/backend-sheet.actions'
import {
  getRffmConfig,
  saveRffmCodigoClub,
} from '@/features/integraciones/actions/rffm-config.actions'
import {
  getDocsSheetConfig,
  saveDocsSheetConfig,
} from '@/features/integraciones/actions/backend-sheet.actions'

export function IntegracionesPage() {
  const [config, setConfig] = useState<BackendSheetConfig | null>(null)
  const [draftId, setDraftId] = useState('')
  const [isPending, startTransition] = useTransition()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [lastExport, setLastExport] = useState<any>(null)
const [loading, setLoading] = useState(true)

  // Config RFFM
  const [rffmCodigo, setRffmCodigo] = useState<string>('')
  const [rffmDraft, setRffmDraft] = useState<string>('')
  const [rffmSaving, setRffmSaving] = useState(false)

  // Config hojas de documentos + formulario entrenadores
  const [docsSheetId,    setDocsSheetId]    = useState('')
  const [tutorsSheetId,  setTutorsSheetId]  = useState('')
  const [coachesFormLink, setCoachesFormLink] = useState('')
  const [docsSaving, setDocsSaving] = useState(false)

  const reloadConfig = useCallback(async () => {
    const r = await getBackendSheetConfig()
    if (r.success && r.config) {
      setConfig(r.config)
      setDraftId(r.config.sheetId ?? '')
    } else if (r.error) {
      toast.error(r.error)
    }
  }, [])

  // Cargar config inicial + leer resultado OAuth del query param
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const [r, rffm, docs] = await Promise.all([
        getBackendSheetConfig(),
        getRffmConfig(),
        getDocsSheetConfig(),
      ])
      if (cancelled) return
      if (r.success && r.config) {
        setConfig(r.config)
        setDraftId(r.config.sheetId ?? '')
      } else if (r.error) {
        toast.error(r.error)
      }
      if (rffm.success) {
        const c = rffm.codigoClub ?? ''
        setRffmCodigo(c)
        setRffmDraft(c)
      }
      if (docs.success) {
        setDocsSheetId(docs.docsSheetId ?? '')
        setTutorsSheetId(docs.tutorsSheetId ?? '')
        setCoachesFormLink(docs.coachesFormLink ?? '')
      }
      setLoading(false)

      // Mostrar resultado del callback OAuth (si viene de la redirección)
      const params = new URLSearchParams(window.location.search)
      const google = params.get('google')
      if (google === 'connected') {
        toast.success('¡Cuenta Google conectada correctamente!')
        window.history.replaceState({}, '', window.location.pathname)
      } else if (google === 'denied') {
        toast.error('Acceso denegado. Vuelve a intentarlo.')
        window.history.replaceState({}, '', window.location.pathname)
      } else if (google === 'no_refresh') {
        toast.error('Google no envió el token. Desconecta y vuelve a intentarlo.')
        window.history.replaceState({}, '', window.location.pathname)
      } else if (google === 'error') {
        toast.error('Error en la conexión con Google.')
        window.history.replaceState({}, '', window.location.pathname)
      }
    })()
    return () => { cancelled = true }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function handleSaveRffmCodigo() {
    if (!rffmDraft.trim()) { toast.error('Pega el código o la URL'); return }
    setRffmSaving(true)
    ;(async () => {
      const r = await saveRffmCodigoClub(rffmDraft.trim())
      setRffmSaving(false)
      if (r.success) {
        // Re-leer del backend para que se aplique extracción de URL
        const fresh = await getRffmConfig()
        if (fresh.success) {
          setRffmCodigo(fresh.codigoClub ?? '')
          setRffmDraft(fresh.codigoClub ?? '')
        }
        toast.success('Código RFFM guardado')
      } else {
        toast.error(r.error ?? 'Error guardando')
      }
    })()
  }

  function handleConnectGoogle() {
    startTransition(async () => {
      const r = await getGoogleAuthUrl()
      if (r.success && r.url) {
        window.location.href = r.url
      } else {
        toast.error(r.error ?? 'No se pudo generar el enlace de autorización')
      }
    })
  }

  function handleDisconnectGoogle() {
    if (!confirm('¿Desconectar la cuenta Google?')) return
    startTransition(async () => {
      const r = await disconnectGoogle()
      if (r.success) {
        toast.success('Cuenta Google desconectada')
        await reloadConfig()
      } else {
        toast.error(r.error ?? 'Error')
      }
    })
  }

  function handleCreate() {
    startTransition(async () => {
      const toastId = toast.loading('Creando hoja en Google Drive…')
      const r = await createBackendSheet()
      toast.dismiss(toastId)
      if (r.success && r.sheetId && r.url) {
        setConfig(c => c ? { ...c, sheetId: r.sheetId! } : c)
        setDraftId(r.sheetId!)
        toast.success('¡Hoja creada! Pulsa "Exportar ahora" para volcar los datos.')
        window.open(r.url, '_blank')
      } else {
        toast.error(r.error ?? 'Error al crear la hoja')
      }
    })
  }

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
      {/* Sección: Código del club RFFM */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <div className="flex items-start gap-3 mb-4">
          <ExternalLink className="w-6 h-6 text-blue-600 mt-0.5" />
          <div>
            <h2 className="text-base font-semibold text-slate-900">Código del club en RFFM</h2>
            <p className="text-sm text-slate-500 mt-0.5">
              Identificador del club en la web de RFFM. Lo usamos para auto-detectar
              <strong> código de equipo nuestro</strong> en cada competición que sigues, y para
              el bulk-import desde el PDF de competiciones.
              Lo encuentras en la URL: <code className="bg-slate-100 px-1 rounded">rffm.es/fichaclub/<strong>3824</strong></code>
            </p>
          </div>
        </div>

        <label className="block text-xs font-medium text-slate-600 mb-1">Código (o URL completa)</label>
        <div className="flex gap-2">
          <input
            value={rffmDraft}
            onChange={(e) => setRffmDraft(e.target.value)}
            placeholder="3824 o https://www.rffm.es/fichaclub/3824"
            className="flex-1 px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
          />
          <button
            onClick={handleSaveRffmCodigo}
            disabled={rffmSaving || !rffmDraft.trim() || rffmDraft.trim() === rffmCodigo}
            className="px-3 py-2 text-sm rounded-md bg-slate-900 hover:bg-slate-800 text-white disabled:opacity-40 flex items-center gap-1.5"
          >
            {rffmSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Guardar
          </button>
        </div>
        {rffmCodigo && (
          <p className="text-xs text-emerald-700 mt-2 flex items-center gap-1">
            <CheckCircle className="w-3 h-3" /> Guardado: <code className="font-mono">{rffmCodigo}</code>
            <a
              href={`https://www.rffm.es/fichaclub/${rffmCodigo}`}
              target="_blank"
              rel="noreferrer"
              className="ml-2 text-blue-600 hover:underline"
            >
              Verificar en RFFM ↗
            </a>
          </p>
        )}
      </div>

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

        {/* ── Conexión con Google ── */}
        <div className="mb-5 rounded-lg border border-slate-200 overflow-hidden">
          {config?.hasOAuthToken ? (
            /* Conectado via OAuth */
            <div className="flex items-center justify-between gap-3 px-4 py-3 bg-emerald-50">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-emerald-900">Cuenta Google conectada</p>
                  {config.googleEmail && (
                    <p className="text-xs text-emerald-700 flex items-center gap-1">
                      <Mail className="w-3 h-3" /> {config.googleEmail}
                    </p>
                  )}
                </div>
              </div>
              <button
                onClick={handleDisconnectGoogle}
                disabled={isPending}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md border border-emerald-300 bg-white hover:bg-red-50 hover:border-red-300 hover:text-red-700 text-emerald-700 transition-colors disabled:opacity-50"
              >
                <LogOut className="w-3 h-3" /> Desconectar
              </button>
            </div>
          ) : config?.hasServiceAccount ? (
            /* Service account configurada pero sin OAuth */
            <div className="px-4 py-3 bg-slate-50 text-sm text-slate-600">
              <p className="font-medium text-slate-700 mb-0.5">Usando service account</p>
              <p className="text-xs text-slate-500">
                O conecta tu cuenta Google personal para gestionar las hojas desde tu Drive.
              </p>
              <button
                onClick={handleConnectGoogle}
                disabled={isPending}
                className="mt-2 flex items-center gap-2 px-3 py-1.5 rounded-md border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-medium disabled:opacity-50"
              >
                {isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <span>G</span>}
                Conectar con Google
              </button>
            </div>
          ) : (
            /* Sin credenciales — mostrar opciones */
            <div className="p-4">
              <p className="text-sm font-semibold text-slate-800 mb-1">Conecta Google Sheets</p>
              <p className="text-xs text-slate-500 mb-3">
                Elige cómo autorizar la app para crear y escribir en hojas de cálculo.
              </p>
              <button
                onClick={handleConnectGoogle}
                disabled={isPending}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-white border-2 border-slate-300 hover:border-blue-400 text-slate-700 font-medium text-sm disabled:opacity-50 transition-colors"
              >
                {isPending
                  ? <Loader2 className="w-4 h-4 animate-spin" />
                  : <svg className="w-4 h-4" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>}
                Conectar con mi cuenta Google
              </button>
              <p className="text-xs text-slate-400 text-center mt-1.5">
                Requiere <code className="bg-slate-100 px-1 rounded">GOOGLE_CLIENT_ID</code> y{' '}
                <code className="bg-slate-100 px-1 rounded">GOOGLE_CLIENT_SECRET</code> en Vercel
              </p>
            </div>
          )}
        </div>

        {/* Opción principal: crear hoja automáticamente */}
        {!config?.sheetId && (
          <div className="mb-5">
            <button
              onClick={handleCreate}
              disabled={isPending}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm disabled:opacity-50 transition-colors"
            >
              {isPending
                ? <Loader2 className="w-4 h-4 animate-spin" />
                : <Sparkles className="w-4 h-4" />}
              Crear hoja automáticamente
            </button>
            <p className="text-xs text-slate-500 text-center mt-1.5">
              La aplicación crea y gestiona la hoja. No necesitas compartir nada.
            </p>
          </div>
        )}

        {/* Si ya hay hoja configurada: mostrar estado + botón abrir */}
        {config?.sheetId && (
          <div className="mb-4 flex items-center justify-between gap-3 p-3 rounded-lg bg-emerald-50 border border-emerald-200">
            <div className="min-w-0">
              <p className="text-sm font-medium text-emerald-900 flex items-center gap-1.5">
                <CheckCircle className="w-4 h-4 shrink-0" /> Hoja configurada
              </p>
              <p className="text-xs text-emerald-700 font-mono truncate mt-0.5">{config.sheetId}</p>
              {config.lastSync && (
                <p className="text-xs text-slate-500 mt-0.5">
                  Último export: {new Date(config.lastSync).toLocaleString('es-ES')}
                </p>
              )}
            </div>
            <div className="flex gap-2 shrink-0">
              {sheetUrl && (
                <a
                  href={sheetUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="px-3 py-1.5 text-xs border border-emerald-300 rounded-md bg-white hover:bg-emerald-50 text-emerald-800 flex items-center gap-1"
                >
                  <ExternalLink className="w-3 h-3" /> Abrir
                </a>
              )}
              <button
                onClick={handleCreate}
                disabled={isPending}
                className="px-3 py-1.5 text-xs border border-slate-300 rounded-md bg-white hover:bg-slate-50 text-slate-600 flex items-center gap-1 disabled:opacity-50"
                title="Crea una hoja nueva y reemplaza la configuración actual"
              >
                {isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                Nueva hoja
              </button>
            </div>
          </div>
        )}

        {/* Opción secundaria: pegar URL de hoja existente */}
        <details className="mb-4">
          <summary className="text-xs text-slate-500 cursor-pointer hover:text-slate-700 select-none">
            ▸ Ya tengo una hoja — pegar URL manualmente
          </summary>
          <div className="mt-2 flex gap-2">
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
          </div>
        </details>

        {/* Exportar */}
        <div className="border-t border-slate-100 pt-4">
          <div className="flex gap-2">
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

      {/* ── Sección: Hojas de documentos + formulario entrenadores ── */}
      <div className="card p-5 space-y-4">
        <div className="flex items-center gap-2 mb-1">
          <FileSpreadsheet className="w-5 h-5 text-primary" />
          <h3 className="font-semibold text-base">Configuración adicional</h3>
        </div>
        <p className="text-sm text-muted-foreground">
          Configura las hojas de Google que usa <strong>Sincronizar documentos</strong> y el formulario de inscripción del cuerpo técnico.
        </p>

        <div className="grid grid-cols-1 gap-3">
          <div className="space-y-1">
            <label className="label text-sm">Hoja de documentos (ID de Google Sheets)</label>
            <p className="text-xs text-muted-foreground">Usada en Jugadores → Sincronizar documentos. Copia el ID de la URL de tu hoja (la parte larga entre /d/ y /edit).</p>
            <input
              type="text"
              className="input w-full font-mono text-sm"
              value={docsSheetId}
              onChange={e => setDocsSheetId(e.target.value)}
              placeholder="1KnZXtnMK28HgIjNSsp6..."
            />
          </div>
          <div className="space-y-1">
            <label className="label text-sm">Hoja de inscripciones/tutores (ID de Google Sheets)</label>
            <p className="text-xs text-muted-foreground">Segunda hoja usada en Sincronizar documentos para datos de tutores.</p>
            <input
              type="text"
              className="input w-full font-mono text-sm"
              value={tutorsSheetId}
              onChange={e => setTutorsSheetId(e.target.value)}
              placeholder="15YzC25MdHBJ3OGb..."
            />
          </div>
          <div className="space-y-1">
            <label className="label text-sm">Link formulario de inscripción — cuerpo técnico</label>
            <p className="text-xs text-muted-foreground">Se incluye en los emails de invitación a entrenadores. Déjalo vacío si no tienes formulario.</p>
            <input
              type="url"
              className="input w-full text-sm"
              value={coachesFormLink}
              onChange={e => setCoachesFormLink(e.target.value)}
              placeholder="https://forms.gle/..."
            />
          </div>
        </div>

        <button
          type="button"
          disabled={docsSaving}
          onClick={async () => {
            setDocsSaving(true)
            const r = await saveDocsSheetConfig({
              docsSheetId:    docsSheetId.trim() || null,
              tutorsSheetId:  tutorsSheetId.trim() || null,
              coachesFormLink: coachesFormLink.trim() || null,
            })
            setDocsSaving(false)
            if (r.success) toast.success('Configuración guardada')
            else toast.error(r.error ?? 'Error al guardar')
          }}
          className="btn-primary flex items-center gap-2 self-start"
        >
          {docsSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Guardar configuración
        </button>
      </div>
    </div>
  )
}
