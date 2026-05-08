'use client'

import { useState, useEffect, useTransition, useRef } from 'react'
import { toast } from 'sonner'
import { Mail, ImageIcon, Calendar, Eye, EyeOff, Loader2, Save, Upload } from 'lucide-react'
import { saveAssignmentEmailConfig, getAssignmentEmailConfig, type AssignmentEmailConfig } from '@/features/configuracion/actions/assignment-email.actions'
import { createClient } from '@/lib/supabase/client'

const DEFAULT_BODY = `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;border:3px solid #ffcc00;border-radius:12px;color:#333;">
  <h2 style="color:#000;text-align:center;margin-bottom:4px;">Asignación de equipo — Temporada {temporada}</h2>
  <p style="text-align:center;font-size:0.9em;color:#666;">Escuela de Fútbol Ciudad de Getafe</p>
  <hr style="border:none;border-top:1px solid #eee;margin:16px 0;" />
  <p>Hola <strong>{tutor_nombre}</strong>,</p>
  <p>Nos complace comunicaros que <strong>{jugador_nombre}</strong> ha sido asignado/a al equipo:</p>
  <div style="background:#fffbe6;border:2px solid #ffcc00;border-radius:8px;padding:14px;text-align:center;margin:16px 0;">
    <p style="margin:0;font-size:1.1em;font-weight:bold;">{equipo}</p>
    <p style="margin:4px 0 0;font-size:0.9em;color:#555;">Entrenador/a: {entrenador_nombre}</p>
  </div>
  <p>Para confirmar la plaza, os pedimos que realicéis el pago de la reserva de <strong>{importe_reserva}</strong> antes del <strong>{fecha_limite}</strong>.</p>
  <p>En caso de dudas, podéis poneros en contacto con nosotros respondiendo a este correo.</p>
  <hr style="border:none;border-top:1px solid #eee;margin:16px 0;" />
  <p style="text-align:center;font-size:0.85em;color:#888;">Un saludo,<br><strong>La Dirección — EF Ciudad de Getafe</strong></p>
</div>`

const PLACEHOLDERS = [
  { key: '{jugador_nombre}', desc: 'Nombre del jugador' },
  { key: '{tutor_nombre}', desc: 'Nombre del tutor' },
  { key: '{equipo}', desc: 'Equipo asignado (26/27)' },
  { key: '{entrenador_nombre}', desc: 'Entrenador del equipo 26/27' },
  { key: '{importe_reserva}', desc: 'Importe de la reserva de plaza' },
  { key: '{fecha_limite}', desc: 'Fecha límite de reserva' },
  { key: '{temporada}', desc: 'Temporada (ej. 26/27)' },
]

