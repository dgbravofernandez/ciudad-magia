import { headers } from 'next/headers'
import { Topbar } from '@/components/layout/Topbar'
import { SincronizarDocumentos } from '@/features/jugadores/components/SincronizarDocumentos'

export default async function SyncDocumentosPage() {
  const headersList = await headers()
  const clubId = headersList.get('x-club-id')!

  return (
    <div className="flex flex-col h-full">
      <Topbar title="Sincronizar documentos" />
      <div className="flex-1 overflow-auto">
        <SincronizarDocumentos clubId={clubId} />
      </div>
    </div>
  )
}
