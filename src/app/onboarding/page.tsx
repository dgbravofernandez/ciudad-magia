import { Suspense } from 'react'
import OnboardingClient from './OnboardingClient'

export const metadata = {
  title: 'Crear cuenta — Cluberly',
}

export default function OnboardingPage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: 32, height: 32, borderRadius: '50%', border: '3px solid #E2E8F0', borderTopColor: '#6366F1', animation: 'spin 0.6s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      </div>
    }>
      <OnboardingClient />
    </Suspense>
  )
}
