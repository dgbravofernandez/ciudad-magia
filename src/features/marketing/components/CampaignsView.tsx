'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Play, Pause, Send, Mail, Users, AlertTriangle, CheckCircle2, Reply, BanIcon } from 'lucide-react'
import {
  runCampaignBatch,
  pauseCampaign,
  updateDailyCap,
  updateTemplate,
  sendTestEmail,
  markReplied,
} from '../actions/campaign.actions'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyObj = any

interface Props {
  settings: AnyObj
  template: AnyObj
  stats: {
    total: number
    pending: number
    sent: number
    replied: number
    bounced: number
    unsubscribed: number
    sentToday: number
  }
  lastSends: AnyObj[]
  clubsPreview: AnyObj[]
}

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pendiente',
  sent_1: 'Email 1 enviado',
  sent_2: 'Email 2 enviado',
  sent_3: 'Email 3 enviado',
  replied: 'Respondido ✓',
  demo_booked: 'Demo agendada ⭐',
  customer: 'Cliente 🎉',
  unsubscribed: 'Baja',
  bounced: 'Rebotado',
  paused: 'Pausado',
}

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-slate-700 text-slate-300',
  sent_1: 'bg-blue-900/40 text-blue-300',
  sent_2: 'bg-blue-900/40 text-blue-300',
  sent_3: 'bg-blue-900/40 text-blue-300',
  replied: 'bg-green-900/40 text-green-300',
  demo_booked: 'bg-yellow-900/40 text-yellow-300',
  customer: 'bg-emerald-900/40 text-emerald-300',
  unsubscribed: 'bg-slate-800 text-slate-500',
  bounced: 'bg-red-900/40 text-red-300',
  paused: 'bg-amber-900/40 text-amber-300',
}

