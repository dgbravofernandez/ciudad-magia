'use client'
import {
  Users,
  UserCheck,
  Calendar,
  TrendingUp,
  TrendingDown,
  ArrowRight,
  Shirt,
  Trophy,
  Heart,
  Cake,
  Activity,
  Euro,
} from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import Link from 'next/link'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

interface UpcomingSession {
  id: string
  session_date: string
  start_time: string | null
  opponent: string | null
  session_type: string
  team_name: string
}

interface Birthday {
  id: string
  first_name: string
  last_name: string
  team_name: string
  next_bday: string
  days: number
  age: number
}

interface MonthEntry {
  mes: string
  ingresos: number
  sesiones: number
}

interface Props {
  totalPlayers: number
  activePlayers: number
  injuredPlayers: number
  sessionsThisMonth: number
  matchesThisMonth: number
  revenueThisMonth: number
  expensesThisMonth: number
  attendancePct: number
  attendanceSamples: number
  monthlyChart: MonthEntry[]
  upcomingSessions: UpcomingSession[]
  upcomingBirthdays: Birthday[]
}

function formatEuro(n: number): string {
  return `${n.toLocaleString('es-ES')} €`
}

function formatShortDate(iso: string): string {
  const [y, m, d] = iso.split('-')
  return `${d}/${m}`
  void y
}

const SESSION_TYPE_LABELS: Record<string, string> = {
  training: 'Entrenamiento',
  match: 'Partido',
  friendly: 'Amistoso',
  futsal: 'Futsal',
}

