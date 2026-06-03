'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useClub } from '@/context/ClubContext'
import { useCurrentUser } from '@/context/UserContext'
import { Check, ExternalLink } from 'lucide-react'

export const dynamic = 'force-dynamic'

const PLANS = [
  {
    id: 'basic',
    name: 'Básico',
    icon: '🌱',
    color: '#6B7280',
    monthlyPrice: 39,
    annualPrice: 390,
    annualMonthly: 33,
    limit: 'Hasta 100 jugadores',
    features: ['Jugadores y altas', 'Cuotas', 'Comunicaciones email', 'Formulario de inscripción', 'Soporte email'],
  },
  {
    id: 'pro',
    name: 'Pro',
    icon: '🏆',
    color: '#6366F1',
    monthlyPrice: 89,
    annualPrice: 890,
    annualMonthly: 74,
    limit: 'Hasta 300 jugadores',
    popular: true,
    features: ['Todo Básico', 'Sesiones y asistencia', 'Contabilidad completa', 'Informes', 'Recordatorios automáticos de cobro', 'Soporte WhatsApp'],
  },
  {
    id: 'club',
    name: 'Club',
    icon: '🎯',
    color: '#F59E0B',
    monthlyPrice: 149,
    annualPrice: 1490,
    annualMonthly: 124,
    limit: 'Hasta 600 jugadores',
    features: ['Todo Pro', 'Evaluaciones de jugadores', 'Lesiones avanzado', 'Exportación de datos', 'Google Sheets sync', 'Soporte prioritario'],
  },
  {
    id: 'personalizado',
    name: 'Personalizado',
    icon: '👑',
    color: '#0F172A',
    monthlyPrice: 0,
    annualPrice: 0,
    annualMonthly: 0,
    limit: 'Federaciones y +600',
    features: ['Todo Club', 'Jugadores ilimitados', 'Integraciones a medida', 'Onboarding presencial', 'SLA garantizado'],
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
    if (planId === 'personalizado') {
      window.location.href = 'mailto:iakevoapp@gmail.com?subject=Plan%20Personalizado%20-%20' + encodeURIComponent(club.name)
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
  const trialEndsAt = (club as { trial_ends_at?: string }).trial_ends_at
  const daysLeft = trialEndsAt
    ? Math.max(0, Math.ceil((new Date(trialEndsAt).getTime() - Date.now()) / 86_400_000))
    : null

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Plan y facturación</h1>
        <p className="text-gray-500 text-sm mt-1">Gestiona tu suscripción. Cancela cuando quieras.</p>
      </div>

      {/* Current plan banner */}
      <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 mb-8 flex items-center justify-between flex-wrap gap-3">
        <div>
          <p className="text-sm text-indigo-600 font-semibold uppercase tracking-wide">Plan actual</p>
          <p className="text-lg font-bold text-indigo-900 capitalize">
            {currentPlan === 'trial'
              ? `🕐 Prueba gratuita${daysLeft !== null ? ` · ${daysLeft} días restantes` : ''}`
              : currentPlan}
          </p>
        </div>
        {hasStripe && (
          <button onClick={openPortal} disabled={isPending}
            className="flex items-center gap-2 text-sm font-semibold text-indigo-600 hover:text-indigo-800 border border-indigo-300 rounded-lg px-3 py-2 hover:bg-indigo-100 transition-colors">
            <ExternalLink size={14} /> Gestionar facturación
          </button>
        )}
      </div>

      {/* Toggle anual/mensual */}
      <div className="flex items-center justify-center gap-3 mb-8">
        <button
          onClick={() => setAnnual(false)}
          className={`px-4 py-1.5 rounded-full text-sm font-semibold border transition-colors ${!annual ? 'bg-indigo-600 text-white border-indigo-600' : 'text-gray-500 border-gray-300'}`}>
          Mensual
        </button>
        <button
          onClick={() => setAnnual(true)}
          className={`px-4 py-1.5 rounded-full text-sm font-semibold border flex items-center gap-2 transition-colors ${annual ? 'bg-indigo-600 text-white border-indigo-600' : 'text-gray-500 border-gray-300'}`}>
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
            <div key={plan.id}
              className="relative flex flex-col rounded-2xl p-5 border-2 transition-shadow"
              style={{
                borderColor: plan.popular ? plan.color : '#E2E8F0',
                boxShadow: plan.popular ? `0 4px 20px ${plan.color}25` : undefined,
              }}>
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 text-white text-xs font-bold px-3 py-0.5 rounded-full whitespace-nowrap"
                  style={{ background: plan.color }}>
                  ⭐ Popular
                </div>
              )}

              <div className="text-2xl mb-1">{plan.icon}</div>
              <div className="font-bold text-gray-900 mb-3">{plan.name}</div>

              <div className="mb-1">
                {plan.id === 'personalizado' ? (
                  <span className="text-3xl font-black text-gray-900">A medida</span>
                ) : (
                  <>
                    <span className="text-3xl font-black text-gray-900">
                      €{annual ? plan.annualMonthly : plan.monthlyPrice}
                    </span>
                    <span className="text-gray-400 text-sm">/mes</span>
                  </>
                )}
              </div>
              {annual && plan.id !== 'personalizado' && <p className="text-xs text-gray-400 mb-1">€{plan.annualPrice}/año</p>}
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
                {isCurrent ? 'Plan actual'
                  : isLoading ? 'Cargando…'
                  : plan.id === 'personalizado' ? 'Contactar'
                  : 'Seleccionar'}
              </button>
            </div>
          )
        })}
      </div>

      <p className="text-center text-xs text-gray-400 mt-6">
        🔒 Pago seguro vía Stripe · Cancela cuando quieras · Sin permanencia
      </p>
    </div>
  )
}
