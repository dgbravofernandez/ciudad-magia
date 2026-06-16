import { getAllClubsWithMetrics, getPlatformMetrics, getConversionMetrics } from '@/features/superadmin/actions/superadmin.actions'
import { SuperadminClubsTable } from '@/features/superadmin/components/SuperadminClubsTable'
import {
  TrendingUp, Users, AlertTriangle, CheckCircle2,
  ArrowRight, Euro, Clock, XCircle, PhoneCall, Mail,
} from 'lucide-react'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

export default async function SuperadminPage() {
  const [clubsResult, metricsResult, convResult] = await Promise.all([
    getAllClubsWithMetrics(),
    getPlatformMetrics(),
    getConversionMetrics(),
  ])

  const clubs = clubsResult.clubs ?? []
  const metrics = metricsResult.metrics
  const conv = convResult.data

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Panel de Plataforma</h1>
          <p className="text-slate-400 text-sm mt-1">Conversión, MRR y estado de todos los clubs</p>
        </div>
      </div>

      {/* ── Fila 1: KPIs financieros ── */}
      {conv && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard
            label="MRR"
            value={`€${conv.mrr.toLocaleString('es-ES')}`}
            sub={`ARR €${conv.arr.toLocaleString('es-ES')}`}
            color="green"
            icon={Euro}
          />
          <KpiCard
            label="Clientes activos"
            value={conv.activeCustomers}
            sub={`${conv.conversionRate}% conversión trial→paid`}
            color="blue"
            icon={CheckCircle2}
          />
          <KpiCard
            label="Trials activos"
            value={conv.trialActive}
            sub={conv.trialUrgent > 0 ? `⚠️ ${conv.trialUrgent} expiran ≤3 días` : 'Sin urgencias'}
            color={conv.trialUrgent > 0 ? 'orange' : 'slate'}
            icon={Clock}
          />
          <KpiCard
            label="Trials caducados"
            value={conv.trialExpired + conv.pastDue}
            sub={`${conv.trialExpired} sin convertir · ${conv.pastDue} past due`}
            color={conv.trialExpired > 0 ? 'red' : 'slate'}
            icon={XCircle}
          />
        </div>
      )}

      {/* ── Fila 2: Pipeline de conversión ── */}
      {conv && (
        <div className="bg-slate-900 rounded-xl border border-slate-800 p-5">
          <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wide mb-4">
            Pipeline de conversión
          </h2>
          <div className="flex items-center gap-1 flex-wrap">
            <PipelineStep label="Leads" value={conv.leadsTotal} color="slate" />
            <ArrowRight className="w-3 h-3 text-slate-600 shrink-0" />
            <PipelineStep label="Enviados" value={conv.leadsSent} color="slate" pct={conv.leadsTotal > 0 ? Math.round((conv.leadsSent / conv.leadsTotal) * 100) : 0} />
            <ArrowRight className="w-3 h-3 text-slate-600 shrink-0" />
            <PipelineStep label="Aperturas" value={conv.leadsOpened} color="blue" pct={conv.leadsSent > 0 ? Math.round((conv.leadsOpened / conv.leadsSent) * 100) : 0} />
            <ArrowRight className="w-3 h-3 text-slate-600 shrink-0" />
            <PipelineStep label="Demos" value={conv.demos} color="purple" pct={conv.leadsOpened > 0 ? Math.round((conv.demos / conv.leadsOpened) * 100) : 0} />
            <ArrowRight className="w-3 h-3 text-slate-600 shrink-0" />
            <PipelineStep label="Trials" value={conv.trialActive + conv.trialExpired + conv.activeCustomers} color="yellow" pct={conv.demos > 0 ? Math.round(((conv.trialActive + conv.trialExpired + conv.activeCustomers) / conv.demos) * 100) : 0} />
            <ArrowRight className="w-3 h-3 text-slate-600 shrink-0" />
            <PipelineStep label="Clientes" value={conv.activeCustomers} color="green" pct={conv.trialActive + conv.trialExpired + conv.activeCustomers > 0 ? Math.round((conv.activeCustomers / (conv.trialActive + conv.trialExpired + conv.activeCustomers)) * 100) : 0} highlight />
          </div>

          {/* Insight de conversión */}
          <div className="mt-4 pt-4 border-t border-slate-800 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs text-slate-400">
            <div>
              <span className="text-slate-500">Open rate: </span>
              <span className="text-white font-semibold">
                {conv.leadsSent > 0 ? `${Math.round((conv.leadsOpened / conv.leadsSent) * 100)}%` : '—'}
              </span>
              <span className="text-slate-600 ml-1">(objetivo: 25%)</span>
            </div>
            <div>
              <span className="text-slate-500">Demo rate: </span>
              <span className="text-white font-semibold">
                {conv.leadsOpened > 0 ? `${Math.round((conv.demos / conv.leadsOpened) * 100)}%` : '—'}
              </span>
              <span className="text-slate-600 ml-1">(objetivo: 15%)</span>
            </div>
            <div>
              <span className="text-slate-500">Trial→Paid: </span>
              <span className="text-white font-semibold">{conv.conversionRate}%</span>
              <span className="text-slate-600 ml-1">(objetivo: 40%)</span>
            </div>
          </div>
        </div>
      )}

      {/* ── Fila 3: Alertas urgentes ── */}
      {conv && conv.urgentClubs.length > 0 && (
        <div className="bg-orange-500/10 border border-orange-500/30 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle className="w-4 h-4 text-orange-400" />
            <h2 className="text-sm font-semibold text-orange-300">
              Acción requerida — {conv.urgentClubs.length} trial{conv.urgentClubs.length > 1 ? 's' : ''} expirando pronto
            </h2>
          </div>
          <div className="space-y-2">
            {conv.urgentClubs.map((c) => {
              const expired = c.daysLeft <= 0
              const activityDays = c.last_activity
                ? Math.floor((Date.now() - new Date(c.last_activity).getTime()) / 86_400_000)
                : null
              return (
                <div key={c.id} className="flex items-center gap-4 bg-slate-900/60 rounded-lg px-4 py-3">
                  <div className="shrink-0">
                    <span className={`text-xs font-bold px-2 py-1 rounded-full ${expired ? 'bg-red-500/20 text-red-400' : 'bg-orange-500/20 text-orange-400'}`}>
                      {expired ? 'Caducado' : `${c.daysLeft}d`}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-medium text-sm truncate">{c.name}</p>
                    <p className="text-slate-400 text-xs">
                      {c.player_count} jugadores
                      {activityDays !== null && (
                        <span className={activityDays > 7 ? ' text-orange-400' : ''}> · activo hace {activityDays === 0 ? 'hoy' : `${activityDays}d`}</span>
                      )}
                    </p>
                  </div>
                  <div className="shrink-0 flex items-center gap-2">
                    {c.owner_email && (
                      <a
                        href={`mailto:${c.owner_email}?subject=¿Cómo va tu prueba de Cluberly?`}
                        className="flex items-center gap-1 px-2 py-1 bg-slate-800 hover:bg-slate-700 rounded text-xs text-slate-300 transition-colors"
                      >
                        <Mail className="w-3 h-3" />
                        Email
                      </a>
                    )}
                    <Link
                      href={`/superadmin?filter=urgent`}
                      className="flex items-center gap-1 px-2 py-1 bg-yellow-400 hover:opacity-90 rounded text-xs text-black font-medium transition-opacity"
                    >
                      <PhoneCall className="w-3 h-3" />
                      Follow-up
                    </Link>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Fila 4: Métricas plataforma (secundarias) ── */}
      {metrics && (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          <SmallMetric label="Clubs totales" value={metrics.total_clubs} />
          <SmallMetric label="Clubs activos" value={metrics.active_clubs} />
          <SmallMetric label="Jugadores" value={metrics.total_players} />
          <SmallMetric label="Staff" value={metrics.total_members} />
          <SmallMetric label="Con Google Sheets" value={metrics.clubs_with_sheets} />
        </div>
      )}

      {/* ── Tabla de clubs ── */}
      <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
          <h2 className="font-semibold text-white">Clubs registrados</h2>
          <span className="text-sm text-slate-400">{clubs.length} total</span>
        </div>
        <SuperadminClubsTable clubs={clubs} />
      </div>
    </div>
  )
}

// ─── Componentes ──────────────────────────────────────────────────────────────

function KpiCard({
  label, value, sub, color, icon: Icon,
}: {
  label: string
  value: string | number
  sub: string
  color: 'green' | 'blue' | 'orange' | 'red' | 'slate'
  icon: React.ComponentType<{ className?: string }>
}) {
  const colorMap = {
    green:  { card: 'border-green-500/20',  icon: 'bg-green-500/10 text-green-400',  val: 'text-green-300' },
    blue:   { card: 'border-blue-500/20',   icon: 'bg-blue-500/10 text-blue-400',    val: 'text-blue-300' },
    orange: { card: 'border-orange-500/30', icon: 'bg-orange-500/10 text-orange-400', val: 'text-orange-300' },
    red:    { card: 'border-red-500/20',    icon: 'bg-red-500/10 text-red-400',      val: 'text-red-300' },
    slate:  { card: 'border-slate-800',     icon: 'bg-slate-800 text-slate-400',     val: 'text-white' },
  }
  const c = colorMap[color]
  return (
    <div className={`bg-slate-900 rounded-xl border ${c.card} p-4`}>
      <div className={`w-8 h-8 rounded-lg ${c.icon} flex items-center justify-center mb-3`}>
        <Icon className="w-4 h-4" />
      </div>
      <p className={`text-2xl font-bold ${c.val}`}>{typeof value === 'number' ? value.toLocaleString('es-ES') : value}</p>
      <p className="text-xs text-slate-500 mt-0.5">{label}</p>
      <p className="text-xs text-slate-600 mt-1">{sub}</p>
    </div>
  )
}

function PipelineStep({
  label, value, color, pct, highlight,
}: {
  label: string
  value: number
  color: 'slate' | 'blue' | 'purple' | 'yellow' | 'green'
  pct?: number
  highlight?: boolean
}) {
  const colorMap = {
    slate:  'text-slate-300 bg-slate-800',
    blue:   'text-blue-300 bg-blue-500/10',
    purple: 'text-purple-300 bg-purple-500/10',
    yellow: 'text-yellow-300 bg-yellow-400/10',
    green:  'text-green-300 bg-green-500/10',
  }
  return (
    <div className={`flex flex-col items-center px-4 py-3 rounded-xl ${highlight ? 'ring-2 ring-green-500/40 bg-green-500/5' : 'bg-slate-800/50'}`}>
      <span className={`text-xl font-bold ${colorMap[color].split(' ')[0]}`}>{value.toLocaleString('es-ES')}</span>
      <span className="text-xs text-slate-500 mt-0.5">{label}</span>
      {pct !== undefined && (
        <span className={`text-xs mt-1 px-1.5 py-0.5 rounded-full ${colorMap[color]}`}>{pct}%</span>
      )}
    </div>
  )
}

function SmallMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-slate-900 rounded-lg border border-slate-800 px-4 py-3 flex items-center gap-3">
      <div className="flex-1 min-w-0">
        <p className="text-lg font-bold text-white">{value.toLocaleString('es-ES')}</p>
        <p className="text-xs text-slate-500 truncate">{label}</p>
      </div>
    </div>
  )
}
