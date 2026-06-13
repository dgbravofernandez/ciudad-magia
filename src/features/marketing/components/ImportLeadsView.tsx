'use client'

import { useState, useTransition, useRef } from 'react'
import { toast } from 'sonner'
import { Upload, Check, AlertCircle, FileSpreadsheet, ChevronRight } from 'lucide-react'
import { previewLeadsImport, confirmLeadsImport, type PreviewResult } from '../actions/import-leads.actions'
import type { ColumnMapping } from '../lib/excel-parser'

type Stage = 'upload' | 'preview' | 'done'

interface DoneStats { imported: number; duplicates: number; skipped: number; auto_excluded: number; auto_high_priority: number }

const FIELDS: Array<{ key: keyof ColumnMapping; label: string; required: boolean; hint: string }> = [
  { key: 'name',       label: 'Nombre del club',  required: true,  hint: 'Identifica el club (obligatorio)' },
  { key: 'email',      label: 'Email contacto',   required: true,  hint: 'Sin esto no se puede importar la fila' },
  { key: 'location',   label: 'Localidad',        required: false, hint: 'Para personalizar el mensaje' },
  { key: 'federation', label: 'Federación / Liga', required: false, hint: 'Si no está en el Excel, se usará el origen' },
  { key: 'website',    label: 'Web',              required: false, hint: 'Opcional' },
  { key: 'phone',      label: 'Teléfono',         required: false, hint: 'Opcional' },
]

const FEDERATION_SUGGESTIONS = [
  'RFFM Madrid', 'FFSCM Fútbol Sala Madrid',
  'FCF Cataluña', 'RFAF Andalucía', 'FFCV Valencia',
  'FFCM Castilla-La Mancha', 'FCYLF Castilla y León',
  'FGF Galicia', 'FFPA Asturias', 'FCF Canarias',
  'FAF Aragón', 'FFRM Murcia', 'FFV Vasca', 'FNF Navarra',
]

