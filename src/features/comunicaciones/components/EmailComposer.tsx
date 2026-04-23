'use client'
import { useState } from 'react'
import { Users, FileText, Send, Eye, Save } from 'lucide-react'
import { toast } from 'sonner'
import { sendBulkEmail } from '@/features/comunicaciones/actions/communications.actions'

interface Props {
  clubId: string
  templates: Array<{ id: string; name: string; subject: string; body: string }>
  teams: Array<{ id: string; name: string; categories?: { name: string } | null }>
  categories: Array<{ id: string; name: string }>
  players: Array<{ id: string; first_name: string; last_name: string; tutor_name: string | null; tutor_email: string | null }>
  totalPlayers: number
  pendingPlayersCount: number
}

const RECIPIENT_OPTIONS = [
  { key: 'all', label: 'Todos los jugadores activos' },
  { key: 'pending', label: 'Cuota pendiente' },
  { key: 'team', label: 'Equipo específico' },
  { key: 'category', label: 'Por categoría' },
  { key: 'player', label: 'Familia específica' },
] as const

const SAMPLE_VARS: Record<string, string> = {
  '{jugador_nombre}': 'Juan García',
  '{tutor_nombre}': 'Pedro García',
  '{club_nombre}': 'Ciudad Magia CF',
  '{importe}': '45,00 €',
  '{mes}': 'Abril 2026',
  '{temporada}': '2025/2026',
  '{fecha_prueba}': '15/04/2026',
  '{director_nombre}': 'Carlos López',
  '{equipo}': 'Alevín A',
  '{fecha_partido}': '20/04/2026',
  '{hora}': '10:00',
  '{lugar}': 'Campo Municipal',
  '{fecha_nacimiento}': '01/01/2015',
  '{entrenador_nombre}': 'Miguel Torres',
}

function applyVars(text: string): string {
  return Object.entries(SAMPLE_VARS).reduce((t, [k, v]) => t.replaceAll(k, v), text)
}

