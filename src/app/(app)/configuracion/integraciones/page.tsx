import { Topbar } from '@/components/layout/Topbar'
import { IntegracionesPage } from '@/features/integraciones/components/IntegracionesPage'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Integraciones' }
export const dynamic = 'force-dynamic'
export const maxDuration = 60

export default function Page() {
  return (
    <div className="flex flex-col h-full">
      <Topbar title="Integraciones" />
      <div className="flex-1 p-6">
        <IntegracionesPage />
      </div>
    </div>
  )
}
