'use client'

import { useEffect, useState, useRef, useTransition } from 'react'
import { toast } from 'sonner'
import { Loader2, Save, RotateCcw, Send, Eye, Mail } from 'lucide-react'
import {
  EVENT_TYPES,
  listEmailTemplates,
  saveEmailTemplate,
  resetEmailTemplate,
  previewEmailTemplate,
  sendTestEmail,
  getVariablesCatalog,
  type EmailTemplateRow,
} from '@/features/configuracion/actions/email-templates.actions'

type CatalogVar = { key: string; desc: string; ejemplo: string }

export function PlantillasEmailPage() {
  const [templates, setTemplates] = useState<EmailTemplateRow[]>([])
  const [loading, setLoading] = useState(true)
  const [variables, setVariables] = useState<readonly CatalogVar[]>([])
  // eventKey seleccionado en la sidebar
  const [selectedKey, setSelectedKey] = useState<string>(EVENT_TYPES[0].key)
  const [subjectDraft, setSubjectDraft] = useState('')
  const [bodyDraft, setBodyDraft] = useState('')
  const [dirty, setDirty] = useState(false)
  const [previewHtml, setPreviewHtml] = useState<string>('')
  const [previewSubject, setPreviewSubject] = useState<string>('')
  const [isPending, startTransition] = useTransition()
  const bodyRef = useRef<HTMLTextAreaElement>(null)

  const selected = templates.find(t => t.event_type === selectedKey)
  const selectedMeta = EVENT_TYPES.find(e => e.key === selectedKey)
  const usingDefault = !selected?.id

  // Cargar al montar
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const [tpls, vars] = await Promise.all([
        listEmailTemplates(),
        getVariablesCatalog(),
      ])
      if (cancelled) return
      if (tpls.success && tpls.templates) setTemplates(tpls.templates)
      else if (tpls.error) toast.error(tpls.error)
      if (vars.success && vars.variables) setVariables(vars.variables)
      setLoading(false)
    })()
    return () => { cancelled = true }
  }, [])

  // Cuando cambia la plantilla seleccionada, cargar sus drafts
  useEffect(() => {
    if (!selected) return
    setSubjectDraft(selected.subject)
    setBodyDraft(selected.body_html)
    setDirty(false)
  }, [selectedKey, selected?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // Cuando cambian los drafts, regenerar preview (debounce 500ms)
  useEffect(() => {
    if (loading) return
    const t = setTimeout(async () => {
      const r = await previewEmailTemplate({
        eventType: selectedKey as 'fill_form',
        subjectOverride: subjectDraft || undefined,
        bodyOverride: bodyDraft || undefined,
      })
      if (r.success && r.html) {
        setPreviewHtml(r.html)
        setPreviewSubject(r.subject ?? '')
      }
    }, 500)
    return () => clearTimeout(t)
  }, [subjectDraft, bodyDraft, selectedKey, loading])

  function insertVariable(varKey: string) {
    const textarea = bodyRef.current
    if (!textarea) return
    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const before = bodyDraft.slice(0, start)
    const after = bodyDraft.slice(end)
    const token = `{{${varKey}}}`
    const newBody = before + token + after
    setBodyDraft(newBody)
    setDirty(true)
    // Reposicionar cursor tras la variable
    setTimeout(() => {
      textarea.focus()
      const pos = start + token.length
      textarea.setSelectionRange(pos, pos)
    }, 0)
  }

  function handleSave() {
    startTransition(async () => {
      const r = await saveEmailTemplate({
        eventType: selectedKey as 'fill_form',
        subject: subjectDraft,
        body_html: bodyDraft,
      })
      if (r.success) {
        toast.success('Plantilla guardada')
        const tpls = await listEmailTemplates()
        if (tpls.success && tpls.templates) setTemplates(tpls.templates)
        setDirty(false)
      } else {
        toast.error(r.error ?? 'Error guardando')
      }
    })
  }

  function handleReset() {
    if (!confirm('¿Restablecer esta plantilla al texto por defecto? Se perderán los cambios guardados.')) return
    startTransition(async () => {
      const r = await resetEmailTemplate(selectedKey as 'fill_form')
      if (r.success) {
        toast.success('Plantilla restablecida')
        const tpls = await listEmailTemplates()
        if (tpls.success && tpls.templates) setTemplates(tpls.templates)
      } else {
        toast.error(r.error ?? 'Error restableciendo')
      }
    })
  }

  function handleSendTest() {
    startTransition(async () => {
      const r = await sendTestEmail({
        eventType: selectedKey as 'fill_form',
        subjectOverride: dirty ? subjectDraft : undefined,
        bodyOverride: dirty ? bodyDraft : undefined,
      })
      if (r.success) toast.success(`Email de prueba enviado a ${r.sentTo}`)
      else toast.error(r.error ?? 'Error enviando prueba')
    })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-sm text-slate-500">
        <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Cargando plantillas…
      </div>
    )
  }

  return (
    <div className="grid grid-cols-12 gap-4 h-full max-h-[calc(100vh-120px)]">
      {/* ── Sidebar: lista de tipos ── */}
      <aside className="col-span-3 bg-white border border-slate-200 rounded-xl overflow-y-auto">
        <div className="px-3 py-2 border-b border-slate-100 text-xs font-semibold text-slate-500 uppercase tracking-wide">
          Tipos de email
        </div>
        <ul>
          {EVENT_TYPES.map(et => {
            const t = templates.find(x => x.event_type === et.key)
            const isSelected = et.key === selectedKey
            const isCustom = !!t?.id
            return (
              <li key={et.key}>
                <button
                  type="button"
                  onClick={() => {
                    if (dirty && !confirm('Tienes cambios sin guardar. ¿Cambiar de plantilla?')) return
                    setSelectedKey(et.key)
                  }}
                  className={`w-full text-left px-3 py-2.5 border-l-2 text-sm transition-colors ${
                    isSelected
                      ? 'bg-pink-50 border-pink-500 text-pink-900 font-semibold'
                      : 'border-transparent text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Mail className="w-3.5 h-3.5 shrink-0 text-slate-400" />
                    <span className="flex-1">{et.label}</span>
                    {isCustom && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 font-bold">
                        EDITADA
                      </span>
                    )}
                  </div>
                </button>
              </li>
            )
          })}
        </ul>
      </aside>

      {/* ── Editor ── */}
      <section className="col-span-5 bg-white border border-slate-200 rounded-xl overflow-y-auto p-5">
        <h2 className="text-base font-semibold text-slate-900 mb-1">{selectedMeta?.label}</h2>
        <p className="text-xs text-slate-500 mb-4">{selectedMeta?.description}</p>
        {usingDefault && (
          <div className="mb-4 px-3 py-2 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-800">
            Usando texto por defecto. En cuanto guardes cambios pasará a ser la plantilla personalizada de tu club.
          </div>
        )}

        <label className="block text-xs font-semibold text-slate-700 mb-1">Asunto</label>
        <input
          type="text"
          value={subjectDraft}
          onChange={e => { setSubjectDraft(e.target.value); setDirty(true) }}
          placeholder={selectedMeta?.label}
          className="w-full text-sm px-3 py-2 border border-slate-200 rounded-lg mb-4 font-mono"
        />

        <label className="block text-xs font-semibold text-slate-700 mb-1">Cuerpo del email</label>
        <p className="text-[11px] text-slate-500 mb-2">
          Escribe en texto normal. Usa el botón de variables abajo para insertar datos (nombre del jugador, equipo, etc.).
          El logo y los colores de tu club se aplican automáticamente al enviar.
        </p>
        <textarea
          ref={bodyRef}
          value={bodyDraft}
          onChange={e => { setBodyDraft(e.target.value); setDirty(true) }}
          rows={14}
          placeholder="Hola {{tutor_nombre}}, …"
          className="w-full text-sm px-3 py-2 border border-slate-200 rounded-lg font-mono leading-relaxed"
        />

        {/* Insertar variable */}
        <details className="mt-3 group">
          <summary className="cursor-pointer text-xs font-semibold text-pink-700 hover:text-pink-900">
            ➕ Insertar variable
          </summary>
          <div className="mt-2 max-h-48 overflow-y-auto border border-slate-200 rounded-lg">
            {variables.map(v => (
              <button
                key={v.key}
                type="button"
                onClick={() => insertVariable(v.key)}
                className="w-full text-left px-3 py-2 hover:bg-slate-50 border-b border-slate-100 last:border-0"
              >
                <div className="font-mono text-xs text-pink-700">{`{{${v.key}}}`}</div>
                <div className="text-xs text-slate-600 mt-0.5">{v.desc}</div>
                <div className="text-[11px] text-slate-400 mt-0.5">Ejemplo: {v.ejemplo}</div>
              </button>
            ))}
          </div>
        </details>

        {/* Acciones */}
        <div className="flex items-center justify-between gap-2 mt-5 pt-4 border-t border-slate-100">
          <button
            type="button"
            onClick={handleReset}
            disabled={isPending || usingDefault}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-600 hover:text-slate-900 disabled:opacity-40"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Restablecer
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSendTest}
              disabled={isPending}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-pink-700 border border-pink-200 rounded-lg hover:bg-pink-50 disabled:opacity-50"
            >
              <Send className="w-3.5 h-3.5" />
              Enviarme prueba
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={isPending || !dirty}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white rounded-lg bg-pink-600 hover:bg-pink-700 disabled:opacity-40"
            >
              {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              Guardar
            </button>
          </div>
        </div>
      </section>

      {/* ── Preview lateral ── */}
      <aside className="col-span-4 bg-white border border-slate-200 rounded-xl overflow-y-auto">
        <div className="px-3 py-2 border-b border-slate-100 text-xs font-semibold text-slate-500 uppercase tracking-wide flex items-center gap-1.5">
          <Eye className="w-3.5 h-3.5" />
          Vista previa
        </div>
        <div className="px-3 py-2 border-b border-slate-100 text-xs">
          <div className="text-slate-500">Asunto:</div>
          <div className="text-slate-800 font-medium truncate">{previewSubject || '—'}</div>
        </div>
        <div className="p-3 bg-slate-50" style={{ height: 'calc(100% - 100px)' }}>
          <iframe
            title="Vista previa email"
            srcDoc={previewHtml}
            sandbox=""
            className="w-full h-full bg-white border border-slate-200 rounded-md"
          />
        </div>
      </aside>
    </div>
  )
}