export function ImportLeadsView() {
  const fileRef = useRef<HTMLInputElement>(null)
  const [isPending, startTransition] = useTransition()
  const [stage, setStage] = useState<Stage>('upload')
  const [fileName, setFileName] = useState('')
  const [preview, setPreview] = useState<PreviewResult | null>(null)
  const [mapping, setMapping] = useState<ColumnMapping>({ name: null, email: null, location: null, federation: null, website: null, phone: null })
  const [importedFrom, setImportedFrom] = useState('')
  const [defaultLocation, setDefaultLocation] = useState('')
  const [done, setDone] = useState<DoneStats | null>(null)

  function handleFile(file: File) {
    if (file.size > 5 * 1024 * 1024) { toast.error('Máximo 5 MB'); return }
    setFileName(file.name)
    const reader = new FileReader()
    reader.onload = () => {
      const arrayBuf = reader.result as ArrayBuffer
      const bytes = new Uint8Array(arrayBuf)
      let binary = ''
      for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i])
      const base64 = btoa(binary)
      startTransition(async () => {
        const res = await previewLeadsImport(base64)
        if (!res.success) { toast.error(res.error); return }
        setPreview(res)
        setMapping(res.detectedColumns)
        // Sugerir origen por nombre del archivo
        const guess = guessFederationFromFilename(file.name)
        if (guess) setImportedFrom(guess)
        setStage('preview')
      })
    }
    reader.onerror = () => toast.error('No se pudo leer el archivo')
    reader.readAsArrayBuffer(file)
  }

  function guessFederationFromFilename(name: string): string | null {
    const lower = name.toLowerCase()
    for (const sug of FEDERATION_SUGGESTIONS) {
      const tokens = sug.toLowerCase().split(/\s+/)
      if (tokens.some(t => t.length >= 3 && lower.includes(t))) return sug
    }
    return null
  }

  function handleConfirm() {
    if (!preview) return
    if (!mapping.name || !mapping.email) { toast.error('Falta mapear las columnas obligatorias (Nombre y Email)'); return }
    if (!importedFrom.trim()) { toast.error('Indica el origen de los leads (ej: "FCF Cataluña")'); return }
    startTransition(async () => {
      const res = await confirmLeadsImport({
        fileBase64: preview.fileBase64,
        mapping,
        importedFrom: importedFrom.trim(),
        defaultLocation: defaultLocation.trim() || undefined,
      })
      if (!res.success) { toast.error(res.error); return }
      setDone({
        imported: res.imported ?? 0,
        duplicates: res.duplicates ?? 0,
        skipped: res.skipped ?? 0,
        auto_excluded: res.auto_excluded ?? 0,
        auto_high_priority: res.auto_high_priority ?? 0,
      })
      setStage('done')
    })
  }

  function reset() {
    setStage('upload')
    setPreview(null)
    setMapping({ name: null, email: null, location: null, federation: null, website: null, phone: null })
    setImportedFrom('')
    setDefaultLocation('')
    setFileName('')
    setDone(null)
    if (fileRef.current) fileRef.current.value = ''
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Importar leads</h1>
        <p className="text-sm text-slate-400 mt-1">Sube un Excel o CSV con clubes de cualquier federación. Las columnas se detectan automáticamente.</p>
      </div>

      {/* Progress */}
      <div className="flex items-center gap-3 text-xs">
        {(['upload', 'preview', 'done'] as Stage[]).map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            <div className={`w-7 h-7 rounded-full flex items-center justify-center font-bold ${
              stage === s ? 'bg-pink-500 text-white' :
              (['preview', 'done'].includes(stage) && i === 0) || (stage === 'done' && i === 1) ? 'bg-emerald-700 text-emerald-200' :
              'bg-slate-800 text-slate-500'
            }`}>{i + 1}</div>
            <span className="text-slate-400 capitalize">{s === 'upload' ? 'Subir' : s === 'preview' ? 'Revisar' : 'Hecho'}</span>
            {i < 2 && <ChevronRight className="w-4 h-4 text-slate-700" />}
          </div>
        ))}
      </div>

      {/* Stage 1 — Upload */}
      {stage === 'upload' && (
        <div className="bg-slate-900 border-2 border-dashed border-slate-700 rounded-xl p-12 text-center">
          <FileSpreadsheet className="w-12 h-12 mx-auto mb-4 text-pink-400" />
          <h2 className="text-white font-bold text-lg mb-2">Arrastra el Excel aquí o haz clic</h2>
          <p className="text-sm text-slate-400 mb-6">Acepta .xlsx, .xls y .csv hasta 5 MB</p>
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
          />
          <button
            onClick={() => fileRef.current?.click()}
            disabled={isPending}
            className="px-6 py-3 rounded-lg bg-pink-500 text-white hover:bg-pink-400 font-bold disabled:opacity-50"
          >
            <Upload className="w-4 h-4 inline mr-2" />
            {isPending ? 'Procesando...' : 'Elegir archivo'}
          </button>
          <div className="mt-8 text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
            <p className="font-semibold text-slate-400 mb-2">Detecta automáticamente columnas con nombres como:</p>
            <p>"Club", "Entidad", "Email", "Correo", "Localidad", "Población", "Federación", "Liga", "Teléfono", "Web"...</p>
            <p className="mt-3">Si tu Excel usa otros nombres, podrás mapearlos a mano en el siguiente paso.</p>
          </div>
        </div>
      )}

      {/* Stage 2 — Preview & mapping */}
      {stage === 'preview' && preview && (
        <div className="space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
            <p className="text-sm text-slate-400 mb-3">Archivo: <strong className="text-white">{fileName}</strong></p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Stat label="Filas totales" value={preview.totalRows} />
              <Stat label="Con email válido" value={preview.rowsWithEmail} color="text-emerald-400" />
              <Stat label="Sin email" value={preview.totalRows - preview.rowsWithEmail} color="text-amber-400" />
              <Stat label="Cabeceras detectadas" value={preview.headers.length} />
            </div>
          </div>

          {/* Origin */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3">
            <h3 className="text-white font-semibold">Origen de estos leads</h3>
            <input
              type="text"
              value={importedFrom}
              onChange={(e) => setImportedFrom(e.target.value)}
              placeholder='ej: "FCF Cataluña"'
              list="federations"
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-white text-sm"
            />
            <datalist id="federations">
              {FEDERATION_SUGGESTIONS.map(s => <option key={s} value={s} />)}
            </datalist>
            <input
              type="text"
              value={defaultLocation}
              onChange={(e) => setDefaultLocation(e.target.value)}
              placeholder='Localidad por defecto si falta en la columna (ej: "Cataluña")'
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-white text-sm"
            />
          </div>

          {/* Column mapping */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
            <h3 className="text-white font-semibold mb-3">Mapeo de columnas</h3>
            <p className="text-xs text-slate-500 mb-4">La detección automática usó tus cabeceras. Cambia si algún campo se mapeó mal.</p>
            <div className="space-y-2">
              {FIELDS.map(f => (
                <div key={f.key} className="grid grid-cols-3 gap-3 items-center">
                  <div>
                    <div className="text-sm text-white font-medium">
                      {f.label}
                      {f.required && <span className="text-pink-400 ml-1">*</span>}
                    </div>
                    <div className="text-xs text-slate-500">{f.hint}</div>
                  </div>
                  <select
                    value={mapping[f.key] ?? ''}
                    onChange={(e) => setMapping({ ...mapping, [f.key]: e.target.value || null })}
                    className="col-span-2 px-3 py-2 bg-slate-800 border border-slate-700 rounded text-white text-sm"
                  >
                    <option value="">— sin asignar —</option>
                    {preview.headers.map(h => <option key={h} value={h}>{h}</option>)}
                  </select>
                </div>
              ))}
            </div>
          </div>

          {/* Sample */}
          {preview.sample.length > 0 && (
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
              <h3 className="text-white font-semibold mb-3">Vista previa (primeras {preview.sample.length} filas)</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-slate-500 border-b border-slate-800">
                      <th className="text-left py-1.5 px-2">Club</th>
                      <th className="text-left py-1.5 px-2">Email</th>
                      <th className="text-left py-1.5 px-2">Ubicación</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.sample.map((r, i) => (
                      <tr key={i} className="border-b border-slate-800/50">
                        <td className="py-1.5 px-2 text-white">{r.name}</td>
                        <td className="py-1.5 px-2 text-slate-400">{r.email ?? <em className="text-amber-500">sin email</em>}</td>
                        <td className="py-1.5 px-2 text-slate-500">{r.location ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-2">
            <button onClick={reset} className="px-4 py-2 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 text-sm">Cancelar</button>
            <button
              onClick={handleConfirm}
              disabled={isPending || !mapping.name || !mapping.email || !importedFrom.trim()}
              className="flex-1 px-4 py-2 rounded-lg bg-pink-500 text-white hover:bg-pink-400 font-bold disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isPending ? 'Importando...' : `Importar ${preview.rowsWithEmail} clubes →`}
            </button>
          </div>
        </div>
      )}

      {/* Stage 3 — Done */}
      {stage === 'done' && done && (
        <div className="bg-slate-900 border border-emerald-800 rounded-xl p-8 text-center">
          <div className="w-16 h-16 rounded-full bg-emerald-900/60 flex items-center justify-center mx-auto mb-4">
            <Check className="w-8 h-8 text-emerald-300" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">¡Importado!</h2>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mt-6 max-w-3xl mx-auto">
            <Stat label="Nuevos importados" value={done.imported} color="text-emerald-400" />
            <Stat label="Duplicados saltados" value={done.duplicates} color="text-slate-400" />
            <Stat label="Sin email" value={done.skipped} color="text-amber-400" />
            <Stat label="Auto-excluidos" value={done.auto_excluded} color="text-amber-400" />
            <Stat label="Prioridad alta" value={done.auto_high_priority} color="text-pink-400" />
          </div>
          <p className="text-sm text-slate-400 mt-6">
            Los duplicados son clubes que ya tenías en tu base. Los auto-excluidos son SAD/profesionales. Los de prioridad alta entran primero en la próxima tanda del cron.
          </p>
          <div className="mt-6 flex justify-center gap-2">
            <button onClick={reset} className="px-4 py-2 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 text-sm">Importar otro</button>
            <a href="/superadmin/campanas" className="px-4 py-2 rounded-lg bg-pink-500 text-white hover:bg-pink-400 font-bold text-sm">Ver clubes →</a>
          </div>
        </div>
      )}
    </div>
  )
}

function Stat({ label, value, color = 'text-slate-200' }: { label: string; value: number; color?: string }) {
  return (
    <div className="bg-slate-800/50 rounded p-3 text-center">
      <div className={`text-2xl font-bold ${color}`}>{value}</div>
      <div className="text-xs text-slate-500 mt-0.5">{label}</div>
    </div>
  )
}