export function AssignmentEmailConfig() {
  const [config, setConfig] = useState<AssignmentEmailConfig>({
    fees_image_url: null,
    assignment_email_subject: null,
    assignment_email_body: null,
    reservation_deadline: null,
  })
  const [isPending, startTransition] = useTransition()
  const [uploading, setUploading] = useState(false)
  const [showPreview, setShowPreview] = useState(false)
  const [loading, setLoading] = useState(true)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    getAssignmentEmailConfig().then(r => {
      if (r.success && r.config) setConfig(r.config)
      setLoading(false)
    })
  }, [])

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      toast.error('Solo se aceptan imágenes (JPG, PNG, WEBP)')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('La imagen no puede superar 5 MB')
      return
    }

    setUploading(true)
    try {
      const sb = createClient()
      const ext = file.name.split('.').pop() ?? 'png'
      const path = `fees-${Date.now()}.${ext}`

      const { error: upErr } = await sb.storage
        .from('fees-images')
        .upload(path, file, { upsert: true, contentType: file.type })

      if (upErr) { toast.error('Error al subir imagen: ' + upErr.message); return }

      const { data: { publicUrl } } = sb.storage.from('fees-images').getPublicUrl(path)
      setConfig(c => ({ ...c, fees_image_url: publicUrl }))
      toast.success('Imagen subida correctamente')
    } catch (err) {
      toast.error('Error inesperado al subir imagen')
      console.error(err)
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  function handleSave() {
    startTransition(async () => {
      const r = await saveAssignmentEmailConfig(config)
      if (r.success) toast.success('Configuración guardada')
      else toast.error(r.error ?? 'Error al guardar')
    })
  }

  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <div className="h-5 w-40 bg-slate-100 rounded animate-pulse mb-4" />
        <div className="h-32 bg-slate-100 rounded animate-pulse" />
      </div>
    )
  }

  const previewHtml = (config.assignment_email_body || DEFAULT_BODY)
    .replaceAll('{jugador_nombre}', 'Pedro García')
    .replaceAll('{tutor_nombre}', 'María García')
    .replaceAll('{equipo}', 'Benjamín A')
    .replaceAll('{entrenador_nombre}', 'Juan Martínez')
    .replaceAll('{importe_reserva}', '50,00 €')
    .replaceAll('{fecha_limite}', '30 de junio de 2026')
    .replaceAll('{temporada}', '26/27')

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-5">
      <div className="flex items-center gap-2">
        <Mail className="w-5 h-5 text-violet-600" aria-hidden="true" />
        <h2 className="font-semibold text-slate-900">Email de asignación</h2>
      </div>

      {/* Asunto */}
      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">Asunto del email</label>
        <input
          type="text"
          value={config.assignment_email_subject ?? ''}
          onChange={e => setConfig(c => ({ ...c, assignment_email_subject: e.target.value }))}
          placeholder="Ej: Tu equipo para la temporada 26/27 — EF Ciudad de Getafe"
          className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-violet-500"
        />
      </div>

      {/* Imagen de cuotas */}
      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">
          <ImageIcon className="w-3.5 h-3.5 inline mr-1 align-text-bottom" aria-hidden="true" />
          Imagen de cuotas (se inserta en el email)
        </label>
        <div className="flex gap-3 items-start">
          <div className="flex-1">
            {config.fees_image_url ? (
              <div className="relative group w-fit">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={config.fees_image_url}
                  alt="Cuotas"
                  className="max-h-32 rounded-lg border border-slate-200 object-contain"
                />
                <button
                  onClick={() => setConfig(c => ({ ...c, fees_image_url: null }))}
                  className="absolute top-1 right-1 w-5 h-5 rounded-full bg-white/90 text-slate-600 hover:text-red-600 text-xs flex items-center justify-center border border-slate-200 opacity-0 group-hover:opacity-100 transition-opacity"
                  title="Quitar imagen"
                  aria-label="Quitar imagen de cuotas"
                >
                  ×
                </button>
              </div>
            ) : (
              <div className="h-16 border-2 border-dashed border-slate-200 rounded-lg flex items-center justify-center text-xs text-slate-400">
                Sin imagen
              </div>
            )}
          </div>
          <div>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              onChange={handleImageUpload}
              className="hidden"
              id="fees-image-upload"
            />
            <label
              htmlFor="fees-image-upload"
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs border border-slate-300 rounded-md bg-white hover:bg-slate-50 text-slate-700 cursor-pointer transition-colors"
            >
              {uploading
                ? <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
                : <Upload className="w-3.5 h-3.5" aria-hidden="true" />}
              {uploading ? 'Subiendo...' : 'Subir imagen'}
            </label>
            <p className="text-xs text-slate-400 mt-1">JPG, PNG · max 5 MB</p>
          </div>
        </div>
      </div>

      {/* Fecha límite */}
      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">
          <Calendar className="w-3.5 h-3.5 inline mr-1 align-text-bottom" aria-hidden="true" />
          Fecha límite de reserva
        </label>
        <input
          type="date"
          value={config.reservation_deadline ?? ''}
          onChange={e => setConfig(c => ({ ...c, reservation_deadline: e.target.value || null }))}
          className="px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-violet-500"
        />
      </div>

      {/* Cuerpo del email */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="block text-xs font-medium text-slate-600">Cuerpo del email (HTML)</label>
          <button
            onClick={() => setShowPreview(p => !p)}
            className="inline-flex items-center gap-1 text-xs text-violet-600 hover:text-violet-700"
          >
            {showPreview
              ? <><EyeOff className="w-3.5 h-3.5" aria-hidden="true" /> Editar</>
              : <><Eye className="w-3.5 h-3.5" aria-hidden="true" /> Previsualizar</>
            }
          </button>
        </div>

        {showPreview ? (
          <div className="border border-slate-200 rounded-lg overflow-hidden">
            <div className="bg-slate-50 px-3 py-1.5 text-xs text-slate-500 border-b border-slate-200 flex items-center gap-1">
              <Eye className="w-3 h-3" aria-hidden="true" />
              Vista previa con datos de ejemplo
            </div>
            <div
              className="p-4 max-h-80 overflow-y-auto"
              dangerouslySetInnerHTML={{ __html: previewHtml }}
            />
            {config.fees_image_url && (
              <div className="px-4 pb-4">
                <p className="text-xs text-slate-400 mb-2">Imagen de cuotas (se añade al final):</p>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={config.fees_image_url} alt="Cuotas" className="max-w-full rounded border border-slate-200" />
              </div>
            )}
          </div>
        ) : (
          <>
            <textarea
              value={config.assignment_email_body ?? ''}
              onChange={e => setConfig(c => ({ ...c, assignment_email_body: e.target.value }))}
              placeholder={DEFAULT_BODY}
              rows={12}
              className="w-full px-3 py-2 text-xs font-mono border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-violet-500 resize-y"
            />
            <button
              type="button"
              onClick={() => setConfig(c => ({ ...c, assignment_email_body: DEFAULT_BODY }))}
              className="text-xs text-slate-400 hover:text-slate-600 mt-1 underline"
            >
              Restaurar plantilla por defecto
            </button>
          </>
        )}
      </div>

      {/* Placeholders */}
      <div>
        <p className="text-xs font-medium text-slate-600 mb-2">Variables disponibles</p>
        <div className="flex flex-wrap gap-1.5">
          {PLACEHOLDERS.map(p => (
            <span
              key={p.key}
              title={p.desc}
              className="text-xs font-mono bg-violet-50 text-violet-700 border border-violet-200 px-2 py-0.5 rounded cursor-help"
            >
              {p.key}
            </span>
          ))}
        </div>
      </div>

      {/* Guardar */}
      <button
        onClick={handleSave}
        disabled={isPending || uploading}
        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-violet-600 hover:bg-violet-700 text-white font-semibold text-sm disabled:opacity-50 transition-colors"
      >
        {isPending
          ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
          : <Save className="w-4 h-4" aria-hidden="true" />}
        Guardar configuración
      </button>
    </div>
  )
}
