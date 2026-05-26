'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useClub } from '@/context/ClubContext'
import { useCurrentUser } from '@/context/UserContext'
import { Check, Zap, ExternalLink } from 'lucide-react'

export const dynamic = 'force-dynamic'

const PLANS = [
  {
    id: 'starter',
    name: 'Starter',
    icon: '🌱',
    color: '#10B981',
    monthlyPrice: 49,
    annualPrice: 490,
    annualMonthly: 41,
    limit: 'Hasta 75 miembros',
    features: ['Miembros y grupos', 'Sesiones y asistencia', 'Cuotas manual', 'Emails', 'Soporte email'],
  },
  {
    id: 'pro',
    name: 'Pro',
    icon: '⚽',
    color: '#6366F1',
    monthlyPrice: 99,
    annualPrice: 990,
    annualMonthly: 83,
    limit: 'Hasta 200 miembros',
    popular: true,
    features: ['Todo Starter', 'Grupos ilimitados', 'Gastos y balance', 'Recordatorios automáticos', 'SMTP propio', 'Métricas por deporte'],
  },
  {
    id: 'club',
    name: 'Club',
    icon: '🏆',
    color: '#F59E0B',
    monthlyPrice: 179,
    annualPrice: 1790,
    annualMonthly: 149,
    limit: 'Hasta 500 miembros',
    features: ['Todo Pro', '500 miembros', 'Evaluaciones', 'Lesiones avanzado', 'Exportación', 'Soporte telefónico'],
  },
  {
    id: 'elite',
    name: 'Elite',
    icon: '👑',
    color: '#0F172A',
    monthlyPrice: 279,
    annualPrice: 2790,
    annualMonthly: 233,
    limit: 'Ilimitados',
    features: ['Todo Club', 'Miembros ilimitados', 'Multi-deporte ilimitado', 'API access', 'SLA', 'Account manager'],
  },
]

