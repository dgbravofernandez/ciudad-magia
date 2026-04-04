'use client'
import { Users, UserCheck, Calendar, TrendingUp, TrendingDown, ArrowRight, Shirt, Trophy } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import Link from 'next/link'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

interface Props {
  totalPlayers: number
  activePlayers: number
  sessionsThisMonth: number
  revenueThisMonth: number
  expensesThisMonth: number
}

const monthlyData = [
  { mes: 'Nov', sesiones: 12, ingresos: 3200 },
  { mes: 'Dic', sesiones: 8, ingresos: 2800 },
  { mes: 'Ene', sesiones: 14, ingresos: 3600 },
  { mes: 'Feb', sesiones: 16, ingresos: 3900 },
  { mes: 'Mar', sesiones: 15, ingresos: 4100 },
  { mes: 'Abr', sesiones: 10, ingresos: 2900 },
]

export function DashboardView({ totalPlayers, activePlayers, sessionsThisMonth, revenueThisMonth, expensesThisMonth }: Props) {
  const today = format(new Date(), "EEEE, d 'de' MMMM yyyy", { locale: es })

  const kpis = [
    { label: 'Total Jugadores', value: totalPlayers, icon: Users, color: '#3b82f6', bg: '#eff6ff' },
    { label: 'Jugadores Activos', value: activePlayers, icon: UserCheck, color: '#10b981', bg: '#ecfdf5' },
    { label: 'Sesiones (mes)', value: sessionsThisMonth, icon: Calendar, color: '#8b5cf6', bg: '#f5f3ff' },
    { label: 'Ingresos (mes)', value: `${revenueThisMonth.toLocaleString('es-ES')} €`, icon: TrendingUp, color: '#059669', bg: '#ecfdf5' },
    { label: 'Gastos (mes)', value: `${expensesThisMonth.toLocaleString('es-ES')} €`, icon: TrendingDown, color: '#ef4444', bg: '#fef2f2' },
  ]

  const quickLinks = [
    { href: '/jugadores', label: 'Jugadores', icon: Users, desc: 'Ver plantilla completa' },
    { href: '/entrenadores/sesiones', label: 'Sesiones', icon: Calendar, desc: 'Registrar sesión' },
    { href: '/contabilidad/pagos', label: 'Pagos', icon: TrendingUp, desc: 'Gestionar cuotas' },
    { href: '/torneos', label: 'Torneos', icon: Trophy, desc: 'Ver competiciones' },
    { href: '/ropa', label: 'Ropa', icon: Shirt, desc: 'Pedidos de equipación' },
  ]

  return (
    <div className="p-6 space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-sm text-gray-500 capitalize">{today}</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {kpis.map((kpi) => (
          <div key={kpi.label} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">{kpi.label}</span>
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: kpi.bg }}>
                <kpi.icon className="w-4 h-4" style={{ color: kpi.color }} />
              </div>
            </div>
            <p className="text-2xl font-bold text-gray-900">{kpi.value}</p>
          </div>
        ))}
      </div>

      {/* Chart */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
        <h2 className="text-base font-semibold text-gray-900 mb-4">Actividad mensual</h2>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={monthlyData}>
            <XAxis dataKey="mes" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} />
            <Tooltip />
            <Bar dataKey="sesiones" fill="#3b82f6" radius={[4, 4, 0, 0]} name="Sesiones" />
            <Bar dataKey="ingresos" fill="#10b981" radius={[4, 4, 0, 0]} name="Ingresos €" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Quick links */}
      <div>
        <h2 className="text-base font-semibold text-gray-900 mb-4">Accesos rápidos</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {quickLinks.map((link) => (
            <Link key={link.href} href={link.href} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 hover:border-blue-200 hover:shadow-md transition-all group">
              <link.icon className="w-6 h-6 text-gray-400 group-hover:text-blue-500 mb-2 transition-colors" />
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
