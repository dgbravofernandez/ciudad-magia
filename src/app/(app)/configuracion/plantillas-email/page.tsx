import { Topbar } from '@/components/layout/Topbar'
import { PlantillasEmailPage } from '@/features/configuracion/components/PlantillasEmailPage'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Plantillas de email' }
export const dynamic = 'force-dynamic'
export const maxDuration = 30

export default function Page() {
  return (
    <div className="flex flex-col h-full">
      <Topbar title="Plantillas de email" />
      <div className="flex-1 p-6 overflow-hidden">
        <PlantillasEmailPage />
      </div>
    </div>
  )
}
