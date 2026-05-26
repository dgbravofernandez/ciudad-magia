/**
 * setup-stripe.ts
 * Crea todos los productos y precios de Cluberly en Stripe.
 *
 * Uso:
 *   STRIPE_SECRET_KEY=sk_live_xxx npx tsx scripts/setup-stripe.ts
 *
 * El script es idempotente: busca productos existentes por metadata.plan_id
 * antes de crear nuevos, para poder re-ejecutarlo sin duplicados.
 */

import Stripe from 'stripe'

const key = process.env.STRIPE_SECRET_KEY
if (!key) {
  console.error('❌  Falta STRIPE_SECRET_KEY')
  process.exit(1)
}

const stripe = new Stripe(key, { apiVersion: '2025-01-27.acacia' as never })

// ─── Catálogo de planes ────────────────────────────────────────────────────
const PLANS = [
  {
    id: 'basic',
    name: 'Básico',
    description: 'Para clubs muy pequeños: gestión de socios, cuotas manuales y comunicaciones.',
    monthlyEur: 29_00,   // céntimos
    annualEur:  288_00,
    members: 50,
  },
  {
    id: 'starter',
    name: 'Starter',
    description: 'Sesiones, asistencia y grupos para clubs en crecimiento.',
    monthlyEur: 59_00,
    annualEur:  588_00,
    members: 150,
  },
  {
    id: 'pro',
    name: 'Pro',
    description: 'Gastos, balance, recordatorios automáticos, SMTP propio y métricas.',
    monthlyEur: 109_00,
    annualEur:  1_080_00,
    members: 300,
  },
  {
    id: 'club',
    name: 'Club',
    description: 'Evaluaciones, lesiones avanzado, exportación y Google Sheets sync.',
    monthlyEur: 199_00,
    annualEur:  1_980_00,
    members: 750,
  },
  {
    id: 'elite',
    name: 'Elite',
    description: 'Hasta 1.500 miembros, API access, SLA y account manager.',
    monthlyEur: 349_00,
    annualEur:  3_468_00,
    members: 1500,
  },
] as const

// ─── Helpers ───────────────────────────────────────────────────────────────
async function getOrCreateProduct(plan: typeof PLANS[number]): Promise<string> {
  // Buscar producto existente por metadata
  const existing = await stripe.products.search({
    query: `metadata["plan_id"]:"${plan.id}"`,
  })

  if (existing.data.length > 0) {
    console.log(`  ↻ Producto existente: ${existing.data[0].id} (${plan.name})`)
    return existing.data[0].id
  }

  const product = await stripe.products.create({
    name: `Cluberly ${plan.name}`,
    description: plan.description,
    metadata: {
      plan_id: plan.id,
      members_limit: String(plan.members),
    },
  })

  console.log(`  + Producto creado: ${product.id} (${plan.name})`)
  return product.id
}

async function getOrCreatePrice(
  productId: string,
  planId: string,
  amountCents: number,
  interval: 'month' | 'year',
): Promise<string> {
  const metaKey = interval === 'month' ? 'monthly_price_for' : 'annual_price_for'

  const existing = await stripe.prices.search({
    query: `metadata["${metaKey}"]:"${planId}"`,
  })

  if (existing.data.length > 0) {
    const p = existing.data[0]
    console.log(`  ↻ Precio existente ${interval}: ${p.id}  (€${(amountCents / 100).toFixed(2)})`)
    return p.id
  }

  const price = await stripe.prices.create({
    product: productId,
    unit_amount: amountCents,
    currency: 'eur',
    recurring: { interval },
    metadata: { [metaKey]: planId },
    nickname: `Cluberly ${planId} — ${interval === 'month' ? 'mensual' : 'anual'}`,
  })

  console.log(`  + Precio ${interval} creado: ${price.id}  (€${(amountCents / 100).toFixed(2)})`)
  return price.id
}

// ─── Main ──────────────────────────────────────────────────────────────────
async function main() {
  console.log('🚀  Configurando Stripe para Cluberly…\n')

  const envLines: string[] = []

  for (const plan of PLANS) {
    console.log(`\n📦  ${plan.name.toUpperCase()} (${plan.members} miembros)`)

    const productId = await getOrCreateProduct(plan)
    const monthlyId = await getOrCreatePrice(productId, plan.id, plan.monthlyEur, 'month')
    const annualId  = await getOrCreatePrice(productId, plan.id, plan.annualEur, 'year')

    const key = plan.id.toUpperCase()
    envLines.push(`STRIPE_PRICE_${key}=${monthlyId}`)
    envLines.push(`STRIPE_PRICE_${key}_ANNUAL=${annualId}`)
  }

  console.log('\n\n✅  HECHO. Copia estas variables en Vercel (Settings → Environment Variables):\n')
  console.log('─'.repeat(60))
  console.log(envLines.join('\n'))
  console.log('─'.repeat(60))
  console.log('\nRecuerda también añadir:')
  console.log('  STRIPE_SECRET_KEY=sk_live_...')
  console.log('  STRIPE_WEBHOOK_SECRET=whsec_...')
  console.log('\nWebhook endpoint:')
  console.log('  https://ciudad-magia-qj91.vercel.app/api/stripe/webhook')
  console.log('  Eventos: checkout.session.completed, customer.subscription.updated,')
  console.log('           customer.subscription.deleted, invoice.payment_failed\n')
}

main().catch((e) => {
  console.error('❌ Error:', e.message)
  process.exit(1)
})
