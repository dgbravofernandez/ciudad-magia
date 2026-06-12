import LandingPage from '@/components/landing/LandingPage'
import { UtmCapture } from '@/components/landing/UtmCapture'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Cluberly — El CRM para clubs deportivos',
  description: 'Gestiona socios, cuotas, sesiones, asistencias y comunicaciones. Multi-deporte. Sin Excel. Sin papeles.',
}

export default function RootPage() {
  return (
    <>
      <UtmCapture />
      <LandingPage />
    </>
  )
}
