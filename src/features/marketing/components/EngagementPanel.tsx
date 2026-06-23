'use client'

import { useState, useTransition } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import { Phone, ExternalLink, Flame, TrendingUp, MousePointerClick, Send, Loader2, X } from 'lucide-react'
import { runClickFollowupBatch, sendFollowupToClubManual } from '../actions/campaign.actions'
import type { RecoveryTemplateKey as RecoveryKey } from '../lib/recovery-templates'

// Metadata de las 3 plantillas de recuperación (debe coincidir con migración 056)
const RECOVERY_META: Record<RecoveryKey, { label: string; desc: string; subject: string; tone: string }> = {
  recover_click: {
    label: 'Echó un vistazo',
    desc: 'Suave, sin presión. Para quien abrió o clicó algo sin más.',
    subject: '¿Te cuadró algo, [club]?',
    tone: 'border-blue-500/50 bg-blue-900/20 text-blue-300',
  },
  recover_reservar: {
    label: 'Intentó reservar',
    desc: 'Entró a /reservar o /demo pero no cerró. Quita fricción: "dime tú cuándo".',
    subject: '[club], ¿te lío con la demo?',
    tone: 'border-orange-500/50 bg-orange-900/20 text-orange-300',
  },
  recover_hot: {
    label: 'Muy interesado',
    desc: 'Clicó varias cosas. Muy personal: "te llamo yo y te lo enseño en 10 min".',
    subject: '[club] — te lo enseño en 10 min',
    tone: 'border-pink-500/50 bg-pink-900/20 text-pink-300',
  },
}

export interface EngagementLead {
  sendId: string
  clubId: string
  clubName: string
  email: string
  phone: string | null
  federation: string | null
  location: string | null
  sentAt: string
  openedAt: string | null
  clickedAt: string | null
  subject: string
  status: string
  followupSentAt: string | null
}

export interface ClickDetail {
  sendId: string
  destination: string
}

export interface SubjectStat {
  subject: string
  sent: number
  opens: number
  clicks: number
}

export interface ClickDest {
  destination: string
  count: number
}

interface Props {
  leads: EngagementLead[]
  clickDetails: ClickDetail[]
  clickDests: ClickDest[]
  subjectPerf: SubjectStat[]
  window: string
}

function relativeTime(iso: string | null): string {
  if (!iso) return '—'
  const diff = Date.now() - new Date(iso).getTime()
  const h = Math.floor(diff / 3600_000)
  if (h < 1) return 'hace <1h'
  if (h < 24) return `hace ${h}h`
  const d = Math.floor(h / 24)
  return `hace ${d}d`
}

function heatInfo(lead: EngagementLead, clickDetails: ClickDetail[]) {
  // Un clic implica apertura aunque opened_at sea null (pixel bloqueado por Gmail).
  if (!lead.openedAt && !lead.clickedAt) return null
  const leadClicks = clickDetails.filter(c => c.sendId === lead.sendId)
  const hasDemo = leadClicks.some(c => /\/demo|\/reservar/.test(c.destination))
  const hasAnyClick = !!lead.clickedAt

  if (hasDemo) return { badge: '🔥🔥🔥 Clic demo/demo', ring: 'border-orange-500/50', bg: 'bg-orange-900/20', score: 3 }
  if (hasAnyClick) return { badge: '🔥🔥 Clic web', ring: 'border-yellow-500/50', bg: 'bg-yellow-900/20', score: 2 }
  return { badge: '🔥 Abrió', ring: 'border-blue-500/30', bg: 'bg-blue-900/10', score: 1 }
}

const WINDOWS = [
  { key: '7d', label: '7 días' },
  { key: '30d', label: '30 días' },
  { key: 'all', label: 'Todo' },
]

const TABS = [
  { key: 'leads', label: 'Leads calientes', icon: Flame },
  { key: 'emails', label: 'Performance emails', icon: TrendingUp },
  { key: 'clics', label: 'Qué clicaron', icon: MousePointerClick },
]

