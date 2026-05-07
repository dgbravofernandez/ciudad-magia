import { getAllClubsWithMetrics, getPlatformMetrics } from '@/features/superadmin/actions/superadmin.actions'
import { SuperadminClubsTable } from '@/features/superadmin/components/SuperadminClubsTable'
import { Building2, Users, Trophy, ShieldCheck, Wifi } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function SuperadminPage() {
  const [clubsResult, metricsResult] = await Promise.all([
    getAllClubsWithMetrics(),
    getPlatformMetrics(),
  ])

  const clubs = clubsResult.clubs ?? []
  const metrics = metricsResult.metrics

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Panel de Plataforma</h1>
        <p className="text-slate-400 text-sm mt-1">Visión global de todos los clubs en Ciudad Magia</p>
      </div>

      {/* Métricas globales */}
      {metrics && (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          <MetricCard icon={Building2} label="Clubs totales" value={metrics.total_clubs} color="blue" />
          <MetricCard icon={ShieldCheck} label="Clubs activos" value={metrics.active_clubs} color="green" />
          <MetricCard icon={Users} label="Jugadores activos" value={metrics.total_players} color="yellow" />
          <MetricCard icon={Trophy} label="Usuarios de staff" value={metrics.total_members} color="purple" />
          <MetricCard icon={Wifi} label="Con Google Sheets" value={metrics.clubs_with_sheets} color="cyan" />
        </div>
      )}

      {/* Tabla de clubs */}
      <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
          <h2 className="font-semibold text-white">Clubs registrados</h2>
          <span className="text-sm text-slate-400">{clubs.length} club{clubs.length !== 1 ? 's' : ''}</span>
        </div>
        <SuperadminClubsTable clubs={clubs} />
      </div>
    </div>
  )
}

function MetricCard({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: number
  color: 'blue' | 'green' | 'yellow' | 'purple' | 'cyan'
}) {
  const colorMap = {
    blue: 'bg-blue-500/10 text-blue-400',
    green: 'bg-green-500/10 text-green-400',
    yellow: 'bg-yellow-400/10 text-yellow-400',
    purple: 'bg-purple-500/10 text-purple-400',
    cyan: 'bg-cyan-500/10 text-cyan-400',
  }

  return (
    <div className="bg-slate-900 rounded-xl border border-slate-800 p-4">
      <div className={`w-8 h-8 rounded-lg ${colorMap[color]} flex items-center justify-center mb-3`}>
        <Icon className="w-4 h-4" />
      </div>
      <p className="text-2xl font-bold text-white">{value.toLocaleString()}</p>
      <p className="text-xs text-slate-400 mt-0.5">{label}</p>
    </div>
  )
}
