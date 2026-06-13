import { createAdminClient } from '@/lib/supabase/admin'
import { ReferView } from './ReferView'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Recomienda Cluberly a otros clubes',
  description: 'Si os ha gustado Cluberly, ¿conocéis 2 clubes parecidos al vuestro? Os lo agradecemos.',
}

export default async function RecomendarPage({
  searchParams,
}: {
  searchParams: Promise<{ c?: string }>
}) {
  const sp = await searchParams

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createAdminClient() as any

  let referrerName: string | null = null
  let referrerClubId: string | null = null

  if (sp.c) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: club } = await sb.from('clubs').select('id, name').eq('id', sp.c).maybeSingle()
    if (club) {
      referrerName = club.name
      referrerClubId = club.id
    }
  }

  return <ReferView referrerName={referrerName} referrerClubId={referrerClubId} />
}
