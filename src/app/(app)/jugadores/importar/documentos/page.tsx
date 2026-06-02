import { headers } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/admin'
import { Topbar } from '@/components/layout/Topbar'
import { SincronizarDocumentos } from '@/features/jugadores/components/SincronizarDocumentos'

export default async function SyncDocumentosPage() {
  const headersList = await headers()
  const clubId = headersList.get('x-club-id')!

  // Leer IDs de hojas desde club_settings — genérico por club
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createAdminClient() as any
  const { data: settings } = await sb
    .from('club_settings')
    .select('docs_sheet_id, tutors_sheet_id')
    .eq('club_id', clubId)
    .single()

  const docsSheetId   = (settings as { docs_sheet_id?: string | null } | null)?.docs_sheet_id   ?? null
  const tutorsSheetId = (settings as { tutors_sheet_id?: string | null } | null)?.tutors_sheet_id ?? null

  return (
    <div className="flex flex-col h-full">
      <Topbar title="Sincronizar documentos" />
      <div className="flex-1 overflow-auto">
        <SincronizarDocumentos
          clubId={clubId}
          docsSheetId={docsSheetId}
          tutorsSheetId={tutorsSheetId}
        />
      </div>
    </div>
  )
}
