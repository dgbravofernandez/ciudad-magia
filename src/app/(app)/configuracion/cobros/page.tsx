import { Topbar } from '@/components/layout/Topbar'
import { CobrosConfigPage } from '@/features/configuracion/components/CobrosConfigPage'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Cobros con tarjeta' }
export const dynamic = 'force-dynamic'
export const maxDuration = 30

export default function Page() {
  return (
    <div className="flex flex-col h-full">
      <Topbar title="Cobros con tarjeta" />
      <div className="flex-1 p-6">
        <CobrosConfigPage />
      </div>
    </div>
  )
}
