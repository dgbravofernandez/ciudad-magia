'use server'

// Stripe Connect Express — server actions de ONBOARDING (Parte B fase 1).
// No procesan cobros todavía (eso es fase 2). Solo:
//   1. Crear la Connected Account (tipo 'express') del club si no existe.
//   2. Generar AccountLink para que el admin del club complete el onboarding
//      (KYC + cuenta bancaria) en una sesión guiada por Stripe.
//   3. Leer/refrescar el estado de la cuenta (charges_enabled + payouts_enabled).
//   4. Activar/desactivar el flag stripe_cobros_enabled (opt-in real).
//
// Patrón obligatorio: getScopedClient → admin/dirección → createAdminClient → club_id.

import { getScopedClient } from '@/lib/supabase/scoped-client'
import { createAdminClient } from '@/lib/supabase/admin'
import { getStripe } from '@/lib/stripe-connect'
import { revalidatePath } from 'next/cache'
import type Stripe from 'stripe'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://cluberly.club'

export type StripeAccountStatus = 'pending' | 'active' | 'restricted' | 'rejected' | null

export interface CobrosConfig {
  enabled: boolean                       // stripe_cobros_enabled flag
  accountId: string | null
  status: StripeAccountStatus
  chargesEnabled: boolean                // se recalcula contra Stripe en getCobrosConfig
  payoutsEnabled: boolean
  detailsSubmitted: boolean              // KYC terminado por el club
  onboardingStartedAt: string | null
  onboardingCompletedAt: string | null
}

/**
 * Devuelve el estado actual del club + (si tiene account) lo refresca contra
 * la API de Stripe. Esto evita que la UI muestre datos obsoletos si Stripe
 * actualizó al club por su cuenta (KYC completado, restringido, etc.).
 */
