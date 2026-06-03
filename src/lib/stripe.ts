import Stripe from 'stripe'

let _stripe: Stripe | null = null

export function getStripe(): Stripe {
  if (!_stripe) {
    if (!process.env.STRIPE_SECRET_KEY) {
      throw new Error('STRIPE_SECRET_KEY is not configured')
    }
    _stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      apiVersion: '2025-01-27.acacia' as any,
    })
  }
  return _stripe
}

/** @deprecated use getStripe() */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const stripe: any = new Proxy({}, {
  get(_t, prop) {
    return (getStripe() as any)[prop]
  },
})

// Anual = 10 meses (2 meses gratis). annualMonthly = annualPrice / 12.
export const PLANS = {
  basic: {
    name: 'Básico',
    icon: '🌱',
    price: 39,
    annualPrice: 390,
    annualMonthly: 33,
    priceId: process.env.STRIPE_PRICE_BASIC ?? '',
    priceIdAnnual: process.env.STRIPE_PRICE_BASIC_ANNUAL ?? '',
    members: 100,
    description: 'Para clubes pequeños: socios, cuotas y comunicaciones.',
  },
  pro: {
    name: 'Pro',
    icon: '🏆',
    price: 89,
    annualPrice: 890,
    annualMonthly: 74,
    priceId: process.env.STRIPE_PRICE_PRO ?? '',
    priceIdAnnual: process.env.STRIPE_PRICE_PRO_ANNUAL ?? '',
    members: 300,
    description: 'Sesiones, contabilidad completa, informes y recordatorios automáticos.',
    popular: true,
  },
  club: {
    name: 'Club',
    icon: '🎯',
    price: 149,
    annualPrice: 1490,
    annualMonthly: 124,
    priceId: process.env.STRIPE_PRICE_CLUB ?? '',
    priceIdAnnual: process.env.STRIPE_PRICE_CLUB_ANNUAL ?? '',
    members: 600,
    description: 'Para clubes grandes: todo + evaluaciones, lesiones avanzado y soporte prioritario.',
  },
  personalizado: {
    name: 'Personalizado',
    icon: '👑',
    price: 0,
    annualPrice: 0,
    annualMonthly: 0,
    priceId: '',          // sin precio fijo — se contrata por contacto
    priceIdAnnual: '',
    members: 9999,
    description: 'Federaciones, +600 miembros, integraciones a medida, onboarding y SLA.',
  },
} as const

export type PlanId = keyof typeof PLANS