export function DashboardView({
  totalPlayers,
  activePlayers,
  injuredPlayers,
  sessionsThisMonth,
  matchesThisMonth,
  revenueThisMonth,
  expensesThisMonth,
  attendancePct,
  attendanceSamples,
  monthlyChart,
  upcomingSessions,
  upcomingBirthdays,
}: Props) {
  const today = format(new Date(), "EEEE, d 'de' MMMM yyyy", { locale: es })
  const balance = revenueThisMonth - expensesThisMonth

  const kpis = [
    {
      label: 'Jugadores activos',
      value: `${activePlayers}`,
      sub: `de ${totalPlayers} totales`,
      icon: UserCheck,
      color: '#10b981',
      bg: '#ecfdf5',
      href: '/jugadores',
    },
    {
      label: 'Lesionados',
      value: `${injuredPlayers}`,
      sub: injuredPlayers === 1 ? 'jugador' : 'jugadores',
      icon: Heart,
      color: '#ef4444',
      bg: '#fef2f2',
      href: '/personal/fisio',
    },
    {
      label: 'Sesiones (mes)',
      value: `${sessionsThisMonth}`,
      sub: `${matchesThisMonth} partidos`,
      icon: Calendar,
      color: '#8b5cf6',
      bg: '#f5f3ff',
      href: '/entrenadores/sesiones',
    },
    {
      label: 'Asistencia',
      value: `${attendancePct}%`,
      sub: `${attendanceSamples} registros`,
      icon: Activity,
      color: '#0ea5e9',
      bg: '#f0f9ff',
      href: '/entrenadores',
    },
    {
      label: 'Ingresos (mes)',
      value: formatEuro(revenueThisMonth),
      sub: '',
      icon: TrendingUp,
      color: '#059669',
      bg: '#ecfdf5',
      href: '/contabilidad/pagos',
    },
    {
      label: 'Gastos (mes)',
      value: formatEuro(expensesThisMonth),
      sub: '',
      icon: TrendingDown,
      color: '#ef4444',
      bg: '#fef2f2',
      href: '/contabilidad/gastos',
    },
    {
      label: 'Balance',
      value: formatEuro(balance),
      sub: balance >= 0 ? 'positivo' : 'negativo',
      icon: Euro,
      color: balance >= 0 ? '#059669' : '#ef4444',
      bg: balance >= 0 ? '#ecfdf5' : '#fef2f2',
      href: '/contabilidad',
    },
  ]

  const quickLinks = [
    { href: '/jugadores', label: 'Jugadores', icon: Users, desc: 'Plantilla' },
    { href: '/entrenadores', label: 'Entrenadores', icon: Calendar, desc: 'Equipos y sesiones' },
    { href: '/contabilidad', label: 'Contabilidad', icon: TrendingUp, desc: 'Pagos y gastos' },
    { href: '/torneos', label: 'Torneos', icon: Trophy, desc: 'Competiciones' },
    { href: '/ropa', label: 'Ropa', icon: Shirt, desc: 'Pedidos' },
  ]

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-sm text-gray-500 capitalize">{today}</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        {kpis.map((kpi) => (
          <Link
            key={kpi.label}
            href={kpi.href}
            className="bg-white rounded-xl border border-gray-100 shadow-sm p-3 hover:border-gray-300 hover:shadow-md transition-all"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-medium text-gray-500 uppercase tracking-wide">
                {kpi.label}
              </span>
              <div
                className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                style={{ backgroundColor: kpi.bg }}
              >
                <kpi.icon className="w-3.5 h-3.5" style={{ color: kpi.color }} />
              </div>
            </div>
            <p className="text-lg font-bold text-gray-900 leading-tight">{kpi.value}</p>
            {kpi.sub && <p className="text-[11px] text-gray-500 mt-0.5">{kpi.sub}</p>}
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Chart */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-100 shadow-sm p-6">
          <h2 className="text-base font-semibold text-gray-900 mb-4">Actividad últimos 6 meses</h2>
          {monthlyChart.every((m) => m.sesiones === 0 && m.ingresos === 0) ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              Todavía no hay datos suficientes para el gráfico.
            </p>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={monthlyChart}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="mes" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip
                  formatter={(value: number | string, name: string) =>
                    name === 'ingresos' ? `${Number(value).toLocaleString('es-ES')} €` : value
                  }
                />
                <Bar dataKey="sesiones" fill="#8b5cf6" radius={[4, 4, 0, 0]} name="Sesiones" />
                <Bar dataKey="ingresos" fill="#10b981" radius={[4, 4, 0, 0]} name="Ingresos (€)" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Próximas sesiones */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-semibold text-gray-900">Próximos 7 días</h2>
            <Link href="/entrenadores/sesiones" className="text-xs text-blue-600 hover:underline">
              Ver todas
            </Link>
          </div>
          {upcomingSessions.length === 0 ? (
            <p className="text-sm text-gray-500 py-8 text-center">Sin sesiones programadas.</p>
          ) : (
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {upcomingSessions.map((s) => (
                <Link
                  key={s.id}
                  href={
                    s.session_type === 'match' || s.session_type === 'friendly'
                      ? `/entrenadores/partidos/${s.id}`
                      : `/entrenadores/sesiones/${s.id}`
                  }
                  className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50"
                >
                  <div className="w-10 text-center shrink-0">
                    <p className="text-xs text-gray-500">{formatShortDate(s.session_date)}</p>
                    {s.start_time && <p className="text-xs font-mono text-gray-700">{s.start_time}</p>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{s.team_name}</p>
                    <p className="text-xs text-gray-500 truncate">
                      {SESSION_TYPE_LABELS[s.session_type] ?? s.session_type}
                      {s.opponent ? ` · vs ${s.opponent}` : ''}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Cumpleaños */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2">
            <Cake className="w-4 h-4 text-pink-500" />
            Cumpleaños (próximas 2 semanas)
          </h2>
        </div>
        {upcomingBirthdays.length === 0 ? (
          <p className="text-sm text-gray-500 py-4 text-center">Sin cumpleaños en las próximas 2 semanas.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2">
            {upcomingBirthdays.map((b) => (
              <Link
                key={b.id}
                href={`/jugadores/${b.id}`}
                className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50"
              >
                <div className="w-10 h-10 rounded-full bg-pink-50 flex items-center justify-center text-pink-500">
                  <Cake className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">
                    {b.first_name} {b.last_name}
                  </p>
                  <p className="text-xs text-gray-500 truncate">
                    {b.days === 0
                      ? '¡Hoy!'
                      : b.days === 1
                        ? 'Mañana'
                        : `En ${b.days} días`}
                    {b.team_name ? ` · ${b.team_name}` : ''}
                  </p>
                </div>
                <span className="text-xs font-bold text-pink-500 shrink-0">{b.age}</span>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Quick links */}
      <div>
        <h2 className="text-base font-semibold text-gray-900 mb-3">Accesos rápidos</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          {quickLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 hover:border-blue-200 hover:shadow-md transition-all group"
            >
              <link.icon className="w-5 h-5 text-gray-400 group-hover:text-blue-500 mb-2 transition-colors" />
              <p className="font-medium text-gray-900 text-sm">{link.label}</p>
              <p className="text-xs text-gray-500 mt-0.5">{link.desc}</p>
              <ArrowRight className="w-3 h-3 text-gray-300 group-hover:text-blue-500 mt-2 transition-colors" />
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
