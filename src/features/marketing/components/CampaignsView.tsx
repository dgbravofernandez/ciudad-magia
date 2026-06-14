'use client'

import { useState, useTransition, useMemo } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import {
  Play, Pause, Send, Mail, Users, AlertTriangle, CheckCircle2, Reply, BanIcon,
  Search, Filter, X, ChevronLeft, ChevronRight, ArrowUpCircle, ArrowDownCircle, EyeOff, Eye,
} from 'lucide-react'
import {
  runCampaignBatch, pauseCampaign, updateDailyCap, updateTemplate, sendTestEmail,
  markReplied, toggleExcluded, bulkToggleExcluded, setPriority, bulkSetPriority, sendToSelected,
} from '../actions/campaign.actions'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyObj = any

interface Props {
  settings: AnyObj
  template: AnyObj
  stats: {
    total: number; pending: number; sent: number; replied: number
    bounced: number; unsubscribed: number; excluded: number; sentToday: number
  }
  lastSends: AnyObj[]
  clubs: AnyObj[]
  filteredCount: number
  page: number
  pageSize: number
  filters: { q: string; status: string; federation: string; excluded: string }
  federations: string[]
}

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pendiente', sent_1: 'Email 1 ✉️', sent_2: 'Email 2 ✉️', sent_3: 'Email 3 ✉️',
  replied: 'Respondido ✓', demo_booked: 'Demo ⭐', customer: 'Cliente 🎉',
  unsubscribed: 'Baja', bounced: 'Rebotado', paused: 'Pausado',
}
const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-slate-700 text-slate-300',
  sent_1: 'bg-blue-900/40 text-blue-300', sent_2: 'bg-blue-900/40 text-blue-300', sent_3: 'bg-blue-900/40 text-blue-300',
  replied: 'bg-green-900/40 text-green-300', demo_booked: 'bg-yellow-900/40 text-yellow-300',
  customer: 'bg-emerald-900/40 text-emerald-300', unsubscribed: 'bg-slate-800 text-slate-500',
  bounced: 'bg-red-900/40 text-red-300', paused: 'bg-amber-900/40 text-amber-300',
}