export function EngagementPanel({ leads, clickDetails, clickDests, subjectPerf, window: activeWindow }: Props) {
  const router = useRouter()
  const sp = useSearchParams()
  const [tab, setTab] = useState<'leads' | 'emails' | 'clics'>('leads')
  const [isPending, startTransition] = useTransition()
  const [sendingClub, setSendingClub] = useState<string | null>(null)
  const [modalLead, setModalLead] = useState<(EngagementLead & { heat: ReturnType<typeof heatInfo> }) | null>(null)
  const [selectedTpl, setSelectedTpl] = useState<RecoveryKey>('recover_click')

  // Recomienda plantilla según lo que hizo el lead
  function suggestTemplate(lead: EngagementLead): RecoveryKey {
    const myClicks = clickDetails.filter(c => c.sendId === lead.sendId)
    if (myClicks.some(c => /\/demo|\/reservar/.test(c.destination))) return 'recover_reservar'
    if (myClicks.length >= 3) return 'recover_hot'
    return 'recover_click'
  }

  function openSendModal(lead: EngagementLead & { heat: ReturnType<typeof heatInfo> }) {
    setSelectedTpl(suggestTemplate(lead))
    setModalLead(lead)
  }

  function confirmSend() {
    if (!modalLead) return
    const lead = modalLead
    setSendingClub(lead.clubId)
    setModalLead(null)
    startTransition(async () => {
      const res = await sendFollowupToClubManual(lead.clubId, selectedTpl)
      if (res.success) {
        toast.success(`Email enviado a ${lead.clubName}`)
        router.refresh()
      } else {
        toast.error(res.error ?? 'Error al enviar')
      }
      setSendingClub(null)
    })
  }

  function handleSendClickFollowup() {
    if (!confirm('¿Enviar email de recuperación a los leads que clicaron /demo o /reservar hace >24h sin reservar?')) return
    startTransition(async () => {
      const res = await runClickFollowupBatch()
      if (res.success) {
        toast.success(`Followup enviado: ${(res as any).sent ?? 0} emails`)
        router.refresh()
      } else {
        toast.error((res as any).error ?? 'Error')
      }
    })
  }

  function setWindow(w: string) {
    const params = new URLSearchParams(sp.toString())
    params.set('window', w)
    router.push(`/superadmin/campanas?${params.toString()}`)
  }

  // Leads ordenados por score desc, luego por openedAt más reciente
  const sortedLeads = [...leads]
    .map(l => ({ ...l, heat: heatInfo(l, clickDetails) }))
    .filter(l => l.heat)
    .sort((a, b) => {
      const scoreDiff = (b.heat?.score ?? 0) - (a.heat?.score ?? 0)
      if (scoreDiff !== 0) return scoreDiff
      // Más reciente primero, usando clic o apertura (lo que haya)
      const ta = new Date(a.clickedAt ?? a.openedAt ?? a.sentAt).getTime()
      const tb = new Date(b.clickedAt ?? b.openedAt ?? b.sentAt).getTime()
      return tb - ta
    })

  const hotCount = sortedLeads.filter(l => (l.heat?.score ?? 0) >= 2).length

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-slate-800 flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Flame className="w-4 h-4 text-orange-400" />
          <span className="text-white font-semibold text-sm">CRM de Leads</span>
          {hotCount > 0 && (
            <span className="px-2 py-0.5 rounded-full bg-orange-900/60 text-orange-300 text-xs font-bold animate-pulse">
              {hotCount} caliente{hotCount > 1 ? 's' : ''}
            </span>
          )}
        </div>

        {/* Botón de followup manual para leads calientes sin reserva */}
        {sortedLeads.some(l => (l.heat?.score ?? 0) >= 2) && (
          <button onClick={handleSendClickFollowup} disabled={isPending}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-orange-900/60 hover:bg-orange-900 text-orange-200 text-xs font-medium disabled:opacity-50 shrink-0">
            <Send className="w-3 h-3" />
            Enviar followup a calientes
          </button>
        )}

        {/* Window selector */}
        <div className="flex items-center gap-1 bg-slate-800 rounded-lg p-1">
          {WINDOWS.map(w => (
            <button key={w.key} onClick={() => setWindow(w.key)}
              className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                activeWindow === w.key
                  ? 'bg-slate-600 text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}>
              {w.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-800">
        {TABS.map(t => {
          const Icon = t.icon
          return (
            <button key={t.key} onClick={() => setTab(t.key as typeof tab)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium transition-colors ${
                tab === t.key
                  ? 'text-white border-b-2 border-pink-500 bg-slate-800/40'
                  : 'text-slate-400 hover:text-slate-200'
              }`}>
              <Icon className="w-3.5 h-3.5" />
              {t.label}
            </button>
          )
        })}
      </div>

      <div className="p-4">

        {/* ── LEADS CALIENTES ── */}
        {tab === 'leads' && (
          <div className="space-y-3">
            {sortedLeads.length === 0 && (
              <p className="text-slate-500 text-sm text-center py-6">
                Sin aperturas en este periodo. El pixel registra cuando abre el email.
              </p>
            )}
            {sortedLeads.map(lead => (
              <div key={lead.sendId}
                className={`rounded-lg border p-3 ${lead.heat?.ring} ${lead.heat?.bg}`}>
                <div className="flex items-start justify-between gap-2 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-white font-medium text-sm truncate">{lead.clubName}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        (lead.heat?.score ?? 0) >= 3
                          ? 'bg-orange-900/60 text-orange-300'
                          : (lead.heat?.score ?? 0) >= 2
                          ? 'bg-yellow-900/60 text-yellow-300'
                          : 'bg-blue-900/60 text-blue-300'
                      }`}>
                        {lead.heat?.badge}
                      </span>
                      {lead.followupSentAt && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-slate-700 text-slate-400 font-medium">
                          ✉ Followup enviado · esperando respuesta
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-1 flex-wrap text-xs text-slate-400">
                      {lead.federation && <span>{lead.federation}</span>}
                      {lead.location && <span>· {lead.location}</span>}
                    </div>
                    <div className="flex items-center gap-2 mt-1.5 flex-wrap text-xs text-slate-400">
                      <span>📨 {relativeTime(lead.sentAt)}</span>
                      {lead.openedAt && <span>👁 abrió {relativeTime(lead.openedAt)}</span>}
                      {lead.clickedAt && <span>🖱 clic {relativeTime(lead.clickedAt)}</span>}
                    </div>
                  </div>

                  {/* CTAs */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    {lead.status === 'unsubscribed' ? (
                      <span className="text-xs text-slate-500 px-2 py-1">Baja respetada</span>
                    ) : lead.email && (
                      <button
                        onClick={() => openSendModal(lead)}
                        disabled={sendingClub === lead.clubId || isPending}
                        title={lead.followupSentAt ? `Ya enviado. Clic para reenviar otra plantilla a ${lead.email}` : `Enviar followup a ${lead.email}`}
                        className={`flex items-center gap-1 px-2 py-1 rounded text-xs disabled:opacity-50 ${
                          lead.followupSentAt
                            ? 'bg-slate-700 hover:bg-slate-600 text-slate-400'
                            : 'bg-pink-900/60 hover:bg-pink-900 text-pink-300'
                        }`}>
                        {sendingClub === lead.clubId
                          ? <Loader2 className="w-3 h-3 animate-spin" />
                          : <Send className="w-3 h-3" />}
                        {lead.followupSentAt ? 'Reenviar' : 'Enviar'}
                      </button>
                    )}
                    {lead.phone && (
                      <a href={`tel:${lead.phone}`}
                        className="flex items-center gap-1 px-2 py-1 rounded bg-emerald-900/60 hover:bg-emerald-900 text-emerald-300 text-xs">
                        <Phone className="w-3 h-3" />
                        {lead.phone}
                      </a>
                    )}
                  </div>
                </div>

                {/* Links that were clicked for this lead */}
                {clickDetails.filter(c => c.sendId === lead.sendId).length > 0 && (
                  <div className="mt-2 flex items-center gap-1.5 flex-wrap">
                    <span className="text-xs text-slate-500">Clicó:</span>
                    {clickDetails
                      .filter(c => c.sendId === lead.sendId)
                      .map((c, i) => (
                        <span key={i} className="flex items-center gap-1 text-xs px-2 py-0.5 rounded bg-slate-700/60 text-slate-300">
                          <ExternalLink className="w-2.5 h-2.5" />
                          {c.destination.split('?')[0]}
                        </span>
                      ))
                    }
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* ── PERFORMANCE POR EMAIL ── */}
        {tab === 'emails' && (
          <div>
            {subjectPerf.length === 0 && (
              <p className="text-slate-500 text-sm text-center py-6">Sin datos en este periodo.</p>
            )}
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-slate-500 border-b border-slate-800">
                  <th className="pb-2 font-medium">Asunto</th>
                  <th className="pb-2 font-medium text-right">Enviados</th>
                  <th className="pb-2 font-medium text-right">Abiertos</th>
                  <th className="pb-2 font-medium text-right">% Apertura</th>
                  <th className="pb-2 font-medium text-right">Clics</th>
                  <th className="pb-2 font-medium text-right">% Clic</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {subjectPerf.map(s => {
                  const openRate = s.sent > 0 ? (s.opens / s.sent) * 100 : 0
                  const clickRate = s.sent > 0 ? (s.clicks / s.sent) * 100 : 0
                  return (
                    <tr key={s.subject} className="text-slate-300">
                      <td className="py-2 pr-4 text-xs max-w-[260px] truncate" title={s.subject}>{s.subject}</td>
                      <td className="py-2 text-right text-slate-400">{s.sent}</td>
                      <td className="py-2 text-right">{s.opens}</td>
                      <td className={`py-2 text-right font-medium ${openRate >= 30 ? 'text-emerald-400' : openRate >= 20 ? 'text-yellow-400' : 'text-red-400'}`}>
                        {openRate.toFixed(1)}%
                      </td>
                      <td className="py-2 text-right">{s.clicks}</td>
                      <td className={`py-2 text-right font-medium ${clickRate >= 5 ? 'text-emerald-400' : clickRate >= 2 ? 'text-yellow-400' : 'text-slate-500'}`}>
                        {clickRate.toFixed(1)}%
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            <p className="text-xs text-slate-600 mt-3">
              Benchmarks fríos: apertura &gt;25% ✅ · clic &gt;5% ✅. Debajo → revisar asunto o deliverability.
            </p>
          </div>
        )}

        {/* ── QUÉ HAN CLICADO ── */}
        {tab === 'clics' && (
          <div className="space-y-3">
            {clickDests.length === 0 && (
              <p className="text-slate-500 text-sm text-center py-6">Sin clics registrados aún.</p>
            )}
            {clickDests.length > 0 && (
              <>
                <div className="space-y-2">
                  {clickDests.map(d => {
                    const pct = clickDests[0]?.count > 0 ? (d.count / clickDests[0].count) * 100 : 0
                    const isDemo = /\/demo|\/reservar/.test(d.destination)
                    return (
                      <div key={d.destination} className="flex items-center gap-3">
                        <div className="w-36 text-xs text-slate-300 font-mono truncate shrink-0" title={d.destination}>
                          {isDemo ? '🎯 ' : ''}{d.destination.split('?')[0]}
                        </div>
                        <div className="flex-1 bg-slate-800 rounded-full h-2 overflow-hidden">
                          <div
                            className={`h-full rounded-full ${isDemo ? 'bg-orange-500' : 'bg-blue-500'}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="text-xs text-slate-400 w-8 text-right shrink-0">{d.count}</span>
                      </div>
                    )
                  })}
                </div>
                {clickDests.some(d => /\/demo|\/reservar/.test(d.destination)) && (
                  <p className="text-xs text-orange-300 mt-2">
                    🎯 Los clics en /demo o /reservar = intención de compra clara. Contáctalos hoy.
                  </p>
                )}
              </>
            )}
          </div>
        )}

      </div>

      {/* ── MODAL: elegir plantilla de recuperación ── */}
      {modalLead && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => setModalLead(null)}>
          <div className="bg-slate-900 border border-slate-700 rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className="flex items-start justify-between px-5 py-4 border-b border-slate-800">
              <div>
                <h3 className="text-white font-semibold text-sm">Enviar email a {modalLead.clubName}</h3>
                <p className="text-xs text-slate-400 mt-0.5">{modalLead.email}</p>
              </div>
              <button onClick={() => setModalLead(null)} className="text-slate-500 hover:text-slate-300">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Selector de plantilla */}
            <div className="p-5 space-y-2">
              <p className="text-xs text-slate-500 mb-1">Elige el tono según lo que hizo el lead:</p>
              {(Object.keys(RECOVERY_META) as RecoveryKey[]).map(key => {
                const meta = RECOVERY_META[key]
                const isSel = selectedTpl === key
                const isSuggested = suggestTemplate(modalLead) === key
                return (
                  <button key={key} onClick={() => setSelectedTpl(key)}
                    className={`w-full text-left rounded-lg border p-3 transition-colors ${
                      isSel ? meta.tone : 'border-slate-700 bg-slate-800/40 hover:bg-slate-800 text-slate-300'
                    }`}>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm">{meta.label}</span>
                      {isSuggested && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-900/60 text-emerald-300 font-bold">
                          SUGERIDA
                        </span>
                      )}
                      {isSel && <Send className="w-3 h-3 ml-auto" />}
                    </div>
                    <p className="text-xs opacity-80 mt-1">{meta.desc}</p>
                    <p className="text-xs opacity-60 mt-1 italic">Asunto: “{meta.subject.replace('[club]', modalLead.clubName)}”</p>
                  </button>
                )
              })}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-slate-800">
              <button onClick={() => setModalLead(null)}
                className="px-3 py-1.5 rounded-lg text-slate-400 hover:text-slate-200 text-sm">
                Cancelar
              </button>
              <button onClick={confirmSend}
                className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-pink-600 hover:bg-pink-500 text-white text-sm font-medium">
                <Send className="w-3.5 h-3.5" />
                Enviar email
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