export function CampaignsView({ settings, template, stats, lastSends, clubsPreview }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [subject, setSubject] = useState(template?.subject ?? '')
  const [body, setBody] = useState(template?.body_html ?? '')
  const [cap, setCap] = useState(settings?.daily_send_cap ?? 50)
  const [testEmail, setTestEmail] = useState('dgbravofernandez@gmail.com')

  const remainingToday = Math.max(0, (settings?.daily_send_cap ?? 50) - stats.sentToday)
  const progressPct = stats.total > 0 ? Math.round(((stats.sent + stats.replied + stats.bounced + stats.unsubscribed) / stats.total) * 100) : 0

  function handleRunBatch() {
    if (!confirm(`Vas a enviar hasta ${remainingToday} emails AHORA. ¿Continuar?`)) return
    startTransition(async () => {
      toast.loading('Enviando tanda...', { id: 'batch' })
      const res = await runCampaignBatch()
      if (res.success) {
        toast.success(res.message ?? `${res.sent} enviados`, { id: 'batch' })
        router.refresh()
      } else {
        toast.error(res.error ?? 'Error', { id: 'batch' })
      }
    })
  }

  function handlePause() {
    startTransition(async () => {
      const res = await pauseCampaign(!settings?.is_paused)
      if (res.success) {
        toast.success(settings?.is_paused ? 'Reanudada' : 'Pausada')
        router.refresh()
      } else {
        toast.error(res.error ?? 'Error')
      }
    })
  }

  function handleSaveTemplate() {
    startTransition(async () => {
      const res = await updateTemplate('email_1', subject, body)
      if (res.success) {
        toast.success('Plantilla guardada')
        router.refresh()
      } else {
        toast.error(res.error ?? 'Error')
      }
    })
  }

  function handleSaveCap() {
    startTransition(async () => {
      const res = await updateDailyCap(cap)
      if (res.success) {
        toast.success('Límite actualizado')
        router.refresh()
      } else {
        toast.error(res.error ?? 'Error')
      }
    })
  }

  function handleSendTest() {
    startTransition(async () => {
      const res = await sendTestEmail(testEmail)
      if (res.success) toast.success(`Test enviado a ${testEmail}`)
      else toast.error(res.error ?? 'Error')
    })
  }

  function handleMarkReplied(clubId: string) {
    startTransition(async () => {
      const res = await markReplied(clubId)
      if (res.success) {
        toast.success('Marcado como respondido')
        router.refresh()
      } else {
        toast.error(res.error ?? 'Error')
      }
    })
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Campañas de captación</h1>
        <p className="text-sm text-slate-400 mt-1">628 clubes RFFM importados · cron diario 10:00 L-V · Gmail SMTP (500/día)</p>
      </div>

      {/* Status & controles */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className={`w-3 h-3 rounded-full ${settings?.is_paused ? 'bg-amber-500' : 'bg-green-500 animate-pulse'}`}></div>
            <div>
              <p className="text-white font-semibold">{settings?.is_paused ? 'Pausada' : 'Activa'}</p>
              <p className="text-xs text-slate-400">
                Hoy: {stats.sentToday} / {settings?.daily_send_cap ?? 50} enviados · {remainingToday} restantes
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePause}
              disabled={isPending}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-800 text-slate-200 hover:bg-slate-700 text-sm font-medium disabled:opacity-50"
            >
              {settings?.is_paused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
              {settings?.is_paused ? 'Reanudar' : 'Pausar'}
            </button>
            <button
              onClick={handleRunBatch}
              disabled={isPending || settings?.is_paused || remainingToday === 0}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-yellow-500 text-black hover:bg-yellow-400 text-sm font-bold disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Send className="w-4 h-4" />
              Enviar {remainingToday} ahora
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mt-4">
          <Stat icon={Users} label="Total" value={stats.total} color="text-slate-300" />
          <Stat icon={Mail} label="Pendientes" value={stats.pending} color="text-slate-300" />
          <Stat icon={CheckCircle2} label="Enviados" value={stats.sent} color="text-blue-300" />
          <Stat icon={Reply} label="Respondieron" value={stats.replied} color="text-green-400" />
          <Stat icon={AlertTriangle} label="Rebotados" value={stats.bounced} color="text-red-400" />
          <Stat icon={BanIcon} label="Bajas" value={stats.unsubscribed} color="text-slate-500" />
        </div>

        <div className="mt-4">
          <div className="flex justify-between text-xs text-slate-400 mb-1">
            <span>Progreso de la campaña</span>
            <span>{progressPct}% ({stats.sent + stats.replied + stats.bounced + stats.unsubscribed} / {stats.total})</span>
          </div>
          <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
            <div className="h-full bg-yellow-500 transition-all" style={{ width: `${progressPct}%` }}></div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Plantilla */}
        <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
          <h2 className="text-white font-semibold">Plantilla email_1</h2>
          <p className="text-xs text-slate-400">Variables: {`{{club_name}}`}, {`{{location}}`}, {`{{federation}}`}, {`{{unsubscribe_url}}`}</p>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Asunto</label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Cuerpo HTML</label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={14}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-xs font-mono"
            />
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleSaveTemplate}
              disabled={isPending}
              className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-500 text-sm font-medium disabled:opacity-50"
            >
              Guardar plantilla
            </button>
            <input
              type="email"
              value={testEmail}
              onChange={(e) => setTestEmail(e.target.value)}
              placeholder="email de prueba"
              className="flex-1 px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm"
            />
            <button
              onClick={handleSendTest}
              disabled={isPending}
              className="px-4 py-2 rounded-lg bg-slate-700 text-slate-200 hover:bg-slate-600 text-sm font-medium disabled:opacity-50"
            >
              Enviar test
            </button>
          </div>
        </div>

        {/* Settings */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
          <h2 className="text-white font-semibold">Ajustes</h2>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Envíos por día (máx)</label>
            <div className="flex gap-2">
              <input
                type="number"
                min={1}
                max={500}
                value={cap}
                onChange={(e) => setCap(parseInt(e.target.value) || 50)}
                className="w-24 px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm"
              />
              <button
                onClick={handleSaveCap}
                disabled={isPending}
                className="px-3 py-2 rounded-lg bg-slate-700 text-slate-200 hover:bg-slate-600 text-xs disabled:opacity-50"
              >
                Guardar
              </button>
            </div>
            <p className="text-xs text-slate-500 mt-1">Gmail limita a 500/día. Recomendado 50.</p>
          </div>
          <div className="text-xs text-slate-400 space-y-1 pt-3 border-t border-slate-800">
            <p><span className="text-slate-500">Desde:</span> {settings?.from_email}</p>
            <p><span className="text-slate-500">Nombre:</span> {settings?.from_name}</p>
            <p><span className="text-slate-500">Cron:</span> L-V 10:00 UTC</p>
            <p><span className="text-slate-500">A día de hoy:</span> {stats.total - stats.pending} de {stats.total} contactados</p>
          </div>
        </div>
      </div>

      {/* Últimos envíos */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
        <h2 className="text-white font-semibold mb-3">Últimos 20 envíos</h2>
        {lastSends.length === 0 ? (
          <p className="text-sm text-slate-500 py-6 text-center">Sin envíos todavía. Pulsa &quot;Enviar ahora&quot; para empezar.</p>
        ) : (
          <div className="space-y-1">
            {lastSends.map((s) => {
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

      {/* Lista de clubes (top 50) */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
        <h2 className="text-white font-semibold mb-3">Clubes ({stats.total}) — mostrando 50</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-slate-500 border-b border-slate-800">
                <th className="text-left py-2 px-2">Club</th>
                <th className="text-left py-2 px-2">Email</th>
                <th className="text-left py-2 px-2">Ubicación</th>
                <th className="text-left py-2 px-2">Estado</th>
                <th className="text-left py-2 px-2">Último envío</th>
                <th className="text-right py-2 px-2">Acción</th>
              </tr>
            </thead>
            <tbody>
              {clubsPreview.map((c) => (
                <tr key={c.id} className="border-b border-slate-800/50 hover:bg-slate-800/30">
                  <td className="py-2 px-2 text-white">{c.name}</td>
                  <td className="py-2 px-2 text-slate-400 text-xs">{c.email}</td>
                  <td className="py-2 px-2 text-slate-500 text-xs">{c.location}</td>
                  <td className="py-2 px-2">
                    <span className={`text-xs px-2 py-0.5 rounded ${STATUS_COLORS[c.status] ?? 'bg-slate-700 text-slate-300'}`}>
                      {STATUS_LABELS[c.status] ?? c.status}
                    </span>
                  </td>
                  <td className="py-2 px-2 text-slate-500 text-xs">
                    {c.last_sent_at ? new Date(c.last_sent_at).toLocaleDateString('es-ES') : '—'}
                  </td>
                  <td className="py-2 px-2 text-right">
                    {(c.status === 'sent_1' || c.status === 'sent_2') && (
                      <button
                        onClick={() => handleMarkReplied(c.id)}
                        disabled={isPending}
                        className="text-xs px-2 py-1 rounded bg-green-900/40 text-green-300 hover:bg-green-900/60"
                      >
                        Marcar respondido
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function Stat({ icon: Icon, label, value, color }: { icon: React.ComponentType<{ className?: string }>, label: string, value: number, color: string }) {
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