export function CampaignsView(p: Props) {
  const router = useRouter()
  const sp = useSearchParams()
  const [isPending, startTransition] = useTransition()
  const [subject, setSubject] = useState(p.template?.subject ?? '')
  const [body, setBody] = useState(p.template?.body_html ?? '')
  const [cap, setCap] = useState(p.settings?.daily_send_cap ?? 50)
  const [testEmail, setTestEmail] = useState('dgbravofernandez@gmail.com')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [q, setQ] = useState(p.filters.q)
  const [showTemplate, setShowTemplate] = useState(false)

  const remainingToday = Math.max(0, (p.settings?.daily_send_cap ?? 50) - p.stats.sentToday)
  const enviables = p.stats.pending  // ya filtra excluded en page.tsx
  const totalPages = Math.ceil(p.filteredCount / p.pageSize)
  const progressPct = p.stats.total > 0
    ? Math.round(((p.stats.sent + p.stats.replied + p.stats.bounced + p.stats.unsubscribed) / p.stats.total) * 100)
    : 0

  const allOnPageSelected = p.clubs.length > 0 && p.clubs.every(c => selected.has(c.id))

  function pushFilter(key: string, value: string) {
    const params = new URLSearchParams(sp.toString())
    if (value) params.set(key, value); else params.delete(key)
    params.delete('page')
    router.push(`/superadmin/campanas?${params.toString()}`)
  }

  function clearFilters() {
    router.push('/superadmin/campanas')
    setQ('')
  }

  function toggleSelectAllPage() {
    const next = new Set(selected)
    if (allOnPageSelected) p.clubs.forEach(c => next.delete(c.id))
    else p.clubs.forEach(c => { if (!c.excluded) next.add(c.id) })
    setSelected(next)
  }

  function toggleOne(id: string) {
    const next = new Set(selected)
    if (next.has(id)) next.delete(id); else next.add(id)
    setSelected(next)
  }

  // ── Acciones ─────────────────────────────────────────────────────────────
  function handleRunBatch() {
    if (!confirm(`Vas a enviar hasta ${remainingToday} emails AHORA según prioridad. ¿Continuar?`)) return
    startTransition(async () => {
      toast.loading('Enviando tanda...', { id: 'batch' })
      const res = await runCampaignBatch()
      if (res.success) { toast.success(res.message ?? `${res.sent} enviados`, { id: 'batch' }); router.refresh() }
      else toast.error(res.error ?? 'Error', { id: 'batch' })
    })
  }

  function handleSendSelected() {
    const ids = Array.from(selected)
    if (ids.length === 0) return toast.error('Selecciona al menos un club')
    if (!confirm(`Vas a enviar email_1 a ${ids.length} clubes seleccionados YA. ¿Continuar?`)) return
    startTransition(async () => {
      toast.loading(`Enviando a ${ids.length}...`, { id: 'sel' })
      const res = await sendToSelected(ids)
      if (res.success) { toast.success(res.message ?? '', { id: 'sel' }); setSelected(new Set()); router.refresh() }
      else toast.error(res.error ?? 'Error', { id: 'sel' })
    })
  }

  function handleBulkExclude(exclude: boolean) {
    const ids = Array.from(selected)
    if (ids.length === 0) return toast.error('Selecciona al menos un club')
    startTransition(async () => {
      const res = await bulkToggleExcluded(ids, exclude)
      if (res.success) {
        toast.success(`${ids.length} ${exclude ? 'excluidos' : 'reincorporados'}`)
        setSelected(new Set()); router.refresh()
      } else toast.error(res.error ?? 'Error')
    })
  }

  function handleBulkPriority(priority: number) {
    const ids = Array.from(selected)
    if (ids.length === 0) return toast.error('Selecciona al menos un club')
    startTransition(async () => {
      const res = await bulkSetPriority(ids, priority)
      if (res.success) {
        toast.success(`Prioridad ${priority} aplicada a ${ids.length}`)
        setSelected(new Set()); router.refresh()
      } else toast.error(res.error ?? 'Error')
    })
  }

  function handleToggleOneExcluded(id: string, excluded: boolean) {
    startTransition(async () => {
      const res = await toggleExcluded(id, !excluded)
      if (res.success) router.refresh(); else toast.error(res.error ?? 'Error')
    })
  }

  function handleSetOnePriority(id: string, priority: number) {
    startTransition(async () => {
      const res = await setPriority(id, priority)
      if (res.success) router.refresh(); else toast.error(res.error ?? 'Error')
    })
  }

  function handlePause() {
    startTransition(async () => {
      const res = await pauseCampaign(!p.settings?.is_paused)
      if (res.success) { toast.success(p.settings?.is_paused ? 'Reanudada' : 'Pausada'); router.refresh() }
      else toast.error(res.error ?? 'Error')
    })
  }

  function handleSaveTemplate() {
    startTransition(async () => {
      const res = await updateTemplate('email_1', subject, body)
      if (res.success) { toast.success('Plantilla guardada'); router.refresh() }
      else toast.error(res.error ?? 'Error')
    })
  }

  function handleSaveCap() {
    startTransition(async () => {
      const res = await updateDailyCap(cap)
      if (res.success) { toast.success('Límite actualizado'); router.refresh() }
      else toast.error(res.error ?? 'Error')
    })
  }

  function handleSendTest() {
    if (!testEmail) return toast.error('Pon un email destinatario')
    startTransition(async () => {
      const res = await sendTestEmail(testEmail)
      if (res.success) toast.success(`Test enviado a ${testEmail}`)
      else toast.error(res.error ?? 'Error', { duration: 12000, description: 'Visita /api/debug/email-status para diagnosticar' })
    })
  }

  function handleMarkReplied(clubId: string) {
    startTransition(async () => {
      const res = await markReplied(clubId)
      if (res.success) { toast.success('Marcado'); router.refresh() }
      else toast.error(res.error ?? 'Error')
    })
  }

  const selectedCount = selected.size
  const hasFilters = useMemo(() => p.filters.q || p.filters.status || p.filters.federation || p.filters.excluded, [p.filters])

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Campañas de captación</h1>
        <p className="text-sm text-slate-400 mt-1">
          {p.stats.total} clubes · {enviables} enviables · {p.stats.excluded} excluidos · cron L-V 10:00 UTC
        </p>
      </div>

      {/* Status & controles */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className={`w-3 h-3 rounded-full ${p.settings?.is_paused ? 'bg-amber-500' : 'bg-green-500 animate-pulse'}`}></div>
            <div>
              <p className="text-white font-semibold">{p.settings?.is_paused ? 'Pausada' : 'Activa'}</p>
              <p className="text-xs text-slate-400">
                Hoy: {p.stats.sentToday} / {p.settings?.daily_send_cap ?? 50} · {remainingToday} restantes
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={handlePause} disabled={isPending}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-800 text-slate-200 hover:bg-slate-700 text-sm font-medium disabled:opacity-50">
              {p.settings?.is_paused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
              {p.settings?.is_paused ? 'Reanudar' : 'Pausar'}
            </button>
            <button onClick={handleRunBatch} disabled={isPending || p.settings?.is_paused || remainingToday === 0}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-yellow-500 text-black hover:bg-yellow-400 text-sm font-bold disabled:opacity-50 disabled:cursor-not-allowed">
              <Send className="w-4 h-4" /> Enviar {remainingToday} por prioridad
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3 mt-4">
          <Stat icon={Users} label="Total" value={p.stats.total} color="text-slate-300" />
          <Stat icon={Mail} label="Pendientes" value={p.stats.pending} color="text-slate-300" />
          <Stat icon={CheckCircle2} label="Enviados" value={p.stats.sent} color="text-blue-300" />
          <Stat icon={Reply} label="Respondieron" value={p.stats.replied} color="text-green-400" />
          <Stat icon={AlertTriangle} label="Rebotados" value={p.stats.bounced} color="text-red-400" />
          <Stat icon={BanIcon} label="Bajas" value={p.stats.unsubscribed} color="text-slate-500" />
          <Stat icon={EyeOff} label="Excluidos" value={p.stats.excluded} color="text-amber-400" />
        </div>

        <div className="mt-4">
          <div className="flex justify-between text-xs text-slate-400 mb-1">
            <span>Progreso de la campaña</span>
            <span>{progressPct}%</span>
          </div>
          <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
            <div className="h-full bg-yellow-500 transition-all" style={{ width: `${progressPct}%` }}></div>
          </div>
        </div>
      </div>

      {/* Plantilla collapsible */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl">
        <button onClick={() => setShowTemplate(!showTemplate)}
          className="w-full flex items-center justify-between p-4 text-white font-semibold hover:bg-slate-800/50 rounded-t-xl">
          <span>Plantilla email_1 (asunto + cuerpo)</span>
          <span className="text-xs text-slate-400">{showTemplate ? 'Ocultar ▲' : 'Editar ▼'}</span>
        </button>
        {showTemplate && (
          <div className="p-5 pt-0 space-y-4 border-t border-slate-800">
            <p className="text-xs text-slate-400">Variables: {`{{club_name}}`} {`{{location}}`} {`{{federation}}`} {`{{unsubscribe_url}}`}</p>
            <input type="text" value={subject} onChange={(e) => setSubject(e.target.value)}
              placeholder="Asunto"
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm" />
            <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={12}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-xs font-mono" />
            <div className="flex items-center gap-2 flex-wrap">
              <button onClick={handleSaveTemplate} disabled={isPending}
                className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-500 text-sm font-medium disabled:opacity-50">Guardar</button>
              <input type="email" value={testEmail} onChange={(e) => setTestEmail(e.target.value)}
                placeholder="email de prueba"
                className="flex-1 min-w-[200px] px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm" />
              <button onClick={handleSendTest} disabled={isPending}
                className="px-4 py-2 rounded-lg bg-slate-700 text-slate-200 hover:bg-slate-600 text-sm font-medium disabled:opacity-50">Enviar test</button>
              <div className="flex items-center gap-1">
                <span className="text-xs text-slate-400">Cap diario:</span>
                <input type="number" min={1} max={500} value={cap}
                  onChange={(e) => setCap(parseInt(e.target.value) || 50)}
                  className="w-20 px-2 py-1 bg-slate-800 border border-slate-700 rounded text-white text-sm" />
                <button onClick={handleSaveCap} disabled={isPending}
                  className="px-2 py-1 rounded bg-slate-700 text-slate-200 hover:bg-slate-600 text-xs">OK</button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Filtros */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2 flex-1 min-w-[240px]">
            <Search className="w-4 h-4 text-slate-500" />
            <input type="text" value={q} onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') pushFilter('q', q) }}
              placeholder="Buscar club, email, ubicación..."
              className="flex-1 px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm" />
            <button onClick={() => pushFilter('q', q)}
              className="px-3 py-2 rounded-lg bg-slate-700 text-slate-200 hover:bg-slate-600 text-sm">Buscar</button>
          </div>

          <select value={p.filters.status} onChange={(e) => pushFilter('status', e.target.value)}
            className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm">
            <option value="">Todos los estados</option>
            {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>

          <select value={p.filters.federation} onChange={(e) => pushFilter('federation', e.target.value)}
            className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm">
            <option value="">Todas las federaciones</option>
            {p.federations.map(f => <option key={f} value={f}>{f}</option>)}
          </select>

          <select value={p.filters.excluded} onChange={(e) => pushFilter('excluded', e.target.value)}
            className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm">
            <option value="">Excluidos y no excluidos</option>
            <option value="0">Solo NO excluidos</option>
            <option value="1">Solo excluidos</option>
          </select>

          {hasFilters && (
            <button onClick={clearFilters}
              className="flex items-center gap-1 px-3 py-2 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 text-sm">
              <X className="w-3.5 h-3.5" /> Limpiar
            </button>
          )}
        </div>

        {/* Barra de acción con selección */}
        {selectedCount > 0 && (
          <div className="flex items-center gap-2 flex-wrap pt-2 border-t border-slate-800">
            <span className="text-sm text-yellow-300 font-medium">{selectedCount} seleccionados</span>
            <button onClick={handleSendSelected} disabled={isPending}
              className="flex items-center gap-1 px-3 py-1.5 rounded bg-yellow-500 text-black hover:bg-yellow-400 text-xs font-bold disabled:opacity-50">
              <Send className="w-3 h-3" /> Enviar a estos {selectedCount}
            </button>
            <button onClick={() => handleBulkExclude(true)} disabled={isPending}
              className="flex items-center gap-1 px-3 py-1.5 rounded bg-amber-900/60 text-amber-300 hover:bg-amber-900 text-xs disabled:opacity-50">
              <EyeOff className="w-3 h-3" /> Excluir
            </button>
            <button onClick={() => handleBulkExclude(false)} disabled={isPending}
              className="flex items-center gap-1 px-3 py-1.5 rounded bg-slate-800 text-slate-300 hover:bg-slate-700 text-xs disabled:opacity-50">
              <Eye className="w-3 h-3" /> Reincorporar
            </button>
            <div className="flex items-center gap-1">
              <span className="text-xs text-slate-400">Prioridad:</span>
              <button onClick={() => handleBulkPriority(1)} disabled={isPending}
                className="px-2 py-1 rounded bg-green-900/60 text-green-300 hover:bg-green-900 text-xs disabled:opacity-50">🔥 Alta (1)</button>
              <button onClick={() => handleBulkPriority(50)} disabled={isPending}
                className="px-2 py-1 rounded bg-slate-800 text-slate-300 hover:bg-slate-700 text-xs disabled:opacity-50">Normal (50)</button>
              <button onClick={() => handleBulkPriority(200)} disabled={isPending}
                className="px-2 py-1 rounded bg-slate-800 text-slate-300 hover:bg-slate-700 text-xs disabled:opacity-50">Baja (200)</button>
            </div>
            <button onClick={() => setSelected(new Set())}
              className="ml-auto text-xs text-slate-400 hover:text-white">Limpiar selección</button>
          </div>
        )}
      </div>

      {/* Tabla de clubes */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-white font-semibold">
            {p.filteredCount} clubes {hasFilters && '(filtrados)'} · página {p.page} de {totalPages || 1}
          </h2>
          <div className="flex items-center gap-2">
            <button onClick={() => router.push(`/superadmin/campanas?${new URLSearchParams({ ...Object.fromEntries(sp), page: String(p.page - 1) })}`)}
              disabled={p.page <= 1}
              className="p-1 rounded bg-slate-800 disabled:opacity-30"><ChevronLeft className="w-4 h-4 text-slate-300" /></button>
            <button onClick={() => router.push(`/superadmin/campanas?${new URLSearchParams({ ...Object.fromEntries(sp), page: String(p.page + 1) })}`)}
              disabled={p.page >= totalPages}
              className="p-1 rounded bg-slate-800 disabled:opacity-30"><ChevronRight className="w-4 h-4 text-slate-300" /></button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-slate-500 border-b border-slate-800">
                <th className="py-2 px-2 w-8">
                  <input type="checkbox" checked={allOnPageSelected} onChange={toggleSelectAllPage}
                    className="rounded bg-slate-800 border-slate-700" />
                </th>
                <th className="text-left py-2 px-2">Club</th>
                <th className="text-left py-2 px-2">Email</th>
                <th className="text-left py-2 px-2">Ubicación</th>
                <th className="text-center py-2 px-2">Prio</th>
                <th className="text-left py-2 px-2">Estado</th>
                <th className="text-right py-2 px-2">Acción</th>
              </tr>
            </thead>
            <tbody>
              {p.clubs.map((c) => (
                <tr key={c.id}
                  className={`border-b border-slate-800/50 hover:bg-slate-800/30 ${c.excluded ? 'opacity-40' : ''}`}>
                  <td className="py-2 px-2">
                    <input type="checkbox" checked={selected.has(c.id)} onChange={() => toggleOne(c.id)}
                      className="rounded bg-slate-800 border-slate-700" />
                  </td>
                  <td className="py-2 px-2 text-white">{c.name}</td>
                  <td className="py-2 px-2 text-slate-400 text-xs">{c.email}</td>
                  <td className="py-2 px-2 text-slate-500 text-xs">{c.location}</td>
                  <td className="py-2 px-2 text-center">
                    <input type="number" value={c.priority} min={1} max={999}
                      onChange={(e) => handleSetOnePriority(c.id, parseInt(e.target.value) || 100)}
                      className="w-14 px-1 py-0.5 bg-slate-800 border border-slate-700 rounded text-white text-xs text-center" />
                  </td>
                  <td className="py-2 px-2">
                    <span className={`text-xs px-2 py-0.5 rounded ${STATUS_COLORS[c.status] ?? 'bg-slate-700 text-slate-300'}`}>
                      {STATUS_LABELS[c.status] ?? c.status}
                    </span>
                    {c.excluded && <span className="ml-1 text-xs text-amber-400">excl.</span>}
                  </td>
                  <td className="py-2 px-2 text-right">
                    <div className="flex items-center gap-1 justify-end">
                      <button onClick={() => handleToggleOneExcluded(c.id, c.excluded)}
                        disabled={isPending}
                        title={c.excluded ? 'Reincorporar' : 'Excluir'}
                        className="p-1 rounded hover:bg-slate-700 text-slate-400 hover:text-white">
                        {c.excluded ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                      </button>
                      {(c.status === 'sent_1' || c.status === 'sent_2') && (
                        <button onClick={() => handleMarkReplied(c.id)} disabled={isPending}
                          className="text-xs px-2 py-1 rounded bg-green-900/40 text-green-300 hover:bg-green-900/60">Respondió</button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {p.clubs.length === 0 && (
                <tr><td colSpan={7} className="py-8 text-center text-slate-500 text-sm">Sin resultados con esos filtros</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Últimos envíos */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
        <h2 className="text-white font-semibold mb-3">Últimos 20 envíos</h2>
        {p.lastSends.length === 0 ? (
          <p className="text-sm text-slate-500 py-6 text-center">Sin envíos todavía.</p>
        ) : (
          <div className="space-y-1">
            {p.lastSends.map((s) => {
              const club = Array.isArray(s.marketing_clubs) ? s.marketing_clubs[0] : s.marketing_clubs
              return (
                <div key={s.id} className="flex items-center gap-3 py-2 px-2 hover:bg-slate-800/50 rounded text-sm">
                  <div className="flex-1 min-w-0">
                    <p className="text-white truncate font-medium">{club?.name ?? '(eliminado)'}</p>
                    <p className="text-slate-500 text-xs truncate">{club?.email}</p>
                  </div>
                  <div className="text-xs text-slate-400">{new Date(s.sent_at).toLocaleString('es-ES')}</div>
                  {s.bounced ? (
                    <span className="text-xs bg-red-900/40 text-red-300 px-2 py-0.5 rounded">Error</span>
                  ) : (
                    <span className="text-xs bg-blue-900/40 text-blue-300 px-2 py-0.5 rounded">Enviado</span>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

function Stat({ icon: Icon, label, value, color }: {
  icon: React.ComponentType<{ className?: string }>, label: string, value: number, color: string
}) {
  return (
    <div className="bg-slate-800/50 rounded-lg p-3">
      <div className="flex items-center gap-2 mb-1">
        <Icon className={`w-3.5 h-3.5 ${color}`} />
        <span className="text-xs text-slate-400">{label}</span>
      </div>
      <p className={`text-xl font-bold ${color}`}>{value}</p>
    </div>
  )
}

// Suprimir warnings de imports no usados
void Filter; void ArrowUpCircle; void ArrowDownCircle