export default function UpgradePage() {
  const { club } = useClub()
  const { member } = useCurrentUser()
  const router = useRouter()
  const [annual, setAnnual] = useState(true)
  const [isPending, startTransition] = useTransition()
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null)

  async function openPortal() {
    startTransition(async () => {
      const res = await fetch('/api/stripe/portal', { method: 'POST' })
      const { url } = await res.json()
      if (url) window.location.href = url
    })
  }

  async function startCheckout(planId: string) {
    if (planId === 'elite') {
      window.location.href = 'mailto:iakevoapp@gmail.com?subject=Plan%20Elite%20-%20' + encodeURIComponent(club.name)
      return
    }
    setLoadingPlan(planId)
    startTransition(async () => {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId, annual, clubId: club.id, email: member.email }),
      })
      const { url, error } = await res.json()
      if (error) { alert(error); setLoadingPlan(null); return }
      if (url) window.location.href = url
    })
  }

  const currentPlan = (club as { plan?: string }).plan ?? 'trial'
  const hasStripe = !!(club as { stripe_customer_id?: string }).stripe_customer_id

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Plan y facturación</h1>
        <p className="text-gray-500 text-sm mt-1">Gestiona tu suscripción y mejora tu plan cuando quieras.</p>
      </div>

      {/* Current plan banner */}
      <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 mb-8 flex items-center justify-between flex-wrap gap-3">
        <div>
          <p className="text-sm text-indigo-600 font-semibold uppercase tracking-wide">Plan actual</p>
          <p className="text-lg font-bold text-indigo-900 capitalize">{currentPlan === 'trial' ? '🕐 Prueba gratuita' : currentPlan}</p>
        </div>
        {hasStripe && (
          <button onClick={openPortal} disabled={isPending}
            className="flex items-center gap-2 text-sm font-semibold text-indigo-600 hover:text-indigo-800 border border-indigo-300 rounded-lg px-3 py-2 hover:bg-indigo-100 transition-colors">
            <ExternalLink size={14} /> Gestionar facturación
          </button>
        )}
      </div>

      {/* LTD Banner */}
      <div className="bg-amber-50 border border-amber-300 rounded-xl p-5 mb-8 text-center">
        <div className="text-2xl mb-1">⚡</div>
        <p className="font-bold text-amber-900">Oferta fundadores — Acceso de por vida al plan Pro por <span className="text-amber-600">€199</span></p>
        <p className="text-sm text-amber-700 mt-1 mb-3">Pago único. Sin cuotas mensuales. Solo 18 plazas restantes.</p>
        <button onClick={() => startCheckout('ltd')} disabled={isPending}
          className="inline-flex items-center gap-2 bg-gradient-to-r from-amber-500 to-red-500 text-white font-bold px-5 py-2.5 rounded-lg text-sm hover:opacity-90 transition-opacity">
          <Zap size={15} /> Conseguir plaza LTD — €199
        </button>
      </div>

      {/* Toggle */}
      <div className="flex items-center justify-center gap-3 mb-6">
        <button onClick={() => setAnnual(false)} className={`px-4 py-1.5 rounded-full text-sm font-semibold border transition-colors ${!annual ? 'bg-indigo-600 text-white border-indigo-600' : 'text-gray-500 border-gray-300'}`}>Mensual</button>
        <button onClick={() => setAnnual(true)} className={`px-4 py-1.5 rounded-full text-sm font-semibold border flex items-center gap-2 transition-colors ${annual ? 'bg-indigo-600 text-white border-indigo-600' : 'text-gray-500 border-gray-300'}`}>
          Anual
          <span className="bg-green-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">−17%</span>
        </button>
      </div>

      {/* Plans grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {PLANS.map(plan => {
          const isCurrent = currentPlan === plan.id
          const isLoading = loadingPlan === plan.id && isPending

          return (
            <div key={plan.id} className="relative flex flex-col rounded-2xl p-5 border-2 transition-shadow"
              style={{ borderColor: plan.popular ? plan.color : '#E2E8F0', boxShadow: plan.popular ? `0 4px 20px ${plan.color}25` : undefined }}>
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 text-white text-xs font-bold px-3 py-0.5 rounded-full whitespace-nowrap" style={{ background: plan.color }}>⭐ Popular</div>
              )}
              <div className="text-2xl mb-1">{plan.icon}</div>
              <div className="font-bold text-gray-900 mb-3">{plan.name}</div>

              <div className="mb-1">
                <span className="text-3xl font-black text-gray-900">€{annual ? plan.annualMonthly : plan.monthlyPrice}</span>
                <span className="text-gray-400 text-sm">/mes</span>
              </div>
              {annual && <p className="text-xs text-gray-400 mb-1">€{plan.annualPrice}/año</p>}
              <p className="text-xs font-semibold text-gray-500 mb-4">{plan.limit}</p>

              <ul className="flex flex-col gap-1.5 mb-5 flex-1">
                {plan.features.map(f => (
                  <li key={f} className="flex gap-2 text-xs text-gray-600">
                    <Check size={13} style={{ color: plan.color, flexShrink: 0, marginTop: 1 }} />
                    {f}
                  </li>
                ))}
              </ul>

              <button
                onClick={() => startCheckout(plan.id)}
                disabled={isCurrent || isLoading || isPending}
                className="w-full py-2.5 rounded-lg text-sm font-bold transition-opacity"
                style={{
                  background: isCurrent ? '#E2E8F0' : plan.popular ? plan.color : 'transparent',
                  color: isCurrent ? '#94A3B8' : plan.popular ? '#fff' : plan.color,
                  border: isCurrent || plan.popular ? 'none' : `2px solid ${plan.color}`,
                  cursor: isCurrent ? 'default' : 'pointer',
                  opacity: isLoading ? 0.7 : 1,
                }}>
                {isCurrent ? 'Plan actual' : isLoading ? 'Cargando…' : plan.id === 'elite' ? 'Contactar' : 'Seleccionar'}
              </button>
            </div>
          )
        })}
      </div>

      <p className="text-center text-xs text-gray-400 mt-6">🔒 Pago seguro vía Stripe · Cancela cuando quieras · Garantía 30 días</p>
    </div>
  )
}
