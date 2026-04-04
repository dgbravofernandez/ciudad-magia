import { createClient } from '@/lib/supabase/server'
import { headers } from 'next/headers'
import { ConfiguracionPage } from '@/features/configuracion/components/ConfiguracionPage'

export default async function Configuracion() {
  const hdrs = await headers()
  const clubId = hdrs.get('x-club-id')!
  const supabase = await createClient()

  const [settingsRes, membersRes] = await Promise.all([
    supabase.from('club_settings').select('*').eq('club_id', clubId).single(),
    supabase.from('club_members').select('*, club_member_roles(role, team_id)').eq('club_id', clubId),
  ])

  return <ConfiguracionPage settings={settingsRes.data} members={membersRes.data ?? []} clubId={clubId} />
}