export function EmailComposer({ templates, teams, categories, players, totalPlayers, pendingPlayersCount }: Props) {
  const [recipientType, setRecipientType] = useState<'all' | 'pending' | 'team' | 'category' | 'player'>('all')
  const [selectedTeam, setSelectedTeam] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('')
  const [selectedPlayer, setSelectedPlayer] = useState('')
  const [playerSearch, setPlayerSearch] = useState('')
  const [templateId, setTemplateId] = useState('')
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [showPreview, setShowPreview] = useState(false)
  const [sending, setSending] = useState(false)

  function getRecipientCount() {
    if (recipientType === 'all') return totalPlayers
    if (recipientType === 'pending') return pendingPlayersCount
    if (recipientType === 'player') return selectedPlayer ? 1 : 0
    return null // unknown for team/category
  }

  const filteredPlayers = playerSearch.trim()
    ? players.filter((p) => {
        const q = playerSearch.toLowerCase()
        return (
          p.first_name.toLowerCase().includes(q) ||
          p.last_name.toLowerCase().includes(q) ||
          (p.tutor_name ?? '').toLowerCase().includes(q) ||
          (p.tutor_email ?? '').toLowerCase().includes(q)
        )
      })
    : players

  function loadTemplate(id: string) {
    setTemplateId(id)
    const tpl = templates.find(t => t.id === id)
    if (tpl) { setSubject(tpl.subject); setBody(tpl.body) }
  }

  async function handleSend() {
    if (!subject.trim() || !body.trim()) { toast.error('Escribe un asunto y cuerpo'); return }
    if (recipientType === 'team' && !selectedTeam) { toast.error('Selecciona un equipo'); return }
    if (recipientType === 'category' && !selectedCategory) { toast.error('Selecciona una categoría'); return }
    if (recipientType === 'player' && !selectedPlayer) { toast.error('Selecciona un jugador/familia'); return }
    setSending(true)
    try {
      const result = await sendBulkEmail({
        templateId: templateId || null,
        subject,
        bodyHtml: body,
        recipientType,
        teamId: recipientType === 'team' ? selectedTeam : null,
        categoryId: recipientType === 'category' ? selectedCategory : null,
        playerId: recipientType === 'player' ? selectedPlayer : null,
      })
      if (!result.success) {
        toast.error(result.error ?? 'Error al enviar')
        return
      }
      const parts: string[] = []
      if (result.sent > 0) parts.push(`${result.sent} enviado${result.sent > 1 ? 's' : ''}`)
      if (result.noEmail > 0) parts.push(`${result.noEmail} sin email`)
      if (result.failed > 0) parts.push(`${result.failed} fallido${result.failed > 1 ? 's' : ''}`)
      if (result.sent > 0) {
        toast.success(parts.join(' · ') || 'Comunicación enviada')
      } else if (result.failed > 0) {
        toast.error(parts.join(' · '))
      } else {
        toast.warning('No había destinatarios con email')
      }
      if (result.sent > 0) { setSubject(''); setBody(''); setTemplateId('') }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al enviar')
    } finally { setSending(false) }
  }

  const recipientCount = getRecipientCount()

  return (
    <div className="flex gap-6 h-full">
      {/* Left: Composition */}
      <div className="flex-1 space-y-5">
        {/* Recipients */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <Users className="w-4 h-4 text-gray-500" /> Destinatarios
          </h3>
          <div className="flex flex-wrap gap-2 mb-3">
            {RECIPIENT_OPTIONS.map(opt => (
              <button key={opt.key} onClick={() => setRecipientType(opt.key)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all border ${recipientType === opt.key ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}>
                {opt.label}
                {opt.key === 'all' && <span className="ml-1.5 bg-blue-100 text-blue-600 text-xs px-1.5 py-0.5 rounded-full">{totalPlayers}</span>}
                {opt.key === 'pending' && <span className="ml-1.5 bg-yellow-100 text-yellow-700 text-xs px-1.5 py-0.5 rounded-full">{pendingPlayersCount}</span>}
              </button>
            ))}
          </div>
          {recipientType === 'team' && (
            <select value={selectedTeam} onChange={e => setSelectedTeam(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">Selecciona un equipo...</option>
              {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          )}
          {recipientType === 'category' && (
            <select value={selectedCategory} onChange={e => setSelectedCategory(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">Selecciona una categoría...</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          )}
          {recipientType === 'player' && (
            <div className="space-y-2">
              <input
                type="text"
                value={playerSearch}
                onChange={e => setPlayerSearch(e.target.value)}
                placeholder="Buscar por nombre, tutor o email..."
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <select
                value={selectedPlayer}
                onChange={e => setSelectedPlayer(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                size={Math.min(filteredPlayers.length + 1, 8)}
              >
                <option value="">— Selecciona jugador —</option>
                {filteredPlayers.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.last_name}, {p.first_name}{p.tutor_email ? ` · ${p.tutor_email}` : ' · sin email'}
                  </option>
                ))}
              </select>
              {selectedPlayer && (() => {
                const p = players.find(x => x.id === selectedPlayer)
                return p ? (
                  <p className="text-xs text-blue-700 bg-blue-50 rounded px-2 py-1">
                    ✉ Se enviará a: <strong>{p.tutor_name ?? `${p.first_name} ${p.last_name}`}</strong>
                    {p.tutor_email ? ` — ${p.tutor_email}` : <span className="text-amber-600"> — sin email registrado</span>}
                  </p>
                ) : null
              })()}
            </div>
          )}
        </div>

        {/* Template */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
            <FileText className="w-4 h-4 text-gray-500" /> Plantilla (opcional)
          </label>
          <select value={templateId} onChange={e => loadTemplate(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="">Sin plantilla — escribir desde cero</option>
            {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </div>

        {/* Subject + Body */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Asunto *</label>
            <input value={subject} onChange={e => setSubject(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Escribe el asunto del correo..." />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Mensaje *</label>
            <textarea value={body} onChange={e => setBody(e.target.value)} rows={12} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono" placeholder="Escribe el cuerpo del correo..." />
            <p className="text-xs text-gray-400 mt-1">Variables: <span className="font-mono">{'{jugador_nombre}'}</span>, <span className="font-mono">{'{tutor_nombre}'}</span>, <span className="font-mono">{'{club_nombre}'}</span>, <span className="font-mono">{'{importe}'}</span>, <span className="font-mono">{'{mes}'}</span></p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3">
          <button onClick={handleSend} disabled={sending || !subject.trim() || !body.trim()}
            className="flex items-center gap-2 px-5 py-2.5 text-white rounded-lg text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ backgroundColor: 'var(--color-primary)' }}>
            <Send className="w-4 h-4" />
            {sending ? 'Enviando...' : `Enviar${recipientCount !== null ? ` a ${recipientCount} destinatarios` : ''}`}
          </button>
          <button onClick={() => toast.success('Borrador guardado')}
            className="flex items-center gap-2 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50">
            <Save className="w-4 h-4" /> Guardar borrador
          </button>
          <button onClick={() => setShowPreview(v => !v)}
            className="flex items-center gap-2 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50">
            <Eye className="w-4 h-4" /> {showPreview ? 'Ocultar' : 'Vista previa'}
          </button>
        </div>
      </div>

      {/* Right: Info + Preview */}
      <div className="w-72 space-y-4 flex-shrink-0">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <h4 className="font-semibold text-gray-900 text-sm mb-3">Resumen del envío</h4>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between text-gray-600">
              <span>Destinatarios</span>
              <span className="font-medium text-gray-900">{recipientCount !== null ? recipientCount : '—'}</span>
            </div>
            <div className="flex justify-between text-gray-600">
              <span>Tipo</span>
              <span className="font-medium text-gray-900 capitalize">{RECIPIENT_OPTIONS.find(o => o.key === recipientType)?.label ?? ''}</span>
            </div>
            <div className="flex justify-between text-gray-600">
              <span>Asunto</span>
              <span className="font-medium text-gray-900 text-right truncate max-w-[120px]">{subject || '—'}</span>
            </div>
          </div>
        </div>

        {showPreview && (subject || body) && (
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <h4 className="font-semibold text-gray-900 text-sm mb-3 flex items-center gap-2">
              <Eye className="w-4 h-4" /> Vista previa
            </h4>
            <div className="text-xs space-y-2">
              <div>
                <span className="text-gray-500">Asunto: </span>
                <span className="font-medium">{applyVars(subject)}</span>
              </div>
              <div className="border-t pt-2 whitespace-pre-wrap text-gray-700 leading-relaxed">{applyVars(body)}</div>
            </div>
          </div>
        )}

        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-xs text-blue-700">
          <p className="font-medium mb-1">Variables disponibles</p>
          <p>
            <span className="font-mono">{'{jugador_nombre}'}</span>, <span className="font-mono">{'{tutor_nombre}'}</span>, <span className="font-mono">{'{club_nombre}'}</span> — se sustituyen por cada destinatario antes de enviar.
          </p>
        </div>
      </div>
    </div>
  )
}