export async function getCobrosConfig(): Promise<{ success: boolean; error?: string; config?: CobrosConfig }> {
  try {
    const { sb, clubId, roles } = await getScopedClient()
    if (!roles.some((r: string) => ['admin', 'direccion'].includes(r))) {
      return { success: false, error: 'Solo admin / dirección' }
    }

    const { data: settings } = await sb.from('club_settings')
      .select('stripe_account_id, stripe_account_status, stripe_cobros_enabled, stripe_onboarding_started_at, stripe_onboarding_completed_at')
      .eq('club_id', clubId).maybeSingle()

    const config: CobrosConfig = {
      enabled: !!settings?.stripe_cobros_enabled,
      accountId: settings?.stripe_account_id ?? null,
      status: (settings?.stripe_account_status as StripeAccountStatus) ?? null,
      chargesEnabled: false,
      payoutsEnabled: false,
      detailsSubmitted: false,
      onboardingStartedAt: settings?.stripe_onboarding_started_at ?? null,
      onboardingCompletedAt: settings?.stripe_onboarding_completed_at ?? null,
    }

    // Si ya hay account, refrescamos contra Stripe (idempotente)
    if (config.accountId) {
      try {
        const stripe = getStripe()
        const acct = await stripe.accounts.retrieve(config.accountId)
        config.chargesEnabled = !!acct.charges_enabled
        config.payoutsEnabled = !!acct.payouts_enabled
        config.detailsSubmitted = !!acct.details_submitted
        const newStatus = computeAccountStatus(acct)
        if (newStatus !== config.status) {
          config.status = newStatus
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const sbAdmin = createAdminClient() as any
          await sbAdmin.from('club_settings')
            .update({
              stripe_account_status: newStatus,
              ...(newStatus === 'active' && !config.onboardingCompletedAt
                ? { stripe_onboarding_completed_at: new Date().toISOString() }
                : {}),
            })
            .eq('club_id', clubId)
        }
      } catch (e) {
        // No fatal: mostramos lo que tengamos en BD. Stripe puede tener un blip.
        console.warn('[getCobrosConfig] Stripe retrieve falló:', (e as Error).message)
      }
    }

    return { success: true, config }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

function computeAccountStatus(acct: Stripe.Account): StripeAccountStatus {
  if (acct.charges_enabled && acct.payouts_enabled) return 'active'
  if (acct.requirements?.disabled_reason === 'rejected.fraud'
      || acct.requirements?.disabled_reason === 'rejected.terms_of_service'
      || acct.requirements?.disabled_reason === 'rejected.other') return 'rejected'
  if ((acct.requirements?.currently_due ?? []).length > 0
      || (acct.requirements?.past_due ?? []).length > 0) return 'restricted'
  if (acct.details_submitted) return 'pending'   // info entregada, Stripe procesando
  return 'pending'   // aún sin completar onboarding
}

/**
 * Crea la Connected Account si no existe + devuelve la URL del AccountLink
 * para el onboarding. Si ya existe la account, solo regenera el link (los
 * AccountLink caducan en 5 min, hay que regenerar siempre).
 */
export async function startStripeOnboarding(): Promise<{ success: boolean; error?: string; url?: string }> {
  try {
    const { sb, clubId, roles } = await getScopedClient()
    if (!roles.some((r: string) => ['admin', 'direccion'].includes(r))) {
      return { success: false, error: 'Solo admin / dirección' }
    }
    if (!process.env.STRIPE_SECRET_KEY) {
      return { success: false, error: 'Stripe no está configurado en este entorno (falta STRIPE_SECRET_KEY).' }
    }

    const { data: club } = await sb.from('clubs').select('name, country').eq('id', clubId).single()
    if (!club) return { success: false, error: 'Club no encontrado' }

    const { data: settings } = await sb.from('club_settings')
      .select('stripe_account_id, stripe_onboarding_started_at').eq('club_id', clubId).maybeSingle()

    const stripe = getStripe()
    let accountId = settings?.stripe_account_id as string | null

    // 1. Crear cuenta Express si no existe (idempotente: si ya hay accountId la reusa)
    if (!accountId) {
      const acct = await stripe.accounts.create({
        type: 'express',
        country: club.country ?? 'ES',
        business_type: 'non_profit',      // mayoría de clubes son asociaciones sin ánimo de lucro
        business_profile: {
          name: club.name,
          product_description: 'Cobro de cuotas e inscripciones del club',
          mcc: '8641',                    // Civic, Social and Fraternal Associations
        },
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
        },
        metadata: {
          cluberly_club_id: clubId,
        },
      })
      accountId = acct.id
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sbAdmin = createAdminClient() as any
      await sbAdmin.from('club_settings').update({
        stripe_account_id: accountId,
        stripe_account_status: 'pending',
        stripe_onboarding_started_at: new Date().toISOString(),
      }).eq('club_id', clubId)
    }

    // 2. AccountLink — onboarding guiado de Stripe (5 min de validez)
    const link = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${APP_URL}/configuracion/cobros?stripe=refresh`,
      return_url: `${APP_URL}/configuracion/cobros?stripe=return`,
      type: 'account_onboarding',
    })

    return { success: true, url: link.url }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

/**
 * Activar / desactivar el flag stripe_cobros_enabled.
 * Reglas:
 * - Solo se puede ACTIVAR si charges_enabled=true en Stripe (onboarding completo).
 * - DESACTIVAR siempre se puede. No invalida links ya enviados (siguen funcionando
 *   hasta que el cliente pague o caduquen), solo bloquea crear NUEVOS links.
 */
export async function setCobrosEnabled(enabled: boolean): Promise<{ success: boolean; error?: string }> {
  try {
    const { sb, clubId, roles } = await getScopedClient()
    if (!roles.some((r: string) => ['admin', 'direccion'].includes(r))) {
      return { success: false, error: 'Solo admin / dirección' }
    }

    if (enabled) {
      // Validar contra Stripe que el club PUEDE cobrar antes de activar el flag
      const cfg = await getCobrosConfig()
      if (!cfg.success || !cfg.config) return { success: false, error: cfg.error ?? 'No se pudo leer la configuración' }
      if (!cfg.config.chargesEnabled) {
        return { success: false, error: 'Tu cuenta Stripe aún no permite cobrar. Termina el onboarding antes de activar.' }
      }
    }

    const { error } = await sb.from('club_settings')
      .update({ stripe_cobros_enabled: enabled }).eq('club_id', clubId)
    if (error) return { success: false, error: error.message }

    revalidatePath('/configuracion/cobros')
    revalidatePath('/contabilidad/pagos')
    return { success: true }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

/**
 * Genera un Dashboard Login Link de Stripe Express para que el club acceda a
 * SU panel (ver cobros, refunds, transferencias). NO le damos acceso al panel
 * de la plataforma — solo al suyo.
 */
export async function getStripeDashboardLink(): Promise<{ success: boolean; error?: string; url?: string }> {
  try {
    const { sb, clubId, roles } = await getScopedClient()
    if (!roles.some((r: string) => ['admin', 'direccion'].includes(r))) {
      return { success: false, error: 'Solo admin / dirección' }
    }
    const { data: settings } = await sb.from('club_settings')
      .select('stripe_account_id').eq('club_id', clubId).maybeSingle()
    const accountId = settings?.stripe_account_id as string | undefined
    if (!accountId) return { success: false, error: 'Tu club aún no tiene cuenta Stripe activada.' }

    const stripe = getStripe()
    const login = await stripe.accounts.createLoginLink(accountId)
    return { success: true, url: login.url }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}
