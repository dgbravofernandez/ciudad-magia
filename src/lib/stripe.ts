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
  starter: {
    name: 'Starter',
    icon: '🌱',
    price: 49,
    annualPrice: 490,
    priceId: process.env.STRIPE_PRICE_STARTER ?? '',
    priceIdAnnual: process.env.STRIPE_PRICE_STARTER_ANNUAL ?? '',
    members: 75,
    description: 'Para clubs pequeños que empiezan a digitalizarse.',
  },
  pro: {
    name: 'Pro',
    icon: '⚽',
    price: 99,
    annualPrice: 990,
    priceId: process.env.STRIPE_PRICE_PRO ?? '',
    priceIdAnnual: process.env.STRIPE_PRICE_PRO_ANNUAL ?? '',
    members: 200,
    description: 'El más popular. Para clubs en activo con múltiples grupos.',
  },
  club: {
    name: 'Club',
    icon: '🏆',
    price: 179,
    annualPrice: 1790,
    priceId: process.env.STRIPE_PRICE_CLUB ?? '',
    priceIdAnnual: process.env.STRIPE_PRICE_CLUB_ANNUAL ?? '',
    members: 500,
    description: 'Para clubs medianos con alta actividad.',
  },
  elite: {
    name: 'Elite',
    icon: '👑',
    price: 279,
    annualPrice: 2790,
    priceId: process.env.STRIPE_PRICE_ELITE ?? '',
    priceIdAnnual: process.env.STRIPE_PRICE_ELITE_ANNUAL ?? '',
    members: -1,
    description: 'Para academias con más de 500 miembros.',
  },
  ltd: {
    name: 'LTD — Acceso de por vida',
    icon: '⚡',
    price: 199,
    annualPrice: 199,
    priceId: process.env.STRIPE_PRICE_LTD ?? '',
    priceIdAnnual: process.env.STRIPE_PRICE_LTD ?? '',
    members: 200,
    description: 'Pago único. Plan Pro para siempre.',
  },
} as const

export type PlanId = keyof typeof PLANS
