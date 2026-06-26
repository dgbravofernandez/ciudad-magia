// Helpers de Stripe Connect (cobros de cuotas con application fee).
// Reusa STRIPE_SECRET_KEY existente y la misma instancia base. Solo añade
// constantes de fee + el cliente con `apiVersion` actualizada.
import { getStripe } from './stripe'

// Application fee híbrido aprobado: 0,50 € fijo + 0,5 % del importe.
// En céntimos: 50 + round(amount_cents * 0.005). Sobre 60 € (6000 c) → 80 c.
export const APP_FEE_FIXED_CENTS = 50
export const APP_FEE_PERCENT = 0.005

export function calculateApplicationFee(amountCents: number): number {
  if (!amountCents || amountCents <= 0) return 0
  const fee = APP_FEE_FIXED_CENTS + Math.round(amountCents * APP_FEE_PERCENT)
  // Cap razonable: nunca cobrar más del 5 % del importe (protección si alguien
  // mete una cuota de 1 €: el fijo 0,50 € sería el 50 %, absurdo).
  const cap = Math.round(amountCents * 0.05)
  return Math.min(fee, Math.max(cap, APP_FEE_FIXED_CENTS))
}

/**
 * Texto humano del fee para enseñar al club ANTES de activar (transparencia
 * legal Connect + LSSI). Lo usa /configuracion/cobros.
 */
export function feeBreakdown(amountCents: number): {
  cluberly: number; stripe: number; total: number; net: number
} {
  // Stripe EU tarjeta: 1,5 % + 0,25 € (puede variar; valor orientativo, real lo
  // ve el club en su dashboard Stripe).
  const stripeFee = Math.round(amountCents * 0.015) + 25
  const cluberly = calculateApplicationFee(amountCents)
  return {
    cluberly,
    stripe: stripeFee,
    total: cluberly + stripeFee,
    net: amountCents - cluberly - stripeFee,
  }
}

export { getStripe }
