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

export const PLANS = {
  basic: {
    name: 'Básico',
    icon: '🌱',
    price: 29,
    annualPrice: 288,
    annualMonthly: 24,
    priceId: process.env.STRIPE_PRICE_BASIC ?? '',
    priceIdAnnual: process.env.STRIPE_PRICE_BASIC_ANNUAL ?? '',
    members: 50,
    description: 'Para clubs pequeños: socios, cuotas manuales y comunicaciones.',
  },
  starter: {
    name: 'Starter',
    icon: '⚽',
    price: 59,
    annualPrice: 588,
    annualMonthly: 49,
    priceId: process.env.STRIPE_PRICE_STARTER ?? '',
    priceIdAnnual: process.env.STRIPE_PRICE_STARTER_ANNUAL ?? '',
    members: 150,
    description: 'Sesiones, asistencia y grupos para clubs en crecimiento.',
  },
  pro: {
    name: 'Pro',
    icon: '🏆',
    price: 109,
    annualPrice: 1080,
    annualMonthly: 90,
    priceId: process.env.STRIPE_PRICE_PRO ?? '',
    priceIdAnnual: process.env.STRIPE_PRICE_PRO_ANNUAL ?? '',
    members: 300,
    description: 'Gastos, balance, recordatorios automáticos y métricas.',
    popular: true,
  },
  club: {
    name: 'Club',
    icon: '🎯',
    price: 199,
    annualPrice: 1980,
    annualMonthly: 165,
    priceId: process.env.STRIPE_PRICE_CLUB ?? '',
    priceIdAnnual: process.env.STRIPE_PRICE_CLUB_ANNUAL ?? '',
    members: 750,
    description: 'Evaluaciones, lesiones avanzado, exportación y Google Sheets.',
  },
  elite: {
    name: 'Elite',
    icon: '👑',
    price: 349,
    annualPrice: 3468,
    annualMonthly: 289,
    priceId: process.env.STRIPE_PRICE_ELITE ?? '',
    priceIdAnnual: process.env.STRIPE_PRICE_ELITE_ANNUAL ?? '',
    members: 1500,
    description: 'Hasta 1.500 miembros, API access, SLA y account manager.',
  },
} as const

export type PlanId = keyof typeof PLANS
