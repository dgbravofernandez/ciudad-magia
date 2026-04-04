import { createClient } from '@/lib/supabase/server'
import { headers } from 'next/headers'
import { RedesPage } from '@/features/personal/redes/components/RedesPage'
import { Topbar } from '@/components/layout/Topbar'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Redes Sociales y Fotos' }

export default async function RedesPageRoute() {
  const headersList = await headers()
  const clubId = headersList.get('x-club-id')!

  const supabase = await createClient()

  const { data: mediaItems } = await supabase
    .from('media_items')
    .select(`
      *,
      teams(id, name)
    `)
    .eq('club_id', clubId)
    .order('created_at', { ascending: false })
    .limit(100)

  const { data: teams } = await supabase
    .from('teams')
    .select('id, name')
    .eq('club_id', clubId)
    .eq('active', true)
    .order('name')

  return (
    <div className="flex flex-col h-full">
      <Topbar title="Redes Sociales y Fotos" />
      <div className="flex-1 p-6">
        <RedesPage
          clubId={clubId}
          mediaItems={mediaItems ?? []}
          teams={teams ?? []}
        />
      </div>
    </div>
  )
}
