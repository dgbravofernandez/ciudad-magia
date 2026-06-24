'use server'
// Registra un click procedente de un email de texto plano.
// Se llama desde Server Components de /demo y /reservar cuando llegan con ?s=sendId.
// Equivalente a /api/marketing/click/[sendId] pero sin redirect (la página ya carga).

import { createAdminClient } from '@/lib/supabase/admin'

export async function recordEmailClick(sendId: string, destination: string) {
  if (!sendId || sendId === 'test') return
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = createAdminClient() as any
    await Promise.all([
      sb.from('marketing_email_clicks').insert({
        send_id: sendId,
        destination,
        user_agent: 'plain-text-link',
      }),
      sb.from('marketing_email_sends')
        .update({ clicked_at: new Date().toISOString() })
        .eq('id', sendId)
        .is('clicked_at', null),
    ])
  } catch { /* tracking nunca rompe */ }
}
